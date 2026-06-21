import { ROLES } from '@/lib/roles.js';

/**
 * Facility-wide staff access policy.
 *
 * Staff at this facility are responsible for ALL residents in their tenant, not
 * a per-resident assigned subset. Historically the API gated staff to residents
 * listed in `care.staff_assignments`, which meant a newly-created staff account
 * (with no assignments) could not see or act on any resident.
 *
 * This flag centralizes the policy so it can be re-tightened to assignment-based
 * scoping in one place if the facility ever wants it. The `care.staff_assignments`
 * table and its data are left intact and are still usable for "my residents"
 * style opt-in filters (?staff_only=1).
 */
export const STAFF_SEES_ALL_RESIDENTS = true;

/**
 * Whether a staff LIST request should be scoped to the staff member's own
 * assignments. With facility-wide access this only happens when the caller
 * explicitly opts in via ?staff_only=1; otherwise staff see every resident in
 * the tenant (tenant isolation via RLS still applies).
 *
 * @param {{ role: string }} user
 * @param {string|null} staffOnlyParam  raw value of the `staff_only` query param
 */
export function staffAssignmentScope(user, staffOnlyParam) {
  if (staffOnlyParam === '1') return true;
  if (STAFF_SEES_ALL_RESIDENTS) return false;
  return user.role === ROLES.STAFF;
}

/**
 * Whether a per-resident WRITE/READ guard should reject a staff member who is
 * not assigned to the resident. Returns false (i.e. do not gate) under the
 * facility-wide policy.
 *
 * @param {{ role: string }} user
 */
export function staffAssignmentRequired(user) {
  return !STAFF_SEES_ALL_RESIDENTS && user.role === ROLES.STAFF;
}
