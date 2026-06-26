import { PERMISSIONS, ROLES } from '@/lib/roles.js';
import { readJson, withApiContext, withPrismaApiContext } from '@/lib/api-helpers.js';
import { isStaffAssignmentScoped } from '@/lib/staff-access.js';

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
  return withPrismaApiContext(request, PERMISSIONS.CARE_PLANS_READ, 'care_plans:read', async ({ tx, user }) => {
    const where = {};
    // For STAFF, restrict to care plans whose resident has an active assignment
    // to this staff member — the Prisma equivalent of staffAssignmentJoin().
    // (org/facility scoping is enforced by RLS on both tables.)
    if (isStaffAssignmentScoped(user)) {
      where.residents = {
        staff_assignments: {
          some: { staff_profile_id: user.staffId, status: 'active' },
        },
      };
    }

    const plans = await tx.care_plans.findMany({
      where,
      include: { residents: { select: { first_name: true, last_name: true } } },
      orderBy: { updated_at: 'desc' },
      take: 200,
    });

    return plans.map((cp) =>
      mapPlan({
        id: cp.id,
        resident_id: cp.resident_id,
        resident_name: `${cp.residents.first_name} ${cp.residents.last_name}`,
        title: cp.title,
        status: cp.status,
        summary: cp.summary,
        goals: cp.goals,
        reviewed_at: cp.reviewed_at,
        next_review_at: cp.next_review_at,
        updated_at: cp.updated_at,
      })
    );
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
