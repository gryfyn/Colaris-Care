import { authenticate, authorize, handleError } from '@/lib/auth-guard';
import { withTenantClient } from '@/lib/db';
import { getRequestContext } from '@/lib/request-context';
import { generateCredentials } from '@/lib/credential-generator';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import bcrypt from 'bcryptjs';

const audit = new AuditLogger();

export async function POST(request) {
  const context = getRequestContext(request);

  try {
    const authResult = await authenticate(request);
    if (authResult.error) return new Response(JSON.stringify({ error: authResult.error }), { status: authResult.status });
    const { user } = authResult;

    // Enforce RBAC: only admins/managers can create residents
    if (!authorize(user.role, PERMISSIONS.RESIDENTS_CREATE)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: you do not have permission to create residents' }),
        { status: 403 }
      );
    }

    const data = await request.json();
    const {
      first_name,
      last_name,
      date_of_birth,
      gender,
      preferred_pronouns,
      medicaid_id,
      phone,
      email,
      address,
      city,
      state,
      zip,
      admission_date,
      primary_diagnosis,
      legal_status,
      createUserAccount,
      preferred_name,
      address_line2,
      country,
      preferred_contact_method,
      language_preference,
    } = data;

    if (!first_name || !last_name || !date_of_birth) {
      return new Response(
        JSON.stringify({ error: 'first_name, last_name, and date_of_birth required' }),
        { status: 400 }
      );
    }

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      // Create resident record
      const { rows: residentRows } = await client.query(
        `INSERT INTO care.residents (
          tenant_id, first_name, last_name, preferred_name, pronoun, gender, date_of_birth,
          preferred_contact_method, medicaid_id, phone, email, address_line1, address_line2,
          city, state, postal_code, country, language_preference, intake_date,
          primary_diagnosis, status, created_by, updated_by,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, first_name, last_name, email, date_of_birth`,
        [
          user.tenantId,
          first_name,
          last_name,
          preferred_name || `${first_name} ${last_name}`.trim() || null,
          preferred_pronouns || null,
          gender || null,
          date_of_birth,
          preferred_contact_method || null,
          medicaid_id || null,
          phone || null,
          email || null,
          address || null,
          address_line2 || null,
          city || null,
          state || 'Oregon',
          zip || null,
          country || 'USA',
          language_preference || null,
          admission_date || new Date().toISOString().split('T')[0],
          primary_diagnosis || null,
          'active',
          user.staffId,
          user.staffId,
        ]
      );

      const residentId = residentRows[0].id;
      let credentials = null;
      let userAccount = null;

      // Optionally create user account for resident portal access
      if (createUserAccount) {
        credentials = generateCredentials(first_name, last_name, 'resident');

        // Use bcrypt for password hashing (OWASP-recommended)
        const passwordHash = await bcrypt.hash(credentials.password, 12);

        const accountEmail = email || `${credentials.username}@dependablecare.local`;
        const { rows: userRows } = await client.query(
          `INSERT INTO care.user_accounts (
            tenant_id, resident_id, email, username, password_hash, role, password_changed_required
          ) VALUES ($1, $2, $3, $4, $5, $6, TRUE)
          RETURNING id, email, role`,
          [
            user.tenantId,
            residentId,
            accountEmail,
            credentials.username,
            passwordHash,
            'resident_care_of',
          ]
        );

        userAccount = userRows[0];

        await client.query(
          `INSERT INTO care.notifications (
             tenant_id, role_filter, type, notification_type, category,
             title, body, action_url, resident_id, reference_id
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            user.tenantId,
            'admin,superadmin',
            'credentials',
            'new_credentials',
            'account',
            `New resident account: ${first_name} ${last_name}`,
            JSON.stringify({
              accountType: 'resident',
              residentName: `${first_name} ${last_name}`,
              email: accountEmail,
              username: credentials.username,
              password: credentials.password,
              mustChangeOnLogin: true,
              oneTimeView: true,
            }),
            '/admin?view=account_management',
            residentId,
            userAccount.id,
          ]
        );

        await client.query(
          `INSERT INTO care.notifications (
             tenant_id, user_id, type, notification_type, category,
             title, body, action_url, resident_id, reference_id
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            user.tenantId,
            userAccount.id,
            'credentials',
            'new_credentials',
            'account',
            'Your resident portal account is ready',
            JSON.stringify({
              email: accountEmail,
              username: credentials.username,
              temporaryPasswordIssued: true,
              mustChangeOnLogin: true,
            }),
            '/auth/change-password-required',
            residentId,
            userAccount.id,
          ]
        );
      }

      return {
        resident: residentRows[0],
        user_account: userAccount,
        credentials: credentials ? {
          username: credentials.username,
          password: credentials.password,
          temporary: true,
          mustChangePassword: true,
        } : null,
      };
    });

    // Audit logging for PHI write
    const req = getRequestContext(request, user);
    await audit.logInsert({
      tableName: 'care.residents',
      recordId: result.resident.id,
      residentId: result.resident.id,
      req,
    });

    return new Response(JSON.stringify(result), { status: 201 });
  } catch (error) {
    return handleError(error, context);
  }
}
