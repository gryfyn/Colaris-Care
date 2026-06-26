"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, CalendarClock, Clock3, MapPin, Plus, Search } from "lucide-react";
import { Avatar, Badge, EmptyState, PageHeader, StatCard } from "@/components/ui/data";
import { apiData, displayDate, statusTone } from "@/lib/client-api";

const FALLBACK = [
  { id: "APT-1", residentName: "Eleanor Whitfield", title: "Medical visit", startsAt: new Date().toISOString(), location: "Main campus", status: "confirmed" },
  { id: "APT-2", residentName: "Marcus Bell", title: "Care assessment", startsAt: new Date(Date.now() + 86400000).toISOString(), location: "Wellness room", status: "scheduled" },
];

function normalize(item) {
  return {
    id: item.id,
    resident: item.residentName || item.resident || "Facility-wide",
    title: item.title,
    startsAt: item.startsAt || item.starts_at,
    when: displayDate(item.startsAt || item.starts_at),
    location: item.location || "Not recorded",
    status: item.status || "scheduled",
  };
}

export default function AppointmentsPage() {
  const [rows, setRows] = useState(FALLBACK.map(normalize));
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    apiData("/api/v1/appointments").then((data) => alive && Array.isArray(data) && setRows(data.map(normalize))).catch(() => {});
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rows.filter((row) => !search || [row.resident, row.title, row.location, row.status].some((value) => String(value).toLowerCase().includes(search)));
  }, [query, rows]);

  return (
    <div className="cx-wide">
      <PageHeader eyebrow="Facility schedule" title="Appointments" lede="Coordinate resident visits, assessments, family time, and transport in one schedule." action={<button type="button" className="cx-btn cx-btn-primary"><Plus size={15} /> Schedule appointment</button>} />
      <div className="cx-stats">
        <StatCard icon={Clock3} label="Scheduled" value={rows.filter((row) => row.status === "scheduled").length} />
        <StatCard icon={CalendarCheck} label="Confirmed" value={rows.filter((row) => row.status === "confirmed").length} />
        <StatCard icon={CalendarClock} label="Total" value={rows.length} />
      </div>
      <div className="cx-toolbar"><div className="cx-search"><Search size={15} /><input aria-label="Search appointments" placeholder="Search resident, title, or location..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><span className="cx-tb-spacer" /><span style={{ fontSize: 12.5, color: "var(--cx-faint)" }}>{filtered.length} appointment{filtered.length === 1 ? "" : "s"}</span></div>
      <div className="cx-tablewrap">{filtered.length ? <div className="cx-tblscroll"><table className="cx-tbl"><thead><tr><th>Resident / scope</th><th>Appointment</th><th>When</th><th>Location</th><th>Status</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}><td><div className="cx-cellname"><Avatar name={row.resident} sm /><strong>{row.resident}</strong></div></td><td>{row.title}</td><td>{row.when}</td><td><MapPin size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />{row.location}</td><td><Badge tone={statusTone(row.status)} dot>{row.status}</Badge></td></tr>)}</tbody></table></div> : <EmptyState icon={CalendarClock} title="No appointments match" note="Try a different search." />}</div>
    </div>
  );
}
