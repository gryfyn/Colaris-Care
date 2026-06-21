/**
 * Centralized error message mapping for validation and API errors.
 * Converts technical errors into user-friendly messages.
 * Applied to both validation layer and API error handlers.
 */

export function friendlyErrorMessage(error) {
  // Handle string error messages
  if (typeof error === 'string') {
    return mapErrorString(error);
  }

  // Handle Error objects
  if (error instanceof Error) {
    return mapErrorString(error.message);
  }

  // Handle objects with code or message properties
  if (typeof error === 'object' && error !== null) {
    // API error codes
    if (error.code) {
      return mapErrorCode(error.code);
    }
    // Error message property
    if (error.message) {
      return mapErrorString(error.message);
    }
    // Generic API error response
    if (error.error) {
      return mapErrorString(error.error);
    }
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Map specific error codes to user messages
 */
function mapErrorCode(code) {
  const codeMap = {
    'ECONNREFUSED': 'Unable to reach the server. Please check your connection and try again.',
    'ENOTFOUND': 'Network error. Please check your internet connection.',
    'ETIMEDOUT': 'Request timed out. Please try again.',
    'ERR_NETWORK': 'Network error. Please check your internet connection.',
    'VALIDATION_ERROR': 'Please check the form and correct any errors.',
    'AUTH_REQUIRED': 'You must be logged in to perform this action.',
    'TOKEN_EXPIRED': 'Your session expired. Please log in again.',
    'FORBIDDEN': 'You do not have permission to perform this action.',
    'NOT_FOUND': 'The requested resource was not found.',
    'DUPLICATE': 'This record already exists. Please check your data.',
    'INVALID_DATA': 'The information provided is invalid. Please review and correct.',
  };

  return codeMap[code] || `An error occurred (${code}). Please try again.`;
}

/**
 * Map error message strings to user-friendly versions
 */
function mapErrorString(message) {
  if (!message) return 'An unexpected error occurred. Please try again.';

  const msg = message.toLowerCase();

  // Field validation errors
  if (msg.includes('required')) return 'This field is required.';
  if (msg.includes('invalid') || msg.includes('invalid format')) return 'Please enter a valid value.';
  if (msg.includes('must be')) return 'The value provided does not match requirements.';
  if (msg.includes('already exists')) return 'This value is already in use. Please choose another.';
  if (msg.includes('at least')) return 'Please enter a longer value.';
  if (msg.includes('no more than') || msg.includes('maximum')) return 'This value is too long.';

  // Date errors
  if (msg.includes('date') && msg.includes('future')) return 'Please enter a date in the past.';
  if (msg.includes('date') && msg.includes('past')) return 'Please enter a valid date.';
  if (msg.includes('date') && msg.includes('invalid')) return 'Please enter a valid date.';

  // Age/DOB errors
  if (msg.includes("doesn't match") || msg.includes('does not match')) {
    return 'The age and date of birth do not match. Please correct one of them.';
  }
  if (msg.includes('age') && msg.includes('minimum')) return 'The patient does not meet the minimum age requirement.';
  if (msg.includes('age') && msg.includes('maximum')) return 'Please verify the age. It appears to be outside normal range.';

  // Network/Server errors
  if (msg.includes('econnrefused') || msg.includes('refused')) return 'Unable to reach the server. Please check your connection.';
  if (msg.includes('timeout')) return 'The request took too long. Please try again.';
  if (msg.includes('network')) return 'Network error. Please check your internet connection.';

  // Authentication/Authorization
  if (msg.includes('unauthorized') || msg.includes('not authorized')) return 'You are not authorized to perform this action.';
  if (msg.includes('forbidden') || msg.includes('access denied')) return 'You do not have permission to do this.';
  if (msg.includes('unauthenticated') || msg.includes('not authenticated')) return 'Please log in to continue.';

  // Database/Server errors
  if (msg.includes('duplicate') || msg.includes('already exists')) return 'This record already exists.';
  if (msg.includes('not found')) return 'The record was not found.';
  if (msg.includes('constraint') || msg.includes('foreign key')) return 'Unable to save due to data relationships. Please check related records.';

  // Generic fallback: return the original message if it's short enough
  if (message.length < 100) return message;
  return 'An error occurred. Please try again or contact support if the problem persists.';
}

/**
 * Extract and format API response errors into a single user message
 */
export function formatApiError(response) {
  if (!response) {
    return 'An unexpected error occurred.';
  }

  // Handle various API response formats
  if (response.error) {
    return friendlyErrorMessage(response.error);
  }

  if (response.message) {
    return friendlyErrorMessage(response.message);
  }

  if (response.errors && Array.isArray(response.errors)) {
    const firstError = response.errors[0];
    if (typeof firstError === 'string') {
      return friendlyErrorMessage(firstError);
    }
    if (firstError.message) {
      return friendlyErrorMessage(firstError.message);
    }
  }

  if (response.detail) {
    return friendlyErrorMessage(response.detail);
  }

  return 'An error occurred. Please try again.';
}

/**
 * Map validation errors from form submission
 * Takes field-level errors and returns user-friendly versions
 */
export function mapValidationErrors(validationErrors = {}) {
  if (typeof validationErrors !== 'object') {
    return { _form: friendlyErrorMessage(validationErrors) };
  }

  const mapped = {};
  for (const [field, error] of Object.entries(validationErrors)) {
    mapped[field] = friendlyErrorMessage(error);
  }

  return mapped;
}
