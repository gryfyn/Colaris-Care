"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { getAccessToken } from "@/lib/client-auth";
import { apiData } from "@/lib/client-api";
import { NOTE_SECTIONS, SHIFTS, emptyNoteBody, normalizeNoteBody } from "@/lib/progress-notes-schema";

const lbl = { display: "block", fontSize: 11, fontWeight: 700, color: "var(--cx-ink)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" };
const inp = { width: "100%", padding: "9px 12px", border: "1px solid var(--cx-line)", borderRadius: 8, fontSize: 13.5, background: "var(--cx-surface, #fff)", color: "var(--cx-ink)", outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const secHead = { fontSize: 12, fontWeight: 700, color: "var(--cx-ink)", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.05em" };
const box = { border: "1px solid var(--cx-line)", borderRadius: 10, padding: 16, marginBottom: 14, background: "var(--cx-surface, #fff)" };

function Checks({ options, selected, onToggle }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <label key={o} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--cx-ink)", cursor: "pointer" }}>
            <span
              onClick={() => onToggle(o)}
              style={{ width: 17, height: 17, borderRadius: 4, border: `1.5px solid ${on ? "var(--cx-accent, #1a56db)" : "var(--cx-line)"}`, background: on ? "var(--cx-accent, #1a56db)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff", fontSize: 11 }}
            >
              {on && "✓"}
            </span>
            {o}
          </label>
        );
      })}
    </div>
  );
}

