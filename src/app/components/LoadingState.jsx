'use client';

import { Loader } from 'lucide-react';

export function LoadingSpinner({ size = 'medium', message = 'Loading...' }) {
  const sizeMap = {
    small: 24,
    medium: 40,
    large: 60,
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        minHeight: '200px',
      }}
    >
      <Loader
        size={sizeMap[size]}
        style={{
          color: 'var(--admin-accent)',
          animation: 'spin 2s linear infinite',
          marginBottom: '16px',
        }}
      />
      <p style={{ color: 'var(--admin-text-soft)', fontSize: '14px' }}>{message}</p>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export function EmptyState({ title = 'No items found', message = '', action = null }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        minHeight: '300px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'var(--admin-info-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
        }}
      >
        <span style={{ fontSize: '32px' }}>📭</span>
      </div>

      <h3
        style={{
          fontSize: '18px',
          fontWeight: 600,
          color: 'var(--admin-text)',
          marginBottom: '8px',
        }}
      >
        {title}
      </h3>

      {message && (
        <p
          style={{
            fontSize: '14px',
            color: 'var(--admin-text-soft)',
            marginBottom: '24px',
            maxWidth: '400px',
          }}
        >
          {message}
        </p>
      )}

      {action && (
        <button
          onClick={action.onClick}
          style={{
            padding: '10px 20px',
            background: 'var(--admin-accent)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '14px',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => (e.target.style.opacity = '0.9')}
          onMouseLeave={(e) => (e.target.style.opacity = '1')}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export function DataLoadingState({ isLoading, isEmpty, error, data, children }) {
  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div
        style={{
          padding: '20px',
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          borderRadius: '8px',
          color: '#991b1b',
        }}
      >
        <strong>Error loading data</strong>
        <p style={{ marginTop: '8px', fontSize: '14px' }}>
          {typeof error === 'string' ? error : error?.message || 'An unexpected error occurred'}
        </p>
      </div>
    );
  }

  if (isEmpty) {
    return <EmptyState />;
  }

  return children;
}
