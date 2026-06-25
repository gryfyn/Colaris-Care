/**
 * Comprehensive API error handling utility
 * Provides consistent error messages and recovery strategies
 */

export class APIError extends Error {
  constructor(message, status = 500, originalError = null) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.originalError = originalError;
  }
}

/**
 * Parse API error response and return user-friendly message
 */
export function parseAPIError(error, context = '') {
  // Network error
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      title: 'Network Error',
      message: 'Unable to connect to server. Please check your internet connection.',
      status: 0,
      retry: true,
      code: 'NETWORK_ERROR',
    };
  }

  // Timeout
  if (error.name === 'AbortError') {
    return {
      title: 'Request Timeout',
      message: 'The request took too long. Please try again.',
      status: 408,
      retry: true,
      code: 'TIMEOUT',
    };
  }

  // HTTP error
  if (error instanceof APIError) {
    switch (error.status) {
      case 401:
      case 403:
        return {
          title: 'Access Denied',
          message: 'You do not have permission to perform this action.',
          status: error.status,
          retry: false,
          code: 'UNAUTHORIZED',
        };

      case 404:
        return {
          title: 'Not Found',
          message: 'The requested resource was not found.',
          status: 404,
          retry: false,
          code: 'NOT_FOUND',
        };

      case 409:
        return {
          title: 'Conflict',
          message: 'This item already exists or has been modified. Please refresh and try again.',
          status: 409,
          retry: true,
          code: 'CONFLICT',
        };

      case 422:
        return {
          title: 'Invalid Data',
          message: error.message || 'The provided data is invalid. Please check and try again.',
          status: 422,
          retry: false,
          code: 'VALIDATION_ERROR',
        };

      case 429:
        return {
          title: 'Too Many Requests',
          message: 'You are making requests too quickly. Please wait a moment and try again.',
          status: 429,
          retry: true,
          code: 'RATE_LIMITED',
        };

      case 500:
      case 502:
      case 503:
      case 504:
        return {
          title: 'Server Error',
          message: 'The server encountered an error. Please try again later.',
          status: error.status,
          retry: true,
          code: 'SERVER_ERROR',
        };

      default:
        return {
          title: 'Request Failed',
          message: error.message || 'An unexpected error occurred. Please try again.',
          status: error.status,
          retry: true,
          code: 'UNKNOWN_ERROR',
        };
    }
  }

  // Unknown error
  return {
    title: 'Error',
    message: error.message || 'An unexpected error occurred.',
    status: 500,
    retry: true,
    code: 'UNKNOWN_ERROR',
  };
}

/**
 * Fetch with timeout and error handling
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new APIError(
        data.error || `HTTP ${response.status}`,
        response.status,
        data
      );
    }

    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Retry logic for transient failures
 */
export async function withRetry(
  fn,
  options = { maxAttempts: 3, delayMs: 1000, backoffMultiplier: 2 }
) {
  let lastError;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on client errors
      if (error instanceof APIError && error.status >= 400 && error.status < 500) {
        throw error;
      }

      // Calculate delay with exponential backoff
      if (attempt < options.maxAttempts) {
        const delay = options.delayMs * Math.pow(options.backoffMultiplier, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Log error for debugging and monitoring
 */
export function logError(error, context = '', extra = {}) {
  const errorData = {
    timestamp: new Date().toISOString(),
    context,
    message: error.message,
    status: error.status,
    code: error.code,
    ...extra,
  };

  // Log to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.error('[API Error]', errorData);
  }

  // In production, could send to error tracking service
  // e.g., Sentry, DataDog, etc.
}

/**
 * Create user-friendly error display component
 */
export function createErrorNotification(error, context = '') {
  const parsed = parseAPIError(error, context);

  return {
    ...parsed,
    isDismissible: true,
    action: parsed.retry ? { label: 'Retry', type: 'primary' } : null,
  };
}