// Modal that files one structured daily progress note. `resident` (optional)
// locks the note to a resident chosen from the worklist; otherwise the caller
// passes `residentOptions` for the dropdown. On success calls onSaved().
export default function DailyProgressNoteModal({ resident, residentOptions = [], defaultDate, onClose, onSaved }) {
  const [residentId, setResidentId] = useState(resident?.id || "");
  const [date, setDate] = useState(defaultDate || new Date().toISOString().split("T")[0]);
  const [shift, setShift] = useState("");
  const [approverName, setApproverName] = useState("");
  const [body, setBody] = useState(emptyNoteBody);
  const [source, setSource] = useState("manual");

  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileRef = useRef(null);

  const setField = (key) => (value) => setBody((b) => ({ ...b, [key]: value }));
  const toggle = (key) => (opt) => setBody((b) => ({ ...b, [key]: b[key].includes(opt) ? b[key].filter((x) => x !== opt) : [...b[key], opt] }));

  async function onUpload(e) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setParsing(true);
    setError("");
    setNotice("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const token = getAccessToken();
      const res = await fetch("/api/v1/daily-progress-notes/parse", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Could not parse the document.");
      const data = payload.data || {};
      setBody(normalizeNoteBody(data.noteBody));
      if (data.shift) setShift(data.shift);
      if (data.noteDate) setDate(data.noteDate);
      setSource("upload");
      setNotice(
        data.parsed
          ? `Imported from "${file.name}". Review every field before submitting.${data.residentName ? ` Detected resident: ${data.residentName}.` : ""}`
          : data.warning || "Document text imported; please complete the fields."
      );
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      setParsing(false);
    }
  }

  async function submit() {
    if (!residentId) return setError("Select a resident.");
    if (!date) return setError("Choose a date.");
    if (!shift) return setError("Select a shift.");
    if (!body.progressNotes.trim()) return setError("Progress Notes is required.");
    setSaving(true);
    setError("");
    try {
      await apiData("/api/v1/daily-progress-notes", {
        method: "POST",
        body: JSON.stringify({ residentId, noteDate: date, shift, noteBody: body, approverName: approverName || null, source }),
      });
      onSaved?.();
    } catch (err) {
      setSaving(false);
      setError(err.message || "Unable to submit.");
    }
  }

  return (
    <div className="cx-ob-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget && !saving && !parsing) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Daily progress note" className="cx-panel" style={{ width: "min(760px, 96vw)", maxHeight: "90vh", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid var(--cx-line)" }}>
          <div>
            <div className="cx-eyebrow">Clinical documentation</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--cx-ink)" }}>Daily progress note{resident ? ` — ${resident.name}` : ""}</div>
          </div>
          <button type="button" className="cx-icon-btn" aria-label="Close" onClick={onClose} disabled={saving || parsing}><X size={17} /></button>
        </div>

        <div style={{ overflowY: "auto", padding: 18 }}>
          {/* Upload / AI import */}
          <div style={{ ...box, background: "var(--cx-tint, #f4f8ff)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--cx-ink)" }}>Upload a note to auto-fill</div>
              <div style={{ fontSize: 12, color: "var(--cx-faint)" }}>PDF or Word — fields are extracted with AI for you to review.</div>
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={onUpload} style={{ display: "none" }} />
            <button type="button" className="cx-btn cx-btn-ghost" disabled={parsing || saving} onClick={() => fileRef.current?.click()}>
              {parsing ? <><Loader2 size={15} className="cx-spin" /> Reading...</> : <><Upload size={15} /> Upload PDF / Word</>}
            </button>
          </div>

          {/* Note info */}
          <div style={box}>
            <h4 style={secHead}>Note information</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
              <div>
                <label style={lbl}>Resident</label>
                {resident ? (
                  <input style={{ ...inp, fontWeight: 600 }} value={resident.name} readOnly />
                ) : (
                  <select style={inp} value={residentId} onChange={(e) => setResidentId(e.target.value)}>
                    <option value="">Select a resident...</option>
                    {residentOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label style={lbl}>Date</label>
                <input style={inp} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Shift</label>
                <select style={inp} value={shift} onChange={(e) => setShift(e.target.value)}>
                  <option value="">Select shift...</option>
                  {SHIFTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Body sections */}
          {NOTE_SECTIONS.map((section) => (
            <div key={section.title} style={box}>
              <h4 style={secHead}>{section.title}</h4>
              <div style={section.title === "Meal Intake" ? { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 } : undefined}>
                {section.fields.map((f) => {
                  if (f.kind === "checks") return <div key={f.key}><Checks options={f.options} selected={body[f.key]} onToggle={toggle(f.key)} /></div>;
                  if (f.kind === "long") return (
                    <div key={f.key}>
                      <textarea style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} rows={f.key === "progressNotes" ? 6 : 4} value={body[f.key]} onChange={(e) => setField(f.key)(e.target.value)} placeholder={f.required ? "Required — document observations, changes, and care provided..." : "Optional"} />
                    </div>
                  );
                  if (f.kind === "percent") return (
                    <div key={f.key}>
                      <label style={lbl}>{f.label}</label>
                      <input style={inp} type="number" min="0" max="100" value={body[f.key]} onChange={(e) => setField(f.key)(e.target.value)} placeholder="0" />
                    </div>
                  );
                  return (
                    <div key={f.key}>
                      <label style={lbl}>{f.label}</label>
                      <input style={inp} value={body[f.key]} onChange={(e) => setField(f.key)(e.target.value)} placeholder="Optional" />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Approver */}
          <div style={box}>
            <h4 style={secHead}>Approver</h4>
            <label style={lbl}>Approved by (name)</label>
            <input style={inp} value={approverName} onChange={(e) => setApproverName(e.target.value)} placeholder="Reviewing supervisor / co-signer (optional)" />
          </div>

          {notice && <div style={{ background: "#ecfdf5", border: "1px solid #6ee7b7", borderRadius: 8, padding: "10px 14px", fontSize: 12.5, color: "#047857", marginBottom: 4 }}>{notice}</div>}
        </div>

        <div className="cx-actionbar" style={{ marginTop: 0 }}>
          <span className="cx-ab-info" style={{ color: error ? "var(--cx-danger, #b42318)" : undefined }}>{error || "Resident, date, shift and Progress Notes are required."}</span>
          <span className="cx-ab-spacer" />
          <button type="button" className="cx-btn cx-btn-quiet" onClick={onClose} disabled={saving || parsing}>Cancel</button>
          <button type="button" className="cx-btn cx-btn-primary" onClick={submit} disabled={saving || parsing}>
            {saving ? <><Loader2 size={15} className="cx-spin" /> Submitting...</> : "Submit note"}
          </button>
        </div>
      </div>
    </div>
  );
}
