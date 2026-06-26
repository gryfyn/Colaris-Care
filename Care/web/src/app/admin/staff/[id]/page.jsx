"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, Award, CalendarDays, ClipboardList, Clock3, Mail,
  Phone, ShieldCheck, UserRound, Users,
} from "lucide-react";
import { Avatar, Badge, EmptyState, PageHeader, Panel, StatCard } from "@/components/ui/data";
import { getStaff } from "../data";

const TABS = [
  { id: "overview", label: "Overview", icon: UserRound },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "assignments", label: "Assignments", icon: ClipboardList },
  { id: "certifications", label: "Certifications", icon: Award },
  { id: "teams", label: "Teams", icon: Users },
];

const STATUS_TONES = { "In progress": "green", Scheduled: "blue", Planned: "gray", Current: "green", "Due soon": "amber" };

function Feed({ items, icon: Icon, emptyTitle, showStatus = true }) {
  if (!items.length) {
    return <EmptyState icon={Icon} title={emptyTitle} note="No sample items are available for this section." />;
  }
  return (
    <div className="cx-feed">
      {items.map((item) => (
        <div className="cx-feed-item" key={`${item.title}-${item.detail || "item"}`}>
          <span className="cx-feed-ico" style={{ background: "var(--cx-accent-soft)", color: "var(--cx-accent)" }}><Icon size={15} /></span>
          <div className="cx-feed-main">
            <div className="cx-feed-t">{item.title}</div>
            {item.detail && <div className="cx-feed-s">{item.detail}</div>}
          </div>
          {showStatus && item.status && <Badge tone={STATUS_TONES[item.status] || "gray"}>{item.status}</Badge>}
        </div>
      ))}
    </div>
  );
}

export default function StaffDetailPage() {
  const { id } = useParams();
  const staff = getStaff(id);
  const [tab, setTab] = useState("overview");

  if (!staff) {
    return (
      <div className="cx-wide">
        <EmptyState
          icon={UserRound}
          title="Staff member not found"
          note="The profile may have been removed or the link is incorrect."
          action={<Link href="/admin/staff" className="cx-btn cx-btn-primary" style={{ textDecoration: "none" }}>Back to staff</Link>}
        />
      </div>
    );
  }

  const currentTab = TABS.find((item) => item.id === tab);

  return (
    <div className="cx-wide">
      <Link href="/admin/staff" className="cx-link" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
        <ArrowLeft size={14} /> Staff directory
      </Link>

      <PageHeader
        eyebrow="Staff profile"
        title={staff.name}
        lede="A high-level work profile with current assignments, credentials, and team coverage. Sensitive personal information is not shown."
        action={<Badge tone={staff.tone} dot>{staff.status}</Badge>}
      />

      <div className="cx-panel" style={{ padding: 20, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <Avatar name={staff.name} round />
          <div style={{ minWidth: 180, flex: "1 1 220px" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--cx-ink)" }}>{staff.name}</div>
            <div style={{ marginTop: 5, fontSize: 12.5, color: "var(--cx-muted)" }}>{staff.role} · {staff.shift.label}</div>
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div>
              <div className="cx-eyebrow">Email</div>
              <div style={{ marginTop: 7, fontSize: 13, fontWeight: 600 }}><Mail size={12} style={{ verticalAlign: "-2px", marginRight: 5 }} />{staff.email}</div>
            </div>
            <div>
              <div className="cx-eyebrow">Work phone</div>
              <div style={{ marginTop: 7, fontSize: 13, fontWeight: 600 }}><Phone size={12} style={{ verticalAlign: "-2px", marginRight: 5 }} />{staff.phone}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="cx-stats">
        <StatCard icon={Clock3} label="Today's coverage" value={staff.shift.today} />
        <StatCard icon={UserRound} label="Assigned residents" value={staff.residents.length} />
        <StatCard icon={ClipboardList} label="Open tasks" value={staff.tasks.length} />
        <StatCard icon={ShieldCheck} label="Credentials tracked" value={staff.certifications.length} />
      </div>

      <div className="cx-toolbar" role="tablist" aria-label="Staff profile sections">
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
            <Panel title="Work overview" pad>
              <div style={{ display: "grid", gap: 18 }}>
                <div><div className="cx-eyebrow">Role</div><div style={{ marginTop: 7, fontSize: 14, fontWeight: 600 }}>{staff.role}</div></div>
                <div><div className="cx-eyebrow">Primary team</div><div style={{ marginTop: 7, fontSize: 14 }}>{staff.teams[0]}</div></div>
                <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
                  <div><div className="cx-eyebrow">Regular shift</div><div style={{ marginTop: 7, fontSize: 13 }}>{staff.shift.label}</div></div>
                  <div><div className="cx-eyebrow">Next shift</div><div style={{ marginTop: 7, fontSize: 13 }}>{staff.shift.next}</div></div>
                </div>
              </div>
            </Panel>
            <Panel title="At a glance">
              <div className="cx-feed">
                <div className="cx-feed-item"><span className="cx-feed-ico" style={{ background: "var(--cx-accent-soft)", color: "var(--cx-accent)" }}><UserRound size={15} /></span><div className="cx-feed-main"><div className="cx-feed-t">Resident assignments</div><div className="cx-feed-s">{staff.residents.length} high-level assignment{staff.residents.length === 1 ? "" : "s"}</div></div></div>
                <div className="cx-feed-item"><span className="cx-feed-ico" style={{ background: "var(--cx-paper-2)", color: "var(--cx-muted)" }}><Award size={15} /></span><div className="cx-feed-main"><div className="cx-feed-t">Certifications</div><div className="cx-feed-s">{staff.certifications.length} credentials tracked</div></div></div>
                <div className="cx-feed-item"><span className="cx-feed-ico" style={{ background: "var(--cx-paper-2)", color: "var(--cx-muted)" }}><Users size={15} /></span><div className="cx-feed-main"><div className="cx-feed-t">Teams</div><div className="cx-feed-s">{staff.teams.join(" · ")}</div></div></div>
              </div>
            </Panel>
          </div>
        )}

        {tab === "schedule" && <Panel title="Upcoming shifts"><Feed items={staff.schedule} icon={CalendarDays} emptyTitle="No shifts scheduled" /></Panel>}

        {tab === "assignments" && (
          <div className="cx-cols">
            <Panel title="Assigned residents">
              <Feed items={staff.residents.map((name) => ({ title: name, detail: "Current care assignment" }))} icon={UserRound} emptyTitle="No resident assignments" showStatus={false} />
            </Panel>
            <Panel title="Tasks">
              <Feed items={staff.tasks} icon={ClipboardList} emptyTitle="No tasks assigned" />
            </Panel>
          </div>
        )}

        {tab === "certifications" && <Panel title="Credentials and training"><Feed items={staff.certifications} icon={Award} emptyTitle="No certifications recorded" /></Panel>}

        {tab === "teams" && (
          <Panel title="Team memberships">
            <Feed items={staff.teams.map((name, index) => ({ title: name, detail: index === 0 ? "Primary team" : "Supporting team" }))} icon={Users} emptyTitle="No team memberships" showStatus={false} />
          </Panel>
        )}
      </div>
    </div>
  );
}
