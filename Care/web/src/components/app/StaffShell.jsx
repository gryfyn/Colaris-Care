"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2, LogIn, LogOut, Menu, PanelLeftClose, PanelLeftOpen,
  Settings, UserCircle2,
} from "lucide-react";
import { STAFF_NAV_FLAT, STAFF_NAV_GROUPS, usePrefs } from "./prefs";
import { useAuthGuard } from "./AuthGuard";
import { logout } from "@/lib/client-auth";
import { useAuthStore } from "@/lib/store/auth-store";

// Neutral placeholder used before the auth store hydrates or when there is no
// session. No sample identity — the real name/initials come from the logged-in
// user (see `identity` below).
const STAFF = {
  name: "",
  role: "Caregiver",
  initials: "",
};

// Facility/organization labels for the sidebar context chip. There is no
// facility name on the client session yet, so these stay as neutral
// placeholders rather than a hardcoded sample facility.
const FACILITY_CONTEXT = {
  facilityName: "Facility",
  organizationName: "",
};

const SECTION_SUBTITLES = {
  "staff-dashboard": "Your shift at a glance",
  "staff-residents": "Facility resident directory",
  "staff-care-plan": "Assigned care workflows",
  "staff-appointments": "Resident schedules",
  "staff-progress-notes": "Shift documentation",
  "staff-medications": "Operational rounds",
  "staff-face-sheet": "Resident summaries",
  "staff-incidents": "Safety reporting",
  "staff-drug-disposal": "Disposal records",
  "staff-evacuation": "Emergency readiness",
  "staff-announcements": "Facility updates",
  "staff-notifications": "Your alerts",
  "staff-resident-requests": "Resident follow-up",
  "staff-calendar": "Facility calendar",
  "staff-profile": "Your staff profile",
  "staff-settings": "Personal preferences",
};

/* Settings is pinned — it is always shown in the sidebar regardless of prefs. */
const SIDEBAR_PINNED = "staff-settings";

const ROLE_LABELS = {
  admin: "Administrator", superadmin: "Administrator", manager: "Manager",
  staff: "Caregiver", caregiver: "Caregiver", nurse: "Nurse",
};

