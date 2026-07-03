"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bell, Building2, Check, CreditCard, KeyRound, LayoutGrid, LogOut,
  Monitor, Palette, RotateCcw, Search, Shield, ShieldCheck,
  SlidersHorizontal, UserCheck, UserPlus, Users, UserX,
} from "lucide-react";
import { Avatar, Badge, PageHeader, Panel } from "@/components/ui/data";
import { SelectField, TextField } from "@/components/ui/fields";
import { apiData } from "@/lib/client-api";
import { NAV_GROUPS, THEMES, TOPBAR_ITEMS, usePrefs } from "@/components/app/prefs";

const ROLES = ["Super Admin", "Facility Admin", "Manager", "Nurse", "Caregiver", "Family Member"];
const SESSIONS = [
  { device: "Chrome on Windows", location: "Portland, OR", active: "Current session", current: true },
];
const SIGN_INS = [
  { event: "Successful sign-in", device: "Chrome on Windows - Portland, OR", time: "Today, 9:42 AM", tone: "green" },
  { event: "Two-factor challenge completed", device: "Safari on iPhone - Portland, OR", time: "Yesterday, 6:14 PM", tone: "blue" },
  { event: "Unsuccessful password attempt", device: "Chrome on Windows - Portland, OR", time: "Jun 21, 8:03 AM", tone: "red" },
];
const ROLE_TONES = { "Super Admin": "blue", "Facility Admin": "green", Manager: "amber", Nurse: "blue", Caregiver: "gray", "Family Member": "gray" };
const STATUS_TONES = { Active: "green", Invited: "blue", Suspended: "gray", Paid: "green", Refunded: "blue", Failed: "red" };
const TABS = [
  { id: "facility", label: "Facility", icon: Building2 },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "layout", label: "Layout", icon: LayoutGrid },
  { id: "account", label: "Account management", icon: Users },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { id: "roles", label: "Roles & access", icon: Shield },
  { id: "billing", label: "Billing & payments", icon: CreditCard },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security & sessions", icon: ShieldCheck },
];

function Switch({ on, onClick, label }) {
  return <button type="button" className="cx-switch" data-on={on ? "true" : "false"} onClick={onClick} aria-pressed={on} aria-label={label} />;
}

