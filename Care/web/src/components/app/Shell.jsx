"use client";

import { useEffect, useState, useRef, useLayoutEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu, ChevronDown, Building2, Search, Bell, LogOut,
  PanelLeftClose, PanelLeftOpen, Settings,
} from "lucide-react";
import { usePrefs, NAV_GROUPS, NAV_FLAT, SETTINGS_ITEM } from "./prefs";
import Onboarding from "./Onboarding";
import { useAuthGuard } from "./AuthGuard";
import { logout } from "@/lib/client-auth";
import { useAuthStore } from "@/lib/store/auth-store";
import { useUnreadCount } from "@/lib/use-unread";

const SUBS = {
  dashboard: "Facility overview", admission: "New resident intake", residents: "Resident directory",
  staff: "Team directory", "care-plans": "Plans & reviews", medications: "Medication management",
  "daily-records": "Proof of care", reports: "Insights & exports", compliance: "Audit readiness",
  "face-sheets": "Resident summaries", appointments: "Scheduling", announcements: "Facility notices",
  calendar: "Shared calendar", settings: "Facility configuration",
  "admin-notifications": "Facility alerts", "progress-notes": "Clinical documentation",
  "incident-reports": "Safety review", "drug-disposal": "Medication accountability",
  "evacuation-drills": "Emergency readiness",
};

// Neutral placeholder used before the auth store hydrates or when there is no
// session. No sample identity — the real name/initials come from the logged-in
// user (see `identity` below).
const ADMIN = { name: "", role: "Administrator", initials: "" };

const ROLE_LABELS = {
  admin: "Administrator", superadmin: "Administrator", manager: "Manager",
  staff: "Caregiver", caregiver: "Caregiver", nurse: "Nurse",
};

