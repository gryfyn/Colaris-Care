"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Clock, HeartPulse, Search, ShieldCheck, UserPlus, Users } from "lucide-react";
import { Avatar, Badge, EmptyState, PageHeader, StatCard } from "@/components/ui/data";
import { apiData, statusTone } from "@/lib/client-api";
import { STAFF } from "./data";

const FILTERS = ["All", "On shift", "Off shift", "On leave"];

function normalizeStaff(staff) {
  return {
    id: staff.id,
    name: staff.name || `${staff.firstName || ""} ${staff.lastName || ""}`.trim(),
    photoUrl: staff.photoUrl || null,
    role: staff.role || staff.roleTitle || "Team member",
    status: staff.status || "On shift",
    tone: staff.tone || statusTone(staff.status || "active"),
    shift: staff.shift || { label: "Facility schedule" },
    teams: staff.teams || ["Care team"],
    certifications: staff.certifications || [],
  };
}

export default function StaffPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [staffRows, setStaffRows] = useState(STAFF.map(normalizeStaff));

  useEffect(() => {
    let alive = true;
    apiData("/api/v1/staff")
      .then((rows) => alive && Array.isArray(rows) && setStaffRows(rows.map(normalizeStaff)))
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const rows = useMemo(() => staffRows.filter((staff) => {
    const matchesFilter = filter === "All" || staff.status === filter;
    const search = query.trim().toLowerCase();
    const matchesSearch = !search || [staff.name, staff.role, staff.shift.label, ...staff.teams]
      .some((value) => String(value).toLowerCase().includes(search));
    return matchesFilter && matchesSearch;
  }), [query, filter, staffRows]);

  const onShift = staffRows.filter((staff) => staff.status === "On shift").length;
  const rolesCovered = new Set(staffRows.map((staff) => staff.role)).size;
  const currentCertifications = staffRows.flatMap((staff) => staff.certifications).length;
  const openStaff = (id) => router.push(`/admin/staff/${id}`);

  return (
    <div className="cx-wide">
      <PageHeader eyebrow="Directory" title="Staff" lede="Your care team, their roles, and who is available now. Select a team member to view their work profile." action={<Link href="/admin/staff/new" className="cx-btn cx-btn-primary" style={{ textDecoration: "none" }}><UserPlus size={15} /> Add staff</Link>} />
      <div className="cx-stats">
        <StatCard icon={Users} label="Team members" value={staffRows.length} />
        <StatCard icon={HeartPulse} label="On shift now" value={onShift} delta="live" deltaDir="up" />
        <StatCard icon={Clock} label="Roles covered" value={rolesCovered} />
        <StatCard icon={CheckCircle2} label="Certification records" value={currentCertifications} delta="tracked" deltaDir="up" />
      </div>
      <div className="cx-toolbar">
        <div className="cx-search"><Search size={15} /><input aria-label="Search staff" placeholder="Search by name, role, shift, or team..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <div className="cx-chips" aria-label="Filter staff by status">{FILTERS.map((item) => <button type="button" key={item} className="cx-chip" data-on={filter === item ? "true" : "false"} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}</div>
        <span className="cx-tb-spacer" />
        <span style={{ fontSize: 12.5, color: "var(--cx-faint)" }}>{rows.length} team member{rows.length === 1 ? "" : "s"}</span>
      </div>
      <div className="cx-tablewrap">
        {rows.length ? <div className="cx-tblscroll"><table className="cx-tbl"><thead><tr><th>Team member</th><th>Role</th><th>Status</th><th className="cx-hide-sm">Shift</th><th className="cx-hide-sm">Team</th><th aria-label="Open staff profile" /></tr></thead><tbody>{rows.map((staff) => <tr key={staff.id} data-click="true" role="link" tabIndex={0} aria-label={`Open ${staff.name}'s profile`} onClick={() => openStaff(staff.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openStaff(staff.id); } }}><td><div className="cx-cellname"><Avatar name={staff.name} round src={staff.photoUrl} /><b>{staff.name}</b></div></td><td>{staff.role}</td><td><Badge tone={staff.tone} dot>{staff.status}</Badge></td><td className="cx-hide-sm cx-cellsub">{staff.shift.label}</td><td className="cx-hide-sm cx-cellsub">{staff.teams[0]}</td><td><ArrowRight size={16} color="var(--cx-faint)" /></td></tr>)}</tbody></table></div> : <EmptyState icon={ShieldCheck} title="No staff match" note="Try a different search or status filter." />}
      </div>
    </div>
  );
}
