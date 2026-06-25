import { PERMISSIONS } from '@/lib/roles.js';
import { readJson, withApiContext } from '@/lib/api-helpers.js';
import { recordAuditEvent } from '@/lib/audit-events.js';

function mapRequest(row) {
  return {
    id: row.id,
    ref: `REQ-${String(row.seq || '').padStart(4, '0')}`,
    residentId: row.resident_id,
    residentName: row.resident_name,
    room: row.room,
    requestType: row.request_type,
    detail: row.detail,
    priority: row.priority,
    status: row.status,
    assignedStaffId: row.assigned_staff_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

const BASE_SELECT = `
  select rr.id, dense_rank() over (order by rr.created_at, rr.id) as seq,
         rr.resident_id,
         trim(coalesce(r.first_name, '') || ' ' || coalesce(r.last_name, '')) as resident_name,
         r.room,
         rr.request_type, rr.detail, rr.priority, rr.status,
         rr.assigned_staff_id, rr.created_at, rr.updated_at, rr.completed_at
    from care.resident_requests rr
    left join care.residents r on r.id = rr.resident_id
`;

export async function GET(request) {
  return withApiContext(request, PERMISSIONS.RESIDENTS_READ, 'resident_requests:read', async ({ client }) => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const params = [];
    const filters = [];

    if (status) {
      params.push(status);
      filters.push(`rr.status = $${params.length}`);
    }

    const { rows } = await client.query(
      `
        ${BASE_SELECT}
        ${filters.length ? `where ${filters.join(' and ')}` : ''}
        order by rr.created_at desc
        limit 200
      `,
      params
    );
    return rows.map(mapRequest);
  });
}

export async function POST(request) {
  return withApiContext(request, PERMISSIONS.RESIDENTS_UPDATE, 'resident_requests:create', async ({ client, user }) => {
    const body = await readJson(request);
    const { rows } = await client.query(
      `
        insert into care.resident_requests(
          organization_id, facility_id, resident_id, request_type, detail,
          priority, status, assigned_staff_id, created_by, updated_by
        )
        values ($1, $2, $3, $4, $5, coalesce($6, 'routine'), coalesce($7, 'new'), $8, $9, $9)
        returning id
      `,
      [
        user.organizationId,
        user.facilityId,
        body.residentId || null,
        body.requestType,
        body.detail,
        body.priority || 'routine',
        body.status || 'new',
        body.assignedStaffId || null,
        user.id,
      ]
    );
    await recordAuditEvent(client, user, 'resident_request.create', { type: 'resident_request', id: rows[0].id });
    const selected = await client.query(`${BASE_SELECT} where rr.id = $1 limit 1`, [rows[0].id]);
    return mapRequest(selected.rows[0]);
  });
}