function initialsOf(name) {
  if (!name) return "";
  return name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export default function Shell({ children }) {
  const [drawer, setDrawer] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { prefs, setSidebarCollapsed } = usePrefs();

  // Identity comes from the auth store. Read it only after mount so the server
  // and first client render agree (the store hydrates from localStorage on the
  // client), then fall back to the static ADMIN values when there is no session.
  const storeUser = useAuthStore((state) => state.user);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const identity = mounted && storeUser
    ? {
        name: storeUser.displayName || ADMIN.name,
        role: ROLE_LABELS[storeUser.role] || ADMIN.role,
        initials: initialsOf(storeUser.displayName) || ADMIN.initials,
      }
    : ADMIN;

  // Re-validate the portal session on mount / bfcache restore so a logged-out
  // user cannot view this admin shell from the back/forward cache.
  useAuthGuard("admin");

  // Custom JS-driven scroll indicator for the sidebar nav (custom sidebar scroll indicator).
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
        setScrollbar((s) => (s.visible ? { thumb: 0, top: 0, visible: false } : s));
        return;
      }
      const thumb = Math.max((clientHeight / scrollHeight) * 100, 10);
      const top = (scrollTop / scrollHeight) * 100;
      setScrollbar({ thumb, top, visible: true });
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    // Also watch the inner content so item show/hide and collapse recalc the thumb.
    Array.from(el.children).forEach((child) => ro.observe(child));

    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [prefs.sidebarCollapsed, prefs.sidebar]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocumentClick = (event) => {
      if (menuRef.current?.contains(event.target) || avatarBtnRef.current?.contains(event.target)) return;
      setMenuOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        avatarBtnRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("keydown", onKeyDown);
    firstItemRef.current?.focus();
    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const all = [...NAV_FLAT, SETTINGS_ITEM];
  const current = all.find((i) => pathname === i.href || pathname.startsWith(i.href + "/")) || NAV_FLAT[0];
  const unread = useUnreadCount();

  const renderLink = (item) => {
    const Icon = item.icon;
    const active = pathname === item.href || pathname.startsWith(item.href + "/");
    const badge = item.id === "admin-notifications" && unread > 0 ? unread : null;
    return (
      <Link key={item.id} href={item.href} className={active ? "cx-on" : undefined}
        title={prefs.sidebarCollapsed ? item.label : undefined}
        aria-current={active ? "page" : undefined} onClick={() => setDrawer(false)}>
        <Icon size={17} strokeWidth={1.9} />
        <span className="cx-nav-text">{item.label}</span>
        {badge != null && <span className="cx-nav-badge" aria-label={`${badge} unread`}>{badge > 99 ? "99+" : badge}</span>}
      </Link>
    );
  };

  const signOut = async () => {
    setMenuOpen(false);
    await logout();
    router.push("/login");
  };

  return (
    <div className="cx-app" data-theme={prefs.theme} data-drawer={drawer ? "open" : "closed"}
      data-collapsed={prefs.sidebarCollapsed ? "true" : "false"}>
      <div className="cx-shell">
        <aside className="cx-side">
          <div className="cx-brand">
            <Image
              className="cx-brand-mark"
              src="/colarislogo.png"
              alt="Colaris Care - Care Simplified"
              width={40}
              height={40}
            />
            <div className="cx-brand-copy">
              <div className="cx-brand-name">Colaris Care</div>
              <div className="cx-brand-tag">Care Simplified</div>
            </div>
            <button className="cx-collapse" type="button"
              onClick={() => setSidebarCollapsed(!prefs.sidebarCollapsed)}
              aria-label={prefs.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={prefs.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
              {prefs.sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            </button>
          </div>

          <div className="cx-nav-scroll">
            <nav className="cx-nav" aria-label="Primary" ref={navRef}>
              {NAV_GROUPS.map((g) => {
                const visible = g.items.filter((i) => prefs.sidebar[i.id] !== false);
                if (!visible.length) return null;
                return (
                  <div key={g.group}>
                    <div className="cx-nav-label">{g.group}</div>
                    {visible.map(renderLink)}
                  </div>
                );
              })}
              <div className="cx-nav-label">System</div>
              {renderLink(SETTINGS_ITEM)}
            </nav>
            {scrollbar.visible && (
              <div className="cx-nav-rail" aria-hidden="true">
                <div className="cx-nav-thumb"
                  style={{ top: `${scrollbar.top}%`, height: `${scrollbar.thumb}%` }} />
              </div>
            )}
          </div>

        </aside>

        <div className="cx-main">
          <header className="cx-top">
            <button className="cx-hamb" aria-label="Open menu" onClick={() => setDrawer(true)}>
              <Menu size={18} />
            </button>
            <div>
              <div className="cx-top-title">{current.label}</div>
              <div className="cx-top-sub">{SUBS[current.id] || ""}</div>
            </div>
            <div className="cx-top-right">
              {prefs.topbar.search && (
                <button className="cx-facility cx-icon-btn" type="button" aria-label="Search" title="Search">
                  <Search size={15} strokeWidth={2} />
                </button>
              )}
              {prefs.topbar.notifications && (
                <Link href="/admin/notifications" className="cx-facility cx-icon-btn cx-bell" aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"} title="Notifications">
                  <Bell size={15} strokeWidth={2} />
                  {unread > 0 && <span className="cx-bell-dot" aria-hidden="true" />}
                </Link>
              )}
              <Link href="/admin/settings" className="cx-facility cx-icon-btn" aria-label="Settings" title="Settings">
                <Settings size={15} strokeWidth={2} />
              </Link>
              {prefs.topbar.facility && (
                <button className="cx-facility" type="button">
                  <span className="cx-dot" />
                  <Building2 size={14} strokeWidth={1.9} />
                  Facility
                  <ChevronDown size={14} strokeWidth={2} />
                </button>
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
                    <Link ref={firstItemRef} role="menuitem" href="/admin/settings" className="cx-avatar-item" onClick={() => setMenuOpen(false)}>
                      <Settings size={16} /> Settings
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
      <Onboarding />
    </div>
  );
}
