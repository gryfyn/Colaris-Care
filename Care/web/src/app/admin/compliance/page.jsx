"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  History,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Badge, EmptyState, PageHeader, Panel, StatCard } from "@/components/ui/data";

const FALLBACK_SUMMARY = {
  incidentFollowUpOpen: 2,
  staffCertificationRecords: 7,
  auditEventsLast7Days: 24,
  lastEvacuationDrillAt: "2026-06-20T14:30:00.000Z",
};

const POLICIES = [
  { id: "POL-HIPAA-01", name: "PHI access and minimum necessary use", owner: "Compliance", status: "Current", tone: "green", reviewDue: "Aug 15, 2026" },
  { id: "POL-MED-02", name: "Medication administration evidence", owner: "Clinical", status: "Review due", tone: "amber", reviewDue: "Jul 8, 2026" },
  { id: "POL-INC-03", name: "Incident escalation and follow-up", owner: "Operations", status: "Current", tone: "green", reviewDue: "Sep 1, 2026" },
  { id: "POL-DOC-04", name: "Document retention and release of information", owner: "Admin", status: "Current", tone: "green", reviewDue: "Oct 12, 2026" },
];

const TRAINING = [
  { id: "TRN-101", name: "HIPAA refresher", group: "All staff", due: "Jul 12, 2026", status: "Due soon", tone: "amber" },
  { id: "TRN-117", name: "Medication administration record", group: "Care staff", due: "Aug 2, 2026", status: "On track", tone: "green" },
  { id: "TRN-122", name: "Emergency evacuation drill protocol", group: "All staff", due: "Jul 22, 2026", status: "On track", tone: "green" },
];

const FOLLOW_UPS = [
  { id: "INC-2046", item: "Incident report follow-up", owner: "Admin review", due: "Jun 26, 2026", status: "Open", tone: "amber" },
  { id: "MED-4412", item: "Medication variance review", owner: "Clinical lead", due: "Jun 27, 2026", status: "Open", tone: "amber" },
  { id: "EVAC-0620", item: "Evacuation drill sign-off", owner: "Operations", due: "Complete", status: "Closed", tone: "green" },
];

