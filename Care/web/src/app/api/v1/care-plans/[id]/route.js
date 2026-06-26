import { PERMISSIONS, ROLES } from '@/lib/roles.js';
import { withApiContext } from '@/lib/api-helpers.js';

// The structured plan body (owner, review cycle, goals, objectives,
// interventions, review history) is stored in the care_plans.goals JSONB column,
// surfaced here as `content`. Scalar fields (title, status, summary, dates,
// signatures) live in their own columns.
function mapPlan(row) {
  const content = row.goals && typeof row.goals === 'object' && !Array.isArray(row.goals)
    ? row.goals
    : { goals: Array.isArray(row.goals) ? row.goals : [] };
  return {
    id: row.id,
    residentId: row.resident_id,
    residentName: row.resident_name,
    room: row.room,
    title: row.title,
    status: row.status,
    summary: row.summary,
    content: {
      owner: content.owner || null,
      reviewCycle: content.reviewCycle || null,
      effectiveDate: content.effectiveDate || null,
      goals: Array.isArray(content.goals) ? content.goals : [],
      objectives: Array.isArray(content.objectives) ? content.objectives : [],
      interventions: Array.isArray(content.interventions) ? content.interventions : [],
      reviews: Array.isArray(content.reviews) ? content.reviews : [],
    },
    reviewedAt: row.reviewed_at,
    nextReviewAt: row.next_review_at,
    signedAt: row.signed_at,
    approvedAt: row.approved_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(request, { params }) {
  const { id } = await params;
  return withApiContext(request, PERMISSIONS.CARE_PLANS_READ, 'care_plans:read', async ({ client, user }) => {
    const { rows } = await client.query(
      `
        select cp.id, cp.resident_id, cp.title, cp.status, cp.summary, cp.goals,
               cp.reviewed_at, cp.next_review_at, cp.signed_at, cp.approved_at,
               cp.version, cp.created_at, cp.updated_at,
               r.first_name || ' ' || r.last_name as resident_name, r.room
          from care.care_plans cp
          join care.residents r
            on r.organization_id = cp.organization_id
           and r.facility_id = cp.facility_id
           and r.id = cp.resident_id
         where cp.id = $1
         limit 1
      `,
      [id]
    );
    if (!rows.length) {
      const err = new Error('Care plan not found');
      err.status = 404;
      throw err;
    }

    // Staff may only view plans for residents actively assigned to them.
    if (user.role === ROLES.STAFF) {
      const assigned = await client.query(
        `
          select 1 from care.staff_assignments
           where staff_profile_id = $1 and resident_id = $2 and status = 'active'
           limit 1
        `,
        [user.staffId, rows[0].resident_id]
      );
      if (!assigned.rowCount) {
        const err = new Error('Staff user is not assigned to this resident');
        err.status = 403;
        throw err;
      }
    }

    return mapPlan(rows[0]);
  });
}
