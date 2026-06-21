import bcrypt from 'bcryptjs';
import { authenticate, authorize, guardResidentAccess, maskPHI, getRequestContext, handleError } from '@/lib/auth-guard.js';
import { withTenantClient, query, pool as pgPool } from '@/lib/db.js';
import { encryptFields, decryptFields, RESIDENT_ENCRYPTED_FIELDS } from '@/lib/encryption.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { getTenantKey } from '@/lib/tenant-key.js';

const audit = new AuditLogger();

export async function GET(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error, code: authResult.code }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.RESIDENTS_READ, PERMISSIONS.RESIDENTS_READ_OWN)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Guard resident_care_of users to only see their own record
    const guardResult = await guardResidentAccess(user, null);
    if (guardResult?.error) {
      return Response.json({ error: guardResult.error }, { status: guardResult.status });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page   = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit  = Math.min(100, parseInt(searchParams.get('limit') || '25'));
    const offset = (page - 1) * limit;

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const conditions = ['r.deleted_at IS NULL'];
      const params     = [];

      // If resident_care_of, filter to only their linked resident
      if (guardResult?.linkedResidentId) {
        params.push(guardResult.linkedResidentId);
        conditions.push(`r.id = $${params.length}`);
      }

      if (status) { params.push(status); conditions.push(`r.status = $${params.length}`); }

      const where = conditions.join(' AND ');
      if (!search) {
        params.push(limit, offset);
      }

      const { rows } = await client.query(
        `SELECT r.id, r.tenant_id, r.first_name, r.last_name, r.preferred_name,
                r.medicaid_id,
                r.status, r.intake_date, r.discharge_date, r.primary_diagnosis,
                r.age_at_admission, r.pronoun, r.gender,
                r.consent_to_treatment, r.has_advance_directive,
                r.substance_use_flag, r.legal_risk_flag,
                r.created_at, r.updated_at, r.version,
                COUNT(*) OVER() AS total_count
         FROM care.residents r
         WHERE ${where}
         ORDER BY r.intake_date DESC
         ${search ? 'LIMIT 2000' : `LIMIT $${params.length - 1} OFFSET $${params.length}`}`,
        params
      );
      return rows;
    });

    const tenantKey = await getTenantKey(user.tenantId);
    let residents = result.map(row => decryptFields(row, RESIDENT_ENCRYPTED_FIELDS, tenantKey));
    if (search) {
      const needle = search.toLowerCase();
      residents = residents.filter((row) =>
        [row.id, row.first_name, row.last_name, row.preferred_name, row.medicaid_id]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle))
      );
    }
    const total = search ? residents.length : +(result[0]?.total_count || 0);
    residents = residents
      .slice(search ? offset : 0, search ? offset + limit : undefined)
      .map(row => maskPHI(row, user.role));

    const req = getRequestContext(request, user);
    await audit.logSelect({ tableName: 'care.residents', req, justification: searchParams.get('justification') });

    return Response.json({
      data:       residents,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.RESIDENTS_CREATE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body      = await request.json();
    const tenantKey = await getTenantKey(user.tenantId);
    const encrypted = encryptFields(body, RESIDENT_ENCRYPTED_FIELDS, tenantKey);

    const resident = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO care.residents (
           tenant_id, first_name, last_name, preferred_name, pronoun, gender,
           date_of_birth, medicaid_id, ssn_last4, phone, email, preferred_contact_method,
           address_line1, address_line2, city, state, postal_code, country,
           language_preference, tribal_affiliation, spiritual_religious, other_cultural_factors,
           primary_diagnosis, secondary_diagnoses, substance_use_flag, legal_risk_flag,
           intake_date, target_discharge_date, housing_type_preferred, income_source_needed,
           aftercare_providers, consent_to_treatment, consent_date,
           rights_notification_date, grievance_procedure_date, has_advance_directive,
           has_guardian, guardian_representative, status, created_by, updated_by
         ) VALUES (
           $1,$2,$3,$4,$5,$6, $7,$8,$9,$10,$11,$12,
           $13,$14,$15,$16,$17,$18, $19,$20,$21,$22,
           $23,$24,$25,$26, $27,$28,$29,$30, $31,$32,$33,
           $34,$35,$36, $37,$38,$39,$40,$40
         ) RETURNING *`,
        [
          user.tenantId,
          encrypted.first_name, encrypted.last_name, encrypted.preferred_name,
          body.pronoun, body.gender, body.date_of_birth,
          encrypted.medicaid_id, encrypted.ssn_last4,
          encrypted.phone, encrypted.email, body.preferred_contact_method,
          encrypted.address_line1, body.address_line2, body.city,
          body.state || 'Oregon', body.postal_code, body.country || 'USA',
          body.language_preference, body.tribal_affiliation,
          body.spiritual_religious, body.other_cultural_factors,
          body.primary_diagnosis, body.secondary_diagnoses || [],
          body.substance_use_flag || false, body.legal_risk_flag || false,
          body.intake_date, body.target_discharge_date, body.housing_type_preferred,
          body.income_source_needed, body.aftercare_providers,
          body.consent_to_treatment || 'pending', body.consent_date,
          body.rights_notification_date, body.grievance_procedure_date,
          body.has_advance_directive || 'no',
          body.has_guardian || false, body.guardian_representative,
          body.status || 'active', user.staffId,
        ]
      );
      return rows[0];
    });

    // Optionally create a resident portal account
    if (body.email && body.portal_password) {
      const hash   = await bcrypt.hash(body.portal_password, 12);
      const client = await pgPool.connect();
      const accountEmail = body.email.toLowerCase().trim();
      try {
        const accountResult = await client.query(
          `INSERT INTO care.user_accounts (tenant_id, resident_id, email, username, password_hash, role, password_changed_required)
           VALUES ($1,$2,$3,$3,$4,'resident_care_of', TRUE)
           ON CONFLICT (email) DO UPDATE
             SET resident_id = EXCLUDED.resident_id,
                 username = EXCLUDED.username,
                 password_hash = EXCLUDED.password_hash,
                 role = EXCLUDED.role,
                 is_active = TRUE,
                 password_changed_required = TRUE,
                 failed_attempts = 0,
                 locked_until = NULL,
                 updated_at = NOW()
           RETURNING id`,
          [user.tenantId, resident.id, accountEmail, hash]
        );
        const accountId = accountResult.rows[0]?.id;

        if (accountId) {
          await client.query(
            `INSERT INTO care.notifications (
               tenant_id, role_filter, type, notification_type, category,
               title, body, action_url, resident_id, reference_id
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [
              user.tenantId,
              'admin,superadmin',
              'credentials',
              'new_credentials',
              'account',
              `New resident account: ${body.first_name || ''} ${body.last_name || ''}`.trim(),
              JSON.stringify({
                email: accountEmail,
                username: accountEmail,
                password: body.portal_password,
                mustChangeOnLogin: true,
                oneTimeView: true,
              }),
              '/admin?view=account_management',
              resident.id,
              accountId,
            ]
          );

          await client.query(
            `INSERT INTO care.notifications (
               tenant_id, user_id, type, notification_type, category,
               title, body, action_url, resident_id, reference_id
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [
              user.tenantId,
              accountId,
              'credentials',
              'new_credentials',
              'account',
              'Your resident portal account is ready',
              JSON.stringify({
                email: accountEmail,
                username: accountEmail,
                temporaryPasswordIssued: true,
                mustChangeOnLogin: true,
              }),
              '/auth/change-password-required',
              resident.id,
              accountId,
            ]
          );
        }
      } finally {
        client.release();
      }
    }

    const req = getRequestContext(request, user);
    await audit.logInsert({
      tableName: 'care.residents', recordId: resident.id, residentId: resident.id,
      newValues: { id: resident.id, status: resident.status, intake_date: resident.intake_date }, req,
    });

    return Response.json({ data: { id: resident.id, status: resident.status } }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
