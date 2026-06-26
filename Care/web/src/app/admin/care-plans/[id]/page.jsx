"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, CalendarCheck, CalendarClock, CheckCircle2, ClipboardCheck,
  HeartPulse, History, ListChecks, Target, UserRound,
} from "lucide-react";
import { Avatar, Badge, EmptyState, PageHeader, Panel, StatCard } from "@/components/ui/data";
import { getCarePlan } from "../data";

const TABS = [
  { id: "goals", label: "Goals", icon: Target },
  { id: "objectives", label: "Objectives", icon: ListChecks },
  { id: "interventions", label: "Interventions", icon: HeartPulse },
  { id: "reviews", label: "Review history", icon: History },
];

const EMPTY = {
  goals: [Target, "No goals added", "Goals will appear after the draft plan is completed."],
  objectives: [ListChecks, "No objectives added", "Objectives will appear after goals are defined."],
  interventions: [HeartPulse, "No interventions added", "Interventions will appear after the plan is developed."],
  reviews: [History, "No review history", "This draft has not been reviewed yet."],
};

function PlanItems({ plan, tab }) {
  const items = tab === "reviews" ? plan.reviews : plan[tab];
  if (!items.length) {
    const [Icon, title, note] = EMPTY[tab];
    return <EmptyState icon={Icon} title={title} note={note} />;
  }

  if (tab === "goals") {
    return <div className="cx-feed">{items.map((item) => (
      <div className="cx-feed-item" key={item.title}>
        <span className="cx-feed-ico" style={{ background: "var(--cx-accent-soft)", color: "var(--cx-accent)" }}><Target size={15} /></span>
        <div className="cx-feed-main"><div className="cx-feed-t">{item.title}</div><div className="cx-feed-s">Plan goal</div></div>
        <Badge tone={item.tone}>{item.progress}</Badge>
      </div>
    ))}</div>;
  }

  if (tab === "reviews") {
    return <div className="cx-feed">{items.map((item) => (
      <div className="cx-feed-item" key={item.meta}>
        <span className="cx-feed-ico" style={{ background: "var(--cx-accent-soft)", color: "var(--cx-accent)" }}><CalendarCheck size={15} /></span>
        <div className="cx-feed-main"><div className="cx-feed-t">{item.title}</div><div className="cx-feed-s">{item.meta}</div><div style={{ marginTop: 6, fontSize: 12.5, color: "var(--cx-muted)" }}>{item.note}</div></div>
      </div>
    ))}</div>;
  }

  const Icon = tab === "objectives" ? ClipboardCheck : HeartPulse;
  return <div className="cx-feed">{items.map((item) => (
    <div className="cx-feed-item" key={item.title}>
      <span className="cx-feed-ico" style={{ background: "var(--cx-accent-soft)", color: "var(--cx-accent)" }}><Icon size={15} /></span>
      <div className="cx-feed-main">
        <div className="cx-feed-t">{item.title}</div>
        <div className="cx-feed-s">{tab === "objectives" ? `${item.goal} · ${item.cadence}` : `${item.owner} · ${item.frequency}`}</div>
      </div>
    </div>
  ))}</div>;
}

export default function CarePlanDetailPage() {
  const { id } = useParams();
  const plan = getCarePlan(id);
  const [tab, setTab] = useState("goals");

  if (!plan) {
    return <div className="cx-wide"><EmptyState icon={HeartPulse} title="Care plan not found" note="The plan may have been removed or the link is incorrect." action={<Link href="/admin/care-plans" className="cx-btn cx-btn-primary" style={{ textDecoration: "none" }}>Back to care plans</Link>} /></div>;
  }

  const currentTab = TABS.find((item) => item.id === tab);

  return (
    <div className="cx-wide">
      <Link href="/admin/care-plans" className="cx-link" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
        <ArrowLeft size={14} /> Care plans
      </Link>

      <PageHeader
        eyebrow="Care plan"
        title={plan.resident}
        lede="A high-level plan overview. Detailed clinical information and sensitive identifiers are not shown."
        action={<Badge tone={plan.tone} dot>{plan.status}</Badge>}
      />

      <div className="cx-panel" style={{ padding: 20, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <Avatar name={plan.resident} round />
          <div style={{ minWidth: 190, flex: "1 1 240px" }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{plan.resident}</div>
            <div style={{ marginTop: 5, fontSize: 12.5, color: "var(--cx-muted)" }}>Room {plan.room}</div>
          </div>
          <div style={{ flex: "1 1 320px" }}>
            <div className="cx-eyebrow">Current focus</div>
            <div style={{ marginTop: 8, fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>{plan.focus}</div>
          </div>
        </div>
      </div>

      <div className="cx-stats">
        <StatCard icon={UserRound} label="Plan owner" value={plan.owner} />
        <StatCard icon={CalendarCheck} label="Last reviewed" value={plan.lastReviewed} />
        <StatCard icon={CalendarClock} label="Next review" value={plan.nextReview} />
        <StatCard icon={History} label="Review cycle" value={plan.reviewCycle} />
      </div>

      <div className="cx-cols" style={{ marginBottom: 18 }}>
        <Panel title="Plan overview" pad>
          <div style={{ display: "grid", gap: 18 }}>
            <div><div className="cx-eyebrow">Current focus</div><p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.6 }}>{plan.focus}</p></div>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
              <div><div className="cx-eyebrow">Effective date</div><div style={{ marginTop: 7, fontSize: 13, fontWeight: 600 }}>{plan.effectiveDate}</div></div>
              <div><div className="cx-eyebrow">Status</div><div style={{ marginTop: 7 }}><Badge tone={plan.tone} dot>{plan.status}</Badge></div></div>
            </div>
          </div>
        </Panel>
        <Panel title="Sign-off status">
          <div className="cx-feed">
            {plan.signatures.map((signature) => (
              <div className="cx-feed-item" key={signature.role}>
                <span className="cx-feed-ico" style={{ background: "var(--cx-accent-soft)", color: "var(--cx-accent)" }}><CheckCircle2 size={15} /></span>
                <div className="cx-feed-main"><div className="cx-feed-t">{signature.role}</div><div className="cx-feed-s">{signature.status}</div></div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="cx-toolbar" role="tablist" aria-label="Care plan sections">
        <div className="cx-chips">
          {TABS.map((item) => {
            const Icon = item.icon;
            return <button type="button" role="tab" key={item.id} className="cx-chip" data-on={tab === item.id ? "true" : "false"} aria-selected={tab === item.id} onClick={() => setTab(item.id)}><Icon size={13} /> {item.label}</button>;
          })}
        </div>
      </div>

      <div role="tabpanel" aria-label={currentTab.label}>
        <Panel title={currentTab.label}><PlanItems plan={plan} tab={tab} /></Panel>
      </div>
    </div>
  );
}
