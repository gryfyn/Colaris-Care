"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock3, Plus, Search, ShieldCheck } from "lucide-react";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui/data";
import { apiData, displayDate, statusTone } from "@/lib/client-api";
import RecordFormModal from "@/components/records/RecordFormModal";

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
  const [residents, setResidents] = useState([]);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const data = await apiData("/api/v1/incidents").catch(() => null);
    if (Array.isArray(data)) setRows(data.map(normalize));
  }, []);

  useEffect(() => {
    void load();
    apiData("/api/v1/residents").then((data) => Array.isArray(data) && setResidents(data)).catch(() => {});
  }, [load]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rows.filter((row) => !search || [row.resident, row.type, row.severity, row.status, row.summary].some((value) => String(value).toLowerCase().includes(search)));
  }, [query, rows]);

  const residentOptions = useMemo(() => [
    { value: "", label: "Facility-wide (no resident)" },
    ...residents.map((r) => ({ value: r.id, label: r.name || `${r.firstName || ""} ${r.lastName || ""}`.trim() })),
  ], [residents]);

  async function createIncident(v) {
    await apiData("/api/v1/incidents", {
      method: "POST",
      body: JSON.stringify({
        residentId: v.resident || null,
        incidentType: v.incidentType.trim(),
        severity: v.severity || "low",
        status: v.status || "open",
        occurredAt: v.occurredAt ? new Date(v.occurredAt).toISOString() : new Date().toISOString(),
        summary: v.summary.trim(),
        followUpDueAt: v.followUpDueAt || null,
      }),
    });
    await load();
    setAdding(false);
  }

  return (
    <div className="cx-wide">
      <PageHeader
        eyebrow="Safety"
        title="Incident reports"
        lede="Review and file incident reports, severity, status, and follow-up evidence."
        action={<button type="button" className="cx-btn cx-btn-primary" onClick={() => setAdding(true)}><Plus size={15} /> Report incident</button>}
      />
      <div className="cx-stats">
        <StatCard icon={AlertTriangle} label="Open" value={rows.filter((row) => row.status === "open").length} />
        <StatCard icon={ShieldCheck} label="Closed" value={rows.filter((row) => row.status === "closed").length} />
        <StatCard icon={Clock3} label="Total reports" value={rows.length} />
      </div>
      <div className="cx-toolbar"><div className="cx-search"><Search size={15} /><input aria-label="Search incidents" placeholder="Search incidents..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><span className="cx-tb-spacer" /><span style={{ fontSize: 12.5, color: "var(--cx-faint)" }}>{filtered.length} report{filtered.length === 1 ? "" : "s"}</span></div>
      <div className="cx-tablewrap">{filtered.length ? <div className="cx-tblscroll"><table className="cx-tbl"><thead><tr><th>Resident / scope</th><th>Type</th><th>Severity</th><th>Status</th><th>Occurred</th><th>Follow-up</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}><td><strong>{row.resident}</strong><div className="cx-cellsub">{row.summary}</div></td><td>{row.type}</td><td><Badge tone={statusTone(row.severity)}>{row.severity}</Badge></td><td><Badge tone={statusTone(row.status)} dot>{row.status}</Badge></td><td>{row.occurred}</td><td>{row.followUp}</td></tr>)}</tbody></table></div> : <EmptyState icon={AlertTriangle} title="No incident reports match" note="Try a different search." />}</div>

      {adding && (
        <RecordFormModal
          eyebrow="Safety"
          title="Report incident"
          submitLabel="File report"
          onClose={() => setAdding(false)}
          onSubmit={createIncident}
          fields={[
            { name: "incidentType", label: "Incident type", required: true, span2: true, placeholder: "e.g. Fall, Behavioral episode" },
            { name: "resident", label: "Resident", type: "select", options: residentOptions },
            { name: "severity", label: "Severity", type: "select", default: "low", options: ["low", "moderate", "high", "critical"] },
            { name: "occurredAt", label: "Occurred at", type: "datetime-local", required: true },
            { name: "status", label: "Status", type: "select", default: "open", options: ["open", "under_review", "closed"] },
            { name: "summary", label: "Summary", type: "textarea", required: true, span2: true, placeholder: "What happened and immediate actions taken" },
            { name: "followUpDueAt", label: "Follow-up due", type: "date" },
          ]}
        />
      )}
    </div>
  );
}
