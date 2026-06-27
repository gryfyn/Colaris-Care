"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { History, Pill, Plus, Search, ShieldCheck } from "lucide-react";
import { Badge, PageHeader, Panel } from "@/components/ui/data";
import { apiData, displayDate, statusTone } from "@/lib/client-api";
import { ADMIN_HISTORY, MEDICATIONS } from "@/components/medications/data";
import RecordFormModal from "@/components/records/RecordFormModal";

function normalizeMedication(item) {
  return {
    id: item.id,
    resident: item.resident || item.residentName || "Resident",
    drug: item.drug || item.name,
    strength: item.strength || "",
    dosage: item.dosage || "",
    route: item.route || "",
    frequency: item.frequency || "",
    prescriber: item.prescriber || "Not recorded",
    active: item.active ?? item.status === "active",
    prn: item.prn || String(item.frequency || "").toLowerCase().includes("needed"),
    controlled: item.controlled || false,
    instruction: item.instruction || "",
  };
}

function normalizeHistory(item) {
  return {
    id: item.id,
    when: item.when || displayDate(item.administeredAt || item.scheduledFor),
    resident: item.resident || item.residentName || "Resident",
    drug: item.drug || item.medicationName || "Medication",
    dose: item.dose || "",
    staff: item.staff || "Recorded staff",
    status: item.status || item.outcome || "Given",
    notes: item.notes || item.note || "",
  };
}

