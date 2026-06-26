"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, CalendarCheck, CalendarClock, CheckCircle2, ClipboardCheck,
  Download, HeartPulse, History, ListChecks, Target, UserRound,
} from "lucide-react";
import { Avatar, Badge, EmptyState, PageHeader, Panel, StatCard } from "@/components/ui/data";
import { apiData, displayDate, statusTone } from "@/lib/client-api";
import { openCarePlanPrint } from "@/lib/care-plan-print";

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
  reviews: [History, "No review history", "This plan has not been reviewed yet."],
};

// Maps the API care plan into the shape this template renders.
function toView(plan) {
  const c = plan.content || {};
  const signatures = [
    { role: "Clinician sign-off", status: plan.signedAt ? `Signed ${displayDate(plan.signedAt)}` : "Pending" },
    { role: "Administrator approval", status: plan.approvedAt ? `Approved ${displayDate(plan.approvedAt)}` : "Pending" },
  ];
  return {
    resident: plan.residentName,
    room: plan.room || "pending",
    focus: plan.summary || plan.title || "Care plan",
    title: plan.title,
    owner: c.owner || "Care team",
    status: plan.status === "active" ? "Active" : plan.status === "draft" ? "Draft" : plan.status,
    tone: statusTone(plan.status),
    lastReviewed: displayDate(plan.reviewedAt, "Not reviewed"),
    nextReview: displayDate(plan.nextReviewAt, "Not scheduled"),
    reviewCycle: c.reviewCycle || "As needed",
    effectiveDate: displayDate(c.effectiveDate || plan.createdAt, "Not set"),
    signatures,
    goals: c.goals || [],
    objectives: c.objectives || [],
    interventions: c.interventions || [],
    reviews: c.reviews || [],
  };
}

function PlanItems({ plan, tab }) {
  const items = tab === "reviews" ? plan.reviews : plan[tab];
  if (!items.length) {
    const [Icon, title, note] = EMPTY[tab];
    return <EmptyState icon={Icon} title={title} note={note} />;
  }

  if (tab === "goals") {
    return <div className="cx-feed">{items.map((item, index) => (
      <div className="cx-feed-item" key={`${item.title}-${index}`}>
        <span className="cx-feed-ico" style={{ background: "var(--cx-accent-soft)", color: "var(--cx-accent)" }}><Target size={15} /></span>
        <div className="cx-feed-main"><div className="cx-feed-t">{item.title}</div><div className="cx-feed-s">Plan goal</div></div>
        {item.progress && <Badge tone={statusTone(item.progress)}>{item.progress}</Badge>}
      </div>
    ))}</div>;
  }

  if (tab === "reviews") {
    return <div className="cx-feed">{items.map((item, index) => (
      <div className="cx-feed-item" key={`${item.meta}-${index}`}>
        <span className="cx-feed-ico" style={{ background: "var(--cx-accent-soft)", color: "var(--cx-accent)" }}><CalendarCheck size={15} /></span>
        <div className="cx-feed-main"><div className="cx-feed-t">{item.title}</div><div className="cx-feed-s">{item.meta}</div>{item.note && <div style={{ marginTop: 6, fontSize: 12.5, color: "var(--cx-muted)" }}>{item.note}</div>}</div>
      </div>
    ))}</div>;
  }

  const Icon = tab === "objectives" ? ClipboardCheck : HeartPulse;
  return <div className="cx-feed">{items.map((item, index) => (
    <div className="cx-feed-item" key={`${item.title}-${index}`}>
      <span className="cx-feed-ico" style={{ background: "var(--cx-accent-soft)", color: "var(--cx-accent)" }}><Icon size={15} /></span>
      <div className="cx-feed-main">
        <div className="cx-feed-t">{item.title}</div>
        <div className="cx-feed-s">{tab === "objectives" ? [item.goal, item.cadence].filter(Boolean).join(" · ") || "Objective" : [item.owner, item.frequency].filter(Boolean).join(" · ") || "Intervention"}</div>
      </div>
    </div>
  ))}</div>;
}

export default function CarePlanDetailPage() {
  const { id } = useParams();
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("goals");

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        setLoading(true);
        setError("");
        const data = await apiData(`/api/v1/care-plans/${id}`);
        if (alive) setRaw(data);
      } catch (err) {
        if (alive) setError(err.message || "Care plan not found");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  const plan = useMemo(() => (raw ? toView(raw) : null), [raw]);
  const currentTab = TABS.find((item) => item.id === tab);

  function download() {
    if (raw) openCarePlanPrint(raw);
  }

  if (loading) {
    return <div className="cx-wide"><EmptyState icon={HeartPulse} title="Loading care plan" note="Fetching the resident's care plan..." /></div>;
  }

  if (error || !plan) {
    return <div className="cx-wide"><EmptyState icon={HeartPulse} title="Care plan not found" note={error || "The plan may have been removed or the link is incorrect."} action={<Link href="/admin/care-plans" className="cx-btn cx-btn-primary" style={{ textDecoration: "none" }}>Back to care plans</Link>} /></div>;
  }

  return (
    <div className="cx-wide">
      <Link href="/admin/care-plans" className="cx-link" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
        <ArrowLeft size={14} /> Care plans
      </Link>

      <PageHeader
        eyebrow="Care plan"
        title={plan.resident}
        lede="The resident's care plan — focus, goals, objectives, interventions, and review history."
        action={(
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Badge tone={plan.tone} dot>{plan.status}</Badge>
            <button type="button" className="cx-btn cx-btn-primary" onClick={download} title="Download the care plan as PDF">
              <Download size={15} /> Download care plan
            </button>
          </div>
        )}
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
