'use client';

import { useState, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import MedicationScheduleMatrix from '@/app/components/MedicationScheduleMatrix';
import { useIsMobile } from '@/lib/useIsMobile';

const LIFE_DOMAINS = [
  { id: 1, label: "Peer Support" },
  { id: 2, label: "Personal Goals" },
  { id: 3, label: "Mental Health" },
  { id: 4, label: "Safety" },
  { id: 5, label: "Medical" },
  { id: 6, label: "Living Situation" },
  { id: 7, label: "Healthy Living" },
  { id: 8, label: "Financial/Legal Status" },
  { id: 9, label: "Social, Cultural, Spiritual" },
  { id: 10, label: "Natural/Family Support" },
  { id: 11, label: "Community Participation" },
  { id: 12, label: "Employment/Education" },
];

const WIZARD_STEPS = [
  { id: 1, label: "Patient & Plan Info",    short: "Patient",      icon: "◉" },
  { id: 2, label: "Care Planning Team",     short: "Team",         icon: "◎" },
  { id: 3, label: "Core Assessment",        short: "Assessment",   icon: "▦" },
  { id: 4, label: "Recovery Goals",         short: "Goals",        icon: "◈" },
  { id: 5, label: "Safety & Risk Plan",     short: "Safety",       icon: "⚑" },
  { id: 6, label: "Community & Discharge",  short: "Discharge",    icon: "⬡" },
  { id: 7, label: "Legal & Signatures",     short: "Sign-off",     icon: "✓" },
];

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  navy:        "#0f2d5e",
  navyMid:     "#1a3a5c",
  blue:        "#1a56db",
  bluePale:    "#eef4ff",
  blueBorder:  "#bfdbfe",
  white:       "#ffffff",
  bg:          "#f4f8ff",
  text:        "#1e2d40",
  muted:       "#6b7c93",
  border:      "#dde6f0",
  green:       "#0a7c4e",
  greenBg:     "#e6f5ee",
  amber:       "#b45309",
  amberBg:     "#fffbeb",
  red:         "#dc2626",
  redBg:       "#fef2f2",
  teal:        "#0891b2",
  tealBg:      "#ecfeff",
  gold:        "#d97706",
};

// ─── SHARED PRIMITIVES ────────────────────────────────────────────────────────
const inp = { width: "100%", padding: "9px 12px", border: `1px solid ${C.blueBorder}`, borderRadius: 7, fontSize: 13, background: C.white, color: C.text, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const lbl = { display: "block", fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" };
const secHead = { fontSize: 12, fontWeight: 700, color: C.blue, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: `2px solid ${C.blueBorder}`, paddingBottom: 7, marginBottom: 16, marginTop: 24 };

function F({ label, children, span = 1 }) {
  return <div style={{ gridColumn: `span ${span}` }}>{label && <label style={lbl}>{label}</label>}{children}</div>;
}
function TI({ value, onChange, placeholder, type = "text", readOnly = false }) {
  return <input readOnly={readOnly} type={type} value={value ?? ""} onChange={e => onChange && onChange(e.target.value)} placeholder={placeholder} style={{ ...inp, background: readOnly ? "#f0f5ff" : C.white, color: readOnly ? C.blue : C.text, fontWeight: readOnly ? 600 : 400 }} />;
}
function Sel({ value, onChange, options }) {
  return <select value={value ?? ""} onChange={e => onChange(e.target.value)} style={{ ...inp, appearance: "none" }}><option value="">— Select —</option>{options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}</select>;
}
function TA({ value, onChange, placeholder, rows = 3 }) {
  return <textarea value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ ...inp, resize: "vertical", lineHeight: 1.5 }} />;
}
function CG({ label, options, selected = [], onChange }) {
  const toggle = v => onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);
  return (
    <div>
      {label && <div style={{ ...lbl, marginBottom: 8 }}>{label}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
        {options.map(o => {
          const v = o.value ?? o, l = o.label ?? o, ch = selected.includes(v);
          return (
            <label key={v} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.text, cursor: "pointer" }}>
              <span onClick={() => toggle(v)} style={{ width: 16, height: 16, borderRadius: 3, border: `1.5px solid ${ch ? C.blue : C.blueBorder}`, background: ch ? C.blue : C.white, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                {ch && <span style={{ color: "#fff", fontSize: 10 }}>✓</span>}
              </span>{l}
            </label>
          );
        })}
      </div>
    </div>
  );
}
function RG({ label, options, value, onChange }) {
  return (
    <div>
      {label && <div style={{ ...lbl, marginBottom: 8 }}>{label}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px" }}>
        {options.map(o => {
          const v = o.value ?? o, l = o.label ?? o, ch = value === v;
          return (
            <label key={v} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.text, cursor: "pointer" }}>
              <span onClick={() => onChange(v)} style={{ width: 16, height: 16, borderRadius: "50%", border: `1.5px solid ${ch ? C.blue : C.blueBorder}`, background: ch ? C.blue : C.white, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                {ch && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff", display: "block" }} />}
              </span>{l}
            </label>
          );
        })}
      </div>
    </div>
  );
}
function Grid({ cols = 2, children }) { return <div className="app-grid-collapse" style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "14px 18px" }}>{children}</div>; }
function SH({ children }) { return <div style={secHead}>{children}</div>; }
function InfoBox({ color, bg, children }) { return <div style={{ background: bg, borderLeft: `3px solid ${color}`, borderRadius: 6, padding: "10px 14px", fontSize: 13, color, marginBottom: 16, lineHeight: 1.6 }}>{children}</div>; }
function AutoField({ label, value }) {
  return (
    <div>
      <div style={{ ...lbl, marginBottom: 4 }}>{label}</div>
      <div style={{ ...inp, background: "#e8f0fe", color: C.blue, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 10, background: C.blue, color: "#fff", padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>AUTO</span>
        {value || "—"}
      </div>
    </div>
  );
}

// ─── PATIENT SEARCH (with live API) ───────────────────────────────────────────
function PatientSearch({ onSelect, selected, onLoadingChange, authToken }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [allResidents, setAllResidents] = useState([]);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load all residents on component mount
  useEffect(() => {
    const loadAllResidents = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          '/api/v1/admin/residents?limit=100',
          {
            headers: {
              'Content-Type': 'application/json',
              ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
            },
            credentials: 'include'
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to load residents (${response.status})`);
        }

        const data = await response.json();
        // Defensive: dedupe by id in case the API returns duplicates.
        const unique = Array.from(
          new Map((data.data || []).map((r) => [r.id, r])).values()
        );
        setAllResidents(unique);
      } catch (err) {
        setError('Failed to load residents');
        setAllResidents([]);
      } finally {
        setLoading(false);
      }
    };

    loadAllResidents();
  }, [authToken]);

  // Filter residents locally based on query
  const filterResidents = (searchTerm) => {
    if (!searchTerm || searchTerm.trim() === '') {
      return allResidents;
    }

    const lowerQuery = searchTerm.toLowerCase();
    return allResidents.filter(resident => {
      const fullName = `${resident.first_name || ''} ${resident.last_name || ''}`.toLowerCase();
      const diagnosis = (resident.primary_diagnosis || '').toLowerCase();
      const medicaidId = (resident.medicaid_id || '').toLowerCase();

      return (
        fullName.includes(lowerQuery) ||
        diagnosis.includes(lowerQuery) ||
        medicaidId.includes(lowerQuery)
      );
    });
  };

  const handleQueryChange = (value) => {
    setQuery(value);
    setOpen(true);
    if (selected) onSelect(null);
    setResults(filterResidents(value));
  };

  const handleInputFocus = () => {
    setOpen(true);
    setResults(filterResidents(query));
  };

  const formatName = (resident) => {
    return `${resident.first_name || ''} ${resident.last_name || ''}`.trim();
  };

  return (
    <div style={{ position: "relative" }}>
      <div style={{ ...lbl, marginBottom: 6 }}>Search & Select Admitted Resident</div>
      <div style={{ display: "flex", gap: 10 }}>
        <input
          value={selected ? formatName(selected) : query}
          onChange={e => handleQueryChange(e.target.value)}
          onFocus={handleInputFocus}
          placeholder="Type name or Medicaid ID to search..."
          style={{ ...inp, flex: 1 }}
          disabled={selected}
        />
        {selected && (
          <button onClick={() => { onSelect(null); setQuery(""); }} style={{ padding: "0 14px", background: C.redBg, border: `1px solid #fca5a5`, borderRadius: 7, color: C.red, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>✕ Clear</button>
        )}
      </div>

      {open && !selected && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: C.white, border: `1px solid ${C.blueBorder}`, borderRadius: 8, zIndex: 50, maxHeight: 320, overflowY: "auto", boxShadow: "0 8px 24px rgba(15,45,94,0.15)", marginTop: 4 }}>
          {error ? (
            <div style={{ padding: "16px", fontSize: 13, color: C.red, textAlign: "center" }}>{error}</div>
          ) : loading ? (
            <div style={{ padding: "16px", fontSize: 13, color: C.muted, textAlign: "center" }}>Loading residents...</div>
          ) : allResidents.length === 0 ? (
            <div style={{ padding: "16px", fontSize: 13, color: C.muted, textAlign: "center" }}>No residents available</div>
          ) : results.length === 0 ? (
            <div style={{ padding: "16px", fontSize: 13, color: C.muted, textAlign: "center" }}>
              {query.trim() === "" ? "No residents loaded" : "No residents match your search"}
            </div>
          ) : results.map(r => (
            <div key={r.id} onClick={() => { onSelect(r); setOpen(false); setQuery(""); }}
              style={{ padding: "12px 16px", cursor: "pointer", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12 }}
              onMouseEnter={e => e.currentTarget.style.background = C.bluePale}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.bluePale, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: C.blue, flexShrink: 0 }}>
                {(r.first_name?.[0] || '?') + (r.last_name?.[0] || '?')}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{formatName(r)}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{r.primary_diagnosis || 'N/A'} · ID: {r.medicaid_id}</div>
              </div>
              <div style={{ fontSize: 11, background: C.greenBg, color: C.green, padding: "2px 7px", borderRadius: 4, fontWeight: 600 }}>
                {r.status === 'admitted' ? 'Admitted' : r.status === 'pending' ? 'Pending' : r.status}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div style={{ marginTop: 12, background: C.bluePale, border: `1px solid ${C.blueBorder}`, borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: "50%", background: C.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
            {(selected.first_name?.[0] || '?') + (selected.last_name?.[0] || '?')}
          </div>
          <div>
            <div style={{ fontWeight: 700, color: C.navy, fontSize: 14 }}>{formatName(selected)}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{selected.primary_diagnosis || 'N/A'} · Intake: {selected.intake_date?.split('T')[0]}</div>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 12, color: C.green, fontWeight: 600 }}>✓ Resident selected</div>
        </div>
      )}
    </div>
  );
}

// ─── STEP COMPONENTS ──────────────────────────────────────────────────────────
function Step1({ data, set, patient, setPatient, existingData, loadingExisting, authToken }) {
  const getFieldStatus = (fieldName) => {
    if (!existingData) return { hasData: false, value: null };
    return { hasData: !!existingData[fieldName], value: existingData[fieldName] };
  };

  return (
    <div>
      <InfoBox color={C.blue} bg={C.bluePale}>
        Select an admitted resident to auto-populate their demographic and clinical details. Only fields unique to this care plan will require manual entry.
      </InfoBox>

      <SH>Resident Selection</SH>
      <PatientSearch onSelect={setPatient} selected={patient} authToken={authToken} />

      {patient && (
        <>
          <SH>Auto-Populated Resident Details</SH>
          <Grid cols={3}>
            <AutoField label="Full Name" value={`${patient.first_name || ''} ${patient.last_name || ''}`.trim()} />
            <AutoField label="Medicaid ID" value={patient.medicaid_id} />
            <AutoField label="Primary Diagnosis" value={patient.primary_diagnosis} />
            <AutoField label="Date of Admission" value={patient.intake_date?.split('T')[0]} />
            <AutoField label="Status" value={patient.status} />
          </Grid>
        </>
      )}

      <SH>Plan Details</SH>
      <Grid cols={2}>
        <F label="Plan Type">
          <RG value={data.planType} onChange={v => set("planType", v)} options={[{value:"initial",label:"Initial Care Plan"},{value:"annual",label:"Annual Update"}]} />
        </F>
        <F label="Plan Effective Date">
          <TI type="date" value={data.effectiveDate} onChange={v => set("effectiveDate", v)} />
        </F>
        {data.planType === "annual" && (
          <>
            <F label="Most Recent Plan Date">
              <TI type="date" value={data.mostRecentPlanDate} onChange={v => set("mostRecentPlanDate", v)} />
            </F>
            <F label="Expiration Date of Most Recent Plan">
              <TI type="date" value={data.expirationDate} onChange={v => set("expirationDate", v)} />
            </F>
          </>
        )}
        <F label="Plan Review Date">
          <TI type="date" value={data.reviewDate} onChange={v => set("reviewDate", v)} />
        </F>
        <F label="Review Schedule">
          <RG value={data.reviewSchedule} onChange={v => set("reviewSchedule", v)} options={["Weekly","Bi-weekly","Monthly"]} />
        </F>
      </Grid>

      <SH>Legal / Authorized Representative</SH>
      {loadingExisting && <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>Loading existing care plan data...</div>}
      <Grid cols={3}>
        <F label="Representative Last Name">
          <TI value={data.repLastName} onChange={v => set("repLastName", v)} placeholder="Last name" readOnly={existingData?.rep_last_name ? true : false} />
        </F>
        <F label="First Name">
          <TI value={data.repFirstName} onChange={v => set("repFirstName", v)} placeholder="First name" readOnly={existingData?.rep_first_name ? true : false} />
        </F>
        <F label="Relation to Patient">
          <Sel value={data.repRelation} onChange={v => set("repRelation", v)} options={["Guardian","Parent","Spouse","Sibling","Attorney","Other"]} />
        </F>
        <F label="Primary Phone">
          <TI value={data.repPhone} onChange={v => set("repPhone", v)} placeholder="(503) 000-0000" readOnly={existingData?.rep_phone ? true : false} />
        </F>
        <F label="Email">
          <TI type="email" value={data.repEmail} onChange={v => set("repEmail", v)} placeholder="email@domain.com" readOnly={existingData?.rep_email ? true : false} />
        </F>
        <F label="Preferred Contact Method">
          <Sel value={data.repContactMethod} onChange={v => set("repContactMethod", v)} options={["Phone","Email","Text","Mail"]} />
        </F>
        <F label="Best Times to Contact">
          <TI value={data.repContactTimes} onChange={v => set("repContactTimes", v)} placeholder="e.g., Weekdays 9am–5pm" readOnly={existingData?.rep_contact_times ? true : false} />
        </F>
        <F label="Address">
          <TI value={data.repAddress} onChange={v => set("repAddress", v)} placeholder="Street address" readOnly={existingData?.rep_address ? true : false} />
        </F>
        <F label="City / State / ZIP">
          <TI value={data.repCityStateZip} onChange={v => set("repCityStateZip", v)} placeholder="Portland, OR 97201" readOnly={existingData?.rep_city_state_zip ? true : false} />
        </F>
      </Grid>
    </div>
  );
}

function Step2({ data, set, patient, existingData }) {
  return (
    <div>
      <InfoBox color={C.blue} bg={C.bluePale}>
        Record all members of the personal care planning team including mental health providers, residential staff, family supports, and service coordinators.
      </InfoBox>

      <SH>Mental Health Provider / CMHP</SH>
      <Grid cols={3}>
        <F label="Last Name"><TI value={data.cmhpLast} onChange={v => set("cmhpLast", v)} placeholder="Last name" readOnly={existingData?.cmhp_last ? true : false} /></F>
        <F label="First Name"><TI value={data.cmhpFirst} onChange={v => set("cmhpFirst", v)} placeholder="First name" readOnly={existingData?.cmhp_first ? true : false} /></F>
        <F label="Organization"><TI value={data.cmhpOrg} onChange={v => set("cmhpOrg", v)} placeholder="Agency name" readOnly={existingData?.cmhp_org ? true : false} /></F>
        <F label="Phone"><TI value={data.cmhpPhone} onChange={v => set("cmhpPhone", v)} placeholder="(503) 000-0000" readOnly={existingData?.cmhp_phone ? true : false} /></F>
        <F label="Email" span={2}><TI type="email" value={data.cmhpEmail} onChange={v => set("cmhpEmail", v)} placeholder="provider@org.com" readOnly={existingData?.cmhp_email ? true : false} /></F>
      </Grid>

      <SH>Residential Provider</SH>
      <Grid cols={3}>
        {patient && <F label="Organization (Auto)"><AutoField label="" value="Dependable Care Wellness Centre" /></F>}
        <F label="Provider Last Name"><TI value={data.resProvLast} onChange={v => set("resProvLast", v)} placeholder="Last name" readOnly={existingData?.res_prov_last ? true : false} /></F>
        <F label="First Name"><TI value={data.resProvFirst} onChange={v => set("resProvFirst", v)} placeholder="First name" readOnly={existingData?.res_prov_first ? true : false} /></F>
        <F label="Phone"><TI value={data.resProvPhone} onChange={v => set("resProvPhone", v)} placeholder="503-521-7264" readOnly={existingData?.res_prov_phone ? true : false} /></F>
        <F label="Email"><TI type="email" value={data.resProvEmail} onChange={v => set("resProvEmail", v)} placeholder="staff@facility.com" readOnly={existingData?.res_prov_email ? true : false} /></F>
      </Grid>

      <SH>Family / Natural Support</SH>
      <Grid cols={3}>
        <F label="Last Name"><TI value={data.familyLast} onChange={v => set("familyLast", v)} placeholder="Last name" /></F>
        <F label="First Name"><TI value={data.familyFirst} onChange={v => set("familyFirst", v)} placeholder="First name" /></F>
        <F label="Relationship"><TI value={data.familyRelation} onChange={v => set("familyRelation", v)} placeholder="e.g., Mother, Brother" /></F>
        <F label="Phone"><TI value={data.familyPhone} onChange={v => set("familyPhone", v)} placeholder="(503) 000-0000" /></F>
        <F label="Email"><TI type="email" value={data.familyEmail} onChange={v => set("familyEmail", v)} placeholder="email@domain.com" /></F>
        <F label="OK to Contact?"><RG value={data.familyOkContact} onChange={v => set("familyOkContact", v)} options={["Yes","No"]} /></F>
        <F label="ROI Sent Date"><TI type="date" value={data.familyRoiDate} onChange={v => set("familyRoiDate", v)} /></F>
      </Grid>

      <SH>Service Coordinators</SH>
      <Grid cols={2}>
        {[
          { prefix: "cco", label: "CCO Name", autoVal: patient?.ccoName },
          { prefix: "encc", label: "Choice/ENCC" },
          { prefix: "cmhpSvc", label: "CMHP Service Provider" },
          { prefix: "prsb", label: "PRSB / Other Legal Authority" },
        ].map(({ prefix, label, autoVal }) => (
          <div key={prefix} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
            {autoVal ? <AutoField label="Organization" value={autoVal} /> : <F label="Organization"><TI value={data[`${prefix}Org`]} onChange={v => set(`${prefix}Org`, v)} placeholder="Organization name" /></F>}
            <div style={{ marginTop: 10 }}>
              <Grid cols={2}>
                <F label="First Name"><TI value={data[`${prefix}First`]} onChange={v => set(`${prefix}First`, v)} placeholder="First" /></F>
                <F label="Last Name"><TI value={data[`${prefix}Last`]} onChange={v => set(`${prefix}Last`, v)} placeholder="Last" /></F>
                <F label="Phone"><TI value={data[`${prefix}Phone`]} onChange={v => set(`${prefix}Phone`, v)} placeholder="(503) 000-0000" /></F>
                <F label="ROI Date"><TI type="date" value={data[`${prefix}RoiDate`]} onChange={v => set(`${prefix}RoiDate`, v)} /></F>
              </Grid>
              <div style={{ marginTop: 10, display: "flex", gap: 20 }}>
                <RG label="OK to Contact?" value={data[`${prefix}OkContact`]} onChange={v => set(`${prefix}OkContact`, v)} options={["Yes","No"]} />
                <RG label="PCSP Team Member?" value={data[`${prefix}Pcsp`]} onChange={v => set(`${prefix}Pcsp`, v)} options={["Yes","No"]} />
              </div>
            </div>
          </div>
        ))}
      </Grid>

      <SH>ISP Team Members Present</SH>
      <F label="List all ISP team members present at planning meeting">
        <TA value={data.ispTeamMembers} onChange={v => set("ispTeamMembers", v)} placeholder="Names and roles of all team members present..." rows={3} />
      </F>
    </div>
  );
}

function Step3({ data, set, patient, existingData }) {
  const DOMAINS_LIST = ["Psychiatric","Medical/Health","Substance Use","Activities of Daily Living","Social/Relationships","Vocational/Educational","Legal/Risk Factors","Housing/Discharge Needs","CCO/OHP Connection"];
  const hasExistingDomains = existingData?.selected_domains && existingData.selected_domains.length > 0;

  return (
    <div>
      <SH>Life Domains Selection</SH>
      <InfoBox color={C.teal} bg={C.tealBg}>Select all life domains to be addressed in this care plan. Each selected domain should have corresponding goals in Step 4.</InfoBox>
      {hasExistingDomains && <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, fontStyle: "italic" }}>Existing domains are pre-selected from the previous care plan</div>}
      <div className="app-grid-collapse" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
        {LIFE_DOMAINS.map(d => {
          const checked = (data.selectedDomains || []).includes(d.id);
          return (
            <div key={d.id} onClick={() => {
              const cur = data.selectedDomains || [];
              set("selectedDomains", checked ? cur.filter(x => x !== d.id) : [...cur, d.id]);
            }} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
              background: checked ? "#e8f0fe" : C.white, border: `1.5px solid ${checked ? C.blue : C.border}`,
              borderRadius: 7, cursor: "pointer",
            }}>
              <span style={{ width: 20, height: 20, background: checked ? C.blue : C.white, border: `1.5px solid ${checked ? C.blue : C.blueBorder}`, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {checked && <span style={{ color: "#fff", fontSize: 11 }}>✓</span>}
              </span>
              <span style={{ fontSize: 12, color: C.text, fontWeight: checked ? 600 : 400 }}>{d.id}. {d.label}</span>
            </div>
          );
        })}
      </div>

      <SH>Core Assessment Summary</SH>
      <div style={{ display: "grid", gap: 14 }}>
        {DOMAINS_LIST.map(domain => (
          <div key={domain} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>{domain}</div>
            <Grid cols={3}>
              <F label="Strengths"><TA value={data[`${domain}_strengths`]} onChange={v => set(`${domain}_strengths`, v)} placeholder="Client strengths in this domain..." rows={2} /></F>
              <F label="Needs / Challenges"><TA value={data[`${domain}_needs`]} onChange={v => set(`${domain}_needs`, v)} placeholder="Identified needs or challenges..." rows={2} /></F>
              <F label="Cultural / Linguistic Considerations"><TA value={data[`${domain}_cultural`]} onChange={v => set(`${domain}_cultural`, v)} placeholder="Cultural factors to consider..." rows={2} /></F>
            </Grid>
          </div>
        ))}
      </div>

      <SH>Cultural Identity Information</SH>
      <Grid cols={2}>
        <F label="Tribal Affiliation / Connection"><TI value={data.tribalAffiliation} onChange={v => set("tribalAffiliation", v)} placeholder="Tribal nation or affiliation if applicable" /></F>
        <F label="Language Preference">{patient ? <AutoField label="" value={patient.name ? "English" : ""} /> : <TI value={data.languagePref} onChange={v => set("languagePref", v)} placeholder="Primary language" />}</F>
        <F label="Spiritual / Religious Identity"><TI value={data.spiritual} onChange={v => set("spiritual", v)} placeholder="Faith tradition, practices" /></F>
        <F label="Gender Identity / Sexual Orientation">{patient ? <AutoField label="" value={patient.pronouns} /> : <TI value={data.genderIdentity} onChange={v => set("genderIdentity", v)} placeholder="Self-identified" />}</F>
        <F label="Other Cultural Factors" span={2}><TA value={data.otherCultural} onChange={v => set("otherCultural", v)} placeholder="Any additional cultural considerations relevant to care planning..." rows={2} /></F>
      </Grid>
    </div>
  );
}

function GoalBlock({ goalNum, data, set }) {
  const prefix = `goal${goalNum}`;
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
      <div style={{ background: "#0f2d5e", padding: "12px 18px" }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>Goal {goalNum}</span>
      </div>
      <div style={{ padding: "16px 18px" }}>
        <F label={`Goal ${goalNum} Statement`}>
          <TA value={data[`${prefix}Statement`]} onChange={v => set(`${prefix}Statement`, v)} placeholder="Write the recovery goal in the client's own words where possible..." rows={2} />
        </F>
        {[1, 2].map(obj => (
          <div key={obj} style={{ marginTop: 16, background: "#f7f9fc", border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.blue, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Objective {obj}</div>
            <F label="Objective Statement">
              <TI value={data[`${prefix}Obj${obj}`]} onChange={v => set(`${prefix}Obj${obj}`, v)} placeholder={`Measurable objective ${obj}...`} />
            </F>
            <Grid cols={3}>
              <F label="Intervention">
                <TI value={data[`${prefix}Obj${obj}Intervention`]} onChange={v => set(`${prefix}Obj${obj}Intervention`, v)} placeholder="Specific intervention" />
              </F>
              <F label="Frequency">
                <Sel value={data[`${prefix}Obj${obj}Frequency`]} onChange={v => set(`${prefix}Obj${obj}Frequency`, v)} options={["Daily","3x/week","Weekly","Bi-weekly","Monthly","PRN","Other"]} />
              </F>
              <F label="Responsible Party">
                <Sel value={data[`${prefix}Obj${obj}Responsible`]} onChange={v => set(`${prefix}Obj${obj}Responsible`, v)} options={["Client","Primary Counselor","RN/Nursing","Case Manager","Caregiver","Family","Program Staff","All Staff"]} />
              </F>
              <F label="Progress Notes" span={3}>
                <TA value={data[`${prefix}Obj${obj}Progress`]} onChange={v => set(`${prefix}Obj${obj}Progress`, v)} placeholder="Progress notes toward this objective..." rows={2} />
              </F>
            </Grid>
          </div>
        ))}
      </div>
    </div>
  );
}

function Step4({ data, set, existingData, medications = [], loadingMeds = false }) {
  const hasExistingGoals = existingData?.goal1_statement || existingData?.goal2_statement || existingData?.goal3_statement;

  return (
    <div>
      <InfoBox color={C.blue} bg={C.bluePale}>Each goal should align with a life domain selected in the Core Assessment. Write goals collaboratively with the client. Minimum 2 objectives per goal.</InfoBox>
      {hasExistingGoals && <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, fontStyle: "italic" }}>Goals from previous care plan are below. Edit to update or keep as-is.</div>}
      <GoalBlock goalNum={1} data={data} set={set} />
      <GoalBlock goalNum={2} data={data} set={set} />
      <GoalBlock goalNum={3} data={data} set={set} />

      <SH>Medication Administration Schedule</SH>
      {loadingMeds ? (
        <div style={{ fontSize: 13, color: C.muted, padding: "12px 0" }}>Loading medications...</div>
      ) : (
        <MedicationScheduleMatrix
          medications={medications}
          schedule={data.medSchedule ?? {}}
          onScheduleChange={v => set("medSchedule", v)}
        />
      )}

      <SH>Day-to-Day Care Needs</SH>
      <div style={{ display: "grid", gap: 10 }}>
        {[
          ["Medication Management", "medMgmt", "Administration times, storage, refill process", "Medication Staff"],
          ["Physical Health", "physHealth", "PCP/Dental appointment details", "Case Manager"],
          ["Nutrition", "nutrition", "Dietary restrictions and preferences", "Program Staff"],
          ["Sleep Hygiene", "sleep", "Bedtime routine and sleep supports", "Night Staff"],
        ].map(([need, key, placeholder, resp]) => (
          <div className="app-grid-collapse" style={{ display: "grid", gridTemplateColumns: "160px 1fr 160px", gap: 10, background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", alignItems: "start" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{need}</div>
            <TA value={data[key]} onChange={v => set(key, v)} placeholder={placeholder} rows={2} />
            <div style={{ fontSize: 12, color: C.muted, paddingTop: 4 }}>{resp}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Step5({ data, set, existingData }) {
  const hasExistingSafety = existingData?.crisis_warning_signs || existingData?.suicide_protocol;

  return (
    <div>
      <InfoBox color={C.red} bg={C.redBg}>All safety protocols must be individualized. Reference Oregon-specific resources where applicable. This section is required per OAR 309-019.</InfoBox>
      {hasExistingSafety && <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, fontStyle: "italic" }}>Safety protocols from previous care plan are pre-populated. Review and update as needed.</div>}

      <SH>Crisis Plan</SH>
      <Grid cols={2}>
        <F label="Crisis Warning Signs">
          <TA value={data.crisisWarningSigns} onChange={v => set("crisisWarningSigns", v)} placeholder="Early warning signs that a crisis may be developing..." rows={3} />
        </F>
        <F label="Crisis Coping Strategies">
          <TA value={data.crisisCopingStrategies} onChange={v => set("crisisCopingStrategies", v)} placeholder="Strategies that help de-escalate the client..." rows={3} />
        </F>
        <F label="Crisis Contacts (Name / Phone)">
          <TA value={data.crisisContacts} onChange={v => set("crisisContacts", v)} placeholder="List crisis contacts and their numbers..." rows={2} />
        </F>
        <F label="Oregon-Specific Crisis Resources">
          <TA value={data.oregonCrisisResources} onChange={v => set("oregonCrisisResources", v)} placeholder="Project Respond, 988, Lines for Life 1-800-273-8255, local county line..." rows={2} />
        </F>
      </Grid>

      <SH>Risk Protocols</SH>
      <Grid cols={1}>
        {[
          ["Suicide Risk Protocol", "suicideProtocol", "Document specific protocol per facility policy and OAR requirements..."],
          ["Self-Harm Protocol", "selfHarmProtocol", "Document specific strategies, monitoring frequency, staff response..."],
          ["Aggression Protocol", "aggressionProtocol", "De-escalation techniques, safe room use, staff notification chain..."],
          ["AWOL/Elopement Prevention", "awolPrevention", "Strategies specific to this client's elopement risk factors..."],
          ["Contraband Policy", "contrabandPolicy", "Facility-specific procedures, search protocols, documentation..."],
        ].map(([label, key, placeholder]) => (
          <div key={key} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
            <TA value={data[key]} onChange={v => set(key, v)} placeholder={placeholder} rows={3} />
          </div>
        ))}
      </Grid>

      <SH>Oregon Mandatory Reporting</SH>
      <Grid cols={2}>
        <F label="Abuse / Neglect Reporting Protocol">
          <TA value={data.mandatoryReporting} onChange={v => set("mandatoryReporting", v)} placeholder="Document reporting procedures, contacts, timelines per OAR..." rows={3} />
        </F>
        <F label="Additional Safety Considerations">
          <TA value={data.additionalSafety} onChange={v => set("additionalSafety", v)} placeholder="Any additional safety considerations specific to this client..." rows={3} />
        </F>
      </Grid>
    </div>
  );
}

function Step6({ data, set, existingData }) {
  const hasExistingResources = existingData?.discharge_housing || existingData?.discharge_target_date;

  return (
    <div>
      {hasExistingResources && <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, fontStyle: "italic" }}>Discharge planning from previous care plan is pre-populated.</div>}
      <SH>Oregon-Specific Community Resources</SH>
      <Grid cols={2}>
        <F label="CCO / Care Organization">
          <TI value={data.communityCC0} onChange={v => set("communityCC0", v)} placeholder="CCO name" />
        </F>
        <F label="OHP Coverage Type">
          <Sel value={data.ohpCoverage} onChange={v => set("ohpCoverage", v)} options={["Full OHP Plus","OHP with Medicare","OHP Open Card","Uninsured","Private Insurance","Other"]} />
        </F>
        <F label="Peer Support Services">
          <TI value={data.peerSupport} onChange={v => set("peerSupport", v)} placeholder="Oregon Peer Delivered Services provider..." />
        </F>
        <F label="Vocational Rehabilitation">
          <TI value={data.vocRehab} onChange={v => set("vocRehab", v)} placeholder="Oregon Vocational Rehabilitation contact..." />
        </F>
        <F label="Housing Resources">
          <TI value={data.housingResources} onChange={v => set("housingResources", v)} placeholder="Local Coordinated Housing Agency, Section 8..." />
        </F>
        <F label="Other Community Resources">
          <TA value={data.otherResources} onChange={v => set("otherResources", v)} placeholder="Additional community resources being accessed..." rows={2} />
        </F>
      </Grid>

      <SH>Discharge Planning Goals</SH>
      <Grid cols={2}>
        <F label="Housing Type Preferred at Discharge">
          <Sel value={data.dischargeHousing} onChange={v => set("dischargeHousing", v)} options={["Independent Apartment","Family Home","Supported Housing","AFC Home","Group Home","Unknown/TBD"]} />
        </F>
        <F label="Income Source Needed">
          <Sel value={data.dischargeIncome} onChange={v => set("dischargeIncome", v)} options={["SSI","SSDI","Employment","Family Support","Other","Unknown/TBD"]} />
        </F>
        <F label="Natural Supports at Discharge">
          <TA value={data.dischargeNaturalSupports} onChange={v => set("dischargeNaturalSupports", v)} placeholder="Family, friends, community connections available post-discharge..." rows={2} />
        </F>
        <F label="Aftercare Providers">
          <TA value={data.dischargeAftercare} onChange={v => set("dischargeAftercare", v)} placeholder="Outpatient therapy, psychiatrist, case management contacts..." rows={2} />
        </F>
        <F label="Target Discharge Date">
          <TI type="date" value={data.dischargeTargetDate} onChange={v => set("dischargeTargetDate", v)} />
        </F>
        <F label="Discharge Readiness Indicators">
          <TA value={data.dischargeReadiness} onChange={v => set("dischargeReadiness", v)} placeholder="What needs to be in place before discharge is considered..." rows={2} />
        </F>
      </Grid>
    </div>
  );
}

function Step7({ data, set, patient, existingData, onPrint }) {
  const hasExistingLegalInfo = existingData?.guardianship || existingData?.advanced_directive;

  return (
    <div>
      {hasExistingLegalInfo && <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, fontStyle: "italic" }}>Legal information from previous care plan is pre-populated.</div>}
      <SH>Legal & Advocacy</SH>
      <Grid cols={2}>
        <F label="Guardianship / Representative Payee">
          <TI value={data.guardianship} onChange={v => set("guardianship", v)} placeholder="Name and role of guardian or rep payee if applicable" />
        </F>
        <F label="Advanced Directive for Mental Health">
          <RG value={data.advancedDirective} onChange={v => set("advancedDirective", v)} options={["Yes — On File","No","To Complete"]} />
        </F>
        <F label="Rights Notification Completed On">
          <TI type="date" value={data.rightsNotificationDate} onChange={v => set("rightsNotificationDate", v)} />
        </F>
        <F label="Consent to Release Information — On File For">
          <TI value={data.consentReleaseOnFile} onChange={v => set("consentReleaseOnFile", v)} placeholder="List parties covered by ROI..." />
        </F>
        <F label="Grievance Procedure Explained On">
          <TI type="date" value={data.grievanceExplainedDate} onChange={v => set("grievanceExplainedDate", v)} />
        </F>
      </Grid>

      <SH>Client / Resident Signature</SH>
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px 18px", marginBottom: 16 }}>
        {patient && <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>Client: <strong style={{ color: C.navy }}>{patient.name}</strong></div>}
        <Grid cols={2}>
          <F label="I participated in developing this plan and agree with its contents">
            <RG value={data.clientAgreement} onChange={v => set("clientAgreement", v)} options={["Yes","Yes — With Reservations","Unable to Participate"]} />
          </F>
          <F label="Client Signature (Type to Acknowledge)">
            <TI value={data.clientSignature} onChange={v => set("clientSignature", v)} placeholder="Type full name to sign..." />
          </F>
          <F label="Date">
            <TI type="date" value={data.clientSignDate} onChange={v => set("clientSignDate", v)} />
          </F>
        </Grid>
      </div>

      <SH>Guardian / Representative Signature</SH>
      <Grid cols={2}>
        <F label="Guardian / Representative Name">
          <TI value={data.guardianSignName} onChange={v => set("guardianSignName", v)} placeholder="Full name" />
        </F>
        <F label="Signature (Type to Acknowledge)">
          <TI value={data.guardianSignature} onChange={v => set("guardianSignature", v)} placeholder="Type full name to sign..." />
        </F>
        <F label="Date">
          <TI type="date" value={data.guardianSignDate} onChange={v => set("guardianSignDate", v)} />
        </F>
      </Grid>

      <SH>Clinical Team Signatures</SH>
      <Grid cols={2}>
        {[
          ["Primary Counselor", "counselor"],
          ["Program Director", "director"],
        ].map(([role, key]) => (
          <div key={key} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>{role}</div>
            {key === "counselor" && patient && <AutoField label="Name" value={patient.counselor} />}
            {key !== "counselor" && <F label="Name"><TI value={data[`${key}Name`]} onChange={v => set(`${key}Name`, v)} placeholder="Full name and credentials" /></F>}
            <div style={{ marginTop: 10 }}>
              <F label="Signature (Type to Acknowledge)">
                <TI value={data[`${key}Signature`]} onChange={v => set(`${key}Signature`, v)} placeholder="Type full name to sign..." />
              </F>
              <div style={{ marginTop: 8 }}>
                <F label="Date"><TI type="date" value={data[`${key}SignDate`]} onChange={v => set(`${key}SignDate`, v)} /></F>
              </div>
            </div>
          </div>
        ))}
      </Grid>

      <div style={{ marginTop: 24, background: C.bluePale, border: `1px solid ${C.blueBorder}`, borderRadius: 10, padding: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>Plan Review Schedule</div>
        <RG value={data.reviewScheduleFinal} onChange={v => set("reviewScheduleFinal", v)} options={["Weekly","Bi-weekly","Monthly (as required by OAR)"]} />
        <div style={{ marginTop: 12, fontSize: 12, color: C.muted, lineHeight: 1.8 }}>
          This care plan will be submitted for admin review. Once approved it will be linked to the resident record and become the active plan of care. All team members with signatures on file will receive a notification.
        </div>
      </div>

      {onPrint && (
        <div style={{ marginTop: 16 }}>
          <button onClick={onPrint} style={{ width: "100%", padding: "12px 16px", background: C.bluePale, border: `1.5px solid ${C.blue}`, borderRadius: 8, fontSize: 13, fontWeight: 600, color: C.blue, cursor: "pointer" }}>📄 Preview & Print Care Plan</button>
        </div>
      )}
    </div>
  );
}

// ─── PRINT UTILITY ────────────────────────────────────────────────────────────
function generatePrintableCarePlan(patient, formData) {
  const now = new Date();
  const printDate = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const printTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const allData = { ...formData[1], ...formData[2], ...formData[3], ...formData[4], ...formData[5], ...formData[6], ...formData[7] };

  const printHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Care Plan - ${patient?.name || 'Resident'}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; line-height: 1.6; color: #1e2d40; }
        @media print {
          body { margin: 0; padding: 0; background: white; }
          .page-break { page-break-after: always; }
          header, footer { page-break-inside: avoid; }
          .no-print { display: none; }
        }
        header { background: #0f2d5e; color: white; padding: 24px 28px; text-align: center; border-bottom: 3px solid #1a56db; margin-bottom: 24px; }
        header h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
        header p { font-size: 13px; opacity: 0.9; }
        .page-content { padding: 0 28px 24px; max-width: 900px; margin: 0 auto; }
        .section { margin-bottom: 28px; page-break-inside: avoid; }
        .section-header { background: #1a56db; color: white; padding: 12px 16px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 16px; border-radius: 4px; }
        .section-content { background: white; border: 1px solid #dde6f0; border-radius: 6px; padding: 16px; }
        .info-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 12px; }
        .info-row.full { grid-template-columns: 1fr; }
        .info-item { }
        .info-label { font-size: 11px; font-weight: 700; color: #0f2d5e; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
        .info-value { font-size: 13px; color: #1e2d40; }
        .info-value.empty { color: #6b7c93; font-style: italic; }
        .subsection { margin-top: 16px; padding-top: 16px; border-top: 1px solid #dde6f0; }
        .subsection-title { font-size: 12px; font-weight: 700; color: #0f2d5e; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
        .goal-block { background: #eef4ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 14px; margin-bottom: 12px; }
        .goal-title { font-size: 12px; font-weight: 700; color: #1a56db; margin-bottom: 8px; }
        .signature-block { border: 1px solid #dde6f0; border-radius: 6px; padding: 12px; margin-bottom: 12px; }
        .signature-line { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; margin-bottom: 8px; }
        .signature-line div { }
        .signature-line label { font-size: 11px; font-weight: 700; color: #0f2d5e; text-transform: uppercase; margin-bottom: 4px; display: block; }
        .signature-line span { font-size: 13px; color: #1e2d40; padding-bottom: 4px; border-bottom: 1px solid #1e2d40; min-height: 24px; display: block; }
        .footer { text-align: center; font-size: 11px; color: #6b7c93; margin-top: 32px; padding-top: 16px; border-top: 1px solid #dde6f0; }
        .resident-header { background: #ecfeff; border: 1px solid #06b6d4; border-radius: 6px; padding: 14px; margin-bottom: 20px; }
        .resident-header-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; }
        .resident-header-item label { font-size: 10px; font-weight: 700; color: #0f2d5e; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 3px; }
        .resident-header-item span { font-size: 12px; font-weight: 600; color: #0f2d5e; }
      </style>
    </head>
    <body>
      <header>
        <h1>Person-Centered Service Plan</h1>
        <p>Dependable Care Wellness Centre</p>
      </header>

      <div class="page-content">
        <!-- Resident Info Header -->
        <div class="resident-header">
          <div class="resident-header-grid">
            <div class="resident-header-item">
              <label>Resident Name</label>
              <span>${patient?.name || '—'}</span>
            </div>
            <div class="resident-header-item">
              <label>Medicaid ID</label>
              <span>${patient?.medicaid_id || '—'}</span>
            </div>
            <div class="resident-header-item">
              <label>Date of Birth</label>
              <span>${patient?.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : '—'}</span>
            </div>
            <div class="resident-header-item">
              <label>Primary Diagnosis</label>
              <span>${patient?.primary_diagnosis || '—'}</span>
            </div>
          </div>
        </div>

        <!-- Step 1: Plan Info -->
        <div class="section">
          <div class="section-header">1. Patient & Plan Info</div>
          <div class="section-content">
            <div class="info-row">
              <div class="info-item">
                <div class="info-label">Plan Type</div>
                <div class="info-value">${allData.planType || '—'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Effective Date</div>
                <div class="info-value">${allData.effectiveDate || '—'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Review Date</div>
                <div class="info-value">${allData.reviewDate || '—'}</div>
              </div>
            </div>
            <div class="info-row">
              <div class="info-item">
                <div class="info-label">Review Schedule</div>
                <div class="info-value">${allData.reviewSchedule || '—'}</div>
              </div>
            </div>
            ${allData.repLastName ? `
            <div class="subsection">
              <div class="subsection-title">Authorized Representative</div>
              <div class="info-row">
                <div class="info-item">
                  <div class="info-label">Name</div>
                  <div class="info-value">${allData.repFirstName} ${allData.repLastName}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Relation</div>
                  <div class="info-value">${allData.repRelation || '—'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Phone</div>
                  <div class="info-value">${allData.repPhone || '—'}</div>
                </div>
              </div>
            </div>
            ` : ''}
          </div>
        </div>

        <!-- Step 2: Care Planning Team -->
        <div class="section">
          <div class="section-header">2. Care Planning Team</div>
          <div class="section-content">
            ${allData.cmhpLast ? `
            <div class="subsection-title">Mental Health Provider / CMHP</div>
            <div class="info-row">
              <div class="info-item">
                <div class="info-label">Name</div>
                <div class="info-value">${allData.cmhpFirst} ${allData.cmhpLast}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Organization</div>
                <div class="info-value">${allData.cmhpOrg || '—'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Phone</div>
                <div class="info-value">${allData.cmhpPhone || '—'}</div>
              </div>
            </div>
            ` : ''}
            ${allData.resProvLast ? `
            <div class="subsection">
              <div class="subsection-title">Residential Provider</div>
              <div class="info-row">
                <div class="info-item">
                  <div class="info-label">Organization</div>
                  <div class="info-value">Dependable Care Wellness Centre</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Provider</div>
                  <div class="info-value">${allData.resProvFirst} ${allData.resProvLast}</div>
                </div>
              </div>
            </div>
            ` : ''}
          </div>
        </div>

        <!-- Step 3: Core Assessment -->
        <div class="section">
          <div class="section-header">3. Core Assessment</div>
          <div class="section-content">
            ${allData.selectedDomains && allData.selectedDomains.length > 0 ? `
            <div class="subsection-title">Life Domains</div>
            <div class="info-value">${allData.selectedDomains.join(', ')}</div>
            ` : ''}
            ${allData['Psychiatric_strengths'] ? `
            <div class="subsection">
              <div class="subsection-title">Psychiatric</div>
              <div class="info-row full">
                <div class="info-item">
                  <div class="info-label">Strengths</div>
                  <div class="info-value">${allData['Psychiatric_strengths'] || '—'}</div>
                </div>
              </div>
              <div class="info-row full">
                <div class="info-item">
                  <div class="info-label">Needs / Challenges</div>
                  <div class="info-value">${allData['Psychiatric_needs'] || '—'}</div>
                </div>
              </div>
            </div>
            ` : ''}
          </div>
        </div>

        <!-- Step 4: Goals -->
        <div class="section">
          <div class="section-header">4. Recovery Goals & Objectives</div>
          <div class="section-content">
            ${allData.goal1Statement ? `
            <div class="goal-block">
              <div class="goal-title">Goal 1</div>
              <div class="info-value">${allData.goal1Statement || '—'}</div>
              ${allData.goal1Obj1 ? `<div style="margin-top: 8px; font-size: 12px; color: #6b7c93;"><strong>Objective 1:</strong> ${allData.goal1Obj1}</div>` : ''}
              ${allData.goal1Obj2 ? `<div style="margin-top: 4px; font-size: 12px; color: #6b7c93;"><strong>Objective 2:</strong> ${allData.goal1Obj2}</div>` : ''}
            </div>
            ` : ''}
            ${allData.goal2Statement ? `
            <div class="goal-block">
              <div class="goal-title">Goal 2</div>
              <div class="info-value">${allData.goal2Statement || '—'}</div>
              ${allData.goal2Obj1 ? `<div style="margin-top: 8px; font-size: 12px; color: #6b7c93;"><strong>Objective 1:</strong> ${allData.goal2Obj1}</div>` : ''}
              ${allData.goal2Obj2 ? `<div style="margin-top: 4px; font-size: 12px; color: #6b7c93;"><strong>Objective 2:</strong> ${allData.goal2Obj2}</div>` : ''}
            </div>
            ` : ''}
            ${allData.goal3Statement ? `
            <div class="goal-block">
              <div class="goal-title">Goal 3</div>
              <div class="info-value">${allData.goal3Statement || '—'}</div>
              ${allData.goal3Obj1 ? `<div style="margin-top: 8px; font-size: 12px; color: #6b7c93;"><strong>Objective 1:</strong> ${allData.goal3Obj1}</div>` : ''}
              ${allData.goal3Obj2 ? `<div style="margin-top: 4px; font-size: 12px; color: #6b7c93;"><strong>Objective 2:</strong> ${allData.goal3Obj2}</div>` : ''}
            </div>
            ` : ''}
          </div>
        </div>

        <!-- Step 5: Safety -->
        <div class="section">
          <div class="section-header">5. Safety & Risk Plan</div>
          <div class="section-content">
            ${allData.crisisWarningSigns ? `
            <div class="subsection-title">Crisis Warning Signs</div>
            <div class="info-value">${allData.crisisWarningSigns || '—'}</div>
            ` : ''}
            ${allData.suicideProtocol ? `
            <div class="subsection">
              <div class="subsection-title">Suicide Risk Protocol</div>
              <div class="info-value">${allData.suicideProtocol || '—'}</div>
            </div>
            ` : ''}
          </div>
        </div>

        <!-- Step 6: Discharge Planning -->
        <div class="section">
          <div class="section-header">6. Community & Discharge Planning</div>
          <div class="section-content">
            <div class="info-row">
              <div class="info-item">
                <div class="info-label">Housing Type at Discharge</div>
                <div class="info-value">${allData.dischargeHousing || '—'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Target Discharge Date</div>
                <div class="info-value">${allData.dischargeTargetDate || '—'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Income Source Needed</div>
                <div class="info-value">${allData.dischargeIncome || '—'}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 7: Signatures -->
        <div class="section page-break">
          <div class="section-header">7. Legal & Signatures</div>
          <div class="section-content">
            <div class="subsection-title">Client / Resident Signature</div>
            <div class="signature-block">
              <div class="signature-line">
                <div>
                  <label>Client Name</label>
                  <span>${allData.clientSignature || '—'}</span>
                </div>
                <div>
                  <label>Date</label>
                  <span>${allData.clientSignDate || '—'}</span>
                </div>
              </div>
              <div style="font-size: 11px; color: #6b7c93;">Agreement: ${allData.clientAgreement || '—'}</div>
            </div>

            ${allData.guardianSignName ? `
            <div class="subsection">
              <div class="subsection-title">Guardian / Representative Signature</div>
              <div class="signature-block">
                <div class="signature-line">
                  <div>
                    <label>Guardian Name</label>
                    <span>${allData.guardianSignature || '—'}</span>
                  </div>
                  <div>
                    <label>Date</label>
                    <span>${allData.guardianSignDate || '—'}</span>
                  </div>
                </div>
              </div>
            </div>
            ` : ''}

            <div class="subsection">
              <div class="subsection-title">Clinical Team Signatures</div>
              ${allData.counselorSignature ? `
              <div class="signature-block">
                <div style="font-size: 12px; font-weight: 700; color: #0f2d5e; margin-bottom: 8px;">Primary Counselor</div>
                <div class="signature-line">
                  <div>
                    <label>Name / Signature</label>
                    <span>${allData.counselorSignature || '—'}</span>
                  </div>
                  <div>
                    <label>Date</label>
                    <span>${allData.counselorSignDate || '—'}</span>
                  </div>
                </div>
              </div>
              ` : ''}
              ${allData.directorSignature ? `
              <div class="signature-block">
                <div style="font-size: 12px; font-weight: 700; color: #0f2d5e; margin-bottom: 8px;">Program Director</div>
                <div class="signature-line">
                  <div>
                    <label>Name / Signature</label>
                    <span>${allData.directorSignature || '—'}</span>
                  </div>
                  <div>
                    <label>Date</label>
                    <span>${allData.directorSignDate || '—'}</span>
                  </div>
                </div>
              </div>
              ` : ''}
            </div>

            <div class="subsection">
              <div class="subsection-title">Plan Review Schedule</div>
              <div class="info-value">${allData.reviewScheduleFinal || '—'}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="footer">
        <p>Care Plan Document — Generated ${printDate} at ${printTime}</p>
        <p>Dependable Care Wellness Centre | Person-Centered Service Plan</p>
      </div>
    </body>
    </html>
  `;

  return printHTML;
}

// ─── VALIDATION ───────────────────────────────────────────────────────────────
function getRequiredFields(stepId) {
  const requirements = {
    1: ['planType', 'effectiveDate', 'reviewSchedule'],
    2: ['cmhpLast', 'cmhpOrg', 'ispTeamMembers'],
    3: ['selectedDomains'],
    4: ['goal1Statement', 'goal1Obj1', 'goal1Obj2'],
    5: ['crisisWarningSigns', 'crisisCopingStrategies', 'suicideProtocol'],
    6: ['dischargeHousing', 'dischargeTargetDate'],
    7: ['clientSignature', 'clientSignDate', 'directorSignature', 'directorSignDate'],
  };
  return requirements[stepId] || [];
}

function isStepComplete(data, stepId) {
  const required = getRequiredFields(stepId);
  return required.every(field => {
    const val = data[field];
    if (Array.isArray(val)) return val.length > 0;
    return val && String(val).trim() !== '';
  });
}

// ─── MAIN WIZARD CONTENT ──────────────────────────────────────────────────────
function CarePlanWizardContent({ onClose, auth }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // When opened as a standalone route (no onClose), close/submit returns the
  // user to the admin Care Plans section rather than the root (which redirects
  // unauthenticated users to /login).
  const handleClose = onClose ?? (() => router.push('/admin?view=care_plans'));

  // Declare all hooks FIRST (all useState and useEffect calls must be here)
  const isMobile = useIsMobile(768);
  const [stepNavOpen, setStepNavOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [patient, setPatient] = useState(null);
  const [formData, setFormData] = useState(Object.fromEntries(WIZARD_STEPS.map(s => [s.id, {}])));
  const [completedSteps, setCompletedSteps] = useState([]);
  const [existingData, setExistingData] = useState(null);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [error, setError] = useState(null);
  const [editPlanId, setEditPlanId] = useState(null);
  const [editingPlan, setEditingPlan] = useState(false);
  const [medications, setMedications] = useState([]);
  const [loadingMeds, setLoadingMeds] = useState(false);

  // Load existing plan for editing if planId query param is provided
  useEffect(() => {
    const planId = searchParams.get('planId');
    if (!planId || !auth?.accessToken) return;

    setEditPlanId(planId);
    setEditingPlan(true);
    setLoadingExisting(true);
    setError(null);

    const loadPlanForEdit = async () => {
      try {
        const response = await fetch(`/api/v1/care-plans/${planId}`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${auth.accessToken}`
          },
          credentials: 'include'
        });

        if (!response.ok) throw new Error('Failed to fetch care plan');

        const { data: plan } = await response.json();
        if (!plan) throw new Error('Plan not found');

        // Convert snake_case DB fields to camelCase and populate all 7 steps
        const convertKey = (snakeKey) => snakeKey.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

        const newFormData = Object.fromEntries(WIZARD_STEPS.map(s => [s.id, {}]));

        // Map all fields from plan to appropriate steps
        Object.entries(plan).forEach(([dbKey, value]) => {
          if (value === null || value === undefined) return;
          const camelKey = convertKey(dbKey);
          // Default: put everything in step 1, specific fields go to specific steps
          let targetStep = 1;
          if (dbKey.startsWith('cmhp_') || dbKey.startsWith('res_prov_') || dbKey.startsWith('family_') ||
              dbKey.startsWith('cco_') || dbKey.startsWith('encc_') || dbKey.startsWith('cmhp_svc_') ||
              dbKey.startsWith('prsb_') || dbKey === 'isp_team_members') targetStep = 2;
          else if (dbKey.startsWith('psychiatric_') || dbKey.startsWith('medical_') || dbKey.startsWith('substance_') ||
                   dbKey.startsWith('adl_') || dbKey.startsWith('social_') || dbKey.startsWith('vocational_') ||
                   dbKey.startsWith('legal_') || dbKey.startsWith('housing_') || dbKey.startsWith('cco_ohp_') ||
                   dbKey === 'selected_domains' || dbKey === 'tribal_affiliation' || dbKey === 'language_pref' ||
                   dbKey === 'spiritual' || dbKey === 'gender_identity' || dbKey === 'other_cultural') targetStep = 3;
          else if (dbKey.startsWith('goal') || dbKey === 'med_mgmt' || dbKey === 'phys_health' ||
                   dbKey === 'nutrition' || dbKey === 'sleep') targetStep = 4;
          else if (dbKey.startsWith('crisis_') || dbKey.startsWith('suicide_') || dbKey.startsWith('self_harm_') ||
                   dbKey.startsWith('aggression_') || dbKey === 'awol_prevention' || dbKey === 'contraband_policy' ||
                   dbKey === 'mandatory_reporting' || dbKey === 'additional_safety') targetStep = 5;
          else if (dbKey.startsWith('community_') || dbKey.startsWith('discharge_') || dbKey === 'ohp_coverage' ||
                   dbKey === 'peer_support' || dbKey === 'voc_rehab' || dbKey === 'housing_resources' ||
                   dbKey === 'other_resources') targetStep = 6;
          else if (dbKey.startsWith('guardianship') || dbKey.startsWith('advanced_') || dbKey.startsWith('rights_') ||
                   dbKey.startsWith('consent_') || dbKey.startsWith('grievance_') || dbKey.startsWith('client_') ||
                   dbKey.startsWith('guardian_') || dbKey.startsWith('director_') || dbKey === 'review_schedule_final') targetStep = 7;

          newFormData[targetStep] = { ...newFormData[targetStep], [camelKey]: value };
        });

        setFormData(newFormData);
        setExistingData(plan);
        setPatient({
          id: plan.resident_id,
          first_name: plan.first_name,
          last_name: plan.last_name,
          primary_diagnosis: plan.primary_diagnosis
        });

        // Mark all steps as completed since we're editing
        setCompletedSteps([1, 2, 3, 4, 5, 6, 7]);
      } catch (err) {
        setError('Could not load care plan for editing');
      } finally {
        setLoadingExisting(false);
      }
    };

    loadPlanForEdit();
  }, [searchParams, auth]);

  // Auto-populate resident when ?residentId=<uuid> is passed in the URL.
  // Lets other pages (resident profile, admin route) deep-link to a new
  // care plan with the patient already selected.
  useEffect(() => {
    const residentId = searchParams.get('residentId');
    if (!residentId || !auth?.accessToken) return;
    // If we're editing an existing plan, the planId effect above wins.
    if (searchParams.get('planId')) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/admin/residents?limit=200`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${auth.accessToken}`,
          },
          credentials: 'include',
        });
        if (!res.ok) return;
        const { data } = await res.json();
        const match = (data || []).find((r) => r.id === residentId);
        if (match && !cancelled) setPatient(match);
      } catch { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
  }, [searchParams, auth]);

  // Fetch existing care plan data when patient is selected (for new plans)
  useEffect(() => {
    if (editingPlan || !patient?.id) {
      setExistingData(null);
      return;
    }

    const loadExistingData = async () => {
      setLoadingExisting(true);
      setError(null);
      try {
        const response = await fetch(`/api/v1/residents/${patient.id}/care-plans`, {
          headers: {
            'Content-Type': 'application/json',
            ...(auth?.accessToken ? { 'Authorization': `Bearer ${auth.accessToken}` } : {})
          },
          credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to fetch care plans');

        const data = await response.json();
        if (data.data && data.data.length > 0) {
          const latestPlan = data.data[0]; // Most recent plan (ordered DESC)
          setExistingData(latestPlan);

          // Pre-populate form data with existing care plan
          const preFilledData = { ...formData };
          Object.keys(latestPlan).forEach(key => {
            if (latestPlan[key] !== null && latestPlan[key] !== undefined) {
              preFilledData[1] = { ...preFilledData[1], [key]: latestPlan[key] };
            }
          });
          setFormData(preFilledData);
        } else {
          setExistingData(null);
        }
      } catch (err) {
        setError('Could not load existing care plan data');
      } finally {
        setLoadingExisting(false);
      }
    };

    loadExistingData();
  }, [patient?.id, editingPlan]);

  // Fetch medications for the selected resident
  useEffect(() => {
    if (!patient?.id || !auth?.accessToken) {
      setMedications([]);
      return;
    }

    const fetchMedications = async () => {
      setLoadingMeds(true);
      try {
        const res = await fetch(`/api/v1/medications?resident_id=${patient.id}&active=true&limit=100`, {
          headers: { 'Authorization': `Bearer ${auth.accessToken}` },
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to load medications');
        const { data } = await res.json();
        setMedications(data ?? []);
      } catch (err) {
        setMedications([]);
      } finally {
        setLoadingMeds(false);
      }
    };

    fetchMedications();
  }, [patient?.id, auth?.accessToken]);

  const set = useCallback((stepId) => (key, val) => {
    setFormData(prev => ({ ...prev, [stepId]: { ...prev[stepId], [key]: val } }));
    setSaved(false);
  }, []);

  const handleSaveDraft = useCallback(async () => {
    if (!patient?.id) return;
    setSaving(true);
    try {
      const response = await fetch('/api/v1/care-plans-wizard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(auth?.accessToken ? { 'Authorization': `Bearer ${auth.accessToken}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify({
          resident_id: patient.id,
          step,
          data: formData[step],
        }),
      });
      if (response.ok) {
        setCompletedSteps(prev => [...new Set([...prev, step])]);
        setSaved(true);
      }
    } catch (error) {
    } finally {
      setSaving(false);
    }
  }, [patient, step, formData]);

  const canAccessStep = (stepNum) => stepNum === 1 || completedSteps.includes(stepNum - 1);
  const stepComplete = isStepComplete(formData[step], step);
  const d = formData[step];
  const s = set(step);

  const handleAdvanceStep = async () => {
    if (!stepComplete) return;
    await handleSaveDraft();
    setStep(s => Math.min(s + 1, WIZARD_STEPS.length));
  };

  const handlePrintCarePlan = useCallback(() => {
    const printHTML = generatePrintableCarePlan(patient, formData);
    const printWindow = window.open('', '_blank', 'width=960,height=1200');
    if (printWindow) {
      printWindow.document.write(printHTML);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 250);
    }
  }, [patient, formData]);

  const handleSubmitCarePlan = useCallback(async () => {
    if (!patient?.id) return;
    setSaving(true);
    try {
      // Save the final step
      await handleSaveDraft();

      // Submit the care plan (POST for new, PATCH for edit)
      const isEditMode = !!editPlanId;
      const submitResponse = await fetch('/api/v1/care-plans-wizard', {
        method: isEditMode ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(auth?.accessToken ? { 'Authorization': `Bearer ${auth.accessToken}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify(
          isEditMode
            ? { care_plan_id: editPlanId, step: 7, data: formData[7], status: 'submitted' }
            : { resident_id: patient.id, step: 7, data: formData[7], status: 'submitted' }
        ),
      });

      if (!submitResponse.ok) {
        throw new Error('Failed to submit care plan');
      }

      // Care plan is saved at this point — surface success and schedule the
      // return to the Care Plans section regardless of the notification result.
      setSaved(true);
      setTimeout(() => handleClose(), 2000);

      // Create notification (best-effort; failure must not block the redirect).
      const patientName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
      await fetch('/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(auth?.accessToken ? { 'Authorization': `Bearer ${auth.accessToken}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify({
          type: 'care_plan_submitted',
          resident_id: patient.id,
          title: `Care Plan ${isEditMode ? 'Updated' : 'Submitted'} for ${patientName}`,
          body: `Care plan for ${patientName} has been ${isEditMode ? 'updated' : 'submitted'} on ${new Date().toLocaleDateString()} and is pending admin review.`,
          action_url: `/residents/${patient.id}`,
        }),
      }).catch(() => {});
    } catch (error) {
      setError('Failed to submit care plan. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [patient, formData, auth, handleSaveDraft, handleClose, editPlanId]);

  const pages = {
    1: <Step1 data={d} set={s} patient={patient} setPatient={setPatient} existingData={existingData} loadingExisting={loadingExisting} authToken={auth?.accessToken} />,
    2: <Step2 data={d} set={s} patient={patient} existingData={existingData} />,
    3: <Step3 data={d} set={s} patient={patient} existingData={existingData} />,
    4: <Step4 data={d} set={s} existingData={existingData} medications={medications} loadingMeds={loadingMeds} />,
    5: <Step5 data={d} set={s} existingData={existingData} />,
    6: <Step6 data={d} set={s} existingData={existingData} />,
    7: <Step7 data={d} set={s} patient={patient} existingData={existingData} onPrint={handlePrintCarePlan} />,
  };

  return (
    <div style={{ position: "fixed", inset: "52px 0 0 0", background: "rgba(15,45,94,0.6)", display: "flex", alignItems: "stretch", zIndex: 200, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* Mobile backdrop for the step drawer */}
      {isMobile && stepNavOpen && (
        <div onClick={() => setStepNavOpen(false)} style={{ position: "fixed", inset: "52px 0 0 0", background: "rgba(8,16,30,0.5)", zIndex: 210 }} />
      )}
      {/* Sidebar — inline column on desktop, off-canvas drawer on mobile */}
      <div style={{
        width: 230, background: C.navy, display: "flex", flexDirection: "column", flexShrink: 0,
        ...(isMobile ? {
          position: "fixed", top: 52, left: 0, bottom: 0, zIndex: 220,
          transform: stepNavOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease", boxShadow: "4px 0 28px rgba(0,0,0,0.3)",
        } : {}),
      }}>
        <div style={{ padding: "20px 18px 16px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{editingPlan ? 'Edit Care Plan' : 'New Care Plan'}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Person-Centered Service Plan</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>Dependable Care Wellness Centre</div>
        </div>

        {patient && (
          <div style={{ margin: "10px 10px 0", background: "rgba(26,86,219,0.2)", border: "1px solid rgba(26,86,219,0.35)", borderRadius: 7, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#93c5fd", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Selected Patient</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{patient.name}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{patient.diagnosis}</div>
          </div>
        )}

        <div style={{ flex: 1, padding: "14px 10px", overflowY: "auto" }}>
          {WIZARD_STEPS.map(ws => {
            const done = completedSteps.includes(ws.id), active = ws.id === step, canAccess = canAccessStep(ws.id);
            return (
              <button key={ws.id} onClick={() => { if (canAccess) { setStep(ws.id); setStepNavOpen(false); } }} disabled={!canAccess} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px", background: active ? "rgba(255,255,255,0.1)" : "transparent",
                border: "none", borderRadius: 7, cursor: canAccess ? "pointer" : "not-allowed", marginBottom: 3,
                borderLeft: active ? "3px solid #60a5fa" : "3px solid transparent",
                color: active ? "#bfdbfe" : done ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.3)",
                opacity: canAccess ? 1 : 0.5,
              }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, background: done ? C.green : active ? C.blue : "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: done ? 11 : 10, color: "#fff", fontWeight: 700 }}>
                  {done ? "✓" : canAccess ? ws.id : "🔒"}
                </span>
                <span style={{ fontSize: 12, fontWeight: active ? 700 : 400, textAlign: "left", lineHeight: 1.3 }}>{ws.short}</span>
              </button>
            );
          })}
        </div>

        {saved && (
          <div style={{ margin: "0 10px 10px", background: "rgba(10,124,78,0.25)", border: "1px solid rgba(10,124,78,0.4)", borderRadius: 7, padding: "9px 12px" }}>
            <div style={{ fontSize: 11, color: "#6ee7b7", fontWeight: 600 }}>✓ Draft Saved</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>Pending admin review</div>
          </div>
        )}

        <div style={{ padding: "12px 10px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <button onClick={handleSaveDraft} style={{ width: "100%", padding: "8px 0", background: "rgba(26,86,219,0.3)", border: "1px solid rgba(26,86,219,0.5)", borderRadius: 6, color: "#bfdbfe", fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 6 }}>Save Draft</button>
          <button onClick={handleClose} style={{ width: "100%", padding: "7px 0", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "rgba(255,255,255,0.35)", fontSize: 12, cursor: "pointer" }}>← Back to Dashboard</button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: isMobile ? "12px 14px" : "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <button type="button" onClick={() => setStepNavOpen(true)} aria-label="Open steps" className="app-show-mobile" style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, color: C.navy, alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: C.navy }}>{WIZARD_STEPS[step - 1].label}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Step {step} of {WIZARD_STEPS.length} · Care Plan · OAR 309-019</div>
            </div>
          </div>
          <div className="app-hide-mobile" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 180, height: 5, background: C.bluePale, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${(step / WIZARD_STEPS.length) * 100}%`, height: "100%", background: C.blue, borderRadius: 3, transition: "width 0.3s" }} />
            </div>
            <span style={{ fontSize: 12, color: C.muted, width: 36 }}>{Math.round((step / WIZARD_STEPS.length) * 100)}%</span>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px 14px" : "24px 32px" }}>
          {pages[step]}
        </div>

        {/* Footer */}
        <div style={{ background: C.white, borderTop: `1px solid ${C.border}`, padding: isMobile ? "12px 14px" : "14px 28px", display: "flex", flexDirection: "column", gap: 12, flexShrink: 0 }}>
          {saved && step === WIZARD_STEPS.length && (
            <div style={{ fontSize: 13, color: C.green, background: C.greenBg, border: `1px solid #86efac`, borderRadius: 6, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>✓</span>
              <div>
                <div style={{ fontWeight: 600 }}>Care Plan Submitted Successfully</div>
                <div style={{ fontSize: 12, marginTop: 2, opacity: 0.8 }}>Your care plan is now pending admin review. Redirecting...</div>
              </div>
            </div>
          )}
          {error && (
            <div style={{ fontSize: 13, color: C.red, background: C.redBg, border: `1px solid #fca5a5`, borderRadius: 6, padding: "10px 12px" }}>
              ⚠ {error}
            </div>
          )}
          {!stepComplete && (
            <div style={{ fontSize: 13, color: C.red, background: C.redBg, border: `1px solid #fca5a5`, borderRadius: 6, padding: "8px 12px" }}>
              ⚠ Complete all required fields to continue
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1} style={{ padding: "9px 22px", background: "transparent", border: `1px solid ${C.blueBorder}`, borderRadius: 7, fontSize: 13, fontWeight: 600, color: step === 1 ? C.muted : C.navy, cursor: step === 1 ? "not-allowed" : "pointer", opacity: step === 1 ? 0.4 : 1 }}>← Previous</button>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleSaveDraft} disabled={saving} style={{ padding: "9px 18px", background: C.bluePale, border: `1px solid ${C.blueBorder}`, borderRadius: 7, fontSize: 13, fontWeight: 600, color: C.blue, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "Saving..." : "Save Draft"}</button>
              {step < WIZARD_STEPS.length ? (
                <button onClick={handleAdvanceStep} disabled={!stepComplete || saving} style={{ padding: "9px 24px", background: stepComplete ? C.blue : C.muted, border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, color: "#fff", cursor: stepComplete && !saving ? "pointer" : "not-allowed", opacity: stepComplete ? 1 : 0.5 }}>{saving ? "Saving..." : "Save & Continue →"}</button>
              ) : (
                <button onClick={handleSubmitCarePlan} disabled={!stepComplete || saving} style={{ padding: "9px 24px", background: stepComplete ? C.green : C.muted, border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, color: "#fff", cursor: stepComplete && !saving ? "pointer" : "not-allowed", opacity: stepComplete ? 1 : 0.5 }}>{saving ? "Submitting..." : "Submit Care Plan ✓"}</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AUTH WRAPPER ──────────────────────────────────────────────────────────
function CarePlanWizard({ onClose }) {
  const router = useRouter();
  const { auth, loading } = useAuth();

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !auth) {
      router.push('/');
    }
  }, [auth, loading, router]);

  // Show loading while checking auth
  if (loading) {
    return (
      <div style={{ position: "fixed", inset: 0, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 14, color: C.muted, marginBottom: 12 }}>Loading...</div>
          <div style={{ width: 40, height: 40, borderRadius: "50%", border: `3px solid ${C.bluePale}`, borderTop: `3px solid ${C.blue}`, animation: "spin 0.6s linear infinite", margin: "0 auto" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // Don't render page if not authenticated
  if (!auth) {
    return null;
  }

  return <CarePlanWizardContent onClose={onClose} auth={auth} />;
}

export default function CarePlanPage() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>}>
      <CarePlanWizard />
    </Suspense>
  );
}