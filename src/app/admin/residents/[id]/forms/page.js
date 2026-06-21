'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ChevronLeft, FileText, ClipboardList, ScrollText, NotebookPen,
  Pill, AlertTriangle, Trash2, IdCard, CalendarDays,
  Pencil, Eye, FileQuestion,
} from 'lucide-react';
import { AdminNavigation, MobileMenuButton } from '../../../AdminNavigation';
import { useAuth } from '@/contexts/AuthContext';

// Icon per form key so each row reads at a glance. Falls back to FileText.
const FORM_ICONS = {
  'pre-screening': FileText,
  'nursing-assessment': ClipboardList,
  'advance-directive': ScrollText,
  'care-plans': ScrollText,
  'daily-progress-notes': NotebookPen,
  'medication-administrations': Pill,
  'incidents': AlertTriangle,
  'drug-disposal': Trash2,
  'face-sheets': IdCard,
  'appointments': CalendarDays,
};

function StatusPill({ status }) {
  if (!status) return null;
  const map = {
    admitted:  { bg: 'var(--admin-success-bg)', text: 'var(--admin-success)' },
    approved:  { bg: 'var(--admin-success-bg)', text: 'var(--admin-success)' },
    submitted: { bg: '#DBEAFE', text: '#1E40AF' },
    draft:     { bg: 'var(--admin-canvas)', text: 'var(--admin-text-soft)' },
    declined:  { bg: '#FEE2E2', text: '#B91C1C' },
  };
  const s = map[status] || { bg: 'var(--admin-canvas)', text: 'var(--admin-text-soft)' };
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
      padding: '2px 9px', borderRadius: 999, background: s.bg, color: s.text,
      whiteSpace: 'nowrap',
    }}>
      {String(status).replace(/_/g, ' ')}
    </span>
  );
}

function CountBadge({ count }) {
  const has = count > 0;
  return (
    <span style={{
      minWidth: 28, height: 28, padding: '0 8px',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 8, fontSize: 13, fontWeight: 700,
      background: has ? 'var(--admin-accent-bg, #EEF2FF)' : 'var(--admin-canvas)',
      color: has ? 'var(--admin-accent, #4338CA)' : 'var(--admin-text-muted)',
      border: '1px solid var(--admin-border)',
    }}>
      {count}
    </span>
  );
}

