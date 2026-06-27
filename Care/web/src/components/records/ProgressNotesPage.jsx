"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileSignature, NotebookPen, Plus, Search } from "lucide-react";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui/data";
import { apiData, displayDate, statusTone } from "@/lib/client-api";
import RecordFormModal from "@/components/records/RecordFormModal";

function normalize(item) {
  return {
    id: item.id,
    residentId: item.residentId || item.resident_id,
    resident: item.residentName || item.resident_name || "Resident",
    noteType: item.noteType || item.note_type || "shift",
    body: item.body || "",
    status: item.status || "draft",
    occurredAt: displayDate(item.occurredAt || item.occurred_at, "Recent"),
    signedAt: item.signedAt || item.signed_at,
  };
}

// Real progress-notes record page (list + add + sign), shared by the admin and
// staff portals. Staff are assignment-scoped by the API; an unauthorized add
// surfaces the server's message in the form.
export default function ProgressNotesPage() {
  const [rows, setRows] = useState([]);
  const [residents, setResidents] = useState([]);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [signing, setSigning] = useState("");
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const data = await apiData("/api/v1/progress-notes").catch(() => null);
    if (Array.isArray(data)) setRows(data.map(normalize));
    setLoaded(true);
  }, []);

  useEffect(() => {
    void load();
    apiData("/api/v1/residents").then((data) => Array.isArray(data) && setResidents(data)).catch(() => {});
  }, [load]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rows.filter((row) => !search || [row.resident, row.body, row.noteType, row.status].some((value) => String(value).toLowerCase().includes(search)));
  }, [query, rows]);

  const residentOptions = useMemo(() => residents.map((r) => ({ value: r.id, label: r.name || `${r.firstName || ""} ${r.lastName || ""}`.trim() })), [residents]);

  async function createNote(v) {
    await apiData("/api/v1/progress-notes", {
      method: "POST",
      body: JSON.stringify({ residentId: v.resident, noteType: v.noteType || "shift", body: v.body.trim() }),
    });
    await load();
    setAdding(false);
  }

  async function signNote(id) {
    if (signing) return;
    setSigning(id);
    try {
      await apiData(`/api/v1/progress-notes/${id}/sign`, { method: "POST", body: JSON.stringify({}) });
      await load();
    } catch { /* surfaced by the row staying draft */ } finally {
      setSigning("");
    }
  }

  const signedCount = rows.filter((r) => r.status === "signed").length;

  return (
    <div className="cx-wide">
      <PageHeader
        eyebrow="Clinical documentation"
        title="Progress notes"
        lede="Document and sign resident progress notes. Notes are tenant-scoped and staff see residents assigned to them."
        action={<button type="button" className="cx-btn cx-btn-primary" onClick={() => setAdding(true)}><Plus size={15} /> Add note</button>}
      />
      <div className="cx-stats">
        <StatCard icon={NotebookPen} label="Notes" value={rows.length} />
        <StatCard icon={CheckCircle2} label="Signed" value={signedCount} />
        <StatCard icon={FileSignature} label="Drafts" value={rows.filter((r) => r.status === "draft").length} />
      </div>
      <div className="cx-toolbar"><div className="cx-search"><Search size={15} /><input aria-label="Search progress notes" placeholder="Search resident, note, or type..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><span className="cx-tb-spacer" /><span style={{ fontSize: 12.5, color: "var(--cx-faint)" }}>{filtered.length} note{filtered.length === 1 ? "" : "s"}</span></div>
      <div className="cx-tablewrap">
        {filtered.length ? (
          <div className="cx-tblscroll"><table className="cx-tbl"><thead><tr><th>Resident</th><th>Type</th><th>Note</th><th>When</th><th>Status</th><th>Action</th></tr></thead><tbody>
            {filtered.map((row) => (
              <tr key={row.id}>
                <td><strong>{row.resident}</strong></td>
                <td>{row.noteType}</td>
                <td className="cx-cellsub" style={{ maxWidth: 360 }}>{row.body}</td>
                <td>{row.occurredAt}</td>
                <td><Badge tone={statusTone(row.status)} dot>{row.status}</Badge></td>
                <td>{row.status !== "signed" ? <button type="button" className="cx-btn cx-btn-ghost cx-btn-compact" disabled={signing === row.id} onClick={() => signNote(row.id)}><FileSignature size={13} /> {signing === row.id ? "Signing..." : "Sign"}</button> : <span className="cx-cellsub">Signed {displayDate(row.signedAt)}</span>}</td>
              </tr>
            ))}
          </tbody></table></div>
        ) : (
          <EmptyState icon={NotebookPen} title={loaded ? "No progress notes yet" : "Loading notes"} note={loaded ? "Use Add note to document the first progress note." : "Fetching progress notes..."} />
        )}
      </div>

      {adding && (
        <RecordFormModal
          eyebrow="Clinical documentation"
          title="Add progress note"
          submitLabel="Add note"
          onClose={() => setAdding(false)}
          onSubmit={createNote}
          fields={[
            { name: "resident", label: "Resident", type: "select", required: true, span2: true, placeholder: "Select resident", options: residentOptions },
            { name: "noteType", label: "Note type", type: "select", default: "shift", options: ["shift", "assessment", "care", "family", "incident"] },
            { name: "body", label: "Note", type: "textarea", required: true, span2: true, placeholder: "Document the progress note..." },
          ]}
        />
      )}
    </div>
  );
}
