"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Search, UserPlus, Users } from "lucide-react";
import { PageHeader, Badge, Avatar, EmptyState } from "@/components/ui/data";
import { displayDate, statusTone } from "@/lib/client-api";
import { useApiQuery } from "@/lib/useApiQuery";
import { RESIDENTS } from "./data";

const FILTERS = ["All", "Active", "Pending", "Discharged"];

function normalizeResident(resident) {
  return {
    id: resident.id,
    name: resident.name || `${resident.firstName || ""} ${resident.lastName || ""}`.trim(),
    room: resident.room || "-",
    level: resident.level || resident.careLevel || "Care level not set",
    status: resident.status ? resident.status[0].toUpperCase() + resident.status.slice(1) : "Active",
    tone: resident.tone || statusTone(resident.status),
    admitted: resident.admitted || displayDate(resident.admittedAt),
  };
}

export default function ResidentsPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");
  const { data } = useApiQuery("residents", "/api/v1/residents", { fallback: RESIDENTS });
  const residents = useMemo(() => (Array.isArray(data) ? data : RESIDENTS).map(normalizeResident), [data]);

  const rows = useMemo(() => residents.filter((resident) => {
    const matchesFilter = filter === "All" || resident.status === filter;
    const search = q.trim().toLowerCase();
    const matchesSearch = !search || [resident.name, resident.room, resident.level]
      .some((value) => String(value).toLowerCase().includes(search));
    return matchesFilter && matchesSearch;
  }), [q, filter, residents]);

  const openResident = (id) => router.push(`/admin/residents/${id}`);

  return (
    <div className="cx-wide">
      <PageHeader
        eyebrow="Directory"
        title="Residents"
        lede="Everyone currently in your facility's care, plus pending admissions. Select a resident to view their care overview."
        action={(
          <Link href="/admin/admission" className="cx-btn cx-btn-primary" style={{ textDecoration: "none" }}>
            <UserPlus size={15} /> New admission
          </Link>
        )}
      />

      <div className="cx-toolbar">
        <div className="cx-search">
          <Search size={15} />
          <input aria-label="Search residents" placeholder="Search by name, room, or care level..." value={q} onChange={(event) => setQ(event.target.value)} />
        </div>
        <div className="cx-chips" aria-label="Filter residents by status">
          {FILTERS.map((item) => (
            <button type="button" key={item} className="cx-chip" data-on={filter === item ? "true" : "false"} aria-pressed={filter === item} onClick={() => setFilter(item)}>
              {item}
            </button>
          ))}
        </div>
        <span className="cx-tb-spacer" />
        <span style={{ fontSize: 12.5, color: "var(--cx-faint)" }}>{rows.length} resident{rows.length === 1 ? "" : "s"}</span>
      </div>

      <div className="cx-tablewrap">
        {rows.length ? (
          <div className="cx-tblscroll">
            <table className="cx-tbl">
              <thead><tr><th>Resident</th><th>Room</th><th>Care level</th><th>Status</th><th className="cx-hide-sm">Admitted</th><th aria-label="Open resident" /></tr></thead>
              <tbody>
                {rows.map((resident) => (
                  <tr key={resident.id} data-click="true" role="link" tabIndex={0} aria-label={`Open ${resident.name}'s profile`} onClick={() => openResident(resident.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openResident(resident.id); } }}>
                    <td><div className="cx-cellname"><Avatar name={resident.name} round /><b>{resident.name}</b></div></td>
                    <td className="cx-tnum">{resident.room}</td>
                    <td>{resident.level}</td>
                    <td><Badge tone={resident.tone} dot>{resident.status}</Badge></td>
                    <td className="cx-hide-sm cx-cellsub">{resident.admitted}</td>
                    <td><ArrowRight size={16} color="var(--cx-faint)" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Users} title="No residents match" note="Try a different search or status filter." />
        )}
      </div>
    </div>
  );
}
