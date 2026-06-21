'use client';
import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { validateField, ValidationRules, getMissingFields, countCompletedFields, validateRuleSet, NURSING_RULES } from '@/lib/form-validation';
import ValidationGuide from '@/components/ValidationGuide';
import { bucketsFromBlob, STEP_BUCKETS_KEY } from '@/lib/admission-draft';
import { friendlyErrorMessage, formatApiError } from '@/app/lib/error-messages';
import FormCompletionModal from '@/components/FormCompletionModal';
import { generateAndDownloadPdf, generatePdfFilename, storeFormDataInSession } from '@/lib/pdf-downloader';
import { useIsMobile } from '@/lib/useIsMobile';

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  lilac:       "#f3effe",
  lilacMid:    "#e4d9fc",
  lilacBorder: "#c9b8f5",
  purple:      "#6c3fc5",
  purpleDark:  "#4a2a8a",
  purpleLight: "#8b5cf6",
  white:       "#ffffff",
  slate:       "#f8f7ff",
  text:        "#1e1538",
  textMuted:   "#6b5f8a",
  green:       "#0ea571",
  greenBg:     "#e6f9f1",
  amber:       "#d97706",
  amberBg:     "#fffbeb",
  red:         "#dc2626",
  redBg:       "#fef2f2",
  border:      "#e2d9f3",
  teal:        "#0891b2",
  tealBg:      "#ecfeff",
};

const STEPS = [
  { id: 1, label: "Demographics",           short: "Demographics",  icon: "◉" },
  { id: 2, label: "Vital Signs & Allergies",short: "Vitals",        icon: "♥" },
  { id: 3, label: "Review of Systems",      short: "Systems",       icon: "⬡" },
  { id: 4, label: "Pain, Sleep & Nutrition",short: "Pain/Sleep",    icon: "◈" },
  { id: 5, label: "Substance & Mental Status", short: "MH/SUD",    icon: "▦" },
  { id: 6, label: "Risk Assessments",       short: "Risks",         icon: "⚑" },
  { id: 7, label: "Suicide Risk",           short: "Suicide Risk",  icon: "◇" },
  { id: 8, label: "Summary & Sign-off",     short: "Summary",       icon: "✓" },
];

// ─── REQUIRED FIELD DEFINITIONS ────────────────────────────────────────────
const REQUIRED_FIELD_LABELS = {
  // Step 1
  name: 'Patient Full Name',
  dob: 'Date of Birth',
  age: 'Age',
  gender: 'Gender',
  pronouns: 'Preferred Pronouns',
  language: 'Preferred Language',
  emergencyName: 'Emergency Contact Name',
  emergencyPhone: 'Emergency Contact Phone',
  emergencyRelationship: 'Emergency Contact Relationship',
  reasonForAdmission: 'Reason for Admission',
  // Step 2
  temperature: 'Temperature',
  pulse: 'Pulse',
  respirations: 'Respirations',
  o2Sat: 'O₂ Saturation',
  height: 'Height',
  weightActual: 'Weight (Actual)',
  noKnownAllergies: 'Allergy Status',
  scalpInspected: 'Hair/Scalp Inspection',
  // Step 8
  narrativeSummary: 'Nursing Assessment Summary',
  rnName: 'RN Printed Name',
  staffNumber: 'Staff Number',
};

// Age is derived from date of birth — staff never type it manually.
function calcAge(dob) {
  if (!dob) return '';
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age >= 0 && age < 150 ? String(age) : '';
}

const STEP_REQUIRED_FIELDS = {
  1: ['name','dob','gender','pronouns','language','emergencyName','emergencyPhone','emergencyRelationship','reasonForAdmission'],
  2: ['temperature','pulse','respirations','o2Sat','height','weightActual','noKnownAllergies','scalpInspected'],
  3: ['fluVaxConsent'],
  4: ['painPresent','sleepHours','sleepMedication'],
  5: ['auditC1','auditC2','auditC3','loc','insight','judgment'],
  6: ['violenceHcw','restraintSexualAbuse','restraintPhysicalAbuse'],
  7: ['csrs1','csrs2','csrs3','csrs4','csrs5','csrs6'],
  8: ['narrativeSummary','rnName','staffNumber'],
};

// ─── REUSABLE FIELD COMPONENTS ────────────────────────────────────────────────
const inputStyle = {
  width: "100%", padding: "9px 12px", border: `1px solid ${C.lilacBorder}`,
  borderRadius: 7, fontSize: 13, background: C.white, color: C.text,
  outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};
const labelStyle = {
  display: "block", fontSize: 12, fontWeight: 600, color: C.purpleDark,
  marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em",
};
const sectionHeadStyle = {
  fontSize: 13, fontWeight: 700, color: C.purple, textTransform: "uppercase",
  letterSpacing: "0.08em", borderBottom: `2px solid ${C.lilacBorder}`,
  paddingBottom: 7, marginBottom: 16, marginTop: 24,
};

