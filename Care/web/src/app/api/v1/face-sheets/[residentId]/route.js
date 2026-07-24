import { readJson, withApiContext } from '@/lib/api-helpers.js';
import { encryptFields, decryptFields } from '@/lib/encryption.js';
import {
  FACE_SHEET_ENCRYPTED_FIELDS,
  FACE_SHEET_FIELDS,
  maskFaceSheetPHI,
} from '@/lib/face-sheet-schema.js';
import { PERMISSIONS, hasPermission } from '@/lib/roles.js';
import { getTenantKey } from '@/lib/tenant-key.js';

export const runtime = 'nodejs';

function compactDate(value) {
  if (!value) return '';
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function residentDefaults(resident) {
  if (!resident) return {};
  const legalName = [resident.first_name, resident.last_name].filter(Boolean).join(' ').trim();
  return {
    legal_name: legalName,
    room: resident.room || '',
    care_level: resident.care_level || '',
    status: resident.status || '',
    date_of_admission: compactDate(resident.admitted_at),
  };
}

function cleanFaceSheetPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const payload = {};
  for (const key of FACE_SHEET_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      payload[key] = body[key] == null ? null : String(body[key]);
    }
  }
  return payload;
}

function splitLegalName(legalName) {
  const parts = String(legalName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: '', lastName: '' };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function coreResidentFields(body) {
  const firstName = String(body?.first_name || '').trim();
  const lastName = String(body?.last_name || '').trim();
  const splitName = firstName || lastName ? { firstName, lastName } : splitLegalName(body?.legal_name);

  return {
    room: String(body?.room || '').trim(),
    careLevel: String(body?.care_level || '').trim(),
    status: String(body?.status || '').trim(),
    firstName: splitName.firstName,
    lastName: splitName.lastName,
  };
}

async function getResident(client, user, residentId) {
  const { rows } = await client.query(
    `
      select id, first_name, last_name, room, care_level, status, admitted_at
        from care.residents
       where organization_id = $1
         and facility_id = $2
         and id = $3
       limit 1
    `,
    [user.organizationId, user.facilityId, residentId]
  );
  return rows[0] || null;
}

export async function GET(request, { params }) {
  const { residentId } = await params;
  return withApiContext(request, PERMISSIONS.FACE_SHEETS_READ, 'face_sheets:read', async ({ client, user }) => {
    const { rows } = await client.query(
      `
        select id, resident_id, data
          from care.face_sheets
         where organization_id = $1
           and facility_id = $2
           and resident_id = $3
         limit 1
      `,
      [user.organizationId, user.facilityId, residentId]
    );

    if (rows.length) {
      const row = rows[0];
      const data = row.data || {};
      const canWrite = hasPermission(user.role, PERMISSIONS.FACE_SHEETS_WRITE);
      const fields = canWrite
        ? decryptFields(
            data,
            FACE_SHEET_ENCRYPTED_FIELDS,
            await getTenantKey(user.organizationId, user.facilityId),
            {
              organizationId: user.organizationId,
              facilityId: user.facilityId,
              table: 'face_sheets',
              rowId: residentId,
            }
          )
        : maskFaceSheetPHI(data);

      return { residentId, data: fields, exists: true };
    }

    const resident = await getResident(client, user, residentId);
    if (!resident) {
      const err = new Error('Resident not found');
      err.status = 404;
      throw err;
    }

    return { residentId, data: residentDefaults(resident), exists: false };
  });
}

export async function PUT(request, { params }) {
  const { residentId } = await params;
  return withApiContext(request, PERMISSIONS.FACE_SHEETS_WRITE, 'face_sheets:write', async ({ client, user }) => {
    const body = await readJson(request);
    const resident = await getResident(client, user, residentId);
    if (!resident) {
      const err = new Error('Resident not found');
      err.status = 404;
      throw err;
    }

    const payload = cleanFaceSheetPayload(body);
    const tenantKey = await getTenantKey(user.organizationId, user.facilityId);
    const encrypted = encryptFields(payload, FACE_SHEET_ENCRYPTED_FIELDS, tenantKey, {
      organizationId: user.organizationId,
      facilityId: user.facilityId,
      table: 'face_sheets',
      rowId: residentId,
    });

    await client.query(
      `
        insert into care.face_sheets
          (organization_id, facility_id, resident_id, data, created_by, updated_by)
        values
          ($1, $2, $3, $4::jsonb, $5, $5)
        on conflict (organization_id, facility_id, resident_id)
        do update set
          data = excluded.data,
          version = care.face_sheets.version + 1,
          updated_at = now(),
          updated_by = $5
      `,
      [user.organizationId, user.facilityId, residentId, JSON.stringify(encrypted), user.id]
    );

    const core = coreResidentFields(body);
    await client.query(
      `
        update care.residents
           set room = coalesce(nullif($4, ''), room),
               care_level = coalesce(nullif($5, ''), care_level),
               status = coalesce(nullif($6, ''), status),
               first_name = coalesce(nullif($7, ''), first_name),
               last_name = coalesce(nullif($8, ''), last_name),
               version = version + 1,
               updated_at = now(),
               updated_by = $9
         where organization_id = $1
           and facility_id = $2
           and id = $3
      `,
      [
        user.organizationId,
        user.facilityId,
        residentId,
        core.room,
        core.careLevel,
        core.status,
        core.firstName,
        core.lastName,
        user.id,
      ]
    );

    return { ok: true };
  });
}
