"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar, Badge, EmptyState, PageHeader, Panel } from "@/components/ui/data";
import { apiData } from "@/lib/client-api";
import { buildFaceSheets } from "@/lib/face-sheet-client";
import { FACE_SHEETS } from "@/app/admin/face-sheets/data";

export default function StaffFaceSheetPage() {
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

  return (
    <div className="cx-wide">
      <PageHeader
        eyebrow="Resident face sheets"
        title="Face sheets"
        lede="Read-only resident summaries for quick staff reference."
      />

      {!sheets.length && !loading ? (
        <EmptyState title="No face sheets available" note="No assigned residents are available for this staff account." />
      ) : (
        <Panel title={loading ? "Loading residents" : "Residents"}>
          <div style={{ display: "grid", gap: 0 }}>
            {sheets.map((sheet) => (
              <Link
                key={sheet.id}
                href={`/staff/face-sheet/${sheet.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 18px",
                  borderTop: "1px solid var(--cx-border-soft)",
                  color: "inherit",
                  textDecoration: "none",
                }}
              >
                <Avatar name={sheet.name} round size="md" src={sheet.photoUrl} />
                <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: 13.5, color: "var(--cx-ink)" }}>{sheet.name}</strong>
                  <span style={{ display: "block", marginTop: 4, fontSize: 12.5, color: "var(--cx-muted)" }}>
                    Room {sheet.room} - {sheet.careLevel}
                  </span>
                </span>
                <Badge tone={sheet.tone} dot>{sheet.status}</Badge>
              </Link>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
