"use client";

import {
  AlertTriangle,
  CalendarDays,
  Contact,
  FileCheck2,
  HeartPulse,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Avatar, Panel } from "@/components/ui/data";
import { FACE_SHEET_SECTIONS, MASKED } from "@/app/admin/face-sheets/data";

function Detail({ label, value }) {
  return (
    <div className="cx-field">
      <div className="cx-eyebrow">{label}</div>
      <div className="fs-value">{value || "—"}</div>
    </div>
  );
}

function ContactCard({ title, contact, icon: Icon }) {
  return (
    <div className="fs-contact">
      <span className="fs-icon"><Icon size={17} /></span>
      <div>
        <div className="fs-contact-title">{title}</div>
        <strong>{contact?.name || "Information on file"}</strong>
        <div className="fs-muted">{contact?.relationship || "Information on file"} · {contact?.phone || MASKED}</div>
      </div>
    </div>
  );
}

function Fact({ icon: Icon, title, children }) {
  return (
    <div className="fs-fact">
      <Icon size={17} />
      <div>
        <strong>{title}</strong>
        <span>{children || "—"}</span>
      </div>
    </div>
  );
}

function valueFor(sheet, field) {
  if (field.sensitive) return MASKED;
  const value = sheet.faceSheet?.[field.key];
  return value || "—";
}

