'use client';

import { useEffect } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

export default function Error({ error, reset }) {
  useEffect(() => {
    // Log the error for monitoring
    if (process.env.NODE_ENV === 'production') {
      // Could send to error tracking service like Sentry
      // e.g., captureException(error);
    } else {
      console.error('Unhandled error:', error);
    }
  }, [error]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0b1a2e 0%, #0c3547 60%, #0b2a3a 100%)',
        padding: '20px',
      }}
    >
      <div style={{ textAlign: 'center', color: 'white', maxWidth: '500px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'rgba(220, 38, 38, 0.1)',
            marginBottom: '24px',
          }}
        >
          <AlertTriangle size={40} color="#dc2626" />
        </div>

        <h1
          style={{
            fontSize: '32px',
            fontWeight: 600,
            marginBottom: '12px',
            color: 'white',
          }}
        >
          Something Went Wrong
        </h1>

        <p
          style={{
            fontSize: '16px',
            color: 'rgba(255,255,255,0.7)',
            marginBottom: '12px',
            lineHeight: '1.6',
          }}
        >
          We encountered an unexpected error. Our team has been notified and is looking into it.
        </p>

        <details
          style={{
            marginBottom: '32px',
            textAlign: 'left',
            background: 'rgba(0,0,0,0.2)',
            padding: '16px',
            borderRadius: '8px',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.6)',
          }}
        >
          <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: '8px' }}>
            Error Details
          </summary>
          <pre
            style={{
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: '11px',
              margin: '8px 0 0 0',
            }}
          >
            {error?.message || 'Unknown error'}
          </pre>
        </details>

        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={reset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => (e.target.style.transform = 'translateY(-2px)')}
            onMouseLeave={(e) => (e.target.style.transform = 'translateY(0)')}
          >
            <RefreshCw size={16} />
            Try Again
          </button>

          <a
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              background: 'rgba(255,255,255,0.1)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '14px',
              textDecoration: 'none',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => (e.target.style.background = 'rgba(255,255,255,0.2)')}
            onMouseLeave={(e) => (e.target.style.background = 'rgba(255,255,255,0.1)')}
          >
            <Home size={16} />
            Go Home
          </a>
        </div>

        <div
          style={{
            marginTop: '48px',
            paddingTop: '32px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
            Need help? Contact us at{' '}
            <a
              href="mailto:support@dependablecare.org"
              style={{ color: '#10b981', textDecoration: 'none' }}
            >
              support@dependablecare.org
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
