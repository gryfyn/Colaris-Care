"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  LayoutDashboard, UserPlus, Users, HeartPulse, Settings,
  Pill, BarChart3, ShieldCheck, FileText, CalendarClock, Megaphone, Calendar,
  Search, Bell, Building2, UserCog, Clock3,
  ScrollText, NotebookPen, AlertTriangle, Trash2, DoorOpen, Inbox, UserCircle2,
} from "lucide-react";

/* ── Navigation registry ───────────────────────────────────────────────
   Merges Colaris's screens with an extended nav set. Every item is
   individually toggleable except Settings (pinned). Grouped for clarity. */
export const NAV_GROUPS = [
  {
    group: "Workspace",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/admin/dashboard" },
      { id: "admission", label: "Admission", icon: UserPlus, href: "/admin/admission" },
      { id: "residents", label: "Residents", icon: Users, href: "/admin/residents" },
      { id: "staff", label: "Staff", icon: UserCog, href: "/admin/staff" },
      { id: "care-plans", label: "Care plans", icon: HeartPulse, href: "/admin/care-plans" },
      { id: "medications", label: "Medications", icon: Pill, href: "/admin/medications" },
    ],
  },
  {
    group: "Clinical",
    items: [
      { id: "progress-notes", label: "Progress Notes", icon: NotebookPen, href: "/admin/progress-notes" },
      { id: "incident-reports", label: "Incident Reports", icon: AlertTriangle, href: "/admin/incidents" },
      { id: "drug-disposal", label: "Drug Disposal", icon: Trash2, href: "/admin/drug-disposal" },
      { id: "evacuation-drills", label: "Evacuation Drills", icon: DoorOpen, href: "/admin/evacuation-drills" },
      { id: "reports", label: "Reports", icon: BarChart3, href: "/admin/reports" },
      { id: "compliance", label: "Compliance", icon: ShieldCheck, href: "/admin/compliance" },
      { id: "face-sheets", label: "Face sheets", icon: FileText, href: "/admin/face-sheets" },
    ],
  },
  {
    group: "Facility",
    items: [
      { id: "appointments", label: "Appointments", icon: CalendarClock, href: "/admin/appointments" },
      { id: "announcements", label: "Announcements", icon: Megaphone, href: "/admin/announcements" },
      { id: "admin-notifications", label: "Notifications", icon: Bell, href: "/admin/notifications" },
      { id: "calendar", label: "Calendar", icon: Calendar, href: "/admin/calendar" },
    ],
  },
];
export const NAV_FLAT = NAV_GROUPS.flatMap((g) => g.items);
export const SETTINGS_ITEM = { id: "settings", label: "Settings", icon: Settings, href: "/admin/settings" };

export const STAFF_NAV_GROUPS = [
  {
    group: "Facility",
    items: [
      { id: "staff-dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/staff/dashboard" },
      { id: "staff-residents", label: "Residents", icon: Users, href: "/staff/residents" },
    ],
  },
  {
    group: "Clinical",
    items: [
      { id: "staff-care-plan", label: "Care Plan", icon: ScrollText, href: "/staff/care-plan" },
      { id: "staff-appointments", label: "Appointments", icon: CalendarClock, href: "/staff/appointments" },
      { id: "staff-progress-notes", label: "Progress Notes", icon: NotebookPen, href: "/staff/progress-notes" },
      { id: "staff-medications", label: "Medications", icon: Pill, href: "/staff/medications" },
      { id: "staff-face-sheet", label: "Face Sheet", icon: FileText, href: "/staff/face-sheet" },
      { id: "staff-incidents", label: "Incident Reports", icon: AlertTriangle, href: "/staff/incidents" },
      { id: "staff-drug-disposal", label: "Drug Disposal", icon: Trash2, href: "/staff/drug-disposal" },
      { id: "staff-evacuation", label: "Evacuation Drills", icon: DoorOpen, href: "/staff/evacuation" },
    ],
  },
  {
    group: "Communications",
    items: [
      { id: "staff-announcements", label: "Announcements", icon: Megaphone, href: "/staff/announcements" },
      { id: "staff-notifications", label: "Notifications", icon: Bell, href: "/staff/notifications" },
      { id: "staff-resident-requests", label: "Resident Requests", icon: Inbox, href: "/staff/resident-requests" },
      { id: "staff-calendar", label: "Calendar", icon: Calendar, href: "/staff/calendar" },
      { id: "staff-profile", label: "Profile", icon: UserCircle2, href: "/staff/profile" },
    ],
  },
  {
    group: "System",
    items: [
      { id: "staff-settings", label: "Settings", icon: Settings, href: "/staff/settings" },
    ],
  },
];
export const STAFF_NAV_FLAT = STAFF_NAV_GROUPS.flatMap((group) => group.items);

