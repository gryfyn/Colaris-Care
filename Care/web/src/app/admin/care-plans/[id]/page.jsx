"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, CalendarCheck, CheckCheck, CheckCircle2, ClipboardCheck,
  Download, HeartPulse, History, ListChecks, Loader2, PenLine, Target,
} from "lucide-react";
import { Badge, EmptyState, PageBand, PortraitButton } from "@/components/ui/data";
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

// Maps the API care plan into the shape this template renders.
function toView(plan) {
  const c = plan.content || {};
  const signatures = [
    { role: "Clinician sign-off", status: plan.signedAt ? `Signed ${displayDate(plan.signedAt)}` : "Pending" },
    { role: "Administrator approval", status: plan.approvedAt ? `Approved ${displayDate(plan.approvedAt)}` : "Pending" },
  ];
  return {
    resident: plan.residentName,
    photoUrl: plan.photoUrl || null,
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
        <div className="cx-feed-main"><div className="cx-feed-t">{item.title}</div><div className="cx-feed-s">{item.meta}</div>{item.note && <div className="cx-feed-note">{item.note}</div>}</div>
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
  const [acting, setActing] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const data = await apiData(`/api/v1/care-plans/${id}`);
      setRaw(data);
    } catch (err) {
      setError(err.message || "Care plan not found");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    Promise.resolve().then(() => {
      setLoading(true);
      void load();
    });
  }, [load]);

  const plan = useMemo(() => (raw ? toView(raw) : null), [raw]);
  const currentTab = TABS.find((item) => item.id === tab);

  function download() {
    if (raw) openCarePlanPrint(raw);
  }

  // Sign / approve hit the existing endpoints, then refetch to refresh sign-off.
  async function act(action) {
    if (acting) return;
    setActing(action);
    try {
      await apiData(`/api/v1/care-plans/${id}/${action}`, { method: "POST", body: JSON.stringify({}) });
      await load();
    } catch (err) {
      setError(err.message || `Unable to ${action} the care plan.`);
    } finally {
      setActing("");
    }
  }

  if (loading) {
    return <div className="cx-wide"><EmptyState icon={HeartPulse} title="Loading care plan" note="Fetching the resident's care plan..." /></div>;
  }

  if (error || !plan) {
    return <div className="cx-wide"><EmptyState icon={HeartPulse} title="Care plan not found" note={error || "The plan may have been removed or the link is incorrect."} action={<Link href="/admin/care-plans" className="cx-btn cx-btn-primary" style={{ textDecoration: "none" }}>Back to care plans</Link>} /></div>;
  }

  return (
    <div className="cx-wide">
      <Link href="/admin/care-plans" className="cx-link cx-page-back">
        <ArrowLeft size={14} /> Care plans
      </Link>

      <PageBand
        eyebrow="Care plan"
        title={plan.resident}
        lede="The resident's care plan — focus, goals, objectives, interventions, and review history."
        action={(
          <div className="cx-actions-cluster">
            <Badge tone={plan.tone} dot>{plan.status}</Badge>
            <button type="button" className="cx-btn cx-btn-primary" onClick={download} title="Download the care plan as PDF">
              <Download size={15} /> Download care plan
            </button>
          </div>
        )}
      />

      <div className="cx-detail-grid">
        <main className="cx-detail-main">
          <div className="cx-section-stack">
            <DetailSection eyebrow="Plan overview" title="Current focus">
              <div className="cx-icon-line">
                <span className="cx-feed-ico"><HeartPulse size={16} /></span>
                <FactList columns rows={[
                  ["Focus", plan.focus],
                  ["Effective date", plan.effectiveDate, { tnum: true }],
                  ["Status", plan.status],
                  ["Owner", plan.owner],
                ]} />
              </div>
            </DetailSection>

            <div className="cx-detail-tabs" role="tablist" aria-label="Care plan sections">
              {TABS.map((item) => {
                const Icon = item.icon;
                return <button type="button" role="tab" key={item.id} className="cx-chip" data-on={tab === item.id ? "true" : "false"} aria-selected={tab === item.id} onClick={() => setTab(item.id)}><Icon size={15} /> {item.label}</button>;
              })}
            </div>

            <div role="tabpanel" aria-label={currentTab.label}>
              <DetailSection eyebrow="Care plan" title={currentTab.label}>
                <PlanItems plan={plan} tab={tab} />
              </DetailSection>
            </div>
          </div>
        </main>

        <aside className="cx-detail-rail" aria-label="Care plan at-a-glance facts">
          <DetailSection eyebrow="At a glance" title="Plan facts">
            <div className="cx-icon-line">
              <PortraitButton name={plan.resident} src={plan.photoUrl} size="xl" />
              <FactList rows={[
                ["Resident", plan.resident],
                ["Room", plan.room, { tnum: true }],
                ["Plan owner", plan.owner],
                ["Last reviewed", plan.lastReviewed, { tnum: true }],
                ["Next review", plan.nextReview, { tnum: true }],
                ["Review cycle", plan.reviewCycle],
              ]} />
            </div>
          </DetailSection>

          <DetailSection eyebrow="Sign-off" title="Approvals">
            <div className="cx-feed">
              {plan.signatures.map((signature) => (
                <div className="cx-feed-item" key={signature.role}>
                  <span className="cx-feed-ico"><CheckCircle2 size={15} /></span>
                  <div className="cx-feed-main"><div className="cx-feed-t">{signature.role}</div><div className="cx-feed-s cx-tnum">{signature.status}</div></div>
                </div>
              ))}
            </div>
            <div className="cx-inline-actions cx-full-action">
              <button type="button" className="cx-btn cx-btn-ghost" onClick={() => act("sign")} disabled={Boolean(acting) || Boolean(raw.signedAt)}>
                {acting === "sign" ? <Loader2 size={14} className="cx-spin" /> : <PenLine size={14} />} {raw.signedAt ? "Signed" : "Sign as clinician"}
              </button>
              <button type="button" className="cx-btn cx-btn-primary" onClick={() => act("approve")} disabled={Boolean(acting) || Boolean(raw.approvedAt)}>
                {acting === "approve" ? <Loader2 size={14} className="cx-spin" /> : <CheckCheck size={14} />} {raw.approvedAt ? "Approved" : "Approve plan"}
              </button>
            </div>
            {error && <div className="cx-error-text">{error}</div>}
          </DetailSection>
        </aside>
      </div>
    </div>
  );
}
