export const ROLES = Object.freeze({
  RESIDENT_CARE_OF: 'resident_care_of',
  STAFF:            'staff',
  MANAGER:          'manager',
  ADMIN:            'admin',
  SUPERADMIN:       'superadmin',
});

export const PERMISSIONS = Object.freeze({
  RESIDENTS_READ_OWN:      'residents:read_own',
  RESIDENTS_READ:          'residents:read',
  RESIDENTS_CREATE:        'residents:create',
  RESIDENTS_UPDATE:        'residents:update',
  RESIDENTS_DISCHARGE:     'residents:discharge',
  RESIDENTS_DELETE:        'residents:delete',
  RESIDENTS_EXPORT:        'residents:export',

  CARE_PLANS_READ_OWN:     'care_plans:read_own',
  CARE_PLANS_READ:         'care_plans:read',
  CARE_PLANS_CREATE:       'care_plans:create',
  CARE_PLANS_UPDATE:       'care_plans:update',
  CARE_PLANS_DELETE:       'care_plans:delete',
  CARE_PLANS_SIGN:         'care_plans:sign',
  CARE_PLANS_APPROVE:      'care_plans:approve',

  GOALS_READ_OWN:          'goals:read_own',
  GOALS_READ:              'goals:read',
  GOALS_WRITE:             'goals:write',
  PROGRESS_NOTES_READ_OWN: 'progress_notes:read_own',
  PROGRESS_NOTES_READ:     'progress_notes:read',
  PROGRESS_NOTES_WRITE:    'progress_notes:write',
  PROGRESS_NOTES_SIGN:     'progress_notes:sign',

  SAFETY_READ_OWN:         'safety:read_own',
  SAFETY_READ:             'safety:read',
  SAFETY_WRITE:            'safety:write',

  ROI_READ_OWN:            'roi:read_own',
  ROI_READ:                'roi:read',
  ROI_WRITE:               'roi:write',
  ROI_REVOKE:              'roi:revoke',

  STAFF_READ:              'staff:read',
  STAFF_WRITE:             'staff:write',
  STAFF_DEACTIVATE:        'staff:deactivate',

  ADMIN_TENANT_SETTINGS:   'admin:tenant_settings',
  ADMIN_ROLES:             'admin:roles',
  ADMIN_AUDIT_READ:        'admin:audit_read',
  ADMIN_REPORTS:           'admin:reports',
  ACCOUNTS_MANAGE:         'accounts:manage',

  DISCHARGE_READ_OWN:      'discharge:read_own',
  DISCHARGE_READ:          'discharge:read',
  DISCHARGE_WRITE:         'discharge:write',

  ADMISSION_FORMS_READ:    'admission:forms_read',
  ADMISSION_FORMS_WRITE:   'admission:forms_write',
  ADMISSION_FORMS_APPROVE: 'admission:forms_approve',
});

const ROLE_PERMISSIONS = {
  [ROLES.RESIDENT_CARE_OF]: [
    PERMISSIONS.RESIDENTS_READ_OWN,
    PERMISSIONS.CARE_PLANS_READ_OWN,
    PERMISSIONS.GOALS_READ_OWN,
    PERMISSIONS.PROGRESS_NOTES_READ_OWN,
    PERMISSIONS.SAFETY_READ_OWN,
    PERMISSIONS.ROI_READ_OWN,
    PERMISSIONS.DISCHARGE_READ_OWN,
  ],

  [ROLES.STAFF]: [
    PERMISSIONS.RESIDENTS_READ,
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
    PERMISSIONS.DISCHARGE_READ,
    PERMISSIONS.DISCHARGE_WRITE,
    PERMISSIONS.STAFF_READ,
    PERMISSIONS.ADMISSION_FORMS_WRITE,
  ],

  [ROLES.MANAGER]: [
    PERMISSIONS.RESIDENTS_READ,
    PERMISSIONS.RESIDENTS_CREATE,
    PERMISSIONS.RESIDENTS_UPDATE,
    PERMISSIONS.RESIDENTS_DISCHARGE,
    PERMISSIONS.RESIDENTS_EXPORT,
    PERMISSIONS.CARE_PLANS_READ,
    PERMISSIONS.CARE_PLANS_CREATE,
    PERMISSIONS.CARE_PLANS_UPDATE,
    PERMISSIONS.CARE_PLANS_DELETE,
    PERMISSIONS.CARE_PLANS_SIGN,
    PERMISSIONS.CARE_PLANS_APPROVE,
    PERMISSIONS.GOALS_READ,
    PERMISSIONS.GOALS_WRITE,
    PERMISSIONS.PROGRESS_NOTES_READ,
    PERMISSIONS.PROGRESS_NOTES_WRITE,
    PERMISSIONS.PROGRESS_NOTES_SIGN,
    PERMISSIONS.SAFETY_READ,
    PERMISSIONS.SAFETY_WRITE,
    PERMISSIONS.ROI_READ,
    PERMISSIONS.ROI_WRITE,
    PERMISSIONS.ROI_REVOKE,
    PERMISSIONS.DISCHARGE_READ,
    PERMISSIONS.DISCHARGE_WRITE,
    PERMISSIONS.STAFF_READ,
    PERMISSIONS.STAFF_WRITE,
    PERMISSIONS.ADMIN_AUDIT_READ,
    PERMISSIONS.ADMIN_REPORTS,
    PERMISSIONS.ADMISSION_FORMS_READ,
    PERMISSIONS.ADMISSION_FORMS_WRITE,
    PERMISSIONS.ADMISSION_FORMS_APPROVE,
  ],

  [ROLES.ADMIN]: [
    ...Object.values(PERMISSIONS).filter(p => p !== 'admin:tenant_settings' && p !== 'residents:delete'),
    PERMISSIONS.RESIDENTS_DELETE,
    PERMISSIONS.STAFF_DEACTIVATE,
    PERMISSIONS.ADMIN_TENANT_SETTINGS,
    PERMISSIONS.ADMIN_ROLES,
    PERMISSIONS.ADMIN_AUDIT_READ,
    PERMISSIONS.ADMIN_REPORTS,
  ],

  [ROLES.SUPERADMIN]: Object.values(PERMISSIONS),
};

export function hasPermission(role, permission) {
  const granted = ROLE_PERMISSIONS[role] || [];
  return granted.includes(permission);
}

export const PHI_MASKED_FIELDS = {
  [ROLES.RESIDENT_CARE_OF]: [],
  [ROLES.STAFF]:            ['ssn_last4'],
  [ROLES.MANAGER]:          [],
  [ROLES.ADMIN]:            [],
  [ROLES.SUPERADMIN]:       [],
};