/* Configurable top-bar elements. */
export const TOPBAR_ITEMS = [
  { id: "facility", label: "Facility switcher", icon: Building2 },
  { id: "search", label: "Global search", icon: Search },
  { id: "notifications", label: "Notifications", icon: Bell },
];

/* Configurable staff top-bar elements (staff-scoped, separate from admin). */
export const STAFF_TOPBAR_ITEMS = [
  { id: "settings", label: "Settings shortcut", icon: Settings },
  { id: "clock", label: "Clock in / out", icon: Clock3 },
];

/* ── Themes (16) — each overrides the .cx- token set via [data-theme] ─── */
export const THEMES = [
  { id: "spruce", label: "Spruce", swatch: ["#EEF2EC", "#0E7C66"] },
  { id: "ocean", label: "Ocean", swatch: ["#EDF1F8", "#2563EB"] },
  { id: "indigo", label: "Indigo", swatch: ["#EFEFF8", "#4F46E5"] },
  { id: "plum", label: "Plum", swatch: ["#F4EEF2", "#9A2F68"] },
  { id: "rose", label: "Rose", swatch: ["#F7EEF0", "#C02672"] },
  { id: "copper", label: "Copper", swatch: ["#F4F0EA", "#A83F68"] },
  { id: "forest", label: "Forest", swatch: ["#ECF1EC", "#2F6B3A"] },
  { id: "sand", label: "Sand", swatch: ["#F5F0E7", "#963663"] },
  { id: "mint", label: "Mint", swatch: ["#EBF6F0", "#18785A"] },
  { id: "lavender", label: "Lavender", swatch: ["#F2EFF8", "#7454A6"] },
  { id: "slate", label: "Slate", swatch: ["#EDF2F5", "#47657D"] },
  { id: "graphite", label: "Graphite", swatch: ["#18211D", "#34D399"], dark: true },
  { id: "midnight", label: "Midnight", swatch: ["#0D1B2A", "#38BDF8"], dark: true },
  { id: "obsidian", label: "Obsidian", swatch: ["#18181B", "#A1A1AA"], dark: true },
  { id: "nocturne", label: "Nocturne", swatch: ["#102421", "#2DD4BF"], dark: true },
  { id: "mulberry", label: "Mulberry", swatch: ["#28151F", "#F06EB1"], dark: true },
];

const STORAGE_KEY = "colaris.prefs.v1";

export function defaultPrefs() {
  const sidebar = {};
  NAV_FLAT.forEach((i) => { sidebar[i.id] = true; });
  const topbar = { facility: true, search: true, notifications: true };
  const staffSidebar = {};
  STAFF_NAV_FLAT.forEach((i) => { staffSidebar[i.id] = true; });
  const staffTopbar = { settings: true, clock: true };
  return { theme: "spruce", sidebar, topbar, staffSidebar, staffTopbar, sidebarCollapsed: false, onboarded: false };
}

const PrefsCtx = createContext(null);
export const usePrefs = () => useContext(PrefsCtx);

export function PrefsProvider({ children }) {
  const [prefs, setPrefs] = useState(defaultPrefs);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        setPrefs((p) => ({
          ...p, ...saved,
          sidebar: { ...p.sidebar, ...saved.sidebar },
          topbar: { ...p.topbar, ...saved.topbar },
          staffSidebar: { ...p.staffSidebar, ...saved.staffSidebar },
          staffTopbar: { ...p.staffTopbar, ...saved.staffTopbar },
        }));
      }
    } catch {}
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch {}
    }
  }, [prefs, mounted]);

  const update = (patch) => setPrefs((p) => ({ ...p, ...patch }));
  const toggleSidebar = (id) => setPrefs((p) => ({ ...p, sidebar: { ...p.sidebar, [id]: !p.sidebar[id] } }));
  const toggleTopbar = (id) => setPrefs((p) => ({ ...p, topbar: { ...p.topbar, [id]: !p.topbar[id] } }));
  const toggleStaffSidebar = (id) => setPrefs((p) => ({ ...p, staffSidebar: { ...p.staffSidebar, [id]: !p.staffSidebar[id] } }));
  const toggleStaffTopbar = (id) => setPrefs((p) => ({ ...p, staffTopbar: { ...p.staffTopbar, [id]: !p.staffTopbar[id] } }));
  const setTheme = (theme) => setPrefs((p) => ({ ...p, theme }));
  const setSidebarCollapsed = (sidebarCollapsed) => setPrefs((p) => ({ ...p, sidebarCollapsed }));
  const finishOnboarding = (patch) => setPrefs((p) => ({ ...p, ...patch, onboarded: true }));
  const resetOnboarding = () => setPrefs((p) => ({ ...p, onboarded: false }));

  return (
    <PrefsCtx.Provider value={{ prefs, mounted, update, toggleSidebar, toggleTopbar, toggleStaffSidebar, toggleStaffTopbar, setTheme, setSidebarCollapsed, finishOnboarding, resetOnboarding }}>
      {children}
    </PrefsCtx.Provider>
  );
}
