'use client';
import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import FormLayout from '@/app/components/FormLayout';

const inpCls = "w-full px-3 py-2.5 border border-slate-200 rounded-md text-sm bg-white text-slate-800 outline-none";
const lblCls = "block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5";
const spanCls = { 1: "col-span-1", 2: "col-span-2", 3: "col-span-3" };

function Field({ label, children, span = 1 }) {
  return (
    <div className={spanCls[span] || "col-span-1"}>
      {label && <label className={lblCls}>{label}</label>}
      {children}
    </div>
  );
}
function TextInput({ value, onChange, placeholder, type = "text" }) {
  return <input type={type} value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={inpCls} />;
}
function TextArea({ value, onChange, placeholder, rows = 4 }) {
  return <textarea value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} className={`${inpCls} resize-vertical leading-relaxed`} />;
}
function RadioInline({ value, onChange, options }) {
  return (
    <div className="flex gap-4 flex-wrap">
      {options.map(o => {
        const checked = value === o;
        return (
          <label key={o} className="flex items-center gap-1.5 text-sm text-slate-800 cursor-pointer">
            <span onClick={() => onChange(o)}
              className={`w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center shrink-0 cursor-pointer ${checked ? "border-brand bg-brand" : "border-slate-300 bg-white"}`}>
              {checked && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
            </span>
            {o}
          </label>
        );
      })}
    </div>
  );
}
function SectionHead({ children, className = "" }) {
  return <div className={`text-[11px] font-bold text-navy uppercase tracking-[0.08em] border-b-2 border-slate-200 pb-2 mb-4 ${className}`}>{children}</div>;
}
function Grid({ cols = 2, children }) {
  const cls = cols === 3 ? "grid grid-cols-3 gap-x-4 gap-y-3" : "grid grid-cols-2 gap-x-4 gap-y-3";
  return <div className={cls}>{children}</div>;
}

function NotifyRow({ label, data, onChange }) {
  const set = (k, v) => onChange({ ...data, [k]: v });
  return (
    <div className="grid gap-x-3 items-center p-2.5 bg-slate-50 border border-slate-200 rounded-lg mb-2"
      style={{ gridTemplateColumns: "160px 80px 1fr 120px 100px", minWidth: "640px" }}>
      <span className="text-sm font-semibold text-navy">{label}</span>
      <RadioInline value={data.notified} onChange={v => set("notified", v)} options={["Yes", "No"]} />
      <TextInput value={data.name} onChange={v => set("name", v)} placeholder="Name" />
      <TextInput type="date" value={data.date} onChange={v => set("date", v)} />
      <TextInput type="time" value={data.time} onChange={v => set("time", v)} />
    </div>
  );
}

const INCIDENT_TYPES = [
  { id: "accident",      label: "Accident",                   checkedCls: "bg-amber-50 border-amber-500",   checkCls: "border-amber-500 bg-amber-500",    textCls: "text-amber-700"  },
  { id: "medication",    label: "Medication Error",           checkedCls: "bg-red-50 border-red-500",       checkCls: "border-red-500 bg-red-500",        textCls: "text-red-600"    },
  { id: "complaint",     label: "Complaint",                  checkedCls: "bg-blue-50 border-blue-600",     checkCls: "border-blue-600 bg-blue-600",      textCls: "text-blue-700"   },
  { id: "behavioral",    label: "Behavioral",                 checkedCls: "bg-purple-50 border-purple-600", checkCls: "border-purple-600 bg-purple-600",  textCls: "text-purple-700" },
  { id: "abuse_neglect", label: "Suspected Abuse or Neglect", checkedCls: "bg-red-100 border-red-600",      checkCls: "border-red-600 bg-red-600",        textCls: "text-red-700"    },
];

function IncidentTypeBox({ label, checked, onChange, checkedCls, checkCls, textCls }) {
  return (
    <div onClick={onChange}
      className={`flex items-center gap-2.5 p-3 rounded-lg cursor-pointer border-[1.5px] transition-all ${checked ? checkedCls : "bg-white border-slate-200"}`}>
      <span className={`w-4 h-4 rounded-sm shrink-0 border-[1.5px] flex items-center justify-center ${checked ? checkCls : "border-slate-200 bg-white"}`}>
        {checked && <span className="text-white text-[10px]">✓</span>}
      </span>
      <span className={`text-sm ${checked ? `font-bold ${textCls}` : "font-normal text-slate-800"}`}>{label}</span>
    </div>
  );
}

const BODY_ZONES = [
  { id: "head",         label: "Head",            fx: 110, fy: 18,  bx: 310, by: 18,  r: 18 },
  { id: "neck",         label: "Neck",            fx: 110, fy: 52,  bx: 310, by: 52,  r: 8  },
  { id: "chest",        label: "Chest/Torso",     fx: 110, fy: 90,  bx: 310, by: 90,  r: 22 },
  { id: "abdomen",      label: "Abdomen",         fx: 110, fy: 130, bx: 310, by: 130, r: 18 },
  { id: "left_arm",     label: "Left Arm",        fx: 72,  fy: 95,  bx: 272, by: 95,  r: 10 },
  { id: "right_arm",    label: "Right Arm",       fx: 148, fy: 95,  bx: 348, by: 95,  r: 10 },
  { id: "left_hand",    label: "Left Hand",       fx: 58,  fy: 145, bx: 258, by: 145, r: 8  },
  { id: "right_hand",   label: "Right Hand",      fx: 162, fy: 145, bx: 362, by: 145, r: 8  },
  { id: "pelvis",       label: "Pelvis/Groin",    fx: 110, fy: 162, bx: 310, by: 162, r: 14 },
  { id: "left_thigh",   label: "Left Thigh",      fx: 92,  fy: 195, bx: 292, by: 195, r: 11 },
  { id: "right_thigh",  label: "Right Thigh",     fx: 128, fy: 195, bx: 328, by: 195, r: 11 },
  { id: "left_knee",    label: "Left Knee",       fx: 92,  fy: 228, bx: 292, by: 228, r: 9  },
  { id: "right_knee",   label: "Right Knee",      fx: 128, fy: 228, bx: 328, by: 228, r: 9  },
  { id: "left_lower",   label: "Left Lower Leg",  fx: 92,  fy: 258, bx: 292, by: 258, r: 9  },
  { id: "right_lower",  label: "Right Lower Leg", fx: 128, fy: 258, bx: 328, by: 258, r: 9  },
  { id: "left_foot",    label: "Left Foot",       fx: 88,  fy: 288, bx: 288, by: 288, r: 8  },
  { id: "right_foot",   label: "Right Foot",      fx: 132, fy: 288, bx: 332, by: 288, r: 8  },
];

function BodyDiagram({ selected, onChange }) {
  const toggle = (id) => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);

  const FrontFigure = () => (
    <g stroke="#c5d4e8" strokeWidth="2" fill="none">
      <circle cx="110" cy="18" r="14" fill="#e8f0fb" />
      <line x1="110" y1="32" x2="110" y2="100" />
      <line x1="110" y1="55" x2="75" y2="95" />
      <line x1="110" y1="55" x2="145" y2="95" />
      <line x1="75" y1="95" x2="65" y2="145" />
      <line x1="145" y1="95" x2="155" y2="145" />
      <line x1="110" y1="100" x2="95" y2="160" />
      <line x1="110" y1="100" x2="125" y2="160" />
      <line x1="95" y1="160" x2="92" y2="230" />
      <line x1="125" y1="160" x2="128" y2="230" />
      <line x1="92" y1="230" x2="90" y2="290" />
      <line x1="128" y1="230" x2="130" y2="290" />
    </g>
  );

  const BackFigure = () => (
    <g stroke="#c5d4e8" strokeWidth="2" fill="none">
      <circle cx="310" cy="18" r="14" fill="#e8f0fb" />
      <line x1="310" y1="32" x2="310" y2="100" />
      <line x1="310" y1="55" x2="275" y2="95" />
      <line x1="310" y1="55" x2="345" y2="95" />
      <line x1="275" y1="95" x2="265" y2="145" />
      <line x1="345" y1="95" x2="355" y2="145" />
      <line x1="310" y1="100" x2="295" y2="160" />
      <line x1="310" y1="100" x2="325" y2="160" />
      <line x1="295" y1="160" x2="292" y2="230" />
      <line x1="325" y1="160" x2="328" y2="230" />
      <line x1="292" y1="230" x2="290" y2="290" />
      <line x1="328" y1="230" x2="330" y2="290" />
    </g>
  );

  return (
    <div>
      <div className="text-[11px] text-slate-500 mb-2.5 font-semibold uppercase tracking-wider">
        Click body areas to mark injuries — Front (left) / Back (right)
      </div>
      <div className="flex gap-5 items-start">
        <svg width="220" height="310" className="shrink-0">
          <text x="110" y="308" textAnchor="middle" fontSize="10" fill="#6b7c93">FRONT</text>
          <FrontFigure />
          {BODY_ZONES.map(z => {
            const hit = selected.includes(z.id);
            return (
              <circle key={`f-${z.id}`} cx={z.fx} cy={z.fy} r={z.r}
                fill={hit ? "#e24b4a" : "transparent"}
                stroke={hit ? "#e24b4a" : "transparent"}
                opacity={hit ? 0.35 : 0}
                className="cursor-pointer"
                onClick={() => toggle(z.id)}
              />
            );
          })}
          {BODY_ZONES.map(z => (
            <circle key={`fh-${z.id}`} cx={z.fx} cy={z.fy} r={z.r}
              fill="transparent" stroke="transparent"
              className="cursor-pointer"
              onClick={() => toggle(z.id)}
            />
          ))}
        </svg>

        <svg width="220" height="310" className="shrink-0">
          <text x="310" y="308" textAnchor="middle" fontSize="10" fill="#6b7c93" transform="translate(-200,0)">BACK</text>
          <BackFigure />
          {BODY_ZONES.map(z => {
            const hit = selected.includes(z.id);
            return (
              <circle key={`b-${z.id}`} cx={z.bx - 200} cy={z.by} r={z.r}
                fill={hit ? "#e24b4a" : "transparent"}
                stroke={hit ? "#e24b4a" : "transparent"}
                opacity={hit ? 0.35 : 0}
                className="cursor-pointer"
                onClick={() => toggle(z.id)}
              />
            );
          })}
          {BODY_ZONES.map(z => (
            <circle key={`bh-${z.id}`} cx={z.bx - 200} cy={z.by} r={z.r}
              fill="transparent" stroke="transparent"
              className="cursor-pointer"
              onClick={() => toggle(z.id)}
            />
          ))}
        </svg>

        <div className="flex-1">
          <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mb-2">Marked Injuries</div>
          {selected.length === 0 ? (
            <div className="text-sm text-slate-400 italic">None marked</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {selected.map(id => {
                const zone = BODY_ZONES.find(z => z.id === id);
                return (
                  <span key={id} className="bg-red-100 text-red-600 text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                    {zone?.label}
                    <span onClick={() => toggle(id)} className="cursor-pointer opacity-60">×</span>
                  </span>
                );
              })}
            </div>
          )}
          <div className="mt-3.5 text-[11px] text-slate-500 leading-relaxed">
            Mark bruises, cuts, abrasions, broken bones, or any visible injuries on the body diagram by clicking the affected area.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IncidentReportPage() {
  const router = useRouter();
  const { auth } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [residents, setResidents] = useState([]);
  const [form, setForm] = useState({
    residentId: "", residentName: "", incidentDate: "", incidentTime: "",
    incidentTypes: [], abuseReportDate: "",
    location: "", otherResidents: "", witnessed: "", witnessedBy: "",
    incidentDetails: "", staffActions: "", injuredAreas: [],
    notifications: {
      licensee:    { notified: "", name: "", date: "", time: "" },
      primaryCare: { notified: "", name: "", date: "", time: "" },
      family:      { notified: "", name: "", date: "", time: "" },
      caseManager: { notified: "", name: "", date: "", time: "" },
      licensor:    { notified: "", name: "", date: "", time: "" },
      mentalHealth:{ notified: "", name: "", date: "", time: "" },
    },
    followUpPlan: "", completedBy: "", completedBySignature: "",
    completedDate: "", completedTime: "", licenseeSignature: "",
    reviewDate: "", signedDate: "",
  });

  // Fetch residents (staff: only assigned, admin: all)
  useEffect(() => {
    if (!auth) return;
    const fetchResidents = async () => {
      try {
        const isStaff = auth.user?.role === 'staff';
        // Facility-wide policy: staff may file for any resident, not just assigned ones.
        const endpoint = isStaff ? '/api/v1/residents?limit=200' : '/api/v1/admin/residents?limit=200';
        const res = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${auth.accessToken}` },
          credentials: 'same-origin',
        });
        if (res.ok) {
          const data = await res.json();
          const list = (data.data || data.residents || []).map(r => ({
            id: r.resident_id || r.id,
            first_name: r.first_name,
            last_name: r.last_name,
          }));
          setResidents(list);
        }
      } catch (err) {
      }
    };
    fetchResidents();
  }, [auth]);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  // Build notifications array from object map
  const buildNotifications = () => {
    const labels = {
      licensee: 'Licensee', primaryCare: 'Primary Care Practitioner',
      family: 'Family', caseManager: 'Case Manager',
      licensor: 'Licensor', mentalHealth: 'Mental Health Professional',
    };
    return Object.entries(form.notifications)
      .filter(([, v]) => v.notified || v.name)
      .map(([k, v]) => ({
        party: labels[k] || k,
        was_notified: v.notified === 'Yes',
        contact_name: v.name || null,
        notified_date: v.date || null,
        notified_time: v.time || null,
      }));
  };

  const isValid = () => {
    return form.residentId && form.incidentDate && form.incidentTime && form.incidentTypes.length > 0 && form.incidentDetails;
  };

  const handleSubmit = async () => {
    if (!isValid()) {
      setError('Please complete required fields: resident, date, time, incident type, and details.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/v1/incidents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth?.accessToken}`,
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          resident_id: form.residentId,
          incident_date: form.incidentDate,
          incident_time: form.incidentTime,
          incident_types: form.incidentTypes,
          location: form.location,
          other_residents_involved: form.otherResidents,
          witnessed: form.witnessed === 'Yes',
          witnessed_by: form.witnessedBy,
          body_areas_injured: { areas: form.injuredAreas },
          incident_details: form.incidentDetails,
          staff_actions_taken: form.staffActions,
          follow_up_plan: form.followUpPlan,
          notifications: buildNotifications(),
          completed_by_name: form.completedBy,
          completed_by_signature: form.completedBySignature,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to submit incident report');
        setSaving(false);
        return;
      }
      setSubmitted(true);
    } catch (err) {
      setError('An error occurred while submitting. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  const setNotif = (party, v) =>
    setForm(prev => ({ ...prev, notifications: { ...prev.notifications, [party]: v } }));
  const toggleType = (type) => {
    const cur = form.incidentTypes;
    set("incidentTypes", cur.includes(type) ? cur.filter(x => x !== type) : [...cur, type]);
  };

  const NOTIFICATIONS_LIST = [
    { key: "licensee",     label: "Licensee" },
    { key: "primaryCare",  label: "Primary Care Practitioner" },
    { key: "family",       label: "Family" },
    { key: "caseManager",  label: "Case Manager" },
    { key: "licensor",     label: "Licensor" },
    { key: "mentalHealth", label: "Mental Health Professional" },
  ];

  const sectionCard = "bg-white border border-slate-200 rounded-lg p-6 mb-4";

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-white border border-slate-200 rounded-xl px-14 py-12 text-center max-w-md">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-[24px] mx-auto mb-5">✓</div>
          <div className="text-xl font-bold text-navy mb-2">Incident Report Submitted</div>
          <div className="text-sm text-slate-500 mb-7 leading-relaxed">
            The report has been logged and is pending licensee review. All notified parties have been recorded.
          </div>
          <button onClick={() => router.push('/')}
            className="bg-brand text-white border-none rounded-lg px-7 py-2.5 text-sm font-bold cursor-pointer hover:bg-blue-700 transition-colors">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <FormLayout formTitle="Incident Report">
      <div style={{ maxWidth: '900px' }}>

        {/* Header card */}
        <div className={sectionCard}>
          <div className="text-lg font-bold text-navy mb-1">Incident Report</div>
          <div className="text-xs text-slate-500">Complete all applicable fields. Suspected abuse/neglect must be reported to the local office immediately.</div>
        </div>

        {/* Section 1 — Basics */}
        <div className={sectionCard}>
          <SectionHead className="mt-0">Resident & Incident Details</SectionHead>
          <Grid cols={3}>
            <Field label="Resident" span={1}>
              <select
                value={form.residentId}
                onChange={e => set("residentId", e.target.value)}
                className={inpCls}
              >
                <option value="">— Select resident —</option>
                {residents.map(r => (
                  <option key={r.id} value={r.id}>{`${r.first_name || ''} ${r.last_name || ''}`.trim()}</option>
                ))}
              </select>
            </Field>
            <Field label="Date of Incident">
              <TextInput type="date" value={form.incidentDate} onChange={v => set("incidentDate", v)} />
            </Field>
            <Field label="Time of Incident">
              <TextInput type="time" value={form.incidentTime} onChange={v => set("incidentTime", v)} />
            </Field>
          </Grid>

          <SectionHead className="mt-5">Type of Incident</SectionHead>
          <div className="grid grid-cols-3 gap-2.5 mb-3">
            {INCIDENT_TYPES.map(t => (
              <IncidentTypeBox key={t.id} label={t.label}
                checked={form.incidentTypes.includes(t.id)} onChange={() => toggleType(t.id)}
                checkedCls={t.checkedCls} checkCls={t.checkCls} textCls={t.textCls} />
            ))}
          </div>
          {form.incidentTypes.includes("abuse_neglect") && (
            <div className="bg-red-100 border border-red-300 border-l-4 border-l-red-600 rounded-lg p-3.5 mb-3">
              <Field label="Date Reported to Local Office">
                <TextInput type="date" value={form.abuseReportDate} onChange={v => set("abuseReportDate", v)} />
              </Field>
            </div>
          )}

          <Grid cols={2}>
            <Field label="Where Did Incident Occur?">
              <TextInput value={form.location} onChange={v => set("location", v)} placeholder="Room number, hallway, outdoor area..." />
            </Field>
            <Field label="Other Residents Involved">
              <TextInput value={form.otherResidents} onChange={v => set("otherResidents", v)} placeholder="Names of any other residents involved" />
            </Field>
            <Field label="Was Incident Witnessed?">
              <RadioInline value={form.witnessed} onChange={v => set("witnessed", v)} options={["Yes", "No"]} />
            </Field>
            {form.witnessed === "Yes" && (
              <Field label="If So, By Whom?">
                <TextInput value={form.witnessedBy} onChange={v => set("witnessedBy", v)} placeholder="Name(s) of witness(es)" />
              </Field>
            )}
          </Grid>
        </div>

        {/* Section 2 — Narrative */}
        <div className={sectionCard}>
          <SectionHead className="mt-0">Incident Narrative</SectionHead>
          <Field label="Details of Incident and Description of Any Injuries">
            <TextArea value={form.incidentDetails} onChange={v => set("incidentDetails", v)}
              placeholder="Describe the incident in full detail — what happened, sequence of events, nature and extent of any injuries observed..." rows={5} />
          </Field>
          <div className="mt-3.5">
            <Field label="Specific Action(s) Taken by Staff">
              <TextArea value={form.staffActions} onChange={v => set("staffActions", v)}
                placeholder="Describe all immediate interventions — first aid, de-escalation, emergency services called, medications administered, containment actions..." rows={4} />
            </Field>
          </div>
        </div>

        {/* Section 3 — Body diagram */}
        <div className={sectionCard}>
          <SectionHead className="mt-0">Body Areas Injured</SectionHead>
          <BodyDiagram selected={form.injuredAreas} onChange={v => set("injuredAreas", v)} />
        </div>

        {/* Section 4 — Notifications */}
        <div className={sectionCard}>
          <SectionHead className="mt-0">Notifications</SectionHead>
          <div style={{ overflowX: "auto" }}>
            <div className="grid gap-x-3 px-3.5 pb-2 mb-1" style={{ gridTemplateColumns: "160px 80px 1fr 120px 100px", minWidth: "640px" }}>
              <span className={lblCls}>Party</span>
              <span className={lblCls}>Notified?</span>
              <span className={lblCls}>Name</span>
              <span className={lblCls}>Date</span>
              <span className={lblCls}>Time</span>
            </div>
            {NOTIFICATIONS_LIST.map(({ key, label }) => (
              <NotifyRow key={key} label={label} data={form.notifications[key]}
                onChange={v => setNotif(key, v)} />
            ))}
          </div>
        </div>

        {/* Section 5 — Follow-up */}
        <div className={sectionCard}>
          <SectionHead className="mt-0">Follow-Up Plan</SectionHead>
          <Field label="Follow-Up Plan">
            <TextArea value={form.followUpPlan} onChange={v => set("followUpPlan", v)}
              placeholder="Describe planned follow-up actions — monitoring schedule, referrals, safety plan adjustments, policy review, staff debriefing..." rows={4} />
          </Field>
        </div>

        {/* Section 6 — Sign-off */}
        <div className={sectionCard}>
          <SectionHead className="mt-0">Sign-Off</SectionHead>
          <Grid cols={2}>
            <Field label="Name of Person Completing Form">
              <TextInput value={form.completedBy} onChange={v => set("completedBy", v)} placeholder="Full name and title" />
            </Field>
            <Field label="Signature (Type to Acknowledge)">
              <TextInput value={form.completedBySignature} onChange={v => set("completedBySignature", v)} placeholder="Type full name to sign" />
            </Field>
            <Field label="Date">
              <TextInput type="date" value={form.completedDate} onChange={v => set("completedDate", v)} />
            </Field>
            <Field label="Time">
              <TextInput type="time" value={form.completedTime} onChange={v => set("completedTime", v)} />
            </Field>
          </Grid>

          <div className="mt-5 pt-4 border-t border-slate-200">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Licensee Review</div>
            <Grid cols={3}>
              <Field label="Licensee Signature (Type to Acknowledge)" span={1}>
                <TextInput value={form.licenseeSignature} onChange={v => set("licenseeSignature", v)} placeholder="Type full name to sign" />
              </Field>
              <Field label="Date of Review">
                <TextInput type="date" value={form.reviewDate} onChange={v => set("reviewDate", v)} />
              </Field>
              <Field label="Date Signed">
                <TextInput type="date" value={form.signedDate} onChange={v => set("signedDate", v)} />
              </Field>
            </Grid>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-3 mb-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center">
          <button onClick={() => router.back()} className="bg-transparent border border-slate-200 rounded-lg px-5 py-2.5 text-sm font-semibold text-slate-500 cursor-pointer hover:bg-slate-50 transition-colors">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={saving || !isValid()}
            className="bg-brand border-none rounded-lg px-7 py-2.5 text-sm font-bold text-white cursor-pointer hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Submitting...' : 'Submit Report ✓'}
          </button>
        </div>
      </div>
    </FormLayout>
  );
}
