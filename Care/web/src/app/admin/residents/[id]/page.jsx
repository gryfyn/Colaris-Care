"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  Contact,
  Download,
  FileText,
  FolderOpen,
  HeartHandshake,
  HeartPulse,
  LogOut,
  MapPin,
  NotebookPen,
  Pencil,
  Phone,
  Pill,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { Avatar, Badge, EmptyState, PageHeader, Panel, StatCard } from "@/components/ui/data";
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

// Renders every field captured on the admission packet, grouped like the form.
function FullAdmissionPacket({ admission }) {
  const a = admission?.answers || {};
  const diag = (list) => (Array.isArray(list) ? list.map((d) => (typeof d === "string" ? d : d?.text)).filter(Boolean) : []);
  const allergies = (a.allergies || []).filter((x) => x && (x.allergen || x.reaction || x.severity));
  const meds = (a.medications || []).filter((x) => x && x.medication);
  const adls = a.adls && typeof a.adls === "object" ? Object.entries(a.adls).filter(([, v]) => v) : [];
  const docs = a.documentNames && typeof a.documentNames === "object" ? Object.entries(a.documentNames).filter(([, v]) => v) : [];

  const Row = ({ label, value }) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", borderBottom: "1px dotted var(--cx-line)", fontSize: 13 }}>
      <span style={{ color: "var(--cx-muted)" }}>{label}</span>
      <span style={{ fontWeight: 600, color: "var(--cx-ink)", textAlign: "right" }}>{value || "—"}</span>
    </div>
  );
  const Chips = ({ items }) => (
    items.length ? <div className="cx-chips" style={{ marginTop: 6 }}>{items.map((c, i) => <span className="cx-chip" key={`${c}-${i}`}>{c}</span>)}</div> : <div style={{ fontSize: 12.5, color: "var(--cx-muted)", marginTop: 4 }}>None recorded</div>
  );
  const List = ({ items }) => (
    items.length ? <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13 }}>{items.map((t, i) => <li key={`${t}-${i}`} style={{ margin: "2px 0" }}>{t}</li>)}</ul> : <div style={{ fontSize: 12.5, color: "var(--cx-muted)", marginTop: 4 }}>None recorded</div>
  );

  return (
    <div className="cx-grid">
      <Panel title="Basic information" pad>
        <Row label="Full name" value={[a.firstName, a.middleName, a.lastName].filter(Boolean).join(" ")} />
        <Row label="Preferred name" value={a.preferredName} />
        <Row label="Date of birth" value={displayDate(a.dob)} />
        <Row label="Gender" value={a.gender} />
        <Row label="Pronouns" value={a.pronouns} />
        <Row label="Phone" value={a.phone} />
        <Row label="Email" value={a.email} />
        <Row label="Address" value={a.currentAddress} />
        <Row label="Referral source" value={a.referralSource} />
        <Row label="Case manager" value={a.caseManager} />
        <Row label="Facility" value={a.facility} />
        <Row label="Room" value={a.roomAssignment} />
        <Row label="Admission date" value={displayDate(a.admissionDate)} />
        <Row label="Expected discharge" value={displayDate(a.expectedDischarge)} />
      </Panel>

      <Panel title="Emergency contact" pad>
        <Row label="Name" value={a.emergencyName} />
        <Row label="Relationship" value={a.emergencyRelationship} />
        <Row label="Phone" value={a.emergencyPhone} />
        <Row label="Email" value={a.emergencyEmail} />
      </Panel>

      <Panel title="Clinical overview" pad>
        <div className="cx-eyebrow">Primary diagnoses</div><List items={diag(a.primaryDiagnoses)} />
        <div className="cx-eyebrow" style={{ marginTop: 12 }}>Secondary diagnoses</div><List items={diag(a.secondaryDiagnoses)} />
        <div className="cx-eyebrow" style={{ marginTop: 12 }}>Conditions</div><Chips items={Array.isArray(a.conditions) ? a.conditions : []} />
        <div className="cx-eyebrow" style={{ marginTop: 12 }}>Allergies</div>
        {allergies.length ? allergies.map((x, i) => <Row key={i} label={x.allergen || "Allergen"} value={[x.reaction, x.severity].filter(Boolean).join(" · ")} />) : <div style={{ fontSize: 12.5, color: "var(--cx-muted)", marginTop: 4 }}>None recorded</div>}
        <div className="cx-eyebrow" style={{ marginTop: 12 }}>Medications</div>
        {meds.length ? meds.map((x, i) => <Row key={i} label={x.medication} value={[x.dose, x.frequency, x.route].filter(Boolean).join(" · ")} />) : <div style={{ fontSize: 12.5, color: "var(--cx-muted)", marginTop: 4 }}>None recorded</div>}
      </Panel>

      <Panel title="Functional & behavioral" pad>
        <Row label="Mobility" value={a.mobility} />
        <Row label="Communication" value={a.communication} />
        <Row label="Observation level" value={a.observationLevel} />
        <div className="cx-eyebrow" style={{ marginTop: 12 }}>Activities of daily living</div>
        {adls.length ? adls.map(([k, v]) => <Row key={k} label={k} value={v} />) : <div style={{ fontSize: 12.5, color: "var(--cx-muted)", marginTop: 4 }}>None recorded</div>}
        <div className="cx-eyebrow" style={{ marginTop: 12 }}>Behavioral concerns</div><Chips items={Array.isArray(a.behavioralConcerns) ? a.behavioralConcerns : []} />
        <div className="cx-eyebrow" style={{ marginTop: 12 }}>Mental health diagnoses</div><List items={diag(a.mentalHealthDiagnoses)} />
      </Panel>

      <Panel title="Care plan" pad>
        <div className="cx-eyebrow">Goals</div><List items={diag(a.goals)} />
        <div className="cx-eyebrow" style={{ marginTop: 12 }}>Interventions</div><List items={diag(a.interventions)} />
        <div className="cx-eyebrow" style={{ marginTop: 12 }}>Restrictions</div><List items={diag(a.restrictions)} />
      </Panel>

      <Panel title="Advance directives" pad>
        <Row label="Advance directive exists" value={a.advanceDirectiveExists} />
        <Row label="DNR status" value={a.dnrStatus} />
        <Row label="Health care agent" value={a.healthCareAgent} />
        <Row label="Agent phone" value={a.healthCareAgentPhone} />
        <Row label="Preferred hospital" value={a.preferredHospital} />
        <Row label="Directive uploaded" value={a.advanceDirectiveUploaded} />
        <div className="cx-eyebrow" style={{ marginTop: 12 }}>Documents</div>
        {docs.length ? docs.map(([k, v]) => <Row key={k} label={k} value={v} />) : <div style={{ fontSize: 12.5, color: "var(--cx-muted)", marginTop: 4 }}>None uploaded</div>}
      </Panel>
    </div>
  );
}

