"use client";

import { useState } from "react";
import { Building2, Loader2, X } from "lucide-react";
import { createFacility } from "@/lib/facilities-client";

const inp = { width: "100%", padding: "9px 12px", border: "1px solid var(--cx-line)", borderRadius: 8, fontSize: 13.5, background: "var(--cx-surface, #fff)", color: "var(--cx-ink)", outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const lbl = { display: "block", fontSize: 11, fontWeight: 700, color: "var(--cx-ink)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" };

// Add a new home (facility). On success calls onCreated(newFacility).
export default function AddFacilityModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!name.trim()) return setError("Enter a facility name.");
    setSaving(true);
    setError("");
    try {
      const created = await createFacility(name.trim());
      onCreated?.(created);
    } catch (err) {
      setSaving(false);
      setError(err.message || "Could not add the home.");
    }
  }

  return (
    <div className="cx-ob-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Add a home" className="cx-panel" style={{ width: "min(440px, 95vw)", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid var(--cx-line)" }}>
          <div>
            <div className="cx-eyebrow">Facilities</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--cx-ink)" }}>Add a home</div>
          </div>
          <button type="button" className="cx-icon-btn" aria-label="Close" onClick={onClose} disabled={saving}><X size={17} /></button>
        </div>
        <div style={{ padding: 18 }}>
          <label style={lbl}>Facility name</label>
          <div style={{ position: "relative" }}>
            <Building2 size={15} style={{ position: "absolute", left: 11, top: 10, color: "var(--cx-faint)" }} />
            <input style={{ ...inp, paddingLeft: 34 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cedar House" autoFocus onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
          </div>
          <p className="cx-settings-help" style={{ marginTop: 10 }}>The new home is created under your organization and you are added as its admin. You can switch to it from the facility menu.</p>
        </div>
        <div className="cx-actionbar" style={{ marginTop: 0 }}>
          <span className="cx-ab-info" style={{ color: error ? "var(--cx-danger, #b42318)" : undefined }}>{error || "You can have up to 3 homes."}</span>
          <span className="cx-ab-spacer" />
          <button type="button" className="cx-btn cx-btn-quiet" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="cx-btn cx-btn-primary" onClick={submit} disabled={saving}>
            {saving ? <><Loader2 size={15} className="cx-spin" /> Adding...</> : "Add home"}
          </button>
        </div>
      </div>
    </div>
  );
}
