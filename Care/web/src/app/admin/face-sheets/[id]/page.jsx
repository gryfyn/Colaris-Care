"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, FileCheck2, Printer } from "lucide-react";
import { Badge, EmptyState, PageHeader } from "@/components/ui/data";
import FaceSheetDocument from "@/components/face-sheets/FaceSheetDocument";
import { apiData } from "@/lib/client-api";
import { buildFaceSheetFromResident } from "@/lib/face-sheet-client";
import { getFaceSheet } from "../data";

export default function FaceSheetDetailPage() {
  const { id } = useParams();
  const [sheet, setSheet] = useState(() => getFaceSheet(id));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([apiData(`/api/v1/residents/${id}`), apiData(`/api/v1/documents?residentId=${id}`)])
      .then(([resident, documents]) => {
        if (mounted) setSheet(buildFaceSheetFromResident(resident, documents));
      })
      .catch(() => {
        if (mounted) setSheet(getFaceSheet(id));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [id]);

  if (!sheet && !loading) {
    return (
      <div className="cx-wide">
        <EmptyState
          icon={FileCheck2}
          title="Face sheet not found"
          note="The face sheet may have been removed or the link is incorrect."
          action={<Link href="/admin/face-sheets" className="cx-btn cx-btn-primary" style={{ textDecoration: "none" }}>Back to face sheets</Link>}
        />
      </div>
    );
  }

  if (!sheet) return null;

  return (
    <div className="cx-wide fs-page">
      <div className="fs-no-print">
        <Link href="/admin/face-sheets" className="cx-link" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
          <ArrowLeft size={14} /> Face sheets
        </Link>
      </div>

      <PageHeader
        eyebrow="Resident face sheet"
        title={sheet.name}
        lede="Live resident summary with sensitive demographics, identifiers, contacts, and signatures masked."
        action={(
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Badge tone={sheet.tone} dot>{loading ? "Loading" : sheet.status}</Badge>
            <button type="button" className="cx-btn cx-btn-primary fs-no-print" onClick={() => window.print()}>
              <Printer size={15} /> Print
            </button>
          </div>
        )}
      />

      <FaceSheetDocument sheet={sheet} mode="admin" />
    </div>
  );
}
