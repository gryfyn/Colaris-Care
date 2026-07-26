"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardList,
  Contact,
  Download,
  FileText,
  FolderOpen,
  HeartHandshake,
  HeartPulse,
  LogOut,
  NotebookPen,
  Pencil,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { Badge, EmptyState, PortraitButton } from "@/components/ui/data";
import { apiData, displayDate, statusTone } from "@/lib/client-api";
import { openAdmissionFormPrint } from "@/lib/admission-print";
import { uploadPortrait } from "@/lib/cloudinary-upload";
import DocumentsPanel from "@/components/records/DocumentsPanel";

const RESIDENT_DOC_TYPES = ["Admission Assessment", "Physician Orders", "Insurance", "ID", "Advance Directive", "Medication List", "Other Documents"];

const TABS = [
  { id: "overview", label: "Overview", icon: HeartHandshake },
  { id: "packet", label: "Full admission", icon: FileText },
  { id: "admissions", label: "Admissions", icon: ClipboardList },
  { id: "notes", label: "Recent notes", icon: NotebookPen },
  { id: "incidents", label: "Incidents", icon: AlertTriangle },
  { id: "documents", label: "Documents", icon: FolderOpen },
];

const SECTION_META = {
  notes: { title: "Recent notes", empty: "No recent notes are available." },
  incidents: { title: "Incidents", empty: "No incidents are recorded." },
};

function recorded(value) {
  if (value === 0) return "0";
  if (value === false) return "No";
  if (value === true) return "Yes";
  return value ? value : "Not recorded";
}

function Fact({ label, value, tnum }) {
  const display = recorded(value);
  return (
    <div className="cx-fact">
      <dt className="cx-fact-label">{label}</dt>
      <dd className={`cx-fact-value${tnum ? " cx-tnum" : ""}${display === "Not recorded" ? " cx-empty-value" : ""}`}>{display}</dd>
    </div>
  );
}

function FactList({ rows, columns = false }) {
  return (
    <dl className={columns ? "cx-factgrid" : "cx-factlist"}>
      {rows.map(([label, value, options]) => <Fact key={label} label={label} value={value} tnum={options?.tnum} />)}
    </dl>
  );
}

function DetailSection({ eyebrow, title, children, action }) {
  return (
    <section className="cx-detail-section">
      <div className="cx-section-head">
        <div>
          {eyebrow && <div className="cx-section-eyebrow">{eyebrow}</div>}
          <h2 className="cx-section-title">{title}</h2>
        </div>
        {action}
      </div>
      <div className="cx-section-body">{children}</div>
    </section>
  );
}

function countFilled(list, pick) {
  if (!Array.isArray(list)) return 0;
  return list.filter((item) => (pick ? pick(item) : item)).filter(Boolean).length;
}

function listText(list, pick, limit = 4) {
  const items = (Array.isArray(list) ? list : [])
    .map((item) => (pick ? pick(item) : item))
    .filter(Boolean);
  if (!items.length) return "Not recorded";
  if (items.length <= limit) return items.join(", ");
  return `${items.slice(0, limit).join(", ")} +${items.length - limit} more`;
}

