"use client";

import { useRef, useState } from "react";
import { AlertTriangle, DoorOpen, NotebookPen, Plus, Trash2, X } from "lucide-react";
import { Badge, PageHeader, Panel } from "@/components/ui/data";
import { RESIDENTS } from "./recordData";

const META = {
  progress: { title: "Progress Notes", eyebrow: "Clinical documentation", lede: "Document resident observations, care provided, meal intake, medication rounds, and activities for the shift.", icon: NotebookPen, submit: "Submit Progress Notes" },
  incidents: { title: "Incident Report", eyebrow: "Safety reporting", lede: "Complete all applicable fields. Suspected abuse or neglect must be reported to the local office immediately.", icon: AlertTriangle, submit: "Submit Incident Report" },
  disposal: { title: "Drug Disposal", eyebrow: "Medication accountability", lede: "Document medications disposed, the reason and method, staff responsible, and required witnesses.", icon: Trash2, submit: "Submit Drug Disposal" },
  evacuation: { title: "Evacuation Drill", eyebrow: "Emergency readiness", lede: "Record drill timing, evacuation details, accountability, observations, and follow-up actions.", icon: DoorOpen, submit: "Submit Evacuation Drill" },
};

function Input({ label, textarea, select, options = [], ...props }) {
  return <label className="cx-field"><span className="cx-label">{label}</span>{textarea ? <textarea className="cx-textarea" {...props} /> : select ? <select className="cx-select" {...props}><option value="">Select…</option>{options.map((option) => <option key={option}>{option}</option>)}</select> : <input className="cx-input" {...props} />}</label>;
}

function Section({ title, children, action }) {
  return <Panel title={title} action={action}><div className="record-section">{children}</div></Panel>;
}

function ChoiceGroup({ label, options, selected, onChange, single = false }) {
  const toggle = (option) => onChange(single ? option : selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option]);
  return <div className="cx-field"><span className="cx-label">{label}</span><div className="record-choices">{options.map((option) => <button type="button" key={option} className="cx-chip" data-on={(single ? selected === option : selected.includes(option)) ? "true" : "false"} aria-pressed={single ? selected === option : selected.includes(option)} onClick={() => toggle(option)}>{option}</button>)}</div></div>;
}

function ProgressForm() {
  const [choices, setChoices] = useState({ mood: [], health: [], meds: [], activities: [] });
  const set = (key) => (value) => setChoices((current) => ({ ...current, [key]: value }));
  return <>
    <Section title="Note information"><div className="record-grid"><Input label="Search resident by name" placeholder="Type to filter residents…" /><Input label="Resident" select options={RESIDENTS} defaultValue="" /><Input label="Date" type="date" /><Input label="Shift" select options={["Morning (6am – 2pm)", "Afternoon (2pm – 10pm)", "Night (10pm – 6am)"]} defaultValue="" /></div></Section>
    <Section title="Progress Notes"><Input label="Progress Notes" textarea rows={6} placeholder="Document detailed observations, changes in condition, significant events, and care provided during this shift…" /></Section>
    <Section title="Mood & Behavior"><ChoiceGroup label="Observed mood / behavior" options={["Alert", "Withdrawn", "Agitated", "Cooperative", "Other"]} selected={choices.mood} onChange={set("mood")} /></Section>
    <Section title="Physical Health"><ChoiceGroup label="Health status" options={["Stable", "Improved", "Declined"]} selected={choices.health} onChange={set("health")} /></Section>
    <Section title="Medications Administered"><ChoiceGroup label="Medications given" options={["Morning", "Noon", "Evening", "Bedtime", "PRN"]} selected={choices.meds} onChange={set("meds")} /></Section>
    <Section title="Meal Intake"><div className="record-grid record-grid-3">{["Breakfast", "Lunch", "Dinner"].map((meal) => <div className="record-meal" key={meal}><Input label={`${meal} %`} type="number" min="0" max="100" placeholder="0" /><Input label={`${meal} notes`} placeholder="Optional notes" /></div>)}</div></Section>
    <Section title="Activities"><ChoiceGroup label="Activities participated" options={["Physical", "Recreational", "Social", "Cognitive", "Therapeutic"]} selected={choices.activities} onChange={set("activities")} /></Section>
    <Section title="Incidents & Concerns"><Input label="Incidents or concerns" textarea rows={4} placeholder="Document safety concerns, behavioral issues, or other matters requiring attention…" /></Section>
  </>;
}

