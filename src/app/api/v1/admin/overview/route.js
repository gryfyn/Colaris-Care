import { authenticate, authorize, handleError } from '@/lib/auth-guard.js';
import { withTenantClient, query } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

// Simple in-memory cache with TTL
const overviewCache = new Map();
const CACHE_TTL = 60000; // 60 seconds

function getCacheKey(tenantId) {
  return `overview:${tenantId}`;
}

function isCacheValid(timestamp) {
  return Date.now() - timestamp < CACHE_TTL;
}

function getCachedOverview(tenantId) {
  const cacheKey = getCacheKey(tenantId);
  const cached = overviewCache.get(cacheKey);
  if (cached && isCacheValid(cached.timestamp)) {
    return cached.data;
  }
  overviewCache.delete(cacheKey);
  return null;
}

function setCachedOverview(tenantId, data) {
  const cacheKey = getCacheKey(tenantId);
  overviewCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * GET /api/v1/admin/overview
 * Returns dashboard overview data for admin page header.
 * Includes pending admissions, recent incidents, staff status, bed capacity.
 * Results cached for 60 seconds to reduce database load.
 */
export async function GET(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    // Only admin, manager, and superadmin can view overview
    if (!authorize(user.role, PERMISSIONS.ADMIN_REPORTS)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check cache first
    const cached = getCachedOverview(user.tenantId);
    if (cached) {
      return Response.json({ data: cached, cached: true }, { status: 200 });
    }

    // Fetch fresh data
    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows } = await client.query(`
        SELECT
          COALESCE((SELECT COUNT(*) FROM care.pre_admission_screenings WHERE deleted_at IS NULL AND tenant_id = $1), 0) AS pending_admissions,
          (SELECT COUNT(*) FROM care.incident_reports WHERE review_status = 'pending' AND tenant_id = $1) AS pending_incidents,
          (SELECT COUNT(*) FROM care.incident_reports
           WHERE created_at >= NOW() - INTERVAL '7 days' AND tenant_id = $1) AS recent_incidents_7d,
          (SELECT COUNT(*) FROM ref.staff WHERE is_active = TRUE AND tenant_id = $1) AS active_staff,
          (SELECT COUNT(*) FROM ref.staff WHERE is_active = FALSE AND tenant_id = $1) AS inactive_staff,
          (SELECT COUNT(*) FROM care.residents WHERE status = 'active' AND deleted_at IS NULL AND tenant_id = $1) AS active_residents,
          (SELECT COUNT(*) FROM care.residents WHERE status = 'active' AND deleted_at IS NULL AND tenant_id = $1) AS occupied_beds,
          0 AS total_bed_capacity,
          (SELECT COUNT(*) FROM care.care_plans
           WHERE status = 'active' AND deleted_at IS NULL AND tenant_id = $1 AND
           expiration_date <= NOW() + INTERVAL '30 days' AND expiration_date > NOW()) AS expiring_plans_30d,
          (SELECT COUNT(*) FROM care.v_roi_expiring_soon WHERE tenant_id = $1) AS roi_expiring_soon,
          (SELECT COUNT(*) FROM care.daily_progress_notes WHERE review_status = 'pending' AND tenant_id = $1) AS pending_daily_progress_notes,
          NOW() AS query_timestamp
        `,
        [user.tenantId]
      );
      return rows[0];
    });

    const overview = {
      pending_admissions: result.pending_admissions || 0,
      pending_incidents: result.pending_incidents || 0,
      recent_incidents_7d: result.recent_incidents_7d || 0,
      active_staff: result.active_staff || 0,
      inactive_staff: result.inactive_staff || 0,
      active_residents: result.active_residents || 0,
      bed_capacity: {
        occupied: result.occupied_beds || 0,
        total: result.total_bed_capacity || 0,
        available: Math.max(0, (result.total_bed_capacity || 0) - (result.occupied_beds || 0)),
        occupancy_rate: result.total_bed_capacity ? ((result.occupied_beds || 0) / result.total_bed_capacity * 100).toFixed(1) : '0',
      },
      care_plans_expiring_30d: result.expiring_plans_30d || 0,
      roi_expiring_soon: result.roi_expiring_soon || 0,
      pending_daily_progress_notes: result.pending_daily_progress_notes || 0,
    };

    // Cache the result
    setCachedOverview(user.tenantId, overview);

    // Log access (non-blocking)
    audit.logSelect({
      tableName: 'admin.overview',
      residentId: null,
      req: { user },
    });
    return Response.json({ data: overview, cached: false }, { status: 200 });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/v1/admin/overview/refresh
 * Manually refresh the cached overview data.
 * Useful for forcing a fresh read after data changes.
 */