function TextList({ items }) {
  return items.length ? <ul className="cx-detail-list">{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : <div className="cx-empty-value">Not recorded</div>;
}

function ChipList({ items }) {
  return items.length ? <div className="cx-chips">{items.map((item, index) => <span className="cx-chip" key={`${item}-${index}`}>{item}</span>)}</div> : <div className="cx-empty-value">Not recorded</div>;
}

function FullAdmissionPacket({ admission }) {
  const a = admission?.answers || {};
  const diag = (list) => (Array.isArray(list) ? list.map((d) => (typeof d === "string" ? d : d?.text)).filter(Boolean) : []);
  const allergies = (a.allergies || []).filter((x) => x && (x.allergen || x.reaction || x.severity));
  const meds = (a.medications || []).filter((x) => x && x.medication);
  const adls = a.adls && typeof a.adls === "object" ? Object.entries(a.adls).filter(([, v]) => v) : [];
  const docs = a.documentNames && typeof a.documentNames === "object" ? Object.entries(a.documentNames).filter(([, v]) => v) : [];

  return (
    <div className="cx-section-stack">
      <DetailSection eyebrow="Admission packet" title="Basic information">
        <FactList columns rows={[
          ["Full name", [a.firstName, a.middleName, a.lastName].filter(Boolean).join(" ")],
          ["Preferred name", a.preferredName],
          ["Date of birth", displayDate(a.dob), { tnum: true }],
          ["Gender", a.gender],
          ["Pronouns", a.pronouns],
          ["Phone", a.phone],
          ["Email", a.email],
          ["Address", a.currentAddress],
          ["Referral source", a.referralSource],
          ["Case manager", a.caseManager],
          ["Facility", a.facility],
          ["Room", a.roomAssignment, { tnum: true }],
          ["Admission date", displayDate(a.admissionDate), { tnum: true }],
          ["Expected discharge", displayDate(a.expectedDischarge), { tnum: true }],
        ]} />
      </DetailSection>

      <DetailSection eyebrow="Contacts" title="Emergency contact">
        <FactList columns rows={[
          ["Name", a.emergencyName],
          ["Relationship", a.emergencyRelationship],
          ["Phone", a.emergencyPhone],
          ["Email", a.emergencyEmail],
        ]} />
      </DetailSection>

      <DetailSection eyebrow="Clinical" title="Clinical overview">
        <div className="cx-subsection"><div className="cx-section-eyebrow">Primary diagnoses</div><TextList items={diag(a.primaryDiagnoses)} /></div>
        <div className="cx-subsection"><div className="cx-section-eyebrow">Secondary diagnoses</div><TextList items={diag(a.secondaryDiagnoses)} /></div>
        <div className="cx-subsection"><div className="cx-section-eyebrow">Conditions</div><ChipList items={Array.isArray(a.conditions) ? a.conditions : []} /></div>
        <div className="cx-subsection">
          <div className="cx-section-eyebrow">Allergies</div>
          {allergies.length ? <FactList rows={allergies.map((x, i) => [x.allergen || `Allergy ${i + 1}`, [x.reaction, x.severity].filter(Boolean).join(" · ")])} /> : <div className="cx-empty-value">Not recorded</div>}
        </div>
        <div className="cx-subsection">
          <div className="cx-section-eyebrow">Medications</div>
          {meds.length ? <FactList rows={meds.map((x, i) => [x.medication || `Medication ${i + 1}`, [x.dose, x.frequency, x.route].filter(Boolean).join(" · ")])} /> : <div className="cx-empty-value">Not recorded</div>}
        </div>
      </DetailSection>

      <DetailSection eyebrow="Daily care" title="Functional and behavioral">
        <FactList columns rows={[
          ["Mobility", a.mobility],
          ["Communication", a.communication],
          ["Observation level", a.observationLevel],
        ]} />
        <div className="cx-subsection">
          <div className="cx-section-eyebrow">Activities of daily living</div>
          {adls.length ? <FactList rows={adls.map(([k, v]) => [k, v])} /> : <div className="cx-empty-value">Not recorded</div>}
        </div>
        <div className="cx-subsection"><div className="cx-section-eyebrow">Behavioral concerns</div><ChipList items={Array.isArray(a.behavioralConcerns) ? a.behavioralConcerns : []} /></div>
        <div className="cx-subsection"><div className="cx-section-eyebrow">Mental health diagnoses</div><TextList items={diag(a.mentalHealthDiagnoses)} /></div>
      </DetailSection>

      <DetailSection eyebrow="Plan" title="Care plan">
        <div className="cx-subsection"><div className="cx-section-eyebrow">Goals</div><TextList items={diag(a.goals)} /></div>
        <div className="cx-subsection"><div className="cx-section-eyebrow">Interventions</div><TextList items={diag(a.interventions)} /></div>
        <div className="cx-subsection"><div className="cx-section-eyebrow">Restrictions</div><TextList items={diag(a.restrictions)} /></div>
      </DetailSection>

      <DetailSection eyebrow="Directives" title="Advance directives">
        <FactList columns rows={[
          ["Advance directive exists", a.advanceDirectiveExists],
          ["DNR status", a.dnrStatus],
          ["Health care agent", a.healthCareAgent],
          ["Agent phone", a.healthCareAgentPhone],
          ["Preferred hospital", a.preferredHospital],
          ["Directive uploaded", a.advanceDirectiveUploaded],
        ]} />
        <div className="cx-subsection">
          <div className="cx-section-eyebrow">Documents</div>
          {docs.length ? <FactList rows={docs.map(([k, v]) => [k, v])} /> : <div className="cx-empty-value">Not recorded</div>}
        </div>
      </DetailSection>
    </div>
  );
}

function EmergencyContact({ answers }) {
  return (
    <DetailSection eyebrow="Contacts" title="Emergency contact">
      <div className="cx-icon-line">
        <span className="cx-feed-ico"><Contact size={16} /></span>
        <FactList columns rows={[
          ["Name", answers.emergencyName],
          ["Relationship", answers.emergencyRelationship],
          ["Phone", answers.emergencyPhone],
          ["Email", answers.emergencyEmail],
        ]} />
      </div>
    </DetailSection>
  );
}

function AdmissionPacketSummary({ admission }) {
  const answers = admission?.answers || {};
  const fieldsStored = Object.keys(answers).length;

  const groups = [
    {
      title: "Demographics and placement",
      icon: UserRound,
      rows: [
        ["Date of birth", displayDate(answers.dob), { tnum: true }],
        ["Gender / pronouns", [answers.gender, answers.pronouns].filter(Boolean).join(" · ")],
        ["Room", answers.roomAssignment || admission?.room, { tnum: true }],
        ["Admission date", displayDate(answers.admissionDate || admission?.admittedAt), { tnum: true }],
        ["Referral source", answers.referralSource],
        ["Portal email", answers.email || admission?.email],
      ],
    },
    {
      title: "Clinical overview",
      icon: Stethoscope,
      rows: [
        ["Primary diagnoses", listText(answers.primaryDiagnoses, (d) => d?.text)],
        ["Conditions", listText(answers.conditions)],
        ["Allergies", `${countFilled(answers.allergies, (x) => x?.allergen)} recorded`],
        ["Medications", `${countFilled(answers.medications, (x) => x?.medication)} recorded`],
      ],
    },
    {
      title: "Functional and behavioral",
      icon: HeartPulse,
      rows: [
        ["Mobility", answers.mobility],
        ["Communication", answers.communication],
        ["Observation level", answers.observationLevel],
        ["Behavioral concerns", listText(answers.behavioralConcerns)],
      ],
    },
    {
      title: "Care plan and directives",
      icon: ClipboardList,
      rows: [
        ["Goals / interventions", `${countFilled(answers.goals, (g) => g?.text)} / ${countFilled(answers.interventions, (i) => i?.text)}`],
        ["Restrictions", listText(answers.restrictions, (r) => r?.text)],
        ["DNR status", answers.dnrStatus],
        ["Advance directive", answers.advanceDirectiveExists],
        ["Documents uploaded", answers.documentCount ? `${answers.documentCount} file${answers.documentCount === 1 ? "" : "s"}` : "None"],
      ],
    },
  ];

  return (
    <DetailSection eyebrow="Snapshot" title="Admission packet summary">
      <div className="cx-section-note">
        <span className="cx-tnum">{fieldsStored}</span> fields captured · submitted <span className="cx-tnum">{displayDate(admission?.submittedAt, "recently")}</span>
      </div>
      <div className="cx-summary-grid">
        {groups.map((group) => {
          const Icon = group.icon;
          return (
            <div key={group.title} className="cx-summary-card">
              <div className="cx-summary-head">
                <span className="cx-feed-ico"><Icon size={16} /></span>
                <h3>{group.title}</h3>
              </div>
              <FactList rows={group.rows} />
            </div>
          );
        })}
      </div>
    </DetailSection>
  );
}

function AdmissionHistory({ admissions }) {
  if (!admissions.length) {
    return <EmptyState icon={ClipboardList} title="No admissions recorded" note="This resident has no stored admission snapshots yet." />;
  }

  return (
    <div className="cx-feed">
      {admissions.map((admission) => (
        <div className="cx-feed-item" key={admission.id}>
          <span className="cx-feed-ico"><ClipboardList size={15} /></span>
          <div className="cx-feed-main">
            <div className="cx-feed-t">{admission.room || "Room pending"} {admission.careLevel ? `· ${admission.careLevel}` : ""}</div>
            <div className="cx-feed-s">
              Submitted {displayDate(admission.submittedAt, "Recent")}
              {admission.email ? ` · ${admission.email}` : ""}
            </div>
          </div>
          <Badge tone={statusTone(admission.status)} dot>{admission.status}</Badge>
        </div>
      ))}
    </div>
  );
}

function FallbackSection({ icon: Icon, empty }) {
  return <EmptyState icon={Icon} title={empty} note="This is a high-level sample record." />;
}

export default function ResidentDetailPage() {
  const { id } = useParams();
  const [resident, setResident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");
  const [discharging, setDischarging] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ room: "", careLevel: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError("");
      const data = await apiData(`/api/v1/residents/${id}`);
      setResident(data);
    } catch (err) {
      setError(err.message || "Resident not found");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const admissions = resident?.admissions || [];
  const latestAdmission = admissions[0] || null;
  const currentTab = useMemo(() => TABS.find((item) => item.id === tab) || TABS[0], [tab]);

  async function dischargeResident() {
    if (discharging || resident?.status === "discharged") return;
    if (!window.confirm(`Discharge ${resident?.name}? This marks the resident as discharged and records a discharge entry.`)) return;
    setDischarging(true);
    try {
      await apiData(`/api/v1/residents/${id}/discharge`, {
        method: "POST",
        body: JSON.stringify({ dischargeDate: new Date().toISOString().slice(0, 10) }),
      });
      await load();
    } catch (err) {
      setError(err.message || "Unable to discharge resident.");
    } finally {
      setDischarging(false);
    }
  }

  function openEdit() {
    setEditForm({ room: resident?.room || "", careLevel: resident?.careLevel || "" });
    setEditing(true);
  }

  async function saveEdit() {
    setSavingEdit(true);
    try {
      await apiData(`/api/v1/residents/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ room: editForm.room.trim() || null, careLevel: editForm.careLevel.trim() || null }),
      });
      await load();
      setEditing(false);
    } catch (err) {
      setError(err.message || "Unable to update resident.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function uploadResidentPhoto(file) {
    if (!file || photoBusy) return;
    setPhotoBusy(true);
    try {
      const photoUrl = await uploadPortrait(file, "residents");
      await apiData(`/api/v1/residents/${id}`, { method: "PATCH", body: JSON.stringify({ photoUrl }) });
      await load();
    } catch (err) {
      setError(err.message || "Photo upload failed.");
    } finally {
      setPhotoBusy(false);
    }
  }

  function downloadAdmissionForm() {
    if (!latestAdmission) return;
    const ok = openAdmissionFormPrint(resident, latestAdmission);
    if (!ok) {
      window.alert("Allow pop-ups for this site to download the admission form.");
    }
  }

  if (loading) {
    return (
      <div className="cx-wide">
        <EmptyState icon={UserRound} title="Loading resident" note="Fetching resident and admission records..." />
      </div>
    );
  }

  if (error || !resident) {
    return (
      <div className="cx-wide">
        <EmptyState
          icon={UserRound}
          title="Resident not found"
          note={error || "The resident may have been removed or the link is incorrect."}
          action={<Link href="/admin/residents" className="cx-btn cx-btn-primary" style={{ textDecoration: "none" }}>Back to residents</Link>}
        />
      </div>
    );
  }

  return (
    <div className="cx-wide">
      <Link href="/admin/residents" className="cx-link cx-page-back">
        <ArrowLeft size={14} /> Residents directory
      </Link>

      <header className="cx-page-band">
        <div className="cx-page-band-main">
          <div className="cx-detail-portrait">
            <PortraitButton name={resident.name} src={resident.photoUrl} size="xl" />
            <label className="cx-upload-link">
              {photoBusy ? "Uploading..." : resident.photoUrl ? "Change photo" : "Add photo"}
              <input type="file" accept="image/*" disabled={photoBusy} onChange={(e) => uploadResidentPhoto(e.target.files?.[0])} />
            </label>
          </div>
          <div className="cx-page-band-copy">
            <div className="cx-section-eyebrow">Resident profile</div>
            <h1 className="cx-page-title">{resident.name}</h1>
            <FactList columns rows={[
              ["Status", resident.status],
              ["Room", resident.room || "Pending", { tnum: true }],
              ["Care level", resident.careLevel],
            ]} />
          </div>
        </div>
        <div className="cx-page-actions">
          <button
            type="button"
            className="cx-btn cx-btn-primary"
            onClick={downloadAdmissionForm}
            disabled={!latestAdmission}
            title={latestAdmission ? "Download the admission form as PDF" : "No admission packet on file"}
          >
            <Download size={15} /> Download admission form
          </button>
          <Link
            href={`/admin/care-plans/new?${new URLSearchParams({ residentId: resident.id, residentName: resident.name || "", room: resident.room || "", photoUrl: resident.photoUrl || "" }).toString()}`}
            className="cx-btn cx-btn-ghost"
            style={{ textDecoration: "none" }}
            title="Start a care plan for this resident"
          >
            <ClipboardList size={15} /> New care plan
          </Link>
          <button type="button" className="cx-btn cx-btn-ghost" onClick={openEdit} title="Edit room and care level">
            <Pencil size={15} /> Edit
          </button>
          {resident.status !== "discharged" && (
            <button type="button" className="cx-btn cx-btn-ghost" onClick={dischargeResident} disabled={discharging} title="Discharge this resident">
              <LogOut size={15} /> {discharging ? "Discharging..." : "Discharge"}
            </button>
          )}
        </div>
      </header>

      {editing && (
        <div className="cx-panel cx-edit-panel">
          <div className="cx-section-eyebrow">Edit resident</div>
          <div className="cx-edit-grid">
            <div>
              <div className="cx-label">Room</div>
              <input className="cx-input" value={editForm.room} onChange={(e) => setEditForm((s) => ({ ...s, room: e.target.value }))} placeholder="Room 204B" />
            </div>
            <div>
              <div className="cx-label">Care level</div>
              <input className="cx-input" value={editForm.careLevel} onChange={(e) => setEditForm((s) => ({ ...s, careLevel: e.target.value }))} placeholder="Routine" />
            </div>
            <div className="cx-inline-actions">
              <button type="button" className="cx-btn cx-btn-primary" onClick={saveEdit} disabled={savingEdit}>{savingEdit ? "Saving..." : "Save"}</button>
              <button type="button" className="cx-btn cx-btn-quiet" onClick={() => setEditing(false)} disabled={savingEdit}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="cx-detail-tabs" role="tablist" aria-label="Resident record sections">
        {TABS.map((item) => {
          const Icon = item.icon;
          const selected = tab === item.id;
          return (
            <button
              type="button"
              role="tab"
              key={item.id}
              id={`resident-tab-${item.id}`}
              aria-controls="resident-tabpanel"
              className="cx-chip"
              data-on={selected ? "true" : "false"}
              aria-selected={selected}
              onClick={() => setTab(item.id)}
            >
              <Icon size={15} /> {item.label}
            </button>
          );
        })}
      </div>

      <div className="cx-detail-grid">
        <main className="cx-detail-main" id="resident-tabpanel" role="tabpanel" aria-labelledby={`resident-tab-${currentTab.id}`}>
          {tab === "overview" && (
            latestAdmission ? (
              <div className="cx-section-stack">
                <EmergencyContact answers={latestAdmission.answers || {}} />
                <AdmissionPacketSummary admission={latestAdmission} />
              </div>
            ) : (
              <DetailSection eyebrow="Overview" title="Admission packet">
                <EmptyState icon={ClipboardList} title="No admission packet" note="This resident has no stored admission snapshot yet." />
              </DetailSection>
            )
          )}

          {tab === "packet" && (
            latestAdmission
              ? <FullAdmissionPacket admission={latestAdmission} />
              : <DetailSection eyebrow="Admission packet" title="Full admission"><EmptyState icon={FileText} title="No admission packet" note="This resident has no stored admission snapshot yet." /></DetailSection>
          )}

          {tab === "admissions" && (
            <DetailSection eyebrow="History" title="Admission history">
              <AdmissionHistory admissions={admissions} />
            </DetailSection>
          )}

          {tab === "notes" && <DetailSection eyebrow="Records" title={SECTION_META.notes.title}><FallbackSection icon={NotebookPen} empty={SECTION_META.notes.empty} /></DetailSection>}
          {tab === "incidents" && <DetailSection eyebrow="Records" title={SECTION_META.incidents.title}><FallbackSection icon={AlertTriangle} empty={SECTION_META.incidents.empty} /></DetailSection>}
          {tab === "documents" && <DocumentsPanel scope="residents" residentId={id} docTypes={RESIDENT_DOC_TYPES} emptyNote="Use Upload to add admission assessments, IDs, insurance, and more." />}
        </main>

        <aside className="cx-detail-rail" aria-label="Resident at-a-glance facts">
          <DetailSection eyebrow="At a glance" title="Current facts">
            <FactList rows={[
              ["Status", resident.status],
              ["Room", resident.room || "Pending", { tnum: true }],
              ["Care level", resident.careLevel],
              ["Date of birth", displayDate(resident.dateOfBirth), { tnum: true }],
              ["Admitted", displayDate(resident.admittedAt), { tnum: true }],
              ["Primary contact", latestAdmission?.answers?.emergencyName],
              ["Admissions", admissions.length, { tnum: true }],
            ]} />
          </DetailSection>
          <DetailSection eyebrow="Packet" title="Admission packet">
            <div className="cx-icon-line">
              <span className="cx-feed-ico"><FileText size={16} /></span>
              <FactList rows={[
                ["Status", latestAdmission?.status],
                ["Submitted", latestAdmission ? displayDate(latestAdmission.submittedAt, "recently") : null, { tnum: true }],
                ["Medications", latestAdmission ? `${countFilled(latestAdmission.answers?.medications, (m) => m?.medication)} captured` : null],
              ]} />
            </div>
            <button type="button" className="cx-btn cx-btn-primary cx-full-action" onClick={downloadAdmissionForm} disabled={!latestAdmission}>
              <Download size={15} /> Download admission form
            </button>
            <div className="cx-rail-note">
              <ShieldCheck size={14} /> Opens a print-ready packet; use your browser to Save as PDF.
            </div>
          </DetailSection>
        </aside>
      </div>
    </div>
  );
}
