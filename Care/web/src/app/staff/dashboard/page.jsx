"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bell, CalendarClock, CheckCircle2, ClipboardList, Megaphone, NotebookPen, Pill, Users } from "lucide-react";
import { Avatar, Badge, PageHeader, Panel, StatCard } from "@/components/ui/data";
import { apiData, displayDate, statusTone } from "@/lib/client-api";

const QUICK = [
  { href: "/staff/residents", icon: Users, t: "My residents", s: "Your assignment list" },
  { href: "/staff/care-plan", icon: ClipboardList, t: "Care plan tasks", s: "Goals assigned to you" },
  { href: "/staff/progress-notes", icon: NotebookPen, t: "Progress notes", s: "Document this shift" },
];

export default function StaffDashboardPage() {
  const [data, setData] = useState({ residents: [], administrations: [], appointments: [], announcements: [], notes: [] });

  useEffect(() => {
    let alive = true;
    Promise.all([
      apiData("/api/v1/residents").catch(() => []),
      apiData("/api/v1/medication-administrations?outcome=due").catch(() => []),
      apiData("/api/v1/appointments").catch(() => []),
      apiData("/api/v1/announcements").catch(() => []),
      apiData("/api/v1/progress-notes").catch(() => []),
    ]).then(([residents, administrations, appointments, announcements, notes]) => {
      if (alive) setData({ residents, administrations, appointments, announcements, notes });
    });
    return () => { alive = false; };
  }, []);

  const tasks = useMemo(() => [
    ...data.administrations.slice(0, 4).map((dose) => ({ icon: Pill, tone: "amber", t: dose.medicationName || "Medication due", s: dose.residentName || "Resident", time: displayDate(dose.scheduledAt, "Due") })),
    ...data.appointments.slice(0, 3).map((appt) => ({ icon: CalendarClock, tone: statusTone(appt.status), t: appt.title || appt.type || "Appointment", s: appt.residentName || "Resident", time: displayDate(appt.startsAt || appt.date, "Scheduled") })),
  ].slice(0, 6), [data.administrations, data.appointments]);

  return (
    <div className="cx-wide">
      <PageHeader eyebrow="Staff workspace" title="My shift dashboard" lede="Assigned residents, due care tasks, and facility updates." action={<Badge tone="green" dot>Signed in</Badge>} />

      <div className="cx-stats">
        <StatCard icon={Users} label="My residents" value={data.residents.length} delta="assigned scope" deltaDir="up" />
        <StatCard icon={ClipboardList} label="Open tasks" value={tasks.length} delta="today" deltaDir={tasks.length ? "down" : "up"} />
        <StatCard icon={Pill} label="Med doses due" value={data.administrations.length} delta="MAR" deltaDir={data.administrations.length ? "down" : "up"} />
        <StatCard icon={NotebookPen} label="Notes" value={data.notes.length} delta="recent" deltaDir="up" />
      </div>

      <div className="cx-actions-row cx-mt">
        {QUICK.map((quick) => {
          const Icon = quick.icon;
          return <Link key={quick.href} href={quick.href} className="cx-action"><span className="cx-action-ico"><Icon size={18} /></span><span><span className="cx-action-t">{quick.t}</span><span className="cx-action-s">{quick.s}</span></span><ArrowRight size={17} color="var(--cx-faint)" style={{ marginLeft: "auto" }} /></Link>;
        })}
      </div>

      <div className="cx-cols cx-mt">
        <Panel title="My assigned residents" action={<Link href="/staff/residents" className="cx-link">View all</Link>}>
          <div className="cx-tblscroll"><table className="cx-tbl"><thead><tr><th>Resident</th><th>Room</th><th className="cx-hide-sm">Care level</th><th>Status</th></tr></thead><tbody>
            {data.residents.slice(0, 6).map((resident) => <tr key={resident.id}><td><div className="cx-cellname"><Avatar name={resident.name} round /><b>{resident.name}</b></div></td><td className="cx-tnum">{resident.room || "Unassigned"}</td><td className="cx-hide-sm cx-cellsub">{resident.careLevel || "On file"}</td><td><Badge tone={statusTone(resident.status)} dot>{resident.status || "Active"}</Badge></td></tr>)}
            {!data.residents.length && <tr><td colSpan={4} className="cx-cellsub">No assigned residents found.</td></tr>}
          </tbody></table></div>
        </Panel>

        <Panel title="Today's tasks" action={<span style={{ fontSize: 12, color: "var(--cx-muted)" }}>{tasks.length} open</span>}>
          <div className="cx-feed">
            {tasks.map((task, index) => {
              const Icon = task.icon;
              return <div className="cx-feed-item" key={`${task.t}-${index}`}><span className="cx-feed-ico" style={{ background: "var(--cx-amber-soft)", color: "var(--cx-amber)" }}><Icon size={15} /></span><div className="cx-feed-main"><div className="cx-feed-t">{task.t}</div><div className="cx-feed-s">{task.s}</div></div><span className="cx-feed-time">{task.time}</span></div>;
            })}
            {!tasks.length && <div className="cx-feed-item"><CheckCircle2 size={16} color="var(--cx-accent)" /><div className="cx-feed-main"><div className="cx-feed-t">No due tasks found</div><div className="cx-feed-s">Assigned work appears current.</div></div></div>}
          </div>
        </Panel>
      </div>

      <div className="cx-mt">
        <Panel title="Recent announcements">
          <div className="cx-feed">
            {data.announcements.slice(0, 4).map((item) => <div className="cx-feed-item" key={item.id}><span className="cx-feed-ico" style={{ background: "#E8EEF6", color: "#2D5C88" }}>{item.priority === "important" ? <Bell size={15} /> : <Megaphone size={15} />}</span><div className="cx-feed-main"><div className="cx-feed-t">{item.title}</div><div className="cx-feed-s">{item.category || item.audience || "Facility update"}</div></div><span className="cx-feed-time">{displayDate(item.publishedAt || item.createdAt, "Recent")}</span></div>)}
            {!data.announcements.length && <div className="cx-cellsub">No announcements found.</div>}
          </div>
        </Panel>
      </div>
    </div>
  );
}
