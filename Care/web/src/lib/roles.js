export const ROLES = {
  STAFF: 'staff',
  MANAGER: 'manager',
  ADMIN: 'admin',
  SUPERADMIN: 'superadmin',
  RESIDENT_CARE_OF: 'resident_care_of',
};

export const RESTRICTED_VALUE = '[RESTRICTED]';

// Both the snake_case column name and the camelCase API field are listed so
// maskPHI() restricts the value whether it is applied to a raw DB row or to a
// mapped API response object.
export const PHI_MASKED_FIELDS = {
  staff: ['ssn_last4', 'ssnLast4'],
  manager: [],
  admin: [],
  superadmin: [],
  resident_care_of: ['ssn_last4', 'ssnLast4'],
};

export const PERMISSIONS = {
  RESIDENTS_READ_OWN: 'residents:read_own',
  RESIDENTS_READ: 'residents:read',
  RESIDENTS_CREATE: 'residents:create',
  RESIDENTS_UPDATE: 'residents:update',
  RESIDENTS_DISCHARGE: 'residents:discharge',
  RESIDENTS_DELETE: 'residents:delete',
  RESIDENTS_EXPORT: 'residents:export',
  RESIDENT_REQUESTS_READ: 'resident_requests:read',
  RESIDENT_REQUESTS_WRITE: 'resident_requests:write',
  CARE_PLANS_READ_OWN: 'care_plans:read_own',
  CARE_PLANS_READ: 'care_plans:read',
  CARE_PLANS_CREATE: 'care_plans:create',
  CARE_PLANS_UPDATE: 'care_plans:update',
  CARE_PLANS_DELETE: 'care_plans:delete',
  CARE_PLANS_SIGN: 'care_plans:sign',
  CARE_PLANS_APPROVE: 'care_plans:approve',
  GOALS_READ_OWN: 'goals:read_own',
  GOALS_READ: 'goals:read',
  GOALS_WRITE: 'goals:write',
  PROGRESS_NOTES_READ_OWN: 'progress_notes:read_own',
  PROGRESS_NOTES_READ: 'progress_notes:read',
  PROGRESS_NOTES_WRITE: 'progress_notes:write',
  PROGRESS_NOTES_SIGN: 'progress_notes:sign',
  SAFETY_READ_OWN: 'safety:read_own',
  SAFETY_READ: 'safety:read',
  SAFETY_WRITE: 'safety:write',
  ROI_READ_OWN: 'roi:read_own',
  ROI_READ: 'roi:read',
  ROI_WRITE: 'roi:write',
  ROI_REVOKE: 'roi:revoke',
  STAFF_READ: 'staff:read',
  STAFF_WRITE: 'staff:write',
  STAFF_DEACTIVATE: 'staff:deactivate',
  ADMIN_TENANT_SETTINGS: 'admin:tenant_settings',
  ADMIN_ROLES: 'admin:roles',
  ADMIN_AUDIT_READ: 'admin:audit_read',
  ADMIN_REPORTS: 'admin:reports',
  ACCOUNTS_MANAGE: 'accounts:manage',
  DISCHARGE_READ_OWN: 'discharge:read_own',
  DISCHARGE_READ: 'discharge:read',
  DISCHARGE_WRITE: 'discharge:write',
  ADMISSION_FORMS_READ: 'admission:forms_read',
  ADMISSION_FORMS_WRITE: 'admission:forms_write',
  ADMISSION_FORMS_APPROVE: 'admission:forms_approve',
};

const STAFF_PERMISSIONS = [
  PERMISSIONS.RESIDENTS_READ,
  PERMISSIONS.RESIDENT_REQUESTS_READ,
  PERMISSIONS.RESIDENT_REQUESTS_WRITE,
  PERMISSIONS.CARE_PLANS_READ,
  PERMISSIONS.CARE_PLANS_CREATE,
  PERMISSIONS.CARE_PLANS_UPDATE,
  PERMISSIONS.CARE_PLANS_SIGN,
  PERMISSIONS.GOALS_READ,
  PERMISSIONS.GOALS_WRITE,
  PERMISSIONS.PROGRESS_NOTES_READ,
  PERMISSIONS.PROGRESS_NOTES_WRITE,
  PERMISSIONS.PROGRESS_NOTES_SIGN,
  PERMISSIONS.SAFETY_READ,
  PERMISSIONS.SAFETY_WRITE,
  PERMISSIONS.ROI_READ,
  PERMISSIONS.ROI_WRITE,
  PERMISSIONS.STAFF_READ,
  PERMISSIONS.DISCHARGE_READ,
  PERMISSIONS.DISCHARGE_WRITE,
  PERMISSIONS.ADMISSION_FORMS_WRITE,
];

const OWN_READ_PERMISSIONS = [
  PERMISSIONS.RESIDENTS_READ_OWN,
  PERMISSIONS.CARE_PLANS_READ_OWN,
  PERMISSIONS.GOALS_READ_OWN,
  PERMISSIONS.PROGRESS_NOTES_READ_OWN,
  PERMISSIONS.SAFETY_READ_OWN,
  PERMISSIONS.ROI_READ_OWN,
  PERMISSIONS.DISCHARGE_READ_OWN,
];

const ADMIN_PERMISSIONS = Object.values(PERMISSIONS);

export const ROLE_PERMISSIONS = {
  [ROLES.STAFF]: new Set(STAFF_PERMISSIONS),
  [ROLES.MANAGER]: new Set(STAFF_PERMISSIONS),
  [ROLES.ADMIN]: new Set(ADMIN_PERMISSIONS),
  [ROLES.SUPERADMIN]: new Set(ADMIN_PERMISSIONS),
  [ROLES.RESIDENT_CARE_OF]: new Set(OWN_READ_PERMISSIONS),
};

export function hasPermission(role, permission) {
  return ROLE_PERMISSIONS[role]?.has(permission) || false;
}
