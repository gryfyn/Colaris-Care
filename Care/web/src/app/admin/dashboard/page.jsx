"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  ClipboardList,
  FileText,
  HeartPulse,
  MoreVertical,
  Quote,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { Avatar, Badge, PageBand, Panel } from "@/components/ui/data";
import { apiData, displayDate, statusTone } from "@/lib/client-api";
import { useAuthStore } from "@/lib/store/auth-store";

/* Admission statuses that mean the case is finished, so it is not "pending". */
const TERMINAL_ADMISSION_STATUSES = new Set(["accepted", "declined", "closed"]);

const QUICK = [
  { href: "/admin/admission", icon: UserPlus, t: "New admission", s: "Capture intake", hue: "violet" },
  { href: "/admin/daily-records", icon: ClipboardList, t: "Daily records", s: "Log today's care", hue: "blue" },
  { href: "/admin/residents", icon: Users, t: "Residents", s: "Browse directory", hue: "green" },
  { href: "/admin/calendar", icon: CalendarCheck, t: "Schedule", s: "View calendar", hue: "orange" },
];

/* The greeting depends on the browser clock, but this component is server-rendered
   too. Reading the clock during render would mismatch for anyone in a timezone that
   sits in a different part of the day than the server, so the server snapshot is a
   neutral word and the real one is swapped in after hydration. */
const DEFAULT_DAY_PART = "day";
const NEVER_CHANGES = () => () => {};

function dayPart() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function newestFirst(items, field) {
  return [...items].sort((a, b) => {
    const at = Date.parse(a?.[field] || "");
    const bt = Date.parse(b?.[field] || "");
    return (Number.isNaN(bt) ? 0 : bt) - (Number.isNaN(at) ? 0 : at);
  });
}

/* Admissions have no human-readable case number, so derive a short stable ref
   from the uuid rather than inventing a sequential one. */
function admissionRef(admission) {
  const raw = String(admission.admissionCaseId || admission.id || "").replace(/-/g, "");
  return raw ? `#ADM-${raw.slice(0, 8).toUpperCase()}` : "";
}

function StatTile({ icon: Icon, label, value, sub, hue }) {
  return (
    <div className="cx-dash-stat">
      <div className="cx-dash-stat-top">
        <span className="cx-dash-stat-ico" data-hue={hue}><Icon size={23} strokeWidth={2} /></span>
        <span className="cx-dash-stat-lbl">{label}</span>
      </div>
      <div className="cx-dash-stat-val">{value}</div>
      <div className="cx-dash-stat-sub">{sub}</div>
    </div>
  );
}