function initialsOf(name) {
  if (!name) return "";
  return name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export default function StaffShell({ children }) {
  const [drawer, setDrawer] = useState(false);
  const [clockedIn, setClockedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { prefs, setSidebarCollapsed } = usePrefs();

  // Identity comes from the auth store. Read it only after mount so the server
  // and first client render agree (the store hydrates from localStorage on the
  // client), then fall back to the static STAFF values when there is no session.
  const storeUser = useAuthStore((state) => state.user);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const identity = mounted && storeUser
    ? {
        name: storeUser.displayName || STAFF.name,
        role: ROLE_LABELS[storeUser.role] || STAFF.role,
        initials: initialsOf(storeUser.displayName) || STAFF.initials,
      }
    : STAFF;

  // Re-validate the portal session on mount / bfcache restore so a logged-out
  // user cannot view this staff shell from the back/forward cache.
  useAuthGuard("staff");

  const navRef = useRef(null);
  const menuRef = useRef(null);
  const avatarBtnRef = useRef(null);
  const firstItemRef = useRef(null);
  const [scrollbar, setScrollbar] = useState({ thumb: 0, top: 0, visible: false });

  useLayoutEffect(() => {
    const el = navRef.current;
    if (!el) return;

    const update = () => {
      const { scrollHeight, clientHeight, scrollTop } = el;
      if (scrollHeight <= clientHeight + 2) {
        setScrollbar((current) => current.visible ? { thumb: 0, top: 0, visible: false } : current);
        return;
      }
      const thumb = Math.max((clientHeight / scrollHeight) * 100, 10);
      const top = (scrollTop / scrollHeight) * 100;
      setScrollbar({ thumb, top, visible: true });
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    Array.from(el.children).forEach((child) => observer.observe(child));
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [prefs.sidebarCollapsed, prefs.staffSidebar]);

  // Avatar menu: close on outside-click / Escape, move focus into the menu.
  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (event) => {
      if (menuRef.current?.contains(event.target) || avatarBtnRef.current?.contains(event.target)) return;
      setMenuOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        avatarBtnRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    firstItemRef.current?.focus();
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const current = STAFF_NAV_FLAT.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) || STAFF_NAV_FLAT[0];

  const signOut = async () => {
    setMenuOpen(false);
    await logout();
    router.push("/login");
  };

  const renderLink = (item) => {
    const Icon = item.icon;
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link key={item.id} href={item.href} className={active ? "cx-on" : undefined}
        title={prefs.sidebarCollapsed ? item.label : undefined}
        aria-current={active ? "page" : undefined} onClick={() => setDrawer(false)}>
        <Icon size={17} strokeWidth={1.9} />
        <span className="cx-nav-text">{item.label}</span>
      </Link>
    );
  };

  const showClock = prefs.staffTopbar?.clock !== false;
  const showSettings = prefs.staffTopbar?.settings !== false;

  return (
    <div className="cx-app cx-staff-app" data-theme={prefs.theme} data-drawer={drawer ? "open" : "closed"}
      data-collapsed={prefs.sidebarCollapsed ? "true" : "false"}>
      <div className="cx-shell">
        <aside className="cx-side">
          <div className="cx-brand">
            <Link href="/staff/dashboard" className="cx-brand-link" aria-label="Colaris Care staff dashboard" onClick={() => setDrawer(false)}>
              <Image className="cx-brand-mark" src="/colarislogo.png" alt="Colaris Care" width={40} height={40} />
              <div className="cx-brand-copy">
                <div className="cx-brand-name">Colaris Care</div>
                <div className="cx-brand-tag">Staff Portal</div>
              </div>
            </Link>
            <button className="cx-collapse" type="button" onClick={() => setSidebarCollapsed(!prefs.sidebarCollapsed)}
              aria-label={prefs.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={prefs.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
              {prefs.sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            </button>
          </div>

          <div className="cx-staff-context">
            <div className="cx-staff-facility" title={[FACILITY_CONTEXT.facilityName, FACILITY_CONTEXT.organizationName].filter(Boolean).join(" · ")}>
              <Building2 size={15} />
              <div className="cx-user-copy"><strong>{FACILITY_CONTEXT.facilityName}</strong>{FACILITY_CONTEXT.organizationName && <span>{FACILITY_CONTEXT.organizationName}</span>}</div>
            </div>
          </div>

          <div className="cx-nav-scroll">
            <nav className="cx-nav" aria-label="Staff navigation" ref={navRef}>
              {STAFF_NAV_GROUPS.map((group) => {
                const visible = group.items.filter((item) => item.id === SIDEBAR_PINNED || prefs.staffSidebar?.[item.id] !== false);
                if (!visible.length) return null;
                return <div key={group.group}>
                  <div className="cx-nav-label">{group.group}</div>
                  {visible.map(renderLink)}
                </div>;
              })}
            </nav>
            {scrollbar.visible && <div className="cx-nav-rail" aria-hidden="true">
              <div className="cx-nav-thumb" style={{ top: `${scrollbar.top}%`, height: `${scrollbar.thumb}%` }} />
            </div>}
          </div>
        </aside>

        <div className="cx-main">
          <header className="cx-top">
            <button type="button" className="cx-hamb" aria-label="Open staff menu" aria-expanded={drawer} onClick={() => setDrawer(true)}><Menu size={18} /></button>
            <div><div className="cx-top-title">{current.label}</div><div className="cx-top-sub">{SECTION_SUBTITLES[current.id]}</div></div>
            <div className="cx-top-right">
              {showClock && (
                <button type="button" className="cx-facility cx-staff-clock-btn" data-on={clockedIn ? "true" : "false"}
                  onClick={() => setClockedIn((value) => !value)} aria-pressed={clockedIn}
                  title={clockedIn ? "Clock out" : "Clock in"}>
                  <span className="cx-dot" />
                  {clockedIn ? <LogOut size={15} strokeWidth={2} /> : <LogIn size={15} strokeWidth={2} />}
                  <span className="cx-clock-label">{clockedIn ? "Clocked in" : "Clock in"}</span>
                </button>
              )}
              {showSettings && (
                <Link href="/staff/settings" className="cx-facility cx-icon-btn" aria-label="Settings" title="Settings">
                  <Settings size={15} strokeWidth={2} />
                </Link>
              )}
              <div className="cx-avatar-menu">
                <button ref={avatarBtnRef} type="button" className="cx-avatar-btn"
                  aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Account menu"
                  onClick={() => setMenuOpen((open) => !open)}>
                  <span className="cx-avatar">{identity.initials}</span>
                </button>
                {menuOpen && (
                  <div className="cx-avatar-pop" role="menu" aria-label="Account" ref={menuRef}>
                    <div className="cx-avatar-pop-head">
                      <span className="cx-avatar">{identity.initials}</span>
                      <div><strong>{identity.name}</strong><span>{identity.role}</span></div>
                    </div>
                    <Link ref={firstItemRef} role="menuitem" href="/staff/profile" className="cx-avatar-item" onClick={() => setMenuOpen(false)}>
                      <UserCircle2 size={16} /> View profile
                    </Link>
                    <button type="button" role="menuitem" className="cx-avatar-item" onClick={signOut}>
                      <LogOut size={16} /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>
          <main className="cx-content">{children}</main>
        </div>
      </div>
      <div className="cx-scrim" onClick={() => setDrawer(false)} aria-hidden="true" />
    </div>
  );
}
