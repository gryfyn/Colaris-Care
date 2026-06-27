"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pill, Plus, Search, ShieldCheck } from "lucide-react";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui/data";
import { apiData, displayDate, statusTone } from "@/lib/client-api";
import RecordFormModal from "@/components/records/RecordFormModal";

const FALLBACK = [
  { id: "DD-2045", residentName: "Eleanor Whitfield", medicationName: "Acetaminophen", quantity: "12 tablets", reason: "Expired", status: "reviewed", disposedAt: "2026-06-21T10:00:00Z", witnessName: "Priya Nair" },
  { id: "DD-2042", residentName: "Rosa Iniguez", medicationName: "Metformin", quantity: "4 tablets", reason: "Order changed", status: "recorded", disposedAt: "2026-06-18T14:20:00Z", witnessName: "Dauda Okafor" },
];

function normalize(item) {
  return {
    id: item.id,
    resident: item.residentName || "Facility",
    medication: item.medicationName,
    quantity: item.quantity,
    reason: item.reason,
    status: item.status,
    disposedAt: displayDate(item.disposedAt),
    witness: item.witnessName || "Not recorded",
  };
}

export default function AdminDrugDisposalPage() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState(FALLBACK.map(normalize));
  const [residents, setResidents] = useState([]);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const data = await apiData("/api/v1/drug-disposal").catch(() => null);
    if (Array.isArray(data)) setRows(data.map(normalize));
  }, []);

  useEffect(() => {
    void load();
    apiData("/api/v1/residents").then((data) => Array.isArray(data) && setResidents(data)).catch(() => {});
  }, [load]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rows.filter((row) => !search || [row.resident, row.medication, row.reason, row.witness].some((value) => String(value).toLowerCase().includes(search)));
  }, [query, rows]);

  const residentOptions = useMemo(() => [
    { value: "", label: "Facility (no resident)" },
    ...residents.map((r) => ({ value: r.id, label: r.name || `${r.firstName || ""} ${r.lastName || ""}`.trim() })),
  ], [residents]);

  async function createDisposal(v) {
    await apiData("/api/v1/drug-disposal", {
      method: "POST",
      body: JSON.stringify({
        residentId: v.resident || null,
        medicationName: v.medicationName.trim(),
        quantity: v.quantity.trim(),
        reason: v.reason.trim(),
        witnessName: v.witnessName.trim() || null,
        status: v.status || "recorded",
      }),
    });
    await load();
    setAdding(false);
  }

  return (
    <div className="cx-wide">
      <PageHeader
        eyebrow="Medication safety"
        title="Drug disposal"
        lede="Review medication disposal records, quantities, witnesses, and status."
        action={<button type="button" className="cx-btn cx-btn-primary" onClick={() => setAdding(true)}><Plus size={15} /> Record disposal</button>}
      />
      <div className="cx-stats"><StatCard icon={Pill} label="Records" value={rows.length} /><StatCard icon={ShieldCheck} label="Reviewed" value={rows.filter((row) => row.status === "reviewed").length} /></div>
      <div className="cx-toolbar"><div className="cx-search"><Search size={15} /><input aria-label="Search disposal records" placeholder="Search resident, medication, reason, or witness..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><span className="cx-tb-spacer" /><span style={{ fontSize: 12.5, color: "var(--cx-faint)" }}>{filtered.length} record{filtered.length === 1 ? "" : "s"}</span></div>
      <div className="cx-tablewrap">{filtered.length ? <div className="cx-tblscroll"><table className="cx-tbl"><thead><tr><th>Resident</th><th>Medication</th><th>Quantity</th><th>Reason</th><th>Witness</th><th>Status</th><th>Disposed</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}><td><strong>{row.resident}</strong></td><td>{row.medication}</td><td>{row.quantity}</td><td>{row.reason}</td><td>{row.witness}</td><td><Badge tone={statusTone(row.status)} dot>{row.status}</Badge></td><td>{row.disposedAt}</td></tr>)}</tbody></table></div> : <EmptyState icon={Pill} title="No disposal records match" note="Try a different search." />}</div>

      {adding && (
        <RecordFormModal
          eyebrow="Medication safety"
          title="Record drug disposal"
          submitLabel="Record"
          onClose={() => setAdding(false)}
          onSubmit={createDisposal}
          fields={[
            { name: "medicationName", label: "Medication", required: true, placeholder: "e.g. Acetaminophen" },
            { name: "quantity", label: "Quantity", required: true, placeholder: "e.g. 12 tablets" },
            { name: "reason", label: "Reason", required: true, span2: true, placeholder: "e.g. Expired" },
            { name: "resident", label: "Resident", type: "select", options: residentOptions },
            { name: "status", label: "Status", type: "select", default: "recorded", options: ["recorded", "reviewed", "destroyed"] },
            { name: "witnessName", label: "Witness", span2: true, placeholder: "Witness name" },
          ]}
        />
      )}
    </div>
  );
}
