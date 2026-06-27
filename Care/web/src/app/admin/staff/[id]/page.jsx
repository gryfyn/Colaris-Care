"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, Award, BadgeCheck, CalendarDays, ClipboardList, Mail,
  Phone, Plus, ShieldCheck, UserRound, Users,
} from "lucide-react";
import { Avatar, Badge, EmptyState, PageHeader, Panel, StatCard } from "@/components/ui/data";
import { apiData, displayDate, statusTone } from "@/lib/client-api";
import ResidentPickerModal from "@/components/residents/ResidentPickerModal";
import { uploadPortrait } from "@/lib/cloudinary-upload";
import DocumentsPanel from "@/components/records/DocumentsPanel";

const STAFF_DOC_TYPES = ["License", "Certification", "Background Check", "CPR / First Aid", "TB Test", "Other"];

const TABS = [
  { id: "overview", label: "Overview", icon: UserRound },
  { id: "assignments", label: "Assignments", icon: ClipboardList },
  { id: "certifications", label: "Certifications", icon: Award },
];

function certText(cert) {
  if (!cert) return { title: "Credential", detail: "" };
  if (typeof cert === "string") return { title: cert, detail: "" };
  return {
    title: cert.title || cert.name || cert.credential || "Credential",
    detail: [cert.detail, cert.status, cert.expiresAt && `Expires ${displayDate(cert.expiresAt)}`].filter(Boolean).join(" · "),
  };
}