function Field({ label, children, span = 1, required = false, error = null, hasError = false }) {
  return (
    <div style={{ gridColumn: `span ${span}` }}>
      {label && (
        <label style={{ ...labelStyle, color: hasError ? C.red : C.purpleDark }}>
          {label}
          {required && <span style={{ color: C.red, marginLeft: 4 }}>*</span>}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        {children}
        {error && <div style={{ fontSize: 12, color: C.red, marginTop: 4, fontWeight: 500 }}>{error}</div>}
      </div>
    </div>
  );
}
function TextInput({ value, onChange, placeholder, type = "text", readOnly = false, hasError = false }) {
  return (
    <input
      readOnly={readOnly}
      type={type}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        ...inputStyle,
        borderColor: hasError ? C.red : C.lilacBorder,
        borderWidth: hasError ? '1.5px' : '1px',
        backgroundColor: readOnly ? C.slate : (hasError ? 'rgba(220,38,38,0.03)' : C.white),
        color: readOnly ? C.textMuted : C.text,
        cursor: readOnly ? 'default' : 'text',
      }}
    />
  );
}
function SelectInput({ value, onChange, options, readOnly = false, hasError = false }) {
  return (
    <select
      disabled={readOnly}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      style={{
        ...inputStyle,
        appearance: "none",
        borderColor: hasError ? C.red : C.lilacBorder,
        borderWidth: hasError ? '1.5px' : '1px',
        backgroundColor: readOnly ? C.slate : (hasError ? 'rgba(220,38,38,0.03)' : C.white),
        color: readOnly ? C.textMuted : C.text,
        cursor: readOnly ? 'default' : 'pointer',
        opacity: readOnly ? 0.6 : 1,
      }}
    >
      <option value="">— Select —</option>
      {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
    </select>
  );
}
function TextArea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
    />
  );
}
function CheckGroup({ label, options, selected = [], onChange }) {
  const toggle = (v) => {
    if (selected.includes(v)) onChange(selected.filter(x => x !== v));
    else onChange([...selected, v]);
  };
  return (
    <div>
      {label && <div style={{ ...labelStyle, marginBottom: 8 }}>{label}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
        {options.map(o => {
          const val = o.value ?? o; const lbl = o.label ?? o;
          const checked = selected.includes(val);
          return (
            <label key={val} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.text, cursor: "pointer" }}>
              <span onClick={() => toggle(val)} style={{
                width: 16, height: 16, borderRadius: 3, border: `1.5px solid ${checked ? C.purple : C.lilacBorder}`,
                background: checked ? C.purple : C.white, display: "inline-flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0,
              }}>
                {checked && <span style={{ color: "#fff", fontSize: 10, lineHeight: 1 }}>✓</span>}
              </span>
              {lbl}
            </label>
          );
        })}
      </div>
    </div>
  );
}
function RadioGroup({ label, options, value, onChange, inline = true }) {
  return (
    <div>
      {label && <div style={{ ...labelStyle, marginBottom: 8 }}>{label}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: inline ? "6px 16px" : "6px 0", flexDirection: inline ? "row" : "column" }}>
        {options.map(o => {
          const val = o.value ?? o; const lbl = o.label ?? o;
          const checked = value === val;
          return (
            <label key={val} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.text, cursor: "pointer" }}>
              <span onClick={() => onChange(val)} style={{
                width: 16, height: 16, borderRadius: "50%", border: `1.5px solid ${checked ? C.purple : C.lilacBorder}`,
                background: checked ? C.purple : C.white, display: "inline-flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0,
              }}>
                {checked && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff", display: "block" }} />}
              </span>
              {lbl}
            </label>
          );
        })}
      </div>
    </div>
  );
}
function Grid({ cols = 2, children }) {
  return <div className="app-grid-collapse" style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "14px 18px" }}>{children}</div>;
}
function SectionHead({ children }) {
  return <div style={sectionHeadStyle}>{children}</div>;
}
function InfoBox({ color, bg, children }) {
  return <div style={{ background: bg, border: `1px solid ${color}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color, marginBottom: 16 }}>{children}</div>;
}

// ─── STEP COMPONENTS ──────────────────────────────────────────────────────────

function Step1({ data, set, errors = {}, preScreeningData = null }) {
  return (
    <div>
      <InfoBox color={C.purple} bg={C.lilac}>
        This section captures core demographic data that will become the resident&apos;s master record. All fields marked with <span style={{ color: C.red, fontWeight: 700 }}>*</span> are required.
      </InfoBox>

      {preScreeningData && (
        <div style={{
          background: C.lilac,
          border: `1px solid ${C.lilacBorder}`,
          borderRadius: 8,
          padding: '12px 14px',
          marginBottom: 20,
          fontSize: 12,
          color: C.purple,
          fontWeight: 500,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ color: C.purple, marginTop: 1, flexShrink: 0 }}>✓</span>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>From Pre-Screening (read-only)</div>
              <div style={{ fontSize: 11.5, color: C.textMuted, lineHeight: 1.5 }}>
                Identity information was captured in the pre-screening form. Fields below are locked and will be auto-filled where available. Complete any missing required fields.
              </div>
            </div>
          </div>
        </div>
      )}

      <SectionHead>Patient Identity</SectionHead>
      <Grid cols={2}>
        <Field label="Patient Full Name" span={2} required error={errors.name} hasError={!!errors.name}>
          <TextInput
            value={data.name}
            onChange={v => set("name", v)}
            placeholder="Last, First Middle"
            readOnly={preScreeningData?.full_name ? true : false}
            hasError={!!errors.name}
          />
        </Field>
        <Field label="Date of Birth" required error={errors.dob} hasError={!!errors.dob}>
          <TextInput
            type="date"
            value={data.dob}
            onChange={v => { set("dob", v); set("age", calcAge(v)); }}
            readOnly={preScreeningData?.date_of_birth ? true : false}
            hasError={!!errors.dob}
          />
        </Field>
        <Field label="Age">
          <TextInput type="text" value={calcAge(data.dob) || ""} readOnly placeholder="Auto-calculated from date of birth" />
        </Field>
        <Field label="Gender" required error={errors.gender} hasError={!!errors.gender}>
          <SelectInput value={data.gender} onChange={v => set("gender", v)} options={["Male","Female","Transgender","Non-binary","Prefer not to say"]} hasError={!!errors.gender} />
        </Field>
        <Field label="Preferred Name (if Transgender/Other)">
          <TextInput value={data.preferredName} onChange={v => set("preferredName", v)} placeholder="Preferred name" />
        </Field>
        <Field label="Preferred Pronouns" required error={errors.pronouns} hasError={!!errors.pronouns}>
          <SelectInput
            value={data.pronouns}
            onChange={v => set("pronouns", v)}
            options={["He/Him","She/Her","They/Them","Other"]}
            readOnly={preScreeningData?.pronouns ? true : false}
            hasError={!!errors.pronouns}
          />
        </Field>
        <Field label="Preferred Language" required error={errors.language} hasError={!!errors.language}>
          <SelectInput value={data.language} onChange={v => set("language", v)} options={["English","Spanish","Other"]} hasError={!!errors.language} />
        </Field>
        <Field label="Interpreter Needed?">
          <RadioGroup value={data.interpreterNeeded} onChange={v => set("interpreterNeeded", v)} options={["Yes","No"]} />
        </Field>
      </Grid>

      <SectionHead>Ethnicity & Race</SectionHead>
      <Grid cols={2}>
        <Field label="Primary Ethnicity">
          <RadioGroup value={data.ethnicity} onChange={v => set("ethnicity", v)} options={["Hispanic or Latino","Not Hispanic or Latino"]} />
        </Field>
        <Field label="Race (check all that apply)">
          <CheckGroup selected={data.race} onChange={v => set("race", v)} options={[
            "American Indian or Alaskan Native","Black or African American",
            "Native Hawaiian or Pacific Islander","Asian","White","Other"
          ]} />
        </Field>
      </Grid>

      <SectionHead>Method of Arrival & Source</SectionHead>
      <Grid cols={2}>
        <Field label="Method of Arrival">
          <RadioGroup value={data.arrivalMethod} onChange={v => set("arrivalMethod", v)}
            options={["Ambulatory","Stretcher","Wheelchair","Other"]} />
        </Field>
        <Field label="Source of Information">
          <CheckGroup selected={data.infoSource} onChange={v => set("infoSource", v)}
            options={["Patient","Parent/Legal Guardian","Spouse","Significant Other","Outside/Previous Medical Record","Other"]} />
        </Field>
      </Grid>

      <SectionHead>Spiritual & Cultural</SectionHead>
      <Grid cols={2}>
        <Field label="Any Spiritual/Religious/Cultural Practices Impacting Care?">
          <RadioGroup value={data.spiritualPractices} onChange={v => set("spiritualPractices", v)} options={["Yes","No"]} />
        </Field>
        {data.spiritualPractices === "Yes" && (
          <Field label="Please Explain">
            <TextInput value={data.spiritualDetails} onChange={v => set("spiritualDetails", v)} placeholder="Describe practices..." />
          </Field>
        )}
      </Grid>

      <SectionHead>Emergency Contact</SectionHead>
      <Grid cols={3}>
        <Field label="Contact Name" required error={errors.emergencyName} hasError={!!errors.emergencyName}>
          <TextInput value={data.emergencyName} onChange={v => set("emergencyName", v)} placeholder="Full name" hasError={!!errors.emergencyName} />
        </Field>
        <Field label="Phone Number" required error={errors.emergencyPhone} hasError={!!errors.emergencyPhone}>
          <TextInput value={data.emergencyPhone} onChange={v => set("emergencyPhone", v)} placeholder="(503) 000-0000" hasError={!!errors.emergencyPhone} />
        </Field>
        <Field label="Relationship" required error={errors.emergencyRelationship} hasError={!!errors.emergencyRelationship}>
          <SelectInput value={data.emergencyRelationship} onChange={v => set("emergencyRelationship", v)}
            options={["Spouse","Parent","Sibling","Child","Friend","Guardian","Other"]} hasError={!!errors.emergencyRelationship} />
        </Field>
      </Grid>

      <SectionHead>Reason for Admission</SectionHead>
      <Field label="Patient/Family Description (direct quotation)" required error={errors.reasonForAdmission} hasError={!!errors.reasonForAdmission} span={2}>
        <TextArea value={data.reasonForAdmission} onChange={v => set("reasonForAdmission", v)}
          placeholder="Quote from patient or family describing reason for seeking treatment..." rows={3} />
      </Field>
      <div style={{ marginTop: 14 }}>
        <Field label="History of Present Illness (onset, duration, precipitating events, stressors)">
          <TextArea value={data.presentIllnessHistory} onChange={v => set("presentIllnessHistory", v)}
            placeholder="Describe crisis events, duration of symptoms, psychological stressors..." rows={4} />
        </Field>
      </div>

      <SectionHead>Orientation Checklist</SectionHead>
      <CheckGroup label="Patient Orientation Completed Including:" selected={data.orientationItems} onChange={v => set("orientationItems", v)} options={[
        "Unit/Room","Unit Rules/Routines/Schedule","Handbook","Phone/Visitation",
        "ID Photo Taken","Policy on Personal Belongings","Patient Rights Info Provided",
        "Instructed to Report Safety Concerns to Staff"
      ]} />
    </div>
  );
}

function Step2({ data, set, errors = {} }) {
  return (
    <div>
      <SectionHead>Admitting Vital Signs</SectionHead>
      <Grid cols={4}>
        <Field label="Temperature (°F)" required error={errors.temperature} hasError={!!errors.temperature}>
          <TextInput value={data.temperature} onChange={v => set("temperature", v)} placeholder="98.6" hasError={!!errors.temperature} />
        </Field>
        <Field label="Pulse (bpm)" required error={errors.pulse} hasError={!!errors.pulse}>
          <TextInput value={data.pulse} onChange={v => set("pulse", v)} placeholder="72" hasError={!!errors.pulse} />
        </Field>
        <Field label="Respirations (/min)" required error={errors.respirations} hasError={!!errors.respirations}>
          <TextInput value={data.respirations} onChange={v => set("respirations", v)} placeholder="16" hasError={!!errors.respirations} />
        </Field>
        <Field label="O₂ Saturation (%)" required error={errors.o2Sat} hasError={!!errors.o2Sat}>
          <TextInput value={data.o2Sat} onChange={v => set("o2Sat", v)} placeholder="98" hasError={!!errors.o2Sat} />
        </Field>
        {/* FIX: Added BP fields that were being mapped but never collected */}
        <Field label="BP Systolic (mmHg)">
          <TextInput type="number" value={data.bpSystolic} onChange={v => set("bpSystolic", v)} placeholder="120" />
        </Field>
        <Field label="BP Diastolic (mmHg)">
          <TextInput type="number" value={data.bpDiastolic} onChange={v => set("bpDiastolic", v)} placeholder="80" />
        </Field>
        <Field label="Height" required error={errors.height} hasError={!!errors.height}>
          {/* FIX: Changed to a text field with explicit format hint; height is stored as a string */}
          <TextInput value={data.height} onChange={v => set("height", v)} placeholder={`e.g. 5'8"`} hasError={!!errors.height} />
        </Field>
        <Field label="Weight — Actual (lbs)" required error={errors.weightActual} hasError={!!errors.weightActual}>
          <TextInput type="number" value={data.weightActual} onChange={v => set("weightActual", v)} placeholder="165" hasError={!!errors.weightActual} />
        </Field>
        <Field label="Weight — Stated (if scale unavailable)">
          <TextInput type="number" value={data.weightStated} onChange={v => set("weightStated", v)} placeholder="165" />
        </Field>
        <Field label="BMI (calculated)">
          <div style={{ ...inputStyle, background: C.lilac, color: C.purple, fontWeight: 700 }}>
            {data.weightActual && data.height ? "Auto-calc on save" : "—"}
          </div>
        </Field>
      </Grid>

      <SectionHead>Allergies</SectionHead>
      <Field label="" required error={errors.noKnownAllergies} hasError={!!errors.noKnownAllergies}>
        <RadioGroup value={data.noKnownAllergies} onChange={v => set("noKnownAllergies", v)}
          options={[{value:"yes",label:"No Known Allergies"},{value:"no",label:"Allergies Present"}]} />
      </Field>
      {data.noKnownAllergies === "no" && (
        <div style={{ marginTop: 14 }}>
          <Grid cols={2}>
            {[["Medication(s)","allergyMedication"],["Food/Additives/Preservatives","allergyFood"],
              ["Environmental","allergyEnvironmental"],["Latex","allergyLatex"],["Other","allergyOther"]].map(([lbl, key]) => (
              <Field key={key} label={lbl}>
                <TextInput value={data[key]} onChange={v => set(key, v)} placeholder="Describe reaction..." />
              </Field>
            ))}
          </Grid>
        </div>
      )}

      <SectionHead>Skin Assessment</SectionHead>
      <Grid cols={2}>
        <Field label="Hair/Scalp Inspected?" required error={errors.scalpInspected} hasError={!!errors.scalpInspected}>
          <RadioGroup value={data.scalpInspected} onChange={v => set("scalpInspected", v)} options={["Yes","No"]} />
        </Field>
        {data.scalpInspected === "No" && (
          <Field label="If No, Reason">
            <TextInput value={data.scalpNotInspectedReason} onChange={v => set("scalpNotInspectedReason", v)} placeholder="Reason..." />
          </Field>
        )}
      </Grid>
      <div style={{ marginTop: 12 }}>
        <CheckGroup label="Skin Findings (check all present)" selected={data.skinFindings} onChange={v => set("skinFindings", v)} options={[
          {value:"pediculosis",label:"Pediculosis (Head Lice)"},
          {value:"scabies",label:"Scabies"},
          {value:"abrasion",label:"Abrasion (A)"},
          {value:"burn",label:"Burn (B)"},
          {value:"bruise",label:"Bruise (BR)"},
          {value:"decubiti",label:"Decubiti (D)"},
          {value:"laceration",label:"Laceration (L)"},
          {value:"rash",label:"Rash (R)"},
          {value:"scar",label:"Scar (S)"},
          {value:"skinTear",label:"Skin Tear (ST)"},
          {value:"tattoo",label:"Tattoo (T)"},
          {value:"blister",label:"Blister (BL)"},
          {value:"other",label:"Other"},
        ]} />
      </div>
      {data.skinFindings?.includes("other") && (
        <div style={{ marginTop: 12 }}>
          <Field label="Describe Other Skin Findings">
            <TextArea value={data.skinFindingsOther} onChange={v => set("skinFindingsOther", v)} placeholder="Describe..." rows={2} />
          </Field>
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <Field label="Staff #1 Printed Name">
          <TextInput value={data.skinStaff1} onChange={v => set("skinStaff1", v)} placeholder="Staff name" />
        </Field>
      </div>
    </div>
  );
}

function SystemRow({ label, stateKey, options, data, set }) {
  const deniesKey = stateKey + "_denies";
  return (
    <div style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 14, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.purpleDark }}>{label}</span>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textMuted, cursor: "pointer" }}>
          <span onClick={() => set(deniesKey, !data[deniesKey])} style={{
            width: 15, height: 15, borderRadius: 3,
            border: `1.5px solid ${data[deniesKey] ? C.purple : C.lilacBorder}`,
            background: data[deniesKey] ? C.purple : C.white,
            display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}>
            {data[deniesKey] && <span style={{ color: "#fff", fontSize: 9 }}>✓</span>}
          </span>
          Denies / None Reported
        </label>
      </div>
      {!data[deniesKey] && (
        <CheckGroup selected={data[stateKey] || []} onChange={v => set(stateKey, v)} options={options} />
      )}
    </div>
  );
}

function Step3({ data, set, errors = {} }) {
  return (
    <div>
      <InfoBox color={C.teal} bg={C.tealBg}>Review each body system. Check &quot;Denies / None Reported&quot; to skip, or select all applicable findings.</InfoBox>

      <SectionHead>Review of Systems</SectionHead>

      <SystemRow label="Neurological" stateKey="neuro" data={data} set={set} options={[
        "Tingling/Numbness","Tremors","Loss of Consciousness","Vertigo","Poor Coordination","Headaches",
        "CVA","Head Injury/Trauma","Parkinson's","Epilepsy","Seizure — Last Seizure Date:",
      ]} />
      <SystemRow label="Cardiovascular" stateKey="cardio" data={data} set={set} options={[
        "Irregular Heartbeat","Pacemaker","Palpitations","Surgeries","Hypertension","Hyperlipidemia",
        "Hypotension","Anti-coagulation Therapy","Chest Pain/MI History","CHF",
      ]} />
      <SystemRow label="Respiratory" stateKey="respiratory" data={data} set={set} options={[
        "Asthma","COPD/Emphysema","SOB/Labored Breathing","Dry Cough","Productive Cough",
        "Frequent/Severe Colds","Sleep Apnea","CPAP",
      ]} />
      <SystemRow label="Gastrointestinal/Endocrine" stateKey="gi" data={data} set={set} options={[
        "Nausea/Vomiting","Non-Insulin Dependent DM","Heartburn","Insulin Dependent DM",
        "Diarrhea","Hypoglycemia","Constipation","Hypothyroidism","Encopresis","Hyperthyroidism","Hepatitis",
      ]} />
      <SystemRow label="Renal" stateKey="renal" data={data} set={set} options={[
        "Dysuria/Burning","Blood in Urine","Urgency","UTI History","Oliguria","Renal Disease",
        "Urine Odor/Discoloration","Enuresis",
      ]} />
      <SystemRow label="Musculoskeletal" stateKey="musculo" data={data} set={set} options={[
        "Joint Pain/Swelling","Amputation","Fractures/Dislocation","Gout","Sprain","Scoliosis",
        "Edema","Impaired Mobility","Fibromyalgia",
      ]} />
      <SystemRow label="EENT (Eyes, Ears, Nose, Throat)" stateKey="eent" data={data} set={set} options={[
        "Impaired Vision - Right Eye","Impaired Vision - Left Eye","Eyeglasses","Hearing Loss - Right","Hearing Loss - Left",
        "Hearing Aids","Tinnitus","Rhinitis/Allergies","Sore Throat","Difficulty Swallowing",
        "Problem with Teeth","Problem with Gums",
      ]} />
      <SystemRow label="Skin Integrity" stateKey="skin" data={data} set={set} options={[
        "Dry","Warm","Intact","Good Turgor","Pediculosis","Scabies","Acne Vulgaris","Rash",
        "Limited Mobility Risk","Incontinence Risk","Dehydration Risk","Poor Nutritional Intake Risk",
      ]} />

      <SectionHead>Infectious Disease Screening</SectionHead>
      {[
        { label: "Tuberculosis", key: "tbSymptoms", symptoms: ["Cough","Fever/Chills/Night Sweats","Weight Loss >10lbs","Hemoptysis","Weakness","Fatigue"] },
        { label: "Hepatitis", key: "hepatitisSymptoms", symptoms: ["Jaundice","Orange Urine","Painful/Tender Abdomen","IV Drug User (past/current)","Hep A","Hep B","Hep C"] },
        { label: "HIV/AIDS", key: "hivSymptoms", symptoms: ["White Sores in Throat/Mouth","Blue/Purplish Spots on Skin","History of Prostitution","Multiple Sex Partners","IV Drug Use/Shared Needles"] },
        { label: "Influenza", key: "fluSymptoms", symptoms: ["Nausea/Vomiting","Headache","Runny Nose","Fever/Chills","Diarrhea","Sore Throat","Body Aches","Fatigue"] },
        { label: "MRSA", key: "mrsaSymptoms", symptoms: ["Skin Lesions/Draining Sores","Skin Warm to Touch","Skin Red/Swollen","Accompanied by Fever"] },
      ].map(({ label, key, symptoms }) => (
        <SystemRow key={key} label={label} stateKey={key} data={data} set={set} options={symptoms} />
      ))}

      <Grid cols={2}>
        <Field label="Flu Vaccination Consent">
          <RadioGroup value={data.fluVaxConsent} onChange={v => set("fluVaxConsent", v)}
            options={["Yes","No","Already Received This Season","N/A (May–Sept)"]} />
        </Field>
        <Field label="Medical/Surgical History Notes">
          <TextArea value={data.medSurgHistory} onChange={v => set("medSurgHistory", v)} placeholder="Recent labs, hospitalizations, surgical history..." rows={3} />
        </Field>
      </Grid>

      <SectionHead>Reproductive History</SectionHead>
      <Grid cols={2}>
        <Field label="Female — Select Applicable">
          <CheckGroup selected={data.reproFemale} onChange={v => set("reproFemale", v)}
            options={["Sexual Dysfunction","Sexual Activity","STD","Vaginal Discharge","Menstrual Problems","Pregnant"]} />
        </Field>
        <Field label="Male — Select Applicable">
          <CheckGroup selected={data.reproMale} onChange={v => set("reproMale", v)}
            options={["Sexual Dysfunction","Sexual Activity","STD","Penile Discharge","Prostate Issues"]} />
        </Field>
      </Grid>
    </div>
  );
}

function Step4({ data, set, errors = {} }) {
  return (
    <div>
      <SectionHead>Pain Assessment</SectionHead>
      <Field label="Current Report of Pain?" required error={errors.painPresent} hasError={!!errors.painPresent}>
        <RadioGroup value={data.painPresent} onChange={v => set("painPresent", v)} options={["Yes","No"]} />
      </Field>

      {data.painPresent === "Yes" && (
        <div style={{ marginTop: 14 }}>
          <Field label="Pain Scale (0 = No Pain → 10 = Unbearable)">
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
              <input type="range" min={0} max={10} step={1} value={data.painScale ?? 0}
                onChange={e => set("painScale", Number(e.target.value))}
                style={{ flex: 1, accentColor: C.purple }} />
              <span style={{ width: 40, textAlign: "center", fontSize: 20, fontWeight: 700,
                color: data.painScale >= 7 ? C.red : data.painScale >= 4 ? C.amber : C.green }}>
                {data.painScale ?? 0}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.textMuted, marginTop: 4 }}>
              <span>No Pain</span><span>Distressing</span><span>Unbearable</span>
            </div>
          </Field>
          <div style={{ marginTop: 14 }}>
            <Grid cols={2}>
              <Field label="Pain Location">
                <TextInput value={data.painLocation} onChange={v => set("painLocation", v)} placeholder="e.g., Lower back, right knee" />
              </Field>
              <Field label="Comfort Goal Score">
                <TextInput type="number" value={data.painComfortGoal} onChange={v => set("painComfortGoal", v)} placeholder="0–10" />
              </Field>
              <Field label="Onset">
                <RadioGroup value={data.painOnset} onChange={v => set("painOnset", v)} options={["Gradual","Sudden","Intermittent"]} />
              </Field>
              <Field label="Duration">
                <RadioGroup value={data.painDuration} onChange={v => set("painDuration", v)} options={["Acute","Chronic","Constant"]} />
              </Field>
            </Grid>
            <div style={{ marginTop: 12 }}>
              <CheckGroup label="Pain Description" selected={data.painDescription} onChange={v => set("painDescription", v)}
                options={["Aching","Burning","Cramping","Dull","Sharp","Stabbing","Throbbing","Other"]} />
            </div>
            <div style={{ marginTop: 12 }}>
              <CheckGroup label="What Helps Alleviate Pain?" selected={data.painRelief} onChange={v => set("painRelief", v)}
                options={["Apply Heat","Apply Cool","Resting","Elevation","Deep Breathing","Relaxation/Imagery","Medication","Other"]} />
            </div>
          </div>
        </div>
      )}

      <SectionHead>Sleep History</SectionHead>
      <Grid cols={2}>
        <Field label="Average Hours of Sleep per Night" required error={errors.sleepHours} hasError={!!errors.sleepHours}>
          <TextInput type="number" value={data.sleepHours} onChange={v => set("sleepHours", v)} placeholder="7" hasError={!!errors.sleepHours} />
        </Field>
        <Field label="Currently Taking Sleep Medication?" required error={errors.sleepMedication} hasError={!!errors.sleepMedication}>
          <RadioGroup value={data.sleepMedication} onChange={v => set("sleepMedication", v)} options={["Yes","No"]} />
        </Field>
        {data.sleepMedication === "Yes" && (
          <Field label="Specify Sleep Medications" span={2}>
            <TextInput value={data.sleepMedicationDetail} onChange={v => set("sleepMedicationDetail", v)} placeholder="Medication names and doses..." />
          </Field>
        )}
      </Grid>
      <div style={{ marginTop: 12 }}>
        <CheckGroup label="Sleep Pattern Past Week" selected={data.sleepPattern} onChange={v => set("sleepPattern", v)}
          options={["No Complaints","Difficulty Falling Asleep","Middle of Night Awakening","Early Morning Awakening","Other"]} />
      </div>

      <SectionHead>Sleep Apnea & CPAP</SectionHead>
      <Grid cols={2}>
        <Field label="Diagnosed with Sleep Apnea?">
          <RadioGroup value={data.sleepApnea} onChange={v => set("sleepApnea", v)} options={["Yes","No"]} />
        </Field>
        {data.sleepApnea === "Yes" && (
          <Field label="Uses CPAP?">
            <RadioGroup value={data.cpapUse} onChange={v => set("cpapUse", v)} options={["Yes","No"]} />
          </Field>
        )}
        {data.cpapUse === "Yes" && (
          <Field label="Brought CPAP Machine?">
            <RadioGroup value={data.cpapBrought} onChange={v => set("cpapBrought", v)} options={["Yes","No"]} />
          </Field>
        )}
      </Grid>

      <SectionHead>Tobacco Screening</SectionHead>
      <Field label="Tobacco Use Status">
        <RadioGroup value={data.tobaccoStatus} onChange={v => set("tobaccoStatus", v)}
          options={["Never","Current Everyday User","Current User (Not Every Day)","Former User"]} />
      </Field>
      {data.tobaccoStatus && data.tobaccoStatus !== "Never" && (
        <div style={{ marginTop: 12 }}>
          <CheckGroup label="Type of Product" selected={data.tobaccoType} onChange={v => set("tobaccoType", v)}
            options={["Cigarettes","Cigars","Pipe","Chewing Tobacco","E-cigarette/Vape","Other"]} />
        </div>
      )}

      <SectionHead>Nutritional Screen</SectionHead>
      <Grid cols={2}>
        <Field label="Special Diet?">
          <TextInput value={data.specialDiet} onChange={v => set("specialDiet", v)} placeholder="Describe if applicable" />
        </Field>
        <Field label="Food Allergies?">
          <TextInput value={data.foodAllergies} onChange={v => set("foodAllergies", v)} placeholder="List food allergies" />
        </Field>
        <Field label="Last Meal Consumed" span={2}>
          <TextInput value={data.lastMeal} onChange={v => set("lastMeal", v)} placeholder="What and when..." />
        </Field>
      </Grid>
      <div style={{ marginTop: 12 }}>
        <CheckGroup label="Nutritional Concerns (check all that apply)" selected={data.nutritionConcerns} onChange={v => set("nutritionConcerns", v)} options={[
          "Decreased Appetite/Poor PO Intake","Unintentional Weight Change (>10 lbs in 3 months)",
          "Eating Disorder Behaviors","Pressure Ulcer/Significant Skin Breakdown","Tube Feeding",
          "BMI >36","BMI <19","Hydration Status Impaired","Dental/Swallowing Problems","Pregnancy",
        ]} />
      </div>

      <SectionHead>Functional Assessment (ADLs)</SectionHead>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px 18px" }}>
        {[["Eating","adlEating"],["Bathing","adlBathing"],["Dressing/Grooming","adlDressing"],
          ["Toileting","adlToileting"],["Ambulation","adlAmbulation"],["Transferring","adlTransferring"]].map(([lbl, key]) => (
          <Field key={key} label={lbl}>
            <SelectInput value={data[key]} onChange={v => set(key, v)} options={["Independent","Assist","Total Assist"]} />
          </Field>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <CheckGroup label="Assistive Devices" selected={data.assistDevices} onChange={v => set("assistDevices", v)}
          options={["Wheelchair","Walker","Crutches","Cane","Other"]} />
      </div>

      <SectionHead>Learning Readiness</SectionHead>
      <Grid cols={2}>
        <Field label="Can Patient Read?">
          <RadioGroup value={data.canRead} onChange={v => set("canRead", v)} options={["Yes","No"]} />
        </Field>
        <Field label="Can Patient Write?">
          <RadioGroup value={data.canWrite} onChange={v => set("canWrite", v)} options={["Yes","No"]} />
        </Field>
        <Field label="Learning Challenges">
          <CheckGroup selected={data.learningChallenges} onChange={v => set("learningChallenges", v)}
            options={["N/A","Cognitive","Emotional","Poor Coping","Impaired Thought Process","Language Barrier","Sensory Impairment","Other"]} />
        </Field>
        <Field label="Learning Preferences">
          <CheckGroup selected={data.learningPreferences} onChange={v => set("learningPreferences", v)}
            options={["Written Information","Verbal Instruction","Demonstration","Video/Audio"]} />
        </Field>
      </Grid>
    </div>
  );
}

function Step5({ data, set, errors = {} }) {
  return (
    <div>
      <SectionHead>Substance Abuse Assessment (AUDIT-C)</SectionHead>
      <InfoBox color={C.amber} bg={C.amberBg}>Validated tool to identify hazardous drinking or active alcohol use disorders (© World Health Organization)</InfoBox>
      <Grid cols={1}>
        <Field label="How often do you have a drink containing alcohol?" required error={errors.auditC1} hasError={!!errors.auditC1}>
          <RadioGroup value={data.auditC1} onChange={v => set("auditC1", v)}
            options={[{value:"0",label:"Never (0 pts)"},{value:"1",label:"Monthly or less (1 pt)"},{value:"2",label:"2–4 times/month (2 pts)"},{value:"3",label:"2–3 times/week (3 pts)"},{value:"4",label:"4+ times/week (4 pts)"}]} />
        </Field>
        <Field label="How many drinks on a typical drinking day?" required error={errors.auditC2} hasError={!!errors.auditC2}>
          <RadioGroup value={data.auditC2} onChange={v => set("auditC2", v)}
            options={[{value:"0",label:"1 or 2 (0 pts)"},{value:"1",label:"3 or 4 (1 pt)"},{value:"2",label:"5 or 6 (2 pts)"},{value:"3",label:"7 to 9 (3 pts)"},{value:"4",label:"10 or more (4 pts)"}]} />
        </Field>
        <Field label="How often do you have 6 or more drinks on one occasion?" required error={errors.auditC3} hasError={!!errors.auditC3}>
          <RadioGroup value={data.auditC3} onChange={v => set("auditC3", v)}
            options={[{value:"0",label:"Never (0 pts)"},{value:"1",label:"Less than monthly (1 pt)"},{value:"2",label:"Monthly (2 pts)"},{value:"3",label:"Weekly (3 pts)"},{value:"4",label:"Daily or almost daily (4 pts)"}]} />
        </Field>
      </Grid>
      {(data.auditC1 || data.auditC2 || data.auditC3) && (
        <div style={{ background: C.lilac, border: `1px solid ${C.lilacBorder}`, borderRadius: 8, padding: "10px 16px", marginTop: 12 }}>
          <span style={{ fontSize: 13, color: C.purpleDark, fontWeight: 600 }}>
            AUDIT-C Total Score: {(Number(data.auditC1||0)+Number(data.auditC2||0)+Number(data.auditC3||0))} —&nbsp;
            {(Number(data.auditC1||0)+Number(data.auditC2||0)+Number(data.auditC3||0)) >= 4 ? "⚠ Positive Screen" : "Negative Screen"}
          </span>
        </div>
      )}

      <SectionHead>Substance Use History</SectionHead>
      <Grid cols={2}>
        <Field label="Used Substances in Past 12 Months?">
          <RadioGroup value={data.substanceUse12mo} onChange={v => set("substanceUse12mo", v)} options={["Yes","No"]} />
        </Field>
        <Field label="Longest Period of Sobriety">
          <TextInput value={data.sobrietyPeriod} onChange={v => set("sobrietyPeriod", v)} placeholder="e.g., 6 months" />
        </Field>
        <Field label="Family History of Substance Abuse?">
          <RadioGroup value={data.familySAHx} onChange={v => set("familySAHx", v)} options={["Yes","No"]} />
        </Field>
        <Field label="Attends Self-Help Group Meetings?">
          <CheckGroup selected={data.selfHelpGroups} onChange={v => set("selfHelpGroups", v)}
            options={["No","Alcoholics Anonymous","Narcotics Anonymous","Other"]} />
        </Field>
        <Field label="Why Seeking Treatment Now?" span={2}>
          <TextArea value={data.treatmentReason} onChange={v => set("treatmentReason", v)} placeholder="Patient's own words..." rows={2} />
        </Field>
        <Field label="Triggers for Use" span={2}>
          <TextInput value={data.useTriggers} onChange={v => set("useTriggers", v)} placeholder="Identified triggers..." />
        </Field>
        <Field label="Consequences of Use">
          <CheckGroup selected={data.useConsequences} onChange={v => set("useConsequences", v)}
            options={["Black Outs","Irritability","Legal","Job/School Problems","Relationship Problems","Other"]} />
        </Field>
        <Field label="History of Alcohol Detox?">
          <RadioGroup value={data.alcoholDetoxHx} onChange={v => set("alcoholDetoxHx", v)} options={["Yes","No"]} />
        </Field>
        <Field label="History of Alcohol-Related Seizures?">
          <RadioGroup value={data.alcoholSeizureHx} onChange={v => set("alcoholSeizureHx", v)} options={["Yes","No"]} />
        </Field>
      </Grid>

      <SectionHead>Mental Status Assessment</SectionHead>
      <Grid cols={2}>
        <Field label="Level of Consciousness" required error={errors.loc} hasError={!!errors.loc}>
          <RadioGroup value={data.loc} onChange={v => set("loc", v)} options={["Alert","Drowsy","Somnolent"]} />
        </Field>
        <Field label="Orientation">
          <CheckGroup selected={data.orientation} onChange={v => set("orientation", v)}
            options={["Person","Place","Time","Situation"]} />
        </Field>
        <Field label="Attention">
          <CheckGroup selected={data.attention} onChange={v => set("attention", v)}
            options={["Appropriate","Engaged","Distractible","Hyper-vigilant","Poor Focus","Preoccupied","Inattentive"]} />
        </Field>
        <Field label="General Appearance">
          <CheckGroup selected={data.appearance} onChange={v => set("appearance", v)}
            options={["Well-groomed","Disheveled","Poor Hygiene","Bizarre","Provocative"]} />
        </Field>
        <Field label="General Behavior">
          <CheckGroup selected={data.behavior} onChange={v => set("behavior", v)}
            options={["Cooperative","Avoidant","Hostile","Demanding","Withdrawn","Disinhibited","Passive","Impulsive","Guarded","Threatening","Uncooperative","Restless"]} />
        </Field>
        <Field label="Interactions">
          <CheckGroup selected={data.interactions} onChange={v => set("interactions", v)}
            options={["Social","Respectful","Pleasant","Disrespectful","Intrusive","Isolative","Monopolizing","Poor Boundaries","Splitting"]} />
        </Field>
        <Field label="Psychomotor Activity">
          <CheckGroup selected={data.psychomotor} onChange={v => set("psychomotor", v)}
            options={["Appropriate","Relaxed","Agitated","Hyperactive","Pacing","Ritualistic","Restless","Rigid"]} />
        </Field>
        <Field label="Speech">
          <CheckGroup selected={data.speech} onChange={v => set("speech", v)}
            options={["Coherent","Soft","Monotone","Loud","Hyper-verbal","Pressured","Rapid","Slurred"]} />
        </Field>
        <Field label="Mood">
          <CheckGroup selected={data.mood} onChange={v => set("mood", v)}
            options={["Euthymic","Angry","Anxious","Depressed","Euphoric","Hypomanic","Irritable","Labile","Manic"]} />
        </Field>
        <Field label="Affect">
          <CheckGroup selected={data.affect} onChange={v => set("affect", v)}
            options={["Mood Congruent","Mood Incongruent","Broad/Full Range","Restricted","Blunted","Flat","Labile","Anxious","Bright","Dysphoric","Tearful"]} />
        </Field>
        <Field label="Thought Process">
          <CheckGroup selected={data.thoughtProcess} onChange={v => set("thoughtProcess", v)}
            options={["Logical","Organized","Blocking","Circumstantial","Concrete","Confused","Disorganized","Flight of Ideas","Loose Associations","Tangential"]} />
        </Field>
        <Field label="Thought Content">
          <CheckGroup selected={data.thoughtContent} onChange={v => set("thoughtContent", v)}
            options={["Realistic","Organized/Linear","Dissociation","Preoccupied","Grandiosity","Delusional","Persecutory","Ideas of Reference","Paranoid","Obsessive"]} />
        </Field>
        <Field label="Hallucinations">
          <CheckGroup selected={data.hallucinations} onChange={v => set("hallucinations", v)}
            options={["Denies","Auditory","Gustatory","Olfactory","Tactile","Visual","Responding to Internal Stimuli"]} />
        </Field>
        <Field label="Insight" required error={errors.insight} hasError={!!errors.insight}>
          <RadioGroup value={data.insight} onChange={v => set("insight", v)}
            options={["Unimpaired","Limited","Distorted","Delusional","Absent"]} />
        </Field>
        <Field label="Judgment" required error={errors.judgment} hasError={!!errors.judgment}>
          <RadioGroup value={data.judgment} onChange={v => set("judgment", v)}
            options={["Intact","Impaired","Absent"]} />
        </Field>
        <Field label="Additional MSE Comments" span={2}>
          <TextArea value={data.mseComments} onChange={v => set("mseComments", v)} placeholder="Clinical observations..." rows={3} />
        </Field>
      </Grid>
    </div>
  );
}

function Step6({ data, set, errors = {} }) {
  return (
    <div>
      <InfoBox color={C.red} bg={C.redBg}>All risk domains must be assessed. &quot;Yes&quot; answers require provider notification and treatment plan additions.</InfoBox>

      <SectionHead>Elopement Risk</SectionHead>
      <CheckGroup label="Check all applicable elopement risk factors" selected={data.elopementRisk} onChange={v => set("elopementRisk", v)} options={[
        "None","History of Elopement","Involuntary Legal Status","Legal Charges","Impulsive",
        "Agitated/Uncooperative","Actively Psychotic","Verbalizing Desire/Plans to Leave","Family/Friends Wanting to Leave",
      ]} />

      <SectionHead style={{ marginTop: 20 }}>Violence / Homicide Risk</SectionHead>
      <Grid cols={1}>
        <Field label="History of Assault/Threats Towards Healthcare Workers?" required error={errors.violenceHcw} hasError={!!errors.violenceHcw}>
          <RadioGroup value={data.violenceHcw} onChange={v => set("violenceHcw", v)} options={["Yes","No","Unable to Assess"]} />
        </Field>
        <Field label="History of Violence/Threats Towards Others?">
          <RadioGroup value={data.violenceHistory} onChange={v => set("violenceHistory", v)}
            options={["Denies","Past Week","Past Month","Past 6 Months",">6 Months Ago"]} />
        </Field>
      </Grid>
      <div style={{ marginTop: 12 }}>
        <CheckGroup label="Risk Factors for Violence/Aggression" selected={data.violenceRiskFactors} onChange={v => set("violenceRiskFactors", v)} options={[
          "Organic Brain Syndrome","Command Hallucinations or Delusions","Possession/Access to Gun",
          "Heavy Alcohol or Drug Use","Paranoid Ideation","Previous History of Violence",
          "Violent Social Environment","Borderline/Antisocial Personality Disorder","None",
        ]} />
      </div>
      <div style={{ marginTop: 12 }}>
        <Field label="Violence Risk Comments">
          <TextArea value={data.violenceComments} onChange={v => set("violenceComments", v)} placeholder="Describe relevant history..." rows={2} />
        </Field>
      </div>

      <SectionHead>Psychological Trauma History</SectionHead>
      <CheckGroup label="History of trauma including" selected={data.traumaHistory} onChange={v => set("traumaHistory", v)} options={[
        "Physical Abuse","Sexual Abuse","Emotional Abuse","Severe Childhood Neglect",
        "Combat Experience","Witness to Others Being Harmed","Significant Psychosocial Loss",
        "Victimization (disaster, criminal)","Significant Injury or Life-Threatening Disease",
      ]} />

      <SectionHead>Sexual Victimization Risk</SectionHead>
      <Grid cols={2}>
        <Field label="Sexual Victimization in Last 6 Months?">
          <RadioGroup value={data.sexualVictimization6mo} onChange={v => set("sexualVictimization6mo", v)} options={["Yes","No"]} />
        </Field>
        <Field label="Lifetime History of Sexual Victimization?">
          <RadioGroup value={data.sexualVictimizationLifetime} onChange={v => set("sexualVictimizationLifetime", v)} options={["Yes","No"]} />
        </Field>
      </Grid>
      <div style={{ marginTop: 12 }}>
        <CheckGroup label="Vulnerability Indicators" selected={data.sexualVictimizationIndicators} onChange={v => set("sexualVictimizationIndicators", v)} options={[
          "Victim of Sexual Abuse","Developmentally Challenged","Sexually Provocative/Hypersexual Behaviors",
          "Age-related vulnerability","Medically Compromised","ECT Recipient","Sedation",
        ]} />
      </div>

      <SectionHead>Sexual Aggression Risk</SectionHead>
      <Grid cols={2}>
        <Field label="Sexual Aggression in Last 6 Months?">
          <RadioGroup value={data.sexualAggression6mo} onChange={v => set("sexualAggression6mo", v)} options={["Yes","No"]} />
        </Field>
        <Field label="Lifetime History of Sexual Aggression?">
          <RadioGroup value={data.sexualAggressionLifetime} onChange={v => set("sexualAggressionLifetime", v)} options={["Yes","No"]} />
        </Field>
      </Grid>
      <div style={{ marginTop: 12 }}>
        <CheckGroup label="Aggression Indicators" selected={data.sexualAggressionIndicators} onChange={v => set("sexualAggressionIndicators", v)} options={[
          "History/Patterns of Sexual Abuse Perpetration","Criminal Sexual History",
          "Psychosis with Sexual Preoccupation","Sexual Preoccupation",
        ]} />
      </div>

      <SectionHead>Restraint/Seclusion Risk</SectionHead>
      <Grid cols={2}>
        <Field label="History of Sexual Abuse (may increase emotional risk with intervention)?" required error={errors.restraintSexualAbuse} hasError={!!errors.restraintSexualAbuse}>
          <RadioGroup value={data.restraintSexualAbuse} onChange={v => set("restraintSexualAbuse", v)} options={["Yes","No"]} />
        </Field>
        <Field label="History of Physical Abuse (may increase emotional risk)?" required error={errors.restraintPhysicalAbuse} hasError={!!errors.restraintPhysicalAbuse}>
          <RadioGroup value={data.restraintPhysicalAbuse} onChange={v => set("restraintPhysicalAbuse", v)} options={["Yes","No"]} />
        </Field>
        <Field label="Medical/Physical Issues (may increase physical risk)?">
          <RadioGroup value={data.restraintMedicalIssues} onChange={v => set("restraintMedicalIssues", v)} options={["Yes","No"]} />
        </Field>
        <Field label="Who to Notify if Restraint/Seclusion Used">
          <TextInput value={data.restraintNotify} onChange={v => set("restraintNotify", v)} placeholder="Name and phone number" />
        </Field>
      </Grid>
    </div>
  );
}

function Step7({ data, set, errors = {} }) {
  const score = ["csrs1","csrs2","csrs3","csrs4","csrs5","csrs6"].filter(k => data[k] === "Yes").length;
  const riskLevel = score === 0 ? null : score <= 2 ? "Low" : score <= 4 ? "Moderate" : "High";
  const riskColor = riskLevel === "High" ? C.red : riskLevel === "Moderate" ? C.amber : C.green;
  const riskBg = riskLevel === "High" ? C.redBg : riskLevel === "Moderate" ? C.amberBg : C.greenBg;

  return (
    <div>
      <InfoBox color={C.red} bg={C.redBg}>Columbia-Suicide Severity Rating Scale (C-SSRS). Administer carefully. Ask each question verbally.</InfoBox>

      <SectionHead>Protective vs. Risk Factors</SectionHead>
      <Grid cols={2}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>✓ Protective Factors</div>
          <CheckGroup selected={data.suicideProtective} onChange={v => set("suicideProtective", v)} options={[
            "Supportive Social Network/Family","Identifies Reasons for Living",
            "Cultural/Religious Beliefs Against Suicide","Responsibility to Family/Others",
            "Engaged in Work or School","Limited Access to Lethal Means",
            "Willing to Engage in Treatment","Problem-Solving Skills","Medication Compliance",
          ]} />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>⚠ Risk Factors</div>
          <CheckGroup selected={data.suicideRisk} onChange={v => set("suicideRisk", v)} options={[
            "Easy Access to Lethal Means","Previous Suicide Attempt(s)",
            "Family History of Suicide","Isolation","Feelings of Hopelessness/Helplessness",
            "Lack of Identified Supports","Unemployment","Physical Illness/Pain",
            "Non-Compliant with Medications","Impulsive/Aggressive Tendencies","No Protective Factors",
          ]} />
        </div>
      </Grid>

      <SectionHead>Columbia-Suicide Severity Rating Scale (Past Month)</SectionHead>
      <div style={{ display: "grid", gap: 16 }}>
        {[
          { key: "csrs1", q: "1. Have you wished you were dead or wished you could go to sleep and not wake up?" },
          { key: "csrs2", q: "2. Have you actually had any thoughts of killing yourself?" },
          { key: "csrs3", q: "3. Have you been thinking about how you might do this? (e.g., thought about taking an overdose but never made a specific plan)" },
          { key: "csrs4", q: "4. Have you had these thoughts and had some intention of acting on them?" },
          { key: "csrs5", q: "5. Have you started to work out or worked out the details of how to kill yourself? Do you intend to carry out this plan?" },
          { key: "csrs6", q: "6. Have you ever done anything, started to do anything, or prepared to do anything to end your life?" },
        ].map(({ key, q }) => (
          <div key={key} style={{
            background: data[key] === "Yes" ? C.redBg : C.white,
            border: `1px solid ${data[key] === "Yes" ? "#fca5a5" : C.border}`,
            borderRadius: 8, padding: "12px 16px",
          }}>
            <div style={{ fontSize: 13, color: C.text, marginBottom: 10, lineHeight: 1.5 }}>{q}</div>
            <div style={{ borderTop: `1px solid ${data[key] === "Yes" ? C.red : C.border}`, paddingTop: 10 }}>
              <RadioGroup value={data[key]} onChange={v => set(key, v)} options={["Yes","No"]} />
            </div>
          </div>
        ))}
      </div>

      {riskLevel && (
        <div style={{ background: riskBg, border: `2px solid ${riskColor}`, borderRadius: 8, padding: "14px 18px", marginTop: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: riskColor }}>
            C-SSRS Risk Level: {riskLevel} — {score} positive response{score !== 1 ? "s" : ""}
          </div>
          <div style={{ fontSize: 12, color: riskColor, marginTop: 4 }}>
            {riskLevel === "High" && "YES to Q4 or Q5 → High Risk. Complete Lifetime Suicide Risk Assessment. Notify provider immediately."}
            {riskLevel === "Moderate" && "YES to Q3 or Lifetime Q6 → Moderate Risk. Complete Lifetime Suicide Risk Assessment."}
            {riskLevel === "Low" && "YES to Q1 or Q2, No to Q3–5 → Low Risk. Monitor and document."}
          </div>
        </div>
      )}

      <SectionHead>Summary Risk Assessment</SectionHead>
      <div style={{ display: "grid", gap: 10 }}>
        {[
          ["Suicide/Self Injury Risk","summaryRiskSuicide"],
          ["Fall Risk","summaryRiskFall"],
          ["Assault/Homicide Risk","summaryRiskAssault"],
          ["Seizure Risk","summaryRiskSeizure"],
          ["Medically Compromised","summaryRiskMedical"],
          ["Elopement Risk","summaryRiskElopement"],
          ["Sexual Victimization Risk","summaryRiskSexualV"],
          ["Sexual Aggression Risk","summaryRiskSexualA"],
        ].map(([label, key]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.white, border: `1px solid ${C.border}`, borderRadius: 7, padding: "10px 14px" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{label}</span>
            <RadioGroup value={data[key]} onChange={v => set(key, v)} options={["Yes","No"]} />
          </div>
        ))}
      </div>

      <SectionHead>Level of Observation at Admission</SectionHead>
      <RadioGroup value={data.observationLevel} onChange={v => set("observationLevel", v)}
        options={["Q15 min","Q5 min 24/7","Q5 min Waking Hours","1:1 24/7","1:1 Waking Hours"]} />
    </div>
  );
}

// FIX: Step8 now correctly receives and uses the `set` prop for all fields.
// The duplicate narrativeSummary section has been removed.
function Step8({ data, set, allData, errors = {} }) {
  const completedSections = STEPS.slice(0, 7).map((s, i) => {
    const sData = allData[i + 1] || {};
    const keys = Object.keys(sData);
    const filled = keys.filter(k => {
      const v = sData[k];
      return v && (Array.isArray(v) ? v.length > 0 : v !== "");
    }).length;
    return { ...s, filled, total: Math.max(keys.length, 1), pct: keys.length > 0 ? Math.round((filled / keys.length) * 100) : 0 };
  });

  return (
    <div>
      <InfoBox color={C.purple} bg={C.lilac}>
        Review the completion summary below. Once signed off by the RN, this assessment will be saved as a draft for admin review before final admission confirmation.
      </InfoBox>

      <SectionHead>Assessment Completion Summary</SectionHead>
      <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
        {completedSections.map(s => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 14, background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px" }}>
            <span style={{ fontSize: 16, width: 24, color: C.purple }}>{s.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text, flex: 1 }}>{s.label}</span>
            <div style={{ width: 120, height: 6, background: C.lilacMid, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${Math.min(s.pct, 100)}%`, height: "100%", background: s.pct > 50 ? C.green : C.amber, borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 12, color: C.textMuted, width: 38, textAlign: "right" }}>{s.pct}%</span>
          </div>
        ))}
      </div>

      <SectionHead>RN Sign-Off</SectionHead>
      <Grid cols={2}>
        <Field label="Nursing Assessment Summary" required error={errors.narrativeSummary} hasError={!!errors.narrativeSummary} span={2}>
          <TextArea
            value={data.narrativeSummary}
            onChange={v => set("narrativeSummary", v)}
            placeholder="Assimilate data into clinical picture of patient status, events leading to hospitalization, patient response, and immediate interventions (e.g., Observation Round Q15)..."
            rows={6}
          />
        </Field>
        <Field label="RN Printed Name & Credentials" required error={errors.rnName} hasError={!!errors.rnName}>
          <TextInput value={data.rnName} onChange={v => set("rnName", v)} placeholder="Jane Smith, RN" hasError={!!errors.rnName} />
        </Field>
        <Field label="Staff Number" required error={errors.staffNumber} hasError={!!errors.staffNumber}>
          <TextInput value={data.staffNumber} onChange={v => set("staffNumber", v)} placeholder="Staff ID #" hasError={!!errors.staffNumber} />
        </Field>
        <Field label="Date & Time" span={2}>
          <TextInput type="datetime-local" value={data.rnSignedAt} onChange={v => set("rnSignedAt", v)} />
        </Field>
        <Field label="RN Signature (Type to Acknowledge)" span={2}>
          <TextInput value={data.rnSignature} onChange={v => set("rnSignature", v)} placeholder="I confirm this assessment is accurate and complete" />
        </Field>
      </Grid>

      <div style={{ marginTop: 24, background: C.lilac, border: `1px solid ${C.lilacBorder}`, borderRadius: 10, padding: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.purpleDark, marginBottom: 8 }}>What Happens Next</div>
        <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.8 }}>
          1. This assessment will be saved as a <strong>draft</strong> in the system.<br/>
          2. The <strong>Admin</strong> will review all sections and the nursing summary.<br/>
          3. Admin may request clarifications or additional documentation.<br/>
          4. Once approved, the patient will be formally admitted and a <strong>Resident Record</strong> created.<br/>
          5. Subsequent forms (Advance Directive, Pre-Screening, Care Plan) will be linked to this admission.
        </div>
      </div>
    </div>
  );
}

// ─── VALIDATION HELPERS ───────────────────────────────────────────────────────
const isStepComplete = (data, stepId) => {
  const required = STEP_REQUIRED_FIELDS[stepId] || [];
  return required.every(field => {
    const val = data[field];
    return val !== undefined && val !== null && val !== '' && (Array.isArray(val) ? val.length > 0 : true);
  });
};

const getStepErrors = (data, stepId) => {
  const required = STEP_REQUIRED_FIELDS[stepId] || [];
  const errors = {};

  required.forEach(field => {
    const val = data[field];
    if (!val || (Array.isArray(val) && val.length === 0) || val === '') {
      errors[field] = `${REQUIRED_FIELD_LABELS[field] || field} is required`;
    }
  });

  // Age is auto-derived from DOB (no manual entry), so no cross-check needed.

  return errors;
};

const formDataChanged = (initial, current) => {
  if (!initial) return false;
  return JSON.stringify(initial) !== JSON.stringify(current);
};

// ─── NUMERIC CONVERSION ───────────────────────────────────────────────────────
// FIX: Safe numeric coercion — returns null for non-numeric strings (e.g. "5'8").
// Height is intentionally kept as a string and NOT coerced.
const toNum = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// FIX: Parse height stored as free-text (e.g. "5'8", "5'8\"", "68", "170cm") into
// total inches for the server. Returns null if unparseable so the column
// receives null rather than causing a type error.
const parseHeightToInches = (raw) => {
  if (!raw) return null;
  const s = String(raw).trim();
  // Already a plain number — treat as inches
  if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  // Feet and inches: 5'8, 5'8", 5ft8, 5 ft 8 in, etc.
  const ftIn = s.match(/(\d+)\s*(?:'|ft|feet)[\s]*(\d*)\s*(?:"|in|inches)?/i);
  if (ftIn) {
    const feet = parseInt(ftIn[1], 10);
    const inches = ftIn[2] ? parseInt(ftIn[2], 10) : 0;
    return feet * 12 + inches;
  }
  // cm fallback
  const cm = s.match(/(\d+(\.\d+)?)\s*cm/i);
  if (cm) return Math.round(parseFloat(cm[1]) / 2.54);
  return null;
};

const txtList = (v) => (Array.isArray(v) ? v.join('; ') : (v || null));

// ─── DIALOGS ──────────────────────────────────────────────────────────────────
function ConfirmDialog({ isOpen, title, message, onDiscard, onKeepEditing }) {
  if (!isOpen) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,21,56,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
      <div style={{ background: C.white, borderRadius: 12, padding: 32, maxWidth: 420, boxShadow: "0 20px 25px rgba(0,0,0,0.15)" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.purpleDark, marginBottom: 12 }}>{title}</div>
        <div style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6, marginBottom: 24 }}>{message}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onKeepEditing} style={{ padding: "9px 20px", background: C.lilac, border: `1px solid ${C.lilacBorder}`, borderRadius: 7, fontSize: 13, fontWeight: 600, color: C.purple, cursor: "pointer" }}>Keep Editing</button>
          <button onClick={onDiscard} style={{ padding: "9px 20px", background: C.red, border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, color: C.white, cursor: "pointer" }}>Discard Changes</button>
        </div>
      </div>
    </div>
  );
}

function ResumeDraftDialog({ isOpen, onResume, onDiscard, accentColor, accentBg, accentBorder }) {
  if (!isOpen) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,21,56,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 32, maxWidth: 440, width: "90%", boxShadow: "0 20px 25px rgba(0,0,0,0.15)" }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: accentColor, marginBottom: 10 }}>Resume your draft?</div>
        <div style={{ fontSize: 13, color: "#6b5f8a", lineHeight: 1.6, marginBottom: 24 }}>
          A saved draft was found for this form. Would you like to pick up where you left off, or start fresh?
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onDiscard} style={{ padding: "9px 20px", background: accentBg, border: `1px solid ${accentBorder}`, borderRadius: 7, fontSize: 13, fontWeight: 600, color: accentColor, cursor: "pointer" }}>Start Fresh</button>
          <button onClick={onResume} style={{ padding: "9px 20px", background: accentColor, border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}>Resume Draft</button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN WIZARD ──────────────────────────────────────────────────────────────
const NURSING_DRAFT_KEY = 'admission_nursing_draft';

export default function NursingAdmissionWizard({ onClose }) {
  const router = useRouter();
  const { auth, loading: authLoading } = useAuth() || {};
  const accessToken = auth?.accessToken;
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;

  const isMobile = useIsMobile(768);
  const [stepNavOpen, setStepNavOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  // The nursing assessment's own draft id (nursing_id; admission_id kept as a
  // legacy alias) and the source pre-screening it was started from.
  const [admissionId, setAdmissionId] = useState(() => searchParams?.get('nursing_id') || searchParams?.get('admission_id') || null);
  const [screeningId] = useState(() => searchParams?.get('screening_id') || null);
  const [formData, setFormData] = useState(Object.fromEntries(STEPS.map(s => [s.id, {}])));
  const [initialFormData, setInitialFormData] = useState(null);
  const [errors, setErrors] = useState({});
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [resumeDraftPrompt, setResumeDraftPrompt] = useState(false);
  const [pendingDraft, setPendingDraft] = useState(null);
  const [preScreeningData, setPreScreeningData] = useState(null);

  // Load form data from server on mount if admissionId provided
  useEffect(() => {
    const loadFormData = async () => {
      if (authLoading) return;
      // The useState initializer reads window during SSR (null), so on a soft
      // client navigation `admissionId` can be null even though the URL carries
      // it. Re-resolve from the live URL here (this effect runs only client-side).
      const sp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const liveId = admissionId || sp?.get('nursing_id') || sp?.get('admission_id') || null;
      const liveScreening = screeningId || sp?.get('screening_id') || null;
      if (liveId && liveId !== admissionId) setAdmissionId(liveId);

      let loaded = Object.fromEntries(STEPS.map(s => [s.id, {}]));
      try {
        // 1. Load this nursing assessment's own draft (if resuming one).
        if (liveId) {
          const response = await fetch(`/api/v1/admission/nursing-assessment/${liveId}`, {
            headers: { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
            credentials: 'same-origin',
          });
          if (response.ok) {
            const admission = (await response.json()).data;
            loaded = bucketsFromBlob(admission.nursing_assessment_data, STEPS.map(s => s.id));
          }
        }
        // 2. Carry resident info forward from the source pre-screening (prefill
        //    identity fields the nurse shouldn't have to re-enter).
        if (liveScreening) {
          const rs = await fetch(`/api/v1/admission/pre-screening/${liveScreening}`, {
            headers: { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
            credentials: 'same-origin',
          });
          if (rs.ok) {
            const ps = (await rs.json()).data?.pre_screening_data || {};
            setPreScreeningData(ps);
            if (ps.clientFullName && !loaded[1].name) loaded[1].name = ps.clientFullName;
            if (ps.dateOfBirth && !loaded[1].dob) loaded[1].dob = ps.dateOfBirth;
            if (ps.pronouns && !loaded[1].pronouns) loaded[1].pronouns = ps.pronouns;
          }
        }
        setFormData(loaded);
        setInitialFormData(loaded);
      } catch {
        setInitialFormData(Object.fromEntries(STEPS.map(s => [s.id, {}])));
      } finally {
        setIsLoading(false);
      }
    };
    loadFormData();
  }, [admissionId, screeningId, accessToken, authLoading]);

  // Check sessionStorage for draft after server load settles
  useEffect(() => {
    if (isLoading) return;
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(NURSING_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const timer = setTimeout(() => {
          setPendingDraft(parsed);
          setResumeDraftPrompt(true);
        }, 0);
        return () => clearTimeout(timer);
      }
    } catch { /* ignore corrupt draft */ }
  }, [isLoading]);

  // Periodic autosave to sessionStorage every 30 seconds when dirty
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const timer = setInterval(() => {
      if (isDirty) {
        try {
          sessionStorage.setItem(NURSING_DRAFT_KEY, JSON.stringify(formData));
          setLastSavedTime(new Date());
          setIsDirty(false);
        } catch { /* quota exceeded */ }
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [formData, isDirty]);

  // Track interacted fields so on-blur format checks only flag fields the user
  // actually entered (not pristine ones).
  const touchedRef = useRef(new Set());

  const set = useCallback((stepId) => (key, val) => {
    touchedRef.current.add(key);
    setFormData(prev => ({ ...prev, [stepId]: { ...prev[stepId], [key]: val } }));
    setSaved(false);
    setIsDirty(true);
    setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  }, []);

  // On blur, re-check the format of any touched, non-empty field in this step
  // and surface problems (with recommended entry) in the right-side guide.
  const handleBlurValidate = useCallback(() => {
    const rules = NURSING_RULES[step];
    if (!rules) return;
    const fmtErrors = validateRuleSet(formData[step], rules, REQUIRED_FIELD_LABELS, {
      only: Array.from(touchedRef.current),
      skipEmpty: true,
    });
    setErrors(prev => ({ ...prev, ...fmtErrors }));
  }, [step, formData]);

  // FIX: handleSaveDraft now uses safe coercions for all mapped fields.
  // height is parsed via parseHeightToInches. BP fields come from formData.
  // opioid_sedation_scale removed from mapped (not collected in any step).
  const handleSaveDraft = async (markComplete = false) => {
    if (!accessToken) {
      setSubmitError('Please log in again before saving this admission form.');
      return false;
    }
    markComplete = markComplete === true;
    setSaving(true);
    setSubmitError(null);
    try {
      const allData = Object.assign({}, ...Object.values(formData));

      const mapped = {
        assessment_date:    allData.assessmentDate || new Date().toISOString().slice(0, 10),
        vital_temperature:  toNum(allData.temperature),
        vital_bp_systolic:  toNum(allData.bpSystolic),   // now collected in Step 2
        vital_bp_diastolic: toNum(allData.bpDiastolic),  // now collected in Step 2
        vital_pulse:        toNum(allData.pulse),
        vital_respiration:  toNum(allData.respirations),
        vital_oxygen:       toNum(allData.o2Sat),
        weight_lbs:         toNum(allData.weightActual),
        // FIX: height stored as free text, converted to inches safely
        height_inches:      parseHeightToInches(allData.height),
        // Store raw height string alongside for display purposes
        height_raw:         allData.height || null,
        skin_assessment:    txtList(allData.skinFindings),
        sleep_history:      txtList(allData.sleepPattern),
        pain_level:         toNum(allData.painScale),
        pain_location:      allData.painLocation || null,
        functional_mobility: txtList(allData.assistDevices),
        fall_risk:          allData.summaryRiskFall === 'Yes' ? 'high' : (allData.summaryRiskFall || null),
        suicide_risk:       allData.summaryRiskSuicide === 'Yes' ? 'high' : (allData.summaryRiskSuicide || null),
        sexual_history_risk: allData.summaryRiskSexualV === 'Yes' ? 'high' : (allData.summaryRiskSexualV || null),
        violence_risk:      allData.summaryRiskAssault === 'Yes' ? 'high' : (allData.summaryRiskAssault || null),
        substance_abuse_history: allData.substanceUse12mo === 'Yes' ? 'reported' : (allData.substanceUse12mo || null),
        mental_health_assessment: allData.mseComments || null,
        nursing_assessment_notes: allData.narrativeSummary || null,
      };

      // Strip undefined values
      Object.keys(mapped).forEach(k => mapped[k] === undefined && delete mapped[k]);

      const response = await fetch('/api/v1/admission/nursing-assessment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          nursingId: admissionId,
          preScreeningId: screeningId,
          // Persist the exact per-step buckets alongside the flat field map so
          // the draft rehydrates losslessly. `__steps` carries the buckets.
          formData: { ...allData, ...mapped, [STEP_BUCKETS_KEY]: formData },
          markComplete,
          submit: markComplete, // mark the assessment submitted on completion
        }),
      });

      const raw = await response.text();
      let result = null;
      try { result = raw ? JSON.parse(raw) : null; } catch { /* non-JSON */ }

      if (response.ok && result) {
        setSaved(true);
        const newId = result.data?.admissionId || result.data?.id;
        if (newId) setAdmissionId(newId);
        return true;
      } else if (result) {
        setSubmitError(formatApiError(result));
      } else {
        setSubmitError(
          `The server returned an unexpected response (HTTP ${response.status}). ` +
          `Please try again; if this keeps happening, contact support.`
        );
      }
    } catch (error) {
      setSubmitError(friendlyErrorMessage(error));
    } finally {
      setSaving(false);
    }
    return false;
  };

  const handleAdvanceStep = async () => {
    const allErrors = {};
    for (let s = 1; s <= step; s++) {
      Object.assign(allErrors, getStepErrors(formData[s], s));
      Object.assign(allErrors, validateRuleSet(formData[s], NURSING_RULES[s] || {}, REQUIRED_FIELD_LABELS, { skipEmpty: true }));
    }
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      return;
    }
    await handleSaveDraft();
    setStep(s => s + 1);
    setErrors({});
  };

  const handlePdfDownload = async () => {
    setPdfGenerating(true);
    setPdfError(null);
    try {
      const allData = Object.assign({}, ...Object.values(formData));
      const residentName = allData.name || 'admission';
      const result = await generateAndDownloadPdf('nursing-assessment', allData, residentName, accessToken);
      if (!result.success) setPdfError(result.error || 'Failed to generate PDF');
    } catch (error) {
      setPdfError(error.message || 'PDF generation failed');
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleFormCompleted = async () => {
    const stepErrors = getStepErrors(formData[step], step);
    Object.assign(stepErrors, validateRuleSet(formData[step], NURSING_RULES[step] || {}, REQUIRED_FIELD_LABELS, { skipEmpty: true }));
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const savedOk = await handleSaveDraft(true);
      if (!savedOk) return;
      const allData = Object.assign({}, ...Object.values(formData));
      storeFormDataInSession('nursing-assessment', allData);
      try { sessionStorage.removeItem(NURSING_DRAFT_KEY); } catch { /* ignore */ }
      setShowPdfModal(true);
      setPdfGenerating(false);
      setPdfError(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinueAfterPdf = () => {
    setShowPdfModal(false);
    if (admissionId) router.push(`/admission/advance-directive?nursing_id=${admissionId}${screeningId ? `&screening_id=${screeningId}` : ''}`);
  };

  const currentData = formData[step];
  const setField = set(step);
  const stepComplete = isStepComplete(currentData, step);

  const stepComponents = {
    1: <Step1 data={currentData} set={setField} errors={errors} preScreeningData={preScreeningData} />,
    2: <Step2 data={currentData} set={setField} errors={errors} />,
    3: <Step3 data={currentData} set={setField} errors={errors} />,
    4: <Step4 data={currentData} set={setField} errors={errors} />,
    5: <Step5 data={currentData} set={setField} errors={errors} />,
    6: <Step6 data={currentData} set={setField} errors={errors} />,
    7: <Step7 data={currentData} set={setField} errors={errors} />,
    // FIX: set prop now passed and used in Step8
    8: <Step8 data={currentData} set={setField} allData={formData} errors={errors} />,
  };

  if (isLoading) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(15,21,56,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        <div style={{ background: C.white, borderRadius: 12, padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 16 }}>Restoring your form...</div>
          <div style={{ width: 40, height: 40, borderRadius: "50%", border: `3px solid ${C.lilacBorder}`, borderTopColor: C.purple, margin: "0 auto", animation: "spin 0.8s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: "52px 0 0 0", background: "rgba(15,21,56,0.55)", display: "flex", alignItems: "stretch", zIndex: 100, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Mobile backdrop for the step drawer */}
      {isMobile && stepNavOpen && (
        <div onClick={() => setStepNavOpen(false)} style={{ position: "fixed", inset: "52px 0 0 0", background: "rgba(10,8,18,0.5)", zIndex: 110 }} />
      )}

      {/* Sidebar — inline column on desktop, off-canvas drawer on mobile */}
      <div style={{
        width: 220, background: C.purpleDark, display: "flex", flexDirection: "column", flexShrink: 0,
        ...(isMobile ? {
          position: "fixed", top: 52, left: 0, bottom: 0, zIndex: 120,
          transform: stepNavOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease", boxShadow: "4px 0 28px rgba(0,0,0,0.3)",
        } : {}),
      }}>
        <div style={{ padding: "22px 20px 18px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>New Admission</div>
          <div style={{ fontSize: 15, color: "#fff", fontWeight: 700 }}>Nursing Assessment</div>
        </div>
        <div style={{ flex: 1, padding: "16px 10px", overflowY: "auto" }}>
          {STEPS.map(s => {
            const done = s.id < step;
            const active = s.id === step;
            const canAccess = done || active || (s.id > 1 && isStepComplete(formData[s.id - 1], s.id - 1));
            const isDisabled = !canAccess;
            return (
              <button
                key={s.id}
                onClick={() => { if (!isDisabled) { setStep(s.id); setStepNavOpen(false); } }}
                disabled={isDisabled}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 12px",
                  background: active ? "rgba(255,255,255,0.12)" : "transparent",
                  border: "none", borderRadius: 7, cursor: isDisabled ? "not-allowed" : "pointer", marginBottom: 3,
                  borderLeft: active ? "3px solid #c4b5fd" : "3px solid transparent",
                  color: active ? "#e9d5ff" : done ? "rgba(255,255,255,0.6)" : isDisabled ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.35)",
                  opacity: isDisabled ? 0.5 : 1,
                }}>
                <span style={{
                  width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                  background: done ? C.green : active ? "#8b5cf6" : "rgba(255,255,255,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: done ? 11 : 10, color: "#fff", fontWeight: 700,
                }}>
                  {done ? "✓" : s.id}
                </span>
                <span style={{ fontSize: 12, fontWeight: active ? 700 : 400, textAlign: "left", lineHeight: 1.3 }}>{s.short}</span>
                {isDisabled && s.id > step && <span style={{ marginLeft: "auto", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>🔒</span>}
              </button>
            );
          })}
        </div>
        {saved && (
          <div style={{ padding: "12px 16px", background: "rgba(14,165,113,0.2)", margin: "8px 10px", borderRadius: 7 }}>
            <div style={{ fontSize: 11, color: "#6ee7b7", fontWeight: 600 }}>✓ Draft Saved</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Progress preserved</div>
          </div>
        )}
        <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <button onClick={() => handleSaveDraft()} style={{
            width: "100%", padding: "8px 0", background: "rgba(139,92,246,0.3)",
            border: "1px solid rgba(139,92,246,0.5)", borderRadius: 6,
            color: "#e9d5ff", fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 6,
          }}>Save Draft</button>
          {onClose && (
            <button onClick={() => {
              if (initialFormData && formDataChanged(initialFormData, formData)) {
                setShowConfirmClose(true);
              } else {
                onClose();
              }
            }} style={{
              width: "100%", padding: "7px 0", background: "transparent",
              border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6,
              color: "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer",
            }}>✕ Close</button>
          )}
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.lilac, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: isMobile ? "12px 14px" : "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <button type="button" onClick={() => setStepNavOpen(true)} aria-label="Open steps" className="app-show-mobile" style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, color: C.purpleDark, alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
            <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.purple, background: C.lilac, padding: "4px 10px", borderRadius: 5 }}>
                Step {step} of {STEPS.length}
              </div>
              <div className="app-hide-mobile" style={{ display: "flex", gap: 6 }}>
                {STEPS.map(s => (
                  <div key={s.id} style={{
                    width: 18, height: 18, borderRadius: "50%",
                    background: s.id < step ? C.green : s.id === step ? C.purple : C.lilacMid,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700, color: s.id <= step ? "#fff" : C.textMuted,
                  }}>
                    {s.id < step ? "✓" : s.id}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.purpleDark }}>{STEPS[step - 1].label}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Dependable Care Residential Center</div>
            </div>
          </div>
          <div className="app-hide-mobile" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 180, height: 5, background: C.lilacMid, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${(step / STEPS.length) * 100}%`, height: "100%", background: C.purple, borderRadius: 3, transition: "width 0.3s" }} />
            </div>
            <span style={{ fontSize: 12, color: C.textMuted, width: 36 }}>{Math.round((step / STEPS.length) * 100)}%</span>
          </div>
        </div>

        {/* Error Banners */}
        {submitError && (
          <div style={{ background: C.redBg, borderBottom: `2px solid ${C.red}`, padding: "14px 28px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <span style={{ fontSize: 16, marginTop: 2 }}>✕</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.red, marginBottom: 4 }}>Submission Failed</div>
                <div style={{ fontSize: 12, color: C.red }}>{submitError}</div>
              </div>
            </div>
          </div>
        )}
        {Object.keys(errors).length > 0 && (
          <div style={{ background: C.redBg, borderBottom: `2px solid ${C.red}`, padding: "14px 28px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <span style={{ fontSize: 16, marginTop: 2 }}>⚠</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.red, marginBottom: 6 }}>
                  {Object.keys(errors).length} field{Object.keys(errors).length !== 1 ? 's' : ''} need{Object.keys(errors).length === 1 ? 's' : ''} attention
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 4, fontSize: 12, color: C.red }}>
                  {Object.entries(errors).map(([fieldKey, msg]) => (
                    <div key={fieldKey}>• {REQUIRED_FIELD_LABELS[fieldKey] || fieldKey}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px 14px" : "24px 32px" }} onBlur={handleBlurValidate}>
          {stepComponents[step]}
        </div>

        {/* Footer */}
        <div style={{ background: C.white, borderTop: `1px solid ${C.border}`, padding: isMobile ? "12px 14px" : "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexShrink: 0 }}>
          <button
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1 || isSubmitting || saving}
            style={{
              padding: "9px 22px", background: "transparent", border: `1px solid ${C.lilacBorder}`,
              borderRadius: 7, fontSize: 13, fontWeight: 600,
              color: step === 1 || isSubmitting ? C.textMuted : C.purpleDark,
              cursor: step === 1 || isSubmitting || saving ? "not-allowed" : "pointer",
              opacity: step === 1 || isSubmitting ? 0.4 : 1,
            }}>← Previous</button>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexDirection: "column" }}>
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>
              {countCompletedFields(formData[step], STEP_REQUIRED_FIELDS[step] || [])} of {(STEP_REQUIRED_FIELDS[step] || []).length} required fields complete
            </div>
            {lastSavedTime && (
              <div style={{ fontSize: 11, color: C.green, fontWeight: 500 }}>
                Auto-saved at {lastSavedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
            {Object.keys(errors).length > 0 && (
              <div style={{ fontSize: 12, color: C.red, fontWeight: 600, textAlign: "right" }}>
                ⚠ {Object.keys(errors).length} field{Object.keys(errors).length !== 1 ? 's' : ''} need attention
              </div>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={() => handleSaveDraft()} disabled={saving || isSubmitting} style={{
                padding: "9px 18px", background: C.lilac, border: `1px solid ${C.lilacBorder}`,
                borderRadius: 7, fontSize: 13, fontWeight: 600, color: C.purple,
                cursor: saving || isSubmitting ? "not-allowed" : "pointer",
                opacity: saving || isSubmitting ? 0.6 : 1,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                {saving && <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid #c9b8f5", borderTopColor: C.purple, animation: "spin 0.8s linear infinite" }} />}
                {saving ? "Saving..." : "Save Draft"}
              </button>

              {step < STEPS.length ? (
                <button
                  onClick={handleAdvanceStep}
                  disabled={!stepComplete || saving || isSubmitting}
                  style={{
                    padding: "9px 24px",
                    background: stepComplete && !isSubmitting ? C.purple : C.textMuted,
                    border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, color: "#fff",
                    cursor: stepComplete && !saving && !isSubmitting ? "pointer" : "not-allowed",
                    opacity: stepComplete ? 1 : 0.5,
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                  {saving && <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite" }} />}
                  {saving ? "Saving..." : "Save & Continue →"}
                </button>
              ) : (
                <button
                  onClick={handleFormCompleted}
                  disabled={saving || isSubmitting}
                  style={{
                    padding: "9px 24px", background: C.green, border: "none",
                    borderRadius: 7, fontSize: 13, fontWeight: 700, color: "#fff",
                    cursor: saving || isSubmitting ? "not-allowed" : "pointer",
                    opacity: saving || isSubmitting ? 0.6 : 1,
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                  {isSubmitting && <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite" }} />}
                  {isSubmitting ? "Submitting..." : "Submit & Continue →"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Live right-side entry guide */}
      <ValidationGuide
        errors={errors}
        labels={REQUIRED_FIELD_LABELS}
        theme={{ red: C.red, redBg: C.redBg, white: C.white, text: C.text, textMuted: C.textMuted, border: '#fecaca', accent: C.red }}
      />

      {/* PDF Modal */}
      {showPdfModal && (
        <FormCompletionModal
          formType="nursing-assessment"
          fileName={generatePdfFilename('nursing-assessment', formData[1]?.name || 'admission')}
          isGenerating={pdfGenerating}
          onDownload={handlePdfDownload}
          onContinue={handleContinueAfterPdf}
          continueHref={admissionId ? `/admission/advance-directive?nursing_id=${admissionId}${screeningId ? `&screening_id=${screeningId}` : ''}` : undefined}
          continueLabel="Continue to Advance Directive"
          error={pdfError}
        />
      )}

      <ConfirmDialog
        isOpen={showConfirmClose}
        title="Unsaved Changes"
        message="You have unsaved changes in this form. Are you sure you want to close without saving?"
        onDiscard={() => { setShowConfirmClose(false); onClose?.(); }}
        onKeepEditing={() => setShowConfirmClose(false)}
      />

      <ResumeDraftDialog
        isOpen={resumeDraftPrompt}
        accentColor={C.purple}
        accentBg={C.lilac}
        accentBorder={C.lilacBorder}
        onResume={() => {
          if (pendingDraft) setFormData(pendingDraft);
          setResumeDraftPrompt(false);
          setPendingDraft(null);
        }}
        onDiscard={() => {
          try { sessionStorage.removeItem(NURSING_DRAFT_KEY); } catch { /* ignore */ }
          setResumeDraftPrompt(false);
          setPendingDraft(null);
        }}
      />
    </div>
  );
}
