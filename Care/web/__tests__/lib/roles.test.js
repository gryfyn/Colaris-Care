import { hasPermission, PERMISSIONS, PHI_MASKED_FIELDS, RESTRICTED_VALUE, ROLES } from '@/lib/roles.js';

describe('roles', () => {
  test('staff can read residents but cannot mutate resident lifecycle', () => {
    expect(hasPermission(ROLES.STAFF, PERMISSIONS.RESIDENTS_READ)).toBe(true);
    expect(hasPermission(ROLES.STAFF, PERMISSIONS.RESIDENTS_CREATE)).toBe(false);
    expect(hasPermission(ROLES.STAFF, PERMISSIONS.RESIDENTS_UPDATE)).toBe(false);
    expect(hasPermission(ROLES.STAFF, PERMISSIONS.RESIDENTS_DISCHARGE)).toBe(false);
    expect(hasPermission(ROLES.STAFF, PERMISSIONS.RESIDENTS_DELETE)).toBe(false);
  });

  test('staff can write/sign care records but not approve protected review work', () => {
    expect(hasPermission(ROLES.STAFF, PERMISSIONS.CARE_PLANS_CREATE)).toBe(true);
    expect(hasPermission(ROLES.STAFF, PERMISSIONS.CARE_PLANS_SIGN)).toBe(true);
    expect(hasPermission(ROLES.STAFF, PERMISSIONS.CARE_PLANS_APPROVE)).toBe(false);
    expect(hasPermission(ROLES.STAFF, PERMISSIONS.ADMIN_AUDIT_READ)).toBe(false);
  });

  test('staff can read and action resident requests (caregiver workflow)', () => {
    expect(hasPermission(ROLES.STAFF, PERMISSIONS.RESIDENT_REQUESTS_READ)).toBe(true);
    expect(hasPermission(ROLES.STAFF, PERMISSIONS.RESIDENT_REQUESTS_WRITE)).toBe(true);
    // ...but this must NOT have re-granted the broader resident lifecycle.
    expect(hasPermission(ROLES.STAFF, PERMISSIONS.RESIDENTS_UPDATE)).toBe(false);
  });

  test('admin has full permission map', () => {
    for (const permission of Object.values(PERMISSIONS)) {
      expect(hasPermission(ROLES.ADMIN, permission)).toBe(true);
    }
  });

  test('staff ssn_last4 is configured for masking', () => {
    expect(PHI_MASKED_FIELDS[ROLES.STAFF]).toContain('ssn_last4');
    expect(RESTRICTED_VALUE).toBe('[RESTRICTED]');
  });
});
