import { query } from '@/lib/db.js';
import { ROLES } from '@/lib/roles.js';

const FACILITY_WIDE_ROLES = new Set([ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPERADMIN]);

export function isStaffAssignmentScoped(user) {
  return user?.role === ROLES.STAFF;
}

export function hasFacilityWideResidentAccess(user) {
  return FACILITY_WIDE_ROLES.has(user?.role);
}

export function staffAssignmentJoin(user, residentAlias = 'r') {
  if (!isStaffAssignmentScoped(user)) return '';
  return `
    INNER JOIN care.staff_assignments sa_scope
      ON sa_scope.organization_id = ${residentAlias}.organization_id
     AND sa_scope.facility_id = ${residentAlias}.facility_id
     AND sa_scope.resident_id = ${residentAlias}.id
     AND sa_scope.staff_profile_id = current_setting('app.staff_id', true)::uuid
     AND sa_scope.status = 'active'
  `;
}

export function staffAssignmentPredicate(user, residentColumn = 'resident_id') {
  if (!isStaffAssignmentScoped(user)) return '';
  return `
    AND EXISTS (
      SELECT 1
        FROM care.staff_assignments sa_scope
       WHERE sa_scope.organization_id = current_setting('app.organization_id', true)::uuid
         AND sa_scope.facility_id = current_setting('app.facility_id', true)::uuid
         AND sa_scope.resident_id = ${residentColumn}
         AND sa_scope.staff_profile_id = current_setting('app.staff_id', true)::uuid
         AND sa_scope.status = 'active'
    )
  `;
}

export async function assertStaffAssignedToResident(user, residentId) {
  if (!isStaffAssignmentScoped(user)) return true;
  if (!user.staffId || !residentId) return false;

  const { rows } = await query(
    `
      SELECT 1
        FROM care.staff_assignments
       WHERE organization_id = $1
         AND facility_id = $2
         AND staff_profile_id = $3
         AND resident_id = $4
         AND status = 'active'
       LIMIT 1
    `,
    [user.organizationId, user.facilityId, user.staffId, residentId]
  );

  return rows.length > 0;
}

export async function requireStaffAssignedToResident(user, residentId) {
  const allowed = await assertStaffAssignedToResident(user, residentId);
  if (!allowed) {
    const err = new Error('Staff user is not assigned to this resident');
    err.status = 403;
    err.code = 'STAFF_ASSIGNMENT_REQUIRED';
    throw err;
  }
  return true;
}
