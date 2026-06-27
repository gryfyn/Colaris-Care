"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileText, FolderOpen, Loader2, Upload } from "lucide-react";
import { Badge, EmptyState, Panel } from "@/components/ui/data";
import { apiData, displayDate } from "@/lib/client-api";
import { uploadDocument, openDocument } from "@/lib/r2-upload";

// Generic R2-backed documents list with view links + an upload control.
// Pass exactly one of residentId / staffProfileId; `scope` selects the R2
// folder ('residents' | 'staff'); `docTypes` populates the type dropdown.
export default function DocumentsPanel({
  scope = "residents",
  residentId,
  staffProfileId,
  docTypes,
  title = "Documents",
  emptyNote = "Use Upload to attach files. They are stored privately and opened with short-lived links.",
}) {
  const types = docTypes && docTypes.length ? docTypes : ["Other Documents"];
  const [docs, setDocs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [opening, setOpening] = useState("");
  const [docType, setDocType] = useState(types[0]);
  const [error, setError] = useState("");

  const queryKey = residentId ? `residentId=${residentId}` : `staffProfileId=${staffProfileId}`;

  const load = useCallback(async () => {
    const data = await apiData(`/api/v1/documents?${queryKey}`).catch(() => null);
    if (Array.isArray(data)) setDocs(data);
    setLoaded(true);
  }, [queryKey]);

  useEffect(() => { void load(); }, [load]);

  async function onUpload(file) {
    if (!file || uploading) return;
    setUploading(true);
    setError("");
    try {
      const meta = await uploadDocument(file, scope);
      const payload = residentId
        ? { residentId, documentType: docType, title: meta.name, objectKey: meta.objectKey }
        : { staffProfileId, documentType: docType, title: meta.name, objectKey: meta.objectKey };
      await apiData("/api/v1/documents", { method: "POST", body: JSON.stringify(payload) });
      await load();
    } catch (e) {
      setError(e.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function view(id) {
    if (opening) return;
    setOpening(id);
    try { await openDocument(id); } catch (e) { setError(e.message || "Could not open document."); } finally { setOpening(""); }
  }

  const uploadControl = (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <select className="cx-select" aria-label="Document type" value={docType} onChange={(e) => setDocType(e.target.value)} style={{ maxWidth: 200 }}>
        {types.map((t) => <option key={t}>{t}</option>)}
      </select>
      <label className="cx-btn cx-btn-primary cx-btn-compact" style={{ cursor: uploading ? "wait" : "pointer" }}>
        {uploading ? <Loader2 size={14} className="cx-spin" /> : <Upload size={14} />} {uploading ? "Uploading..." : "Upload"}
        <input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" style={{ display: "none" }} disabled={uploading}
          onChange={(e) => onUpload(e.target.files?.[0])} />
      </label>
    </div>
  );

  return (
    <Panel title={title} pad action={uploadControl}>
      {error && <div style={{ marginBottom: 10, fontSize: 12, color: "var(--cx-danger, #b42318)" }}>{error}</div>}
      {docs.length ? (
        <div className="cx-feed">
          {docs.map((d) => (
            <div className="cx-feed-item" key={d.id}>
              <span className="cx-feed-ico" style={{ background: "var(--cx-accent-soft)", color: "var(--cx-accent)" }}><FileText size={15} /></span>
              <div className="cx-feed-main">
                <div className="cx-feed-t">{d.title || d.documentType}</div>
                <div className="cx-feed-s"><Badge tone="blue">{d.documentType}</Badge> · {displayDate(d.createdAt, "recently")}</div>
              </div>
              <button type="button" className="cx-btn cx-btn-ghost cx-btn-compact" disabled={opening === d.id} onClick={() => view(d.id)}>
                {opening === d.id ? <Loader2 size={13} className="cx-spin" /> : <Download size={13} />} View
              </button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={FolderOpen} title={loaded ? "No documents yet" : "Loading documents"} note={loaded ? emptyNote : "Fetching documents..."} />
      )}
    </Panel>
  );
}