export default function StaffDetailPage() {
  const { id } = useParams();
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");
  const [picking, setPicking] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [actionError, setActionError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError("");
      const data = await apiData(`/api/v1/staff/${id}`);
      setStaff(data);
    } catch (err) {
      setError(err.message || "Staff member not found");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // Assign the picked resident to this staff member via the existing endpoint.
  async function assignResident(resident) {
    if (assigning) return;
    setAssigning(true);
    setActionError("");
    try {
      await apiData("/api/v1/staff/assignments", {
        method: "POST",
        body: JSON.stringify({ staffProfileId: id, residentId: resident.id }),
      });
      await load();
      setPicking(false);
      setTab("assignments");
    } catch (err) {
      setActionError(err.message || "Unable to assign resident.");
    } finally {
      setAssigning(false);
    }
  }

  async function uploadStaffPhoto(file) {
    if (!file || photoBusy) return;
    setPhotoBusy(true);
    setActionError("");
    try {
      const photoUrl = await uploadPortrait(file, "staff");
      await apiData(`/api/v1/staff/${id}`, { method: "PATCH", body: JSON.stringify({ photoUrl }) });
      await load();
    } catch (err) {
      setActionError(err.message || "Photo upload failed.");
    } finally {
      setPhotoBusy(false);
    }
  }

  const assignments = staff?.assignments || [];
  const certifications = staff?.certifications || [];
  const currentTab = useMemo(() => TABS.find((item) => item.id === tab) || TABS[0], [tab]);

  if (loading) {
    return (
      <div className="cx-wide">
        <EmptyState icon={UserRound} title="Loading staff profile" note="Fetching the team member's work profile..." />
      </div>
    );
  }

  if (error || !staff) {
    return (
      <div className="cx-wide">
        <EmptyState
          icon={UserRound}
          title="Staff member not found"
          note={error || "The profile may have been removed or the link is incorrect."}
          action={<Link href="/admin/staff" className="cx-btn cx-btn-primary" style={{ textDecoration: "none" }}>Back to staff</Link>}
        />
      </div>
    );
  }

  return (
    <div className="cx-wide">
      <Link href="/admin/staff" className="cx-link" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
        <ArrowLeft size={14} /> Staff directory
      </Link>

      <PageHeader
        eyebrow="Staff profile"
        title={staff.name}
        lede="A high-level work profile with role, contact details, assignments, and credentials pulled from the facility database."
        action={<Badge tone={staff.status ? statusTone(staff.status) : "blue"} dot>{staff.status}</Badge>}
      />

      <div className="cx-panel" style={{ padding: 20, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <Avatar name={staff.name} round src={staff.photoUrl} />
            <label className="cx-link" style={{ fontSize: 11, cursor: photoBusy ? "wait" : "pointer" }}>
              {photoBusy ? "Uploading..." : staff.photoUrl ? "Change photo" : "Add photo"}
              <input type="file" accept="image/*" style={{ display: "none" }} disabled={photoBusy}
                onChange={(e) => uploadStaffPhoto(e.target.files?.[0])} />
            </label>
          </div>
          <div style={{ minWidth: 180, flex: "1 1 220px" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--cx-ink)" }}>{staff.name}</div>
            <div style={{ marginTop: 5, fontSize: 12.5, color: "var(--cx-muted)" }}>
              {staff.roleTitle || "Team member"}{staff.employeeNumber ? ` · #${staff.employeeNumber}` : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div>
              <div className="cx-eyebrow">Email</div>
              <div style={{ marginTop: 7, fontSize: 13, fontWeight: 600 }}><Mail size={12} style={{ verticalAlign: "-2px", marginRight: 5 }} />{staff.email || "Not recorded"}</div>
            </div>
            <div>
              <div className="cx-eyebrow">Work phone</div>
              <div style={{ marginTop: 7, fontSize: 13, fontWeight: 600 }}><Phone size={12} style={{ verticalAlign: "-2px", marginRight: 5 }} />{staff.phone || "Not recorded"}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="cx-stats">
        <StatCard icon={ClipboardList} label="Role" value={staff.roleTitle || "Team member"} />
        <StatCard icon={UserRound} label="Assigned residents" value={assignments.length} />
        <StatCard icon={Award} label="Credentials tracked" value={certifications.length} />
        <StatCard icon={CalendarDays} label="Member since" value={displayDate(staff.createdAt, "On file")} />
      </div>

      <div className="cx-toolbar" role="tablist" aria-label="Staff profile sections">
        <div className="cx-chips">
          {TABS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                role="tab"
                key={item.id}
                className="cx-chip"
                data-on={tab === item.id ? "true" : "false"}
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
              >
                <Icon size={13} /> {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" aria-label={currentTab.label}>
        {tab === "overview" && (
          <div className="cx-cols">
            <Panel title="Work overview" pad>
              <div style={{ display: "grid", gap: 18 }}>
                <div><div className="cx-eyebrow">Role</div><div style={{ marginTop: 7, fontSize: 14, fontWeight: 600 }}>{staff.roleTitle || "Team member"}</div></div>
                <div><div className="cx-eyebrow">Status</div><div style={{ marginTop: 7 }}><Badge tone={statusTone(staff.status)} dot>{staff.status}</Badge></div></div>
                <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
                  <div><div className="cx-eyebrow">Employee number</div><div style={{ marginTop: 7, fontSize: 13 }}>{staff.employeeNumber || "Not assigned"}</div></div>
                  <div><div className="cx-eyebrow">Member since</div><div style={{ marginTop: 7, fontSize: 13 }}>{displayDate(staff.createdAt, "On file")}</div></div>
                </div>
                <div><div className="cx-eyebrow">Portal account</div><div style={{ marginTop: 7, fontSize: 13 }}>{staff.userId ? "Linked to a login account" : "No portal login linked"}</div></div>
              </div>
            </Panel>
            <Panel title="At a glance">
              <div className="cx-feed">
                <div className="cx-feed-item"><span className="cx-feed-ico" style={{ background: "var(--cx-accent-soft)", color: "var(--cx-accent)" }}><UserRound size={15} /></span><div className="cx-feed-main"><div className="cx-feed-t">Resident assignments</div><div className="cx-feed-s">{assignments.length} active assignment{assignments.length === 1 ? "" : "s"}</div></div></div>
                <div className="cx-feed-item"><span className="cx-feed-ico" style={{ background: "var(--cx-paper-2)", color: "var(--cx-muted)" }}><Award size={15} /></span><div className="cx-feed-main"><div className="cx-feed-t">Certifications</div><div className="cx-feed-s">{certifications.length} credential{certifications.length === 1 ? "" : "s"} tracked</div></div></div>
                <div className="cx-feed-item"><span className="cx-feed-ico" style={{ background: "var(--cx-paper-2)", color: "var(--cx-muted)" }}><BadgeCheck size={15} /></span><div className="cx-feed-main"><div className="cx-feed-t">Account</div><div className="cx-feed-s">{staff.email || "No email on file"}</div></div></div>
              </div>
            </Panel>
          </div>
        )}

        {tab === "assignments" && (
          <Panel
            title="Assigned residents"
            pad
            action={<button type="button" className="cx-btn cx-btn-primary cx-btn-compact" onClick={() => setPicking(true)}><Plus size={14} /> Assign resident</button>}
          >
            {actionError && <div style={{ marginBottom: 10, fontSize: 12, color: "var(--cx-danger, #b42318)" }}>{actionError}</div>}
            {assignments.length ? (
              <div className="cx-feed">
                {assignments.map((assignment) => (
                  <Link key={assignment.id} href={`/admin/residents/${assignment.residentId}`} className="cx-feed-item" style={{ textDecoration: "none", color: "inherit" }}>
                    <span className="cx-feed-ico" style={{ background: "var(--cx-accent-soft)", color: "var(--cx-accent)" }}><UserRound size={15} /></span>
                    <div className="cx-feed-main">
                      <div className="cx-feed-t">{assignment.residentName}</div>
                      <div className="cx-feed-s">Room {assignment.room || "pending"} · since {displayDate(assignment.startsAt, "recently")}</div>
                    </div>
                    <Badge tone={statusTone(assignment.status)} dot>{assignment.status}</Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState icon={Users} title="No resident assignments" note="Use Assign resident to add this team member's first assignment." action={<button type="button" className="cx-btn cx-btn-primary" onClick={() => setPicking(true)}><Plus size={14} /> Assign resident</button>} />
            )}
          </Panel>
        )}

        {tab === "certifications" && (
          <Panel title="Credentials and training" pad>
            {certifications.length ? (
              <div className="cx-feed">
                {certifications.map((cert, index) => {
                  const { title, detail } = certText(cert);
                  return (
                    <div className="cx-feed-item" key={`${title}-${index}`}>
                      <span className="cx-feed-ico" style={{ background: "var(--cx-accent-soft)", color: "var(--cx-accent)" }}><Award size={15} /></span>
                      <div className="cx-feed-main">
                        <div className="cx-feed-t">{title}</div>
                        {detail && <div className="cx-feed-s">{detail}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon={Award} title="No certifications recorded" note="No credentials have been added for this team member yet." />
            )}
          </Panel>
        )}

        {tab === "certifications" && (
          <div style={{ marginTop: 18 }}>
            <DocumentsPanel
              scope="staff"
              staffProfileId={id}
              title="Credential & certification files"
              docTypes={STAFF_DOC_TYPES}
              emptyNote="Optional — upload licenses, certifications, background checks, CPR/First Aid, or TB tests. Can be added anytime."
            />
          </div>
        )}
      </div>

      <div className="cx-mt" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--cx-faint)", fontSize: 12 }}>
        <ShieldCheck size={14} color="var(--cx-accent)" />
        Work profile only — sensitive personal information is not shown here.
      </div>

      {picking && (
        <ResidentPickerModal
          eyebrow={`Assign to ${staff.name}`}
          title="Select a resident"
          busy={assigning}
          onClose={() => setPicking(false)}
          onSelect={assignResident}
        />
      )}
    </div>
  );
}
