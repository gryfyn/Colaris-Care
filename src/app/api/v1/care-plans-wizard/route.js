import { authenticate, authorize, guardResidentAccess, handleError } from '@/lib/auth-guard.js';
import { withTenantClient, query } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

// The wizard's life-domain narrative fields are keyed by human-readable domain
// names (e.g. "Medical/Health_strengths", "Activities of Daily Living_needs").
// Their care.care_plans columns use abbreviated prefixes a naive snake_case
// cannot derive, so map them explicitly.
const DOMAIN_COLUMN_PREFIX = {
  'psychiatric': 'psychiatric',
  'medical/health': 'medical_health',
  'substance use': 'substance_use',
  'activities of daily living': 'adl',
  'social/relationships': 'social_relationships',
  'vocational/educational': 'vocational',
  'legal/risk factors': 'legal_risk',
  'housing/discharge needs': 'housing',
  'cco/ohp connection': 'cco_ohp',
};

// Convert a wizard form-field key to a care.care_plans column name. Handles the
// domain narrative keys above, plus a robust camelCase/slash/space → snake_case
// (the old `replace(/[A-Z]/g,…)` produced leading underscores and kept slashes,
// e.g. "Psychiatric_strengths" → "_psychiatric_strengths" → 500).
export function toColumnName(key) {
  const m = key.match(/^(.+)_(strengths|needs|cultural)$/);
  if (m) {
    const prefix = DOMAIN_COLUMN_PREFIX[m[1].toLowerCase()];
    if (prefix) return `${prefix}_${m[2]}`;
  }
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

// Restrict an updates object to columns that actually exist on
// care.care_plans, so an unknown/legacy/mistyped field can never crash the
// UPDATE (these column names are then safe to interpolate — they're a DB-backed
// whitelist, not user input).
async function filterToExistingColumns(client, updates) {
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'care' AND table_name = 'care_plans'`
  );
  const valid = new Set(rows.map((r) => r.column_name));
  const filtered = {};
  const dropped = [];
  for (const [k, v] of Object.entries(updates)) {
    if (valid.has(k)) filtered[k] = v; else dropped.push(k);
  }
  return { filtered, dropped };
}

/**
 * POST /api/v1/care-plans-wizard
 * Submit a complete care plan from the wizard
 * Requires CARE_PLANS_CREATE or CARE_PLANS_UPDATE permission
 */
export async function POST(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;


    if (!authorize(user.role, PERMISSIONS.CARE_PLANS_CREATE, PERMISSIONS.CARE_PLANS_UPDATE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { resident_id, step, data, status = 'draft' } = body;

    // Verify staff is assigned to this resident (permission enforcement)
    const guardResult = await guardResidentAccess(user, resident_id);
    if (guardResult?.error) {
      return Response.json({ error: guardResult.error }, { status: guardResult.status });
    }

    if (!resident_id) {
      return Response.json({ error: 'resident_id is required' }, { status: 400 });
    }

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      // Check resident exists
      const residentCheck = await client.query(
        'SELECT id FROM care.residents WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
        [resident_id, user.tenantId]
      );

      if (residentCheck.rows.length === 0) {
        throw new Error('Resident not found');
      }

      // Get or create care plan
      const planCheck = await client.query(
        `SELECT id, version FROM care.care_plans
         WHERE resident_id = $1 AND tenant_id = $2 AND status IN ('draft', 'active')
         ORDER BY created_at DESC LIMIT 1`,
        [resident_id, user.tenantId]
      );

      let carePlanId;

      if (planCheck.rows.length === 0) {
        // Create new care plan
        const newPlan = await client.query(
          `INSERT INTO care.care_plans (
            tenant_id, resident_id, plan_type, status, created_by, updated_by
          ) VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id`,
          // A new plan is always a draft; 'submitted' isn't a valid status value
          // (CHECK allows draft/active/superseded/discharged/expired).
          [user.tenantId, resident_id, 'initial', status === 'submitted' ? 'active' : 'draft', user.staffId, user.staffId]
        );
        carePlanId = newPlan.rows[0].id;
      } else {
        carePlanId = planCheck.rows[0].id;
      }

      // Build update object based on step data
      // Convert camelCase form fields to snake_case database columns
      const updates = {};

      if (data && typeof data === 'object') {
        for (const [key, value] of Object.entries(data)) {
          updates[toColumnName(key)] = value;
        }
      }

      // Mark step as completed
      if (step && step >= 1 && step <= 7) {
        updates[`step_${step}_completed`] = true;
      }

      // If all steps are completed and status is submitted, set submitted_at
      if (status === 'submitted') {
        updates.status = 'active';
        updates.submitted_at = new Date().toISOString();
        updates.submitted_by = user.staffId;
      }

      updates.updated_by = user.staffId;

      // Drop any key that isn't a real column so the UPDATE can never 500.
      const { filtered, dropped } = await filterToExistingColumns(client, updates);
      if (dropped.length) console.warn('[care-plans-wizard] dropped unknown columns:', dropped.join(', '));

      const setClause = Object.keys(filtered)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');
      const values = [carePlanId, ...Object.values(filtered)];

      if (Object.keys(filtered).length > 0) {
        await client.query(
          `UPDATE care.care_plans SET ${setClause} WHERE id = $1`,
          values
        );
      }

      return { id: carePlanId, status: status === 'submitted' ? 'active' : status };
    });

    await audit.logInsert({
      tableName: 'care.care_plans',
      recordId: result.id,
      residentId: resident_id,
      newValues: { status: result.status },
      req: { user },
    });
    return Response.json({
      success: true,
      care_plan_id: result.id,
      message: 'Care plan submitted successfully'
    });
  } catch (err) {
    if (err.message.includes('not found')) {
      return Response.json({ error: err.message }, { status: 404 });
    }
    return handleError(err);
  }
}

/**
 * PATCH /api/v1/care-plans-wizard
 * Update an existing care plan from the wizard
 */
export async function PATCH(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;


    if (!authorize(user.role, PERMISSIONS.CARE_PLANS_UPDATE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { care_plan_id, step, data, status = 'draft' } = body;

    if (!care_plan_id) {
      return Response.json({ error: 'care_plan_id is required' }, { status: 400 });
    }

    // Check care plan exists and verify staff has permission for the resident
    const { rows: planRows } = await query(
      `SELECT id, resident_id FROM care.care_plans
       WHERE id = $1 AND deleted_at IS NULL`,
      [care_plan_id]
    );

    if (planRows.length === 0) {
      return Response.json({ error: 'Care plan not found' }, { status: 404 });
    }

    const resident_id = planRows[0].resident_id;

    // Verify staff is assigned to this resident (permission enforcement)
    const guardResult = await guardResidentAccess(user, resident_id);
    if (guardResult?.error) {
      return Response.json({ error: guardResult.error }, { status: guardResult.status });
    }

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      // Re-check care plan in transaction context
      const planCheck = await client.query(
        `SELECT id, resident_id FROM care.care_plans
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [care_plan_id, user.tenantId]
      );

      if (planCheck.rows.length === 0) {
        throw new Error('Care plan not found');
      }

      // Build update object based on step data
      const updates = {};

      if (data && typeof data === 'object') {
        for (const [key, value] of Object.entries(data)) {
          updates[toColumnName(key)] = value;
        }
      }

      // Mark step as completed
      if (step && step >= 1 && step <= 7) {
        updates[`step_${step}_completed`] = true;
      }

      // If status is submitted, set submitted_at
      if (status === 'submitted') {
        updates.status = 'active';
        updates.submitted_at = new Date().toISOString();
        updates.submitted_by = user.staffId;
      }

      updates.updated_by = user.staffId;

      // Drop any key that isn't a real column so the UPDATE can never 500.
      const { filtered, dropped } = await filterToExistingColumns(client, updates);
      if (dropped.length) console.warn('[care-plans-wizard] dropped unknown columns:', dropped.join(', '));

      const setClause = Object.keys(filtered)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');
      const values = [care_plan_id, ...Object.values(filtered)];

      if (Object.keys(filtered).length > 0) {
        await client.query(
          `UPDATE care.care_plans SET ${setClause} WHERE id = $1`,
          values
        );
      }

      return { id: care_plan_id, resident_id: planCheck.rows[0].resident_id, status: status === 'submitted' ? 'active' : status };
    });

    await audit.logUpdate({
      tableName: 'care.care_plans',
      recordId: result.id,
      residentId: result.resident_id,
      newValues: { status: result.status },
      diffKeys: Object.keys(data || {}),
      req: { user },
    });
    return Response.json({
      success: true,
      care_plan_id: result.id,
      message: 'Care plan updated successfully'
    });
  } catch (err) {
    if (err.message.includes('not found')) {
      return Response.json({ error: err.message }, { status: 404 });
    }
    return handleError(err);
  }
}
