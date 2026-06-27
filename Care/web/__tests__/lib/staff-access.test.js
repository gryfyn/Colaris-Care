// Mock the pg-backed db module so importing staff-access doesn't open a real pool.
jest.mock('@/lib/db.js', () => ({ query: jest.fn() }));

import {
  isStaffAssignmentScoped, hasFacilityWideResidentAccess,
  staffAssignmentPredicate, staffAssignmentJoin,
} from '@/lib/staff-access.js';
import { ROLES } from '@/lib/roles.js';

describe('staff-access scoping', () => {
  test('only the staff role is assignment-scoped', () => {
    expect(isStaffAssignmentScoped({ role: ROLES.STAFF })).toBe(true);
    expect(isStaffAssignmentScoped({ role: ROLES.ADMIN })).toBe(false);
    expect(isStaffAssignmentScoped({ role: ROLES.MANAGER })).toBe(false);
    expect(isStaffAssignmentScoped(null)).toBe(false);
  });

  test('manager/admin/superadmin have facility-wide resident access; staff do not', () => {
    expect(hasFacilityWideResidentAccess({ role: ROLES.ADMIN })).toBe(true);
    expect(hasFacilityWideResidentAccess({ role: ROLES.MANAGER })).toBe(true);
    expect(hasFacilityWideResidentAccess({ role: ROLES.SUPERADMIN })).toBe(true);
    expect(hasFacilityWideResidentAccess({ role: ROLES.STAFF })).toBe(false);
  });

  test('predicate is empty for facility-wide roles, scoped for staff', () => {
    expect(staffAssignmentPredicate({ role: ROLES.ADMIN }, 'pn.resident_id')).toBe('');
    const sql = staffAssignmentPredicate({ role: ROLES.STAFF }, 'pn.resident_id');
    expect(sql).toContain('care.staff_assignments');
    expect(sql).toContain('pn.resident_id');
    // Tenant/staff scope comes from server-set GUCs, never interpolated input.
    expect(sql).toContain("current_setting('app.staff_id', true)");
    expect(sql).toContain("status = 'active'");
  });

  test('join is empty for facility-wide roles, scoped for staff', () => {
    expect(staffAssignmentJoin({ role: ROLES.ADMIN }, 'r')).toBe('');
    expect(staffAssignmentJoin({ role: ROLES.STAFF }, 'r')).toContain('INNER JOIN care.staff_assignments');
  });
});
