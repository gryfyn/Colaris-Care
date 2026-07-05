"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Check, Loader2, Plus } from "lucide-react";
import { fetchFacilities, switchFacility } from "@/lib/facilities-client";
import AddFacilityModal from "@/components/app/AddFacilityModal";

// Sidebar "Facilities" section: lists the user's homes (click to switch, active
// one marked) and, for admins, an "Add home" action. Mirrors the nav link look
// so it collapses with the sidebar (`.cx-nav-text`).
export default function FacilitiesNav({ homeHref = "/admin/dashboard" }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    fetchFacilities().then(setData).catch(() => setData(null));
  }, []);

  useEffect(() => { load(); }, [load]);

  const facilities = data?.facilities || [];
  if (!facilities.length && !data?.canAdd) return null;

  async function onSwitch(id) {
    if (busy || id === data?.currentFacilityId) return;
    setBusy(id);
    try {
      await switchFacility(id);
      window.location.assign(homeHref);
    } catch {
      setBusy("");
    }
  }

  const itemStyle = (active) => ({
    display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
    padding: "8px 12px", border: "none", background: "transparent", borderRadius: 8,
    cursor: busy ? "default" : "pointer", font: "inherit", fontSize: 13.5,
    color: active ? "var(--cx-accent, #1a56db)" : "var(--cx-ink)", fontWeight: active ? 700 : 500,
  });

  return (
    <div>
      <div className="cx-nav-label">Facilities</div>
      {facilities.map((f) => (
        <button key={f.id} type="button" className={f.current ? "cx-on" : undefined} title={f.name} disabled={Boolean(busy)} onClick={() => onSwitch(f.id)} style={itemStyle(f.current)}>
          <Building2 size={17} strokeWidth={1.9} style={{ flexShrink: 0 }} />
          <span className="cx-nav-text" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
          {busy === f.id ? <Loader2 size={14} className="cx-spin" /> : f.current ? <Check size={15} /> : null}
        </button>
      ))}
      {data?.canAdd && (
        <button type="button" title="Add a home" onClick={() => setAdding(true)} style={{ ...itemStyle(false), color: "var(--cx-faint)" }}>
          <Plus size={17} strokeWidth={1.9} style={{ flexShrink: 0 }} />
          <span className="cx-nav-text">Add a home</span>
        </button>
      )}
      {adding && <AddFacilityModal onClose={() => setAdding(false)} onCreated={() => { setAdding(false); load(); }} />}
    </div>
  );
}
