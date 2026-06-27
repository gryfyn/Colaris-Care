"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Flame, Plus, Search, Timer } from "lucide-react";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui/data";
import { apiData, displayDate, statusTone } from "@/lib/client-api";
import RecordFormModal from "@/components/records/RecordFormModal";

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
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const data = await apiData("/api/v1/evacuation-drills").catch(() => null);
    if (Array.isArray(data)) setRows(data.map(normalize));
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rows.filter((row) => !search || [row.type, row.status, row.summary].some((value) => String(value).toLowerCase().includes(search)));
  }, [query, rows]);

  async function createDrill(v) {
    await apiData("/api/v1/evacuation-drills", {
      method: "POST",
      body: JSON.stringify({
        drillType: v.drillType.trim(),
        occurredAt: v.occurredAt ? new Date(v.occurredAt).toISOString() : new Date().toISOString(),
        durationMinutes: v.durationMinutes ? Number(v.durationMinutes) : null,
        summary: v.summary.trim() || null,
        status: v.status || "completed",
      }),
    });
    await load();
    setAdding(false);
  }

  return (
    <div className="cx-wide">
      <PageHeader
        eyebrow="Emergency readiness"
        title="Evacuation drills"
        lede="Review facility drill completion, timing, and readiness notes."
        action={<button type="button" className="cx-btn cx-btn-primary" onClick={() => setAdding(true)}><Plus size={15} /> Log drill</button>}
      />
      <div className="cx-stats"><StatCard icon={Flame} label="Drills" value={rows.length} /><StatCard icon={Timer} label="Completed" value={rows.filter((row) => row.status === "completed").length} /></div>
      <div className="cx-toolbar"><div className="cx-search"><Search size={15} /><input aria-label="Search evacuation drills" placeholder="Search drills..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><span className="cx-tb-spacer" /><span style={{ fontSize: 12.5, color: "var(--cx-faint)" }}>{filtered.length} drill{filtered.length === 1 ? "" : "s"}</span></div>
      <div className="cx-tablewrap">{filtered.length ? <div className="cx-tblscroll"><table className="cx-tbl"><thead><tr><th>Drill</th><th>Status</th><th>Occurred</th><th>Duration</th><th>Summary</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}><td><strong>{row.type}</strong><div className="cx-cellsub">{row.id}</div></td><td><Badge tone={statusTone(row.status)} dot>{row.status}</Badge></td><td>{row.occurred}</td><td>{row.duration}</td><td className="cx-cellsub">{row.summary}</td></tr>)}</tbody></table></div> : <EmptyState icon={Flame} title="No evacuation drills match" note="Try a different search." />}</div>

      {adding && (
        <RecordFormModal
          eyebrow="Emergency readiness"
          title="Log evacuation drill"
          submitLabel="Log drill"
          onClose={() => setAdding(false)}
          onSubmit={createDrill}
          fields={[
            { name: "drillType", label: "Drill type", required: true, span2: true, placeholder: "e.g. Fire drill" },
            { name: "occurredAt", label: "Occurred at", type: "datetime-local", required: true },
            { name: "durationMinutes", label: "Duration (minutes)", type: "number", placeholder: "e.g. 8" },
            { name: "status", label: "Status", type: "select", default: "completed", options: ["completed", "in_progress", "cancelled"] },
            { name: "summary", label: "Summary", type: "textarea", span2: true, placeholder: "Readiness notes" },
          ]}
        />
      )}
    </div>
  );
}
