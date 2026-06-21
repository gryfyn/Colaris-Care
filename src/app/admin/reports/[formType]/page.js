'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Scroll, ClipboardList, FileText, CalendarDays,
  NotebookPen, AlertTriangle, Trash2, DoorOpen,
  Download, ChevronLeft, Search,
  ChevronUp, ChevronDown, Calendar, User, Clock, Eye,
} from 'lucide-react';
import { AdminNavigation, MobileMenuButton } from '../../AdminNavigation';
import { useAuth } from '@/contexts/AuthContext';

// Form type definitions
const FORM_TYPE_MAP = {
  care_plans: { label: 'Care Plans', Icon: Scroll, color: '#1E40AF' },
  nursing_assessment: { label: 'Nursing Assessment', Icon: ClipboardList, color: '#047857' },
  pre_screening: { label: 'Pre-Screening', Icon: FileText, color: '#B45309' },
  advance_directive: { label: 'Advance Directive', Icon: Scroll, color: '#7C3AED' },
  face_sheets: { label: 'Face Sheets', Icon: FileText, color: '#0F766E' },
  evacuation_drills: { label: 'Evacuation Drills', Icon: DoorOpen, color: '#0891B2' },
  drug_disposal: { label: 'Drug Disposal', Icon: Trash2, color: '#D97706' },
  incidents: { label: 'Incidents', Icon: AlertTriangle, color: '#DC2626' },
  daily_progress_notes: { label: 'Daily Progress Notes', Icon: NotebookPen, color: '#1E40AF' },
};

function normalizeFormTypeId(formType) {
  return String(formType || '').replace(/-/g, '_');
}

// Convert underscore to hyphen for API endpoint (e.g. daily_progress_notes -> daily-progress-notes)
function getApiFormType(formType) {
  return normalizeFormTypeId(formType).replace(/_/g, '-');
}

function getDownloadFilename(response, fallback) {
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
  return match ? decodeURIComponent(match[1]) : fallback;
}

// Fetch forms from API
async function fetchFormsFromAPI(formType, params = {}, authToken = '') {
  const query = new URLSearchParams();
  if (params.residentId) query.append('residentId', params.residentId);
  if (params.startDate) query.append('startDate', params.startDate);
  if (params.endDate) query.append('endDate', params.endDate);
  query.append('limit', params.limit || 100);
  query.append('offset', params.offset || 0);

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    // Convert formType to API endpoint format (underscore to hyphen)
    const apiFormType = getApiFormType(formType);
    const res = await fetch(`/api/v1/admin/forms-history/${apiFormType}?${query.toString()}`, {
      headers,
      credentials: 'include', // Include cookies for refresh token
    });

    if (!res.ok) {
      if (res.status === 401) {
      }
      return { data: [], total: 0 };
    }
    const data = await res.json();
    return data;
  } catch (err) {
    return { data: [], total: 0 };
  }
}

// Status badge component
function StatusBadge({ status }) {
  const statusMap = {
    completed: { bg: 'var(--admin-success-bg)', text: 'var(--admin-success)', label: 'Completed' },
    in_progress: { bg: '#FEF3C7', text: '#B45309', label: 'In Progress' },
    draft: { bg: 'var(--admin-canvas)', text: 'var(--admin-text-soft)', label: 'Draft' },
    pending_review: { bg: '#EEF2FF', text: '#1E40AF', label: 'Pending Review' },
    approved: { bg: 'var(--admin-success-bg)', text: 'var(--admin-success)', label: 'Approved' },
    rejected: { bg: '#FEE2E2', text: '#DC2626', label: 'Rejected' },
  };

  const config = statusMap[status] || statusMap.draft;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        background: config.bg,
        color: config.text,
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {config.label}
    </span>
  );
}

