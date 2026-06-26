"use client";

import { useEffect, useMemo, useState } from "react";
import { Flame, Search, Timer } from "lucide-react";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui/data";
import { apiData, displayDate, statusTone } from "@/lib/client-api";

const FALLBACK = [
  { id: "EVAC-0620", drillType: "Fire drill", status: "completed", occurredAt: "2026-06-20T14:30:00Z", durationMinutes: 8, summary: "Facility-wide evacuation completed." },
  { id: "EVAC-0612", drillType: "Night shift drill", status: "completed", occurredAt: "2026-06-12T02:15:00Z", durationMinutes: 11, summary: "Night team drill completed." },
];

function normalize(item) {
  return {
    id: item.id,
    type: item.drillType,
    status: item.status,
    occurred: displayDate(item.occurredAt),
    duration: item.durationMinutes ? `${item.durationMinutes} min` : "Not recorded",
    summary: item.summary || "",
  };
}

export default function AdminEvacuationDrillsPage() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState(FALLBACK.map(normalize));

  useEffect(() => {
    let alive = true;
    apiData("/api/v1/evacuation-drills").then((data) => alive && Array.isArray(data) && setRows(data.map(normalize))).catch(() => {});
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rows.filter((row) => !search || [row.type, row.status, row.summary].some((value) => String(value).toLowerCase().includes(search)));
  }, [query, rows]);

  return (
    <div className="cx-wide">
      <PageHeader eyebrow="Emergency readiness" title="Evacuation drills" lede="Review facility drill completion, timing, and readiness notes." />
      <div className="cx-stats"><StatCard icon={Flame} label="Drills" value={rows.length} /><StatCard icon={Timer} label="Completed" value={rows.filter((row) => row.status === "completed").length} /></div>
      <div className="cx-toolbar"><div className="cx-search"><Search size={15} /><input aria-label="Search evacuation drills" placeholder="Search drills..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><span className="cx-tb-spacer" /><span style={{ fontSize: 12.5, color: "var(--cx-faint)" }}>{filtered.length} drill{filtered.length === 1 ? "" : "s"}</span></div>
      <div className="cx-tablewrap">{filtered.length ? <div className="cx-tblscroll"><table className="cx-tbl"><thead><tr><th>Drill</th><th>Status</th><th>Occurred</th><th>Duration</th><th>Summary</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}><td><strong>{row.type}</strong><div className="cx-cellsub">{row.id}</div></td><td><Badge tone={statusTone(row.status)} dot>{row.status}</Badge></td><td>{row.occurred}</td><td>{row.duration}</td><td className="cx-cellsub">{row.summary}</td></tr>)}</tbody></table></div> : <EmptyState icon={Flame} title="No evacuation drills match" note="Try a different search." />}</div>
    </div>
  );
}
