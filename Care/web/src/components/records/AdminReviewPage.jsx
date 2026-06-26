"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, Clock3, Search, X, XCircle } from "lucide-react";
import { Badge, PageHeader, StatCard } from "@/components/ui/data";
import { RECORD_CONFIG, RESIDENTS } from "./recordData";

const tone = { Pending: "amber", Approved: "green", Rejected: "red" };

export default function AdminReviewPage({ type }) {
  const config = RECORD_CONFIG[type];
  const [records, setRecords] = useState(config.records);
  const [status, setStatus] = useState("All");
  const [resident, setResident] = useState("");
  const [query, setQuery] = useState("");
  const [reviewing, setReviewing] = useState(null);
  const [reviewNotes, setReviewNotes] = useState("");

  const filtered = useMemo(() => records.filter((record) => {
    if (status !== "All" && record.status !== status) return false;
    if (resident && record.resident !== resident) return false;
    const search = query.trim().toLowerCase();
    return !search || Object.values(record).some((value) => typeof value === "string" && value.toLowerCase().includes(search));
  }), [query, records, resident, status]);

  const review = (nextStatus) => {
    setRecords((current) => current.map((record) => record.id === reviewing.id ? { ...record, status: nextStatus, reviewNotes } : record));
    setReviewing(null);
    setReviewNotes("");
  };

  return (
    <div className="cx-wide review-page">
      <style>{`
        .review-filters{display:grid;grid-template-columns:minmax(220px,1fr) 170px 210px auto;gap:10px;align-items:end;margin-bottom:16px;padding:14px;background:var(--cx-paper);border:1px solid var(--cx-border);border-radius:var(--cx-r)}
        .review-search{position:relative}.review-search svg{position:absolute;left:11px;bottom:11px;color:var(--cx-faint)}.review-search input{padding-left:34px}
        .review-label{display:block;margin-bottom:6px;font-size:11px;font-weight:650;color:var(--cx-muted);text-transform:uppercase;letter-spacing:.08em}
        .review-modal-bg{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px;background:rgba(20,35,30,.5)}
        .review-modal{width:min(700px,96vw);max-height:90vh;overflow:auto;background:var(--cx-paper);border-radius:14px;box-shadow:0 24px 70px rgba(20,35,30,.25)}
        .review-modal-head,.review-modal-actions{display:flex;align-items:center;gap:10px;padding:15px 18px;border-bottom:1px solid var(--cx-border)}.review-modal-head strong{flex:1}.review-modal-actions{justify-content:flex-end;border-top:1px solid var(--cx-border);border-bottom:0}
        .review-modal-body{display:grid;gap:16px;padding:18px}.review-details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.review-detail{padding:12px;background:var(--cx-paper-2);border:1px solid var(--cx-border-soft);border-radius:8px}.review-detail span{display:block;margin-bottom:5px;font-size:10px;font-weight:650;text-transform:uppercase;letter-spacing:.08em;color:var(--cx-faint)}.review-detail div{font-size:12.5px;line-height:1.55;color:var(--cx-ink)}
        @media(max-width:800px){.review-filters{grid-template-columns:1fr 1fr}.review-details{grid-template-columns:1fr}}@media(max-width:520px){.review-filters{grid-template-columns:1fr}}
      `}</style>
      <PageHeader eyebrow={config.eyebrow} title={config.title} lede={config.description} />
      <div className="cx-stats">
        <StatCard icon={ClipboardCheck} label="Total records" value={records.length} />
        <StatCard icon={Clock3} label="Pending review" value={records.filter((record) => record.status === "Pending").length} />
        <StatCard icon={CheckCircle2} label="Approved" value={records.filter((record) => record.status === "Approved").length} />
        <StatCard icon={XCircle} label="Rejected" value={records.filter((record) => record.status === "Rejected").length} />
      </div>
      <div className="review-filters">
        <label className="review-search"><span className="review-label">Search</span><Search size={15} /><input className="cx-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search records…" /></label>
        <label><span className="review-label">Status</span><select className="cx-select" value={status} onChange={(event) => setStatus(event.target.value)}><option>All</option><option>Pending</option><option>Approved</option><option>Rejected</option></select></label>
        {type !== "evacuation" && <label><span className="review-label">Resident</span><select className="cx-select" value={resident} onChange={(event) => setResident(event.target.value)}><option value="">All residents</option>{RESIDENTS.map((name) => <option key={name}>{name}</option>)}</select></label>}
        <button type="button" className="cx-btn cx-btn-ghost" onClick={() => { setQuery(""); setStatus("All"); setResident(""); }}>Reset</button>
      </div>
      <div className="cx-tablewrap"><div className="cx-tblscroll"><table className="cx-tbl"><thead><tr>{config.columns.map((column) => <th key={column}>{column}</th>)}<th>Status</th><th>Action</th></tr></thead><tbody>{filtered.map((record) => <tr key={record.id}>{config.columns.map((column) => { const key = column.toLowerCase(); return <td key={column}>{record[key] || "—"}</td>; })}<td><Badge tone={tone[record.status]} dot>{record.status}</Badge></td><td><button type="button" className="cx-btn cx-btn-ghost cx-btn-compact" onClick={() => setReviewing(record)}>{record.status === "Pending" ? "Review" : "View"}</button></td></tr>)}</tbody></table></div></div>
      {reviewing && <div className="review-modal-bg" onMouseDown={(event) => event.target === event.currentTarget && setReviewing(null)}><div className="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title"><div className="review-modal-head"><strong id="review-title">Review {reviewing.id}</strong><Badge tone={tone[reviewing.status]}>{reviewing.status}</Badge><button type="button" className="cx-btn cx-btn-quiet" aria-label="Close" onClick={() => setReviewing(null)}><X size={16} /></button></div><div className="review-modal-body"><div className="review-details">{Object.entries(reviewing.details).map(([label, value]) => <div className="review-detail" key={label}><span>{label}</span><div>{value}</div></div>)}</div><label className="cx-field"><span className="cx-label">Review notes</span><textarea className="cx-textarea" value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} placeholder="Add notes for this review decision…" /></label></div><div className="review-modal-actions"><button type="button" className="cx-btn cx-btn-ghost" onClick={() => setReviewing(null)}>Close</button>{reviewing.status === "Pending" && <><button type="button" className="cx-btn cx-btn-ghost" style={{ color: "var(--cx-danger)" }} onClick={() => review("Rejected")}>Reject</button><button type="button" className="cx-btn cx-btn-primary" onClick={() => review("Approved")}>Approve</button></>}</div></div></div>}
    </div>
  );
}
