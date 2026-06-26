"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Inbox, Search, Sparkles } from "lucide-react";
import { Avatar, Badge, EmptyState, PageHeader, StatCard } from "@/components/ui/data";
import { apiData, displayDate, statusTone } from "@/lib/client-api";

const STATUSES = ["All", "New", "In progress", "Completed"];
const STATUS_VALUES = { New: "new", "In progress": "in_progress", Completed: "completed" };
const STATUS_LABELS = { new: "New", in_progress: "In progress", completed: "Completed", cancelled: "Cancelled" };
const PRIORITY_LABELS = { routine: "Routine", soon: "Soon", priority: "Priority" };
const PRIORITY_TONE = { routine: "gray", soon: "amber", priority: "red" };

function nextStatus(value) {
  if (value === "new") return "in_progress";
  if (value === "in_progress") return "completed";
  return value;
}

export default function StaffResidentRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");

  useEffect(() => {
    let alive = true;
    apiData("/api/v1/resident-requests").then((rows) => {
      if (alive) setRequests(rows);
    }).catch(() => {
      if (alive) setRequests([]);
    });
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    const wanted = STATUS_VALUES[status];
    return requests.filter((request) => {
      const matchesStatus = status === "All" || request.status === wanted;
      const matchesSearch = !search || [request.ref, request.residentName, request.room, request.requestType, request.detail]
        .some((value) => String(value || "").toLowerCase().includes(search));
      return matchesStatus && matchesSearch;
    });
  }, [requests, status, query]);

  const advance = async (request) => {
    const updated = await apiData(`/api/v1/resident-requests/${request.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus(request.status) }),
    });
    setRequests((current) => current.map((item) => item.id === request.id ? updated : item));
  };

  const openCount = requests.filter((item) => item.status !== "completed").length;
  const newCount = requests.filter((item) => item.status === "new").length;
  const doneCount = requests.filter((item) => item.status === "completed").length;

  return (
    <div className="cx-wide">
      <PageHeader eyebrow="Your inbox" title="Resident requests" lede="High-level service requests assigned within your facility scope." />

      <div className="cx-stats">
        <StatCard icon={Inbox} label="Open requests" value={openCount} delta={openCount ? "needs action" : "clear"} deltaDir={openCount ? "down" : "up"} />
        <StatCard icon={Sparkles} label="New" value={newCount} />
        <StatCard icon={Clock3} label="In progress" value={requests.filter((item) => item.status === "in_progress").length} />
        <StatCard icon={CheckCircle2} label="Completed" value={doneCount} delta="this week" deltaDir="up" />
      </div>

      <div className="cx-toolbar">
        <div className="cx-search"><Search size={15} /><input aria-label="Search resident requests" placeholder="Search reference, resident, or request type..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <div className="cx-chips" aria-label="Filter requests by status">{STATUSES.map((item) => <button type="button" key={item} className="cx-chip" data-on={status === item ? "true" : "false"} aria-pressed={status === item} onClick={() => setStatus(item)}>{item}</button>)}</div>
        <span className="cx-tb-spacer" />
        <span style={{ fontSize: 12.5, color: "var(--cx-faint)" }}>{filtered.length} request{filtered.length === 1 ? "" : "s"}</span>
      </div>

      <div className="cx-tablewrap">
        {filtered.length ? (
          <div className="cx-tblscroll"><table className="cx-tbl"><thead><tr><th>Reference</th><th>Resident</th><th className="cx-hide-sm">Request type</th><th>Priority</th><th>Status</th><th className="cx-hide-sm">Received</th><th aria-label="Actions" /></tr></thead><tbody>
            {filtered.map((request) => (
              <tr key={request.id}>
                <td className="cx-tnum"><b>{request.ref || request.id.slice(0, 8)}</b></td>
                <td><div style={{ display: "flex", alignItems: "center", gap: 9 }}><Avatar name={request.residentName || "Resident"} sm /><div><div style={{ fontWeight: 600 }}>{request.residentName || "Resident"}</div><div className="cx-cellsub">Room {request.room || "Unassigned"}</div></div></div></td>
                <td className="cx-hide-sm"><div style={{ fontWeight: 600 }}>{request.requestType}</div><div className="cx-cellsub">{request.detail}</div></td>
                <td><Badge tone={PRIORITY_TONE[request.priority]}>{PRIORITY_LABELS[request.priority] || request.priority}</Badge></td>
                <td><Badge tone={statusTone(request.status)} dot>{STATUS_LABELS[request.status] || request.status}</Badge></td>
                <td className="cx-hide-sm cx-cellsub">{displayDate(request.createdAt, "Recent")}</td>
                <td style={{ textAlign: "right" }}>{request.status !== "completed" ? <button type="button" className="cx-btn cx-btn-quiet" style={{ fontSize: 11.5, padding: "5px 9px" }} onClick={() => advance(request)}>{request.status === "new" ? "Start" : "Complete"}</button> : <span className="cx-cellsub" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><CheckCircle2 size={13} color="var(--cx-accent)" /> Done</span>}</td>
              </tr>
            ))}
          </tbody></table></div>
        ) : <EmptyState icon={Inbox} title="No requests match" note="Try a different status filter or search term." action={<button type="button" className="cx-btn cx-btn-ghost" onClick={() => { setQuery(""); setStatus("All"); }}>Clear filters</button>} />}
      </div>
    </div>
  );
}
