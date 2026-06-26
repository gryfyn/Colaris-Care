"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarCheck, ClipboardList, FileText, HeartPulse, ShieldCheck, UserPlus, Users } from "lucide-react";
import { Avatar, Badge, PageHeader, Panel, StatCard } from "@/components/ui/data";
import { apiData, displayDate, statusTone } from "@/lib/client-api";

const QUICK = [
  { href: "/admin/admission", icon: UserPlus, t: "New admission", s: "Capture intake basics" },
  { href: "/admin/daily-records", icon: ClipboardList, t: "Daily records", s: "Today's proof of care" },
  { href: "/admin/residents", icon: Users, t: "Residents", s: "Browse the directory" },
];

export default function DashboardPage() {
  const [data, setData] = useState({ residents: [], staff: [], admissions: [], incidents: [], notes: [] });

  useEffect(() => {
    let alive = true;
    Promise.all([
      apiData("/api/v1/residents").catch(() => []),
      apiData("/api/v1/staff").catch(() => []),
      apiData("/api/v1/admissions").catch(() => []),
      apiData("/api/v1/incidents").catch(() => []),
      apiData("/api/v1/progress-notes").catch(() => []),
    ]).then(([residents, staff, admissions, incidents, notes]) => {
      if (alive) setData({ residents, staff, admissions, incidents, notes });
    });
    return () => { alive = false; };
  }, []);

  const activeResidents = data.residents.filter((resident) => resident.status !== "discharged").length;
  const openIncidents = data.incidents.filter((incident) => !["closed", "resolved"].includes(String(incident.status || "").toLowerCase())).length;
  const pendingAdmissions = data.admissions.filter((admission) => !["accepted", "declined", "closed"].includes(String(admission.status || "").toLowerCase())).length;
  const recentAdmissions = data.admissions.slice(0, 5);
  const feed = useMemo(() => [
    ...data.notes.slice(0, 3).map((note) => ({ icon: FileText, tone: "blue", t: note.title || "Progress note added", s: note.residentName || "Resident record", time: displayDate(note.createdAt || note.updatedAt, "Recent") })),
    ...data.incidents.slice(0, 3).map((incident) => ({ icon: AlertTriangle, tone: statusTone(incident.status), t: incident.title || "Incident report", s: incident.residentName || incident.severity || "Facility incident", time: displayDate(incident.occurredAt || incident.createdAt, "Recent") })),
  ].slice(0, 5), [data.incidents, data.notes]);

  return (
    <div className="cx-wide">
      <PageHeader eyebrow="Overview" title="Facility dashboard" lede="Live admissions, census, staffing, and care activity for the current facility." />

      <div className="cx-stats">
        <StatCard icon={Users} label="Active residents" value={activeResidents} delta={`${data.residents.length} total`} deltaDir="up" />
        <StatCard icon={HeartPulse} label="Staff records" value={data.staff.length} delta="directory" deltaDir="up" />
        <StatCard icon={UserPlus} label="Pending admissions" value={pendingAdmissions} delta="needs review" deltaDir={pendingAdmissions ? "down" : "up"} />
        <StatCard icon={AlertTriangle} label="Open incidents" value={openIncidents} delta="follow-up" deltaDir={openIncidents ? "down" : "up"} />
      </div>

      <div className="cx-actions-row">
        {QUICK.map((q) => {
          const Icon = q.icon;
          return <Link key={q.href} href={q.href} className="cx-action"><span className="cx-action-ico"><Icon size={18} /></span><span><span className="cx-action-t">{q.t}</span><span className="cx-action-s">{q.s}</span></span><ArrowRight size={17} color="var(--cx-faint)" style={{ marginLeft: "auto" }} /></Link>;
        })}
      </div>

      <div className="cx-cols cx-mt">
        <Panel title="Recent admissions" action={<Link href="/admin/admission" className="cx-link">Open intake</Link>}>
          <div className="cx-tblscroll"><table className="cx-tbl"><thead><tr><th>Resident</th><th>Care level</th><th>Status</th><th className="cx-hide-sm">Updated</th></tr></thead><tbody>
            {recentAdmissions.map((item) => (
              <tr key={item.id}><td><div className="cx-cellname"><Avatar name={item.residentName || item.name || "Applicant"} round /><b>{item.residentName || item.name || "Applicant"}</b></div></td><td>{item.careLevel || "Not set"}</td><td><Badge tone={statusTone(item.status)} dot>{item.status || "Open"}</Badge></td><td className="cx-hide-sm cx-cellsub">{displayDate(item.updatedAt || item.createdAt, "Recent")}</td></tr>
            ))}
            {!recentAdmissions.length && <tr><td colSpan={4} className="cx-cellsub">No admission cases found.</td></tr>}
          </tbody></table></div>
        </Panel>

        <Panel title="Recent care activity">
          <div className="cx-feed">
            {feed.map((f, i) => {
              const Icon = f.icon;
              const map = { green: ["var(--cx-accent-soft)", "var(--cx-accent)"], blue: ["#E8EEF6", "#2D5C88"], amber: ["var(--cx-amber-soft)", "var(--cx-amber)"], red: ["#FDECEC", "#B42318"], gray: ["var(--cx-paper-2)", "var(--cx-muted)"] };
              const [bg, fg] = map[f.tone] || map.blue;
              return <div className="cx-feed-item" key={`${f.t}-${i}`}><span className="cx-feed-ico" style={{ background: bg, color: fg }}><Icon size={15} /></span><div className="cx-feed-main"><div className="cx-feed-t">{f.t}</div><div className="cx-feed-s">{f.s}</div></div><span className="cx-feed-time">{f.time}</span></div>;
            })}
            {!feed.length && <div className="cx-cellsub">No recent care activity found.</div>}
          </div>
        </Panel>
      </div>

      <div className="cx-mt" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--cx-faint)", fontSize: 12 }}>
        <ShieldCheck size={14} color="var(--cx-accent)" /> Data is scoped by authenticated facility context.
      </div>
    </div>
  );
}
