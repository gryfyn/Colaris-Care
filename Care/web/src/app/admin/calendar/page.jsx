"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Megaphone, Search, Siren } from "lucide-react";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui/data";
import { apiData, displayDate, statusTone } from "@/lib/client-api";

const FILTERS = ["All", "Appointment", "Announcement", "Evacuation drill"];

export default function AdminCalendarPage() {
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [events, setEvents] = useState([]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      apiData("/api/v1/appointments").catch(() => []),
      apiData("/api/v1/announcements").catch(() => []),
      apiData("/api/v1/evacuation-drills").catch(() => []),
    ]).then(([appointments, announcements, drills]) => {
      const mapped = [
        ...appointments.map((item) => ({ id: item.id, type: "Appointment", title: item.title || item.type || "Appointment", scope: item.residentName || "Resident", date: item.startsAt || item.date, status: item.status })),
        ...announcements.map((item) => ({ id: item.id, type: "Announcement", title: item.title, scope: item.audience || "Facility", date: item.publishedAt || item.createdAt, status: item.priority || "Published" })),
        ...drills.map((item) => ({ id: item.id, type: "Evacuation drill", title: item.title || "Evacuation drill", scope: item.scope || "Facility-wide", date: item.drillDate || item.createdAt, status: item.status || "Completed" })),
      ].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
      if (alive) setEvents(mapped);
    });
    return () => { alive = false; };
  }, []);

  const rows = useMemo(() => {
    const search = query.trim().toLowerCase();
    return events.filter((event) => (filter === "All" || event.type === filter) && (!search || [event.title, event.scope, event.type, event.status].some((value) => String(value || "").toLowerCase().includes(search))));
  }, [events, filter, query]);

  return (
    <div className="cx-wide">
      <PageHeader eyebrow="Schedule" title="Facility calendar" lede="Appointments, announcements, and evacuation drills from live operational records." />
      <div className="cx-stats">
        <StatCard icon={CalendarClock} label="Appointments" value={events.filter((event) => event.type === "Appointment").length} />
        <StatCard icon={Megaphone} label="Announcements" value={events.filter((event) => event.type === "Announcement").length} />
        <StatCard icon={Siren} label="Drills" value={events.filter((event) => event.type === "Evacuation drill").length} />
      </div>
      <div className="cx-toolbar">
        <div className="cx-search"><Search size={15} /><input aria-label="Search calendar" placeholder="Search calendar..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <div className="cx-chips">{FILTERS.map((item) => <button type="button" className="cx-chip" key={item} data-on={filter === item ? "true" : "false"} onClick={() => setFilter(item)}>{item}</button>)}</div>
      </div>
      <div className="cx-tablewrap">
        {rows.length ? <div className="cx-tblscroll"><table className="cx-tbl"><thead><tr><th>Date</th><th>Event</th><th>Scope</th><th>Status</th></tr></thead><tbody>
          {rows.map((event) => <tr key={`${event.type}-${event.id}`}><td className="cx-tnum">{displayDate(event.date)}</td><td><b>{event.title}</b><div className="cx-cellsub">{event.type}</div></td><td>{event.scope}</td><td><Badge tone={statusTone(event.status)} dot>{event.status || "Scheduled"}</Badge></td></tr>)}
        </tbody></table></div> : <EmptyState icon={CalendarClock} title="No calendar events" note="No matching events were found." />}
      </div>
    </div>
  );
}
