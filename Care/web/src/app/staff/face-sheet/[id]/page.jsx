"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, FileCheck2, Printer } from "lucide-react";
import { Badge, EmptyState, PageHeader } from "@/components/ui/data";
import FaceSheetDocument from "@/components/face-sheets/FaceSheetDocument";
import { apiData } from "@/lib/client-api";
import { buildFaceSheetFromResident } from "@/lib/face-sheet-client";

async function loadStaffFaceSheet(id) {
  const [resident, documents, record] = await Promise.all([
    apiData(`/api/v1/residents/${id}`),
    apiData(`/api/v1/documents?residentId=${id}`),
    apiData(`/api/v1/face-sheets/${id}`),
  ]);
  const sheet = buildFaceSheetFromResident(resident, documents);
  return {
    ...sheet,
    photoUrl: record?.photoUrl || sheet.photoUrl || null,
    faceSheet: {
      ...sheet.faceSheet,
      ...(record?.data || {}),
    },
  };
}

export default function StaffFaceSheetDetailPage() {
  const { id } = useParams();
  const [sheet, setSheet] = useState(null);
  const [loadedId, setLoadedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    loadStaffFaceSheet(id)
      .then((nextSheet) => {
        if (!mounted) return;
        setSheet(nextSheet);
        setLoadedId(id);
        setError("");
      })
      .catch((err) => {
        if (!mounted) return;
        setSheet(null);
        setLoadedId(id);
        setError(err.message || "Unable to load face sheet.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [id]);

  if (loadedId !== id) return null;

  if (!sheet && !loading) {
    return (
      <div className="cx-wide">
        <EmptyState
          icon={FileCheck2}
          title="Face sheet not found"
          note={error || "The face sheet may have been removed or the link is incorrect."}
          action={<Link href="/staff/face-sheet" className="cx-btn cx-btn-primary" style={{ textDecoration: "none" }}>Back to face sheets</Link>}
        />
      </div>
    );
  }

  if (!sheet) return null;

  return (
    <div className="cx-wide fs-page">
      <div className="fs-no-print">
        <Link href="/staff/face-sheet" className="cx-link" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
          <ArrowLeft size={14} /> Face sheets
        </Link>
      </div>

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

      <FaceSheetDocument sheet={sheet} mode="staff" />
    </div>
  );
}
