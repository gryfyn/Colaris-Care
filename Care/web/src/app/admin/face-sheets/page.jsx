"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FileText, Search, Users } from "lucide-react";
import { Avatar, Badge, EmptyState, PageHeader, StatCard } from "@/components/ui/data";
import { apiData } from "@/lib/client-api";
import { buildFaceSheets } from "@/lib/face-sheet-client";
import { FACE_SHEETS } from "./data";

const FILTERS = ["All", "Current", "Review due", "Discharged"];

export default function FaceSheetsPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [sheets, setSheets] = useState(FACE_SHEETS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([apiData("/api/v1/residents"), apiData("/api/v1/documents")])
      .then(([residents, documents]) => {
        if (mounted) setSheets(buildFaceSheets(residents, documents));
      })
      .catch(() => {
        if (mounted) setSheets(FACE_SHEETS);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const rows = useMemo(() => sheets.filter((sheet) => {
    const search = query.trim().toLowerCase();
    const matchesFilter = filter === "All" || sheet.status === filter;
    const searchable = [
      sheet.name,
      sheet.room,
      sheet.careLevel,
      sheet.primaryContact?.name,
      sheet.primaryContact?.relationship,
    ].filter(Boolean);
    return matchesFilter && (!search || searchable.some((value) => value.toLowerCase().includes(search)));
  }), [filter, query, sheets]);

  const currentCount = sheets.filter((sheet) => sheet.status === "Current").length;
  const dueCount = sheets.filter((sheet) => sheet.status === "Review due").length;
  const careLevels = new Set(sheets.map((sheet) => sheet.careLevel).filter(Boolean)).size;
  const openSheet = (id) => router.push(`/admin/face-sheets/${id}`);

  return (
    <div className="cx-wide">
      <PageHeader
        eyebrow="Clinical summary"
        title="Face sheets"
        lede="Printable resident summaries sourced from live records with protected values masked."
      />

      <div className="cx-stats">
        <StatCard icon={FileText} label="Face sheets" value={sheets.length} />
        <StatCard icon={FileText} label="Current" value={currentCount} delta={loading ? "loading" : "ready"} deltaDir="up" />
        <StatCard icon={FileText} label="Review due" value={dueCount} />
        <StatCard icon={Users} label="Care levels" value={careLevels} />
      </div>

      <div className="cx-toolbar">
        <div className="cx-search">
          <Search size={15} />
          <input
            aria-label="Search face sheets"
            placeholder="Search by resident, room, care level, or contact..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="cx-chips" aria-label="Filter face sheets by status">
          {FILTERS.map((item) => (
            <button
              type="button"
              key={item}
              className="cx-chip"
              data-on={filter === item ? "true" : "false"}
              aria-pressed={filter === item}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <span className="cx-tb-spacer" />
        <span style={{ fontSize: 12.5, color: "var(--cx-faint)" }}>
          {rows.length} face sheet{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="cx-tablewrap">
        {rows.length ? (
          <div className="cx-tblscroll">
            <table className="cx-tbl">
              <thead>
                <tr>
                  <th>Resident</th><th>Room</th><th>Care level</th>
                  <th className="cx-hide-sm">Primary contact</th>
                  <th className="cx-hide-sm">Documents</th><th>Status</th>
                  <th aria-label="Open face sheet" />
                </tr>
              </thead>
              <tbody>
                {rows.map((sheet) => (
                  <tr
                    key={sheet.id}
                    data-click="true"
                    role="link"
                    tabIndex={0}
                    aria-label={`Open ${sheet.name}'s face sheet`}
                    onClick={() => openSheet(sheet.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openSheet(sheet.id);
                      }
                    }}
                  >
                    <td><div className="cx-cellname"><Avatar name={sheet.name} round /><b>{sheet.name}</b></div></td>
                    <td className="cx-tnum">{sheet.room}</td>
                    <td>{sheet.careLevel}</td>
                    <td className="cx-hide-sm">
                      <div>{sheet.primaryContact?.name || "On file"}</div>
                      <div className="cx-cellsub">{sheet.primaryContact?.relationship || "Responsible party"}</div>
                    </td>
                    <td className="cx-hide-sm cx-cellsub">{sheet.documentCount ?? 0} attached</td>
                    <td><Badge tone={sheet.tone} dot>{sheet.status}</Badge></td>
                    <td><ArrowRight size={16} color="var(--cx-faint)" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={FileText} title="No face sheets match" note="Try a different search or status filter." />
        )}
      </div>
    </div>
  );
}
