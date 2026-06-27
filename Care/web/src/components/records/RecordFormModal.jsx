"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { TextField, SelectField, TextAreaField } from "@/components/ui/fields";

// Generic "add record" overlay. The caller supplies a field config and an
// async onSubmit(values) that POSTs to the API; on success the caller closes
// the modal and refetches. Field shape:
//   { name, label, type?: 'text'|'tel'|'email'|'date'|'datetime-local'|'number'|'select'|'textarea',
//     required?, options?, placeholder?, span2?, default? }
export default function RecordFormModal({ eyebrow, title, fields, submitLabel = "Save", onClose, onSubmit }) {
  const [v, setV] = useState(() => Object.fromEntries(fields.map((f) => [f.name, f.default ?? ""])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (name) => (val) => setV((s) => ({ ...s, [name]: val }));

  async function submit() {
    const missing = fields.find((f) => f.required && !String(v[f.name] ?? "").trim());
    if (missing) { setError(`${missing.label} is required`); return; }
    setSaving(true);
    setError("");
    try {
      await onSubmit(v);
      // onSubmit is expected to close the modal on success.
    } catch (e) {
      setSaving(false);
      setError(e.message || "Unable to save.");
    }
  }

  return (
    <div className="cx-ob-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className="cx-panel" style={{ width: "min(620px, 95vw)", maxHeight: "88vh", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid var(--cx-line)" }}>
          <div>
            {eyebrow && <div className="cx-eyebrow">{eyebrow}</div>}
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--cx-ink)" }}>{title}</div>
          </div>
          <button type="button" className="cx-icon-btn" aria-label="Close" onClick={onClose} disabled={saving}><X size={17} /></button>
        </div>

        <div style={{ overflowY: "auto", padding: 18 }}>
          <div className="cx-grid">
            {fields.map((f) => {
              const common = { key: f.name, label: f.label, value: v[f.name], onChange: set(f.name), required: f.required, span2: f.span2 };
              if (f.type === "select") return <SelectField {...common} options={f.options || []} placeholder={f.placeholder} />;
              if (f.type === "textarea") return <TextAreaField {...common} placeholder={f.placeholder} />;
              return <TextField {...common} type={f.type || "text"} placeholder={f.placeholder} />;
            })}
          </div>
        </div>

        <div className="cx-actionbar" style={{ marginTop: 0 }}>
          <span className="cx-ab-info" style={{ color: error ? "var(--cx-danger, #b42318)" : undefined }}>{error || "All fields marked * are required."}</span>
          <span className="cx-ab-spacer" />
          <button type="button" className="cx-btn cx-btn-quiet" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="cx-btn cx-btn-primary" onClick={submit} disabled={saving}>
            {saving ? <><Loader2 size={15} className="cx-spin" /> Saving...</> : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
