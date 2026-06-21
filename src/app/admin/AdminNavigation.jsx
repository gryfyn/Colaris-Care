'use client';
import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  UserCog,
  ClipboardList,
  FileText,
  Scroll,
  CalendarDays,
  Pill,
  NotebookPen,
  AlertTriangle,
  Trash2,
  DoorOpen,
  FolderKanban,
  Inbox,
  Sparkles,
  Megaphone,
  Calendar,
  Bell,
  KeyRound,
  ChevronLeft,
  ClipboardCheck,
} from 'lucide-react';

const NAV_GROUPS = [
  {
    section: 'Facility',
    items: [
      { id: 'dashboard',          label: 'Dashboard',          Icon: LayoutDashboard },
      { id: 'residents',          label: 'Residents',          Icon: Users },
      { id: 'staff',              label: 'Staff Directory',    Icon: UserCog },
    ],
  },
  {
    section: 'Admissions',
    items: [
      { id: 'pre_screening', label: 'Pre-Screening', Icon: ClipboardCheck },
      { id: 'pending_admissions', label: 'Pending Admissions', Icon: ClipboardList },
    ],
  },
  {
    section: 'Clinical',
    items: [
      { id: 'face_sheets',          label: 'Face Sheets',        Icon: FileText },
      { id: 'care_plans',           label: 'Care Plans',         Icon: Scroll },
      { id: 'appointments',         label: 'Appointments',       Icon: CalendarDays },
      { id: 'medications',          label: 'Medications',        Icon: Pill },
      { id: 'daily_progress_notes', label: 'Progress Notes',     Icon: NotebookPen },
      { id: 'incident_reports',     label: 'Incident Reports',   Icon: AlertTriangle },
      { id: 'drug_disposal',        label: 'Drug Disposal',      Icon: Trash2 },
      { id: 'evacuation_drills',    label: 'Evacuation Drills',  Icon: DoorOpen },
      { id: 'reports',              label: 'Reports Hub',        Icon: FolderKanban },
    ],
  },
  {
    section: 'Resident Engagement',
    items: [
      { id: 'resident_requests',  label: 'Resident Requests',  Icon: Inbox },
      { id: 'activities',         label: 'Weekly Activities',  Icon: Sparkles },
    ],
  },
  {
    section: 'Communications',
    items: [
      { id: 'announcements',      label: 'Announcements',      Icon: Megaphone },
      { id: 'calendar',           label: 'Calendar',           Icon: Calendar },
      { id: 'notifications',      label: 'Notifications',      Icon: Bell },
    ],
  },
  {
    section: 'Administration',
    items: [
      { id: 'account_management', label: 'Account Management', Icon: KeyRound },
    ],
  },
];

const SIDEBAR_WIDTH = 264;
const SIDEBAR_COLLAPSED_WIDTH = 68;

