"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, Bell, CheckCircle2, Mail, Search } from "lucide-react";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui/data";
import { apiData, displayDate, statusTone } from "@/lib/client-api";
import { notificationHref } from "@/lib/notification-link";

const FALLBACK = [
  { id: "NOT-1", title: "New resident assignment added", body: "You have been assigned to support West wing rounds.", status: "unread", createdAt: "2026-06-20T08:00:00.000Z" },
  { id: "NOT-2", title: "New facility announcement", body: "Summer heat safety plan starts today.", status: "read", createdAt: "2026-06-20T06:00:00.000Z" },
];

function normalize(item) {
  return {
    id: item.id,
    title: item.title,
    body: item.body,
    status: item.status || "unread",
    sourceType: item.sourceType || null,
    sourceId: item.sourceId || null,
    createdAt: displayDate(item.createdAt || item.created_at),
  };
}

export default function StaffNotificationsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const portal = pathname.startsWith("/admin") ? "admin" : "staff";
  const [rows, setRows] = useState(FALLBACK.map(normalize));
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const data = await apiData("/api/v1/notifications").catch(() => null);
    if (Array.isArray(data)) setRows(data.map(normalize));
  }, []);

  useEffect(() => { void load(); }, [load]);

  const unreadCount = rows.filter((item) => item.status === "unread").length;
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rows.filter((row) => !search || [row.title, row.body, row.status].some((value) => String(value).toLowerCase().includes(search)));
  }, [query, rows]);

  const markAllRead = async () => {
    const unread = rows.filter((row) => row.status === "unread");
    setRows((current) => current.map((row) => ({ ...row, status: "read" })));
    await Promise.all(unread.map((row) => apiData(`/api/v1/notifications/${row.id}/read`, { method: "POST" }).catch(() => null)));
  };

  // Clicking a notification marks it read and, if it points at a pending task,
  // takes the user straight to that page.
  const open = async (row) => {
    if (row.status === "unread") {
      setRows((current) => current.map((r) => (r.id === row.id ? { ...r, status: "read" } : r)));
      apiData(`/api/v1/notifications/${row.id}/read`, { method: "POST" }).catch(() => null);
    }
    const href = notificationHref(row, portal);
    if (href && !href.endsWith("/notifications")) router.push(href);
  };

  return (
    <div className="cx-wide">
      <PageHeader eyebrow="Your inbox" title="Notifications" lede="Assignments, incident alerts, announcements, and shift reminders directed to you." action={<button type="button" className="cx-btn cx-btn-primary" onClick={markAllRead} disabled={!unreadCount}><CheckCircle2 size={15} /> Mark all read</button>} />
      <div className="cx-stats"><StatCard icon={Bell} label="Total notifications" value={rows.length} /><StatCard icon={Mail} label="Unread" value={unreadCount} delta={unreadCount ? "needs attention" : "all caught up"} deltaDir={unreadCount ? "down" : "up"} /></div>
      <div className="cx-toolbar"><div className="cx-search"><Search size={15} /><input aria-label="Search notifications" placeholder="Search notifications..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><span className="cx-tb-spacer" /><span style={{ fontSize: 12.5, color: "var(--cx-faint)" }}>{filtered.length} shown</span></div>
      <div className="cx-tablewrap">{filtered.length ? <div className="cx-tblscroll"><table className="cx-tbl"><thead><tr><th>Notification</th><th>Status</th><th>Created</th><th aria-label="Open" /></tr></thead><tbody>{filtered.map((row) => {
        const actionable = Boolean(row.sourceType);
        return (
          <tr key={row.id} data-click="true" role={actionable ? "link" : undefined} tabIndex={actionable ? 0 : undefined}
            aria-label={actionable ? `Open: ${row.title}` : undefined}
            onClick={() => open(row)}
            onKeyDown={(event) => { if (actionable && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); open(row); } }}
            style={{ fontWeight: row.status === "unread" ? 600 : undefined }}>
            <td><strong>{row.title}</strong><div className="cx-cellsub" style={{ fontWeight: 400 }}>{row.body}</div></td>
            <td><Badge tone={statusTone(row.status)} dot>{row.status}</Badge></td>
            <td>{row.createdAt}</td>
            <td>{actionable && <ArrowRight size={16} color="var(--cx-faint)" />}</td>
          </tr>
        );
      })}</tbody></table></div> : <EmptyState icon={Bell} title="No notifications match" note="Try a different search." />}</div>
    </div>
  );
}
