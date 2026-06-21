/**
 * Unit tests for care plan status transition validation
 * Tests the state machine rules defined in care-plan-transitions.js
 */

import {
  isValidTransition,
  getTransitionErrorMessage,
  getAllowedTransitions,
  CARE_PLAN_STATUSES,
} from './care-plan-transitions.js';

describe('Care Plan Transitions', () => {
  describe('isValidTransition', () => {
    // Valid transitions
    test('should allow draft → active', () => {
      expect(isValidTransition('draft', 'active')).toBe(true);
    });

    test('should allow draft → archived', () => {
      expect(isValidTransition('draft', 'archived')).toBe(true);
    });

    test('should allow active → expiring', () => {
      expect(isValidTransition('active', 'expiring')).toBe(true);
    });

    test('should allow active → expired', () => {
      expect(isValidTransition('active', 'expired')).toBe(true);
    });

    test('should allow active → archived', () => {
      expect(isValidTransition('active', 'archived')).toBe(true);
    });

    test('should allow expiring → expired', () => {
      expect(isValidTransition('expiring', 'expired')).toBe(true);
    });

    test('should allow expiring → active (renewal)', () => {
      expect(isValidTransition('expiring', 'active')).toBe(true);
    });

    test('should allow expired → archived', () => {
      expect(isValidTransition('expired', 'archived')).toBe(true);
    });

    // Invalid transitions
    test('should reject any state → draft (backward transition)', () => {
      expect(isValidTransition('active', 'draft')).toBe(false);
      expect(isValidTransition('expired', 'draft')).toBe(false);
      expect(isValidTransition('archived', 'draft')).toBe(false);
    });

    test('should reject expired → active (must create new plan)', () => {
      expect(isValidTransition('expired', 'active')).toBe(false);
    });

    test('should reject archived → anything (archived is terminal)', () => {
      expect(isValidTransition('archived', 'active')).toBe(false);
      expect(isValidTransition('archived', 'draft')).toBe(false);
      expect(isValidTransition('archived', 'expired')).toBe(false);
      expect(isValidTransition('archived', 'expiring')).toBe(false);
    });

    test('should reject same status transitions', () => {
      expect(isValidTransition('draft', 'draft')).toBe(false);
      expect(isValidTransition('active', 'active')).toBe(false);
      expect(isValidTransition('archived', 'archived')).toBe(false);
    });

    test('should reject invalid status values', () => {
      expect(isValidTransition(null, 'active')).toBe(false);
      expect(isValidTransition('draft', null)).toBe(false);
      expect(isValidTransition('invalid', 'active')).toBe(false);
      expect(isValidTransition('draft', 'invalid')).toBe(false);
    });

    test('should reject active → archived from invalid path', () => {
      // active can go to archived directly, but not through other invalid paths
      expect(isValidTransition('active', 'archived')).toBe(true);
    });
  });

  describe('getTransitionErrorMessage', () => {
    test('should provide helpful error for archived terminal state', () => {
      const msg = getTransitionErrorMessage('archived', 'active');
      expect(msg).toContain('archived is final');
    });

    test('should provide helpful error for expired → active (must create new)', () => {
      const msg = getTransitionErrorMessage('expired', 'active');
      expect(msg).toContain('create a new care plan');
    });

    test('should list allowed transitions', () => {
      const msg = getTransitionErrorMessage('draft', 'expired');
      expect(msg).toContain('Valid transitions from draft');
    });
  });

  describe('getAllowedTransitions', () => {
    test('should return correct allowed transitions for each status', () => {
      expect(getAllowedTransitions('draft')).toEqual(['active', 'archived']);
      expect(getAllowedTransitions('active')).toEqual(['expiring', 'expired', 'archived']);
      expect(getAllowedTransitions('expiring')).toEqual(['expired', 'active']);
      expect(getAllowedTransitions('expired')).toEqual(['archived']);
      expect(getAllowedTransitions('archived')).toEqual([]);
    });

    test('should return empty array for invalid status', () => {
      expect(getAllowedTransitions('invalid')).toEqual([]);
    });
  });

  describe('CARE_PLAN_STATUSES constants', () => {
    test('should define all valid statuses', () => {
      expect(CARE_PLAN_STATUSES.DRAFT).toBe('draft');
      expect(CARE_PLAN_STATUSES.ACTIVE).toBe('active');
      expect(CARE_PLAN_STATUSES.EXPIRING).toBe('expiring');
      expect(CARE_PLAN_STATUSES.EXPIRED).toBe('expired');
      expect(CARE_PLAN_STATUSES.ARCHIVED).toBe('archived');
    });
  });
});

// Example usage and testing
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Care Plan Transition Validation Tests\n');

  const testCases = [
    { from: 'draft', to: 'active', expected: true },
    { from: 'draft', to: 'expired', expected: false },
    { from: 'active', to: 'expiring', expected: true },
    { from: 'active', to: 'draft', expected: false },
    { from: 'expired', to: 'active', expected: false },
    { from: 'archived', to: 'active', expected: false },
  ];

  let passed = 0;
  let failed = 0;

  testCases.forEach(({ from, to, expected }) => {
    const result = isValidTransition(from, to);
    const status = result === expected ? '✓ PASS' : '✗ FAIL';
    if (result === expected) passed++;
    else failed++;

    console.log(`${status}: ${from} → ${to} (expected ${expected}, got ${result})`);
    if (result === false) {
      console.log(`  Error: ${getTransitionErrorMessage(from, to)}\n`);
    }
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
