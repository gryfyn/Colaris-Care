"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search, ShieldCheck, Users } from "lucide-react";
import { Avatar, Badge, EmptyState, PageHeader } from "@/components/ui/data";
import { useApiQuery } from "@/lib/useApiQuery";
import { STAFF_RESIDENTS } from "./data";

const FILTERS = ["All", "My residents", "West wing", "North wing", "Memory care"];

function normalizeResident(resident) {
  return {
    id: resident.id,
    name: resident.name || `${resident.firstName || ""} ${resident.lastName || ""}`.trim(),
    room: resident.room || "-",
    level: resident.level || resident.careLevel || "Assisted living",
    wing: resident.wing || "Facility",
    assigned: resident.assigned ?? true,
  };
}

export default function StaffResidentsPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");
  const { data } = useApiQuery("staff-residents", "/api/v1/residents", { fallback: STAFF_RESIDENTS });
  const residents = useMemo(() => (Array.isArray(data) ? data : STAFF_RESIDENTS).map(normalizeResident), [data]);

  const rows = useMemo(() => residents.filter((resident) => {
    const matchesFilter = filter === "All" || (filter === "My residents" && resident.assigned) || resident.wing === filter || resident.level === filter;
    const search = q.trim().toLowerCase();
    const matchesSearch = !search || [resident.name, resident.room, resident.level, resident.wing].some((value) => String(value).toLowerCase().includes(search));
    return matchesFilter && matchesSearch;
  }), [q, filter, residents]);

  const openResident = (id) => router.push(`/staff/residents/${id}`);

  return (
    <div className="cx-wide">
      <PageHeader eyebrow="Facility directory" title="Residents" lede="Residents at Maple Grove Care. Select a resident for the caregiver overview - rooms, routines, and key contacts only." />
      <div className="cx-toolbar">
        <div className="cx-search"><Search size={15} /><input aria-label="Search residents" placeholder="Search by name, room, or wing..." value={q} onChange={(event) => setQ(event.target.value)} /></div>
        <div className="cx-chips" aria-label="Filter residents">{FILTERS.map((item) => <button type="button" key={item} className="cx-chip" data-on={filter === item ? "true" : "false"} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}</div>
        <span className="cx-tb-spacer" />
        <span style={{ fontSize: 12.5, color: "var(--cx-faint)" }}>{rows.length} resident{rows.length === 1 ? "" : "s"}</span>
      </div>
      <div className="cx-tablewrap">
        {rows.length ? <div className="cx-tblscroll"><table className="cx-tbl"><thead><tr><th>Resident</th><th>Room</th><th>Care level</th><th className="cx-hide-sm">Wing</th><th>Assignment</th><th aria-label="Open resident" /></tr></thead><tbody>{rows.map((resident) => <tr key={resident.id} data-click="true" role="link" tabIndex={0} aria-label={`Open ${resident.name}'s overview`} onClick={() => openResident(resident.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openResident(resident.id); } }}><td><div className="cx-cellname"><Avatar name={resident.name} round /><b>{resident.name}</b></div></td><td className="cx-tnum">{resident.room}</td><td>{resident.level}</td><td className="cx-hide-sm cx-cellsub">{resident.wing}</td><td>{resident.assigned ? <Badge tone="green" dot>Assigned to me</Badge> : <Badge tone="gray">Facility</Badge>}</td><td><ArrowRight size={16} color="var(--cx-faint)" /></td></tr>)}</tbody></table></div> : <EmptyState icon={Users} title="No residents match" note="Try a different search or filter." />}
      </div>
      <div className="cx-mt" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--cx-faint)", fontSize: 12 }}><ShieldCheck size={14} color="var(--cx-accent)" />Caregiver overview only - no detailed clinical records or sensitive identifiers are shown here.</div>
    </div>
  );
}
