"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, ClipboardList, MapPin, MessageCircle, Phone, ShieldCheck, Sparkles, UserRound,
} from "lucide-react";
import { Avatar, Badge, EmptyState, PageHeader, Panel, StatCard } from "@/components/ui/data";
import { apiData, displayDate } from "@/lib/client-api";

function chip(list) {
  return (Array.isArray(list) ? list : []).filter(Boolean);
}

export default function StaffResidentDetailPage() {
  const { id } = useParams();
  const [resident, setResident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
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
    return () => { alive = false; };
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
  const hasContact = answers.emergencyName || answers.emergencyPhone;

  return (
    <div className="cx-wide">
      <Link href="/staff/residents" className="cx-link" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
        <ArrowLeft size={14} /> Residents directory
      </Link>

      <PageHeader
        eyebrow="Caregiver overview"
        title={resident.name}
        lede="The basics you need on shift — room, routines, and key contacts. Sensitive clinical detail and identifiers are not shown here."
        action={<Badge tone={resident.status ? (resident.status === "active" ? "green" : "gray") : "blue"} dot>{resident.status}</Badge>}
      />

      <div className="cx-panel" style={{ padding: 20, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <Avatar name={resident.name} round />
          <div style={{ minWidth: 180, flex: "1 1 220px" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--cx-ink)" }}>{resident.name}</div>
            <div style={{ marginTop: 5, fontSize: 12.5, color: "var(--cx-muted)" }}>
              <MapPin size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
              Room {resident.room || "pending"} · {resident.careLevel || "Care level not set"}
            </div>
          </div>
        </div>
      </div>

      <div className="cx-stats">
        <StatCard icon={MapPin} label="Room" value={resident.room || "Pending"} />
        <StatCard icon={ClipboardList} label="Care level" value={resident.careLevel || "Not set"} />
        <StatCard icon={UserRound} label="Mobility" value={answers.mobility || "On file"} />
        <StatCard icon={MessageCircle} label="Communication" value={answers.communication || "On file"} />
      </div>

      <div className="cx-cols">
        <div style={{ display: "grid", gap: 18 }}>
          <Panel title="On-shift basics" pad>
            <div className="cx-grid">
              <div><div className="cx-eyebrow">Mobility</div><div style={{ marginTop: 7, fontSize: 13.5, fontWeight: 600 }}>{answers.mobility || "On file"}</div></div>
              <div><div className="cx-eyebrow">Communication</div><div style={{ marginTop: 7, fontSize: 13.5, fontWeight: 600 }}>{answers.communication || "On file"}</div></div>
              <div><div className="cx-eyebrow">Observation level</div><div style={{ marginTop: 7, fontSize: 13.5, fontWeight: 600 }}>{answers.observationLevel || "Routine"}</div></div>
              <div><div className="cx-eyebrow">Admitted</div><div style={{ marginTop: 7, fontSize: 13.5, fontWeight: 600 }}>{displayDate(resident.admittedAt, "Not recorded")}</div></div>
            </div>
          </Panel>

          <Panel title="Care precautions">
            {concerns.length || restrictions.length ? (
              <div style={{ padding: "4px 2px" }}>
                {concerns.length > 0 && (
                  <>
                    <div className="cx-eyebrow" style={{ marginBottom: 6 }}>Behavioral concerns</div>
                    <div className="cx-chips" style={{ marginBottom: 12 }}>
                      {concerns.map((c) => <span className="cx-chip" data-on="true" key={c}>{c}</span>)}
                    </div>
                  </>
                )}
                {restrictions.length > 0 && (
                  <>
                    <div className="cx-eyebrow" style={{ marginBottom: 6 }}>Restrictions</div>
                    <div className="cx-chips">
                      {restrictions.map((r) => <span className="cx-chip" key={r}>{r}</span>)}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <EmptyState icon={Sparkles} title="No special precautions" note="No behavioral concerns or restrictions were captured on admission." />
            )}
          </Panel>
        </div>

        <Panel title="Key contacts">
          {hasContact ? (
            <div className="cx-feed">
              <div className="cx-feed-item">
                <span className="cx-feed-ico" style={{ background: "var(--cx-paper-2)", color: "var(--cx-muted)" }}><Phone size={15} /></span>
                <div className="cx-feed-main">
                  <div className="cx-feed-t">{answers.emergencyName || "Emergency contact on file"}</div>
                  <div className="cx-feed-s">{answers.emergencyRelationship || "Emergency contact"}{answers.emergencyPhone ? ` · ${answers.emergencyPhone}` : ""}</div>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState icon={Phone} title="No contact on file" note="No emergency contact was captured on the admission packet." />
          )}
        </Panel>
      </div>

      <div className="cx-mt" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--cx-faint)", fontSize: 12 }}>
        <ShieldCheck size={14} color="var(--cx-accent)" />
        Caregiver overview — sensitive identifiers and detailed clinical records are restricted for this role.
      </div>
    </div>
  );
}
