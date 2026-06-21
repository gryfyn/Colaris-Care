'use client';
import { X, AlertTriangle, RefreshCw } from 'lucide-react';

export function ErrorNotification({
  title,
  message,
  onDismiss,
  onRetry,
  isDismissible = true,
  variant = 'error'
}) {
  if (!title && !message) return null;

  const colors = {
    error: {
      bg: '#fee2e2',
      border: '#fca5a5',
      text: '#991b1b',
      icon: '#dc2626',
    },
    warning: {
      bg: '#fef3c7',
      border: '#fde68a',
      text: '#92400e',
      icon: '#d97706',
    },
    info: {
      bg: '#dbeafe',
      border: '#93c5fd',
      text: '#0c4a6e',
      icon: '#0284c7',
    },
  };

  const c = colors[variant] || colors.error;

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 8,
        background: c.bg,
        border: `1px solid ${c.border}`,
        marginBottom: 16,
        alignItems: 'flex-start',
      }}
      role="alert"
    >
      <AlertTriangle
        size={20}
        style={{ color: c.icon, marginTop: 2, flexShrink: 0 }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: c.text,
              marginBottom: 4,
            }}
          >
            {title}
          </div>
        )}
        {message && (
          <div
            style={{
              fontSize: 13,
              color: c.text,
              lineHeight: 1.5,
              opacity: 0.9,
            }}
          >
            {message}
          </div>
        )}

        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              marginTop: 8,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              color: c.icon,
              background: 'transparent',
              border: `1px solid ${c.border}`,
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.target.style.background = c.bg;
              e.target.style.borderColor = c.icon;
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'transparent';
              e.target.style.borderColor = c.border;
            }}
          >
            <RefreshCw size={14} />
            Retry
          </button>
        )}
      </div>

      {isDismissible && onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            background: 'transparent',
            border: 'none',
            color: c.text,
            cursor: 'pointer',
            padding: 0,
            opacity: 0.6,
            transition: 'opacity 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => (e.target.style.opacity = '1')}
          onMouseLeave={(e) => (e.target.style.opacity = '0.6')}
          aria-label="Dismiss error"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}

/**
 * Hook for managing error state in components
 */
export function useErrorHandler() {
  const [error, setError] = require('react').useState(null);

  const handleError = (err, context = '') => {
    const { parseAPIError, logError } = require('@/lib/api-error-handler');
    const parsed = parseAPIError(err, context);
    logError(err, context);
    setError(parsed);
  };

  const dismissError = () => setError(null);

  return {
    error,
    handleError,
    dismissError,
    clearError: () => setError(null),
  };
}
