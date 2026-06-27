import { PERMISSIONS } from '@/lib/roles.js';
import { readJson, withApiContext } from '@/lib/api-helpers.js';
import { recordAuditEvent } from '@/lib/audit-events.js';

function mapDocument(row) {
  return {
    id: row.id,
    residentId: row.resident_id,
    staffProfileId: row.staff_profile_id,
    documentType: row.document_type,
    title: row.title,
    objectKey: row.object_key,
    sha256: row.sha256,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function GET(request) {
  return withApiContext(request, PERMISSIONS.RESIDENTS_READ, 'documents:read', async ({ client }) => {
    const { searchParams } = new URL(request.url);
    const residentId = searchParams.get('residentId');
    const staffProfileId = searchParams.get('staffProfileId');
    const params = [];
    let where = '';
    if (residentId) {
      params.push(residentId);
      where = 'where resident_id = $1';
    } else if (staffProfileId) {
      params.push(staffProfileId);
      where = 'where staff_profile_id = $1';
    }
    const { rows } = await client.query(
      `
        select id, resident_id, staff_profile_id, document_type, title, object_key, sha256, status, created_at
          from care.documents
         ${where}
         order by created_at desc
         limit 200
      `,
      params
    );
    return rows.map(mapDocument);
  });
}

export async function POST(request) {
  return withApiContext(request, PERMISSIONS.RESIDENTS_UPDATE, 'documents:write', async ({ client, user }) => {
    const body = await readJson(request);
    const { rows } = await client.query(
      `
        insert into care.documents(
          organization_id, facility_id, resident_id, staff_profile_id, document_type,
          title, object_key, sha256, status, created_by
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, coalesce($9, 'active'), $10)
        returning id, resident_id, staff_profile_id, document_type, title, object_key, sha256, status, created_at
      `,
      [
        user.organizationId,
        user.facilityId,
        body.residentId || null,
        body.staffProfileId || null,
        body.documentType,
        body.title,
        body.objectKey,
        body.sha256 || null,
        body.status || 'active',
        user.id,
      ]
    );
    await recordAuditEvent(client, user, 'document.create', { type: 'document', id: rows[0].id });
    return mapDocument(rows[0]);
  });
}