// Pagination component
function Pagination({ currentPage, totalPages, onPageChange }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 24,
        paddingTop: 20,
        borderTop: '1px solid var(--admin-border)',
      }}
    >
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        style={{
          padding: '8px 12px',
          border: '1px solid var(--admin-border)',
          borderRadius: 6,
          background: currentPage === 1 ? 'var(--admin-canvas)' : 'var(--admin-paper)',
          color: currentPage === 1 ? 'var(--admin-text-muted)' : 'var(--admin-text)',
          cursor: currentPage === 1 ? 'default' : 'pointer',
          fontSize: 13,
          fontWeight: 500,
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          if (currentPage > 1) {
            e.currentTarget.style.background = 'var(--admin-accent-soft)';
            e.currentTarget.style.borderColor = 'var(--admin-accent)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--admin-paper)';
          e.currentTarget.style.borderColor = 'var(--admin-border)';
        }}
      >
        ← Previous
      </button>

      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: page === currentPage ? '2px solid var(--admin-accent)' : '1px solid var(--admin-border)',
              background: page === currentPage ? 'var(--admin-accent-soft)' : 'var(--admin-paper)',
              color: page === currentPage ? 'var(--admin-accent)' : 'var(--admin-text)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (page !== currentPage) {
                e.currentTarget.style.background = 'var(--admin-canvas)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--admin-paper)';
            }}
          >
            {page}
          </button>
        ))}
      </div>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        style={{
          padding: '8px 12px',
          border: '1px solid var(--admin-border)',
          borderRadius: 6,
          background: currentPage === totalPages ? 'var(--admin-canvas)' : 'var(--admin-paper)',
          color: currentPage === totalPages ? 'var(--admin-text-muted)' : 'var(--admin-text)',
          cursor: currentPage === totalPages ? 'default' : 'pointer',
          fontSize: 13,
          fontWeight: 500,
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          if (currentPage < totalPages) {
            e.currentTarget.style.background = 'var(--admin-accent-soft)';
            e.currentTarget.style.borderColor = 'var(--admin-accent)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--admin-paper)';
          e.currentTarget.style.borderColor = 'var(--admin-border)';
        }}
      >
        Next →
      </button>
    </div>
  );
}

