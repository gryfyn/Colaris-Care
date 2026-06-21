import { authenticate, authorize, handleError } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { decryptFields } from '@/lib/encryption.js';
import { getTenantKey } from '@/lib/tenant-key.js';

const audit = new AuditLogger();

/**
 * GET /api/v1/admin/form-reviews
 * List form review workflows with filtering and pagination.
 * Query params: form_type, review_status, resident_id, assigned_to, limit, offset
 * Requires CARE_PLANS_APPROVE or similar elevated permission.
 */
export async function GET(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.CARE_PLANS_APPROVE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const formType = searchParams.get('form_type');
    const reviewStatus = searchParams.get('review_status');
    const residentId = searchParams.get('resident_id');
    const assignedTo = searchParams.get('assigned_to');
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

    const validFormTypes = [
      'care_plan',
      'nursing_admission',
      'pre_admission_screening',
      'advance_directive',
      'daily_progress_note',
      'incident_report',
      'drug_disposal',
      'evacuation_drill',
    ];

    if (formType && !validFormTypes.includes(formType)) {
      return Response.json(
        { error: `Invalid form_type. Must be one of: ${validFormTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const validStatuses = ['pending', 'in_review', 'approved', 'rejected', 'returned'];
    if (reviewStatus && !validStatuses.includes(reviewStatus)) {
      return Response.json(
        { error: `Invalid review_status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const conditions = ['fr.tenant_id = $1'];
      const params = [user.tenantId];

      if (formType) {
        params.push(formType);
        conditions.push(`fr.form_type = $${params.length}`);
      }

      if (reviewStatus) {
        params.push(reviewStatus);
        conditions.push(`fr.review_status = $${params.length}`);
      }

      if (residentId) {
        params.push(residentId);
        conditions.push(`fr.resident_id = $${params.length}`);
      }

      if (assignedTo) {
        params.push(assignedTo);
        conditions.push(`fr.reviewed_by = $${params.length}`);
      }

      // Synthesize a unified review queue from all form tables that carry a review_status.
      // (There is no dedicated form_review_workflow table — this is a virtual view.)
      const where = conditions.join(' AND ').replace(/fr\./g, 'fr.');
      params.push(limit, offset);

      const { rows } = await client.query(
        `WITH fr AS (
           SELECT id::text AS id, 'incident_report'::text AS form_type, id::text AS form_id,
                  resident_id, review_status, NULL::uuid AS assigned_to,
                  completed_by_staff_id AS submitted_by, completed_at AS submitted_at,
                  reviewed_by, reviewed_at, review_notes AS comments,
                  created_at, updated_at, tenant_id
             FROM care.incident_reports WHERE deleted_at IS NULL
           UNION ALL
           SELECT id::text, 'daily_progress_note', id::text, resident_id, review_status,
                  NULL::uuid, staff_id, created_at,
                  reviewed_by, reviewed_at, review_notes, created_at, updated_at, tenant_id
             FROM care.daily_progress_notes
           UNION ALL
           SELECT id::text, 'drug_disposal', id::text, resident_id, review_status,
                  NULL::uuid, counting_staff_id, created_at,
                  reviewed_by, reviewed_at, review_notes, created_at, created_at, tenant_id
             FROM care.drug_disposal_records
           UNION ALL
           SELECT id::text, 'evacuation_drill', id::text, NULL::uuid AS resident_id, review_status,
                  NULL::uuid, created_by, created_at,
                  reviewed_by, reviewed_at, review_notes, created_at, updated_at, tenant_id
             FROM care.evacuation_drills
         )
         SELECT fr.id, fr.form_type, fr.form_id, fr.resident_id, fr.review_status,
                fr.assigned_to, fr.submitted_by, fr.submitted_at, fr.reviewed_by,
                fr.reviewed_at, fr.comments, fr.created_at, fr.updated_at,
                r.first_name, r.last_name,
                s.first_name AS reviewer_first_name, s.last_name AS reviewer_last_name,
                COUNT(*) OVER() AS total_count
         FROM fr
         LEFT JOIN care.residents r ON fr.resident_id = r.id
         LEFT JOIN ref.staff s ON fr.reviewed_by = s.id
         WHERE ${where}
         ORDER BY fr.submitted_at DESC NULLS LAST
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return rows;
    });

    await audit.logSelect({
      tableName: 'care.form_review_workflow',
      residentId: null,
      req: { user },
    });
    const total = result[0]?.total_count || 0;
    const tenantKey = await getTenantKey(user.tenantId);
    const data = result.map((row) => {
      const decrypted = decryptFields(
        { first_name: row.first_name, last_name: row.last_name },
        ['first_name', 'last_name'],
        tenantKey
      );
      return { ...row, ...decrypted };
    });
    return Response.json({
      data,
      pagination: {
        limit,
        offset,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * PATCH /api/v1/admin/form-reviews
 * Bulk update review status across the concrete form tables behind the unified queue.
 */
export async function PATCH(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.CARE_PLANS_APPROVE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { ids, review_status: reviewStatus, comments } = body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return Response.json({ error: 'Missing or invalid ids' }, { status: 400 });
    }

    const validStatuses = ['pending', 'in_review', 'approved', 'rejected', 'returned'];
    if (!reviewStatus) {
      return Response.json({ error: 'Missing review_status' }, { status: 400 });
    }
    if (!validStatuses.includes(reviewStatus)) {
      return Response.json(
        { error: `Invalid review_status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const params = [ids.map(String), reviewStatus, comments || null, user.tenantId, user.staffId];
      const { rows } = await client.query(
        `WITH incident_updates AS (
           UPDATE care.incident_reports
              SET review_status = $2,
                  review_notes = $3,
                  reviewed_by = $5,
                  reviewed_at = NOW(),
                  updated_at = NOW()
            WHERE id::text = ANY($1::text[]) AND tenant_id = $4 AND deleted_at IS NULL
            RETURNING id::text, 'incident_report'::text AS form_type, review_status, reviewed_by, tenant_id
         ),
         progress_note_updates AS (
           UPDATE care.daily_progress_notes
              SET review_status = $2,
                  review_notes = $3,
                  reviewed_by = $5,
                  reviewed_at = NOW(),
                  updated_at = NOW()
            WHERE id::text = ANY($1::text[]) AND tenant_id = $4
            RETURNING id::text, 'daily_progress_note'::text AS form_type, review_status, reviewed_by, tenant_id
         ),
         drug_disposal_updates AS (
           UPDATE care.drug_disposal_records
              SET review_status = $2,
                  review_notes = $3,
                  reviewed_by = $5,
                  reviewed_at = NOW()
            WHERE id::text = ANY($1::text[]) AND tenant_id = $4
            RETURNING id::text, 'drug_disposal'::text AS form_type, review_status, reviewed_by, tenant_id
         ),
         evacuation_drill_updates AS (
           UPDATE care.evacuation_drills
              SET review_status = $2,
                  review_notes = $3,
                  reviewed_by = $5,
                  reviewed_at = NOW(),
                  updated_at = NOW()
            WHERE id::text = ANY($1::text[]) AND tenant_id = $4
            RETURNING id::text, 'evacuation_drill'::text AS form_type, review_status, reviewed_by, tenant_id
         )
         SELECT * FROM incident_updates
         UNION ALL SELECT * FROM progress_note_updates
         UNION ALL SELECT * FROM drug_disposal_updates
         UNION ALL SELECT * FROM evacuation_drill_updates`,
        params
      );
      return rows;
    });

    if (result?.error) {
      return Response.json({ error: result.error }, { status: result.status || 500 });
    }
    if (!result.length) {
      return Response.json({ error: 'Form review not found' }, { status: 404 });
    }

    await audit.logUpdate({
      tableName: 'care.form_review_workflow',
      recordId: null,
      residentId: null,
      oldValues: {},
      newValues: { ids, review_status: reviewStatus, comments: comments || null },
      diffKeys: ['review_status', 'comments'],
      req: { user },
    });

    return Response.json({
      data: result,
      message: `Updated ${result.length} form review${result.length === 1 ? '' : 's'}`,
    });
  } catch (err) {
    return handleError(err);
  }
}
