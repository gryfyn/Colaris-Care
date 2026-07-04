"use client";

import { useRef, useState } from "react";
import { Loader2, UploadCloud, X } from "lucide-react";
import { TextField, SelectField, TextAreaField } from "@/components/ui/fields";
import { getAccessToken } from "@/lib/client-auth";

// Generic "add record" overlay. The caller supplies a field config and an
// async onSubmit(values) that POSTs to the API; on success the caller closes
// the modal and refetches. Field shape:
//   { name, label, type?: 'text'|'tel'|'email'|'date'|'datetime-local'|'number'|'select'|'textarea',
//     required?, options?, placeholder?, span2?, default? }
//
// Optional `parse` enables upload-to-autofill: { endpoint, toValues, label? }.
// The file is POSTed (multipart, field `file`) to `endpoint`; the response
// `{ data }` is passed to `toValues(data)` which returns a partial map of
// field-name -> value. Only non-empty values overwrite current entries.
export default function RecordFormModal({ eyebrow, title, fields, submitLabel = "Save", onClose, onSubmit, parse }) {
  const [v, setV] = useState(() => Object.fromEntries(fields.map((f) => [f.name, f.default ?? ""])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importNote, setImportNote] = useState("");
  const fileRef = useRef(null);
  const set = (name) => (val) => setV((s) => ({ ...s, [name]: val }));

  async function onUpload(event) {
    const file = event.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file || !parse?.endpoint) return;
    setImporting(true);
    setError("");
    setImportNote("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const token = getAccessToken();
      const res = await fetch(parse.endpoint, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Could not read the document.");
      const data = payload.data || {};
      const values = (parse.toValues ? parse.toValues(data) : {}) || {};
      setV((s) => {
        const next = { ...s };
        for (const [key, val] of Object.entries(values)) {
          if (val !== undefined && val !== null && val !== "") next[key] = val;
        }
        return next;
      });
      setImportNote(data.parsed === false ? (data.warning || "Attached — complete the fields.") : "Imported from document. Review the fields before saving.");
    } catch (e) {
      setError(e.message || "Upload failed.");
    } finally {
      setImporting(false);
    }
  }

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
          {parse?.endpoint && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: 14, border: "1px solid var(--cx-line)", borderRadius: 10, background: "var(--cx-tint, #f4f8ff)" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--cx-ink)" }}>{parse.label || "Upload a document to auto-fill"}</div>
                  <div style={{ fontSize: 12, color: "var(--cx-faint)" }}>PDF, Word, or a photo/scan — handwriting is read too.</div>
                </div>
                <input ref={fileRef} type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*" onChange={onUpload} style={{ display: "none" }} />
                <button type="button" className="cx-btn cx-btn-ghost" disabled={importing || saving} onClick={() => fileRef.current?.click()}>
                  {importing ? <><Loader2 size={15} className="cx-spin" /> Reading...</> : <><UploadCloud size={15} /> Upload</>}
                </button>
              </div>
              {importNote && <div style={{ marginTop: 8, fontSize: 12.5, color: "#047857", background: "#ecfdf5", border: "1px solid #6ee7b7", borderRadius: 8, padding: "8px 12px" }}>{importNote}</div>}
            </div>
          )}
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