// Table row component. The whole row is clickable to view the form (opens the
// rendered PDF inline in a new tab); explicit View / PDF buttons remain for
// discoverability. `number` is the form's sequential position in the list.
function FormRow({ form, number, isMobile, onView, onDownload }) {
  return (
    <div
      onClick={() => onView(form.id)}
      role="button"
      tabIndex={0}
      aria-label={`View form #${number} for ${form.residentName}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onView(form.id);
        }
      }}
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1.2fr) auto auto',
        gap: isMobile ? 12 : 0,
        padding: isMobile ? 16 : '12px 16px',
        borderBottom: '1px solid var(--admin-border)',
        alignItems: isMobile ? 'flex-start' : 'center',
        fontSize: isMobile ? 13 : 14,
        background: 'var(--admin-paper)',
        cursor: 'pointer',
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-canvas)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--admin-paper)'; }}
    >
      {isMobile ? (
        <>
          <div style={{ gridColumn: '1 / -1', fontWeight: 600, color: 'var(--admin-text)' }}>
            <span style={{ color: 'var(--admin-text-muted)', marginRight: 8, fontVariantNumeric: 'tabular-nums' }}>
              #{number}
            </span>
            {form.residentName}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--admin-text-soft)',
            }}
          >
            <Calendar size={14} style={{ flexShrink: 0 }} />
            {form.dateCreated}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--admin-text-soft)',
              minWidth: 0,
            }}
          >
            <User size={14} style={{ flexShrink: 0 }} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {form.author}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={(e) => { e.stopPropagation(); onView(form.id); }}
              aria-label={`View ${form.residentName} form`}
              style={{
                padding: '8px 12px',
                background: 'var(--admin-paper)',
                color: 'var(--admin-accent)',
                border: '1px solid var(--admin-accent)',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <Eye size={14} />
              View
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onDownload(form.id); }}
              aria-label={`Download ${form.residentName} form PDF`}
              style={{
                padding: '8px 12px',
                background: 'var(--admin-accent)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <Download size={14} />
              PDF
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ color: 'var(--admin-text)', fontWeight: 500, minWidth: 0 }}>
            {form.residentName}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--admin-text-soft)' }}>
            <Calendar size={14} style={{ flexShrink: 0 }} />
            {form.dateCreated}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--admin-text-soft)', minWidth: 0 }}>
            <User size={14} style={{ flexShrink: 0 }} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {form.author}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <button
              onClick={(e) => { e.stopPropagation(); onView(form.id); }}
              aria-label={`View ${form.residentName} form`}
              style={{
                padding: '8px 12px',
                background: 'var(--admin-paper)',
                color: 'var(--admin-accent)',
                border: '1px solid var(--admin-accent)',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <Eye size={14} />
              View
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <button
              onClick={(e) => { e.stopPropagation(); onDownload(form.id); }}
              aria-label={`Download ${form.residentName} form PDF`}
              style={{
                padding: '8px 12px',
                background: 'var(--admin-accent)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <Download size={14} />
              PDF
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function FormTypeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { auth, loading: authLoading } = useAuth();
  const formTypeId = normalizeFormTypeId(params.formType);

  // The detail page lives "under" the Reports Hub, so the sidebar highlights
  // `reports` while we're here. Clicking any other section actually leaves
  // this route — push back to /admin?view=<id>.
  const currentView = 'reports';
  const handleSidebarNav = (id) => {
    const url = id === 'dashboard' ? '/admin' : `/admin?view=${id}`;
    router.push(url);
  };
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Filter state
  const [searchResident, setSearchResident] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [allForms, setAllForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const itemsPerPage = 10;

  const accessToken = auth?.accessToken || '';
  useEffect(() => {
    if (authLoading) return;
    if (!accessToken) {
      setLoading(false);
      setAllForms([]);
      return;
    }

    let cancelled = false;
    const loadForms = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const result = await fetchFormsFromAPI(
          formTypeId,
          {
            limit: 100,
            startDate: dateFrom || undefined,
            endDate: dateTo || undefined,
          },
          accessToken
        );
        if (!cancelled) {
          setAllForms(result.data || []);
        }
      } catch (err) {
        if (!cancelled) {
          setAllForms([]);
          setLoadError('Unable to load forms');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadForms();
    return () => {
      cancelled = true;
    };
  }, [authLoading, accessToken, formTypeId, dateFrom, dateTo]);

  useEffect(() => {
    if (authLoading) return;
    if (!accessToken) {
      router.replace('/');
    }
  }, [authLoading, accessToken, router]);

  // Get unique residents for dropdowns
  const residents = useMemo(
    () => [...new Set(allForms.map((f) => f.residentName))].sort(),
    [allForms]
  );

  useEffect(() => {
    if (authLoading) return;
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [authLoading]);

  // Filtered data
  const filteredForms = useMemo(() => {
    return allForms.filter((form) => {
      if (searchResident && !form.residentName.toLowerCase().includes(searchResident.toLowerCase())) {
        return false;
      }
      if (dateFrom && new Date(form.dateCreated) < new Date(dateFrom)) {
        return false;
      }
      if (dateTo && new Date(form.dateCreated) > new Date(dateTo)) {
        return false;
      }
      if (statusFilter && form.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [allForms, searchResident, dateFrom, dateTo, statusFilter]);

  const totalPages = Math.ceil(filteredForms.length / itemsPerPage);
  const paginatedForms = filteredForms.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const formTypeInfo = FORM_TYPE_MAP[formTypeId] || { label: 'Forms', Icon: FileText, color: '#1E40AF' };
  const { label: formTypeLabel, Icon: FormTypeIcon, color: formTypeColor } = formTypeInfo;

  if (authLoading || !auth?.accessToken || loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--admin-canvas)', color: 'var(--admin-text-soft)', fontSize: 14 }}>
        Loading...
      </div>
    );
  }

  // Open the rendered form inline in a new tab. We pre-open the tab
  // synchronously (inside the click gesture) so popup blockers don't kill it,
  // then point it at the PDF blob once fetched. Auth lives in the Bearer header,
  // so we can't just navigate the browser to the URL directly.
  const handleView = async (formId) => {
    const win = window.open('', '_blank');
    if (win) {
      win.document.write('<p style="font-family:sans-serif;color:#475569;padding:24px">Loading form…</p>');
    }
    try {
      const token = auth?.accessToken || '';
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(
        `/api/v1/admin/forms-history/${encodeURIComponent(formId)}/pdf?formType=${encodeURIComponent(formTypeId)}&disposition=inline`,
        { headers, credentials: 'same-origin' }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (win) win.close();
        alert(body.error || `Failed to open form (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      if (win) {
        win.location.href = url;
      } else {
        window.open(url, '_blank');
      }
      // Revoke after the new tab has had time to load the document.
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (err) {
      if (win) win.close();
      alert('Error opening form');
    }
  };

  const handleDownload = async (formId) => {
    try {
      const token = auth?.accessToken || '';
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(
        `/api/v1/admin/forms-history/${encodeURIComponent(formId)}/pdf?formType=${encodeURIComponent(formTypeId)}`,
        {
          headers,
          credentials: 'same-origin',
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error || `Failed to download PDF (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = getDownloadFilename(res, `${formTypeId}-${formId}.pdf`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error downloading PDF');
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--admin-canvas)' }}>
      {/* Sidebar Navigation */}
      <AdminNavigation
        currentView={currentView}
        onViewChange={handleSidebarNav}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
        collapsed={navCollapsed}
        onCollapsedChange={setNavCollapsed}
      />

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Top bar */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            background: 'var(--admin-paper)',
            borderBottom: '1px solid var(--admin-border)',
            position: 'sticky',
            top: 0,
            zIndex: 40,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
            <button
              onClick={() => router.back()}
              aria-label="Go back"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px',
                color: 'var(--admin-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 6,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--admin-canvas)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = 'none';
                e.currentTarget.style.boxShadow = 'var(--admin-focus)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <ChevronLeft size={20} strokeWidth={2} />
            </button>

            <h1
              style={{
                fontFamily: 'var(--font-fraunces), Georgia, serif',
                fontSize: isMobile ? 16 : 22,
                fontWeight: 600,
                color: 'var(--admin-text)',
                letterSpacing: '-0.015em',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {formTypeLabel}
            </h1>
          </div>

          {isMobile && (
            <MobileMenuButton
              open={mobileOpen}
              onClick={() => setMobileOpen(!mobileOpen)}
            />
          )}
        </header>

        {/* Page Content */}
        <main
          style={{
            flex: 1,
            padding: isMobile ? '16px' : '24px 40px',
            maxWidth: 1400,
            margin: '0 auto',
            width: '100%',
          }}
        >
          {/* Filter section */}
          <div
            style={{
              background: 'var(--admin-paper)',
              border: '1px solid var(--admin-border)',
              borderRadius: 12,
              padding: isMobile ? 16 : 24,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--admin-text)',
                marginBottom: 16,
              }}
            >
              Filter Forms
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 12,
              }}
            >
              {/* Resident search */}
              <div style={{ position: 'relative' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--admin-text-soft)',
                    marginBottom: 6,
                    letterSpacing: '0.02em',
                  }}
                >
                  Resident
                </label>
                <div style={{ position: 'relative' }}>
                  <Search
                    size={16}
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--admin-text-muted)',
                      pointerEvents: 'none',
                    }}
                  />
                    <input
                      type="text"
                      placeholder="Search resident..."
                      value={searchResident}
                      onChange={(e) => { setSearchResident(e.target.value); setCurrentPage(1); }}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 36px',
                      border: '1px solid var(--admin-border)',
                      borderRadius: 8,
                      fontSize: 13,
                      background: 'var(--admin-paper)',
                      color: 'var(--admin-text)',
                      outline: 'none',
                      transition: 'border-color 0.16s ease',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--admin-accent)';
                      e.currentTarget.style.boxShadow = 'var(--admin-focus)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--admin-border)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              {/* Date from */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--admin-text-soft)',
                    marginBottom: 6,
                    letterSpacing: '0.02em',
                  }}
                >
                  From Date
                </label>
                  <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--admin-border)',
                    borderRadius: 8,
                    fontSize: 13,
                    background: 'var(--admin-paper)',
                    color: 'var(--admin-text)',
                    outline: 'none',
                    transition: 'border-color 0.16s ease',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--admin-accent)';
                    e.currentTarget.style.boxShadow = 'var(--admin-focus)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--admin-border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* Date to */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--admin-text-soft)',
                    marginBottom: 6,
                    letterSpacing: '0.02em',
                  }}
                >
                  To Date
                </label>
                  <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--admin-border)',
                    borderRadius: 8,
                    fontSize: 13,
                    background: 'var(--admin-paper)',
                    color: 'var(--admin-text)',
                    outline: 'none',
                    transition: 'border-color 0.16s ease',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--admin-accent)';
                    e.currentTarget.style.boxShadow = 'var(--admin-focus)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--admin-border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* Status filter */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--admin-text-soft)',
                    marginBottom: 6,
                    letterSpacing: '0.02em',
                  }}
                >
                  Status
                </label>
                  <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--admin-border)',
                    borderRadius: 8,
                    fontSize: 13,
                    background: 'var(--admin-paper)',
                    color: 'var(--admin-text)',
                    outline: 'none',
                    appearance: 'none',
                    backgroundImage:
                      "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    paddingRight: 34,
                    transition: 'border-color 0.16s ease',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--admin-accent)';
                    e.currentTarget.style.boxShadow = 'var(--admin-focus)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--admin-border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <option value="">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="in_progress">In Progress</option>
                  <option value="draft">Draft</option>
                  <option value="pending_review">Pending Review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            {/* Result count */}
            <div
              style={{
                marginTop: 16,
                fontSize: 13,
                color: 'var(--admin-text-soft)',
              }}
            >
              Showing {paginatedForms.length} of {filteredForms.length} forms
            </div>
          </div>

          {loadError && (
            <div
              style={{
                marginBottom: 16,
                padding: '12px 14px',
                border: '1px solid #fecaca',
                background: '#fef2f2',
                color: '#b91c1c',
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              {loadError}
            </div>
          )}

          {/* Table */}
          <div
            style={{
              background: 'var(--admin-paper)',
              border: '1px solid var(--admin-border)',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            {/* Table header (desktop only) */}
            {!isMobile && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1.2fr) auto auto',
                  gap: 0,
                  padding: '12px 16px',
                  background: 'var(--admin-canvas)',
                  borderBottom: '1px solid var(--admin-border)',
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--admin-text-soft)',
                  letterSpacing: '0.02em',
                  textTransform: 'uppercase',
                }}
              >
                <div>Resident</div>
                <div>Date Created</div>
                <div>Author</div>
                <div>View</div>
                <div>PDF</div>
              </div>
            )}

            {/* Table rows */}
            {paginatedForms.length > 0 ? (
              paginatedForms.map((form, idx) => (
                <FormRow
                  key={form.id}
                  form={form}
                  number={(currentPage - 1) * itemsPerPage + idx + 1}
                  isMobile={isMobile}
                  onView={handleView}
                  onDownload={handleDownload}
                />
              ))
            ) : (
              <div
                style={{
                  padding: isMobile ? 20 : 40,
                  textAlign: 'center',
                  color: 'var(--admin-text-soft)',
                  fontSize: 14,
                }}
              >
                No forms found matching your filters.
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          )}
        </main>
      </div>
    </div>
  );
}
