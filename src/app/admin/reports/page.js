'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Scroll, ClipboardList, FileText, CalendarDays,
  NotebookPen, AlertTriangle, Trash2, DoorOpen,
  ArrowRight,
} from 'lucide-react';
import { AdminNavigation, MobileMenuButton } from '../AdminNavigation';
import { useAuth } from '@/contexts/AuthContext';

const REPORT_CATEGORIES = [
  {
    id: 'admissions',
    label: 'Admission Forms',
    description: 'Clinical and intake documents completed during admission.',
  },
  {
    id: 'resident_records',
    label: 'Resident Records',
    description: 'Face sheets for residents.',
  },
  {
    id: 'staff_reports',
    label: 'Staff Reports',
    description: 'Forms submitted by staff and reviewed by administrators.',
  },
  {
    id: 'facility',
    label: 'Facility Records',
    description: 'Facility-wide compliance and operational records.',
  },
];

// Form type definitions with display names, icons, colors, and report category.
const FORM_TYPES = [
  { id: 'nursing_assessment', category: 'admissions', label: 'Nursing Assessment', Icon: ClipboardList, color: '#047857', bgColor: '#ECFDF5', endpoint: '/api/v1/admin/forms-history/nursing-assessment' },
  { id: 'pre_screening', category: 'admissions', label: 'Pre-Screening', Icon: FileText, color: '#B45309', bgColor: '#FEF3C7', endpoint: '/api/v1/admin/forms-history/pre-screening' },
  { id: 'advance_directive', category: 'admissions', label: 'Advance Directive', Icon: Scroll, color: '#7C3AED', bgColor: '#F5F3FF', endpoint: '/api/v1/admin/forms-history/advance-directive' },
  { id: 'face_sheets', category: 'resident_records', label: 'Face Sheets', Icon: FileText, color: '#0F766E', bgColor: '#ECFEFF', endpoint: '/api/v1/admin/forms-history/face-sheets' },
  { id: 'care_plans', category: 'resident_records', label: 'Care Plans', Icon: Scroll, color: '#1E40AF', bgColor: '#EEF2FF', endpoint: '/api/v1/admin/forms-history/care-plans' },
  { id: 'daily_progress_notes', category: 'staff_reports', label: 'Daily Progress Notes', Icon: NotebookPen, color: '#1E40AF', bgColor: '#EEF2FF', endpoint: '/api/v1/admin/forms-history/daily-progress-notes' },
  { id: 'incidents', category: 'staff_reports', label: 'Incidents', Icon: AlertTriangle, color: '#DC2626', bgColor: '#FEE2E2', endpoint: '/api/v1/admin/forms-history/incidents' },
  { id: 'drug_disposal', category: 'staff_reports', label: 'Drug Disposal', Icon: Trash2, color: '#D97706', bgColor: '#FEF3C7', endpoint: '/api/v1/admin/forms-history/drug-disposal' },
  { id: 'evacuation_drills', category: 'facility', label: 'Evacuation Drills', Icon: DoorOpen, color: '#0891B2', bgColor: '#ECFEFF', endpoint: '/api/v1/admin/forms-history/evacuation-drills' },
];

