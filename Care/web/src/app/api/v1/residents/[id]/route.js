import { PERMISSIONS } from '@/lib/roles.js';
import { maskPHI } from '@/lib/auth-guard.js';
import { readJson, withApiContext } from '@/lib/api-helpers.js';
import { recordAuditEvent } from '@/lib/audit-events.js';
import { getTenantKey } from '@/lib/tenant-key.js';
import {
  buildAAD,
  encryptPHI,
  decryptPHI,
  lookupHashPHI,
  PHI_CIPHER_VERSION,
} from '@/lib/encryption.js';
import { mapAdmissions } from '@/lib/admissions.js';

const SSN_FIELD = 'ssn_last4';

function ssnAad(row) {
  return buildAAD({
    organizationId: row.organization_id,
    facilityId: row.facility_id,
    table: 'residents',
    rowId: row.id,
    field: SSN_FIELD,
  });
}

// Maps a raw residents row to the API shape, decrypting ssn_last4 from its
// envelope columns. The caller still runs maskPHI() so staff / resident_care_of
// see [RESTRICTED] (see PHI_MASKED_FIELDS).
function mapResident(row, tenantKey) {
  let ssnLast4 = null;
  if (row.ssn_last4_ciphertext) {
    ssnLast4 = decryptPHI(row.ssn_last4_ciphertext, tenantKey, ssnAad(row));
  }
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    name: `${row.first_name} ${row.last_name}`,
    dateOfBirth: row.date_of_birth,
    ssnLast4,
    room: row.room,
    careLevel: row.care_level,
    status: row.status,
    admittedAt: row.admitted_at,
    dischargedAt: row.discharged_at,
    version: row.version,
  };
}

export async function GET(request, { params }) {
  return withApiContext(request, PERMISSIONS.RESIDENTS_READ, 'residents:read', async ({ client, user }) => {
    const { rows } = await client.query(
      `
        select id, organization_id, facility_id, first_name, last_name, date_of_birth,
               room, care_level, status, admitted_at, discharged_at, version,
               ssn_last4_ciphertext
          from care.residents
         where id = $1
         limit 1
      `,
      [params.id]
    );
    if (!rows.length) {
      const err = new Error('Resident not found');
      err.status = 404;
      throw err;
    }
    // Derive the tenant key lazily: only when this row actually carries
    // ciphertext (mapResident guards on ssn_last4_ciphertext, so null is safe).
    const tenantKey = rows[0].ssn_last4_ciphertext
      ? await getTenantKey(user.organizationId, user.facilityId)
      : null;
    const resident = maskPHI(mapResident(rows[0], tenantKey), user.role);
    const { rows: admissions } = await client.query(
      `
        select a.id, a.resident_id, a.admission_case_id, a.status, a.candidate_first_name,
               a.candidate_last_name, a.email, a.room, a.care_level, a.admitted_at,
               a.submitted_at, a.updated_at, a.answers
          from care.admissions a
         where a.organization_id = $1
           and a.facility_id = $2
           and a.resident_id = $3
         order by a.submitted_at desc, a.updated_at desc
         limit 20
      `,
      [user.organizationId, user.facilityId, params.id]
    );
    return { ...resident, admissions: mapAdmissions(admissions) };
  });
}

export async function PATCH(request, { params }) {
  return withApiContext(request, PERMISSIONS.RESIDENTS_UPDATE, 'residents:update', async ({ client, user }) => {
    const body = await readJson(request);

    // Encrypt ssn_last4 on write when supplied. AAD/lookup hash bind to this row.
    let ssnProvided = false;
    let ssnCiphertext = null;
    let ssnKeyVersion = null;
    let ssnLookupHash = null;
    if (body.ssnLast4 !== undefined) {
      ssnProvided = true;
      if (body.ssnLast4) {
        const tenantKey = await getTenantKey(user.organizationId, user.facilityId);
        ssnCiphertext = encryptPHI(
          String(body.ssnLast4),
          tenantKey,
          buildAAD({
            organizationId: user.organizationId,
            facilityId: user.facilityId,
            table: 'residents',
            rowId: params.id,
            field: SSN_FIELD,
          })
        );
        ssnKeyVersion = PHI_CIPHER_VERSION;
        ssnLookupHash = lookupHashPHI(String(body.ssnLast4), tenantKey, SSN_FIELD);
      }
    }

    const { rows } = await client.query(
      `
        update care.residents
           set first_name = coalesce($2, first_name),
               last_name = coalesce($3, last_name),
               room = coalesce($4, room),
               care_level = coalesce($5, care_level),
               status = coalesce($6, status),
               ssn_last4_ciphertext = case when $8 then $9 else ssn_last4_ciphertext end,
               ssn_last4_key_version = case when $8 then $10 else ssn_last4_key_version end,
               ssn_last4_lookup_hash = case when $8 then $11 else ssn_last4_lookup_hash end,
               version = version + 1,
               updated_at = now(),
               updated_by = $7
         where id = $1
        returning id, organization_id, facility_id, first_name, last_name, date_of_birth,
                  room, care_level, status, admitted_at, discharged_at, version,
                  ssn_last4_ciphertext
      `,
      [
        params.id,
        body.firstName || null,
        body.lastName || null,
        body.room || null,
        body.careLevel || null,
        body.status || null,
        user.id,
        ssnProvided,
        ssnCiphertext,
        ssnKeyVersion,
        ssnLookupHash,
      ]
    );
    if (!rows.length) {
      const err = new Error('Resident not found');
      err.status = 404;
      throw err;
    }
    await recordAuditEvent(client, user, 'residents:update', { type: 'resident', id: params.id });
    const tenantKey = await getTenantKey(user.organizationId, user.facilityId);
    return maskPHI(mapResident(rows[0], tenantKey), user.role);
  });
}
