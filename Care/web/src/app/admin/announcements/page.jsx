"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Megaphone, Pin, Plus, Search, Users } from "lucide-react";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui/data";
import { apiData, displayDate, statusTone } from "@/lib/client-api";

const FALLBACK = [
  { id: "ANN-1", title: "Summer heat safety plan starts today", body: "Offer water at every resident interaction.", audience: "all", status: "published", startsAt: "2026-06-20T09:00:00.000Z" },
  { id: "ANN-2", title: "Updated day-shift handoff checklist", body: "Use the revised checklist for morning handoffs.", audience: "staff", status: "published", startsAt: "2026-06-19T09:00:00.000Z" },
];

function normalize(item) {
  return {
    id: item.id,
    title: item.title,
    body: item.body,
    audience: item.audience || "all",
    status: item.status || "published",
    startsAt: displayDate(item.startsAt || item.starts_at),
  };
}

export default function AdminAnnouncementsPage() {
  const [rows, setRows] = useState(FALLBACK.map(normalize));
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    apiData("/api/v1/announcements").then((data) => alive && Array.isArray(data) && setRows(data.map(normalize))).catch(() => {});
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rows.filter((row) => !search || [row.title, row.body, row.audience, row.status].some((value) => String(value).toLowerCase().includes(search)));
  }, [query, rows]);

  return (
    <div className="cx-wide">
      <PageHeader eyebrow="Facility communication" title="Announcements" lede="Post and review facility announcements for staff and families." action={<button type="button" className="cx-btn cx-btn-primary"><Plus size={15} /> Post announcement</button>} />
      <div className="cx-stats"><StatCard icon={Megaphone} label="Active" value={rows.length} /><StatCard icon={Pin} label="Published" value={rows.filter((row) => row.status === "published").length} /><StatCard icon={Users} label="Audiences" value={new Set(rows.map((row) => row.audience)).size} /></div>
      <div className="cx-toolbar"><div className="cx-search"><Search size={15} /><input aria-label="Search announcements" placeholder="Search announcements..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><span className="cx-tb-spacer" /><span style={{ fontSize: 12.5, color: "var(--cx-faint)" }}>{filtered.length} announcement{filtered.length === 1 ? "" : "s"}</span></div>
      <div className="cx-tablewrap">{filtered.length ? <div className="cx-tblscroll"><table className="cx-tbl"><thead><tr><th>Announcement</th><th>Audience</th><th>Status</th><th>Starts</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}><td><strong>{row.title}</strong><div className="cx-cellsub">{row.body}</div></td><td>{row.audience}</td><td><Badge tone={statusTone(row.status)} dot>{row.status}</Badge></td><td><CalendarDays size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />{row.startsAt}</td></tr>)}</tbody></table></div> : <EmptyState icon={Megaphone} title="No announcements match" note="Try a different search." />}</div>
    </div>
  );
}
