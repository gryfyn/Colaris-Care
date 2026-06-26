"use client";

import { useEffect, useState } from "react";
import { Award, Building2, CalendarCheck, ClipboardList, Contact, Mail, MapPin, Phone, Settings, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { Avatar, Badge, PageHeader, Panel } from "@/components/ui/data";
import { apiData } from "@/lib/client-api";

function Detail({ label, value }) {
  return <div className="cx-field"><div className="cx-eyebrow">{label}</div><div className="pf-value">{value || "On file"}</div></div>;
}

function ContactRow({ icon: Icon, label, value }) {
  return <div className="pf-row"><span className="pf-icon"><Icon size={16} /></span><div><div className="pf-row-label">{label}</div><strong>{value || "On file"}</strong></div></div>;
}

export default function StaffProfilePage() {
  const [data, setData] = useState({ user: null, profile: null });

  useEffect(() => {
    let alive = true;
    apiData("/api/v1/me/profile").then((payload) => {
      if (alive) setData(payload);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const profile = data.profile;
  const user = data.user;
  const name = profile?.name || user?.name || user?.email || "Staff profile";
  const role = profile?.roleTitle || user?.role || "Staff";

  return (
    <div className="cx-wide">
      <style>{`
        .pf-stack { display: grid; gap: 16px; }
        .pf-value { font-size: 13.5px; font-weight: 600; color: var(--cx-ink); line-height: 1.45; }
        .pf-identity { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
        .pf-identity-main { flex: 1 1 240px; }
        .pf-name { font-size: 20px; font-weight: 720; color: var(--cx-ink); }
        .pf-subtitle { margin-top: 5px; font-size: 12.5px; color: var(--cx-muted); display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .pf-rows { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding: 18px; }
        .pf-row { display: flex; gap: 12px; align-items: flex-start; padding: 14px; border: 1px solid var(--cx-border-soft); border-radius: 10px; background: var(--cx-paper-2); }
        .pf-icon { width: 32px; height: 32px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 9px; color: var(--cx-accent); background: var(--cx-accent-soft); }
        .pf-row-label { margin-bottom: 5px; font-size: 10.5px; font-weight: 650; letter-spacing: .1em; text-transform: uppercase; color: var(--cx-muted); }
        @media (max-width: 700px) { .pf-rows { grid-template-columns: 1fr; } }
      `}</style>

      <PageHeader eyebrow="Your profile" title="Profile" lede="Your role, facility context, and credentials on file." action={<Link href="/staff/settings" className="cx-btn cx-btn-ghost" style={{ textDecoration: "none" }}><Settings size={15} /> Settings</Link>} />

      <div className="pf-stack">
        <Panel title="Identity" pad>
          <div className="pf-identity">
            <Avatar name={name} round />
            <div className="pf-identity-main"><div className="pf-name">{name}</div><div className="pf-subtitle"><UserRound size={13} /> {role}<span aria-hidden="true">.</span><Building2 size={13} /> {profile?.facilityName || user?.facilityId || "Facility"}</div></div>
            <div className="cx-grid" style={{ flex: "1 1 360px" }}>
              <Detail label="Employee ID" value={profile?.employeeNumber} />
              <Detail label="Status" value={<Badge tone={profile?.status === "inactive" ? "gray" : "green"} dot>{profile?.status || "Active"}</Badge>} />
              <Detail label="Facility" value={profile?.facilityName || user?.facilityId} />
              <Detail label="Organization" value={profile?.organizationName || user?.organizationId} />
            </div>
          </div>
        </Panel>

        <Panel title="Contact">
          <div className="pf-rows">
            <ContactRow icon={Mail} label="Work email" value={profile?.email || user?.email} />
            <ContactRow icon={Phone} label="Work phone" value={profile?.phone} />
            <ContactRow icon={MapPin} label="Primary area" value={profile?.facilityName || "Facility"} />
            <ContactRow icon={Contact} label="Role" value={role} />
          </div>
        </Panel>

        <Panel title="Credentials & training" action={<Award size={15} color="var(--cx-faint)" />}>
          <div className="cx-feed">
            {(Array.isArray(profile?.certifications) && profile.certifications.length ? profile.certifications : ["Credentials on file"]).map((credential) => (
              <div className="cx-feed-item" key={String(credential)} style={{ alignItems: "center" }}>
                <span className="cx-feed-ico" style={{ background: "var(--cx-accent-soft)", color: "var(--cx-accent-strong)" }}><Award size={15} /></span>
                <div className="cx-feed-main" style={{ flex: 1 }}><div className="cx-feed-t" style={{ fontWeight: 650 }}>{String(credential)}</div><div className="cx-feed-s">Managed by facility administration</div></div>
                <Badge tone="green" dot>Current</Badge>
              </div>
            ))}
          </div>
        </Panel>

        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--cx-faint)", fontSize: 12 }}>
          <ShieldCheck size={14} color="var(--cx-accent)" /> Profile data comes from the authenticated staff record.
        </div>
      </div>
    </div>
  );
}
