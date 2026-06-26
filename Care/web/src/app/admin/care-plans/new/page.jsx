"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, HeartPulse, Loader2, Plus, Target, X } from "lucide-react";
import { Avatar, EmptyState, PageHeader, Panel } from "@/components/ui/data";
import { Field, TextField, SelectField, TextAreaField } from "@/components/ui/fields";
import { apiData } from "@/lib/client-api";

const EMPTY_GOAL = { title: "", progress: "On track" };
const EMPTY_OBJECTIVE = { title: "", goal: "", cadence: "" };
const EMPTY_INTERVENTION = { title: "", owner: "", frequency: "" };

function DynamicRows({ title, rows, addLabel, onAdd, onRemove, children }) {
  return (
    <div className="cx-dynamic cx-span2">
      <div className="cx-dynamic-head">
        <span>{title}</span>
        <button className="cx-btn cx-btn-ghost cx-btn-compact" type="button" onClick={onAdd}>
          <Plus size={14} /> {addLabel}
        </button>
      </div>
      <div className="cx-dynamic-list">
        {rows.map((row, index) => (
          <div className="cx-dynamic-row" key={index}>
            {children(row, index)}
            {rows.length > 1 && (
              <button className="cx-icon-btn" type="button" aria-label={`Remove ${title} row ${index + 1}`} onClick={() => onRemove(index)}>
                <X size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function NewCarePlanForm() {
  const router = useRouter();
  const search = useSearchParams();
  const residentId = search.get("residentId");
  const residentName = search.get("residentName") || "Resident";
  const room = search.get("room") || "";

  const [v, setV] = useState({
    title: "",
    status: "draft",
    summary: "",
    owner: "",
    reviewCycle: "Quarterly",
    reviewedAt: "",
    nextReviewAt: "",
    goals: [{ ...EMPTY_GOAL }],
    objectives: [{ ...EMPTY_OBJECTIVE }],
    interventions: [{ ...EMPTY_INTERVENTION }],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (value) => setV((s) => ({ ...s, [key]: value }));
  const updateRow = (key, index, field, value) =>
    setV((s) => ({ ...s, [key]: s[key].map((r, i) => (i === index ? { ...r, [field]: value } : r)) }));
  const addRow = (key, row) => setV((s) => ({ ...s, [key]: [...s[key], row] }));
  const removeRow = (key, index) => setV((s) => ({ ...s, [key]: s[key].filter((_, i) => i !== index) }));

  if (!residentId) {
    return (
      <div className="cx-wide">
        <EmptyState
          icon={HeartPulse}
          title="No resident selected"
          note="Start a care plan from the care plans page so a resident is attached."
          action={<Link href="/admin/care-plans" className="cx-btn cx-btn-primary" style={{ textDecoration: "none" }}>Back to care plans</Link>}
        />
      </div>
    );
  }

  async function onSave() {
    if (!v.title.trim()) {
      setError("Add a plan focus / title before saving.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const content = {
        owner: v.owner.trim() || "Care team",
        reviewCycle: v.reviewCycle,
        effectiveDate: v.reviewedAt || new Date().toISOString().slice(0, 10),
        goals: v.goals.filter((g) => g.title.trim()).map((g) => ({ title: g.title.trim(), progress: g.progress || "On track" })),
        objectives: v.objectives.filter((o) => o.title.trim()).map((o) => ({ title: o.title.trim(), goal: o.goal.trim(), cadence: o.cadence.trim() })),
        interventions: v.interventions.filter((i) => i.title.trim()).map((i) => ({ title: i.title.trim(), owner: i.owner.trim(), frequency: i.frequency.trim() })),
        reviews: [],
      };
      const created = await apiData("/api/v1/care-plans", {
        method: "POST",
        body: JSON.stringify({
          residentId,
          title: v.title.trim(),
          status: v.status,
          summary: v.summary.trim() || null,
          reviewedAt: v.reviewedAt || null,
          nextReviewAt: v.nextReviewAt || null,
          goals: content,
        }),
      });
      router.push(`/admin/care-plans/${created.id}`);
    } catch (err) {
      setSaving(false);
      setError(err.message || "Unable to create the care plan.");
    }
  }

  return (
    <div className="cx-wide">
      <Link href="/admin/care-plans" className="cx-link" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
        <ArrowLeft size={14} /> Care plans
      </Link>

      <PageHeader eyebrow="New care plan" title={`Care plan for ${residentName}`} lede="Capture the plan focus, goals, objectives, and interventions. The plan is stored and viewable in the resident's care plan record." />

      <div className="cx-panel" style={{ padding: 20, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <Avatar name={residentName} round />
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{residentName}</div>
            {room && <div style={{ marginTop: 5, fontSize: 12.5, color: "var(--cx-muted)" }}>Room {room}</div>}
          </div>
        </div>
      </div>

      <Panel title="Plan details" pad>
        <div className="cx-grid">
          <TextField label="Plan focus / title" required span2 value={v.title} onChange={set("title")} placeholder="e.g. Fall prevention & mobility" />
          <SelectField label="Status" value={v.status} onChange={set("status")} options={["draft", "active"]} />
          <TextField label="Plan owner" value={v.owner} onChange={set("owner")} placeholder="e.g. Care Coordinator" />
          <SelectField label="Review cycle" value={v.reviewCycle} onChange={set("reviewCycle")} options={["Weekly", "Monthly", "Quarterly", "Biannual", "Annual", "As needed"]} />
          <TextField label="Effective / reviewed date" type="date" value={v.reviewedAt} onChange={set("reviewedAt")} />
          <TextField label="Next review date" type="date" value={v.nextReviewAt} onChange={set("nextReviewAt")} />
          <TextAreaField label="Plan overview / current focus" value={v.summary} onChange={set("summary")} placeholder="Short narrative summary of the plan's current focus." />
        </div>
      </Panel>

      <div style={{ height: 18 }} />

      <Panel title="Goals, objectives & interventions" pad>
        <div className="cx-grid">
          <DynamicRows title="Goals" addLabel="Add goal" rows={v.goals} onAdd={() => addRow("goals", { ...EMPTY_GOAL })} onRemove={(i) => removeRow("goals", i)}>
            {(row, index) => (
              <>
                <input className="cx-input" value={row.title} onChange={(e) => updateRow("goals", index, "title", e.target.value)} placeholder="Goal" />
                <select className="cx-select" value={row.progress} onChange={(e) => updateRow("goals", index, "progress", e.target.value)} aria-label="Progress">
                  <option>On track</option>
                  <option>In progress</option>
                  <option>At risk</option>
                  <option>Met</option>
                </select>
              </>
            )}
          </DynamicRows>

          <DynamicRows title="Objectives" addLabel="Add objective" rows={v.objectives} onAdd={() => addRow("objectives", { ...EMPTY_OBJECTIVE })} onRemove={(i) => removeRow("objectives", i)}>
            {(row, index) => (
              <>
                <input className="cx-input" value={row.title} onChange={(e) => updateRow("objectives", index, "title", e.target.value)} placeholder="Objective" />
                <input className="cx-input" value={row.goal} onChange={(e) => updateRow("objectives", index, "goal", e.target.value)} placeholder="Linked goal" />
                <input className="cx-input" value={row.cadence} onChange={(e) => updateRow("objectives", index, "cadence", e.target.value)} placeholder="Cadence" />
              </>
            )}
          </DynamicRows>

          <DynamicRows title="Interventions" addLabel="Add intervention" rows={v.interventions} onAdd={() => addRow("interventions", { ...EMPTY_INTERVENTION })} onRemove={(i) => removeRow("interventions", i)}>
            {(row, index) => (
              <>
                <input className="cx-input" value={row.title} onChange={(e) => updateRow("interventions", index, "title", e.target.value)} placeholder="Intervention" />
                <input className="cx-input" value={row.owner} onChange={(e) => updateRow("interventions", index, "owner", e.target.value)} placeholder="Owner" />
                <input className="cx-input" value={row.frequency} onChange={(e) => updateRow("interventions", index, "frequency", e.target.value)} placeholder="Frequency" />
              </>
            )}
          </DynamicRows>
        </div>
      </Panel>

      <div className="cx-actionbar" style={{ marginTop: 18 }}>
        <span className="cx-ab-info">
          <Target size={15} strokeWidth={2} color="#0E7C66" />
          {error || "Save to create the care plan and open the resident's plan record."}
        </span>
        <span className="cx-ab-spacer" />
        <Link href="/admin/care-plans" className="cx-btn cx-btn-quiet" style={{ textDecoration: "none" }}>Cancel</Link>
        <button className="cx-btn cx-btn-primary" type="button" onClick={onSave} disabled={saving}>
          {saving ? <><Loader2 size={15} className="cx-spin" /> Saving...</> : <>Create care plan</>}
        </button>
      </div>
    </div>
  );
}

export default function NewCarePlanPage() {
  return (
    <Suspense fallback={<div className="cx-wide"><EmptyState icon={HeartPulse} title="Loading" note="Preparing the care plan form..." /></div>}>
      <NewCarePlanForm />
    </Suspense>
  );
}
