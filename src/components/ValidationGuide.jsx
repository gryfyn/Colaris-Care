'use client';

import { getFieldRubric } from '@/lib/form-rubrics';

/**
 * ValidationGuide — a small floating notification anchored to the right edge of
 * the admission wizards. It lists every field currently entered wrongly (or
 * missing) and, for each, shows the recommended entry (a "rubric") so the user
 * can self-correct without guessing the expected format.
 *
 * It renders nothing when there are no errors, and each card disappears the
 * moment its field is corrected (the parent clears that key from `errors`).
 *
 * Props:
 *   - errors:  { fieldKey: message }  — the live error map driving the form
 *   - labels:  { fieldKey: humanLabel } — display names (falls back to the key)
 *   - theme:   optional accent colors to match the host form
 */

const DEFAULT_THEME = {
  red: '#c0392b',
  redBg: '#fef2f2',
  white: '#ffffff',
  text: '#1f2937',
  textMuted: '#6b7280',
  border: '#fecaca',
  accent: '#c0392b',
};

function humanize(key = '') {
  return String(key)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^\w/, (c) => c.toUpperCase());
}

export default function ValidationGuide({ errors = {}, labels = {}, theme = {} }) {
  const t = { ...DEFAULT_THEME, ...theme };
  const entries = Object.entries(errors || {}).filter(([, msg]) => !!msg);
  if (entries.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        right: 20,
        top: 132,
        width: 312,
        maxHeight: 'calc(100vh - 240px)',
        zIndex: 130,
        display: 'flex',
        flexDirection: 'column',
        background: t.white,
        border: `1px solid ${t.border}`,
        borderLeft: `4px solid ${t.accent}`,
        borderRadius: 12,
        boxShadow: '0 12px 32px rgba(15,43,45,0.18)',
        overflow: 'hidden',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        animation: 'vg-slide-in 0.22s ease-out',
      }}
    >
      <style>{`
        @keyframes vg-slide-in {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          background: t.redBg,
          borderBottom: `1px solid ${t.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 9,
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: t.accent,
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          !
        </span>
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.accent }}>
            {entries.length} entr{entries.length === 1 ? 'y' : 'ies'} to fix
          </div>
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 1 }}>
            Recommended format shown below
          </div>
        </div>
      </div>

      {/* Cards */}
      <div style={{ overflowY: 'auto', padding: 10, display: 'grid', gap: 8 }}>
        {entries.map(([key, message]) => {
          const rubric = getFieldRubric(key);
          const label = labels[key] || humanize(key);
          return (
            <div
              key={key}
              style={{
                background: t.white,
                border: `1px solid ${t.border}`,
                borderRadius: 9,
                padding: '10px 12px',
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 700, color: t.text, marginBottom: 3 }}>
                {label}
              </div>
              <div style={{ fontSize: 12, color: t.red, lineHeight: 1.4 }}>{message}</div>
              {rubric && (
                <div
                  style={{
                    marginTop: 7,
                    paddingTop: 7,
                    borderTop: `1px dashed ${t.border}`,
                    fontSize: 11.5,
                    color: t.textMuted,
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ fontWeight: 700, color: t.textMuted }}>Recommended: </span>
                  {rubric.expected}
                  {rubric.example && (
                    <div style={{ marginTop: 3 }}>
                      e.g.{' '}
                      <span
                        style={{
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                          color: t.text,
                          background: '#f3f4f6',
                          padding: '1px 6px',
                          borderRadius: 4,
                          fontSize: 11,
                        }}
                      >
                        {rubric.example}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
