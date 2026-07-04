"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronDown, FileText, Plus, Search, Users } from "lucide-react";
import { Avatar, Badge, EmptyState, PageHeader, StatCard } from "@/components/ui/data";
import { apiData } from "@/lib/client-api";
import { buildFaceSheets } from "@/lib/face-sheet-client";
import { FACE_SHEETS } from "./data";

const FILTERS = ["All", "Current", "Review due", "Discharged"];

export default function FaceSheetsPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [sheets, setSheets] = useState(FACE_SHEETS);
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([apiData("/api/v1/residents"), apiData("/api/v1/documents")])
      .then(([residents, documents]) => {
        if (!mounted) return;
        setResidents(Array.isArray(residents) ? residents : []);
        setSheets(buildFaceSheets(residents, documents));
      })
      .catch(() => {
        if (mounted) setSheets(FACE_SHEETS);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const rows = useMemo(() => sheets.filter((sheet) => {
    const search = query.trim().toLowerCase();
    const matchesFilter = filter === "All" || sheet.status === filter;
    const searchable = [
      sheet.name,
      sheet.room,
      sheet.careLevel,
      sheet.primaryContact?.name,
      sheet.primaryContact?.relationship,
    ].filter(Boolean);
    return matchesFilter && (!search || searchable.some((value) => value.toLowerCase().includes(search)));
  }), [filter, query, sheets]);

  const currentCount = sheets.filter((sheet) => sheet.status === "Current").length;
  const dueCount = sheets.filter((sheet) => sheet.status === "Review due").length;
  const careLevels = new Set(sheets.map((sheet) => sheet.careLevel).filter(Boolean)).size;
  const openSheet = (id) => router.push(`/admin/face-sheets/${id}`);

  return (
    <div className="cx-wide">
      <PageHeader
        eyebrow="Clinical summary"
        title="Face sheets"
        lede="Printable resident summaries sourced from live records with protected values masked."
        action={<AddFaceSheet residents={residents} onPick={openSheet} />}
      />

      <div className="cx-stats">
        <StatCard icon={FileText} label="Face sheets" value={sheets.length} />
        <StatCard icon={FileText} label="Current" value={currentCount} delta={loading ? "loading" : "ready"} deltaDir="up" />
        <StatCard icon={FileText} label="Review due" value={dueCount} />
        <StatCard icon={Users} label="Care levels" value={careLevels} />
      </div>

      <div className="cx-toolbar">
        <div className="cx-search">
          <Search size={15} />
          <input
            aria-label="Search face sheets"
            placeholder="Search by resident, room, care level, or contact..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="cx-chips" aria-label="Filter face sheets by status">
          {FILTERS.map((item) => (
            <button
              type="button"
              key={item}
              className="cx-chip"
              data-on={filter === item ? "true" : "false"}
              aria-pressed={filter === item}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <span className="cx-tb-spacer" />
        <span style={{ fontSize: 12.5, color: "var(--cx-faint)" }}>
          {rows.length} face sheet{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="cx-tablewrap">
        {rows.length ? (
          <div className="cx-tblscroll">
            <table className="cx-tbl">
              <thead>
                <tr>
                  <th>Resident</th><th>Room</th><th>Care level</th>
                  <th className="cx-hide-sm">Primary contact</th>
                  <th className="cx-hide-sm">Documents</th><th>Status</th>
                  <th aria-label="Open face sheet" />
                </tr>
              </thead>
              <tbody>
                {rows.map((sheet) => (
                  <tr
                    key={sheet.id}
                    data-click="true"
                    role="link"
                    tabIndex={0}
                    aria-label={`Open ${sheet.name}'s face sheet`}
                    onClick={() => openSheet(sheet.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openSheet(sheet.id);
                      }
                    }}
                  >
                    <td><div className="cx-cellname"><Avatar name={sheet.name} round /><b>{sheet.name}</b></div></td>
                    <td className="cx-tnum">{sheet.room}</td>
                    <td>{sheet.careLevel}</td>
                    <td className="cx-hide-sm">
                      <div>{sheet.primaryContact?.name || "On file"}</div>
                      <div className="cx-cellsub">{sheet.primaryContact?.relationship || "Responsible party"}</div>
                    </td>
                    <td className="cx-hide-sm cx-cellsub">{sheet.documentCount ?? 0} attached</td>
                    <td><Badge tone={sheet.tone} dot>{sheet.status}</Badge></td>
                    <td><ArrowRight size={16} color="var(--cx-faint)" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={FileText} title="No face sheets match" note="Try a different search or status filter." />
        )}
      </div>
    </div>
  );
}

// "Add facesheet" button: a dropdown of current residents. Picking one opens that
// resident's face sheet (the existing FaceSheetDocument template) in create/view
// mode at /admin/face-sheets/[residentId].
function AddFaceSheet({ residents, onPick }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const current = useMemo(() => {
    const search = query.trim().toLowerCase();
    return residents
      .filter((r) => !["discharged", "archived"].includes(r.status))
      .map((r) => ({ id: r.id, name: r.name || `${r.firstName || ""} ${r.lastName || ""}`.trim() || "Resident", room: r.room, careLevel: r.careLevel }))
      .filter((r) => !search || r.name.toLowerCase().includes(search))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [residents, query]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" className="cx-btn cx-btn-primary" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
        <Plus size={15} /> Add facesheet <ChevronDown size={14} />
      </button>
      {open && (
        <div role="listbox" aria-label="Select a resident" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", width: 300, maxHeight: 380, overflowY: "auto", background: "var(--cx-surface, #fff)", border: "1px solid var(--cx-line)", borderRadius: 10, boxShadow: "0 12px 32px rgba(15,23,42,0.14)", zIndex: 50, padding: 8 }}>
          <div className="cx-search" style={{ marginBottom: 6 }}>
            <Search size={14} />
            <input autoFocus placeholder="Search residents..." value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search residents" />
          </div>
          {current.length ? current.map((r) => (
            <button
              key={r.id}
              type="button"
              role="option"
              onClick={() => { setOpen(false); onPick(r.id); }}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "8px 10px", border: "none", background: "transparent", borderRadius: 8, cursor: "pointer", font: "inherit", color: "var(--cx-ink)" }}
              onMouseEnter={(event) => { event.currentTarget.style.background = "var(--cx-tint, #f4f8ff)"; }}
              onMouseLeave={(event) => { event.currentTarget.style.background = "transparent"; }}
            >
              <Avatar name={r.name} sm round />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 600, fontSize: 13 }}>{r.name}</span>
                <span style={{ display: "block", fontSize: 11.5, color: "var(--cx-faint)" }}>{r.room ? `Room ${r.room}` : (r.careLevel || "Resident")}</span>
              </span>
            </button>
          )) : (
            <div style={{ padding: "10px 12px", fontSize: 12.5, color: "var(--cx-faint)" }}>No current residents found.</div>
          )}
        </div>
      )}
    </div>
  );
}