function IncidentForm() {
  const [types, setTypes] = useState([]);
  const [areas, setAreas] = useState([]);
  const [witnessed, setWitnessed] = useState("");
  return <>
    <Section title="Resident & Incident Details"><div className="record-grid record-grid-3"><Input label="Resident" select options={RESIDENTS} defaultValue="" /><Input label="Date of incident" type="date" /><Input label="Time of incident" type="time" /></div><ChoiceGroup label="Type of incident" options={["Fall", "Injury", "Medication error", "Medication refusal", "Behavioral event", "Elopement", "Abuse / neglect", "Other"]} selected={types} onChange={setTypes} />{types.includes("Abuse / neglect") && <div className="record-warning"><AlertTriangle size={15} />Report suspected abuse or neglect to the local office immediately.<Input label="Date reported to local office" type="date" /></div>}<div className="record-grid"><Input label="Where did the incident occur?" placeholder="Room, hallway, or outdoor area" /><Input label="Other residents involved" placeholder="Names, if applicable" /></div><ChoiceGroup label="Was the incident witnessed?" options={["Yes", "No"]} selected={witnessed} onChange={setWitnessed} single />{witnessed === "Yes" && <Input label="If so, by whom?" placeholder="Witness name(s)" />}</Section>
    <Section title="Incident Narrative"><Input label="Details of incident and description of injuries" textarea rows={5} placeholder="Describe what happened, the sequence of events, and any observed injuries…" /><Input label="Specific actions taken by staff" textarea rows={4} placeholder="First aid, de-escalation, emergency services, notifications, or other immediate interventions…" /></Section>
    <Section title="Body Areas Injured"><ChoiceGroup label="Select all applicable areas" options={["Head", "Face", "Neck", "Chest", "Back", "Left arm", "Right arm", "Left leg", "Right leg", "No injury identified"]} selected={areas} onChange={setAreas} /></Section>
    <Section title="Notifications"><div className="record-notifications">{["Licensee", "Primary Care Practitioner", "Family", "Case Manager", "Licensor", "Mental Health Professional"].map((party) => <div className="record-notification" key={party}><strong>{party}</strong><select className="cx-select" defaultValue=""><option value="">Notified?</option><option>Yes</option><option>No</option></select><input className="cx-input" placeholder="Contact name" /><input className="cx-input" type="date" /><input className="cx-input" type="time" /></div>)}</div></Section>
    <Section title="Follow-Up Plan"><Input label="Follow-up plan" textarea rows={4} placeholder="Monitoring, referrals, safety-plan changes, policy review, or staff debriefing…" /></Section>
    <Section title="Sign-Off"><div className="record-grid"><Input label="Name of person completing form" placeholder="Full name and title" /><Input label="Signature" placeholder="Type full name to acknowledge" /><Input label="Date" type="date" /><Input label="Time" type="time" /></div></Section>
  </>;
}

function DisposalForm() {
  const [drugs, setDrugs] = useState([{ id: "drug-1", controlled: "" }]);
  const nextDrugId = useRef(2);
  const setControlled = (id, value) => setDrugs((current) => current.map((drug) => drug.id === id ? { ...drug, controlled: value } : drug));
  const addDrug = () => {
    const id = `drug-${nextDrugId.current}`;
    nextDrugId.current += 1;
    setDrugs((current) => [...current, { id, controlled: "" }]);
  };
  return <>
    <Section title="Resident Information"><div className="record-grid"><Input label="Resident" select options={RESIDENTS} defaultValue="" /><Input label="AFH name" defaultValue="Maple Grove Care" /></div></Section>
    <Section title="Medications Disposed" action={<Badge tone="blue">{drugs.length} medication{drugs.length === 1 ? "" : "s"}</Badge>}><div className="record-repeat">{drugs.map((drug, index) => <div className="record-repeat-card" key={drug.id}><div className="record-repeat-head"><strong>Medication {index + 1}</strong>{drugs.length > 1 && <button type="button" className="cx-btn cx-btn-quiet" onClick={() => setDrugs((current) => current.filter((item) => item.id !== drug.id))}><X size={14} /> Remove</button>}</div><div className="record-grid record-grid-3"><Input label="Date" type="date" /><Input label="Drug name" /><Input label="Drug strength" placeholder="e.g. 50 mg" /><Input label="Quantity disposed" type="number" min="1" /><Input label="Quantity unit" select options={["Pills", "Patches", "ml (liquid)"]} defaultValue="" /><Input label="Reason for disposal" select options={["Medication discontinued", "Expired", "Order changed", "Resident discharged", "Damaged / contaminated", "Other"]} defaultValue="" /><Input label="Method of disposal" select options={["Medication disposal pouch", "Pharmacy return", "DEA take-back", "Flushing per approved list", "Other"]} defaultValue="" /><Input label="Staff name (counting & disposing)" /><Input label="Witness (if controlled)" /></div><ChoiceGroup label="Controlled substance?" options={["Yes", "No"]} selected={drug.controlled} onChange={(value) => setControlled(drug.id, value)} single /></div>)}</div><button type="button" className="cx-btn cx-btn-ghost" onClick={addDrug}><Plus size={14} /> Add another medication</button></Section>
  </>;
}