function authHeaders() {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem("colaris_access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDate(value) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function normalizeAudit(row) {
  return {
    id: row.id,
    action: row.action,
    target: row.targetType || row.target_type || "system",
    outcome: row.outcome || "success",
    occurredAt: row.occurredAt || row.occurred_at,
  };
}

export default function CompliancePage() {
  const [summary, setSummary] = useState(FALLBACK_SUMMARY);
  const [auditEvents, setAuditEvents] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadCompliance() {
    setLoading(true);
    try {
      const headers = authHeaders();
      const [summaryResponse, auditResponse] = await Promise.all([
        fetch("/api/v1/compliance", { headers }),
        fetch("/api/v1/audit-events", { headers }),
      ]);

      if (summaryResponse.ok) {
        const payload = await summaryResponse.json();
        setSummary(payload.data || FALLBACK_SUMMARY);
      }

      if (auditResponse.ok) {
        const payload = await auditResponse.json();
        setAuditEvents((payload.data || []).map(normalizeAudit));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCompliance();
  }, []);

  const filteredPolicies = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return POLICIES;
    return POLICIES.filter((policy) => [policy.id, policy.name, policy.owner, policy.status]
      .some((value) => value.toLowerCase().includes(search)));
  }, [query]);

  const recentAudit = auditEvents.length ? auditEvents.slice(0, 8) : [
    { id: "AUD-1", action: "incident.create", target: "incident_report", outcome: "success", occurredAt: "2026-06-24T18:10:00.000Z" },
    { id: "AUD-2", action: "care_plans:create", target: "care_plan", outcome: "success", occurredAt: "2026-06-24T17:42:00.000Z" },
    { id: "AUD-3", action: "medication_administrations:write", target: "medication_administration", outcome: "success", occurredAt: "2026-06-24T16:55:00.000Z" },
  ];

  return (
    <div className="cx-wide">
      <style>{`
        .comp-grid { display:grid; grid-template-columns:minmax(0,1.25fr) minmax(320px,.75fr); gap:16px; align-items:start; }
        .comp-stack { display:grid; gap:14px; min-width:0; }
        .comp-list { display:grid; gap:9px; }
        .comp-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:12px; align-items:center; padding:12px 14px; border:1px solid var(--cx-border); border-radius:var(--cx-r); background:var(--cx-paper); }
        .comp-row strong { display:block; color:var(--cx-ink); font-size:13.5px; }
        .comp-row small { display:block; margin-top:3px; color:var(--cx-muted); font-size:12px; }
        .comp-table-meta { display:flex; flex-wrap:wrap; gap:7px; align-items:center; margin-top:4px; color:var(--cx-faint); font-size:12px; }
        .comp-toolbar { display:flex; gap:10px; align-items:center; margin-bottom:12px; }
        .comp-search { position:relative; flex:1; min-width:220px; }
        .comp-search svg { position:absolute; left:13px; top:12px; color:var(--cx-faint); }
        .comp-search input { padding-left:38px; }
        .comp-actions { display:flex; justify-content:flex-end; }
        @media (max-width: 920px) { .comp-grid { grid-template-columns:1fr; } }
      `}</style>

      <PageHeader
        eyebrow="Compliance"
        title="Compliance"
        lede="Audit readiness, policies, training expiry, incident follow-up, and facility evidence in one operational view."
        action={(
          <button type="button" className="cx-btn cx-btn-primary" onClick={loadCompliance} disabled={loading}>
            <RefreshCw size={15} /> {loading ? "Refreshing" : "Refresh"}
          </button>
        )}
      />

      <div className="cx-stats">
        <StatCard icon={AlertTriangle} label="Open follow-ups" value={summary.incidentFollowUpOpen} delta="review queue" deltaDir={summary.incidentFollowUpOpen ? "down" : "up"} />
        <StatCard icon={ClipboardCheck} label="Training records" value={summary.staffCertificationRecords} delta="tracked" deltaDir="up" />
        <StatCard icon={History} label="Audit events" value={summary.auditEventsLast7Days} delta="last 7 days" deltaDir="up" />
        <StatCard icon={ShieldCheck} label="Last drill" value={formatDate(summary.lastEvacuationDrillAt)} delta="facility-wide" deltaDir="up" />
      </div>

      <div className="comp-grid">
        <main className="comp-stack">
          <Panel title="Policies">
            <div className="comp-toolbar">
              <div className="comp-search">
                <Search size={15} />
                <input
                  className="cx-input"
                  aria-label="Search policies"
                  placeholder="Search policy, owner, or status..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            </div>
            {filteredPolicies.length ? (
              <div className="cx-tblscroll">
                <table className="cx-tbl">
                  <thead>
                    <tr><th>Policy</th><th>Owner</th><th>Status</th><th>Review due</th></tr>
                  </thead>
                  <tbody>
                    {filteredPolicies.map((policy) => (
                      <tr key={policy.id}>
                        <td><b>{policy.name}</b><div className="cx-cellsub">{policy.id}</div></td>
                        <td>{policy.owner}</td>
                        <td><Badge tone={policy.tone} dot>{policy.status}</Badge></td>
                        <td>{policy.reviewDue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={FileCheck2} title="No policies match" note="Try a different policy search." />
            )}
          </Panel>

          <Panel title="Incident Follow-Up">
            <div className="comp-list">
              {FOLLOW_UPS.map((item) => (
                <div className="comp-row" key={item.id}>
                  <div>
                    <strong>{item.item}</strong>
                    <div className="comp-table-meta"><span>{item.id}</span><span>{item.owner}</span><span>Due {item.due}</span></div>
                  </div>
                  <Badge tone={item.tone} dot>{item.status}</Badge>
                </div>
              ))}
            </div>
          </Panel>
        </main>

        <aside className="comp-stack">
          <Panel title="Training">
            <div className="comp-list">
              {TRAINING.map((item) => (
                <div className="comp-row" key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <small>{item.group} - due {item.due}</small>
                  </div>
                  <Badge tone={item.tone} dot>{item.status}</Badge>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Recent Audit Evidence">
            <div className="comp-list">
              {recentAudit.map((event) => (
                <div className="comp-row" key={event.id}>
                  <div>
                    <strong>{event.action}</strong>
                    <small>{event.target} - {formatDate(event.occurredAt)}</small>
                  </div>
                  <Badge tone={event.outcome === "success" ? "green" : "amber"} dot>{event.outcome}</Badge>
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
