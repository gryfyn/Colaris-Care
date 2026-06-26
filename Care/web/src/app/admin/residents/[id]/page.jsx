"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  Contact,
  FileText,
  FolderOpen,
  HeartHandshake,
  MapPin,
  NotebookPen,
  Pill,
  UserRound,
} from "lucide-react";
import { Avatar, Badge, EmptyState, PageHeader, Panel, StatCard } from "@/components/ui/data";
import { apiData, displayDate, statusTone } from "@/lib/client-api";

const TABS = [
  { id: "overview", label: "Overview", icon: HeartHandshake },
  { id: "admissions", label: "Admissions", icon: ClipboardList },
  { id: "notes", label: "Recent notes", icon: NotebookPen },
  { id: "incidents", label: "Incidents", icon: AlertTriangle },
  { id: "documents", label: "Documents", icon: FolderOpen },
];

const SECTION_META = {
  notes: { title: "Recent notes", empty: "No recent notes are available." },
  incidents: { title: "Incidents", empty: "No incidents are recorded." },
  documents: { title: "Documents", empty: "No documents are available yet." },
};

function DetailRow({ label, value }) {
  return (
    <div>
      <div className="cx-eyebrow">{label}</div>
      <div style={{ marginTop: 7, fontSize: 13.5, fontWeight: 600, color: "var(--cx-ink)" }}>{value || "Not recorded"}</div>
    </div>
  );
}

function AdmissionSummary({ admission }) {
  const answers = admission?.answers || {};
  return (
    <div className="cx-grid">
      <Panel title="Admission snapshot" pad>
        <div className="cx-grid">
          <DetailRow label="Submission status" value={admission ? admission.status : null} />
          <DetailRow label="Submitted" value={displayDate(admission?.submittedAt, "Recent")} />
          <DetailRow label="Admission date" value={displayDate(admission?.admittedAt, "Pending")} />
          <DetailRow label="Room" value={admission?.room || answers.roomAssignment} />
          <DetailRow label="Care level" value={admission?.careLevel || answers.observationLevel || answers.mobility} />
          <DetailRow label="Portal email" value={admission?.email || answers.email} />
          <DetailRow label="Referral source" value={answers.referralSource} />
          <DetailRow label="Emergency contact" value={answers.emergencyName} />
          <DetailRow label="Contact phone" value={answers.emergencyPhone} />
        </div>
      </Panel>
      <Panel title="Admission details">
        <div className="cx-feed">
          <div className="cx-feed-item">
            <span className="cx-feed-ico" style={{ background: "var(--cx-accent-soft)", color: "var(--cx-accent)" }}><Contact size={15} /></span>
            <div className="cx-feed-main">
              <div className="cx-feed-t">{answers.emergencyName || "Emergency contact not set"}</div>
              <div className="cx-feed-s">{answers.emergencyRelationship || "Relationship not recorded"} {answers.emergencyPhone ? `· ${answers.emergencyPhone}` : ""}</div>
            </div>
          </div>
          <div className="cx-feed-item">
            <span className="cx-feed-ico" style={{ background: "var(--cx-paper-2)", color: "var(--cx-muted)" }}><FileText size={15} /></span>
            <div className="cx-feed-main">
              <div className="cx-feed-t">Admission data captured</div>
              <div className="cx-feed-s">{Object.keys(answers).length} fields stored in the admission snapshot</div>
            </div>
          </div>
        </div>
      </Panel>
    </div>
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

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        setLoading(true);
        setError("");
        const data = await apiData(`/api/v1/residents/${id}`);
        if (alive) setResident(data);
      } catch (err) {
        if (alive) setError(err.message || "Resident not found");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  const admissions = resident?.admissions || [];
  const latestAdmission = admissions[0] || null;
  const currentTab = useMemo(() => TABS.find((item) => item.id === tab) || TABS[0], [tab]);

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
        action={<Badge tone={resident.status ? statusTone(resident.status) : "blue"} dot>{resident.status}</Badge>}
      />

      <div className="cx-panel" style={{ padding: 20, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <Avatar name={resident.name} round />
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
          <div className="cx-cols">
            <AdmissionSummary admission={latestAdmission} />
            <Panel title="At a glance">
              <div className="cx-feed">
                <div className="cx-feed-item"><span className="cx-feed-ico" style={{ background: "var(--cx-accent-soft)", color: "var(--cx-accent)" }}><Pill size={15} /></span><div className="cx-feed-main"><div className="cx-feed-t">Medication summary</div><div className="cx-feed-s">{resident.medications?.length || 0} overview item{(resident.medications?.length || 0) === 1 ? "" : "s"}</div></div></div>
                <div className="cx-feed-item"><span className="cx-feed-ico" style={{ background: "var(--cx-paper-2)", color: "var(--cx-muted)" }}><FileText size={15} /></span><div className="cx-feed-main"><div className="cx-feed-t">Admissions</div><div className="cx-feed-s">{admissions.length} stored admission record{admissions.length === 1 ? "" : "s"}</div></div></div>
              </div>
            </Panel>
          </div>
        )}

        {tab === "admissions" && (
          <div className="cx-cols">
            <Panel title="Admission history" pad>
              <AdmissionHistory admissions={admissions} />
            </Panel>
            <Panel title="Latest snapshot" pad>
              {latestAdmission ? <AdmissionSummary admission={latestAdmission} /> : <EmptyState icon={ClipboardList} title="No admissions recorded" note="This resident has no admission snapshots yet." />}
            </Panel>
          </div>
        )}

        {tab === "notes" && <Panel title={SECTION_META.notes.title}><FallbackSection icon={NotebookPen} title={SECTION_META.notes.title} empty={SECTION_META.notes.empty} /></Panel>}
        {tab === "incidents" && <Panel title={SECTION_META.incidents.title}><FallbackSection icon={AlertTriangle} title={SECTION_META.incidents.title} empty={SECTION_META.incidents.empty} /></Panel>}
        {tab === "documents" && <Panel title={SECTION_META.documents.title}><FallbackSection icon={FolderOpen} title={SECTION_META.documents.title} empty={SECTION_META.documents.empty} /></Panel>}
      </div>
    </div>
  );
}
