"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarClock, CheckCircle2, FileText, HeartPulse, Search } from "lucide-react";
import { Avatar, Badge, EmptyState, PageHeader, StatCard } from "@/components/ui/data";
import { displayDate, statusTone } from "@/lib/client-api";
import { useApiQuery } from "@/lib/useApiQuery";
import { CARE_PLANS } from "./data";

const FILTERS = ["All", "Active", "Review due", "Draft"];

function normalizePlan(plan) {
  const status = plan.status || "Active";
  return {
    id: plan.id,
    resident: plan.resident || plan.residentName || "Resident",
    focus: plan.focus || plan.summary || plan.title || "Care plan",
    status: status === "active" ? "Active" : status === "draft" ? "Draft" : status,
    tone: plan.tone || statusTone(status),
    nextReview: plan.nextReview || displayDate(plan.nextReviewAt, "Not scheduled"),
    owner: plan.owner || "Care team",
  };
}

export default function CarePlansPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const { data } = useApiQuery("care-plans", "/api/v1/care-plans", { fallback: CARE_PLANS });
  const plans = useMemo(() => (Array.isArray(data) ? data : CARE_PLANS).map(normalizePlan), [data]);

  const rows = useMemo(() => plans.filter((plan) => {
    const search = query.trim().toLowerCase();
    const matchesFilter = filter === "All" || plan.status === filter;
    const matchesSearch = !search || [plan.resident, plan.focus, plan.owner].some((value) => String(value).toLowerCase().includes(search));
    return matchesFilter && matchesSearch;
  }), [filter, query, plans]);

  const active = plans.filter((plan) => plan.status === "Active").length;
  const due = plans.filter((plan) => plan.status === "Review due").length;
  const drafts = plans.filter((plan) => plan.status === "Draft").length;
  const onSchedule = Math.round((active / (active + due || 1)) * 100);
  const openPlan = (id) => router.push(`/admin/care-plans/${id}`);

  return (
    <div className="cx-wide">
      <PageHeader eyebrow="Care" title="Care plans" lede="Review each resident's current plan, focus, ownership, and upcoming review date." />
      <div className="cx-stats">
        <StatCard icon={HeartPulse} label="Active plans" value={active} />
        <StatCard icon={CalendarClock} label="Reviews due" value={due} delta="needs attention" deltaDir="down" />
        <StatCard icon={FileText} label="Drafts" value={drafts} />
        <StatCard icon={CheckCircle2} label="On schedule" value={`${onSchedule}%`} delta="current plans" deltaDir="up" />
      </div>
      <div className="cx-toolbar">
        <div className="cx-search"><Search size={15} /><input aria-label="Search care plans" placeholder="Search resident, focus, or owner..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <div className="cx-chips" aria-label="Filter care plans by status">{FILTERS.map((item) => <button type="button" key={item} className="cx-chip" data-on={filter === item ? "true" : "false"} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}</div>
        <span className="cx-tb-spacer" />
        <span style={{ fontSize: 12.5, color: "var(--cx-faint)" }}>{rows.length} plan{rows.length === 1 ? "" : "s"}</span>
      </div>
      <div className="cx-tablewrap">
        {rows.length ? <div className="cx-tblscroll"><table className="cx-tbl"><thead><tr><th>Resident</th><th>Focus</th><th>Status</th><th className="cx-hide-sm">Review due</th><th className="cx-hide-sm">Owner</th><th aria-label="Open plan" /></tr></thead><tbody>{rows.map((plan) => <tr key={plan.id} data-click="true" role="link" tabIndex={0} aria-label={`Open ${plan.resident}'s care plan`} onClick={() => openPlan(plan.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openPlan(plan.id); } }}><td><div className="cx-cellname"><Avatar name={plan.resident} round /><b>{plan.resident}</b></div></td><td>{plan.focus}</td><td><Badge tone={plan.tone} dot>{plan.status}</Badge></td><td className="cx-hide-sm cx-cellsub">{plan.nextReview}</td><td className="cx-hide-sm cx-cellsub">{plan.owner}</td><td><ArrowRight size={16} color="var(--cx-faint)" /></td></tr>)}</tbody></table></div> : <EmptyState icon={HeartPulse} title="No care plans match" note="Try a different search or status filter." />}
      </div>
    </div>
  );
}
