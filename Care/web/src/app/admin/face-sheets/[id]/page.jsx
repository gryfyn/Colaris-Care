"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, FileCheck2, Loader2, Pencil, Printer, Save, UploadCloud, X } from "lucide-react";
import { Badge, EmptyState, PageHeader, Panel } from "@/components/ui/data";
import { SelectField, TextField } from "@/components/ui/fields";
import FaceSheetDocument from "@/components/face-sheets/FaceSheetDocument";
import { apiData } from "@/lib/client-api";
import { getAccessToken } from "@/lib/client-auth";
import { buildFaceSheetFromResident } from "@/lib/face-sheet-client";
import { mergeParsedFaceSheet } from "@/lib/face-sheet-schema";
import { hasPermission, PERMISSIONS } from "@/lib/roles";
import { useAuthStore } from "@/lib/store/auth-store";
import { getFaceSheet } from "../data";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "discharged", label: "Discharged" },
];

function formFromResident(resident) {
  return {
    firstName: resident?.firstName || "",
    lastName: resident?.lastName || "",
    room: resident?.room || "",
    careLevel: resident?.careLevel || "",
    status: resident?.status || "",
    photoUrl: resident?.photoUrl || "",
  };
}

function savePayloadFromForm(form) {
  const payload = {};
  for (const key of ["firstName", "lastName", "room", "careLevel", "status", "photoUrl"]) {
    const value = String(form[key] || "").trim();
    if (value) payload[key] = value;
  }
  return payload;
}

async function loadFaceSheetData(id) {
  const [resident, documents] = await Promise.all([
    apiData(`/api/v1/residents/${id}`),
    apiData(`/api/v1/documents?residentId=${id}`),
  ]);
  return { resident, sheet: buildFaceSheetFromResident(resident, documents) };
}

