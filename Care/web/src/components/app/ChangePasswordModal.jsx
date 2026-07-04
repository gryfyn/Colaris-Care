"use client";

import { useState } from "react";
import { Check, Loader2, LockKeyhole, X } from "lucide-react";
import { apiData } from "@/lib/client-api";

const lbl = { display: "block", fontSize: 11, fontWeight: 700, color: "var(--cx-ink)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" };
const inp = { width: "100%", padding: "9px 12px", border: "1px solid var(--cx-line)", borderRadius: 8, fontSize: 13.5, background: "var(--cx-surface, #fff)", color: "var(--cx-ink)", outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

// Self-service password change. POSTs to /api/auth/change-password.
export default function ChangePasswordModal({ onClose }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit() {
    if (!current || !next) return setError("Enter your current and new password.");
    if (next.length < 8) return setError("New password must be at least 8 characters.");
    if (next !== confirm) return setError("New passwords do not match.");
    setSaving(true);
    setError("");
    try {
      await apiData("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      setDone(true);
    } catch (err) {
      setSaving(false);
      setError(err.message || "Could not change your password.");
    }
  }

  return (
    <div className="cx-ob-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Change password" className="cx-panel" style={{ width: "min(460px, 95vw)", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid var(--cx-line)" }}>
          <div>
            <div className="cx-eyebrow">Security</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--cx-ink)" }}>Change password</div>
          </div>
          <button type="button" className="cx-icon-btn" aria-label="Close" onClick={onClose} disabled={saving}><X size={17} /></button>
        </div>

        {done ? (
          <div style={{ padding: 22, textAlign: "center" }}>
            <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#ecfdf5", color: "#047857", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}><Check size={24} /></div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--cx-ink)" }}>Password changed</div>
            <p style={{ fontSize: 13, color: "var(--cx-faint)", margin: "6px 0 18px" }}>Your new password is now active.</p>
            <button type="button" className="cx-btn cx-btn-primary" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ padding: 18, display: "grid", gap: 14 }}>
              <div>
                <label style={lbl}>Current password</label>
                <div style={{ position: "relative" }}>
                  <LockKeyhole size={15} style={{ position: "absolute", left: 11, top: 10, color: "var(--cx-faint)" }} />
                  <input style={{ ...inp, paddingLeft: 34 }} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
                </div>
              </div>
              <div>
                <label style={lbl}>New password</label>
                <input style={inp} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="At least 8 characters" />
              </div>
              <div>
                <label style={lbl}>Confirm new password</label>
                <input style={inp} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
            </div>
            <div className="cx-actionbar" style={{ marginTop: 0 }}>
              <span className="cx-ab-info" style={{ color: error ? "var(--cx-danger, #b42318)" : undefined }}>{error || "Use a strong password you don't reuse elsewhere."}</span>
              <span className="cx-ab-spacer" />
              <button type="button" className="cx-btn cx-btn-quiet" onClick={onClose} disabled={saving}>Cancel</button>
              <button type="button" className="cx-btn cx-btn-primary" onClick={submit} disabled={saving}>
                {saving ? <><Loader2 size={15} className="cx-spin" /> Saving...</> : "Change password"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
