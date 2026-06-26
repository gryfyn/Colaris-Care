"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Clock3, Pill, Search, X } from "lucide-react";
import { Badge, PageHeader, StatCard } from "@/components/ui/data";
import { statusTone } from "@/lib/client-api";
import { useApiMutation, useApiQuery } from "@/lib/useApiQuery";
import { MEDICATIONS } from "@/components/medications/data";

const MED_QUEUE_KEY = "med-queue";

function fixtureQueue() {
  return [
    ...MEDICATIONS.filter((medication) => medication.active).map((medication) => ({ ...medication, queueId: `dose-${medication.id}` })),
    { ...MEDICATIONS[1], queueId: "dose-2-evening", frequency: "Evening dose" },
  ];
}

function normalizeQueue(item) {
  return {
    queueId: item.queueId || item.id,
    resident: item.resident || item.residentName || "Resident",
    drug: item.drug || item.medicationName || item.name || "Medication",
    strength: item.strength || "",
    dosage: item.dosage || "",
    route: item.route || "",
    frequency: item.frequency || "",
    instruction: item.instruction || item.note || "",
    prn: item.prn || false,
    controlled: item.controlled || false,
    residentId: item.residentId,
    medicationId: item.medicationId,
    scheduledFor: item.scheduledFor,
  };
}

export default function StaffMedicationsPage() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState("given");
  const [administered, setAdministered] = useState(["dose-1", "dose-2"]);
  const [notGiven, setNotGiven] = useState([]);
  const fixture = useMemo(() => fixtureQueue(), []);
  const { data } = useApiQuery(MED_QUEUE_KEY, "/api/v1/medication-administrations?outcome=due", { fallback: fixture });
  const queue = useMemo(() => (Array.isArray(data) ? data : fixture).map(normalizeQueue), [data, fixture]);
  const recordMutation = useApiMutation("/api/v1/medication-administrations", "POST", { invalidate: [MED_QUEUE_KEY] });

  const pendingQueue = useMemo(() => queue.filter((medication) => !administered.includes(medication.queueId) && !notGiven.includes(medication.queueId)), [administered, notGiven, queue]);
  const medications = useMemo(() => pendingQueue.filter((medication) => !query.trim() || [medication.resident, medication.drug].some((value) => String(value).toLowerCase().includes(query.trim().toLowerCase()))), [pendingQueue, query]);
  const openRecord = (medication, nextAction) => { setSelected(medication); setAction(nextAction); };
  const saveRecord = async () => {
    if (!selected) return;
    if (selected.residentId && selected.medicationId) {
      try {
        await recordMutation.mutateAsync({
          residentId: selected.residentId,
          medicationId: selected.medicationId,
          scheduledFor: selected.scheduledFor,
          outcome: action === "given" ? "administered" : "refused",
        });
      } catch {}
    }
    if (action === "given") setAdministered((current) => [...current, selected.queueId]);
    else setNotGiven((current) => [...current, selected.queueId]);
    setSelected(null);
  };
  const progress = Math.round((administered.length / (queue.length || 1)) * 100);

  return (
    <div className="cx-wide staff-med-page">
      <PageHeader eyebrow="Medication administration" title="Medications" lede="Search a resident or medication, then record an administration or mark it not given." />
      <div className="cx-stats">
        <StatCard icon={CheckCircle2} label="Administered" value={`${administered.length}/${queue.length}`} delta={`${progress}% complete`} deltaDir="up" />
        <StatCard icon={Clock3} label="Pending" value={pendingQueue.length} delta="remaining doses" deltaDir="up" />
        <StatCard icon={AlertTriangle} label="Not given" value={notGiven.length} />
        <StatCard icon={Pill} label="Scheduled today" value={queue.length} />
      </div>
      <div className="sm-layout"><main className="sm-main"><div className="sm-search"><Search size={16} /><input className="cx-input" aria-label="Search medications" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by resident name or drug name..." /></div><div className="sm-cards">{medications.map((medication) => <article className={`sm-card${medication.controlled ? " is-controlled" : medication.prn ? " is-prn" : ""}`} key={medication.queueId}><div><div className="sm-resident">Resident</div><div className="sm-resident-name">{medication.resident}</div></div><div><div className="sm-drug">{medication.drug} <span>{medication.strength}</span></div><div className="sm-meta">{medication.dosage} - {medication.route} - {medication.frequency}</div></div>{(medication.prn || medication.controlled) && <div style={{ display: "flex", gap: 6 }}>{medication.prn && <Badge tone="amber">PRN</Badge>}{medication.controlled && <Badge tone="red">Controlled</Badge>}</div>}<div className="sm-instruction">{medication.instruction}</div><div className="sm-card-actions"><button type="button" className="cx-btn cx-btn-primary" onClick={() => openRecord(medication, "given")}><Check size={14} /> Administer</button><button type="button" className="cx-btn cx-btn-ghost sm-not-given" onClick={() => openRecord(medication, "not-given")}><X size={14} /> Not given</button></div></article>)}</div>{!medications.length && <div className="cx-empty2"><Pill size={22} /><h3>{pendingQueue.length ? "No medications found" : "All scheduled medications resolved"}</h3><p>{pendingQueue.length ? "Try a different resident or drug name." : `${administered.length} administered - ${notGiven.length} not given.`}</p></div>}</main></div>
      {selected && <div className="sm-modal-bg" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}><div className="sm-modal" role="dialog" aria-modal="true" aria-labelledby="med-record-title"><div className="sm-modal-head">{action === "given" ? <Check size={17} color="var(--cx-accent)" /> : <AlertTriangle size={17} color="var(--cx-danger)" />}<strong id="med-record-title">{action === "given" ? "Administer medication" : "Mark not given"}</strong><button type="button" className="cx-btn cx-btn-quiet" aria-label="Close" onClick={() => setSelected(null)}><X size={16} /></button></div><div className="sm-modal-body"><div className="sm-summary"><strong>{selected.resident}</strong><div className="sm-meta" style={{ marginTop: 4 }}>{selected.drug} {selected.strength} - {selected.dosage} - {selected.route}</div></div><Badge tone={statusTone(action === "given" ? "administered" : "refused")}>{action === "given" ? "Will be recorded as administered" : "Will be recorded as not given"}</Badge><label className="cx-field"><span className="cx-label">Notes</span><textarea className="cx-textarea" placeholder="Additional notes" /></label></div><div className="sm-modal-actions"><button type="button" className="cx-btn cx-btn-ghost" onClick={() => setSelected(null)}>Cancel</button><button type="button" className="cx-btn cx-btn-primary" onClick={saveRecord}>{action === "given" ? "Confirm administration" : "Record not given"}</button></div></div></div>}
    </div>
  );
}
