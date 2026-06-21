/**
 * Care plan status transition validation
 * Enforces state machine rules for care plan status transitions
 */

// Valid status transitions as a state machine
const VALID_TRANSITIONS = {
  draft: ['active', 'archived'],
  active: ['expiring', 'expired', 'archived'],
  expiring: ['expired', 'active'],
  expired: ['archived'],
  archived: [], // archived is a terminal state
};

/**
 * Validates whether a transition from currentStatus to newStatus is allowed
 * @param {string} currentStatus - The current care plan status
 * @param {string} newStatus - The desired new status
 * @returns {boolean} True if transition is valid, false otherwise
 */
export function isValidTransition(currentStatus, newStatus) {
  if (!currentStatus || !newStatus) {
    return false;
  }

  // Same status is not a transition
  if (currentStatus === newStatus) {
    return false;
  }

  const allowedTransitions = VALID_TRANSITIONS[currentStatus];
  if (!allowedTransitions) {
    return false;
  }

  return allowedTransitions.includes(newStatus);
}

/**
 * Gets a human-readable error message for an invalid transition
 * @param {string} currentStatus - The current care plan status
 * @param {string} newStatus - The attempted new status
 * @returns {string} A descriptive error message
 */
export function getTransitionErrorMessage(currentStatus, newStatus) {
  if (currentStatus === newStatus) {
    return `Status is already ${currentStatus}`;
  }

  if (currentStatus === 'archived') {
    return 'Cannot modify archived care plans — archived status is final';
  }

  if (currentStatus === 'expired' && newStatus === 'active') {
    return 'Cannot renew expired care plans — create a new care plan instead';
  }

  if (newStatus === 'draft') {
    return `Cannot transition to draft — care plans cannot be reset to draft state`;
  }

  const allowedTransitions = VALID_TRANSITIONS[currentStatus];
  if (!allowedTransitions || !allowedTransitions.length) {
    return `No transitions allowed from ${currentStatus} status`;
  }

  return `Cannot transition from ${currentStatus} to ${newStatus}. Valid transitions from ${currentStatus}: ${allowedTransitions.join(', ')}`;
}

/**
 * Gets all allowed transitions from a given status
 * @param {string} status - The care plan status
 * @returns {string[]} Array of allowed target statuses
 */
export function getAllowedTransitions(status) {
  return VALID_TRANSITIONS[status] || [];
}

/**
 * All valid care plan statuses
 */
export const CARE_PLAN_STATUSES = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  EXPIRING: 'expiring',
  EXPIRED: 'expired',
  ARCHIVED: 'archived',
};

/**
 * Status descriptions for user-facing messages
 */
export const STATUS_DESCRIPTIONS = {
  draft: 'Initial state — not yet approved',
  active: 'Approved and in use by care team',
  expiring: 'Within 30 days of review date',
  expired: 'Past review date — renewal needed',
  archived: 'Manually archived — read-only',
};
