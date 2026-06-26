"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Award,
  Building2,
  Check,
  ClipboardList,
  Contact,
  IdCard,
  Phone,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { Avatar, Badge, PageHeader, Panel } from "@/components/ui/data";
import {
  SegmentedField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/ui/fields";

const ROLES = [
  "Registered nurse",
  "Licensed practical nurse",
  "Caregiver",
  "Medication aide",
  "Care manager",
  "Administrator",
  "Director",
  "Other",
];

const CREDENTIAL_OPTIONS = [
  "Certified Nursing Assistant (CNA)",
  "CPR / First Aid",
  "Registered Nurse license",
  "Medication aide credential",
  "Dementia care training",
  "Fire & evacuation safety",
  "Mandatory reporter training",
  "Mental health first aid",
];

const INITIAL_FORM = {
  firstName: "",
  lastName: "",
  preferredName: "",
  pronouns: "",
  role: "",
  employeeId: "",
  status: "Active",
  email: "",
  phone: "",
  organizationId: "",
  organizationName: "",
  facilityId: "",
  facilityName: "",
  primaryArea: "",
  reportsTo: "",
  employmentType: "",
  shift: "",
  startDate: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactRelation: "",
  notes: "",
};

const PERMISSIONS = {
  "Registered nurse": ["Resident records", "Medications", "Care plans", "Incident reports", "Sign off notes"],
  "Licensed practical nurse": ["Resident records", "Medications", "Daily notes", "Incident reports"],
  Caregiver: ["Resident records", "Daily notes", "Incident reports"],
  "Medication aide": ["Resident records", "Medications", "Daily notes"],
  "Care manager": ["Resident records", "Care plans", "Staff assignments", "Reports"],
  Administrator: ["Resident records", "Staff management", "Compliance", "Reports", "Settings"],
  Director: ["Resident records", "Staff management", "Compliance", "Reports", "Settings"],
  Other: ["Resident records"],
};

function SectionIntro({ icon: Icon, title, note }) {
  return (
    <div className="as-section-intro">
      <span className="as-section-icon"><Icon size={16} /></span>
      <div>
        <strong>{title}</strong>
        <span>{note}</span>
      </div>
    </div>
  );
}

export default function AddStaffPage() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [credentials, setCredentials] = useState([]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const displayName = [form.preferredName || form.firstName, form.lastName].filter(Boolean).join(" ") || "New staff member";
  const permissions = useMemo(() => PERMISSIONS[form.role] || [], [form.role]);

  const toggleCredential = (label) => {
    setCredentials((current) => current.some((item) => item.label === label)
      ? current.filter((item) => item.label !== label)
      : [...current, { label, detail: "", expiresOn: "", status: "Current" }]);
  };

  const updateCredential = (label, key, value) => {
    setCredentials((current) => current.map((item) => (
      item.label === label ? { ...item, [key]: value } : item
    )));
  };

  const addCustomCredential = () => {
    const number = credentials.filter((item) => item.label.startsWith("Custom credential")).length + 1;
    setCredentials((current) => [...current, {
      label: `Custom credential ${number}`,
      detail: "",
      expiresOn: "",
      status: "Current",
      custom: true,
    }]);
  };

  const removeCredential = (label) => {
    setCredentials((current) => current.filter((item) => item.label !== label));
  };

  return (
    <div className="cx-wide as-page">
      <style>{`
        .as-page { padding-bottom: 32px; }
        .as-back { display:inline-flex; align-items:center; gap:6px; margin-bottom:16px; }
        .as-stack { display:grid; gap:16px; max-width:920px; }
        .as-preview { display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
        .as-preview-copy { flex:1 1 220px; min-width:0; }
        .as-preview-name { color:var(--cx-ink); font-size:18px; font-weight:700; }
        .as-preview-role { color:var(--cx-muted); font-size:12.5px; margin-top:5px; }
        .as-section-intro { display:flex; align-items:flex-start; gap:10px; padding:16px 18px 0; }
        .as-section-icon { width:32px; height:32px; display:grid; place-items:center; flex:0 0 auto; border-radius:9px; color:var(--cx-accent); background:var(--cx-accent-soft); }
        .as-section-intro strong { display:block; color:var(--cx-ink); font-size:13.5px; }
        .as-section-intro span { display:block; color:var(--cx-muted); font-size:11.5px; line-height:1.45; margin-top:3px; }
        .as-form-grid { padding:16px 18px 18px; }
        .as-credential-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; padding:16px 18px 18px; }
        .as-credential-toggle { display:flex; align-items:center; gap:9px; min-height:44px; text-align:left; font:inherit; font-size:12.5px; color:var(--cx-muted); background:var(--cx-paper-2); border:1px solid var(--cx-border); border-radius:9px; padding:9px 11px; cursor:pointer; }
        .as-credential-toggle[data-on="true"] { color:var(--cx-accent-strong); border-color:var(--cx-accent); background:var(--cx-accent-soft); font-weight:650; }
        .as-check { width:17px; height:17px; display:grid; place-items:center; flex:0 0 auto; border:1px solid var(--cx-border); border-radius:5px; background:var(--cx-paper); }
        .as-credential-toggle[data-on="true"] .as-check { color:#fff; border-color:var(--cx-accent); background:var(--cx-accent); }
        .as-credential-list { display:grid; gap:10px; padding:0 18px 18px; }
        .as-credential-card { border:1px solid var(--cx-border-soft); border-radius:10px; padding:14px; background:var(--cx-paper-2); }
        .as-credential-head { display:flex; align-items:center; gap:10px; margin-bottom:12px; }
        .as-credential-head strong { flex:1; font-size:12.5px; color:var(--cx-ink); }
        .as-icon-btn { width:30px; height:30px; display:grid; place-items:center; color:var(--cx-faint); background:transparent; border:0; border-radius:7px; cursor:pointer; }
        .as-icon-btn:hover { color:var(--cx-danger); background:var(--cx-danger-soft); }
        .as-permissions { display:flex; flex-wrap:wrap; gap:8px; padding:16px 18px 18px; }
        .as-empty-note { color:var(--cx-faint); font-size:12.5px; font-style:italic; }
        .as-actions { display:flex; align-items:center; justify-content:flex-end; gap:10px; flex-wrap:wrap; }
        .as-actions .cx-btn[disabled] { opacity:.55; cursor:not-allowed; box-shadow:none; }
        @media (max-width:700px) { .as-credential-grid { grid-template-columns:1fr; } }
      `}</style>

      <Link href="/admin/staff" className="cx-link as-back">
        <ArrowLeft size={14} /> Staff directory
      </Link>

      <PageHeader
        eyebrow="Staff directory"
        title="Add staff member"
        lede="Create the complete work profile used across the staff portal. Required fields and submission will be connected when the staff API is ready."
      />

      <form className="as-stack" onSubmit={(event) => event.preventDefault()}>
        <Panel pad>
          <div className="as-preview">
            <Avatar name={displayName} round />
            <div className="as-preview-copy">
              <div className="as-preview-name">{displayName}</div>
              <div className="as-preview-role">{form.role || "Role not selected"}{form.facilityName ? ` · ${form.facilityName}` : ""}</div>
            </div>
            <Badge tone={form.status === "Active" ? "green" : form.status === "On leave" ? "amber" : "gray"} dot>
              {form.status}
            </Badge>
          </div>
        </Panel>

        <Panel>
          <SectionIntro icon={UserRound} title="Core identity" note="Legal identity, display preferences, role, and staff status." />
          <div className="cx-grid as-form-grid">
            <TextField label="First name" required value={form.firstName} onChange={(value) => set("firstName", value)} placeholder="First name" />
            <TextField label="Last name" required value={form.lastName} onChange={(value) => set("lastName", value)} placeholder="Last name" />
            <TextField label="Preferred / display name" optional value={form.preferredName} onChange={(value) => set("preferredName", value)} placeholder="If different from legal name" />
            <SelectField label="Pronouns" optional value={form.pronouns} onChange={(value) => set("pronouns", value)} options={["She / her", "He / him", "They / them", "Other / not specified"]} />
            <SelectField label="Role" required value={form.role} onChange={(value) => set("role", value)} options={ROLES} />
            <TextField label="Employee ID" value={form.employeeId} onChange={(value) => set("employeeId", value)} placeholder="EMP-10482" />
            <SegmentedField label="Status" span2 value={form.status} onChange={(value) => value && set("status", value)} options={["Active", "Inactive", { value: "On leave", label: "On leave", tone: "amber" }]} />
          </div>
        </Panel>

        <Panel>
          <SectionIntro icon={Building2} title="Organization & placement" note="Tenant and facility context shown on the staff profile." />
          <div className="cx-grid as-form-grid">
            <TextField label="Organization name" value={form.organizationName} onChange={(value) => set("organizationName", value)} placeholder="Maple Health Partners" />
            <TextField label="Organization ID" value={form.organizationId} onChange={(value) => set("organizationId", value)} placeholder="org-maple-health-partners" />
            <TextField label="Facility name" value={form.facilityName} onChange={(value) => set("facilityName", value)} placeholder="Maple Grove Care" />
            <TextField label="Facility ID" value={form.facilityId} onChange={(value) => set("facilityId", value)} placeholder="facility-maple-grove-care" />
            <TextField label="Primary area" value={form.primaryArea} onChange={(value) => set("primaryArea", value)} placeholder="West wing · Maple Grove Care" />
            <TextField label="Reports to" value={form.reportsTo} onChange={(value) => set("reportsTo", value)} placeholder="Priya Nair, Charge Nurse" />
          </div>
        </Panel>

        <Panel>
          <SectionIntro icon={Contact} title="Contact & employment" note="Work contact information and current employment arrangement." />
          <div className="cx-grid as-form-grid">
            <TextField label="Work email" type="email" value={form.email} onChange={(value) => set("email", value)} placeholder="name@facility.example" />
            <TextField label="Work phone" type="tel" value={form.phone} onChange={(value) => set("phone", value)} placeholder="(555) 200-0140" />
            <SelectField label="Employment type" value={form.employmentType} onChange={(value) => set("employmentType", value)} options={["Full-time", "Part-time", "Per diem", "Contract", "Temporary"]} />
            <SelectField label="Assigned shift" value={form.shift} onChange={(value) => set("shift", value)} options={["Day shift", "Evening shift", "Night shift", "Swing shift", "Variable"]} />
            <TextField label="Start date" type="date" value={form.startDate} onChange={(value) => set("startDate", value)} />
          </div>
        </Panel>

        <Panel>
          <SectionIntro icon={Phone} title="Emergency contact" note="Administrative contact details from the reference add-staff flow." />
          <div className="cx-grid as-form-grid">
            <TextField label="Contact name" value={form.emergencyContactName} onChange={(value) => set("emergencyContactName", value)} placeholder="Full name" />
            <TextField label="Contact phone" type="tel" value={form.emergencyContactPhone} onChange={(value) => set("emergencyContactPhone", value)} placeholder="(555) 200-0141" />
            <SelectField label="Relationship" value={form.emergencyContactRelation} onChange={(value) => set("emergencyContactRelation", value)} options={["Spouse / partner", "Parent", "Sibling", "Child", "Friend", "Other"]} />
          </div>
        </Panel>

        <Panel>
          <SectionIntro icon={Award} title="Credentials & training" note="Select tracked credentials, then capture the detail, status, and expiry shown in the staff profile." />
          <div className="as-credential-grid">
            {CREDENTIAL_OPTIONS.map((label) => {
              const selected = credentials.some((item) => item.label === label);
              return (
                <button key={label} type="button" className="as-credential-toggle" data-on={selected ? "true" : "false"} aria-pressed={selected} onClick={() => toggleCredential(label)}>
                  <span className="as-check">{selected && <Check size={11} />}</span>
                  {label}
                </button>
              );
            })}
          </div>
          <div className="as-credential-list">
            {credentials.map((credential) => (
              <div className="as-credential-card" key={credential.label}>
                <div className="as-credential-head">
                  <Award size={15} color="var(--cx-accent)" />
                  <strong>{credential.label}</strong>
                  <button type="button" className="as-icon-btn" aria-label={`Remove ${credential.label}`} onClick={() => removeCredential(credential.label)}><Trash2 size={14} /></button>
                </div>
                <div className="cx-grid">
                  {credential.custom && (
                    <TextField label="Credential name" span2 value={credential.label} onChange={(value) => updateCredential(credential.label, "label", value)} placeholder="Credential or training name" />
                  )}
                  <TextField label="Profile detail" value={credential.detail} onChange={(value) => updateCredential(credential.label, "detail", value)} placeholder="State registry · current" />
                  <TextField label="Expiry / renewal date" type="date" value={credential.expiresOn} onChange={(value) => updateCredential(credential.label, "expiresOn", value)} />
                  <SelectField label="Credential status" span2 value={credential.status} onChange={(value) => updateCredential(credential.label, "status", value)} options={["Current", "Renewal due", "Expired", "Pending"]} />
                </div>
              </div>
            ))}
            <button type="button" className="cx-btn cx-btn-ghost" style={{ justifySelf: "start" }} onClick={addCustomCredential}><Plus size={14} /> Add custom credential</button>
          </div>
        </Panel>

        <Panel>
          <SectionIntro icon={ShieldCheck} title="System access preview" note="Permissions are derived from role and are informational until submission is implemented." />
          <div className="as-permissions">
            {permissions.length ? permissions.map((permission) => <Badge key={permission} tone="blue">{permission}</Badge>) : <span className="as-empty-note">Select a role to preview access.</span>}
          </div>
        </Panel>

        <Panel>
          <SectionIntro icon={ClipboardList} title="Additional notes" note="Internal onboarding, scheduling, or administrative context." />
          <div className="cx-grid as-form-grid">
            <TextAreaField label="Internal notes" optional value={form.notes} onChange={(value) => set("notes", value)} placeholder="Onboarding notes, scheduling constraints, or special considerations…" rows={4} />
          </div>
        </Panel>

        <Panel pad>
          <div className="as-preview">
            <span className="as-section-icon"><IdCard size={16} /></span>
            <div className="as-preview-copy">
              <div className="as-preview-name" style={{ fontSize: 14 }}>Profile coverage</div>
              <div className="as-preview-role">Identity, contact, placement, employment, emergency contact, credentials, access, and notes are captured.</div>
            </div>
            <div className="as-actions">
              <Link href="/admin/staff" className="cx-btn cx-btn-ghost" style={{ textDecoration: "none" }}>Cancel</Link>
              <button type="submit" className="cx-btn cx-btn-primary" disabled title="Staff creation is not connected yet">
                <Plus size={15} /> Add staff · coming soon
              </button>
            </div>
          </div>
        </Panel>
      </form>
    </div>
  );
}