export default function SettingsPage() {
  const { prefs, setTheme, toggleSidebar, toggleTopbar, resetOnboarding } = usePrefs();
  const [active, setActive] = useState("facility");
  const tabRefs = useRef([]);
  const [f, setF] = useState({ name: "", legal: "", address: "", phone: "", email: "", timezone: "America/New_York", capacity: "" });
  const [prefsLocal, setPrefsLocal] = useState({ fallRisk: true, requireContact: false, twoFactor: true });
  const [notifications, setNotifications] = useState({ admissionsEmail: true, admissionsApp: true, incidentsEmail: true, incidentsApp: true, summaryEmail: true, summaryApp: false, receiptsEmail: true, receiptsApp: false });
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [me, setMe] = useState(null);
  const [sessions, setSessions] = useState(SESSIONS);

  useEffect(() => {
    let alive = true;
    Promise.all([
      apiData("/api/v1/staff").catch(() => []),
      apiData("/api/auth/me").catch(() => null),
      apiData("/api/v1/facility").catch(() => null),
    ]).then(([staff, auth, facility]) => {
      if (!alive) return;
      setAccounts(staff.map((item) => ({ id: item.id, name: item.name, email: item.email, role: item.roleTitle || "Staff", status: item.status === "inactive" ? "Suspended" : "Active", lastActive: item.updatedAt ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(item.updatedAt)) : "Recent" })));
      setMe(auth?.user || null);
      // Populate the Facility tab (and toggles) from the data captured at
      // onboarding + saved on this page. Falls back to blanks, not fake data.
      if (facility && facility.id) {
        setF((state) => ({
          name: facility.name || "",
          legal: facility.legalName || "",
          address: facility.address || "",
          phone: facility.phone || "",
          email: facility.email || "",
          timezone: facility.timezone || state.timezone,
          capacity: facility.licensedCapacity != null ? String(facility.licensedCapacity) : "",
        }));
        if (facility.notifications && typeof facility.notifications === "object") setNotifications((n) => ({ ...n, ...facility.notifications }));
        if (facility.preferences && typeof facility.preferences === "object") setPrefsLocal((p) => ({ ...p, ...facility.preferences }));
      }
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const fromHash = window.location.hash.slice(1);
    if (TABS.some((tab) => tab.id === fromHash)) {
      const timer = window.setTimeout(() => setActive(fromHash), 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  const set = (key) => (value) => setF((state) => ({ ...state, [key]: value }));
  const toggleLocal = (key) => setPrefsLocal((state) => ({ ...state, [key]: !state[key] }));
  const toggleNotification = (key) => setNotifications((state) => ({ ...state, [key]: !state[key] }));
  const visibleAccounts = accounts.filter((account) => [account.name, account.email, account.role, account.status].some((value) => value.toLowerCase().includes(accountSearch.toLowerCase())));
  const selectTab = (id) => {
    setActive(id);
    window.history.replaceState(null, "", `#${id}`);
  };
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
  const toggleAccount = (id) => setAccounts((rows) => rows.map((row) => row.id === id ? { ...row, status: row.status === "Active" ? "Suspended" : "Active" } : row));

  const save = async () => {
    setSaveError("");
    try {
      await apiData("/api/v1/facility", {
        method: "PATCH",
        body: JSON.stringify({
          name: f.name,
          legalName: f.legal,
          address: f.address,
          phone: f.phone,
          email: f.email,
          timezone: f.timezone,
          licensedCapacity: f.capacity === "" ? null : Number(f.capacity),
          notifications,
          preferences: prefsLocal,
        }),
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(err.message || "Could not save changes.");
    }
  };

  // Theme is a facility-level choice — persist it so it follows the team across
  // devices (and matches what was picked at onboarding).
  const chooseTheme = async (id) => {
    setTheme(id);
    try { await apiData("/api/v1/facility", { method: "PATCH", body: JSON.stringify({ theme: id }) }); } catch { /* local theme still applied */ }
  };

  const facility = <Panel title="Facility profile" pad><div className="cx-grid">
    <TextField label="Facility name" value={f.name} onChange={set("name")} /><TextField label="Legal name" optional value={f.legal} onChange={set("legal")} />
    <TextField label="Address" span2 value={f.address} onChange={set("address")} /><TextField label="Phone" type="tel" value={f.phone} onChange={set("phone")} />
    <TextField label="Email" type="email" value={f.email} onChange={set("email")} /><SelectField label="Time zone" value={f.timezone} onChange={set("timezone")} options={["America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York"]} />
    <TextField label="Licensed capacity" type="number" value={f.capacity} onChange={set("capacity")} />
  </div></Panel>;

  const appearance = <Panel title="Theme" action={<span className="cx-panel-note">Applies instantly</span>} pad>
    {[{ label: "Light", dark: false }, { label: "Dark", dark: true }].map((group) => <div className="cx-theme-group" key={group.label}><div className="cx-theme-group-label">{group.label}</div><div className="cx-swatches">
      {THEMES.filter((theme) => Boolean(theme.dark) === group.dark).map((theme) => <button type="button" key={theme.id} className="cx-swatch" data-on={prefs.theme === theme.id ? "true" : "false"} onClick={() => chooseTheme(theme.id)} aria-pressed={prefs.theme === theme.id}><div className="cx-swatch-prev" style={{ background: theme.swatch[0] }}><span className="cx-swatch-dot" style={{ background: theme.swatch[1] }} /></div><div className="cx-swatch-lbl">{theme.label}{prefs.theme === theme.id && <Check size={13} className="cx-swatch-check" />}</div></button>)}
    </div></div>)}
  </Panel>;

  const layout = <div className="cx-settings-stack"><Panel title="Sidebar sections" action={<button type="button" className="cx-btn cx-btn-ghost cx-btn-compact" onClick={resetOnboarding}><RotateCcw size={13} /> Replay setup</button>} pad>
    <p className="cx-settings-help">Choose what appears in the sidebar. Settings is always shown.</p>
    {NAV_GROUPS.map((group) => <div key={group.group} className="cx-settings-group"><div className="cx-pick-grp cx-settings-group-title">{group.group}</div><div className="cx-picklist">{group.items.map((item) => { const Icon = item.icon; const on = prefs.sidebar[item.id] !== false; return <div key={item.id} className="cx-pick" data-on={on ? "true" : "false"}><span className="cx-pick-ico"><Icon size={15} /></span><span className="cx-pick-lbl">{item.label}</span><Switch on={on} onClick={() => toggleSidebar(item.id)} label={`Toggle ${item.label}`} /></div>; })}</div></div>)}
  </Panel><Panel title="Top bar" pad><p className="cx-settings-help">Controls shown in the top bar.</p>{TOPBAR_ITEMS.map((item) => { const Icon = item.icon; const on = prefs.topbar[item.id] !== false; return <div className="cx-toggle-row" key={item.id}><div className="cx-toggle-lead"><span className="cx-pick-ico" data-on={on ? "true" : "false"}><Icon size={15} /></span><span className="cx-toggle-t">{item.label}</span></div><Switch on={on} onClick={() => toggleTopbar(item.id)} label={`Toggle ${item.label}`} /></div>; })}</Panel></div>;

  const current = me?.role || "Nurse";
  const account = <div className="cx-account-section"><div className="cx-section-intro"><h2>Account management</h2><p>Manage your profile and facility access without exposing sensitive resident information.</p></div>
    <Panel title="Your account" pad><div className="cx-account-card"><Avatar name={me?.name || "Current user"} round /><div className="cx-account-identity"><strong>{me?.name || "Current user"}</strong><span>{me?.email || "Signed-in account"}</span></div><Badge tone="blue">{current}</Badge><div className="cx-account-actions"><button type="button" className="cx-btn cx-btn-ghost"><KeyRound size={14} /> Change password</button><button type="button" className="cx-btn cx-btn-quiet"><LogOut size={14} /> Sign out</button></div></div></Panel>
    <Panel title="User accounts" action={<button type="button" className="cx-btn cx-btn-primary"><UserPlus size={15} /> Invite user</button>}><div className="cx-account-toolbar"><div className="cx-search"><Search size={15} /><input value={accountSearch} onChange={(event) => setAccountSearch(event.target.value)} placeholder="Search users, roles, or status" aria-label="Search user accounts" /></div><span>{visibleAccounts.length} {visibleAccounts.length === 1 ? "account" : "accounts"}</span></div><div className="cx-tblscroll" tabIndex="0" aria-label="Scrollable user accounts table"><table className="cx-tbl"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last active</th><th><span className="cx-sr-only">Actions</span></th></tr></thead><tbody>{visibleAccounts.map((user) => <tr key={user.id}><td><div className="cx-cellname"><Avatar name={user.name} sm /><b>{user.name}</b></div></td><td>{user.email}</td><td><Badge tone={ROLE_TONES[user.role]}>{user.role}</Badge></td><td><Badge tone={STATUS_TONES[user.status]} dot>{user.status}</Badge></td><td className="cx-account-last">{user.lastActive}</td><td><div className="cx-row-actions"><button type="button" className="cx-btn cx-btn-quiet" title={`Reset password for ${user.name}`}><KeyRound size={14} /> Reset password</button><button type="button" className="cx-btn cx-btn-quiet" onClick={() => toggleAccount(user.id)}>{user.status === "Active" ? <UserX size={14} /> : <UserCheck size={14} />}{user.status === "Active" ? "Deactivate" : "Activate"}</button></div></td></tr>)}{!visibleAccounts.length && <tr><td colSpan="6" className="cx-account-empty">No accounts match your search.</td></tr>}</tbody></table></div></Panel>
  </div>;

  const preferences = <Panel title="Preferences" pad>{[
    { k: "fallRisk", t: "Require fall-risk on admission", s: "Make the nursing fall-risk flag mandatory before an admission can be saved." },
    { k: "requireContact", t: "Require a primary contact", s: "Block admission without at least one contact name." },
    { k: "twoFactor", t: "Two-factor for staff sign-in", s: "Require a second factor for all staff accounts." },
  ].map((row) => <div className="cx-toggle-row" key={row.k}><div><div className="cx-toggle-t">{row.t}</div><div className="cx-toggle-s">{row.s}</div></div><Switch on={prefsLocal[row.k]} onClick={() => toggleLocal(row.k)} label={row.t} /></div>)}</Panel>;

  const roles = <Panel title="Roles & access" pad><p className="cx-settings-help">Six built-in roles scope what each person can see and do, within this facility only.</p><div className="cx-role-list">{ROLES.map((role) => <Badge key={role}><span className="cx-bdot cx-role-dot" />{role}</Badge>)}</div></Panel>;

  const billing = <Panel title="Billing & payments" pad>
    <div className="cx-empty2">
      <div className="cx-empty-ico"><CreditCard size={22} strokeWidth={1.9} /></div>
      <h3>Billing is coming soon</h3>
      <p>Plans, invoices, and payment methods will be available here shortly. Your facility is fully active in the meantime — no action is needed.</p>
      <Badge tone="blue" dot>Module coming soon</Badge>
    </div>
  </Panel>;

  const notificationRows = [
    { id: "admissions", title: "New admissions", note: "When a new resident admission is started or completed." },
    { id: "incidents", title: "Incident alerts", note: "Time-sensitive alerts when an incident is reported." },
    { id: "summary", title: "Daily summary", note: "A daily digest of facility activity and tasks." },
    { id: "receipts", title: "Billing receipts", note: "Receipts, failed payments, and plan changes." },
  ];
  const notificationsPanel = <Panel title="Notification preferences"><div className="cx-notification-head"><span>Notification</span><span>Email</span><span>In-app</span></div>{notificationRows.map((row) => <div className="cx-notification-row" key={row.id}><div><strong>{row.title}</strong><span>{row.note}</span></div><Switch on={notifications[`${row.id}Email`]} onClick={() => toggleNotification(`${row.id}Email`)} label={`Email notifications for ${row.title}`} /><Switch on={notifications[`${row.id}App`]} onClick={() => toggleNotification(`${row.id}App`)} label={`In-app notifications for ${row.title}`} /></div>)}</Panel>;

  const security = <div className="cx-settings-stack"><Panel title="Sign-in security" pad><div className="cx-toggle-row"><div><div className="cx-toggle-t">Two-factor authentication</div><div className="cx-toggle-s">Require a verification code in addition to a password for staff sign-in.</div></div><Switch on={prefsLocal.twoFactor} onClick={() => toggleLocal("twoFactor")} label="Two-factor authentication" /></div></Panel>
    <Panel title="Active sessions"><div className="cx-list">{sessions.map((session) => <div className="cx-session-row" key={`${session.device}-${session.active}`}><span className="cx-list-icon"><Monitor size={17} /></span><div><strong>{session.device}</strong><span>{session.location} - {session.active}</span></div>{session.current ? <Badge tone="green" dot>Current</Badge> : <button type="button" className="cx-btn cx-btn-quiet" onClick={() => setSessions((items) => items.filter((item) => item !== session))}>Sign out</button>}</div>)}</div></Panel>
    <Panel title="Recent sign-in activity"><div className="cx-list">{SIGN_INS.map((entry) => <div className="cx-activity-row" key={`${entry.event}-${entry.time}`}><span className={`cx-activity-dot is-${entry.tone}`} /><div><strong>{entry.event}</strong><span>{entry.device}</span></div><time>{entry.time}</time></div>)}</div></Panel>
  </div>;

  const panels = { facility, appearance, layout, account, preferences, roles, billing, notifications: notificationsPanel, security };
  const activeLabel = TABS.find((tab) => tab.id === active)?.label;

  return <div className="cx-wide cx-settings-page"><PageHeader eyebrow="Configuration" title="Settings" lede="Your facility's identity, appearance, and how Colaris behaves for your team." action={<div style={{ display: "flex", alignItems: "center", gap: 10 }}>{saveError && <span style={{ fontSize: 12.5, color: "var(--cx-danger, #b42318)" }}>{saveError}</span>}<button type="button" className="cx-btn cx-btn-primary" onClick={save}>{saved ? <><Check size={15} /> Saved</> : "Save changes"}</button></div>} />
    <div className="cx-set-cols"><nav className="cx-set-nav" role="tablist" aria-label="Settings sections" aria-orientation="vertical">{TABS.map((tab, index) => { const Icon = tab.icon; const selected = active === tab.id; return <button type="button" role="tab" id={`tab-${tab.id}`} aria-controls={`panel-${tab.id}`} aria-selected={selected} tabIndex={selected ? 0 : -1} className={selected ? "on" : undefined} key={tab.id} onClick={() => selectTab(tab.id)} onKeyDown={(event) => handleTabKey(event, index)} ref={(node) => { tabRefs.current[index] = node; }}><Icon size={16} />{tab.label}</button>; })}</nav>
      <main className="cx-settings-detail" id={`panel-${active}`} role="tabpanel" aria-labelledby={`tab-${active}`} tabIndex="0"><div className="cx-mobile-section-label">{activeLabel}</div>{panels[active]}</main>
    </div>
  </div>;
}
