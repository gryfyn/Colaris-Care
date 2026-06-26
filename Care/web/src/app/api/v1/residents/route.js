import crypto from 'crypto';
import { PERMISSIONS } from '@/lib/roles.js';
import { maskPHI } from '@/lib/auth-guard.js';
import { readJson, withPrismaApiContext } from '@/lib/api-helpers.js';
import { sanitizeAuditMetadata } from '@/lib/audit-events.js';
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
  return withPrismaApiContext(request, PERMISSIONS.RESIDENTS_READ, 'residents:read', async ({ tx, user }) => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('q');

    const where = {};
    if (status) {
      where.status = status;
    }
    if (search) {
      // Case-insensitive match on name or room, mirroring the previous
      // `lower(first||' '||last) like %q%` / `lower(coalesce(room,'')) like %q%`.
      where.OR = [
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        { room: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Prisma model field names are the introspected snake_case columns, so the
    // rows map straight into mapResident()/maskPHI() unchanged. RLS still scopes
    // these rows to the tenant via the context set in withPrismaContext.
    const rows = await tx.residents.findMany({
      where,
      orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }],
      take: 200,
    });

    // Derive the tenant key lazily: only fetch it when a returned row actually
    // carries ciphertext. Avoids a hard dependency on a configured PHI key for
    // lists with no encrypted SSNs (mapResident guards on ssn_last4_ciphertext).
    const needsKey = rows.some((r) => r.ssn_last4_ciphertext);
    const tenantKey = needsKey ? await getTenantKey(user.organizationId, user.facilityId) : null;
    return rows.map((row) => maskPHI(mapResident(row, tenantKey), user.role));
  });
}

export async function POST(request) {
  return withPrismaApiContext(request, PERMISSIONS.RESIDENTS_CREATE, 'residents:create', async ({ tx, user }) => {
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

    const created = await tx.residents.create({
      data: {
        id: residentId,
        organization_id: user.organizationId,
        facility_id: user.facilityId,
        first_name: body.firstName,
        last_name: body.lastName,
        // date / date-nullable columns: Prisma expects Date objects, whereas the
        // raw-pg path passed the JSON strings straight through. Normalize here.
        date_of_birth: toDate(body.dateOfBirth),
        room: body.room || null,
        care_level: body.careLevel || null,
        status: body.status || 'active',
        admitted_at: toDate(body.admittedAt),
        created_by: user.id,
        updated_by: user.id,
        ssn_last4_ciphertext: ssnCiphertext,
        ssn_last4_key_version: ssnKeyVersion,
        ssn_last4_lookup_hash: ssnLookupHash,
      },
    });

    // Audit on write — mirrors recordAuditEvent() (same sanitized metadata and
    // default 'success' outcome), written through Prisma so it stays inside the
    // same RLS-scoped transaction.
    await tx.audit_events.create({
      data: {
        organization_id: user.organizationId || user.tenantId || null,
        facility_id: user.facilityId || null,
        actor_user_id: user.id || null,
        actor_staff_id: user.staffId || null,
        action: 'residents:create',
        target_type: 'resident',
        target_id: created.id,
        outcome: 'success',
        metadata: sanitizeAuditMetadata({ residentId: created.id, status: created.status }),
      },
    });

    const tenantKey = await getTenantKey(user.organizationId, user.facilityId);
    return maskPHI(mapResident(created, tenantKey), user.role);
  });
}

// JSON dates arrive as strings; Prisma date columns require Date instances.
function toDate(value) {
  return value ? new Date(value) : null;
}
