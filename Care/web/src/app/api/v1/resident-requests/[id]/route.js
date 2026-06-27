import { PERMISSIONS } from '@/lib/roles.js';
import { readJson, withApiContext } from '@/lib/api-helpers.js';
import { recordAuditEvent } from '@/lib/audit-events.js';
import { createNotification, resolveNotifications, userIdForStaffProfile } from '@/lib/notifications.js';

function mapRequest(row) {
  return {
    id: row.id,
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

export async function PATCH(request, { params }) {
  const { id } = await params;
  return withApiContext(request, PERMISSIONS.RESIDENT_REQUESTS_WRITE, 'resident_requests:update', async ({ client, user }) => {
    const body = await readJson(request);
    const { rows } = await client.query(
      `
        update care.resident_requests rr
           set status = coalesce($2, status),
               priority = coalesce($3, priority),
               assigned_staff_id = coalesce($4, assigned_staff_id),
               completed_at = case when coalesce($2, status) = 'completed' then coalesce(completed_at, now()) else completed_at end,
               updated_at = now(),
               updated_by = $5
         where rr.id = $1
        returning rr.id, rr.resident_id,
                  (select trim(coalesce(r.first_name, '') || ' ' || coalesce(r.last_name, '')) from care.residents r where r.id = rr.resident_id) as resident_name,
                  (select r.room from care.residents r where r.id = rr.resident_id) as room,
                  rr.request_type, rr.detail, rr.priority, rr.status,
                  rr.assigned_staff_id, rr.created_at, rr.updated_at, rr.completed_at
      `,
      [id, body.status || null, body.priority || null, body.assignedStaffId || null, user.id]
    );
    if (!rows.length) {
      const err = new Error('Resident request not found');
      err.status = 404;
      throw err;
    }
    await recordAuditEvent(client, user, 'resident_request.update', { type: 'resident_request', id: id, status: rows[0].status });

    // Completing the task removes the assignee's pending notification; a new
    // assignment (while still open) raises one for the newly-assigned staff.
    if (rows[0].status === 'completed') {
      await resolveNotifications(client, { organizationId: user.organizationId, facilityId: user.facilityId, sourceType: 'resident_request', sourceId: id });
    } else if (body.assignedStaffId) {
      const staffUserId = await userIdForStaffProfile(client, user.organizationId, user.facilityId, body.assignedStaffId);
      if (staffUserId) {
        await createNotification(client, {
          organizationId: user.organizationId,
          facilityId: user.facilityId,
          userId: staffUserId,
          title: 'Resident request assigned',
          body: String(rows[0].detail || 'A resident request needs your attention.').slice(0, 200),
          sourceType: 'resident_request',
          sourceId: id,
        });
      }
    }

    return mapRequest(rows[0]);
  });
}