export default function FaceSheetDocument({ sheet, mode = "admin" }) {
  return (
    <div className="fs-sheet">
      <style>{`
        .fs-sheet { display: grid; gap: 16px; }
        .fs-identity { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
        .fs-identity-main { flex: 1 1 240px; }
        .fs-name { font-size: 20px; font-weight: 720; color: var(--cx-ink); }
        .fs-subtitle, .fs-muted { margin-top: 5px; font-size: 12.5px; color: var(--cx-muted); }
        .fs-value { font-size: 13.5px; font-weight: 600; color: var(--cx-ink); line-height: 1.45; }
        .fs-contact-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding: 18px; }
        .fs-contact { display: flex; gap: 12px; align-items: flex-start; padding: 14px; border: 1px solid var(--cx-border-soft); border-radius: 10px; background: var(--cx-paper-2); }
        .fs-icon { width: 34px; height: 34px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 9px; color: var(--cx-accent); background: var(--cx-accent-soft); }
        .fs-contact-title { margin-bottom: 5px; font-size: 10.5px; font-weight: 650; letter-spacing: .12em; text-transform: uppercase; color: var(--cx-muted); }
        .fs-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; padding: 18px; }
        .fs-fact { display: flex; gap: 11px; align-items: flex-start; }
        .fs-fact svg { flex: 0 0 auto; margin-top: 1px; color: var(--cx-accent); }
        .fs-fact strong { display: block; font-size: 12px; margin-bottom: 4px; }
        .fs-fact span { font-size: 12.5px; line-height: 1.45; color: var(--cx-muted); }
        .fs-section-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 15px 18px; padding: 18px; }
        .fs-section-field { min-width: 0; }
        .fs-section-field.is-wide { grid-column: 1 / -1; }
        .fs-label { display: block; margin-bottom: 5px; color: var(--cx-muted); font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
        .fs-field-value { color: var(--cx-ink); font-size: 13px; font-weight: 560; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
        .fs-mask { color: var(--cx-muted); font-style: italic; }
        .fs-confidential { display: flex; align-items: flex-start; gap: 9px; padding: 12px 14px; border: 1px solid var(--cx-border); border-radius: 10px; background: var(--cx-accent-soft); color: var(--cx-accent-strong); font-size: 12.5px; line-height: 1.45; }
        @media (max-width: 700px) {
          .fs-contact-grid, .fs-facts { grid-template-columns: 1fr; }
        }
        @media print {
          @page { size: letter; margin: 0.42in; }
          body * { visibility: hidden; }
          .fs-page, .fs-page * { visibility: visible; }
          .fs-page { position: absolute; inset: 0; max-width: none; color: #17211d; }
          .fs-no-print { display: none !important; }
          .fs-sheet { gap: 8px; }
          .fs-sheet .cx-panel { break-inside: avoid; box-shadow: none; }
          .fs-contact-grid, .fs-facts, .fs-section-grid { padding: 10px; gap: 8px; }
          .fs-contact { padding: 8px; }
          .cx-head { margin-bottom: 10px; }
        }
      `}</style>

      <Panel title="Resident overview" pad>
        <div className="fs-identity">
          <Avatar name={sheet.name} round />
          <div className="fs-identity-main">
            <div className="fs-name">{sheet.name}</div>
            <div className="fs-subtitle">
              <MapPin size={13} style={{ verticalAlign: "-2px" }} /> Room {sheet.room} · {sheet.wing || sheet.careLevel} · {sheet.careLevel}
            </div>
          </div>
          <div className="cx-grid" style={{ flex: "1 1 360px" }}>
            <Detail label="Date of birth" value={MASKED} />
            <Detail label="Sex / gender" value={sheet.sex} />
            <Detail label="Room" value={sheet.room} />
            <Detail label="Care level" value={sheet.careLevel} />
          </div>
        </div>
      </Panel>

      <Panel title="Primary & emergency contacts">
        <div className="fs-contact-grid">
          <ContactCard title="Primary contact" contact={sheet.primaryContact} icon={Contact} />
          <ContactCard title="Emergency contact" contact={sheet.emergencyContact} icon={UsersRound} />
        </div>
      </Panel>

      <Panel title="Care team">
        <div className="fs-contact-grid">
          <ContactCard title="Primary physician" contact={{ ...sheet.physician, relationship: "Primary care physician" }} icon={Stethoscope} />
          <ContactCard title="Care manager" contact={{ ...sheet.careManager, relationship: "Facility care manager" }} icon={HeartPulse} />
        </div>
      </Panel>

      <Panel title="At a glance">
        <div className="fs-facts">
          <Fact icon={AlertTriangle} title={`Allergies: ${sheet.allergies.present ? "Yes" : "No"}`}>{sheet.allergies.note}</Fact>
          <Fact icon={ShieldCheck} title="Code status">{sheet.codeStatus}</Fact>
          <Fact icon={FileCheck2} title="Diet">{sheet.diet}</Fact>
          <Fact icon={UserRound} title="Mobility">{sheet.mobility}</Fact>
          <Fact icon={Sparkles} title="Support level">{sheet.supportLevel}</Fact>
          <Fact icon={MessageCircle} title="Communication">{sheet.communication}</Fact>
        </div>
      </Panel>

      <div className="fs-confidential">
        <ShieldCheck size={16} />
        <span>
          Sensitive demographics, identifiers, addresses, phones, email addresses, insurance IDs, and signatures
          are intentionally shown as <strong>{MASKED}</strong> in this mock face sheet.
        </span>
      </div>

      {FACE_SHEET_SECTIONS.map((section) => (
        <Panel title={section.title} key={section.id}>
          <div className="fs-section-grid">
            {section.fields.map((field) => {
              const value = valueFor(sheet, field);
              const masked = value === MASKED;
              return (
                <div className={`fs-section-field${field.wide ? " is-wide" : ""}`} key={field.key}>
                  <span className="fs-label">{field.label}</span>
                  <div className={`fs-field-value${masked ? " fs-mask" : ""}`}>{value}</div>
                </div>
              );
            })}
          </div>
        </Panel>
      ))}

      <Panel title="Important dates" pad>
        <div className="cx-grid">
          <Detail label="Admitted" value={sheet.admitted} />
          <Detail label="Last reviewed" value={sheet.lastReviewed} />
          <Detail label="Last updated" value={sheet.lastUpdated} />
          <Detail label="View mode" value={mode === "staff" ? "Staff read-only" : "Admin review"} />
        </div>
      </Panel>

      <div className="fs-muted" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <CalendarDays size={13} /> Face sheet last updated {sheet.lastUpdated}. High-level sample data only.
      </div>
    </div>
  );
}
