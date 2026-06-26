"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Check, LayoutGrid, Mail, Palette, UserRound } from "lucide-react";
import { Avatar, Badge, PageHeader, Panel } from "@/components/ui/data";
import { apiData } from "@/lib/client-api";
import { STAFF_NAV_GROUPS, STAFF_TOPBAR_ITEMS, THEMES, usePrefs } from "@/components/app/prefs";

const TABS = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "layout", label: "Layout", icon: LayoutGrid },
  { id: "notifications", label: "Notifications", icon: Bell },
];

const SIDEBAR_PINNED = "staff-settings";

function Switch({ on, onClick, label }) {
  return <button type="button" className="cx-switch" data-on={on ? "true" : "false"} onClick={onClick} aria-pressed={on} aria-label={label} />;
}

export default function StaffSettingsPage() {
  const { prefs, setTheme, toggleStaffSidebar, toggleStaffTopbar } = usePrefs();
  const [active, setActive] = useState("profile");
  const [notifications, setNotifications] = useState({
    assignmentsEmail: true, assignmentsApp: true, incidentsEmail: true, incidentsApp: true,
    announcementsEmail: false, announcementsApp: true, shiftsEmail: true, shiftsApp: true,
  });
  const [profile, setProfile] = useState(null);
  const tabRefs = useRef([]);

  useEffect(() => {
    let alive = true;
    apiData("/api/v1/me/profile").then((payload) => {
      if (alive) setProfile(payload?.profile || null);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const selectTab = (id) => setActive(id);
  const handleTabKey = (event, index) => {
    if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    let next = index;
    if (["ArrowDown", "ArrowRight"].includes(event.key)) next = (index + 1) % TABS.length;
    if (["ArrowUp", "ArrowLeft"].includes(event.key)) next = (index - 1 + TABS.length) % TABS.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = TABS.length - 1;
    selectTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  };

  const profilePanel = <div className="cx-settings-stack">
    <Panel title="Staff profile" action={<Badge tone="green" dot>Active</Badge>} pad>
      <div className="cx-account-card"><Avatar name={profile?.name || "Staff"} round /><div className="cx-account-identity"><strong>{profile?.name || "Staff profile"}</strong><span>{profile?.roleTitle || "Staff"} - {profile?.facilityName || "Facility"}</span></div></div>
      <dl className="cx-meta-list cx-staff-profile-meta">
        <div><dt>Name</dt><dd>{profile?.name || "On file"}</dd></div><div><dt>Role</dt><dd>{profile?.roleTitle || "On file"}</dd></div>
        <div><dt>Email</dt><dd>{profile?.email || "On file"}</dd></div><div><dt>Phone</dt><dd>{profile?.phone || "On file"}</dd></div>
      </dl>
      <p className="cx-settings-help cx-staff-profile-note">Contact a facility manager to change your name, role, or facility assignment.</p>
    </Panel>
  </div>;

  const appearance = <Panel title="Theme" action={<span className="cx-panel-note">Applies instantly</span>} pad>
    {[{ label: "Light", dark: false }, { label: "Dark", dark: true }].map((group) => <div className="cx-theme-group" key={group.label}><div className="cx-theme-group-label">{group.label}</div><div className="cx-swatches">
      {THEMES.filter((theme) => Boolean(theme.dark) === group.dark).map((theme) => <button type="button" key={theme.id} className="cx-swatch" data-on={prefs.theme === theme.id ? "true" : "false"} onClick={() => setTheme(theme.id)} aria-pressed={prefs.theme === theme.id}><div className="cx-swatch-prev" style={{ background: theme.swatch[0] }}><span className="cx-swatch-dot" style={{ background: theme.swatch[1] }} /></div><div className="cx-swatch-lbl">{theme.label}{prefs.theme === theme.id && <Check size={13} className="cx-swatch-check" />}</div></button>)}
    </div></div>)}
  </Panel>;

  const layout = <div className="cx-settings-stack">
    <Panel title="Sidebar sections" pad>
      <p className="cx-settings-help">Choose what appears in your staff sidebar. Settings is always shown.</p>
      {STAFF_NAV_GROUPS.map((group) => {
        const items = group.items.filter((item) => item.id !== SIDEBAR_PINNED);
        if (!items.length) return null;
        return <div key={group.group} className="cx-settings-group"><div className="cx-pick-grp cx-settings-group-title">{group.group}</div><div className="cx-picklist">{items.map((item) => { const Icon = item.icon; const on = prefs.staffSidebar?.[item.id] !== false; return <div key={item.id} className="cx-pick" data-on={on ? "true" : "false"}><span className="cx-pick-ico"><Icon size={15} /></span><span className="cx-pick-lbl">{item.label}</span><Switch on={on} onClick={() => toggleStaffSidebar(item.id)} label={`Toggle ${item.label}`} /></div>; })}</div></div>;
      })}
    </Panel>
    <Panel title="Top bar" pad>
      <p className="cx-settings-help">Controls shown in your top bar.</p>
      {STAFF_TOPBAR_ITEMS.map((item) => { const Icon = item.icon; const on = prefs.staffTopbar?.[item.id] !== false; return <div className="cx-toggle-row" key={item.id}><div className="cx-toggle-lead"><span className="cx-pick-ico" data-on={on ? "true" : "false"}><Icon size={15} /></span><span className="cx-toggle-t">{item.label}</span></div><Switch on={on} onClick={() => toggleStaffTopbar(item.id)} label={`Toggle ${item.label}`} /></div>; })}
    </Panel>
  </div>;

  const notificationsPanel = <Panel title="Notification preferences" action={<Mail size={16} />}><div className="cx-notification-head"><span>Notification</span><span>Email</span><span>In-app</span></div>{[
    { id: "assignments", title: "New assignments", note: "When a shift task or resident workflow is assigned to you." },
    { id: "incidents", title: "Incident alerts", note: "Time-sensitive facility safety updates requiring staff awareness." },
    { id: "announcements", title: "Announcements", note: "New facility notices and team communications." },
    { id: "shifts", title: "Shift reminders", note: "Reminders before an upcoming scheduled shift." },
  ].map((row) => <div className="cx-notification-row" key={row.id}><div><strong>{row.title}</strong><span>{row.note}</span></div><Switch on={notifications[`${row.id}Email`]} onClick={() => setNotifications((value) => ({ ...value, [`${row.id}Email`]: !value[`${row.id}Email`] }))} label={`Email notifications for ${row.title}`} /><Switch on={notifications[`${row.id}App`]} onClick={() => setNotifications((value) => ({ ...value, [`${row.id}App`]: !value[`${row.id}App`] }))} label={`In-app notifications for ${row.title}`} /></div>)}</Panel>;

  const panels = { profile: profilePanel, appearance, layout, notifications: notificationsPanel };
  const activeLabel = TABS.find((tab) => tab.id === active)?.label;

  return <div className="cx-wide cx-settings-page"><PageHeader eyebrow="Personal preferences" title="Settings" lede="Manage your staff profile view, Colaris appearance, and work notifications." />
    <div className="cx-set-cols"><nav className="cx-set-nav" role="tablist" aria-label="Staff settings sections" aria-orientation="vertical">{TABS.map((tab, index) => { const Icon = tab.icon; const selected = active === tab.id; return <button type="button" role="tab" id={`tab-${tab.id}`} aria-controls={`panel-${tab.id}`} aria-selected={selected} tabIndex={selected ? 0 : -1} className={selected ? "on" : undefined} key={tab.id} onClick={() => selectTab(tab.id)} onKeyDown={(event) => handleTabKey(event, index)} ref={(node) => { tabRefs.current[index] = node; }}><Icon size={16} />{tab.label}</button>; })}</nav>
      <main className="cx-settings-detail" id={`panel-${active}`} role="tabpanel" aria-labelledby={`tab-${active}`} tabIndex="0"><div className="cx-mobile-section-label">{activeLabel}</div>{panels[active]}</main>
    </div>
  </div>;
}
