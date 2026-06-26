"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, ClipboardList, MapPin, Phone, ShieldCheck, Sparkles, UserRound, Utensils,
} from "lucide-react";
import { Avatar, Badge, EmptyState, PageHeader, Panel, StatCard } from "@/components/ui/data";
import { getStaffResident } from "../data";

export default function StaffResidentDetailPage() {
  const { id } = useParams();
  const resident = getStaffResident(id);

  if (!resident) {
    return (
      <div className="cx-wide">
        <EmptyState
          icon={UserRound}
          title="Resident not found"
          note="The resident may have been reassigned or the link is incorrect."
          action={<Link href="/staff/residents" className="cx-btn cx-btn-primary" style={{ textDecoration: "none" }}>Back to residents</Link>}
        />
      </div>
    );
  }

  return (
    <div className="cx-wide">
      <Link href="/staff/residents" className="cx-link" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
        <ArrowLeft size={14} /> Residents directory
      </Link>

      <PageHeader
        eyebrow="Caregiver overview"
        title={resident.name}
        lede="The basics you need on shift — room, routines, and key contacts. No detailed clinical or sensitive records are shown."
        action={resident.assigned ? <Badge tone="green" dot>Assigned to me</Badge> : <Badge tone="gray">Facility resident</Badge>}
      />

      <div className="cx-panel" style={{ padding: 20, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <Avatar name={resident.name} round />
          <div style={{ minWidth: 180, flex: "1 1 220px" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--cx-ink)" }}>{resident.name}</div>
            <div style={{ marginTop: 5, fontSize: 12.5, color: "var(--cx-muted)" }}>
              <MapPin size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
              Room {resident.room} · {resident.wing} · {resident.level}
            </div>
          </div>
        </div>
      </div>

      <div className="cx-stats">
        <StatCard icon={MapPin} label="Room" value={resident.room} />
        <StatCard icon={ClipboardList} label="Care level" value={resident.level} />
        <StatCard icon={UserRound} label="Mobility" value={resident.mobility} />
        <StatCard icon={Utensils} label="Diet" value={resident.diet} />
        <StatCard icon={ShieldCheck} label="SSN last four" value={resident.ssnLast4} />
      </div>

      <div className="cx-cols">
        <div style={{ display: "grid", gap: 18 }}>
          <Panel title="Care level notes" pad>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--cx-ink)" }}>{resident.careLevelNote}</p>
          </Panel>

          <Panel title="Daily routine">
            <div className="cx-feed">
              {resident.routine.map((item) => (
                <div className="cx-feed-item" key={item.title}>
                  <span className="cx-feed-ico" style={{ background: "var(--cx-accent-soft)", color: "var(--cx-accent)" }}><Sparkles size={15} /></span>
                  <div className="cx-feed-main">
                    <div className="cx-feed-t">{item.title}</div>
                    <div className="cx-feed-s">{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <Panel title="Key contacts">
          <div className="cx-feed">
            {resident.contacts.map((contact) => (
              <div className="cx-feed-item" key={contact.name}>
                <span className="cx-feed-ico" style={{ background: "var(--cx-paper-2)", color: "var(--cx-muted)" }}><Phone size={15} /></span>
                <div className="cx-feed-main">
                  <div className="cx-feed-t">{contact.name}</div>
                  <div className="cx-feed-s">{contact.relationship} · {contact.phone}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="cx-mt" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--cx-faint)", fontSize: 12 }}>
        <ShieldCheck size={14} color="var(--cx-accent)" />
        Sample data — caregiver overview only, no protected health information.
      </div>
    </div>
  );
}