function RowMenu({ admission, open, onToggle, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!e.target.closest(".cx-dash-menu-wrap")) onClose(); };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <div className="cx-dash-menu-wrap">
      <button type="button" className="cx-dash-kebab" onClick={onToggle}
        aria-label="Admission actions" aria-haspopup="menu" aria-expanded={open}>
        <MoreVertical size={17} />
      </button>
      {open && (
        <div className="cx-dash-menu" role="menu">
          {admission.residentId && (
            <Link role="menuitem" href={`/admin/residents/${admission.residentId}`} onClick={onClose}>View resident</Link>
          )}
          <Link role="menuitem" href="/admin/admission" onClick={onClose}>Open intake</Link>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const part = useSyncExternalStore(NEVER_CHANGES, dayPart, () => DEFAULT_DAY_PART);
  const [openMenu, setOpenMenu] = useState("");
  const [data, setData] = useState({
    residents: [], staff: [], admissions: [], incidents: [], notes: [], facility: null, compliance: null,
  });

  useEffect(() => {
    let alive = true;
    Promise.all([
      apiData("/api/v1/residents").catch(() => []),
      apiData("/api/v1/staff").catch(() => []),
      apiData("/api/v1/admissions").catch(() => []),
      apiData("/api/v1/incidents").catch(() => []),
      apiData("/api/v1/progress-notes").catch(() => []),
      apiData("/api/v1/facility").catch(() => null),
      apiData("/api/v1/compliance").catch(() => null),
    ]).then(([residents, staff, admissions, incidents, notes, facility, compliance]) => {
      if (alive) setData({ residents, staff, admissions, incidents, notes, facility, compliance });
    });
    return () => { alive = false; };
  }, []);

  const firstName = String(user?.displayName || "").trim().split(/\s+/)[0] || "";
  const facilityName = data.facility?.name || "";

  const activeResidents = data.residents.filter((r) => r.status !== "discharged").length;
  const activeStaff = data.staff.filter((s) => s.status === "active").length;
  const pendingAdmissions = data.admissions.filter(
    (a) => !TERMINAL_ADMISSION_STATUSES.has(String(a.status || "").toLowerCase())).length;
  const openIncidents = data.incidents.filter(
    (i) => !["closed", "resolved"].includes(String(i.status || "").toLowerCase())).length;

  const recentAdmissions = useMemo(
    () => newestFirst(data.admissions, "updatedAt").slice(0, 5),
    [data.admissions],
  );

  /* The APIs return no `title` on notes or incidents, and notes date from
     `occurredAt` (not `createdAt`) — read the fields that actually exist. */
  const feed = useMemo(() => {
    const notes = data.notes.map((n) => ({
      key: `note-${n.id}`, icon: FileText, hue: "blue",
      t: "Progress note added",
      s: [n.residentName || "Resident record", n.noteType].filter(Boolean).join(" • "),
      occurredAt: n.occurredAt,
    }));
    const incidents = data.incidents.map((i) => ({
      key: `inc-${i.id}`, icon: AlertTriangle, hue: "red",
      t: "Incident reported",
      s: [i.residentName || "Facility incident", i.incidentType || i.severity].filter(Boolean).join(" • "),
      occurredAt: i.occurredAt,
    }));
    return newestFirst([...notes, ...incidents], "occurredAt").slice(0, 5);
  }, [data.incidents, data.notes]);

  const metrics = [
    { c: "Open follow-ups", v: data.compliance?.incidentFollowUpOpen ?? "—" },
    { c: "Staff certifications", v: data.compliance?.staffCertificationRecords ?? "—" },
    { c: "Audit events (7d)", v: data.compliance?.auditEventsLast7Days ?? "—" },
    { c: "Last evacuation drill", v: data.compliance?.lastEvacuationDrillAt ? displayDate(data.compliance.lastEvacuationDrillAt, "—") : "—" },
  ];

  return (
    <div className="cx-wide cx-dash">
      <PageBand
        title={firstName ? `Good ${part}, ${firstName} 👋` : `Good ${part} 👋`}
        lede={facilityName
          ? <>Here&apos;s what&apos;s happening at <strong>{facilityName}</strong> today.</>
          : "Here's what's happening today."}
      />

      <div className="cx-page-rhythm">
        <div className="cx-stats">
          <StatTile icon={Users} label="Active residents" value={activeResidents} sub={`${data.residents.length} total`} hue="violet" />
          <StatTile icon={HeartPulse} label="Active staff" value={activeStaff} sub={`${data.staff.length} total staff`} hue="green" />
          <StatTile icon={UserPlus} label="Pending admissions" value={pendingAdmissions} sub="Needs review" hue="orange" />
          <StatTile icon={AlertTriangle} label="Open incidents" value={openIncidents} sub="Requires attention" hue="red" />
        </div>

        <section className="cx-dash-quick" aria-label="Quick actions">
          <div className="cx-dash-quick-lbl">
            <strong>Quick actions</strong>
            <span>Frequently used workflows</span>
          </div>
          <div className="cx-dash-quick-items">
            {QUICK.map((q) => {
              const Icon = q.icon;
              return (
                <Link key={q.href} href={q.href} className="cx-dash-quick-item">
                  <span className="cx-dash-quick-ico" data-hue={q.hue}><Icon size={19} /></span>
                  <span>
                    <span className="cx-dash-quick-t">{q.t}</span>
                    <span className="cx-dash-quick-s">{q.s}</span>
                  </span>
                </Link>
              );
            })}
          </div>
          <Link href="/admin/reports" className="cx-dash-quick-all">View all actions <ArrowRight size={16} /></Link>
        </section>

        <div className="cx-cols">
          <Panel title="Recent admissions" action={<Link href="/admin/admission" className="cx-link">View all admissions</Link>}>
            <div className="cx-tblscroll">
              <table className="cx-tbl">
                <thead>
                  <tr>
                    <th>Resident</th><th>Care level</th><th>Status</th>
                    <th className="cx-hide-sm cx-dash-right">Updated</th><th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {recentAdmissions.map((item) => {
                    const name = item.residentName || item.name || "Applicant";
                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="cx-dash-name">
                            <Avatar name={name} round size="md" src={item.photoUrl} />
                            <span>
                              <b>{name}</b>
                              <span className="cx-dash-ref">{admissionRef(item)}</span>
                            </span>
                          </div>
                        </td>
                        <td>{item.careLevel || "Not set"}</td>
                        <td><Badge tone={statusTone(item.status)} dot>{item.status || "Open"}</Badge></td>
                        <td className="cx-hide-sm cx-cellsub cx-tnum cx-dash-right">
                          {displayDate(item.updatedAt || item.submittedAt, "Recent")}
                        </td>
                        <td>
                          <RowMenu
                            admission={item}
                            open={openMenu === item.id}
                            onToggle={() => setOpenMenu(openMenu === item.id ? "" : item.id)}
                            onClose={() => setOpenMenu("")}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {!recentAdmissions.length && <tr><td colSpan={5} className="cx-cellsub">No admission cases found.</td></tr>}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Recent care activity" action={<Link href="/admin/progress-notes" className="cx-link">View all activity</Link>}>
            <div className="cx-feed">
              {feed.map((f) => {
                const Icon = f.icon;
                return (
                  <div className="cx-feed-item" key={f.key}>
                    <span className="cx-feed-ico" data-hue={f.hue}><Icon size={15} /></span>
                    <div className="cx-feed-main">
                      <div className="cx-feed-t">{f.t}</div>
                      <div className="cx-feed-s">{f.s}</div>
                    </div>
                    <span className="cx-feed-time cx-tnum">{displayDate(f.occurredAt, "Recent")}</span>
                  </div>
                );
              })}
              {!feed.length && <div className="cx-cellsub" style={{ padding: 18 }}>No recent care activity found.</div>}
            </div>
          </Panel>
        </div>

        <section className="cx-dash-summary" aria-label="Facility summary">
          <div className="cx-dash-summary-head">
            <span className="cx-dash-summary-badge" data-hue="violet"><ShieldCheck size={22} /></span>
            <strong>Facility<br />summary</strong>
          </div>
          <div className="cx-dash-metrics">
            {metrics.map((m) => (
              <div className="cx-dash-metric" key={m.c}>
                <span>{m.c}</span>
                <strong>{m.v}</strong>
              </div>
            ))}
          </div>
          <blockquote className="cx-dash-quote">
            <Quote size={20} />
            <p>Quality care is not an act, it is a habit.</p>
            <cite>— Aristotle</cite>
          </blockquote>
        </section>
      </div>
    </div>
  );
}
