"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Badge, EmptyState, PortraitButton } from "@/components/ui/data";
import { apiData, displayDate } from "@/lib/client-api";

function chip(list) {
  return (Array.isArray(list) ? list : []).filter(Boolean);
}

function recorded(value) {
  if (value === 0) return "0";
  if (value === false) return "No";
  if (value === true) return "Yes";
  return value ? value : "Not recorded";
}

function Fact({ label, value, tnum }) {
  const display = recorded(value);
  return (
    <div className="cx-fact">
      <dt className="cx-fact-label">{label}</dt>
      <dd className={`cx-fact-value${tnum ? " cx-tnum" : ""}${display === "Not recorded" ? " cx-empty-value" : ""}`}>{display}</dd>
    </div>
  );
}

function FactList({ rows, columns = false }) {
  return (
    <dl className={columns ? "cx-factgrid" : "cx-factlist"}>
      {rows.map(([label, value, options]) => <Fact key={label} label={label} value={value} tnum={options?.tnum} />)}
    </dl>
  );
}

function DetailSection({ eyebrow, title, children }) {
  return (
    <section className="cx-detail-section">
      <div className="cx-section-head">
        <div>
          {eyebrow && <div className="cx-section-eyebrow">{eyebrow}</div>}
          <h2 className="cx-section-title">{title}</h2>
        </div>
      </div>
      <div className="cx-section-body">{children}</div>
    </section>
  );
}

function ChipList({ items, active = false }) {
  return items.length ? (
    <div className="cx-chips">
      {items.map((item) => <span className="cx-chip" data-on={active ? "true" : undefined} key={item}>{item}</span>)}
    </div>
  ) : <div className="cx-empty-value">Not recorded</div>;
}

export default function StaffResidentDetailPage() {
  const { id } = useParams();
  const [resident, setResident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(() => {
      void (async () => {
      try {
        setLoading(true);
        setError("");
        const data = await apiData(`/api/v1/residents/${id}`);
        if (alive) setResident(data);
      } catch (err) {
        if (alive) setError(err.message || "Resident not found");
      } finally {
        if (alive) setLoading(false);
      }
      })();
    }, 0);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [id]);

  const answers = useMemo(() => resident?.admissions?.[0]?.answers || {}, [resident]);

  if (loading) {
    return (
      <div className="cx-wide">
        <EmptyState icon={UserRound} title="Loading resident" note="Fetching the caregiver overview..." />
      </div>
    );
  }

  if (error || !resident) {
    return (
      <div className="cx-wide">
        <EmptyState
          icon={UserRound}
          title="Resident not found"
          note={error || "The resident may have been reassigned or the link is incorrect."}
          action={<Link href="/staff/residents" className="cx-btn cx-btn-primary" style={{ textDecoration: "none" }}>Back to residents</Link>}
        />
      </div>
    );
  }

  const concerns = chip(answers.behavioralConcerns);
  const restrictions = chip(answers.restrictions).map((r) => (typeof r === "string" ? r : r?.text)).filter(Boolean);
  const hasPrecautions = concerns.length || restrictions.length;
  const hasContact = answers.emergencyName || answers.emergencyPhone || answers.emergencyEmail;

  return (
    <div className="cx-wide">
      <Link href="/staff/residents" className="cx-link cx-page-back">
        <ArrowLeft size={14} /> Residents directory
      </Link>

      <header className="cx-page-band">
        <div className="cx-page-band-main">
          <div className="cx-detail-portrait">
            <PortraitButton name={resident.name} src={resident.photoUrl} size="xl" />
          </div>
          <div className="cx-page-band-copy">
            <div className="cx-section-eyebrow">Caregiver overview</div>
            <h1 className="cx-page-title">{resident.name}</h1>
            <FactList columns rows={[
              ["Status", resident.status],
              ["Room", resident.room || "Pending", { tnum: true }],
              ["Care level", resident.careLevel],
            ]} />
          </div>
        </div>
        <div className="cx-page-actions">
          <Badge tone={resident.status ? (resident.status === "active" ? "green" : "gray") : "blue"} dot>{resident.status}</Badge>
        </div>
      </header>

      <div className="cx-detail-grid">
        <main className="cx-detail-main">
          <div className="cx-section-stack">
            <DetailSection eyebrow="Shift" title="On-shift basics">
              <FactList columns rows={[
                ["Mobility", answers.mobility || "On file"],
                ["Communication", answers.communication || "On file"],
                ["Observation level", answers.observationLevel || "Routine"],
                ["Admitted", displayDate(resident.admittedAt), { tnum: true }],
              ]} />
            </DetailSection>

            <DetailSection eyebrow="Care" title="Care precautions">
              {hasPrecautions ? (
                <>
                  <div className="cx-subsection">
                    <div className="cx-section-eyebrow">Behavioral concerns</div>
                    <ChipList items={concerns} active />
                  </div>
                  <div className="cx-subsection">
                    <div className="cx-section-eyebrow">Restrictions</div>
                    <ChipList items={restrictions} />
                  </div>
                </>
              ) : (
                <EmptyState icon={Sparkles} title="No special precautions" note="No behavioral concerns or restrictions were captured on admission." />
              )}
            </DetailSection>
          </div>
        </main>

        <aside className="cx-detail-rail" aria-label="Resident at-a-glance facts">
          <DetailSection eyebrow="At a glance" title="Current facts">
            <FactList rows={[
              ["Status", resident.status],
              ["Room", resident.room || "Pending", { tnum: true }],
              ["Care level", resident.careLevel],
              ["Mobility", answers.mobility || "On file"],
              ["Communication", answers.communication || "On file"],
            ]} />
          </DetailSection>

          <DetailSection eyebrow="Contacts" title="Key contacts">
            {hasContact ? (
              <div className="cx-icon-line">
                <span className="cx-feed-ico"><Phone size={16} /></span>
                <FactList rows={[
                  ["Name", answers.emergencyName],
                  ["Relationship", answers.emergencyRelationship],
                  ["Phone", answers.emergencyPhone],
                  ["Email", answers.emergencyEmail],
                ]} />
              </div>
            ) : (
              <EmptyState icon={Phone} title="No contact on file" note="No emergency contact was captured on the admission packet." />
            )}
          </DetailSection>
        </aside>
      </div>

      <div className="cx-mt cx-rail-note">
        <ShieldCheck size={14} />
        Caregiver overview; sensitive identifiers and detailed clinical records are restricted for this role.
      </div>
    </div>
  );
}
