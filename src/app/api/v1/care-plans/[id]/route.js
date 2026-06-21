import { authenticate, authorize, getRequestContext, handleError } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { decryptFields, RESIDENT_ENCRYPTED_FIELDS } from '@/lib/encryption.js';
import { isValidTransition, getTransitionErrorMessage } from '@/lib/care-plan-transitions.js';

const audit = new AuditLogger();

export async function GET(request, context) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;


    if (!authorize(user.role, PERMISSIONS.CARE_PLANS_READ, PERMISSIONS.CARE_PLANS_READ_OWN)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;

    const plan = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows: plans } = await client.query(
        `SELECT cp.*,
                r.first_name, r.last_name, r.primary_diagnosis, r.medicaid_id, r.intake_date,
                s1.first_name || ' ' || s1.last_name AS primary_counselor_name,
                s2.first_name || ' ' || s2.last_name AS program_director_name
         FROM care.care_plans cp
         LEFT JOIN care.residents r ON r.id = cp.resident_id
         LEFT JOIN ref.staff s1 ON s1.id = cp.primary_counselor_id
         LEFT JOIN ref.staff s2 ON s2.id = cp.program_director_id
         WHERE cp.id = $1 AND cp.deleted_at IS NULL`,
        [id]
      );
      if (!plans.length) return null;
      const p = plans[0];

      const [domains, goals, safetyPlan, dailyLiving, discharge, legal, teamMembers] = await Promise.all([
        client.query('SELECT * FROM care.domain_assessments WHERE care_plan_id = $1 ORDER BY domain', [id]),
        client.query(`
          SELECT g.*, json_agg(
            json_build_object(
              'id', o.id, 'objective_number', o.objective_number,
              'objective_text', o.objective_text, 'intervention', o.intervention,
              'frequency', o.frequency, 'responsible_party', o.responsible_party,
              'status', o.status
            ) ORDER BY o.objective_number
          ) FILTER (WHERE o.id IS NOT NULL) AS objectives
          FROM care.goals g
          LEFT JOIN care.objectives o ON o.goal_id = g.id AND o.deleted_at IS NULL
          WHERE g.care_plan_id = $1 AND g.deleted_at IS NULL
          GROUP BY g.id ORDER BY g.section, g.goal_number`, [id]),
        client.query('SELECT * FROM care.safety_plans WHERE care_plan_id = $1', [id]),
        client.query('SELECT * FROM care.daily_living_needs WHERE care_plan_id = $1', [id]),
        client.query('SELECT * FROM care.discharge_plans WHERE care_plan_id = $1', [id]),
        client.query('SELECT * FROM care.legal_advocacy WHERE care_plan_id = $1', [id]),
        client.query('SELECT * FROM care.care_team_members WHERE resident_id = $1 AND deleted_at IS NULL', [p.resident_id]),
      ]);

      return {
        ...p,
        domainAssessments: domains.rows,
        goals:             goals.rows,
        safetyPlan:        safetyPlan.rows[0]    || null,
        dailyLiving:       dailyLiving.rows[0]   || null,
        dischargePlan:     discharge.rows[0]     || null,
        legalAdvocacy:     legal.rows[0]         || null,
        careTeam:          teamMembers.rows,
      };
    });

    if (!plan) return Response.json({ error: 'Care plan not found' }, { status: 404 });

    // Decrypt resident fields if present
    if (plan.first_name) {
      try {
        const tenantKey = process.env.NODE_ENV !== 'production'
          ? (Buffer.from(process.env.DEV_TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!').toString('hex').slice(0, 64)).padEnd(64, '0')
          : null;

        const residentData = {
          first_name: plan.first_name,
          last_name: plan.last_name,
          primary_diagnosis: plan.primary_diagnosis,
          medicaid_id: plan.medicaid_id,
        };

        const decrypted = decryptFields(residentData, RESIDENT_ENCRYPTED_FIELDS, tenantKey);
        plan.first_name = decrypted.first_name;
        plan.last_name = decrypted.last_name;
        plan.primary_diagnosis = decrypted.primary_diagnosis;
        plan.medicaid_id = decrypted.medicaid_id;
      } catch (decryptErr) {
        // Continue without decryption rather than fail
      }
    }

    const req = getRequestContext(request, user);
    await audit.logSelect({ tableName: 'care.care_plans', recordId: id, residentId: plan.resident_id, req });

    return Response.json({ data: plan });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(request, context) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.CARE_PLANS_UPDATE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const { version, ...body } = await request.json();
    if (!version) return Response.json({ error: 'version is required' }, { status: 422 });

    // Validate status transitions if status is being updated
    if ('status' in body) {
      const currentPlan = await withTenantClient(user.tenantId, user.staffId, (client) =>
        client.query(
          `SELECT id, status, resident_id FROM care.care_plans WHERE id = $1 AND deleted_at IS NULL`,
          [id]
        )
      );

      if (!currentPlan.rows.length) {
        return Response.json({ error: 'Care plan not found' }, { status: 404 });
      }

      const currentStatus = currentPlan.rows[0].status;
      const newStatus = body.status;

      if (!isValidTransition(currentStatus, newStatus)) {
        const errorMsg = getTransitionErrorMessage(currentStatus, newStatus);
        return Response.json({ error: errorMsg }, { status: 422 });
      }
    }

    const allowed    = ['plan_type','status','effective_date','expiration_date','review_date','review_schedule','primary_counselor_id','program_director_id'];
    const setClauses = [];
    const params     = [];
    for (const field of allowed) {
      if (field in body) { params.push(body[field]); setClauses.push(`${field} = $${params.length}`); }
    }
    if (!setClauses.length) return Response.json({ error: 'No valid fields' }, { status: 422 });

    params.push(version + 1);
    setClauses.push(`version = $${params.length}`);
    params.push(user.staffId);
    setClauses.push(`updated_by = $${params.length}`);
    params.push(id, version);

    const { rows } = await withTenantClient(user.tenantId, user.staffId, (client) =>
      client.query(
        `UPDATE care.care_plans SET ${setClauses.join(', ')}
         WHERE id = $${params.length - 1} AND version = $${params.length} AND deleted_at IS NULL
         RETURNING id, status, version, updated_at, resident_id`,
        params
      )
    );

    if (!rows.length) return Response.json({ error: 'Conflict — re-fetch and retry', code: 'OPTIMISTIC_LOCK_CONFLICT' }, { status: 409 });

    const req = getRequestContext(request, user);
    await audit.logUpdate({ tableName: 'care.care_plans', recordId: id, residentId: rows[0].resident_id, diffKeys: Object.keys(body), req });

    return Response.json({ data: rows[0] });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(request, context) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.CARE_PLANS_DELETE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows: planRows } = await client.query(
        `SELECT id, resident_id, status, plan_type, effective_date, expiration_date
         FROM care.care_plans WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [id, user.tenantId]
      );

      if (planRows.length === 0) {
        throw new Error('Care plan not found');
      }

      const oldValues = planRows[0];

      const { rows } = await client.query(
        `UPDATE care.care_plans SET deleted_at = CURRENT_TIMESTAMP, updated_by = $1
         WHERE id = $2 AND deleted_at IS NULL
         RETURNING id, resident_id`,
        [user.staffId, id]
      );

      return { carePlan: rows[0], oldValues };
    });

    const req = getRequestContext(request, user);
    await audit.logDelete({
      tableName: 'care.care_plans',
      recordId: id,
      residentId: result.carePlan.resident_id,
      oldValues: result.oldValues,
      req,
    });
    return Response.json({ success: true, message: 'Care plan deleted successfully' }, { status: 200 });
  } catch (err) {
    if (err.message.includes('not found')) {
      return Response.json({ error: err.message }, { status: 404 });
    }
    return handleError(err);
  }
}
