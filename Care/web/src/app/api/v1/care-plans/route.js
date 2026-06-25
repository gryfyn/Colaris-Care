import { PERMISSIONS, ROLES } from '@/lib/roles.js';
import { readJson, withApiContext } from '@/lib/api-helpers.js';
import { staffAssignmentJoin } from '@/lib/staff-access.js';

function mapPlan(row) {
  return {
    id: row.id,
    residentId: row.resident_id,
    residentName: row.resident_name,
    title: row.title,
    status: row.status,
    summary: row.summary,
    goals: row.goals,
    reviewedAt: row.reviewed_at,
    nextReviewAt: row.next_review_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(request) {
  return withApiContext(request, PERMISSIONS.CARE_PLANS_READ, 'care_plans:read', async ({ client, user }) => {
    const assignmentJoin = staffAssignmentJoin(user, 'r');
    const { rows } = await client.query(
      `
        select cp.id, cp.resident_id, r.first_name || ' ' || r.last_name as resident_name,
               cp.title, cp.status, cp.summary, cp.goals, cp.reviewed_at, cp.next_review_at, cp.updated_at
          from care.care_plans cp
          join care.residents r
            on r.organization_id = cp.organization_id
           and r.facility_id = cp.facility_id
           and r.id = cp.resident_id
          ${assignmentJoin}
         order by cp.updated_at desc
         limit 200
      `
    );
    return rows.map(mapPlan);
  });
}

export async function POST(request) {
  return withApiContext(request, PERMISSIONS.CARE_PLANS_CREATE, 'care_plans:create', async ({ client, user }) => {
    const body = await readJson(request);
    if (user.role === ROLES.STAFF) {
      const assigned = await client.query(
        `
          select 1
            from care.staff_assignments
           where staff_profile_id = $1
             and resident_id = $2
             and status = 'active'
           limit 1
        `,
        [user.staffId, body.residentId]
      );
      if (!assigned.rowCount) {
        const err = new Error('Staff user is not assigned to this resident');
        err.status = 403;
        throw err;
      }
    }

    const { rows } = await client.query(
      `
        insert into care.care_plans(
          organization_id, facility_id, resident_id, title, status,
          summary, goals, reviewed_at, next_review_at, created_by, updated_by
        )
        values ($1, $2, $3, $4, coalesce($5, 'draft'), $6, coalesce($7, '[]'::jsonb), $8, $9, $10, $10)
        returning id, resident_id, title, status, summary, goals, reviewed_at, next_review_at, updated_at
      `,
      [
        user.organizationId,
        user.facilityId,
        body.residentId,
        body.title || 'Care plan',
        body.status || 'draft',
        body.summary || null,
        JSON.stringify(body.goals || []),
        body.reviewedAt || null,
        body.nextReviewAt || null,
        user.id,
      ]
    );
    return { ...mapPlan(rows[0]), residentName: null };
  });
}