function EvacuationForm() {
  const [accounted, setAccounted] = useState("");
  const [schedule, setSchedule] = useState("");
  return <>
    <Section title="Drill Information"><div className="record-grid"><Input label="Drill type" select options={["Fire", "Earthquake", "Severe weather", "Power outage", "Other"]} defaultValue="" /><Input label="Drill date" type="date" /><Input label="Drill time" type="time" /><Input label="Duration (minutes)" type="number" min="1" /></div></Section>
    <Section title="Evacuation Details"><div className="record-grid"><Input label="Location evacuated" select options={["Entire facility", "North wing", "South wing", "Memory care", "Other"]} defaultValue="" /><Input label="Assembly location" placeholder="Where residents assembled" /><Input label="Residents evacuated" type="number" min="0" /><Input label="Staff involved" type="number" min="0" /></div><ChoiceGroup label="All residents accounted for?" options={["Yes", "No"]} selected={accounted} onChange={setAccounted} single /></Section>
    <Section title="Observations & Follow-Up"><Input label="Issues encountered" textarea rows={4} placeholder="Delays, blocked exits, equipment concerns, or accountability issues…" /><ChoiceGroup label="Drill completed on schedule?" options={["Yes", "No"]} selected={schedule} onChange={setSchedule} single /><Input label="Follow-up actions" textarea rows={3} placeholder="Corrective actions, retraining, or facility changes…" /></Section>
    <Section title="Sign-Off"><Input label="Signature" placeholder="Type your full name to acknowledge" /></Section>
  </>;
}

export default function StaffRecordForm({ type }) {
  const meta = META[type];
  const Icon = meta.icon;
  return <div className="cx-wide record-page"><style>{`
    .record-page{padding-bottom:30px}.record-stack{display:grid;gap:16px;max-width:980px}.record-section{display:grid;gap:16px;padding:18px}.record-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.record-grid-3{grid-template-columns:repeat(3,minmax(0,1fr))}.record-choices{display:flex;flex-wrap:wrap;gap:7px}.record-warning{display:grid;grid-template-columns:auto 1fr;align-items:start;gap:8px;padding:12px;color:var(--cx-danger);background:var(--cx-danger-soft);border:1px solid color-mix(in srgb,var(--cx-danger) 35%,transparent);border-radius:9px;font-size:12px}.record-warning .cx-field{grid-column:1/-1}.record-notifications{display:grid;gap:8px;overflow-x:auto}.record-notification{display:grid;grid-template-columns:170px 110px minmax(150px,1fr) 145px 125px;gap:8px;align-items:center;min-width:760px;padding:9px;background:var(--cx-paper-2);border-radius:8px}.record-notification strong{font-size:12px}.record-repeat{display:grid;gap:12px}.record-repeat-card{padding:14px;background:var(--cx-paper-2);border:1px solid var(--cx-border-soft);border-radius:10px}.record-repeat-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}.record-meal{display:grid;gap:10px}.record-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;background:var(--cx-paper);border:1px solid var(--cx-border);border-radius:var(--cx-r)}.record-actions span{font-size:12px;color:var(--cx-muted)}.record-actions .cx-btn[disabled]{opacity:.55;cursor:not-allowed;box-shadow:none}@media(max-width:720px){.record-grid,.record-grid-3{grid-template-columns:1fr}.record-actions{align-items:flex-start;flex-direction:column}}
  `}</style><PageHeader eyebrow={meta.eyebrow} title={meta.title} lede={meta.lede} /><div className="record-stack">{type === "progress" && <ProgressForm />}{type === "incidents" && <IncidentForm />}{type === "disposal" && <DisposalForm />}{type === "evacuation" && <EvacuationForm />}<div className="record-actions"><span>Complete the form now; submission will be connected later.</span><button type="button" className="cx-btn cx-btn-primary" disabled title="Submission is not connected yet"><Icon size={15} /> {meta.submit} · coming soon</button></div></div></div>;
}
