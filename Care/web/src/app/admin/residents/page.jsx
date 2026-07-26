"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, RefreshCcw, Search, UserPlus, Users } from "lucide-react";
import { PageBand, Badge, Avatar, EmptyState, TableSkeleton } from "@/components/ui/data";
import { displayDate, statusTone } from "@/lib/client-api";
import { useApiQuery } from "@/lib/useApiQuery";
import { RESIDENTS } from "./data";

const FILTERS = ["All", "Active", "Pending", "Discharged"];

function normalizeResident(resident) {
  return {
    id: resident.id,
    name: resident.name || `${resident.firstName || ""} ${resident.lastName || ""}`.trim(),
    photoUrl: resident.photoUrl || null,
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
  const { data, error, isError, isPending, refetch } = useApiQuery("residents", "/api/v1/residents", { fallback: RESIDENTS });
  const residents = useMemo(() => (Array.isArray(data) ? data : []).map(normalizeResident), [data]);

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
      <PageBand
        eyebrow="Directory"
        title="Residents"
        lede="Everyone currently in your facility's care, plus pending admissions. Select a resident to view their care overview."
        action={(
          <Link href="/admin/admission" className="cx-btn cx-btn-primary" style={{ textDecoration: "none" }}>
            <UserPlus size={15} /> New admission
          </Link>
        )}
      />

      <div className="cx-page-rhythm">
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
          <span className="cx-results-count cx-tnum">{rows.length} resident{rows.length === 1 ? "" : "s"}</span>
        </div>

        <div className="cx-tablewrap">
          {isPending ? (
            <TableSkeleton rows={6} cols={6} />
          ) : isError ? (
            <EmptyState
              icon={AlertTriangle}
              title="Could not load residents"
              note={error?.message || "Try again to refresh the resident directory."}
              action={<button type="button" className="cx-btn cx-btn-primary" onClick={() => refetch()}><RefreshCcw size={15} /> Retry</button>}
            />
          ) : rows.length ? (
            <div className="cx-tblscroll">
              <table className="cx-tbl">
                <thead><tr><th>Resident</th><th>Room</th><th>Care level</th><th>Status</th><th className="cx-hide-sm">Admitted</th><th aria-label="Open resident" /></tr></thead>
                <tbody>
                  {rows.map((resident) => (
                    <tr key={resident.id} data-click="true" role="link" tabIndex={0} aria-label={`Open ${resident.name}'s profile`} onClick={() => openResident(resident.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openResident(resident.id); } }}>
                      <td><div className="cx-cellname"><Avatar name={resident.name} round size="lg" src={resident.photoUrl} /><b>{resident.name}</b></div></td>
                      <td className="cx-tnum">{resident.room}</td>
                      <td>{resident.level}</td>
                      <td><Badge tone={resident.tone} dot>{resident.status}</Badge></td>
                      <td className="cx-hide-sm cx-cellsub cx-tnum">{resident.admitted}</td>
                      <td><ArrowRight size={16} color="var(--cx-faint)" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title={residents.length ? "No residents match" : "No residents yet"}
              note={residents.length ? "Try a different search or status filter." : "Start with New admission to add the first resident."}
              action={!residents.length && <Link href="/admin/admission" className="cx-btn cx-btn-primary" style={{ textDecoration: "none" }}><UserPlus size={15} /> New admission</Link>}
            />
          )}
        </div>
      </div>
    </div>
  );
}