export function AdminNavigation({
  currentView,
  onViewChange,
  badges = {},
  mobileOpen,
  onMobileOpenChange,
  collapsed = false,
  onCollapsedChange,
}) {
  const [isMobile, setIsMobile] = useState(false);
  const scrollRef = useRef(null);
  const [scroll, setScroll] = useState({ thumb: 100, top: 0, visible: false });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (isMobile) onMobileOpenChange?.(false);
  }, [currentView, isMobile, onMobileOpenChange]);

  // Custom scroll indicator: thumb scales with content/viewport ratio,
  // position tracks scrollTop. Re-measures on resize and collapse-mode change.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const { scrollHeight, clientHeight, scrollTop } = el;
      if (scrollHeight <= clientHeight + 2) {
        setScroll((s) => ({ ...s, visible: false }));
        return;
      }
      const ratio = clientHeight / scrollHeight;
      const top = (scrollTop / scrollHeight) * 100;
      setScroll({
        thumb: Math.max(ratio * 100, 10),
        top,
        visible: true,
      });
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    // Observe inner content so it re-measures when nav items mount
    const inner = el.firstElementChild;
    if (inner) ro.observe(inner);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [collapsed, isMobile]);

  const handleNav = (id) => {
    onViewChange(id);
    if (isMobile) onMobileOpenChange?.(false);
  };

  const open = isMobile ? !!mobileOpen : true;
  const effectiveCollapsed = isMobile ? false : collapsed;
  const navWidth = isMobile
    ? Math.min(SIDEBAR_WIDTH + 16, 320)
    : effectiveCollapsed
      ? SIDEBAR_COLLAPSED_WIDTH
      : SIDEBAR_WIDTH;

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && open && (
        <div
          onClick={() => onMobileOpenChange?.(false)}
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10, 14, 26, 0.45)',
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
            zIndex: 80,
          }}
        />
      )}

      <nav
        aria-label="Admin navigation"
        style={{
          position: isMobile ? 'fixed' : 'sticky',
          top: 0,
          left: 0,
          width: navWidth,
          height: '100vh',
          background: 'var(--admin-ink)',
          color: '#E2E8F0',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          zIndex: 90,
          transform: isMobile ? `translateX(${open ? '0' : '-110%'})` : 'none',
          transition: isMobile
            ? 'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)'
            : 'width 0.26s cubic-bezier(0.22, 1, 0.36, 1)',
          boxShadow: isMobile && open ? '24px 0 48px rgba(0,0,0,0.25)' : 'none',
        }}
      >
        {/* Brand header — clickable, returns to the dashboard */}
        <button
          type="button"
          onClick={() => handleNav('dashboard')}
          aria-label="Dependable Care — go to dashboard"
          title="Go to dashboard"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: effectiveCollapsed ? 'center' : 'flex-start',
            gap: 12,
            padding: effectiveCollapsed ? '14px 13px' : '14px 18px',
            minHeight: 70,
            flexShrink: 0,
            width: '100%',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            color: 'inherit',
            fontFamily: 'inherit',
            outline: 'none',
          }}
          onFocus={(e) => { e.currentTarget.style.boxShadow = 'inset 0 0 0 2px rgba(96,165,250,0.55)'; }}
          onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Dependable Care logo"
            width={effectiveCollapsed ? 38 : 44}
            height={effectiveCollapsed ? 38 : 44}
            style={{
              display: 'block',
              objectFit: 'contain',
              flexShrink: 0,
            }}
          />
          {!effectiveCollapsed && (
            <div
              style={{
                fontFamily: 'var(--font-fraunces), Georgia, serif',
                fontSize: 18,
                fontWeight: 500,
                color: 'var(--admin-paper)',
                letterSpacing: '-0.015em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.1,
                flex: 1,
                minWidth: 0,
              }}
            >
              Dependable Care
            </div>
          )}
        </button>

        {/* Nav body — sits below the brand header */}
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <div
            ref={scrollRef}
            className="admin-sidebar-scroll"
            style={{
              position: 'absolute',
              inset: 0,
              overflowY: 'auto',
              padding: effectiveCollapsed ? '16px 6px 18px' : '16px 10px 18px',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {NAV_GROUPS.map((group, gi) => (
              <div key={group.section} style={{ marginBottom: effectiveCollapsed ? 10 : 18 }}>
                {effectiveCollapsed ? (
                  gi > 0 && (
                    <div
                      aria-hidden="true"
                      style={{
                        height: 1,
                        background: 'rgba(255,255,255,0.06)',
                        margin: '4px 14px 10px',
                      }}
                    />
                  )
                ) : (
                  <div
                    role="heading"
                    aria-level={2}
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: 'rgba(255,255,255,0.38)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.14em',
                      padding: '0 12px',
                      marginBottom: 6,
                    }}
                  >
                    {group.section}
                  </div>
                )}

                {group.items.map((item) => {
                  const active = currentView === item.id;
                  const badge = badges[item.id];
                  const Icon = item.Icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNav(item.id)}
                      aria-current={active ? 'page' : undefined}
                      title={effectiveCollapsed ? item.label : undefined}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: effectiveCollapsed ? 'center' : 'flex-start',
                        gap: effectiveCollapsed ? 0 : 10,
                        padding: effectiveCollapsed ? '10px 0' : '8px 12px',
                        marginBottom: 2,
                        background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                        border: 'none',
                        borderRadius: 8,
                        cursor: 'pointer',
                        color: active ? 'var(--admin-paper)' : 'rgba(226,232,240,0.78)',
                        textAlign: 'left',
                        fontSize: 13,
                        fontWeight: active ? 600 : 500,
                        position: 'relative',
                        transition: 'background 0.18s ease, color 0.18s ease',
                        outline: 'none',
                        fontFamily: 'inherit',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.boxShadow = '0 0 0 2px rgba(96,165,250,0.55)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                      onMouseEnter={(e) => {
                        if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                      }}
                      onMouseLeave={(e) => {
                        if (!active) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      {/* Active rail */}
                      <span
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          left: effectiveCollapsed ? -6 : -10,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: 3,
                          height: active ? 18 : 0,
                          borderRadius: 2,
                          background: '#60A5FA',
                          transition: 'height 0.2s ease',
                        }}
                      />
                      <Icon
                        size={effectiveCollapsed ? 18 : 16}
                        strokeWidth={active ? 2 : 1.75}
                        style={{ flexShrink: 0, opacity: active ? 1 : 0.85 }}
                      />
                      {!effectiveCollapsed && (
                        <span
                          style={{
                            flex: 1,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.label}
                        </span>
                      )}
                      {!effectiveCollapsed && badge != null && badge > 0 && (
                        <span
                          style={{
                            background: 'var(--admin-danger)',
                            color: 'var(--admin-paper)',
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 999,
                            minWidth: 18,
                            textAlign: 'center',
                            lineHeight: 1.4,
                            flexShrink: 0,
                          }}
                        >
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                      {effectiveCollapsed && badge != null && badge > 0 && (
                        <span
                          aria-hidden="true"
                          style={{
                            position: 'absolute',
                            top: 6,
                            right: 11,
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: 'var(--admin-danger)',
                            boxShadow: '0 0 0 2px var(--admin-ink)',
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Custom scroll indicator — spans top→bottom inside sidebar.
              Thumb height ∝ viewport/content ratio; position tracks scrollTop. */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              right: 4,
              top: 10,
              bottom: 10,
              width: 3,
              borderRadius: 2,
              background: scroll.visible ? 'rgba(255,255,255,0.045)' : 'transparent',
              pointerEvents: 'none',
              opacity: scroll.visible ? 1 : 0,
              transition: 'opacity 0.2s ease',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${scroll.top}%`,
                height: `${scroll.thumb}%`,
                background: 'rgba(96,165,250,0.55)',
                borderRadius: 2,
                boxShadow: '0 0 8px rgba(96,165,250,0.35)',
                transition: 'top 0.05s linear, height 0.22s ease',
              }}
            />
          </div>
        </div>

        {/* Floating sidebar collapse toggle (desktop only) — sits at the
            boundary between brand header (70px) and nav body */}
        {!isMobile && (
          <button
            onClick={() => onCollapsedChange?.(!collapsed)}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            title={collapsed ? 'Expand' : 'Collapse'}
            style={{
              position: 'absolute',
              top: 57,
              right: -13,
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: 'var(--admin-paper)',
              border: '1px solid var(--admin-border)',
              boxShadow: '0 4px 14px rgba(15,23,42,0.18)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--admin-text)',
              zIndex: 100,
              padding: 0,
              transition: 'transform 0.18s ease, box-shadow 0.18s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.boxShadow = '0 6px 18px rgba(15,23,42,0.24)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(15,23,42,0.18)';
            }}
          >
            <ChevronLeft
              size={13}
              strokeWidth={2.25}
              style={{
                transform: collapsed ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.26s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          </button>
        )}
      </nav>

      {/* Hide native scrollbar on the sidebar scroll container */}
      <style jsx global>{`
        .admin-sidebar-scroll::-webkit-scrollbar { display: none; width: 0; height: 0; }
      `}</style>
    </>
  );
}

// Animated hamburger ↔ X — preserves the line-rotate transform from V0
export function MobileMenuButton({ open, onClick }) {
  const lineBase = {
    width: 16,
    height: 2,
    background: 'var(--admin-text)',
    borderRadius: 1,
    position: 'absolute',
    left: 11,
    transition: 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.18s ease',
  };
  return (
    <button
      onClick={onClick}
      aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
      aria-expanded={open}
      style={{
        width: 38,
        height: 38,
        borderRadius: 9,
        background: 'transparent',
        border: '1px solid var(--admin-border)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--admin-text)',
        position: 'relative',
        padding: 0,
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          ...lineBase,
          top: open ? 18 : 13,
          transform: open ? 'rotate(45deg)' : 'none',
        }}
      />
      <span
        aria-hidden="true"
        style={{
          ...lineBase,
          top: 18,
          opacity: open ? 0 : 1,
          transform: open ? 'translateX(-8px)' : 'none',
        }}
      />
      <span
        aria-hidden="true"
        style={{
          ...lineBase,
          top: open ? 18 : 23,
          transform: open ? 'rotate(-45deg)' : 'none',
        }}
      />
    </button>
  );
}

export { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH };
