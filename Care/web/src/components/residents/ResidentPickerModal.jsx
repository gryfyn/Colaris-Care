"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Search, UserRound, X } from "lucide-react";
import { Avatar, EmptyState } from "@/components/ui/data";
import { apiData } from "@/lib/client-api";

// Shared overlay to find and pick a resident from the facility directory.
// `onSelect(resident)` is called with the chosen resident; the caller decides
// what to do (route to a form, POST an assignment, etc.). `busy` disables rows
// while the caller processes a selection.
export default function ResidentPickerModal({ eyebrow = "Select", title = "Select a resident", onClose, onSelect, busy = false }) {
  const [q, setQ] = useState("");
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const data = await apiData("/api/v1/residents");
        if (alive) setResidents(Array.isArray(data) ? data : []);
      } catch (err) {
        if (alive) setError(err.message || "Unable to load residents.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const rows = useMemo(() => {
    const search = q.trim().toLowerCase();
    return residents.filter((r) => {
      const name = r.name || `${r.firstName || ""} ${r.lastName || ""}`.trim();
      return !search || [name, r.room, r.careLevel].some((value) => String(value || "").toLowerCase().includes(search));
    });
  }, [q, residents]);

  return (
    <div className="cx-ob-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className="cx-panel" style={{ width: "min(560px, 94vw)", maxHeight: "82vh", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid var(--cx-line)" }}>
          <div>
            <div className="cx-eyebrow">{eyebrow}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--cx-ink)" }}>{title}</div>
          </div>
          <button type="button" className="cx-icon-btn" aria-label="Close" onClick={onClose} disabled={busy}><X size={17} /></button>
        </div>

        <div style={{ padding: "14px 18px 6px" }}>
          <div className="cx-search" style={{ width: "100%" }}>
            <Search size={15} />
            <input autoFocus aria-label="Search residents" placeholder="Search by name, room, or care level..." value={q} onChange={(event) => setQ(event.target.value)} />
          </div>
        </div>

        <div style={{ overflowY: "auto", padding: "6px 10px 14px" }}>
          {loading ? (
            <EmptyState icon={UserRound} title="Loading residents" note="Fetching the resident directory..." />
          ) : error ? (
            <EmptyState icon={UserRound} title="Could not load residents" note={error} />
          ) : rows.length ? (
            <div className="cx-feed">
              {rows.map((resident) => {
                const name = resident.name || `${resident.firstName || ""} ${resident.lastName || ""}`.trim();
                return (
                  <button
                    type="button"
                    key={resident.id}
                    className="cx-feed-item"
                    style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1 }}
                    disabled={busy}
                    onClick={() => onSelect(resident)}
                  >
                    <Avatar name={name} round sm />
                    <div className="cx-feed-main">
                      <div className="cx-feed-t">{name}</div>
                      <div className="cx-feed-s">Room {resident.room || "pending"}{resident.careLevel ? ` · ${resident.careLevel}` : ""}</div>
                    </div>
                    <ArrowRight size={16} color="var(--cx-faint)" />
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={UserRound} title="No residents found" note={q ? "Try a different search." : "Admit a resident first."} />
          )}
        </div>
      </div>
    </div>
  );
}
