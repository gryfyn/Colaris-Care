"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, CalendarClock, Clock3, MapPin, Plus, Search } from "lucide-react";
import { Avatar, Badge, EmptyState, PageHeader, StatCard } from "@/components/ui/data";
import { apiData, displayDate, statusTone } from "@/lib/client-api";
import RecordFormModal from "@/components/records/RecordFormModal";

const FALLBACK = [
  { id: "APT-1", residentName: "Eleanor Whitfield", title: "Medical visit", startsAt: "2026-06-20T15:00:00.000Z", location: "Main campus", status: "confirmed" },
  { id: "APT-2", residentName: "Marcus Bell", title: "Care assessment", startsAt: "2026-06-21T15:00:00.000Z", location: "Wellness room", status: "scheduled" },
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
  const [residents, setResidents] = useState([]);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const data = await apiData("/api/v1/appointments").catch(() => null);
    if (Array.isArray(data)) setRows(data.map(normalize));
  }, []);

  useEffect(() => {
    void load();
    apiData("/api/v1/residents").then((data) => Array.isArray(data) && setResidents(data)).catch(() => {});
  }, [load]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rows.filter((row) => !search || [row.resident, row.title, row.location, row.status].some((value) => String(value).toLowerCase().includes(search)));
  }, [query, rows]);

  const residentOptions = useMemo(() => [
    { value: "", label: "Facility-wide (no resident)" },
    ...residents.map((r) => ({ value: r.id, label: r.name || `${r.firstName || ""} ${r.lastName || ""}`.trim() })),
  ], [residents]);

  async function createAppointment(v) {
    await apiData("/api/v1/appointments", {
      method: "POST",
      body: JSON.stringify({
        residentId: v.resident || null,
        title: v.title.trim(),
        startsAt: v.startsAt ? new Date(v.startsAt).toISOString() : new Date().toISOString(),
        endsAt: v.endsAt ? new Date(v.endsAt).toISOString() : null,
        location: v.location.trim() || null,
        status: v.status || "scheduled",
      }),
    });
    await load();
    setAdding(false);
  }

  return (
    <div className="cx-wide">
      <PageHeader
        eyebrow="Facility schedule"
        title="Appointments"
        lede="Coordinate resident visits, assessments, family time, and transport in one schedule."
        action={<button type="button" className="cx-btn cx-btn-primary" onClick={() => setAdding(true)}><Plus size={15} /> Schedule appointment</button>}
      />
      <div className="cx-stats">
        <StatCard icon={Clock3} label="Scheduled" value={rows.filter((row) => row.status === "scheduled").length} />
        <StatCard icon={CalendarCheck} label="Confirmed" value={rows.filter((row) => row.status === "confirmed").length} />
        <StatCard icon={CalendarClock} label="Total" value={rows.length} />
      </div>
      <div className="cx-toolbar"><div className="cx-search"><Search size={15} /><input aria-label="Search appointments" placeholder="Search resident, title, or location..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><span className="cx-tb-spacer" /><span style={{ fontSize: 12.5, color: "var(--cx-faint)" }}>{filtered.length} appointment{filtered.length === 1 ? "" : "s"}</span></div>
      <div className="cx-tablewrap">{filtered.length ? <div className="cx-tblscroll"><table className="cx-tbl"><thead><tr><th>Resident / scope</th><th>Appointment</th><th>When</th><th>Location</th><th>Status</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}><td><div className="cx-cellname"><Avatar name={row.resident} sm /><strong>{row.resident}</strong></div></td><td>{row.title}</td><td>{row.when}</td><td><MapPin size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />{row.location}</td><td><Badge tone={statusTone(row.status)} dot>{row.status}</Badge></td></tr>)}</tbody></table></div> : <EmptyState icon={CalendarClock} title="No appointments match" note="Try a different search." />}</div>

      {adding && (
        <RecordFormModal
          eyebrow="Facility schedule"
          title="Schedule appointment"
          submitLabel="Schedule"
          onClose={() => setAdding(false)}
          onSubmit={createAppointment}
          fields={[
            { name: "title", label: "Title", required: true, span2: true, placeholder: "e.g. Medical visit" },
            { name: "resident", label: "Resident", type: "select", options: residentOptions },
            { name: "status", label: "Status", type: "select", default: "scheduled", options: ["scheduled", "confirmed", "completed", "cancelled"] },
            { name: "startsAt", label: "Starts at", type: "datetime-local", required: true },
            { name: "endsAt", label: "Ends at", type: "datetime-local" },
            { name: "location", label: "Location", span2: true, placeholder: "e.g. Main campus" },
          ]}
        />
      )}
    </div>
  );
}
