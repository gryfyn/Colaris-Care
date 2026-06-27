"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { CalendarDays, Megaphone, Pin, Plus, Search, Users } from "lucide-react";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui/data";
import { apiData, displayDate, statusTone } from "@/lib/client-api";
import RecordFormModal from "@/components/records/RecordFormModal";

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
  const pathname = usePathname();
  // Creating announcements is admin-only (RBAC). Staff view this same page at
  // /staff/announcements, so only show the compose action on the admin route.
  const canCreate = (pathname || "").startsWith("/admin");
  const [rows, setRows] = useState(FALLBACK.map(normalize));
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const data = await apiData("/api/v1/announcements").catch(() => null);
    if (Array.isArray(data)) setRows(data.map(normalize));
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rows.filter((row) => !search || [row.title, row.body, row.audience, row.status].some((value) => String(value).toLowerCase().includes(search)));
  }, [query, rows]);

  async function createAnnouncement(v) {
    await apiData("/api/v1/announcements", {
      method: "POST",
      body: JSON.stringify({
        title: v.title.trim(),
        body: v.body.trim(),
        audience: v.audience || "all",
        status: v.status || "published",
      }),
    });
    await load();
    setAdding(false);
  }

  return (
    <div className="cx-wide">
      <PageHeader
        eyebrow="Facility communication"
        title="Announcements"
        lede="Post and review facility announcements for staff and families."
        action={canCreate ? <button type="button" className="cx-btn cx-btn-primary" onClick={() => setAdding(true)}><Plus size={15} /> Post announcement</button> : null}
      />
      <div className="cx-stats"><StatCard icon={Megaphone} label="Active" value={rows.length} /><StatCard icon={Pin} label="Published" value={rows.filter((row) => row.status === "published").length} /><StatCard icon={Users} label="Audiences" value={new Set(rows.map((row) => row.audience)).size} /></div>
      <div className="cx-toolbar"><div className="cx-search"><Search size={15} /><input aria-label="Search announcements" placeholder="Search announcements..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><span className="cx-tb-spacer" /><span style={{ fontSize: 12.5, color: "var(--cx-faint)" }}>{filtered.length} announcement{filtered.length === 1 ? "" : "s"}</span></div>
      <div className="cx-tablewrap">{filtered.length ? <div className="cx-tblscroll"><table className="cx-tbl"><thead><tr><th>Announcement</th><th>Audience</th><th>Status</th><th>Starts</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}><td><strong>{row.title}</strong><div className="cx-cellsub">{row.body}</div></td><td>{row.audience}</td><td><Badge tone={statusTone(row.status)} dot>{row.status}</Badge></td><td><CalendarDays size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />{row.startsAt}</td></tr>)}</tbody></table></div> : <EmptyState icon={Megaphone} title="No announcements match" note="Try a different search." />}</div>

      {adding && (
        <RecordFormModal
          eyebrow="Facility communication"
          title="Post announcement"
          submitLabel="Post"
          onClose={() => setAdding(false)}
          onSubmit={createAnnouncement}
          fields={[
            { name: "title", label: "Title", required: true, span2: true, placeholder: "Announcement title" },
            { name: "body", label: "Body", type: "textarea", required: true, span2: true, placeholder: "Announcement details" },
            { name: "audience", label: "Audience", type: "select", default: "all", options: [{ value: "all", label: "Everyone" }, { value: "staff", label: "Staff" }, { value: "families", label: "Families" }] },
            { name: "status", label: "Status", type: "select", default: "published", options: ["published", "draft", "archived"] },
          ]}
        />
      )}
    </div>
  );
}
