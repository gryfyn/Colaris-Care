"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, NotebookPen, Plus, Search, X } from "lucide-react";
import { Badge, EmptyState, PageHeader, Panel, StatCard } from "@/components/ui/data";
import { apiData, displayDate, statusTone } from "@/lib/client-api";
import { NOTE_SECTIONS, formatFieldValue, shiftLabel } from "@/lib/progress-notes-schema";
import DailyProgressNoteModal from "@/components/records/DailyProgressNoteModal";

const todayISO = () => new Date().toISOString().split("T")[0];

// Daily progress notes experience shared by both portals.
//   variant="staff" — worklist of residents still needing a note today.
//   variant="admin" — due panel + residents table with history drill-down.
export default function DailyProgressNotes({ variant = "staff" }) {
  const isAdmin = variant === "admin";
  const [date, setDate] = useState(todayISO);
  const [summary, setSummary] = useState({ total: 0, completed: 0, remaining: 0, residents: [], pending: [] });
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [modalResident, setModalResident] = useState(null); // {id,name} | 'any' | null
  const [historyResident, setHistoryResident] = useState(null);

  const load = useCallback(async () => {
    setLoaded(false);
    const data = await apiData(`/api/v1/daily-progress-notes/pending?date=${date}`).catch(() => null);
    if (data) setSummary(data);
    setLoaded(true);
  }, [date]);

  useEffect(() => { void load(); }, [load]);

  const residentOptions = useMemo(
    () => (summary.residents || []).map((r) => ({ value: r.residentId, label: r.name })),
    [summary.residents]
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = summary.residents || [];
    return q ? list.filter((r) => r.name.toLowerCase().includes(q)) : list;
  }, [summary.residents, query]);

  function onSaved() {
    setModalResident(null);
    void load();
  }

  const counterLabel = `${summary.completed}/${summary.total}`;

  return (
    <div className="cx-wide">
      <PageHeader
        eyebrow="Clinical documentation"
        title="Daily progress notes"
        lede={isAdmin
          ? "Every active resident needs a progress note each day. Track completion, then open a resident to review their history."
          : "File a structured progress note for each resident assigned to you. Due every day."}
        action={<button type="button" className="cx-btn cx-btn-primary" onClick={() => setModalResident("any")}><Plus size={15} /> Add note</button>}
      />

      <div className="cx-toolbar" style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12.5, color: "var(--cx-faint)", display: "flex", alignItems: "center", gap: 8 }}>
          Date
          <input className="cx-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ padding: "7px 10px", border: "1px solid var(--cx-line)", borderRadius: 8, fontSize: 13, color: "var(--cx-ink)", background: "var(--cx-surface,#fff)" }} />
        </label>
        <span className="cx-tb-spacer" />
        <span style={{ fontSize: 12.5, color: "var(--cx-faint)" }}>{displayDate(date)}</span>
      </div>

      <div className="cx-stats">
        <StatCard icon={CheckCircle2} label="Notes done today" value={counterLabel} />
        <StatCard icon={ClipboardList} label="Still due" value={summary.remaining} />
        <StatCard icon={NotebookPen} label="Active residents" value={summary.total} />
      </div>

      {/* Due today */}
      <Panel title={`Due today — ${summary.remaining} remaining`}>
        <div className="cx-tablewrap" style={{ border: "none" }}>
          {(summary.pending || []).length ? (
            <div className="cx-tblscroll">
              <table className="cx-tbl">
                <thead><tr><th>Resident</th><th>Room</th><th style={{ textAlign: "right" }}>Action</th></tr></thead>
                <tbody>
                  {summary.pending.map((r) => (
                    <tr key={r.residentId}>
                      <td><strong>{r.name}</strong></td>
                      <td className="cx-cellsub">{r.room || "—"}</td>
                      <td style={{ textAlign: "right" }}>
                        <button type="button" className="cx-btn cx-btn-ghost cx-btn-compact" onClick={() => setModalResident({ id: r.residentId, name: r.name })}>
                          <Plus size={13} /> File note
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={CheckCircle2} title={loaded ? "All caught up" : "Loading..."} note={loaded ? `Every active resident has a note for ${displayDate(date)}.` : "Fetching today's worklist..."} />
          )}
        </div>
      </Panel>

      {/* Admin: full roster with completion + history drill-down */}
      {isAdmin && (
        <Panel title="Residents" action={<div className="cx-search" style={{ maxWidth: 240 }}><Search size={14} /><input aria-label="Search residents" placeholder="Search resident..." value={query} onChange={(e) => setQuery(e.target.value)} /></div>}>
          <div className="cx-tablewrap" style={{ border: "none" }}>
            {rows.length ? (
              <div className="cx-tblscroll">
                <table className="cx-tbl">
                  <thead><tr><th>Resident</th><th>Room</th><th>{displayDate(date)}</th><th style={{ textAlign: "right" }}>History</th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.residentId}>
                        <td>
                          <button type="button" onClick={() => setHistoryResident({ id: r.residentId, name: r.name })} style={{ background: "none", border: "none", padding: 0, color: "var(--cx-accent, #1a56db)", fontWeight: 600, cursor: "pointer", font: "inherit" }}>
                            {r.name}
                          </button>
                        </td>
                        <td className="cx-cellsub">{r.room || "—"}</td>
                        <td><Badge tone={r.hasNote ? "green" : "amber"} dot>{r.hasNote ? "Filed" : "Due"}</Badge></td>
                        <td style={{ textAlign: "right" }}>
                          <button type="button" className="cx-btn cx-btn-ghost cx-btn-compact" onClick={() => setHistoryResident({ id: r.residentId, name: r.name })}>View history</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={NotebookPen} title={loaded ? "No residents" : "Loading..."} note={loaded ? "No active residents match." : "Fetching residents..."} />
            )}
          </div>
        </Panel>
      )}

      {modalResident && (
        <DailyProgressNoteModal
          resident={modalResident === "any" ? null : modalResident}
          residentOptions={residentOptions}
          defaultDate={date}
          onClose={() => setModalResident(null)}
          onSaved={onSaved}
        />
      )}

      {historyResident && (
        <HistoryModal resident={historyResident} onClose={() => setHistoryResident(null)} />
      )}
    </div>
  );
}

function HistoryModal({ resident, onClose }) {
  const [notes, setNotes] = useState(null);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    apiData(`/api/v1/daily-progress-notes/history?residentId=${resident.id}`)
      .then((data) => setNotes(data?.notes || []))
      .catch(() => setNotes([]));
  }, [resident.id]);

  return (
    <div className="cx-ob-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={`${resident.name} progress notes`} className="cx-panel" style={{ width: "min(880px, 96vw)", maxHeight: "90vh", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid var(--cx-line)" }}>
          <div>
            <div className="cx-eyebrow">Progress note history</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--cx-ink)" }}>{resident.name}</div>
          </div>
          <button type="button" className="cx-icon-btn" aria-label="Close" onClick={onClose}><X size={17} /></button>
        </div>
        <div style={{ overflowY: "auto", padding: 18 }}>
          {notes === null ? (
            <EmptyState icon={NotebookPen} title="Loading history..." />
          ) : notes.length === 0 ? (
            <EmptyState icon={NotebookPen} title="No progress notes yet" note="Notes filed for this resident will appear here." />
          ) : (
            <div className="cx-tblscroll">
              <table className="cx-tbl">
                <thead><tr><th>Date</th><th>Shift</th><th>Filled by</th><th>Approver</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {notes.map((n) => (
                    <FragmentRow key={n.id} n={n} open={openId === n.id} onToggle={() => setOpenId(openId === n.id ? null : n.id)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FragmentRow({ n, open, onToggle }) {
  return (
    <>
      <tr>
        <td><strong>{displayDate(n.noteDate)}</strong></td>
        <td className="cx-cellsub">{shiftLabel(n.shift)}</td>
        <td className="cx-cellsub">{n.staffName || "—"}</td>
        <td className="cx-cellsub">{n.approverName || "—"}</td>
        <td><Badge tone={statusTone(n.reviewStatus)} dot>{n.reviewStatus}</Badge></td>
        <td style={{ textAlign: "right" }}>
          <button type="button" className="cx-btn cx-btn-ghost cx-btn-compact" onClick={onToggle}>{open ? "Hide" : "View"}</button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} style={{ background: "var(--cx-tint, #f4f8ff)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18, padding: "6px 4px 12px" }}>
              {NOTE_SECTIONS.map((section) => (
                <div key={section.title}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--cx-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{section.title}</div>
                  {section.fields.map((f) => (
                    <div key={f.key} style={{ fontSize: 12.5, color: "var(--cx-ink)", marginBottom: 4, whiteSpace: f.kind === "long" ? "pre-wrap" : "normal" }}>
                      <span style={{ fontWeight: 600 }}>{f.label}:</span> {formatFieldValue(f, n.noteBody[f.key])}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
