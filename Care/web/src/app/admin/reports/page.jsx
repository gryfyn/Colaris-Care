"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ClipboardCheck, FileText, Flame, Search, ShieldCheck } from "lucide-react";
import { Avatar, Badge, EmptyState, PageHeader, StatCard } from "@/components/ui/data";
import { apiData, displayDate, statusTone } from "@/lib/client-api";

const REPORT_TYPES = [
  { name: "Progress note", short: "Progress notes", icon: FileText, source: "notes" },
  { name: "Drug disposal", short: "Drug disposal", icon: ShieldCheck, source: "disposal" },
  { name: "Evacuation drill", short: "Evacuation drills", icon: Flame, source: "drills" },
  { name: "Incident report", short: "Incident reports", icon: AlertTriangle, source: "incidents" },
];

export default function ReportsPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      apiData("/api/v1/progress-notes").catch(() => []),
      apiData("/api/v1/drug-disposal").catch(() => []),
      apiData("/api/v1/evacuation-drills").catch(() => []),
      apiData("/api/v1/incidents").catch(() => []),
    ]).then(([notes, disposal, drills, incidents]) => {
      const mapped = [
        ...notes.map((item) => ({ id: item.id, type: "Progress note", resident: item.residentName || "Resident", author: item.authorName || "Staff", date: item.createdAt || item.updatedAt, status: item.status || "Submitted" })),
        ...disposal.map((item) => ({ id: item.id, type: "Drug disposal", resident: item.residentName || item.medicationName || "Medication", author: item.disposedByName || "Staff", date: item.disposedAt || item.createdAt, status: item.status || "Completed" })),
        ...drills.map((item) => ({ id: item.id, type: "Evacuation drill", resident: item.scope || "Facility-wide", author: item.coordinatorName || "Coordinator", date: item.drillDate || item.createdAt, status: item.status || "Completed" })),
        ...incidents.map((item) => ({ id: item.id, type: "Incident report", resident: item.residentName || "Facility", author: item.reportedByName || "Staff", date: item.occurredAt || item.createdAt, status: item.status || "Open" })),
      ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      if (alive) setRows(mapped);
    });
    return () => { alive = false; };
  }, []);

  const counts = useMemo(() => Object.fromEntries(REPORT_TYPES.map((type) => [type.name, rows.filter((report) => report.type === type.name).length])), [rows]);
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter((report) => {
      const matchesType = filter === "All" || report.type === filter;
      const matchesQuery = !normalizedQuery || [report.id, report.type, report.resident, report.author, report.status].some((value) => String(value || "").toLowerCase().includes(normalizedQuery));
      return matchesType && matchesQuery;
    });
  }, [filter, query, rows]);
  const filters = ["All", ...REPORT_TYPES.map((type) => type.name)];

  return (
    <div className="cx-wide">
      <PageHeader eyebrow="Clinical documentation" title="Reports" lede="Recent care records, safety documentation, and facility drill reports from live APIs." />

      <div className="cx-stats" aria-label="Available report types">
        {REPORT_TYPES.map((type) => <StatCard key={type.name} icon={type.icon} label={type.short} value={counts[type.name] || 0} delta="recent" deltaDir="up" />)}
      </div>

      <div className="cx-toolbar">
        <div className="cx-search"><Search size={15} /><input aria-label="Search reports" placeholder="Search reports, residents, or authors..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <div className="cx-chips" aria-label="Filter reports by type">
          {filters.map((type) => <button key={type} type="button" className="cx-chip" data-on={filter === type ? "true" : "false"} aria-pressed={filter === type} onClick={() => setFilter(type)}>{type === "All" ? "All" : REPORT_TYPES.find((reportType) => reportType.name === type).short}</button>)}
        </div>
        <span className="cx-tb-spacer" />
        <span style={{ fontSize: 12.5, color: "var(--cx-faint)" }} aria-live="polite">{filtered.length} report{filtered.length === 1 ? "" : "s"}</span>
      </div>

      <div className="cx-tablewrap">
        {filtered.length ? (
          <div className="cx-tblscroll"><table className="cx-tbl"><thead><tr><th>Report type</th><th>Resident / scope</th><th>Author</th><th>Date</th><th>Status</th></tr></thead><tbody>
            {filtered.map((report) => {
              const reportType = REPORT_TYPES.find((type) => type.name === report.type) || REPORT_TYPES[0];
              const TypeIcon = reportType.icon;
              return <tr key={`${report.type}-${report.id}`}><td><div className="cx-cellname"><span className="cx-stat-ico" aria-hidden="true"><TypeIcon size={16} /></span><div><b>{report.type}</b><div className="cx-cellsub">{report.id}</div></div></div></td><td>{report.resident}</td><td><div className="cx-cellname"><Avatar name={report.author} sm /><span>{report.author}</span></div></td><td className="cx-tnum">{displayDate(report.date)}</td><td><Badge tone={statusTone(report.status)} dot>{report.status}</Badge></td></tr>;
            })}
          </tbody></table></div>
        ) : <EmptyState icon={ClipboardCheck} title="No reports match" note="Try a different search or report type." />}
      </div>
    </div>
  );
}
