'use client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

// Slim brand bar shown at the top of every full-page form route so the user
// always has a way back to their dashboard (the forms are standalone routes
// that otherwise have no app chrome). Fixed-positioned with a matching spacer
// so it layers correctly above the forms that render as `inset: 0` takeovers.
export const FORM_TOPBAR_HEIGHT = 52;

const C = {
  bg: '#FFFFFF',
  border: '#E2E8F0',
  navy: '#0F2D5E',
  muted: '#64748B',
};

function homeFor(role) {
  if (!role) return '/admin';
  const r = String(role).toLowerCase();
  if (r === 'resident') return '/residents';
  if (['staff', 'nurse', 'caregiver', 'med_tech'].includes(r)) return '/staff';
  // admin, manager, superadmin — and any other authenticated clinical role —
  // return to the admin dashboard, where these forms are launched from.
  return '/admin';
}

export default function FormTopBar({ title }) {
  const router = useRouter();
  const { auth } = useAuth() || {};
  const home = homeFor(auth?.user?.role);

  return (
    <>
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: FORM_TOPBAR_HEIGHT,
          background: C.bg,
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '0 16px',
          zIndex: 1000,
          boxShadow: '0 1px 3px rgba(15,45,94,0.06)',
        }}
      >
        <button
          type="button"
          onClick={() => router.push(home)}
          aria-label="Dependable Care — go to dashboard"
          title="Go to dashboard"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 6px',
            borderRadius: 8,
            minWidth: 0,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Dependable Care logo"
            width={32}
            height={32}
            style={{ display: 'block', objectFit: 'contain', flexShrink: 0 }}
          />
          <span
            style={{
              fontFamily: 'var(--font-fraunces), Georgia, serif',
              fontSize: 16,
              fontWeight: 600,
              color: C.navy,
              letterSpacing: '-0.015em',
              whiteSpace: 'nowrap',
            }}
          >
            Dependable Care
          </span>
        </button>

        {title && (
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: C.muted,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
            }}
          >
            {title}
          </span>
        )}

        <button
          type="button"
          onClick={() => router.push(home)}
          title="Go back"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: `1px solid ${C.border}`,
            borderRadius: 7,
            padding: '6px 12px',
            cursor: 'pointer',
            color: C.navy,
            fontSize: 13,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          ← Back
        </button>
      </header>

      {/* Spacer keeps normal-flow form content clear of the fixed bar. */}
      <div aria-hidden="true" style={{ height: FORM_TOPBAR_HEIGHT, flexShrink: 0 }} />
    </>
  );
}
