"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarClock, CheckCircle2, FileText, HeartPulse, Plus, Search, UserRound, X } from "lucide-react";
import { Avatar, Badge, EmptyState, PageHeader, StatCard } from "@/components/ui/data";
import { apiData, displayDate, statusTone } from "@/lib/client-api";
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

// Overlay to find and select the resident a new care plan is for.
function ResidentPickerModal({ onClose, onPick }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const data = await apiData("/api/v1/residents");
        if (alive) setResidents(Array.isArray(data) ? data : []);
      } catch (err) {
        if (alive) setError(err.message || "Unable to load residents.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const rows = useMemo(() => {
    const search = q.trim().toLowerCase();
    return residents.filter((r) => {
      const name = r.name || `${r.firstName || ""} ${r.lastName || ""}`.trim();
      return !search || [name, r.room, r.careLevel].some((value) => String(value || "").toLowerCase().includes(search));
    });
  }, [q, residents]);

  function pick(resident) {
    const name = resident.name || `${resident.firstName || ""} ${resident.lastName || ""}`.trim();
    if (onPick) onPick(resident);
    const params = new URLSearchParams({ residentId: resident.id, residentName: name, room: resident.room || "" });
    router.push(`/admin/care-plans/new?${params.toString()}`);
  }

  return (
    <div
      className="cx-ob-backdrop"
      role="presentation"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div role="dialog" aria-modal="true" aria-label="Select a resident for the care plan" className="cx-panel" style={{ width: "min(560px, 94vw)", maxHeight: "82vh", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid var(--cx-line)" }}>
          <div>
            <div className="cx-eyebrow">New care plan</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--cx-ink)" }}>Select a resident</div>
          </div>
          <button type="button" className="cx-icon-btn" aria-label="Close" onClick={onClose}><X size={17} /></button>
        </div>

        <div style={{ padding: "14px 18px 6px" }}>
          <div className="cx-search" style={{ width: "100%" }}>
            <Search size={15} />
            <input autoFocus aria-label="Search residents" placeholder="Search by name, room, or care level..." value={q} onChange={(event) => setQ(event.target.value)} />
          </div>
        </div>

        <div style={{ overflowY: "auto", padding: "6px 10px 14px" }}>
          {loading ? (
            <EmptyState icon={UserRound} title="Loading residents" note="Fetching the resident directory..." />
          ) : error ? (
            <EmptyState icon={UserRound} title="Could not load residents" note={error} />
          ) : rows.length ? (
            <div className="cx-feed">
              {rows.map((resident) => {
                const name = resident.name || `${resident.firstName || ""} ${resident.lastName || ""}`.trim();
                return (
                  <button
                    type="button"
                    key={resident.id}
                    className="cx-feed-item"
                    style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer" }}
                    onClick={() => pick(resident)}
                  >
                    <Avatar name={name} round sm />
                    <div className="cx-feed-main">
                      <div className="cx-feed-t">{name}</div>
                      <div className="cx-feed-s">Room {resident.room || "pending"}{resident.careLevel ? ` · ${resident.careLevel}` : ""}</div>
                    </div>
                    <ArrowRight size={16} color="var(--cx-faint)" />
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={UserRound} title="No residents found" note={q ? "Try a different search." : "Admit a resident first, then create their care plan."} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function CarePlansPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [picking, setPicking] = useState(false);
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
      <PageHeader
        eyebrow="Care"
        title="Care plans"
        lede="Review each resident's current plan, focus, ownership, and upcoming review date."
        action={(
          <button type="button" className="cx-btn cx-btn-primary" onClick={() => setPicking(true)}>
            <Plus size={15} /> Add care plan
          </button>
        )}
      />
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
        {rows.length ? <div className="cx-tblscroll"><table className="cx-tbl"><thead><tr><th>Resident</th><th>Focus</th><th>Status</th><th className="cx-hide-sm">Review due</th><th className="cx-hide-sm">Owner</th><th aria-label="Open plan" /></tr></thead><tbody>{rows.map((plan) => <tr key={plan.id} data-click="true" role="link" tabIndex={0} aria-label={`Open ${plan.resident}'s care plan`} onClick={() => openPlan(plan.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openPlan(plan.id); } }}><td><div className="cx-cellname"><Avatar name={plan.resident} round /><b>{plan.resident}</b></div></td><td>{plan.focus}</td><td><Badge tone={plan.tone} dot>{plan.status}</Badge></td><td className="cx-hide-sm cx-cellsub">{plan.nextReview}</td><td className="cx-hide-sm cx-cellsub">{plan.owner}</td><td><ArrowRight size={16} color="var(--cx-faint)" /></td></tr>)}</tbody></table></div> : <EmptyState icon={HeartPulse} title="No care plans yet" note="Create a resident's first care plan with the Add care plan button." action={<button type="button" className="cx-btn cx-btn-primary" onClick={() => setPicking(true)}><Plus size={15} /> Add care plan</button>} />}
      </div>

      {picking && <ResidentPickerModal onClose={() => setPicking(false)} onPick={() => setPicking(false)} />}
    </div>
  );
}
