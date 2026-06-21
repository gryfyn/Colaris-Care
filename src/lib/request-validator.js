/**
 * Request validation helper for API routes.
 * Provides utilities for validating and sanitizing input.
 */

export class ValidationError extends Error {
  constructor(field, message) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.status = 422;
  }
}

/**
 * Validate required fields in request body
 * @param {object} body - Request body
 * @param {string[]} required - Array of required field names
 * @returns {ValidationError|null} - First validation error or null if valid
 */
export function validateRequired(body, required) {
  for (const field of required) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return new ValidationError(field, `${field} is required`);
    }
  }
  return null;
}

/**
 * Validate UUID format (basic regex check)
 * @param {string} value - UUID string
 * @returns {boolean}
 */
export function validateUUID(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Validate enum value
 * @param {string} value - Value to validate
 * @param {string[]} allowedValues - Array of allowed values
 * @param {string} fieldName - Name of field (for error message)
 * @returns {ValidationError|null}
 */
export function validateEnum(value, allowedValues, fieldName) {
  if (!allowedValues.includes(value)) {
    return new ValidationError(
      fieldName,
      `${fieldName} must be one of: ${allowedValues.join(', ')}`
    );
  }
  return null;
}

/**
 * Validate date format (YYYY-MM-DD)
 * @param {string} value - Date string
 * @returns {boolean}
 */
export function validateDateFormat(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
}

/**
 * Validate pagination parameters
 * @param {object} params - { limit, offset }
 * @returns {object} - Validated { limit, offset }
 */
export function validatePagination(params) {
  const limit = Math.min(200, Math.max(1, parseInt(params.limit || '50')));
  const offset = Math.max(0, parseInt(params.offset || '0'));
  return { limit, offset };
}

/**
 * Validate phone number (basic format)
 * @param {string} value - Phone number
 * @returns {boolean}
 */
export function validatePhoneNumber(value) {
  return /^[\d\-\+\(\)\s]{10,}$/.test(value.replace(/\D/g, ''));
}

/**
 * Validate email address
 * @param {string} value - Email address
 * @returns {boolean}
 */
export function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Sanitize string input (remove potentially harmful characters)
 * @param {string} value - Input string
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} - Sanitized string
 */
export function sanitizeString(value, maxLength = 255) {
  if (!value || typeof value !== 'string') return '';
  return value
    .trim()
    .substring(0, maxLength)
    .replace(/[<>"`]/g, '');
}

/**
 * Build validation error response
 * @param {ValidationError} error - Validation error
 * @returns {object} - Response object { error, status }
 */
export function getValidationErrorResponse(error) {
  return {
    error: error.message,
    status: error.status,
    field: error.field,
  };
}