export default function ResidentFormsHubPage() {
  const router = useRouter();
  const params = useParams();
  const residentId = params.id;
  const { auth, loading: authLoading } = useAuth();
  const accessToken = auth?.accessToken || '';

  const currentView = 'residents';
  const handleSidebarNav = (id) => {
    router.push(id === 'dashboard' ? '/admin' : `/admin?view=${id}`);
  };

  const [mobileOpen, setMobileOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [authLoading]);

  useEffect(() => {
    if (authLoading) return;
    if (!accessToken) {
      router.replace('/');
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/v1/residents/${encodeURIComponent(residentId)}/forms`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          credentials: 'same-origin',
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (!cancelled) setError(body.error || `Unable to load forms (${res.status})`);
          return;
        }
        const body = await res.json();
        if (!cancelled) setData(body.data);
      } catch {
        if (!cancelled) setError('Unable to load forms');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [authLoading, accessToken, residentId, router]);

  const goBack = () => router.push('/admin?view=residents');

  const handleEdit = (form) => {
    if (!form.formId) return;
    router.push(`${form.editPath}?${form.editParam}=${encodeURIComponent(form.formId)}`);
  };

  // View opens the existing Reports Hub PDF inline. The endpoint is auth-gated,
  // so fetch with the bearer token and hand the browser a blob URL.
  const handleView = async (form) => {
    if (!form.formId) return;
    const win = window.open('', '_blank');
    if (win) {
      const p = win.document.createElement('p');
      p.textContent = 'Loading form…';
      p.setAttribute('style', 'font-family:sans-serif;color:#475569;padding:24px');
      win.document.body.appendChild(p);
    }
    try {
      const res = await fetch(
        `/api/v1/admin/forms-history/${encodeURIComponent(form.formId)}/pdf?formType=${encodeURIComponent(form.pdfType)}&disposition=inline`,
        { headers: { Authorization: `Bearer ${accessToken}` }, credentials: 'same-origin' }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (win) win.close();
        alert(body.error || `Failed to open form (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      if (win) win.location.href = url; else window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch {
      if (win) win.close();
      alert('Error opening form');
    }
  };

  if (authLoading || !accessToken || loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--admin-canvas)', color: 'var(--admin-text-soft)', fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  const resident = data?.resident;
  const admissionForms = data?.admissionForms || [];
  const otherForms = data?.otherForms || [];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--admin-canvas)' }}>
      <AdminNavigation
        currentView={currentView}
        onViewChange={handleSidebarNav}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
        collapsed={navCollapsed}
        onCollapsedChange={setNavCollapsed}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <header
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 24px', background: 'var(--admin-paper)',
            borderBottom: '1px solid var(--admin-border)', position: 'sticky', top: 0, zIndex: 40,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
            <button
              onClick={goBack}
              aria-label="Back to residents"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px',
                color: 'var(--admin-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-canvas)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <ChevronLeft size={20} strokeWidth={2} />
            </button>
            <div style={{ minWidth: 0 }}>
              <h1
                style={{
                  fontFamily: 'var(--font-fraunces), Georgia, serif',
                  fontSize: isMobile ? 16 : 22, fontWeight: 600, color: 'var(--admin-text)',
                  letterSpacing: '-0.015em', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {resident?.full_name || 'Resident'}
              </h1>
              <div style={{ fontSize: 12, color: 'var(--admin-text-soft)', marginTop: 2 }}>Forms &amp; records</div>
            </div>
          </div>
          {isMobile && <MobileMenuButton open={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)} />}
        </header>

        <main style={{ flex: 1, padding: isMobile ? '16px' : '24px 40px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
          {error && (
            <div style={{ background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FCA5A5', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13.5 }}>
              {error}
            </div>
          )}

          {/* Back button (in-page) so the route is reachable without the chrome chevron */}
          <button
            onClick={goBack}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 18,
              padding: '7px 14px', background: 'var(--admin-paper)', border: '1px solid var(--admin-border)',
              borderRadius: 8, color: 'var(--admin-text)', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
            }}
          >
            <ChevronLeft size={15} /> Back to Residents
          </button>

          {/* Admission forms — editable */}
          <SectionTitle title="Admission Forms" sub="Editable intake forms · one record per resident" />
          <div style={cardStyle}>
            {admissionForms.map((form, i) => {
              const Icon = FORM_ICONS[form.key] || FileQuestion;
              const hasRecord = !!form.formId;
              return (
                <div
                  key={form.key}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                    padding: '14px 18px',
                    borderBottom: i < admissionForms.length - 1 ? '1px solid var(--admin-border-soft)' : 'none',
                  }}
                >
                  <span style={{ display: 'inline-flex', width: 38, height: 38, borderRadius: 9, background: 'var(--admin-canvas)', alignItems: 'center', justifyContent: 'center', color: 'var(--admin-text-soft)', flexShrink: 0 }}>
                    <Icon size={19} strokeWidth={1.8} />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--admin-text)' }}>{form.label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                      {hasRecord ? <StatusPill status={form.status} /> : <span style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>No record on file</span>}
                    </div>
                  </div>
                  <CountBadge count={form.count} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <ActionButton Icon={Eye} label="View" disabled={!hasRecord} onClick={() => handleView(form)} />
                    <ActionButton Icon={Pencil} label="Edit" primary disabled={!hasRecord} onClick={() => handleEdit(form)} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Other records — counts only */}
          <div style={{ marginTop: 28 }}>
            <SectionTitle title="Other Records" sub="Care records associated with this resident" />
            <div style={cardStyle}>
              {otherForms.map((form, i) => {
                const Icon = FORM_ICONS[form.key] || FileQuestion;
                return (
                  <div
                    key={form.key}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '13px 18px',
                      borderBottom: i < otherForms.length - 1 ? '1px solid var(--admin-border-soft)' : 'none',
                    }}
                  >
                    <span style={{ display: 'inline-flex', width: 34, height: 34, borderRadius: 8, background: 'var(--admin-canvas)', alignItems: 'center', justifyContent: 'center', color: 'var(--admin-text-soft)', flexShrink: 0 }}>
                      <Icon size={17} strokeWidth={1.8} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 500, color: 'var(--admin-text)' }}>{form.label}</div>
                    <CountBadge count={form.count} />
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

const cardStyle = {
  background: 'var(--admin-paper)',
  border: '1px solid var(--admin-border)',
  borderRadius: 12,
  overflow: 'hidden',
  boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
};

function SectionTitle({ title, sub }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <h2 style={{ fontFamily: 'var(--font-fraunces), Georgia, serif', fontSize: 17, fontWeight: 600, color: 'var(--admin-text)', letterSpacing: '-0.01em' }}>{title}</h2>
      {sub && <div style={{ fontSize: 12.5, color: 'var(--admin-text-soft)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function ActionButton({ Icon, label, onClick, primary, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        background: primary ? 'var(--admin-accent, #4338CA)' : 'var(--admin-paper)',
        color: primary ? '#fff' : 'var(--admin-text)',
        border: primary ? '1px solid var(--admin-accent, #4338CA)' : '1px solid var(--admin-border)',
      }}
    >
      <Icon size={15} strokeWidth={2} /> {label}
    </button>
  );
}
