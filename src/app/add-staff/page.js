'use client';
import { useState } from "react";
import { useRouter } from 'next/navigation';
import { useAuth, authHeaders } from '@/contexts/AuthContext';

const ROLES = [
  { value: "RN",            label: "RN — Registered Nurse" },
  { value: "LPN",           label: "LPN — Licensed Practical Nurse" },
  { value: "QMHP",          label: "QMHP — Qualified Mental Health Professional" },
  { value: "Caregiver",     label: "Caregiver" },
  { value: "Med_Aide",      label: "Medication Aide" },
  { value: "Case_Manager",  label: "Case Manager" },
  { value: "Administrator", label: "Administrator" },
  { value: "Licensee",      label: "Licensee" },
  { value: "Director",      label: "Director" },
  { value: "Other",         label: "Other" },
];

const SHIFTS = [
  { value: "day",   label: "Day Shift" },
  { value: "night", label: "Night Shift" },
  { value: "swing", label: "Swing Shift" },
];

const inpCls = "w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white text-slate-800 outline-none";
const lblCls = "block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5";
const spanCls = { 1: "col-span-1", 2: "col-span-2", 3: "col-span-3" };

function Field({ label, children, span = 1, required }) {
  return (
    <div className={spanCls[span] || "col-span-1"}>
      {label && (
        <label className={lblCls}>
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      {children}
    </div>
  );
}
function TextInput({ value, onChange, placeholder, type = "text", disabled }) {
  return (
    <input type={type} value={value ?? ""} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} disabled={disabled}
      className={`${inpCls} ${disabled ? "bg-slate-50 text-slate-400" : ""}`} />
  );
}
function SelectInput({ value, onChange, options, placeholder = "— Select —" }) {
  return (
    <select value={value ?? ""} onChange={e => onChange(e.target.value)}
      className={`${inpCls} appearance-none`}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
function RadioGroup({ value, onChange, options }) {
  return (
    <div className="flex gap-4 flex-wrap">
      {options.map(o => {
        const checked = value === o.value;
        return (
          <label key={o.value} className="flex items-center gap-1.5 text-sm text-slate-800 cursor-pointer">
            <span onClick={() => onChange(o.value)}
              className={`w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center shrink-0 cursor-pointer ${checked ? "border-brand bg-brand" : "border-slate-300 bg-white"}`}>
              {checked && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
            </span>
            {o.label}
          </label>
        );
      })}
    </div>
  );
}
function Grid({ cols = 2, children }) {
  const cls = cols === 3 ? "grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-3.5" : "grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5";
  return <div className={cls}>{children}</div>;
}
function SectionHead({ children }) {
  return <div className="text-[11px] font-bold text-navy uppercase tracking-[0.08em] border-b-2 border-slate-200 pb-2 mb-4">{children}</div>;
}
function Card({ children, className = "" }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-lg p-6 mb-4 ${className}`}>
      {children}
    </div>
  );
}
function ErrorMsg({ msg }) {
  if (!msg) return null;
  return <div className="text-[11px] text-red-500 mt-1 font-semibold">{msg}</div>;
}

function AvatarPreview({ firstName, lastName, role }) {
  const initials = [firstName?.[0], lastName?.[0]].filter(Boolean).join("").toUpperCase() || "?";
  const roleObj = ROLES.find(r => r.value === role);
  return (
    <div className="flex items-center gap-4">
      <div className="w-16 h-16 rounded-full bg-brand-light flex items-center justify-center text-[22px] font-bold text-brand shrink-0 border-2 border-slate-200">
        {initials}
      </div>
      <div>
        <div className="text-base font-bold text-navy">
          {[firstName, lastName].filter(Boolean).join(" ") || "New Staff Member"}
        </div>
        <div className="text-sm text-slate-500 mt-0.5">
          {roleObj ? roleObj.label.split(" — ")[0] : "Role not selected"}
        </div>
      </div>
    </div>
  );
}

const PERMISSION_SETS = {
  RN: ["View Residents", "Daily Notes", "Medications (MAR)", "Incident Reports", "Care Plans", "Sign Off Notes"],
  LPN: ["View Residents", "Daily Notes", "Medications (MAR)", "Incident Reports"],
  QMHP: ["View Residents", "Daily Notes", "Care Plans", "Incident Reports", "Pre-Admission Screening"],
  Caregiver: ["View Residents", "Daily Notes", "Incident Reports"],
  Med_Aide: ["View Residents", "Medications (MAR)", "Daily Notes"],
  Case_Manager: ["View Residents", "Pre-Admission Screening", "Care Plans"],
  Administrator: ["View Residents", "Daily Notes", "Medications (MAR)", "Incident Reports", "Care Plans", "Staff Management", "Compliance", "Reports"],
  Licensee: ["View Residents", "Daily Notes", "Medications (MAR)", "Incident Reports", "Care Plans", "Staff Management", "Compliance", "Reports", "Sign Off Notes"],
  Director: ["View Residents", "Daily Notes", "Medications (MAR)", "Incident Reports", "Care Plans", "Staff Management", "Compliance", "Reports", "Sign Off Notes"],
  Other: ["View Residents"],
};

export default function AddStaffPage() {
  const router = useRouter();
  const { auth, csrfToken } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    first_name: "", last_name: "", role: "", preferred_name: "", pronouns: "",
    email: "", phone: "", shift: "", hire_date: "", employee_id: "",
    emergency_contact_name: "", emergency_contact_phone: "", emergency_contact_relation: "",
    certifications: {}, notes: "", is_active: "true",
  });

  const set = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: null }));
  };

  const toggleCert = (cert) => {
    const cur = { ...form.certifications };
    if (cur[cert] !== undefined) { delete cur[cert]; } else { cur[cert] = ""; }
    set("certifications", cur);
  };

  const setCertExpiry = (cert, date) => set("certifications", { ...form.certifications, [cert]: date });

  const validate = () => {
    const e = {};
    if (!form.first_name.trim()) e.first_name = "First name is required";
    if (!form.last_name.trim())  e.last_name  = "Last name is required";
    if (!form.role)              e.role        = "Role is required";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }

    setSaving(true);
    try {
      const response = await fetch('/api/v1/staff/create', {
        method: 'POST',
        headers: authHeaders(auth?.accessToken, csrfToken),
        credentials: 'same-origin',
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setErrors({ submit: errorData.error || 'Failed to create staff member' });
        setSaving(false);
        return;
      }

      const result = await response.json();
      const payload = result.data || result;
      setCredentials(payload.credentials);

      // Surface the new hire's login credentials to the admin instantly: the
      // Staff Directory renders a credentials banner from this sessionStorage
      // queue. Kept browser-side only (same lifetime as the success screen) —
      // never persisted to the DB, since these are plaintext temporary creds.
      try {
        if (payload.staff && payload.credentials) {
          const queue = JSON.parse(sessionStorage.getItem('admin_notifications') || '[]');
          queue.unshift({
            staff: payload.staff,
            credentials: payload.credentials,
            created_at: new Date().toISOString(),
          });
          sessionStorage.setItem('admin_notifications', JSON.stringify(queue.slice(0, 5)));
        }
      } catch { /* sessionStorage unavailable — success screen still shows the credentials */ }

      // Show success page with credentials
      setSubmitted(true);
    } catch (error) {
      setErrors({ submit: error.message });
    } finally {
      setSaving(false);
    }
  };

  const permissions = PERMISSION_SETS[form.role] || [];

  const CERTS = [
    "CPR / First Aid", "CNA", "Medication Aide Certification",
    "Food Handler's Card", "Mandatory Reporter Training",
    "Mental Health First Aid", "De-escalation Training",
    "QMHP Credentialed", "Oregon CAREAssist Certified",
  ];

  const blankForm = { first_name:"",last_name:"",role:"",preferred_name:"",pronouns:"",email:"",phone:"",shift:"",hire_date:"",employee_id:"",emergency_contact_name:"",emergency_contact_phone:"",emergency_contact_relation:"",certifications:{},notes:"",is_active:"true" };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-xl px-8 py-10 max-w-2xl w-full">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-[32px] mx-auto mb-6">✓</div>

          <div className="text-center mb-6">
            <div className="text-2xl font-bold text-navy mb-2">Staff Member Added</div>
            <div className="text-sm text-slate-600 leading-relaxed">
              <strong className="text-slate-800">{form.first_name} {form.last_name}</strong> has been created as <strong className="text-slate-800">{ROLES.find(r => r.value === form.role)?.label.split(" — ")[0]}</strong>.
            </div>
          </div>

          {credentials && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-5 mb-6">
              <div className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-4">🔑 Login Credentials</div>
              <div className="space-y-3">
                <div className="bg-white rounded p-3 border border-blue-100">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Username</div>
                  <div className="font-mono text-sm font-bold text-slate-800">{credentials.username}</div>
                </div>
                <div className="bg-white rounded p-3 border border-blue-100">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Password</div>
                  <div className="font-mono text-sm font-bold text-slate-800 break-all">{credentials.password}</div>
                </div>
              </div>
              <div className="mt-4 text-xs text-blue-800 bg-blue-100 rounded p-3">
                ⚠️ <strong>Temporary password</strong> — Staff member must change password on first login. Share these credentials securely and never reuse.
              </div>
            </div>
          )}

          <div className="bg-slate-50 rounded-lg p-4 mb-6 text-xs text-slate-600">
            <strong>What's next:</strong> Staff member can log in at the staff portal using the credentials above. System permissions based on their role ({ROLES.find(r => r.value === form.role)?.label.split(" — ")[0]}) have been automatically assigned.
          </div>

          <div className="flex gap-3 justify-center">
            <button onClick={() => { setSubmitted(false); setForm(blankForm); setErrors({}); setCredentials(null); }}
              className="bg-white border border-slate-200 rounded-lg px-6 py-2.5 text-sm font-semibold text-navy cursor-pointer hover:bg-slate-50 transition-colors">
              Add Another Staff
            </button>
            <button onClick={() => router.push('/admin?view=staff')}
              className="bg-brand border-none rounded-lg px-6 py-2.5 text-sm font-bold text-white cursor-pointer hover:bg-blue-700 transition-colors">
              View Staff Directory
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="bg-navy px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <button onClick={() => router.push('/admin?view=staff')} className="bg-white/10 border border-white/15 rounded-md text-white/70 text-xs px-3 py-1.5 cursor-pointer hover:bg-white/15 transition-colors">← Back</button>
          <div className="text-white/50 text-sm">Staff</div>
          <div className="text-white/30">›</div>
          <div className="text-white text-sm font-semibold">Add Staff Member</div>
        </div>
        <div className="text-[11px] text-white/40 tracking-wider">ref.staff · DEPENDABLE CARE RESIDENTIAL SERVICES</div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-7 pb-16">
        {/* Page title */}
        <div className="mb-5">
          <h1 className="text-xl font-bold text-navy mb-1">New Staff Member</h1>
          <p className="text-sm text-slate-500 m-0">Fields marked <span className="text-red-500">*</span> are required and map directly to <code className="bg-brand-light px-1.5 py-0.5 rounded text-xs">ref.staff</code>.</p>
        </div>

        {/* Avatar preview */}
        <Card>
          <AvatarPreview firstName={form.first_name} lastName={form.last_name} role={form.role} />
        </Card>

        {/* Section 1 — Core identity */}
        <Card>
          <SectionHead>Core Identity — ref.staff</SectionHead>
          <Grid cols={2}>
            <Field label="First Name" required>
              <TextInput value={form.first_name} onChange={v => set("first_name", v)} placeholder="First name" />
              <ErrorMsg msg={errors.first_name} />
            </Field>
            <Field label="Last Name" required>
              <TextInput value={form.last_name} onChange={v => set("last_name", v)} placeholder="Last name" />
              <ErrorMsg msg={errors.last_name} />
            </Field>
            <Field label="Role" required>
              <SelectInput value={form.role} onChange={v => set("role", v)} options={ROLES} />
              <ErrorMsg msg={errors.role} />
            </Field>
            <Field label="Preferred / Display Name">
              <TextInput value={form.preferred_name} onChange={v => set("preferred_name", v)} placeholder="If different from legal name" />
            </Field>
            <Field label="Preferred Pronouns">
              <SelectInput value={form.pronouns} onChange={v => set("pronouns", v)} options={[
                { value: "he_him",    label: "He / Him" },
                { value: "she_her",   label: "She / Her" },
                { value: "they_them", label: "They / Them" },
                { value: "other",     label: "Other / Not specified" },
              ]} />
            </Field>
            <Field label="Active Status">
              <RadioGroup value={form.is_active} onChange={v => set("is_active", v)} options={[
                { value: "true",  label: "Active" },
                { value: "false", label: "Inactive" },
              ]} />
            </Field>
          </Grid>
        </Card>

        {/* Section 2 — Contact & Employment */}
        <Card>
          <SectionHead>Contact & Employment</SectionHead>
          <Grid cols={2}>
            <Field label="Work Email">
              <TextInput type="email" value={form.email} onChange={v => set("email", v)} placeholder="staff@dependablecare.org" />
            </Field>
            <Field label="Phone Number">
              <TextInput type="tel" value={form.phone} onChange={v => set("phone", v)} placeholder="(503) 000-0000" />
            </Field>
            <Field label="Hire Date">
              <TextInput type="date" value={form.hire_date} onChange={v => set("hire_date", v)} />
            </Field>
            <Field label="Employee / Staff ID">
              <TextInput value={form.employee_id} onChange={v => set("employee_id", v)} placeholder="Internal ID or badge number" />
            </Field>
            <Field label="Primary Shift">
              <SelectInput value={form.shift} onChange={v => set("shift", v)} options={SHIFTS} />
            </Field>
          </Grid>
        </Card>

        {/* Section 3 — Emergency Contact */}
        <Card>
          <SectionHead>Emergency Contact</SectionHead>
          <Grid cols={3}>
            <Field label="Contact Name">
              <TextInput value={form.emergency_contact_name} onChange={v => set("emergency_contact_name", v)} placeholder="Full name" />
            </Field>
            <Field label="Contact Phone">
              <TextInput type="tel" value={form.emergency_contact_phone} onChange={v => set("emergency_contact_phone", v)} placeholder="(503) 000-0000" />
            </Field>
            <Field label="Relationship">
              <SelectInput value={form.emergency_contact_relation} onChange={v => set("emergency_contact_relation", v)} options={[
                { value: "spouse",  label: "Spouse / Partner" },
                { value: "parent",  label: "Parent" },
                { value: "sibling", label: "Sibling" },
                { value: "child",   label: "Child" },
                { value: "friend",  label: "Friend" },
                { value: "other",   label: "Other" },
              ]} />
            </Field>
          </Grid>
        </Card>

        {/* Section 4 — Certifications */}
        <Card>
          <SectionHead>Certifications & Training</SectionHead>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {CERTS.map(cert => {
              const checked = form.certifications[cert] !== undefined;
              const expiry  = form.certifications[cert] ?? "";
              return (
                <div key={cert} className={`rounded-lg overflow-hidden transition-all ${checked ? "bg-brand-light border-[1.5px] border-brand" : "bg-slate-50 border-[1.5px] border-slate-200"}`}>
                  <div onClick={() => toggleCert(cert)} className="flex items-center gap-2.5 p-3 cursor-pointer">
                    <span className={`w-4 h-4 rounded-sm shrink-0 border-[1.5px] flex items-center justify-center ${checked ? "border-brand bg-brand" : "border-slate-300 bg-white"}`}>
                      {checked && <span className="text-white text-[9px]">✓</span>}
                    </span>
                    <span className={`text-xs leading-tight ${checked ? "font-bold text-brand" : "font-normal text-slate-800"}`}>{cert}</span>
                  </div>
                  {checked && (
                    <div className="px-3 pb-3 border-t border-brand/10">
                      <label className="block text-[10px] font-bold text-brand uppercase tracking-wider mb-1">Expiry Date</label>
                      <input type="date" value={expiry} onClick={e => e.stopPropagation()}
                        onChange={e => setCertExpiry(cert, e.target.value)}
                        className="w-full px-2 py-1.5 border border-brand/40 rounded-md text-xs bg-white outline-none" />
                      {!expiry && <div className="text-[10px] text-amber-600 mt-1 font-semibold">No expiry date set</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Section 5 — Permissions preview */}
        <Card>
          <SectionHead>System Access — Role-Based Permissions</SectionHead>
          {form.role ? (
            <div>
              <div className="text-xs text-slate-500 mb-3">
                The following access will be granted based on the <strong className="text-navy">{ROLES.find(r => r.value === form.role)?.label}</strong> role. Permissions can be adjusted by an administrator after creation.
              </div>
              <div className="flex flex-wrap gap-2">
                {permissions.map(p => (
                  <span key={p} className="bg-brand-light text-brand text-xs font-semibold px-2.5 py-1 rounded-md">✓ {p}</span>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-400 italic">Select a role above to preview system permissions.</div>
          )}
        </Card>

        {/* Section 6 — Notes */}
        <Card>
          <SectionHead>Additional Notes</SectionHead>
          <Field label="Internal Notes (not visible to staff member)">
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
              placeholder="Onboarding notes, scheduling constraints, special considerations..."
              rows={3} className={`${inpCls} resize-vertical leading-relaxed`} />
          </Field>
        </Card>

        {/* DB payload preview */}
        <Card className="bg-slate-50">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">ref.staff — Record Preview</div>
          <div className="grid gap-x-3 gap-y-1.5 text-xs" style={{ gridTemplateColumns: "140px 1fr" }}>
            {[
              ["first_name",  form.first_name  || "—"],
              ["last_name",   form.last_name   || "—"],
              ["role",        form.role        || "—"],
              ["tenant_id",   "[ Set by session / middleware ]"],
              ["id",          "[ Auto-generated UUID ]"],
              ["created_at",  "[ Server timestamp ]"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'contents' }}>
                <span className="text-brand font-mono font-semibold">{k}</span>
                <span className="text-slate-800">{v}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Submit Error */}
        {errors.submit && (
          <Card className="bg-red-50 border-red-200">
            <div className="text-sm text-red-700 font-semibold">{errors.submit}</div>
          </Card>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center mt-1">
          <button onClick={() => router.push('/admin?view=staff')} className="bg-transparent border border-slate-200 rounded-lg px-5 py-2.5 text-sm font-semibold text-slate-500 cursor-pointer hover:bg-slate-50 transition-colors">Cancel</button>
          <div className="flex gap-2.5">
            <button className="bg-white border border-slate-200 rounded-lg px-5 py-2.5 text-sm font-semibold text-navy cursor-pointer hover:bg-slate-50 transition-colors">Save Draft</button>
            <button onClick={handleSubmit} disabled={saving} className={`border-none rounded-lg px-7 py-2.5 text-sm font-bold text-white transition-colors ${saving ? 'bg-slate-400 cursor-not-allowed' : 'bg-brand cursor-pointer hover:bg-blue-700'}`}>{saving ? 'Creating...' : 'Add Staff Member ✓'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