export async function POST(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    // Only admin can refresh
    if (!authorize(user.role, PERMISSIONS.ADMIN_REPORTS)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Clear cache and fetch fresh data
    const cacheKey = getCacheKey(user.tenantId);
    overviewCache.delete(cacheKey);

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows } = await client.query(`
        SELECT
          COALESCE((SELECT COUNT(*) FROM care.pre_admission_screenings WHERE deleted_at IS NULL AND tenant_id = $1), 0) AS pending_admissions,
          (SELECT COUNT(*) FROM care.incident_reports WHERE review_status = 'pending' AND tenant_id = $1) AS pending_incidents,
          (SELECT COUNT(*) FROM care.incident_reports
           WHERE created_at >= NOW() - INTERVAL '7 days' AND tenant_id = $1) AS recent_incidents_7d,
          (SELECT COUNT(*) FROM ref.staff WHERE is_active = TRUE AND tenant_id = $1) AS active_staff,
          (SELECT COUNT(*) FROM ref.staff WHERE is_active = FALSE AND tenant_id = $1) AS inactive_staff,
          (SELECT COUNT(*) FROM care.residents WHERE status = 'active' AND deleted_at IS NULL AND tenant_id = $1) AS active_residents,
          (SELECT COUNT(*) FROM care.residents WHERE status = 'active' AND deleted_at IS NULL AND tenant_id = $1) AS occupied_beds,
          0 AS total_bed_capacity,
          (SELECT COUNT(*) FROM care.care_plans
           WHERE status = 'active' AND deleted_at IS NULL AND tenant_id = $1 AND
           expiration_date <= NOW() + INTERVAL '30 days' AND expiration_date > NOW()) AS expiring_plans_30d,
          (SELECT COUNT(*) FROM care.v_roi_expiring_soon WHERE tenant_id = $1) AS roi_expiring_soon,
          (SELECT COUNT(*) FROM care.daily_progress_notes WHERE review_status = 'pending' AND tenant_id = $1) AS pending_daily_progress_notes,
          NOW() AS query_timestamp
        `,
        [user.tenantId]
      );
      return rows[0];
    });

    const overview = {
      pending_admissions: result.pending_admissions || 0,
      pending_incidents: result.pending_incidents || 0,
      recent_incidents_7d: result.recent_incidents_7d || 0,
      active_staff: result.active_staff || 0,
      inactive_staff: result.inactive_staff || 0,
      active_residents: result.active_residents || 0,
      bed_capacity: {
        occupied: result.occupied_beds || 0,
        total: result.total_bed_capacity || 0,
        available: Math.max(0, (result.total_bed_capacity || 0) - (result.occupied_beds || 0)),
        occupancy_rate: result.total_bed_capacity ? ((result.occupied_beds || 0) / result.total_bed_capacity * 100).toFixed(1) : '0',
      },
      care_plans_expiring_30d: result.expiring_plans_30d || 0,
      roi_expiring_soon: result.roi_expiring_soon || 0,
      pending_daily_progress_notes: result.pending_daily_progress_notes || 0,
    };

    // Cache the fresh result
    setCachedOverview(user.tenantId, overview);

    return Response.json({ data: overview, refreshed: true }, { status: 200 });
  } catch (err) {
    return handleError(err);
  }
}
