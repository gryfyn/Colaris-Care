"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, Check, ChevronDown, Loader2, Plus } from "lucide-react";
import { fetchFacilities, switchFacility } from "@/lib/facilities-client";
import AddFacilityModal from "@/components/app/AddFacilityModal";

// Top-bar facility switcher: shows the active home's name; the dropdown lists the
// user's homes (click to switch) and, for admins, an "Add home" action. On switch
// it reloads to the dashboard so all data refetches under the new facility.
export default function FacilitySwitcher({ homeHref = "/admin/dashboard" }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState("");
  const [adding, setAdding] = useState(false);
  const ref = useRef(null);

  const load = useCallback(() => {
    fetchFacilities().then(setData).catch(() => setData(null));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const facilities = data?.facilities || [];
  const currentName = facilities.find((f) => f.current)?.name || "Facility";
  const interactive = facilities.length > 1 || Boolean(data?.canAdd);

  async function onSwitch(id) {
    if (busy || id === data?.currentFacilityId) { setOpen(false); return; }
    setBusy(id);
    try {
      await switchFacility(id);
      window.location.assign(homeHref);
    } catch {
      setBusy("");
    }
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" className="cx-facility" aria-haspopup={interactive ? "listbox" : undefined} aria-expanded={interactive ? open : undefined} onClick={() => interactive && setOpen((o) => !o)} title={currentName} style={{ cursor: interactive ? "pointer" : "default" }}>
        <span className="cx-dot" />
        <Building2 size={14} strokeWidth={1.9} />
        <span style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentName}</span>
        {interactive && <ChevronDown size={14} strokeWidth={2} />}
      </button>

      {open && interactive && (
        <div role="listbox" aria-label="Switch facility" style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 264, background: "var(--cx-surface, #fff)", border: "1px solid var(--cx-line)", borderRadius: 12, boxShadow: "0 14px 34px rgba(15,23,42,0.16)", zIndex: 60, padding: 8 }}>
          <div style={{ padding: "4px 8px 8px", fontSize: 10.5, fontWeight: 700, color: "var(--cx-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Your homes</div>
          {facilities.map((f) => (
            <button
              key={f.id}
              type="button"
              role="option"
              aria-selected={f.current}
              disabled={Boolean(busy)}
              onClick={() => onSwitch(f.id)}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "8px 10px", border: "none", background: f.current ? "var(--cx-tint, #f4f8ff)" : "transparent", borderRadius: 8, cursor: busy ? "default" : "pointer", font: "inherit", color: "var(--cx-ink)" }}
              onMouseEnter={(e) => { if (!f.current) e.currentTarget.style.background = "var(--cx-tint, #f4f8ff)"; }}
              onMouseLeave={(e) => { if (!f.current) e.currentTarget.style.background = "transparent"; }}
            >
              <Building2 size={15} style={{ color: "var(--cx-faint)", flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: f.current ? 700 : 500, fontSize: 13 }}>{f.name}</span>
              {busy === f.id ? <Loader2 size={14} className="cx-spin" /> : f.current ? <Check size={15} style={{ color: "var(--cx-accent, #1a56db)" }} /> : null}
            </button>
          ))}
          {data?.canAdd && (
            <>
              <div style={{ height: 1, background: "var(--cx-line)", margin: "6px 4px" }} />
              <button type="button" onClick={() => { setOpen(false); setAdding(true); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "8px 10px", border: "none", background: "transparent", borderRadius: 8, cursor: "pointer", font: "inherit", color: "var(--cx-accent, #1a56db)", fontWeight: 600, fontSize: 13 }}>
                <Plus size={15} /> Add a home
              </button>
            </>
          )}
        </div>
      )}

      {adding && <AddFacilityModal onClose={() => setAdding(false)} onCreated={() => { setAdding(false); load(); }} />}
    </div>
  );
}
