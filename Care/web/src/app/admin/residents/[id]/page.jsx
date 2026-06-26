"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, CalendarDays, ClipboardList, Contact, FileText,
  FolderOpen, HeartHandshake, MapPin, NotebookPen, Pill, Phone, UserRound,
} from "lucide-react";
import { Avatar, Badge, EmptyState, PageHeader, Panel, StatCard } from "@/components/ui/data";
import { getResident } from "../data";

const TABS = [
  { id: "care", label: "Care plan", icon: HeartHandshake },
  { id: "medications", label: "Medications", icon: Pill },
  { id: "notes", label: "Recent notes", icon: NotebookPen },
  { id: "incidents", label: "Incidents", icon: AlertTriangle },
  { id: "documents", label: "Documents", icon: FolderOpen },
];

const SECTION_META = {
  medications: { title: "Medication summary", empty: "No medication summary is available yet." },
  notes: { title: "Recent notes", empty: "No recent notes are available." },
  incidents: { title: "Incidents", empty: "No incidents are recorded." },
  documents: { title: "Documents", empty: "No documents are available yet." },
};

function SummaryList({ items, type }) {
  const icons = { medications: Pill, notes: NotebookPen, incidents: AlertTriangle, documents: FileText };
  const Icon = icons[type];
  if (!items.length) {
    return <EmptyState icon={Icon} title={SECTION_META[type].empty} note="This is a high-level sample record." />;
  }
  return (
    <div className="cx-feed">
      {items.map((item) => (
        <div className="cx-feed-item" key={`${item.title || item.name}-${item.meta || item.detail}`}>
          <span className="cx-feed-ico" style={{ background: "var(--cx-accent-soft)", color: "var(--cx-accent)" }}>
            <Icon size={15} />
          </span>
          <div className="cx-feed-main">
            <div className="cx-feed-t">{item.title || item.name}</div>
            <div className="cx-feed-s">{item.meta || item.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ResidentDetailPage() {
  const { id } = useParams();
  const resident = getResident(id);
  const [tab, setTab] = useState("care");

  if (!resident) {
    return (
      <div className="cx-wide">
        <EmptyState
          icon={UserRound}
          title="Resident not found"
          note="The resident may have been removed or the link is incorrect."
          action={<Link href="/admin/residents" className="cx-btn cx-btn-primary" style={{ textDecoration: "none" }}>Back to residents</Link>}
        />
      </div>
    );
  }

  const currentTab = TABS.find((item) => item.id === tab);

  return (
    <div className="cx-wide">
      <Link href="/admin/residents" className="cx-link" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
        <ArrowLeft size={14} /> Residents directory
      </Link>

      <PageHeader
        eyebrow="Resident profile"
        title={resident.name}
        lede="A high-level care overview. Sensitive identifiers and detailed clinical information are not shown."
        action={<Badge tone={resident.tone} dot>{resident.status}</Badge>}
      />

      <div className="cx-panel" style={{ padding: 20, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <Avatar name={resident.name} round />
          <div style={{ minWidth: 180, flex: "1 1 220px" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--cx-ink)" }}>{resident.name}</div>
            <div style={{ marginTop: 5, fontSize: 12.5, color: "var(--cx-muted)" }}>
              <MapPin size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
              Room {resident.room} · {resident.level}
            </div>
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div>
              <div className="cx-eyebrow">Date of birth</div>
              <div style={{ marginTop: 7, fontSize: 13, fontWeight: 600 }}>{resident.dob}</div>
            </div>
            <div>
              <div className="cx-eyebrow">Primary contact</div>
              <div style={{ marginTop: 7, fontSize: 13, fontWeight: 600 }}>{resident.primaryContact}</div>
              <div style={{ marginTop: 3, fontSize: 12, color: "var(--cx-muted)" }}><Phone size={11} /> {resident.contactPhone}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="cx-stats">
        <StatCard icon={MapPin} label="Room" value={resident.room} />
        <StatCard icon={ClipboardList} label="Care level" value={resident.level} />
        <StatCard icon={CalendarDays} label="Admitted" value={resident.admitted} />
        <StatCard icon={Contact} label="Coordinator" value={resident.carePlan.coordinator} />
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
        {tab === "care" ? (
          <div className="cx-cols">
            <Panel title="Care plan summary" pad>
              <div style={{ display: "grid", gap: 18 }}>
                <div>
                  <div className="cx-eyebrow">Current focus</div>
                  <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.6 }}>{resident.carePlan.focus}</p>
                </div>
                <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
                  <div><div className="cx-eyebrow">Last reviewed</div><div style={{ marginTop: 7, fontSize: 13 }}>{resident.carePlan.reviewed}</div></div>
                  <div><div className="cx-eyebrow">Next review</div><div style={{ marginTop: 7, fontSize: 13 }}>{resident.carePlan.nextReview}</div></div>
                </div>
              </div>
            </Panel>
            <Panel title="At a glance">
              <div className="cx-feed">
                <div className="cx-feed-item"><span className="cx-feed-ico" style={{ background: "var(--cx-accent-soft)", color: "var(--cx-accent)" }}><Pill size={15} /></span><div className="cx-feed-main"><div className="cx-feed-t">Medication summary</div><div className="cx-feed-s">{resident.medications.length} overview item{resident.medications.length === 1 ? "" : "s"}</div></div></div>
                <div className="cx-feed-item"><span className="cx-feed-ico" style={{ background: "var(--cx-paper-2)", color: "var(--cx-muted)" }}><FileText size={15} /></span><div className="cx-feed-main"><div className="cx-feed-t">Documents</div><div className="cx-feed-s">{resident.documents.length} available</div></div></div>
              </div>
            </Panel>
          </div>
        ) : (
          <Panel title={SECTION_META[tab].title}>
            <SummaryList items={resident[tab]} type={tab} />
          </Panel>
        )}
      </div>
    </div>
  );
}