export default function AdminMedicationsPage() {
  const [tab, setTab] = useState("prescriptions");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [showPrescription, setShowPrescription] = useState(false);
  const [medications, setMedications] = useState(MEDICATIONS.map(normalizeMedication));
  const [history, setHistory] = useState(ADMIN_HISTORY.map(normalizeHistory));
  const [residents, setResidents] = useState([]);

  const load = useCallback(async () => {
    const rows = await apiData("/api/v1/medications").catch(() => null);
    if (Array.isArray(rows)) setMedications(rows.map(normalizeMedication));
  }, []);

  useEffect(() => {
    void load();
    apiData("/api/v1/medication-administrations?outcome=administered").then((rows) => Array.isArray(rows) && setHistory(rows.map(normalizeHistory))).catch(() => {});
    apiData("/api/v1/residents").then((rows) => Array.isArray(rows) && setResidents(rows)).catch(() => {});
  }, [load]);

  const residentOptions = useMemo(() => residents.map((r) => ({ value: r.id, label: r.name || `${r.firstName || ""} ${r.lastName || ""}`.trim() })), [residents]);

  // Create the medication, then schedule an initial "due" administration so it is
  // immediately actionable on the staff Medication Administration Record (MAR).
  async function createMedication(v) {
    const med = await apiData("/api/v1/medications", {
      method: "POST",
      body: JSON.stringify({
        residentId: v.resident,
        name: v.name.trim(),
        dosage: v.dosage.trim() || null,
        route: v.route.trim() || null,
        frequency: v.frequency.trim() || null,
        prescriber: v.prescriber.trim() || null,
        status: "active",
      }),
    });
    if (med?.id) {
      await apiData("/api/v1/medication-administrations", {
        method: "POST",
        body: JSON.stringify({ residentId: v.resident, medicationId: med.id, scheduledFor: new Date().toISOString(), outcome: "due" }),
      }).catch(() => {});
    }
    await load();
    setShowPrescription(false);
  }

  const prescriptions = useMemo(() => medications.filter((medication) => {
    const search = query.trim().toLowerCase();
    const matchesSearch = !search || [medication.resident, medication.drug, medication.prescriber].some((value) => String(value).toLowerCase().includes(search));
    const matchesStatus = status === "All" || (status === "Active" ? medication.active : !medication.active);
    return matchesSearch && matchesStatus;
  }), [query, status, medications]);

  return (
    <div className="cx-wide med-page">
      <PageHeader eyebrow="Clinical operations" title="Medications" lede="Manage prescriptions and review medication administration history." action={tab === "prescriptions" && <button type="button" className="cx-btn cx-btn-primary" onClick={() => setShowPrescription(true)}><Plus size={15} /> Prescribe medication</button>} />
      <div className="med-layout">
        <main className="med-main">
          <div className="med-tabs" role="tablist" aria-label="Medication sections">
            <button type="button" role="tab" className="med-tab" data-on={tab === "prescriptions"} aria-selected={tab === "prescriptions"} onClick={() => setTab("prescriptions")}><Pill size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />Prescriptions</button>
            <button type="button" role="tab" className="med-tab" data-on={tab === "history"} aria-selected={tab === "history"} onClick={() => setTab("history")}><History size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />Administration history</button>
          </div>
          {tab === "prescriptions" ? (
            <>
              <Panel><div className="med-filters"><div className="med-search"><Search size={15} /><input className="cx-input" aria-label="Search prescriptions" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search resident, drug, or prescriber..." /></div><select className="cx-select med-status" aria-label="Filter prescription status" value={status} onChange={(event) => setStatus(event.target.value)}><option>All</option><option>Active</option><option>Discontinued</option></select></div></Panel>
              <div className="cx-tablewrap"><div className="cx-tblscroll"><table className="cx-tbl"><thead><tr><th>Resident</th><th>Drug</th><th>Dosage</th><th>Frequency</th><th>Route</th><th>Prescriber</th><th>Status</th><th>Action</th></tr></thead><tbody>{prescriptions.map((medication) => <tr key={medication.id}><td><strong>{medication.resident}</strong></td><td><strong>{medication.drug}</strong><div className="cx-cellsub">{medication.strength}</div></td><td>{medication.dosage}</td><td>{medication.frequency}{medication.prn && <Badge tone="amber">PRN</Badge>}</td><td>{medication.route}</td><td>{medication.prescriber}</td><td><Badge tone={medication.active ? "green" : "gray"} dot>{medication.active ? "Active" : "Discontinued"}</Badge></td><td>{medication.active && <button type="button" className="cx-btn cx-btn-ghost cx-btn-compact med-discontinue">Discontinue</button>}</td></tr>)}</tbody></table></div></div>
            </>
          ) : (
            <div className="cx-tablewrap"><div className="cx-tblscroll"><table className="cx-tbl"><thead><tr><th>When</th><th>Resident</th><th>Drug</th><th>Dose</th><th>Staff</th><th>Status</th><th>Notes</th></tr></thead><tbody>{history.map((entry) => <tr key={entry.id}><td>{entry.when}</td><td><strong>{entry.resident}</strong></td><td>{entry.drug}</td><td>{entry.dose}</td><td>{entry.staff}</td><td><Badge tone={statusTone(entry.status)} dot>{entry.status}</Badge></td><td className="cx-cellsub">{entry.notes}</td></tr>)}</tbody></table></div></div>
          )}
          <div style={{ display: "flex", gap: 8, color: "var(--cx-faint)", fontSize: 11.5 }}><ShieldCheck size={14} color="var(--cx-accent)" />Medication data loads from the tenant-scoped API when available, with fixture fallback for review.</div>
        </main>
      </div>

      {showPrescription && (
        <RecordFormModal
          eyebrow="Clinical operations"
          title="Prescribe medication"
          submitLabel="Prescribe"
          onClose={() => setShowPrescription(false)}
          onSubmit={createMedication}
          fields={[
            { name: "resident", label: "Resident", type: "select", required: true, span2: true, placeholder: "Select resident", options: residentOptions },
            { name: "name", label: "Drug name", required: true, placeholder: "e.g. Sertraline" },
            { name: "dosage", label: "Dosage", placeholder: "e.g. 50 mg" },
            { name: "route", label: "Route", placeholder: "e.g. Oral" },
            { name: "frequency", label: "Frequency", placeholder: "e.g. Daily" },
            { name: "prescriber", label: "Prescriber", placeholder: "Dr. Last Name" },
          ]}
        />
      )}
    </div>
  );
}