export default function FaceSheetDetailPage() {
  const { id } = useParams();
  const [sheet, setSheet] = useState(() => getFaceSheet(id));
  const [resident, setResident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => formFromResident(null));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const user = useAuthStore((state) => state.user);
  const canUpdateResidents = hasPermission(user?.role, PERMISSIONS.RESIDENTS_UPDATE);

  useEffect(() => {
    let mounted = true;
    loadFaceSheetData(id)
      .then(({ resident: nextResident, sheet: nextSheet }) => {
        if (!mounted) return;
        setResident(nextResident);
        setSheet(nextSheet);
        setForm(formFromResident(nextResident));
        setError("");
      })
      .catch((err) => {
        if (!mounted) return;
        setSheet(getFaceSheet(id));
        setError(err.message || "Unable to load live face sheet.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [id]);

  if (!sheet && !loading) {
    return (
      <div className="cx-wide">
        <EmptyState
          icon={FileCheck2}
          title="Face sheet not found"
          note="The face sheet may have been removed or the link is incorrect."
          action={<Link href="/admin/face-sheets" className="cx-btn cx-btn-primary" style={{ textDecoration: "none" }}>Back to face sheets</Link>}
        />
      </div>
    );
  }

  if (!sheet) return null;

  function beginEdit() {
    setForm(formFromResident(resident));
    setMessage("");
    setError("");
    setEditing(true);
  }

  function cancelEdit() {
    setForm(formFromResident(resident));
    setMessage("");
    setError("");
    setEditing(false);
  }

  const setField = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  async function uploadFaceSheet(event) {
    const file = event.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file || uploading || !canUpdateResidents) return;

    setUploading(true);
    setMessage("");
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const token = getAccessToken();
      const response = await fetch("/api/v1/face-sheets/parse", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not read the face sheet.");

      const data = payload.data || {};
      setForm((current) => mergeParsedFaceSheet(current, data.fields || {}));
      setMessage(data.parsed === false
        ? (data.warning || "Upload attached. Complete the fields manually.")
        : "Imported from document. Review the fields before saving.");
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function saveFaceSheet() {
    if (saving || !canUpdateResidents) return;
    if (!String(form.firstName || "").trim() || !String(form.lastName || "").trim()) {
      setError("First name and last name are required.");
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await apiData(`/api/v1/residents/${id}`, {
        method: "PATCH",
        body: JSON.stringify(savePayloadFromForm(form)),
      });
      const { resident: nextResident, sheet: nextSheet } = await loadFaceSheetData(id);
      setResident(nextResident);
      setSheet(nextSheet);
      setForm(formFromResident(nextResident));
      setEditing(false);
      setMessage("Face sheet saved to resident record.");
    } catch (err) {
      setError(err.message || "Unable to save face sheet.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cx-wide fs-page">
      <div className="fs-no-print">
        <Link href="/admin/face-sheets" className="cx-link" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
          <ArrowLeft size={14} /> Face sheets
        </Link>
      </div>

      <PageHeader
        eyebrow="Resident face sheet"
        title={sheet.name}
        lede="Live resident summary with sensitive demographics, identifiers, contacts, and signatures masked."
        action={(
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Badge tone={sheet.tone} dot>{loading ? "Loading" : sheet.status}</Badge>
            {!editing && canUpdateResidents && resident && (
              <button type="button" className="cx-btn cx-btn-ghost fs-no-print" onClick={beginEdit}>
                <Pencil size={15} /> Edit face sheet
              </button>
            )}
            <button type="button" className="cx-btn cx-btn-primary fs-no-print" onClick={() => window.print()} disabled={editing}>
              <Printer size={15} /> Print
            </button>
          </div>
        )}
      />

      {(message || error) && (
        <div
          className="fs-no-print"
          style={{
            marginBottom: 14,
            padding: "10px 12px",
            borderRadius: 8,
            border: `1px solid ${error ? "var(--cx-danger, #b42318)" : "#6ee7b7"}`,
            background: error ? "#fff1f0" : "#ecfdf5",
            color: error ? "var(--cx-danger, #b42318)" : "#047857",
            fontSize: 12.5,
          }}
        >
          {error || message}
        </div>
      )}

      {editing && canUpdateResidents ? (
        <Panel title="Edit resident face sheet" pad>
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: 14, border: "1px solid var(--cx-line)", borderRadius: 8, background: "var(--cx-paper-2)" }}>
              <div style={{ flex: "1 1 240px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--cx-ink)" }}>Upload to auto-fill</div>
                <div style={{ fontSize: 12, color: "var(--cx-faint)" }}>PDF, Word, photo, or scan. Existing values stay unless the document has a non-empty replacement.</div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
                onChange={uploadFaceSheet}
                style={{ display: "none" }}
              />
              <button type="button" className="cx-btn cx-btn-ghost" onClick={() => fileRef.current?.click()} disabled={uploading || saving}>
                {uploading ? <><Loader2 size={15} className="cx-spin" /> Reading...</> : <><UploadCloud size={15} /> Upload to auto-fill</>}
              </button>
            </div>

            <div className="cx-grid">
              <TextField label="First name" required value={form.firstName} onChange={setField("firstName")} placeholder="First name" />
              <TextField label="Last name" required value={form.lastName} onChange={setField("lastName")} placeholder="Last name" />
              <TextField label="Room" value={form.room} onChange={setField("room")} placeholder="Room 204B" />
              <TextField label="Care level" value={form.careLevel} onChange={setField("careLevel")} placeholder="Routine" />
              <SelectField label="Status" value={form.status} onChange={setField("status")} options={STATUS_OPTIONS} placeholder="Select status" />
              <TextField label="Photo URL" value={form.photoUrl} onChange={setField("photoUrl")} placeholder="https://..." />
            </div>

            <div className="cx-actionbar" style={{ marginTop: 0 }}>
              <span className="cx-ab-info">Saves only fields owned by the resident record.</span>
              <span className="cx-ab-spacer" />
              <button type="button" className="cx-btn cx-btn-quiet" onClick={cancelEdit} disabled={saving || uploading}>
                <X size={15} /> Cancel
              </button>
              <button type="button" className="cx-btn cx-btn-primary" onClick={saveFaceSheet} disabled={saving || uploading}>
                {saving ? <><Loader2 size={15} className="cx-spin" /> Saving...</> : <><Save size={15} /> Save</>}
              </button>
            </div>
          </div>
        </Panel>
      ) : (
        <FaceSheetDocument sheet={sheet} mode="admin" />
      )}
    </div>
  );
}