const SECTION_META = {
  notes: { title: "Recent notes", empty: "No recent notes are available." },
  incidents: { title: "Incidents", empty: "No incidents are recorded." },
};

function DetailRow({ label, value }) {
  return (
    <div>
      <div className="cx-eyebrow">{label}</div>
      <div style={{ marginTop: 7, fontSize: 13.5, fontWeight: 600, color: "var(--cx-ink)" }}>{value || "Not recorded"}</div>
    </div>
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
  if (!items.length) return "None recorded";
  if (items.length <= limit) return items.join(", ");
  return `${items.slice(0, limit).join(", ")} +${items.length - limit} more`;
}

// The emergency contact captured on the admission packet.
function EmergencyContact({ answers }) {
  const hasContact = answers.emergencyName || answers.emergencyPhone || answers.emergencyEmail;
  return (
    <Panel title="Emergency contact" pad>
      {hasContact ? (
        <div className="cx-feed">
          <div className="cx-feed-item">
            <span className="cx-feed-ico" style={{ background: "var(--cx-accent-soft)", color: "var(--cx-accent)" }}><Contact size={15} /></span>
            <div className="cx-feed-main">
              <div className="cx-feed-t">{answers.emergencyName || "Not recorded"}</div>
              <div className="cx-feed-s">{answers.emergencyRelationship || "Relationship not recorded"}</div>
            </div>
          </div>
          <div className="cx-grid" style={{ marginTop: 4 }}>
            <DetailRow label="Phone" value={answers.emergencyPhone} />
            <DetailRow label="Email" value={answers.emergencyEmail} />
          </div>
        </div>
      ) : (
        <EmptyState icon={Phone} title="No emergency contact" note="No emergency contact was captured on the admission packet." />
      )}
    </Panel>
  );
}

// A compact, total summary of everything captured in the admission packet.
function AdmissionPacketSummary({ admission }) {
  const answers = admission?.answers || {};
  const fieldsStored = Object.keys(answers).length;

  const groups = [
    {
      title: "Demographics & placement",
      icon: UserRound,
      rows: [
        ["Date of birth", displayDate(answers.dob, "Not recorded")],
        ["Gender / pronouns", [answers.gender, answers.pronouns].filter(Boolean).join(" · ") || "Not recorded"],
        ["Room", answers.roomAssignment || admission?.room],
        ["Admission date", displayDate(answers.admissionDate || admission?.admittedAt, "Pending")],
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
      title: "Functional & behavioral",
      icon: HeartPulse,
      rows: [
        ["Mobility", answers.mobility],
        ["Communication", answers.communication],
        ["Observation level", answers.observationLevel],
        ["Behavioral concerns", listText(answers.behavioralConcerns)],
      ],
    },
    {
      title: "Care plan & directives",
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
    <Panel title="Admission packet summary" pad>
      <div style={{ fontSize: 12, color: "var(--cx-muted)", marginBottom: 12 }}>
        {fieldsStored} fields captured · submitted {displayDate(admission?.submittedAt, "recently")}
      </div>
      <div className="cx-grid">
        {groups.map((group) => {
          const Icon = group.icon;
          return (
            <div key={group.title} className="cx-card" style={{ padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span className="cx-feed-ico" style={{ background: "var(--cx-accent-soft)", color: "var(--cx-accent)" }}><Icon size={14} /></span>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--cx-ink)" }}>{group.title}</div>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {group.rows.map(([label, value]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5 }}>
                    <span style={{ color: "var(--cx-muted)" }}>{label}</span>
                    <span style={{ fontWeight: 600, color: "var(--cx-ink)", textAlign: "right" }}>{value || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
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
          <span className="cx-feed-ico" style={{ background: "var(--cx-accent-soft)", color: "var(--cx-accent)" }}><ClipboardList size={15} /></span>
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
    setLoading(true);
    void load();
  }, [load]);

  const admissions = resident?.admissions || [];
  const latestAdmission = admissions[0] || null;
  const currentTab = useMemo(() => TABS.find((item) => item.id === tab) || TABS[0], [tab]);

  // Discharge is a meaningful state change — confirm before calling the endpoint.
  async function dischargeResident() {
    if (discharging || resident?.status === "discharged") return;
    // eslint-disable-next-line no-alert
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

  // Save room / care level via the existing residents PATCH endpoint.
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

  // Upload (or replace) the resident portrait at any time, then persist the URL.
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
      // Popup blocked — surface a hint rather than failing silently.
      // eslint-disable-next-line no-alert
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
      <Link href="/admin/residents" className="cx-link" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
        <ArrowLeft size={14} /> Residents directory
      </Link>

      <PageHeader
        eyebrow="Resident profile"
        title={resident.name}
        lede="Resident details and admission records pulled from the facility database."
        action={(
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Badge tone={resident.status ? statusTone(resident.status) : "blue"} dot>{resident.status}</Badge>
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
              href={`/admin/care-plans/new?${new URLSearchParams({ residentId: resident.id, residentName: resident.name || "", room: resident.room || "" }).toString()}`}
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
        )}
      />

      {editing && (
        <div className="cx-panel" style={{ padding: 18, marginBottom: 18, borderColor: "var(--cx-accent)" }}>
          <div className="cx-eyebrow" style={{ marginBottom: 10 }}>Edit resident</div>
          <div className="cx-grid" style={{ alignItems: "end" }}>
            <div>
              <div className="cx-label">Room</div>
              <input className="cx-input" value={editForm.room} onChange={(e) => setEditForm((s) => ({ ...s, room: e.target.value }))} placeholder="Room 204B" />
            </div>
            <div>
              <div className="cx-label">Care level</div>
              <input className="cx-input" value={editForm.careLevel} onChange={(e) => setEditForm((s) => ({ ...s, careLevel: e.target.value }))} placeholder="Routine" />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="cx-btn cx-btn-primary" onClick={saveEdit} disabled={savingEdit}>{savingEdit ? "Saving..." : "Save"}</button>
              <button type="button" className="cx-btn cx-btn-quiet" onClick={() => setEditing(false)} disabled={savingEdit}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="cx-panel" style={{ padding: 20, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <Avatar name={resident.name} round src={resident.photoUrl} />
            <label className="cx-link" style={{ fontSize: 11, cursor: photoBusy ? "wait" : "pointer" }}>
              {photoBusy ? "Uploading..." : resident.photoUrl ? "Change photo" : "Add photo"}
              <input type="file" accept="image/*" style={{ display: "none" }} disabled={photoBusy}
                onChange={(e) => uploadResidentPhoto(e.target.files?.[0])} />
            </label>
          </div>
          <div style={{ minWidth: 180, flex: "1 1 220px" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--cx-ink)" }}>{resident.name}</div>
            <div style={{ marginTop: 5, fontSize: 12.5, color: "var(--cx-muted)" }}>
              <MapPin size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
              Room {resident.room || "pending"} · {resident.careLevel || "Care level not set"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <DetailRow label="Date of birth" value={displayDate(resident.dateOfBirth)} />
            <DetailRow label="Admitted" value={displayDate(resident.admittedAt)} />
            <DetailRow label="Primary contact" value={latestAdmission?.answers?.emergencyName || "Not recorded"} />
          </div>
        </div>
      </div>

      <div className="cx-stats">
        <StatCard icon={MapPin} label="Room" value={resident.room || "Pending"} />
        <StatCard icon={ClipboardList} label="Care level" value={resident.careLevel || "Not set"} />
        <StatCard icon={CalendarDays} label="Admitted" value={displayDate(resident.admittedAt, "Pending")} />
        <StatCard icon={Contact} label="Admissions" value={admissions.length} />
      </div>

      <div className="cx-toolbar" role="tablist" aria-label="Resident record sections">
        <div className="cx-chips">
          {TABS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                role="tab"
                key={item.id}
                className="cx-chip"
                data-on={tab === item.id ? "true" : "false"}
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
              >
                <Icon size={13} /> {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" aria-label={currentTab.label}>
        {tab === "overview" && (
          latestAdmission ? (
            <div className="cx-cols">
              <div style={{ display: "grid", gap: 18 }}>
                <EmergencyContact answers={latestAdmission.answers || {}} />
                <AdmissionPacketSummary admission={latestAdmission} />
              </div>
              <div style={{ display: "grid", gap: 18 }}>
                <Panel title="Admission packet" pad>
                  <div className="cx-feed">
                    <div className="cx-feed-item">
                      <span className="cx-feed-ico" style={{ background: "var(--cx-accent-soft)", color: "var(--cx-accent)" }}><FileText size={15} /></span>
                      <div className="cx-feed-main">
                        <div className="cx-feed-t">{latestAdmission.status || "submitted"}</div>
                        <div className="cx-feed-s">Submitted {displayDate(latestAdmission.submittedAt, "recently")}</div>
                      </div>
                    </div>
                  </div>
                  <button type="button" className="cx-btn cx-btn-primary" style={{ marginTop: 12, width: "100%", justifyContent: "center" }} onClick={downloadAdmissionForm}>
                    <Download size={15} /> Download admission form
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, color: "var(--cx-faint)", fontSize: 12 }}>
                    <ShieldCheck size={14} color="var(--cx-accent)" /> Opens a print-ready packet — use your browser to Save as PDF.
                  </div>
                </Panel>
                <Panel title="At a glance">
                  <div className="cx-feed">
                    <div className="cx-feed-item"><span className="cx-feed-ico" style={{ background: "var(--cx-accent-soft)", color: "var(--cx-accent)" }}><Pill size={15} /></span><div className="cx-feed-main"><div className="cx-feed-t">Medications captured</div><div className="cx-feed-s">{countFilled(latestAdmission.answers?.medications, (m) => m?.medication)} on admission packet</div></div></div>
                    <div className="cx-feed-item"><span className="cx-feed-ico" style={{ background: "var(--cx-paper-2)", color: "var(--cx-muted)" }}><FileText size={15} /></span><div className="cx-feed-main"><div className="cx-feed-t">Admissions</div><div className="cx-feed-s">{admissions.length} stored record{admissions.length === 1 ? "" : "s"}</div></div></div>
                  </div>
                </Panel>
              </div>
            </div>
          ) : (
            <Panel title="Overview" pad>
              <EmptyState icon={ClipboardList} title="No admission packet" note="This resident has no stored admission snapshot yet." />
            </Panel>
          )
        )}

        {tab === "packet" && (
          latestAdmission
            ? <FullAdmissionPacket admission={latestAdmission} />
            : <Panel title="Full admission" pad><EmptyState icon={FileText} title="No admission packet" note="This resident has no stored admission snapshot yet." /></Panel>
        )}

        {tab === "admissions" && (
          <div className="cx-cols">
            <Panel title="Admission history" pad>
              <AdmissionHistory admissions={admissions} />
            </Panel>
            <Panel title="Latest packet summary" pad>
              {latestAdmission ? <AdmissionPacketSummary admission={latestAdmission} /> : <EmptyState icon={ClipboardList} title="No admissions recorded" note="This resident has no admission snapshots yet." />}
            </Panel>
          </div>
        )}

        {tab === "notes" && <Panel title={SECTION_META.notes.title}><FallbackSection icon={NotebookPen} title={SECTION_META.notes.title} empty={SECTION_META.notes.empty} /></Panel>}
        {tab === "incidents" && <Panel title={SECTION_META.incidents.title}><FallbackSection icon={AlertTriangle} title={SECTION_META.incidents.title} empty={SECTION_META.incidents.empty} /></Panel>}
        {tab === "documents" && <DocumentsPanel scope="residents" residentId={id} docTypes={RESIDENT_DOC_TYPES} emptyNote="Use Upload to add admission assessments, IDs, insurance, and more." />}
      </div>
    </div>
  );
}
