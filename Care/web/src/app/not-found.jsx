'use client';

import Link from 'next/link';
import { Home, ChevronRight } from 'lucide-react';

export default function NotFound() {
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
            fontSize: '120px',
            fontWeight: 'bold',
            marginBottom: '20px',
            opacity: 0.3,
            fontFamily: 'monospace',
            letterSpacing: '8px',
          }}
        >
          404
        </div>

        <h1
          style={{
            fontSize: '32px',
            fontWeight: 600,
            marginBottom: '12px',
            color: 'white',
          }}
        >
          Page Not Found
        </h1>

        <p
          style={{
            fontSize: '16px',
            color: 'rgba(255,255,255,0.7)',
            marginBottom: '32px',
            lineHeight: '1.6',
          }}
        >
          The page you're looking for doesn't exist or has been moved. Let's get you back on track.
        </p>

        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              color: 'white',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '14px',
              textDecoration: 'none',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => (e.target.style.transform = 'translateY(-2px)')}
            onMouseLeave={(e) => (e.target.style.transform = 'translateY(0)')}
          >
            <Home size={16} />
            Back to Home
          </Link>

          <button
            onClick={() => window.history.back()}
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
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => (e.target.style.background = 'rgba(255,255,255,0.2)')}
            onMouseLeave={(e) => (e.target.style.background = 'rgba(255,255,255,0.1)')}
          >
            <ChevronRight size={16} />
            Go Back
          </button>
        </div>

        <div
          style={{
            marginTop: '48px',
            paddingTop: '32px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
            If you believe this is an error, please contact support at{' '}
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
