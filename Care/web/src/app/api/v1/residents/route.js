import crypto from 'crypto';
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

const SSN_FIELD = 'ssn_last4';

function ssnAad(user, residentId) {
  return buildAAD({
    organizationId: user.organizationId,
    facilityId: user.facilityId,
    table: 'residents',
    rowId: residentId,
    field: SSN_FIELD,
  });
}

// Maps a raw residents row to the API shape, decrypting ssn_last4 from its
// envelope columns. The caller still runs maskPHI() so staff / resident_care_of
// see [RESTRICTED] (see PHI_MASKED_FIELDS).
function mapResident(row, tenantKey) {
  let ssnLast4 = null;
  if (row.ssn_last4_ciphertext) {
    try {
      ssnLast4 = decryptPHI(
        row.ssn_last4_ciphertext,
        tenantKey,
        ssnAadFromRow(row)
      );
    } catch (err) {
      // A single bad/legacy/undecryptable row must not 500 the whole list.
      console.warn(`Failed to decrypt ssn_last4 for resident ${row.id}:`, err.message);
      ssnLast4 = null;
    }
  }
  return {
    id: row.id,
    name: `${row.first_name} ${row.last_name}`,
    firstName: row.first_name,
    lastName: row.last_name,
    dateOfBirth: row.date_of_birth,
    ssnLast4,
    room: row.room,
    careLevel: row.care_level,
    status: row.status,
    admittedAt: row.admitted_at,
    updatedAt: row.updated_at,
  };
}

function ssnAadFromRow(row) {
  return buildAAD({
    organizationId: row.organization_id,
    facilityId: row.facility_id,
    table: 'residents',
    rowId: row.id,
    field: SSN_FIELD,
  });
}

export async function GET(request) {
  return withApiContext(request, PERMISSIONS.RESIDENTS_READ, 'residents:read', async ({ client, user }) => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('q');
    const params = [];
    const filters = [];

    if (status) {
      params.push(status);
      filters.push(`status = $${params.length}`);
    }
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      filters.push(`(lower(first_name || ' ' || last_name) like $${params.length} or lower(coalesce(room, '')) like $${params.length})`);
    }

    const { rows } = await client.query(
      `
        select id, organization_id, facility_id, first_name, last_name, date_of_birth,
               room, care_level, status, admitted_at, updated_at,
               ssn_last4_ciphertext
          from care.residents
         ${filters.length ? `where ${filters.join(' and ')}` : ''}
         order by last_name, first_name
         limit 200
      `,
      params
    );
    // Derive the tenant key lazily: only fetch it when a returned row actually
    // carries ciphertext. Avoids a hard dependency on a configured PHI key for
    // lists with no encrypted SSNs (mapResident guards on ssn_last4_ciphertext).
    const needsKey = rows.some((r) => r.ssn_last4_ciphertext);
    const tenantKey = needsKey ? await getTenantKey(user.organizationId, user.facilityId) : null;
    return rows.map((row) => maskPHI(mapResident(row, tenantKey), user.role));
  });
}

export async function POST(request) {
  return withApiContext(request, PERMISSIONS.RESIDENTS_CREATE, 'residents:create', async ({ client, user }) => {
    const body = await readJson(request);

    // Generate the id app-side so the AAD can bind the SSN ciphertext to this row
    // before the insert (gen_random_uuid would only be known after the write).
    const residentId = crypto.randomUUID();

    let ssnCiphertext = null;
    let ssnKeyVersion = null;
    let ssnLookupHash = null;
    if (body.ssnLast4) {
      const tenantKey = await getTenantKey(user.organizationId, user.facilityId);
      ssnCiphertext = encryptPHI(String(body.ssnLast4), tenantKey, ssnAad(user, residentId));
      ssnKeyVersion = PHI_CIPHER_VERSION;
      ssnLookupHash = lookupHashPHI(String(body.ssnLast4), tenantKey, SSN_FIELD);
    }

    const { rows } = await client.query(
      `
        insert into care.residents(
          id, organization_id, facility_id, first_name, last_name, date_of_birth,
          room, care_level, status, admitted_at, created_by, updated_by,
          ssn_last4_ciphertext, ssn_last4_key_version, ssn_last4_lookup_hash
        )
        values (
          $1, $2, $3, $4, $5, $6,
          $7, $8, coalesce($9, 'active'), $10, $11, $11,
          $12, $13, $14
        )
        returning id, organization_id, facility_id, first_name, last_name, date_of_birth,
                  room, care_level, status, admitted_at, updated_at,
                  ssn_last4_ciphertext
      `,
      [
        residentId,
        user.organizationId,
        user.facilityId,
        body.firstName,
        body.lastName,
        body.dateOfBirth,
        body.room || null,
        body.careLevel || null,
        body.status || 'active',
        body.admittedAt || null,
        user.id,
        ssnCiphertext,
        ssnKeyVersion,
        ssnLookupHash,
      ]
    );
    await recordAuditEvent(
      client,
      user,
      'residents:create',
      { type: 'resident', id: rows[0].id },
      { residentId: rows[0].id, status: rows[0].status }
    );
    const tenantKey = await getTenantKey(user.organizationId, user.facilityId);
    return maskPHI(mapResident(rows[0], tenantKey), user.role);
  });
}