// Card component for each form type
function FormTypeCard({ formType, count = 0 }) {
  const { Icon, label, color, bgColor } = formType;
  return (
    <Link
      href={`/admin/reports/${formType.id}`}
      aria-label={`View ${label} forms`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '20px 24px',
        background: bgColor,
        border: `2px solid ${color}`,
        borderRadius: 12,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        textAlign: 'left',
        width: '100%',
        textDecoration: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 8px 24px ${color}22`;
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = `0 0 0 3px ${color}40`;
        e.currentTarget.style.outline = 'none';
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 10,
          background: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={28} color="#FFFFFF" strokeWidth={1.5} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--font-fraunces), Georgia, serif',
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--admin-text)',
            marginBottom: 4,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--admin-text-soft)',
          }}
        >
          {count} {count === 1 ? 'form' : 'forms'}
        </div>
      </div>

      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          opacity: 0.7,
        }}
      >
        <ArrowRight size={14} color="#FFFFFF" strokeWidth={2} />
      </div>
    </Link>
  );
}

export default function ReportsHubPage() {
  const router = useRouter();
  const { auth, loading: authLoading } = useAuth();
  const [currentView, setCurrentView] = useState('reports');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [formCounts, setFormCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!auth?.accessToken) {
      router.replace('/');
      return;
    }

    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [auth?.accessToken, authLoading, router]);

  // Fetch form counts from each API endpoint
  useEffect(() => {
    if (authLoading) return;
    if (!auth?.accessToken) {
      return;
    }

    const fetchFormCounts = async () => {
      setLoading(true);
      setError('');
      const counts = {};

      try {
        for (const formType of FORM_TYPES) {
          try {
            const response = await fetch(`${formType.endpoint}?limit=1&offset=0`, {
              headers: { Authorization: `Bearer ${auth.accessToken}` },
              credentials: 'same-origin',
            });

            if (response.ok) {
              const data = await response.json();
              counts[formType.id] = data.total || 0;
            } else {
              counts[formType.id] = 0;
            }
          } catch (err) {
            counts[formType.id] = 0;
          }
        }

        setFormCounts(counts);
      } catch (err) {
        setError('Unable to load form counts');
      } finally {
        setLoading(false);
      }
    };

    fetchFormCounts();
  }, [auth?.accessToken, authLoading]);

  if (authLoading || !auth?.accessToken) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--admin-canvas)', color: 'var(--admin-text-soft)', fontSize: 14 }}>
        Loading...
      </div>
    );
  }

  const handleNavChange = (view) => {
    if (view === 'reports') {
      setCurrentView('reports');
      // Stay on current page
    } else {
      // Navigate to other admin sections if needed
      // For now, just update view for navigation state
      setCurrentView(view);
    }
  };

  const handleFormTypeClick = (formTypeId) => {
    router.push(`/admin/reports/${formTypeId}`);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--admin-canvas)' }}>
      {/* Sidebar Navigation */}
      <AdminNavigation
        currentView={currentView}
        onViewChange={handleNavChange}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
        collapsed={navCollapsed}
        onCollapsedChange={setNavCollapsed}
      />

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Top bar with mobile menu button */}
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
          <h1
            style={{
              fontFamily: 'var(--font-fraunces), Georgia, serif',
              fontSize: isMobile ? 18 : 22,
              fontWeight: 600,
              color: 'var(--admin-text)',
              letterSpacing: '-0.015em',
            }}
          >
            Reports Hub
          </h1>

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
            padding: isMobile ? '20px 16px' : '32px 40px',
            maxWidth: 1200,
            margin: '0 auto',
            width: '100%',
          }}
        >
          {/* Intro section */}
          <div style={{ marginBottom: 40 }}>
            <p
              style={{
                fontSize: 14,
                color: 'var(--admin-text-soft)',
                lineHeight: 1.6,
                maxWidth: 600,
              }}
            >
              Select a form type to view all submissions, filter by date range or resident, and download PDFs.
            </p>
          </div>

          {error && (
            <div
              style={{
                background: '#FEE2E2',
                border: '1px solid #FECACA',
                borderRadius: 8,
                padding: '12px 16px',
                marginBottom: 24,
                fontSize: 13,
                color: '#DC2626',
                lineHeight: 1.6,
              }}
            >
              {error}
            </div>
          )}

          {loading && (
            <div
              style={{
                padding: 40,
                textAlign: 'center',
                fontSize: 14,
                color: 'var(--admin-text-soft)',
              }}
            >
              Loading form counts...
            </div>
          )}

          {!loading && REPORT_CATEGORIES.map((category) => {
            const categoryForms = FORM_TYPES.filter((formType) => formType.category === category.id);
            if (categoryForms.length === 0) return null;
            return (
              <section key={category.id} style={{ marginBottom: isMobile ? 28 : 36 }}>
                <div style={{ marginBottom: 14 }}>
                  <h2
                    style={{
                      fontFamily: 'var(--font-fraunces), Georgia, serif',
                      fontSize: isMobile ? 17 : 20,
                      fontWeight: 600,
                      color: 'var(--admin-text)',
                      margin: 0,
                    }}
                  >
                    {category.label}
                  </h2>
                  <div style={{ fontSize: 13, color: 'var(--admin-text-soft)', marginTop: 4, lineHeight: 1.5 }}>
                    {category.description}
                  </div>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: isMobile ? 12 : 20,
                  }}
                >
                  {categoryForms.map((formType) => {
                    const count = formCounts[formType.id] || 0;
                    return (
                      <FormTypeCard
                        key={formType.id}
                        formType={formType}
                        count={count}
                        onClick={() => handleFormTypeClick(formType.id)}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </main>
      </div>
    </div>
  );
}
