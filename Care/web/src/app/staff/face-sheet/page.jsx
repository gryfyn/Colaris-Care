"use client";

import { useEffect, useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { Badge, EmptyState, PageHeader } from "@/components/ui/data";
import FaceSheetDocument from "@/components/face-sheets/FaceSheetDocument";
import { apiData } from "@/lib/client-api";
import { buildFaceSheets } from "@/lib/face-sheet-client";
import { FACE_SHEETS } from "@/app/admin/face-sheets/data";

export default function StaffFaceSheetPage() {
  const [sheets, setSheets] = useState(FACE_SHEETS);
  const [selected, setSelected] = useState(FACE_SHEETS[0]?.id);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([apiData("/api/v1/residents"), apiData("/api/v1/documents")])
      .then(([residents, documents]) => {
        const nextSheets = buildFaceSheets(residents, documents);
        if (mounted) {
          setSheets(nextSheets);
          setSelected((current) => nextSheets.some((item) => item.id === current) ? current : nextSheets[0]?.id);
        }
      })
      .catch(() => {
        if (mounted) setSheets(FACE_SHEETS);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const sheet = useMemo(
    () => sheets.find((item) => item.id === selected) || sheets[0],
    [selected, sheets]
  );

  if (!sheet) {
    return (
      <div className="cx-wide">
        <EmptyState title="No face sheets available" note="No assigned residents are available for this staff account." />
      </div>
    );
  }

  return (
    <div className="cx-wide fs-page">
      <PageHeader
        eyebrow="Resident face sheet"
        title={sheet.name}
        lede="Read-only resident face sheet for quick staff reference."
        action={(
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Badge tone={sheet.tone} dot>{loading ? "Loading" : sheet.status}</Badge>
            <button type="button" className="cx-btn cx-btn-primary fs-no-print" onClick={() => window.print()}>
              <Printer size={15} /> Print
            </button>
          </div>
        )}
      />

      <div className="cx-toolbar fs-no-print">
        <div className="cx-chips" aria-label="Select resident face sheet">
          {sheets.map((item) => (
            <button
              type="button"
              key={item.id}
              className="cx-chip"
              data-on={selected === item.id ? "true" : "false"}
              aria-pressed={selected === item.id}
              onClick={() => setSelected(item.id)}
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>

      <FaceSheetDocument sheet={sheet} mode="staff" />
    </div>
  );
}
