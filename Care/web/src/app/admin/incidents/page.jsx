"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock3, Search, ShieldCheck } from "lucide-react";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui/data";
import { apiData, displayDate, statusTone } from "@/lib/client-api";

const FALLBACK = [
  { id: "INC-2046", residentName: "Rosa Iniguez", incidentType: "Fall risk follow-up", severity: "moderate", status: "open", occurredAt: "2026-06-22T15:30:00Z", summary: "Follow-up documentation pending.", followUpDueAt: "2026-06-26" },
  { id: "INC-2041", residentName: "Marcus Bell", incidentType: "Behavioral episode", severity: "low", status: "closed", occurredAt: "2026-06-17T12:10:00Z", summary: "Reviewed and closed.", followUpDueAt: null },
];

function normalize(item) {
  return {
    id: item.id,
    resident: item.residentName || item.resident || "Facility-wide",
    type: item.incidentType || item.type,
    severity: item.severity || "low",
    status: item.status || "open",
    occurred: displayDate(item.occurredAt || item.occurred_at),
    summary: item.summary || "",
    followUp: displayDate(item.followUpDueAt || item.follow_up_due_at, "No follow-up date"),
  };
}

export default function AdminIncidentsPage() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState(FALLBACK.map(normalize));

  useEffect(() => {
    let alive = true;
    apiData("/api/v1/incidents").then((data) => alive && Array.isArray(data) && setRows(data.map(normalize))).catch(() => {});
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rows.filter((row) => !search || [row.resident, row.type, row.severity, row.status, row.summary].some((value) => String(value).toLowerCase().includes(search)));
  }, [query, rows]);

  return (
    <div className="cx-wide">
      <PageHeader eyebrow="Safety" title="Incident reports" lede="Review incident reports, severity, status, and follow-up evidence." />
      <div className="cx-stats">
        <StatCard icon={AlertTriangle} label="Open" value={rows.filter((row) => row.status === "open").length} />
        <StatCard icon={ShieldCheck} label="Closed" value={rows.filter((row) => row.status === "closed").length} />
        <StatCard icon={Clock3} label="Total reports" value={rows.length} />
      </div>
      <div className="cx-toolbar"><div className="cx-search"><Search size={15} /><input aria-label="Search incidents" placeholder="Search incidents..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><span className="cx-tb-spacer" /><span style={{ fontSize: 12.5, color: "var(--cx-faint)" }}>{filtered.length} report{filtered.length === 1 ? "" : "s"}</span></div>
      <div className="cx-tablewrap">{filtered.length ? <div className="cx-tblscroll"><table className="cx-tbl"><thead><tr><th>Resident / scope</th><th>Type</th><th>Severity</th><th>Status</th><th>Occurred</th><th>Follow-up</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}><td><strong>{row.resident}</strong><div className="cx-cellsub">{row.summary}</div></td><td>{row.type}</td><td><Badge tone={statusTone(row.severity)}>{row.severity}</Badge></td><td><Badge tone={statusTone(row.status)} dot>{row.status}</Badge></td><td>{row.occurred}</td><td>{row.followUp}</td></tr>)}</tbody></table></div> : <EmptyState icon={AlertTriangle} title="No incident reports match" note="Try a different search." />}</div>
    </div>
  );
}
