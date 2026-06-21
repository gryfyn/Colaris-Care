'use client';
import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { validateField, ValidationRules, getMissingFields, countCompletedFields, validateRuleSet, PRE_SCREENING_RULES } from '@/lib/form-validation';
import ValidationGuide from '@/components/ValidationGuide';
import { bucketsFromBlob, STEP_BUCKETS_KEY } from '@/lib/admission-draft';
import { friendlyErrorMessage, formatApiError } from '@/app/lib/error-messages';
import FormCompletionModal from '@/components/FormCompletionModal';
import { generateAndDownloadPdf, generatePdfFilename, clearFormDataFromSession } from '@/lib/pdf-downloader';
import { useIsMobile } from '@/lib/useIsMobile';

// ─── THEME: Warm teal + slate — distinct from nursing assessment's lilac/purple ─
const C = {
  bg:          "#f0f9f8",
  bgMid:       "#d9f0ee",
  bgBorder:    "#a8d8d4",
  teal:        "#0d7377",
  tealDark:    "#095256",
  tealLight:   "#14a6a0",
  tealPale:    "#e6f7f6",
  white:       "#ffffff",
  text:        "#0f2b2d",
  textMuted:   "#4a7275",
  border:      "#cce5e3",
  green:       "#0a7c4e",
  greenBg:     "#e6f5ee",
  amber:       "#b45309",
  amberBg:     "#fffbeb",
  red:         "#c0392b",
  redBg:       "#fef2f2",
  slate:       "#f8fdfd",
  navy:        "#1a3a4a",
  gold:        "#d97706",
};

const STEPS = [
  { id: 1, label: "Referral & Funding",        short: "Referral",     icon: "◎" },
  { id: 2, label: "Mental Health History",      short: "MH History",   icon: "◈" },
  { id: 3, label: "Medical History & Needs",    short: "Medical",      icon: "✚" },
  { id: 4, label: "Substance Use History",      short: "Substance",    icon: "⬡" },
  { id: 5, label: "Psychosocial & Legal",       short: "Psychosocial", icon: "⚖" },
  { id: 6, label: "Level of Care & Summary",    short: "Summary",      icon: "✓" },
];

// ─── REQUIRED FIELD DEFINITIONS ────────────────────────────────────────────
const REQUIRED_FIELD_LABELS = {
  // Step 1 - Client Identity
  clientFullName: 'Client Full Name',
  dateOfBirth: 'Date of Birth',
  // Step 1 - Referral
  referringAgency: 'Referring Agency / Professional',
  referralDate: 'Date of Referral',
  contactPerson: 'Contact Person',
  ssn: 'Social Security Number',
  livingSituation: 'Living Situation',
  county: 'County of Residence',
  presentingProblem: 'Presenting Problem',
  // Step 2
  primaryDiagnosis: 'Primary DSM-5 Diagnosis',
  diagnosisDate: 'Date Diagnosed',
  // Step 3
  pcpName: 'Primary Care Physician Name',
  medicalDiagnoses: 'Significant Medical Diagnoses',
  // Step 4
  primarySubstance: 'Primary Substance of Concern',
  // Step 5
  incomeSource: 'Primary Income Source',
  legalStatus: 'Legal Status',
  // Step 6
  levelOfCareNeeds: 'Level of Care Needs',
  strengthsSummary: 'Strengths Summary',
  assessorName: 'Assessor Printed Name',
  assessorSignature: 'Assessor Signature',
  assessorDate: 'Assessor Date',
};

const STEP_REQUIRED_FIELDS = {
  1: ['clientFullName', 'dateOfBirth', 'referringAgency', 'referralDate', 'contactPerson', 'ssn', 'livingSituation', 'county', 'presentingProblem'],
  2: ['primaryDiagnosis', 'diagnosisDate'],
  3: ['pcpName', 'medicalDiagnoses'],
  4: ['primarySubstance'],
  5: ['incomeSource', 'legalStatus'],
  6: ['levelOfCareNeeds', 'strengthsSummary', 'assessorName', 'assessorSignature', 'assessorDate'],
};

// ─── FIELD COMPONENTS ──────────────────────────────────────────────────────────
const inputStyle = {
  width: "100%", padding: "9px 12px", border: `1px solid ${C.bgBorder}`,
  borderRadius: 7, fontSize: 13, background: C.white, color: C.text,
  outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};
const labelStyle = {
  display: "block", fontSize: 12, fontWeight: 600, color: C.tealDark,
  marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em",
};
const sectionHeadStyle = {
  fontSize: 13, fontWeight: 700, color: C.teal, textTransform: "uppercase",
  letterSpacing: "0.08em", borderBottom: `2px solid ${C.bgBorder}`,
  paddingBottom: 7, marginBottom: 16, marginTop: 24,
};

function Field({ label, children, span = 1, required = false, error = null, hasError = false }) {
  return (
    <div style={{ gridColumn: `span ${span}` }}>
      {label && (
        <label style={{ ...labelStyle, color: hasError ? C.red : C.tealDark }}>
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
function TextInput({ value, onChange, placeholder, type = "text", hasError = false }) {
  return (
    <input
      type={type}
      value={value ?? ""}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        ...inputStyle,
        borderColor: hasError ? C.red : C.bgBorder,
        borderWidth: hasError ? '1.5px' : '1px',
        backgroundColor: hasError ? 'rgba(192,57,43,0.03)' : C.white,
      }}
    />
  );
}
function SelectInput({ value, onChange, options, hasError = false }) {
  return (
    <select
      value={value ?? ""}
      onChange={e => onChange(e.target.value)}
      style={{
        ...inputStyle,
        appearance: "none",
        borderColor: hasError ? C.red : C.bgBorder,
        borderWidth: hasError ? '1.5px' : '1px',
        backgroundColor: hasError ? 'rgba(192,57,43,0.03)' : C.white,
      }}
    >
      <option value="">— Select —</option>
      {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
    </select>
  );
}
function TextArea({ value, onChange, placeholder, rows = 3 }) {
  return <textarea value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />;
}
function CheckGroup({ label, options, selected = [], onChange }) {
  const toggle = (v) => selected.includes(v) ? onChange(selected.filter(x => x !== v)) : onChange([...selected, v]);
  return (
    <div>
      {label && <div style={{ ...labelStyle, marginBottom: 8 }}>{label}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
        {options.map(o => {
          const val = o.value ?? o; const lbl = o.label ?? o;
          const checked = selected.includes(val);
          return (
            <label key={val} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.text, cursor: "pointer" }}>
              <span onClick={() => toggle(val)} style={{
                width: 16, height: 16, borderRadius: 3,
                border: `1.5px solid ${checked ? C.teal : C.bgBorder}`,
                background: checked ? C.teal : C.white,
                display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
              }}>
                {checked && <span style={{ color: "#fff", fontSize: 10 }}>✓</span>}
              </span>
              {lbl}
            </label>
          );
        })}
      </div>
    </div>
  );
}
function RadioGroup({ label, options, value, onChange }) {
  return (
    <div>
      {label && <div style={{ ...labelStyle, marginBottom: 8 }}>{label}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px" }}>
        {options.map(o => {
          const val = o.value ?? o; const lbl = o.label ?? o;
          const checked = value === val;
          return (
            <label key={val} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.text, cursor: "pointer" }}>
              <span onClick={() => onChange(val)} style={{
                width: 16, height: 16, borderRadius: "50%",
                border: `1.5px solid ${checked ? C.teal : C.bgBorder}`,
                background: checked ? C.teal : C.white,
                display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
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
  return <div style={{ background: bg, border: `1px solid ${color}30`, borderLeft: `3px solid ${color}`, borderRadius: 7, padding: "10px 14px", fontSize: 13, color, marginBottom: 16, lineHeight: 1.6 }}>{children}</div>;
}
function AutoFilledBadge({ label, value }) {
  return (
    <div style={{ background: C.bgMid, border: `1px solid ${C.bgBorder}`, borderRadius: 7, padding: "9px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
      <span style={{ fontSize: 13, color: C.tealDark, fontWeight: 700 }}>{value || "—"}</span>
    </div>
  );
}

// ─── DOSAGE UNIT OPTIONS ──────────────────────────────────────────────────────
const DOSAGE_UNITS = [
  { value: 'mg', label: 'mg (milligrams)' },
  { value: 'mL', label: 'mL (milliliters)' },
  { value: 'units', label: 'units' },
  { value: 'tablets', label: 'tablets' },
  { value: 'capsules', label: 'capsules' },
  { value: 'drops', label: 'drops' },
  { value: 'grams', label: 'grams' },
  { value: 'mcg', label: 'mcg (micrograms)' },
  { value: 'IU', label: 'IU (International Units)' },
  { value: 'patches', label: 'patches' },
  { value: 'inhalers', label: 'inhalers' },
];

// ─── MEDICATION VALIDATION ────────────────────────────────────────────────────
function validateMedicationDosage(med) {
  // If medication name is empty, skip validation (optional medication)
  if (!med.name || !med.name.trim()) {
    return { valid: true, errors: [] };
  }

  const errors = [];

  // If medication is entered, dosage must be valid
  if (!med.dosageValue || isNaN(parseFloat(med.dosageValue)) || parseFloat(med.dosageValue) <= 0) {
    errors.push('Dosage must be a positive number');
  }

  if (!med.dosageUnit || !med.dosageUnit.trim()) {
    errors.push('Unit must be selected');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateMedicationsList(meds) {
  const allErrors = [];
  meds.forEach((med, idx) => {
    const validation = validateMedicationDosage(med);
    if (!validation.valid) {
      allErrors.push({
        medicationIndex: idx,
        medicationName: med.name,
        errors: validation.errors,
      });
    }
  });
  return {
    valid: allErrors.length === 0,
    errors: allErrors,
  };
}

// ─── BACKWARD COMPATIBILITY ────────────────────────────────────────────────────
function migrateLegacyMedicationFormat(meds) {
  if (!Array.isArray(meds)) return meds;

  return meds.map(med => {
    // If already in new format, return as-is
    if (med.dosageValue !== undefined || med.dosageUnit !== undefined) {
      return med;
    }

    // Migrate from legacy format: parse old dosage string like "500mg" into dosageValue and dosageUnit
    if (med.dosage && typeof med.dosage === 'string') {
      const match = med.dosage.match(/^([\d.]+)\s*([a-zA-Z]+)?$/);
      if (match) {
        const [, value, unit] = match;
        return {
          ...med,
          dosageValue: value,
          dosageUnit: unit || '',
        };
      } else {
        // If it can't be parsed, just clear it
        return {
          ...med,
          dosageValue: '',
          dosageUnit: '',
        };
      }
    }

    return med;
  });
}

// ─── MED ROW component ─────────────────────────────────────────────────────────
function MedRow({ med, onChange, onRemove, showFor = false, showPrescriber = true }) {
  // Validate dosage: must be a positive number
  const dosageError = med.dosageValue && (isNaN(parseFloat(med.dosageValue)) || parseFloat(med.dosageValue) <= 0) ? 'Must be a positive number' : null;
  // Validate unit: must be selected
  const unitError = med.dosageValue && !med.dosageUnit ? 'Unit required' : null;
  const hasDosageError = !!dosageError || !!unitError;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 0.8fr 0.9fr 2fr auto", gap: 8, alignItems: "end", marginBottom: 8 }}>
        <div>
          {med.index === 0 && <div style={labelStyle}>Medication Name</div>}
          <TextInput value={med.name} onChange={v => onChange({ ...med, name: v })} placeholder="Drug name" />
        </div>
        <div>
          {med.index === 0 && <div style={{ ...labelStyle, color: hasDosageError ? C.red : C.tealDark }}>Dosage<span style={{ color: C.red, marginLeft: 2 }}>*</span></div>}
          <TextInput
            type="number"
            value={med.dosageValue ?? ""}
            onChange={v => onChange({ ...med, dosageValue: v })}
            placeholder="e.g. 50"
            hasError={!!dosageError}
          />
          {dosageError && <div style={{ fontSize: 11, color: C.red, marginTop: 3, fontWeight: 500 }}>{dosageError}</div>}
        </div>
        <div>
          {med.index === 0 && <div style={{ ...labelStyle, color: hasDosageError ? C.red : C.tealDark }}>Unit<span style={{ color: C.red, marginLeft: 2 }}>*</span></div>}
          <SelectInput
            value={med.dosageUnit ?? ""}
            onChange={v => onChange({ ...med, dosageUnit: v })}
            options={DOSAGE_UNITS}
            hasError={!!unitError}
          />
          {unitError && <div style={{ fontSize: 11, color: C.red, marginTop: 3, fontWeight: 500 }}>{unitError}</div>}
        </div>
        <div>
          {med.index === 0 && <div style={labelStyle}>{showFor ? "For (Indication)" : "Prescriber"}</div>}
          <TextInput value={showFor ? med.indication : med.prescriber} onChange={v => onChange(showFor ? { ...med, indication: v } : { ...med, prescriber: v })} placeholder={showFor ? "e.g. Hypertension" : "Dr. name"} />
        </div>
        <button onClick={onRemove} style={{ background: C.redBg, border: `1px solid #fca5a5`, borderRadius: 6, color: C.red, fontSize: 16, width: 32, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginTop: med.index === 0 ? 21 : 0 }}>×</button>
      </div>
      {hasDosageError && med.index === 0 && (
        <div style={{ fontSize: 12, color: C.red, background: 'rgba(192,57,43,0.06)', border: `1px solid ${C.red}40`, borderRadius: 4, padding: "6px 10px", marginBottom: 12, fontWeight: 500 }}>
          Please specify dosage with unit (e.g., 500mg, 2 tablets)
        </div>
      )}
    </div>
  );
}

// ─── STEPS ─────────────────────────────────────────────────────────────────────

function Step1({ data, set, nursingData, errors = {} }) {
  return (
    <div>
      <InfoBox color={C.teal} bg={C.tealPale}>
        All fields marked with <span style={{ color: C.red, fontWeight: 700 }}>*</span> are required.
      </InfoBox>

      {/* Client Identity — Editable */}
      <SectionHead>Client Identity</SectionHead>
      <Grid cols={3}>
        <Field label="Client Full Name" required={true} error={errors.clientFullName} hasError={!!errors.clientFullName}>
          <TextInput value={data.clientFullName} onChange={v => set("clientFullName", v)} placeholder="Full legal name" hasError={!!errors.clientFullName} />
        </Field>
        <Field label="Date of Birth" required={true} error={errors.dateOfBirth} hasError={!!errors.dateOfBirth}>
          <TextInput type="date" value={data.dateOfBirth} onChange={v => set("dateOfBirth", v)} hasError={!!errors.dateOfBirth} />
        </Field>
        <Field label="Preferred Pronouns">
          <TextInput value={data.pronouns} onChange={v => set("pronouns", v)} placeholder="e.g., she/her, they/them" />
        </Field>
      </Grid>

      <SectionHead>Referral Information</SectionHead>
      <Grid cols={2}>
        <Field label="Referring Agency / Professional" span={2} required={true} error={errors.referringAgency} hasError={!!errors.referringAgency}>
          <TextInput value={data.referringAgency} onChange={v => set("referringAgency", v)} placeholder="Organization or professional name" hasError={!!errors.referringAgency} />
        </Field>
        <Field label="Date of Referral" required={true} error={errors.referralDate} hasError={!!errors.referralDate}>
          <TextInput type="date" value={data.referralDate} onChange={v => set("referralDate", v)} hasError={!!errors.referralDate} />
        </Field>
        <Field label="Contact Person" required={true} error={errors.contactPerson} hasError={!!errors.contactPerson}>
          <TextInput value={data.contactPerson} onChange={v => set("contactPerson", v)} placeholder="Referring contact name" hasError={!!errors.contactPerson} />
        </Field>
        <Field label="Contact Phone">
          <TextInput value={data.contactPhone} onChange={v => set("contactPhone", v)} placeholder="(503) 000-0000" />
        </Field>
        <Field label="Contact Email">
          <TextInput type="email" value={data.contactEmail} onChange={v => set("contactEmail", v)} placeholder="email@agency.org" />
        </Field>
      </Grid>

      <SectionHead>Funding & Insurance</SectionHead>
      <InfoBox color={C.amber} bg={C.amberBg}>
        SSN is required for most funding sources. OHP ID applies for Oregon Health Plan members.
      </InfoBox>
      <Grid cols={2}>
        <Field label="Social Security Number (SSN)" required={true} error={errors.ssn} hasError={!!errors.ssn}>
          <TextInput value={data.ssn} onChange={v => set("ssn", v)} placeholder="XXX-XX-XXXX" hasError={!!errors.ssn} />
        </Field>
        <Field label="Oregon Health Plan (OHP) ID">
          <TextInput value={data.ohpId} onChange={v => set("ohpId", v)} placeholder="OHP Member ID" />
        </Field>
        <Field label="Other Insurance">
          <TextInput value={data.otherInsurance} onChange={v => set("otherInsurance", v)} placeholder="Insurance carrier name" />
        </Field>
        <Field label="Other Insurance ID #">
          <TextInput value={data.otherInsuranceId} onChange={v => set("otherInsuranceId", v)} placeholder="Member / policy ID" />
        </Field>
      </Grid>

      <SectionHead>Current Living Situation</SectionHead>
      <Grid cols={2}>
        <Field label="Living Situation" required={true} error={errors.livingSituation} hasError={!!errors.livingSituation}>
          <SelectInput value={data.livingSituation} onChange={v => set("livingSituation", v)} options={[
            "Family Home","Own Apartment/House","Homeless/Unsheltered","Emergency Shelter",
            "Hospital","Jail/Correctional Facility","Another Residential Program","Other",
          ]} hasError={!!errors.livingSituation} />
        </Field>
        <Field label="County of Residence" required={true} error={errors.county} hasError={!!errors.county}>
          <SelectInput value={data.county} onChange={v => set("county", v)} options={[
            "Benton","Clackamas","Clatsop","Columbia","Coos","Crook","Curry","Deschutes",
            "Douglas","Gilliam","Grant","Harney","Hood River","Jackson","Jefferson","Josephine",
            "Klamath","Lake","Lane","Lincoln","Linn","Malheur","Marion","Morrow","Multnomah",
            "Polk","Sherman","Tillamook","Umatilla","Union","Wallowa","Wasco","Washington",
            "Wheeler","Yamhill",
          ]} hasError={!!errors.county} />
        </Field>
      </Grid>

      <SectionHead>Presenting Problem</SectionHead>
      <Field label="Current crisis, symptoms, and primary reasons residential treatment is being sought" required={true} error={errors.presentingProblem} hasError={!!errors.presentingProblem} span={2}>
        <TextArea value={data.presentingProblem} onChange={v => set("presentingProblem", v)}
          placeholder="Describe the presenting crisis in detail — what brought this client to seek residential treatment at this time..." rows={5} />
      </Field>
    </div>
  );
}

function Step2({ data, set, errors = {} }) {
  const [psychMeds, setPsychMeds] = useState(() => {
    const meds = data.psychMeds || [{ id: 1, name: "", dosageValue: "", dosageUnit: "", prescriber: "", index: 0 }];
    return migrateLegacyMedicationFormat(meds);
  });

  const syncMeds = (updated) => {
    setPsychMeds(updated);
    set("psychMeds", updated);
  };
  const addMed = () => syncMeds([...psychMeds, { id: Date.now(), name: "", dosageValue: "", dosageUnit: "", prescriber: "", index: psychMeds.length }]);
  const removeMed = (id) => syncMeds(psychMeds.filter(m => m.id !== id).map((m, i) => ({ ...m, index: i })));
  const updateMed = (id, updated) => syncMeds(psychMeds.map(m => m.id === id ? { ...updated, index: m.index } : m));

  return (
    <div>
      <InfoBox color={C.teal} bg={C.tealPale}>
        This section focuses on psychiatric diagnosis and current outpatient treatment team. Substance use history and violence/trauma history are captured in later steps or already in the Nursing Assessment.
      </InfoBox>

      <SectionHead>Psychiatric Diagnosis</SectionHead>
      <Grid cols={2}>
        <Field label="Primary DSM-5 Diagnosis" required={true} error={errors.primaryDiagnosis} hasError={!!errors.primaryDiagnosis}>
          <TextInput value={data.primaryDiagnosis} onChange={v => set("primaryDiagnosis", v)} placeholder="e.g., Schizophrenia, F20.9" hasError={!!errors.primaryDiagnosis} />
        </Field>
        <Field label="Date Diagnosed" required={true} error={errors.diagnosisDate} hasError={!!errors.diagnosisDate}>
          <TextInput type="date" value={data.diagnosisDate} onChange={v => set("diagnosisDate", v)} hasError={!!errors.diagnosisDate} />
        </Field>
        <Field label="Secondary Diagnoses" span={2}>
          <TextInput value={data.secondaryDiagnoses} onChange={v => set("secondaryDiagnoses", v)} placeholder="e.g., PTSD, Substance Use Disorder, Generalized Anxiety..." />
        </Field>
      </Grid>

      <SectionHead>Current Prescribed Psychotropic Medications</SectionHead>
      {errors.psychMeds && (
        <div style={{ fontSize: 12, color: C.red, background: 'rgba(192,57,43,0.06)', border: `1px solid ${C.red}40`, borderRadius: 4, padding: "8px 12px", marginBottom: 12, fontWeight: 500 }}>
          {errors.psychMeds}
        </div>
      )}
      <div style={{ marginBottom: 8 }}>
        {psychMeds.map(med => (
          <MedRow key={med.id} med={med} onChange={updated => updateMed(med.id, updated)} onRemove={() => removeMed(med.id)} showFor={false} />
        ))}
      </div>
      <button onClick={addMed} style={{
        background: C.tealPale, border: `1px dashed ${C.teal}`, borderRadius: 7,
        color: C.teal, fontSize: 13, fontWeight: 600, padding: "8px 18px", cursor: "pointer", width: "100%",
      }}>+ Add Psychotropic Medication</button>

      <SectionHead>Psychiatric History</SectionHead>
      <Grid cols={2}>
        <Field label="History of Psychiatric Hospitalizations?">
          <RadioGroup value={data.psychHx} onChange={v => set("psychHx", v)} options={["Yes","No"]} />
        </Field>
        {data.psychHx === "Yes" && (
          <>
            <Field label="Most Recent Hospitalization Date">
              <TextInput type="date" value={data.psychHxDate} onChange={v => set("psychHxDate", v)} />
            </Field>
            <Field label="Reason for Most Recent Hospitalization" span={2}>
              <TextInput value={data.psychHxReason} onChange={v => set("psychHxReason", v)} placeholder="e.g., Acute psychosis, suicidal ideation..." />
            </Field>
          </>
        )}
      </Grid>

      <div style={{ marginTop: 16 }}>
        <InfoBox color={C.textMuted} bg="#f5f5f5">
          Suicide/self-harm history and violence/aggression history were captured in the Nursing Assessment (Steps 6 & 7). They will be auto-linked to this screening record.
        </InfoBox>
      </div>

      <SectionHead>Current Outpatient Support Team</SectionHead>
      <Grid cols={2}>
        <Field label="Outpatient Therapist">
          <TextInput value={data.therapistName} onChange={v => set("therapistName", v)} placeholder="Full name" />
        </Field>
        <Field label="Therapist Phone">
          <TextInput value={data.therapistPhone} onChange={v => set("therapistPhone", v)} placeholder="(503) 000-0000" />
        </Field>
        <Field label="Psychiatrist / Prescriber">
          <TextInput value={data.psychiatristName} onChange={v => set("psychiatristName", v)} placeholder="Full name" />
        </Field>
        <Field label="Psychiatrist Phone">
          <TextInput value={data.psychiatristPhone} onChange={v => set("psychiatristPhone", v)} placeholder="(503) 000-0000" />
        </Field>
        <Field label="Case Manager">
          <TextInput value={data.caseManagerName} onChange={v => set("caseManagerName", v)} placeholder="Full name" />
        </Field>
        <Field label="Case Manager Phone">
          <TextInput value={data.caseManagerPhone} onChange={v => set("caseManagerPhone", v)} placeholder="(503) 000-0000" />
        </Field>
      </Grid>
    </div>
  );
}

function Step3({ data, set, errors = {} }) {
  const [nonPsychMeds, setNonPsychMeds] = useState(() => {
    const meds = data.nonPsychMeds || [{ id: 1, name: "", dosageValue: "", dosageUnit: "", indication: "", index: 0 }];
    return migrateLegacyMedicationFormat(meds);
  });

  const syncMeds = (updated) => { setNonPsychMeds(updated); set("nonPsychMeds", updated); };
  const addMed = () => syncMeds([...nonPsychMeds, { id: Date.now(), name: "", dosageValue: "", dosageUnit: "", indication: "", index: nonPsychMeds.length }]);
  const removeMed = (id) => syncMeds(nonPsychMeds.filter(m => m.id !== id).map((m, i) => ({ ...m, index: i })));
  const updateMed = (id, updated) => syncMeds(nonPsychMeds.map(m => m.id === id ? { ...updated, index: m.index } : m));

  return (
    <div>
      <InfoBox color={C.teal} bg={C.tealPale}>
        Vital signs, allergies, skin findings, and ADL functional levels were already captured in the Nursing Assessment. This section covers medical diagnoses, non-psychiatric medications, and communicable disease status unique to the pre-screening.
      </InfoBox>

      <SectionHead>Primary Care Physician</SectionHead>
      <Grid cols={3}>
        <Field label="PCP Name" required={true} error={errors.pcpName} hasError={!!errors.pcpName}>
          <TextInput value={data.pcpName} onChange={v => set("pcpName", v)} placeholder="Dr. full name" hasError={!!errors.pcpName} />
        </Field>
        <Field label="PCP Phone">
          <TextInput value={data.pcpPhone} onChange={v => set("pcpPhone", v)} placeholder="(503) 000-0000" />
        </Field>
        <Field label="PCP Fax">
          <TextInput value={data.pcpFax} onChange={v => set("pcpFax", v)} placeholder="(503) 000-0000" />
        </Field>
      </Grid>

      <SectionHead>Significant Medical Diagnoses</SectionHead>
      <Field label="List all significant medical diagnoses (e.g., Diabetes, Hypertension, Seizure Disorder, Chronic Pain, Asthma)" required={true} error={errors.medicalDiagnoses} hasError={!!errors.medicalDiagnoses} span={2}>
        <TextArea value={data.medicalDiagnoses} onChange={v => set("medicalDiagnoses", v)}
          placeholder="List each diagnosis, one per line or comma-separated..." rows={4} />
      </Field>

      <SectionHead>Current Non-Psychiatric Medications</SectionHead>
      {errors.nonPsychMeds && (
        <div style={{ fontSize: 12, color: C.red, background: 'rgba(192,57,43,0.06)', border: `1px solid ${C.red}40`, borderRadius: 4, padding: "8px 12px", marginBottom: 12, fontWeight: 500 }}>
          {errors.nonPsychMeds}
        </div>
      )}
      <div style={{ marginBottom: 8 }}>
        {nonPsychMeds.map(med => (
          <MedRow key={med.id} med={med} onChange={updated => updateMed(med.id, updated)} onRemove={() => removeMed(med.id)} showFor={true} />
        ))}
      </div>
      <button onClick={addMed} style={{
        background: C.tealPale, border: `1px dashed ${C.teal}`, borderRadius: 7,
        color: C.teal, fontSize: 13, fontWeight: 600, padding: "8px 18px", cursor: "pointer", width: "100%",
      }}>+ Add Non-Psychiatric Medication</button>

      <SectionHead>Mobility & Physical Functioning</SectionHead>
      <InfoBox color={C.textMuted} bg="#f5f5f5">
        Detailed ADL levels (eating, bathing, toileting, ambulation, etc.) and assistive devices are already recorded in the Nursing Assessment. Record only additional context here.
      </InfoBox>
      <Grid cols={2}>
        <Field label="Mobility Status">
          <RadioGroup value={data.mobilityStatus} onChange={v => set("mobilityStatus", v)}
            options={["Fully Independent","Uses Assistive Device","Wheelchair User"]} />
        </Field>
        {data.mobilityStatus === "Uses Assistive Device" && (
          <Field label="Assistive Device Type">
            <SelectInput value={data.assistiveDevice} onChange={v => set("assistiveDevice", v)}
              options={["Cane","Walker","Crutches","Other"]} />
          </Field>
        )}
        <Field label="ADL Assistance Needs — Additional Notes" span={2}>
          <TextArea value={data.adlNotes} onChange={v => set("adlNotes", v)}
            placeholder="Describe any specific ADL assistance needs not captured in Nursing Assessment (bathing approach, dressing preferences, medication administration details)..." rows={3} />
        </Field>
      </Grid>

      <SectionHead>Communicable Disease Status</SectionHead>
      <Grid cols={2}>
        <Field label="TB Test Result">
          <RadioGroup value={data.tbResult} onChange={v => set("tbResult", v)}
            options={["Positive","Negative","Unknown"]} />
        </Field>
        <Field label="Date of Last TB Test">
          <TextInput type="date" value={data.tbTestDate} onChange={v => set("tbTestDate", v)} />
        </Field>
        <Field label="COVID-19 Vaccination Status">
          <SelectInput value={data.covidVaxStatus} onChange={v => set("covidVaxStatus", v)}
            options={["Fully Vaccinated","Partially Vaccinated","Not Vaccinated","Booster Received","Unknown / Declined to State"]} />
        </Field>
        <Field label="Other Communicable Disease Status (Hep, HIV)">
          <TextInput value={data.otherCommunicable} onChange={v => set("otherCommunicable", v)} placeholder="e.g., Hep C — managed, HIV negative..." />
        </Field>
      </Grid>
    </div>
  );
}

function Step4({ data, set, errors = {} }) {
  return (
    <div>
      <InfoBox color={C.amber} bg={C.amberBg}>
        The AUDIT-C alcohol screening and detailed mental status assessment were completed in the Nursing Assessment. This section captures the clinical substance use history and prior treatment episodes required for the pre-admission record.
      </InfoBox>

      <SectionHead>Primary Substance of Concern</SectionHead>
      <Grid cols={2}>
        <Field label="Primary Substance" required={true} error={errors.primarySubstance} hasError={!!errors.primarySubstance}>
          <SelectInput value={data.primarySubstance} onChange={v => set("primarySubstance", v)} options={[
            "Alcohol","Opioids (heroin, fentanyl)","Opioids (prescription)","Methamphetamine",
            "Cocaine/Crack","Benzodiazepines","Cannabis/Marijuana","Hallucinogens",
            "Inhalants","Barbiturates","Other",
          ]} hasError={!!errors.primarySubstance} />
        </Field>
        <Field label="Secondary Substance(s)">
          <TextInput value={data.secondarySubstances} onChange={v => set("secondarySubstances", v)} placeholder="List any additional substances..." />
        </Field>
        <Field label="Date of Last Use">
          <TextInput type="date" value={data.lastUseDate} onChange={v => set("lastUseDate", v)} />
        </Field>
        <Field label="Route of Use (Primary Substance)">
          <SelectInput value={data.routeOfUse} onChange={v => set("routeOfUse", v)}
            options={["Oral","Intravenous (IV)","Intranasal (snorting)","Smoking/Inhaled","Transdermal","Other"]} />
        </Field>
      </Grid>

      <SectionHead>Withdrawal History</SectionHead>
      <Grid cols={2}>
        <Field label="History of Withdrawal Symptoms?">
          <RadioGroup value={data.withdrawalHx} onChange={v => set("withdrawalHx", v)} options={["Yes","No"]} />
        </Field>
        {data.withdrawalHx === "Yes" && (
          <Field label="Describe (e.g., Seizures, Delirium Tremens, Severe Tremors)">
            <TextInput value={data.withdrawalDetails} onChange={v => set("withdrawalDetails", v)} placeholder="Type and severity of withdrawal symptoms..." />
          </Field>
        )}
      </Grid>

      <SectionHead>Previous Treatment Episodes</SectionHead>
      <Field label="Describe prior treatment (Detox, Residential, Outpatient, MAT, etc.)">
        <TextArea value={data.previousTreatment} onChange={v => set("previousTreatment", v)}
          placeholder="List previous treatment programs, approximate dates, outcomes..." rows={4} />
      </Field>
    </div>
  );
}

function Step5({ data, set, errors = {} }) {
  return (
    <div>
      <InfoBox color={C.teal} bg={C.tealPale}>
        Trauma history and violence/aggression risk were captured in the Nursing Assessment. This section focuses on psychosocial context, legal status, and client strengths — unique to the pre-admission screening.
      </InfoBox>

      <SectionHead>Income & Financial</SectionHead>
      <Grid cols={2}>
        <Field label="Primary Income Source" required={true} error={errors.incomeSource} hasError={!!errors.incomeSource}>
          <SelectInput value={data.incomeSource} onChange={v => set("incomeSource", v)} options={[
            "SSI (Supplemental Security Income)","SSDI (Social Security Disability)","Employment (full-time)",
            "Employment (part-time)","SNAP / Food Stamps","No Income","Family Support","Other",
          ]} hasError={!!errors.incomeSource} />
        </Field>
        <Field label="Additional Income Details">
          <TextInput value={data.incomeDetails} onChange={v => set("incomeDetails", v)} placeholder="Any additional context..." />
        </Field>
      </Grid>

      <SectionHead>Legal Status</SectionHead>
      <Grid cols={2}>
        <Field label="Legal Status" required={true} error={errors.legalStatus} hasError={!!errors.legalStatus}>
          <SelectInput value={data.legalStatus} onChange={v => set("legalStatus", v)} options={[
            "None","Probation","Parole","Outstanding Warrants","Civil Commitment",
            "Guardianship","Pre-Trial","Other",
          ]} hasError={!!errors.legalStatus} />
        </Field>
        {["Probation","Parole","Civil Commitment","Pre-Trial"].includes(data.legalStatus) && (
          <>
            <Field label="Probation / Parole Officer Name">
              <TextInput value={data.poName} onChange={v => set("poName", v)} placeholder="Officer full name" />
            </Field>
            <Field label="Officer Phone">
              <TextInput value={data.poPhone} onChange={v => set("poPhone", v)} placeholder="(503) 000-0000" />
            </Field>
          </>
        )}
        <Field label="Legal Conditions of Supervision" span={2}>
          <TextArea value={data.legalConditions} onChange={v => set("legalConditions", v)}
            placeholder="Describe any court-ordered conditions relevant to placement (e.g., no alcohol, mandatory treatment, curfew)..." rows={3} />
        </Field>
      </Grid>

      <SectionHead>Trauma Context</SectionHead>
      <InfoBox color={C.textMuted} bg="#f5f5f5">
        Type and history of trauma was recorded in the Nursing Assessment. Only willingness to engage in trauma-focused treatment is captured here.
      </InfoBox>
      <Grid cols={2}>
        <Field label="Willing to Discuss Trauma in Treatment?">
          <RadioGroup value={data.willingToDiscussTrauma} onChange={v => set("willingToDiscussTrauma", v)}
            options={["Yes","No","Not at this time"]} />
        </Field>
      </Grid>

      <SectionHead>Client Strengths & Interests</SectionHead>
      <Field label="Personal strengths, hobbies, interests, and goals that can support treatment">
        <TextArea value={data.clientStrengths} onChange={v => set("clientStrengths", v)}
          placeholder="What does the client identify as their strengths? Hobbies, support networks, vocational goals, personal values..." rows={4} />
      </Field>

      <SectionHead>Oregon Resources & Community Connections</SectionHead>
      <Grid cols={2}>
        <Field label="Assessed for ABH (Adult Behavioral Health) Home?">
          <RadioGroup value={data.abhAssessed} onChange={v => set("abhAssessed", v)} options={["Yes","No","N/A"]} />
        </Field>
        <Field label="Connected to LMHA or Certified Agency?">
          <RadioGroup value={data.lmhaConnected} onChange={v => set("lmhaConnected", v)} options={["Yes","No"]} />
        </Field>
        {data.lmhaConnected === "Yes" && (
          <>
            <Field label="Agency Name">
              <TextInput value={data.lmhaAgency} onChange={v => set("lmhaAgency", v)} placeholder="Agency name" />
            </Field>
            <Field label="Agency Contact">
              <TextInput value={data.lmhaContact} onChange={v => set("lmhaContact", v)} placeholder="Contact name or phone" />
            </Field>
          </>
        )}
        <Field label="On Waitlist for Other Services?" span={2}>
          <TextInput value={data.waitlistServices} onChange={v => set("waitlistServices", v)}
            placeholder="e.g., Section 8 housing, Supported Employment, ACT Team..." />
        </Field>
      </Grid>
    </div>
  );
}

function Step6({ data, set, allData, errors = {} }) {
  const completedSections = STEPS.slice(0, 5).map((s, i) => {
    const d = allData[i + 1] || {};
    const keys = Object.keys(d);
    const filled = keys.filter(k => { const v = d[k]; return v && (Array.isArray(v) ? v.length > 0 : v !== ""); }).length;
    const pct = keys.length > 0 ? Math.round((filled / keys.length) * 100) : 0;
    return { ...s, pct };
  });

  return (
    <div>
      <SectionHead>Level of Care Needs</SectionHead>
      <InfoBox color={C.teal} bg={C.tealPale}>
        Check all services and supports this client will require. This determines placement appropriateness. At least one is required.
      </InfoBox>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        {[
          { value: "24hr_supervision", label: "24-Hour Staff Supervision" },
          { value: "med_admin", label: "Medication Administration & Monitoring" },
          { value: "adl_assist", label: "Assistance with ADLs" },
          { value: "dementia", label: "Specialized Dementia / Alzheimer's Care" },
          { value: "cbt_dbt", label: "CBT or DBT Skills Groups" },
          { value: "sud_programming", label: "Substance Use Disorder (SUD) Programming" },
          { value: "wheelchair", label: "Wheelchair Accessible Facility" },
          { value: "secure", label: "Secure Facility (Elopement Risk)" },
          { value: "dietary", label: "Specialized Dietary Needs (Diabetic, Pureed)" },
          { value: "other", label: "Other (describe below)" },
        ].map(item => {
          const checked = (data.levelOfCareNeeds || []).includes(item.value);
          return (
            <div key={item.value} onClick={() => {
              const cur = data.levelOfCareNeeds || [];
              set("levelOfCareNeeds", checked ? cur.filter(x => x !== item.value) : [...cur, item.value]);
            }} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
              background: checked ? C.bgMid : C.white,
              border: `1.5px solid ${checked ? C.teal : C.border}`,
              borderRadius: 8, cursor: "pointer", transition: "all 0.15s",
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${checked ? C.teal : C.bgBorder}`,
                background: checked ? C.teal : C.white, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                {checked && <span style={{ color: "#fff", fontSize: 11 }}>✓</span>}
              </span>
              <span style={{ fontSize: 13, color: C.text, fontWeight: checked ? 600 : 400 }}>{item.label}</span>
            </div>
          );
        })}
      </div>
      {(data.levelOfCareNeeds || []).includes("other") && (
        <Field label="Describe Other Level of Care Needs">
          <TextInput value={data.levelOfCareOther} onChange={v => set("levelOfCareOther", v)} placeholder="Specify other needs..." />
        </Field>
      )}

      <SectionHead>Assessor Summary & Recommendation</SectionHead>
      <InfoBox color={C.amber} bg={C.amberBg}>
        For the assessor professional to complete. Summarize why this client is appropriate for a residential level of care and what the treatment goals would be.
      </InfoBox>
      <Grid cols={1}>
        <Field label="Client's Strengths Summary (Assessor's clinical perspective)" required={true} error={errors.strengthsSummary} hasError={!!errors.strengthsSummary}>
          <TextArea value={data.strengthsSummary} onChange={v => set("strengthsSummary", v)}
            placeholder="Summarize the client's clinical and personal strengths that support residential treatment..." rows={3} />
        </Field>
        <Field label="Barriers to Placement">
          <TextArea value={data.barriersToPlacement} onChange={v => set("barriersToPlacement", v)}
            placeholder="Describe any barriers that may affect or delay placement (medical, legal, logistical, behavioral)..." rows={3} />
        </Field>
        <Field label="Assessor Recommendation">
          <TextArea value={data.assessorRecommendation} onChange={v => set("assessorRecommendation", v)}
            placeholder="Clinical rationale for residential placement and proposed treatment goals..." rows={4} />
        </Field>
        <Field label="Screening Outcome">
          <SelectInput value={data.screeningOutcome} onChange={v => set("screeningOutcome", v)} options={[
            { value: "approved", label: "Approved — Appropriate for Placement" },
            { value: "not_appropriate", label: "Not Appropriate — Declined" },
            { value: "deferred_waitlisted", label: "Deferred / Waitlisted" },
          ]} />
        </Field>
        {data.screeningOutcome === "approved" && (
          <Field label="Conditions Prior to Admission (if any)">
            <TextArea value={data.conditionsPriorAdmission} onChange={v => set("conditionsPriorAdmission", v)}
              placeholder="e.g., Medical clearance required, legal hold resolved, insurance authorization..." rows={2} />
          </Field>
        )}
      </Grid>

      <SectionHead>Section Completion</SectionHead>
      <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
        {completedSections.map(s => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 14, background: C.white, border: `1px solid ${C.border}`, borderRadius: 7, padding: "9px 14px" }}>
            <span style={{ fontSize: 15, color: C.teal }}>{s.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: C.text, flex: 1 }}>{s.label}</span>
            <div style={{ width: 100, height: 5, background: C.bgMid, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${Math.min(s.pct, 100)}%`, height: "100%", background: s.pct > 60 ? C.green : C.gold, borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 12, color: C.textMuted, width: 36, textAlign: "right" }}>{s.pct}%</span>
          </div>
        ))}
      </div>

      <SectionHead>Assessor Sign-Off</SectionHead>
      <Grid cols={2}>
        <Field label="Assessor Printed Name" required={true} error={errors.assessorName} hasError={!!errors.assessorName}>
          <TextInput value={data.assessorName} onChange={v => set("assessorName", v)} placeholder="Full name" hasError={!!errors.assessorName} />
        </Field>
        <Field label="Title / Credentials">
          <TextInput value={data.assessorTitle} onChange={v => set("assessorTitle", v)} placeholder="e.g., QMHP, LCSW, MSW" />
        </Field>
        <Field label="Signature (Type to Acknowledge)" required={true} error={errors.assessorSignature} hasError={!!errors.assessorSignature}>
          <TextInput value={data.assessorSignature} onChange={v => set("assessorSignature", v)} placeholder="Type full name to sign" hasError={!!errors.assessorSignature} />
        </Field>
        <Field label="Date" required={true} error={errors.assessorDate} hasError={!!errors.assessorDate}>
          <TextInput type="date" value={data.assessorDate} onChange={v => set("assessorDate", v)} hasError={!!errors.assessorDate} />
        </Field>
      </Grid>

      <div style={{ marginTop: 20, background: C.tealPale, border: `1px solid ${C.bgBorder}`, borderRadius: 10, padding: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.tealDark, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Oregon Crisis Resources</div>
        <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 2 }}>
          988 — Suicide & Crisis Lifeline &nbsp;|&nbsp; Lines for Life: 1-800-273-8255
        </div>
        <Field label="Local County Mental Health Crisis Line">
          <TextInput value={data.localCrisisLine} onChange={v => set("localCrisisLine", v)} placeholder="County-specific crisis line number..." />
        </Field>
      </div>
    </div>
  );
}

// ─── VALIDATION HELPERS ───────────────────────────────────────────────────────
const isStepComplete = (data, stepId) => {
  const required = STEP_REQUIRED_FIELDS[stepId] || [];
  return required.every(field => {
    const val = data[field];
    return val && (Array.isArray(val) ? val.length > 0 : val !== '' && val !== null);
  });
};

const getStepErrors = (data, stepId) => {
  const required = STEP_REQUIRED_FIELDS[stepId] || [];
  const errors = {};
  required.forEach(field => {
    const val = data[field];
    if (!val || (Array.isArray(val) && val.length === 0)) {
      errors[field] = `${REQUIRED_FIELD_LABELS[field] || field} is required`;
    }
  });

  // Validate medications for Step 2 (Psychotropic) and Step 3 (Non-Psychiatric)
  if (stepId === 2 && data.psychMeds && Array.isArray(data.psychMeds)) {
    const medValidation = validateMedicationsList(data.psychMeds);
    if (!medValidation.valid && medValidation.errors.length > 0) {
      const errorMessages = medValidation.errors.map(err =>
        `${err.medicationName}: ${err.errors.join(', ')}`
      ).join('; ');
      errors.psychMeds = `Invalid medication dosage: ${errorMessages}`;
    }
  }

  if (stepId === 3 && data.nonPsychMeds && Array.isArray(data.nonPsychMeds)) {
    const medValidation = validateMedicationsList(data.nonPsychMeds);
    if (!medValidation.valid && medValidation.errors.length > 0) {
      const errorMessages = medValidation.errors.map(err =>
        `${err.medicationName}: ${err.errors.join(', ')}`
      ).join('; ');
      errors.nonPsychMeds = `Invalid medication dosage: ${errorMessages}`;
    }
  }

  return errors;
};

const formDataChanged = (initial, current) => {
  if (!initial) return false;
  const initialStr = JSON.stringify(initial);
  const currentStr = JSON.stringify(current);
  return initialStr !== currentStr;
};

const PRESCREENING_DRAFT_KEY = 'admission_prescreening_draft';

function ResumeDraftDialog({ isOpen, onResume, onDiscard, accentColor, accentBg, accentBorder }) {
  if (!isOpen) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(9,38,42,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 32, maxWidth: 440, width: "90%", boxShadow: "0 20px 25px rgba(0,0,0,0.15)" }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: accentColor, marginBottom: 10 }}>Resume your draft?</div>
        <div style={{ fontSize: 13, color: "#4a7275", lineHeight: 1.6, marginBottom: 24 }}>
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

// ─── CONFIRM DIALOG COMPONENT ──────────────────────────────────────────────────
function ConfirmDialog({ isOpen, title, message, onDiscard, onKeepEditing }) {
  if (!isOpen) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(9,38,42,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
      <div style={{ background: C.white, borderRadius: 12, padding: 32, maxWidth: 420, boxShadow: "0 20px 25px rgba(0,0,0,0.15)" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.tealDark, marginBottom: 12 }}>{title}</div>
        <div style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6, marginBottom: 24 }}>{message}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onKeepEditing} style={{ padding: "9px 20px", background: C.tealPale, border: `1px solid ${C.bgBorder}`, borderRadius: 7, fontSize: 13, fontWeight: 600, color: C.teal, cursor: "pointer" }}>Keep Editing</button>
          <button onClick={onDiscard} style={{ padding: "9px 20px", background: C.red, border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, color: C.white, cursor: "pointer" }}>Discard Changes</button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN WIZARD ───────────────────────────────────────────────────────────────
export default function PreAdmissionWizard({ onClose, nursingData = {} }) {
  const router = useRouter();
  const { auth, loading: authLoading } = useAuth() || {};
  const accessToken = auth?.accessToken;
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const isMobile = useIsMobile(768);
  const [stepNavOpen, setStepNavOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  // Standalone pre-screening id. Accept ?screening_id= (new) and ?admission_id=
  // (legacy links) so older bookmarks still resume the right draft.
  const [admissionId, setAdmissionId] = useState(() => {
    if (typeof window === 'undefined') return null;
    const sp = new URLSearchParams(window.location.search);
    return sp.get('screening_id') || sp.get('admission_id');
  });
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

  // Load previously saved form data on mount if admissionId is provided
  useEffect(() => {
    const loadFormData = async () => {
      if (authLoading) return;
      if (!admissionId) {
        setIsLoading(false);
        const emptyState = Object.fromEntries(STEPS.map(s => [s.id, {}]));
        setInitialFormData(emptyState);
        return;
      }

      try {
        const response = await fetch(`/api/v1/admission/pre-screening/${admissionId}`, {
          headers: {
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          credentials: 'same-origin',
        });

        if (response.ok) {
          const result = await response.json();
          const admission = result.data;

          // Restore per-step buckets from the persisted draft. New drafts store
          // the exact buckets under `__steps`; legacy flat drafts fall back to
          // step 1 (see bucketsFromBlob). The old code dumped the flat blob into
          // a single bucket and left the rest empty, so a reopened pre-screening
          // looked incomplete and could not be finished.
          const loaded = bucketsFromBlob(
            admission.pre_screening_data,
            STEPS.map(s => s.id),
          );

          setFormData(loaded);
          setInitialFormData(loaded);
        }
      } catch (error) {
        // Continue with empty form if load fails
        const emptyState = Object.fromEntries(STEPS.map(s => [s.id, {}]));
        setInitialFormData(emptyState);
      } finally {
        setIsLoading(false);
      }
    };

    loadFormData();
  }, [admissionId, accessToken, authLoading]);

  // ── Check sessionStorage for draft on mount (after server-load settles)
  useEffect(() => {
    if (isLoading) return;
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(PRESCREENING_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const timer = setTimeout(() => {
          setPendingDraft(parsed);
          setResumeDraftPrompt(true);
        }, 0);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore corrupt draft
    }
  }, [isLoading]);

  // ── Periodic autosave to sessionStorage every 30 seconds when dirty
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saveTimer = setInterval(() => {
      if (isDirty) {
        try {
          sessionStorage.setItem(PRESCREENING_DRAFT_KEY, JSON.stringify(formData));
          setLastSavedTime(new Date());
          setIsDirty(false);
        } catch {
          // storage quota exceeded — silently skip
        }
      }
    }, 30000);
    return () => clearInterval(saveTimer);
  }, [formData, isDirty]);

  // Track which fields the user has interacted with so on-blur format checks
  // only flag fields that were actually "entered wrongly" (not pristine ones).
  const touchedRef = useRef(new Set());

  const set = useCallback((stepId) => (key, val) => {
    touchedRef.current.add(key);
    setFormData(prev => ({ ...prev, [stepId]: { ...prev[stepId], [key]: val } }));
    setSaved(false);
    setIsDirty(true);
    // Clear error for this field once user starts correcting it
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[key];
      return newErrors;
    });
  }, []);

  // On blur (focusout anywhere in the step body) re-check the format of any
  // touched, non-empty field and surface problems in the right-side guide.
  const handleBlurValidate = useCallback(() => {
    const rules = PRE_SCREENING_RULES[step];
    if (!rules) return;
    const fmtErrors = validateRuleSet(formData[step], rules, REQUIRED_FIELD_LABELS, {
      only: Array.from(touchedRef.current),
      skipEmpty: true,
    });
    setErrors(prev => ({ ...prev, ...fmtErrors }));
  }, [step, formData]);

  const handleSaveDraft = async (markComplete = false) => {
    if (!accessToken) {
      setSubmitError('Please log in again before saving this admission form.');
      return false;
    }
    // Defensive: callers like onClick={() => handleSaveDraft()} pass nothing,
    // but guard against a stray event/object ever reaching JSON.stringify
    // (a React event here throws "circular structure" and fails silently).
    markComplete = markComplete === true;
    setSaving(true);
    setSubmitError(null);
    try {
      const allData = Object.assign({}, ...Object.values(formData));

      // Map wizard fields onto the typed columns the API understands. Anything
      // not listed here still flows through in the JSONB blob via formData.
      const mapped = {
        full_name: allData.clientFullName || allData.fullName || allData.full_name,
        date_of_birth: allData.dateOfBirth || allData.date_of_birth,
        pronoun: allData.pronouns,
        contact_phone: allData.contactPhone || allData.contact_phone,
        email: allData.email,
        address_line1: allData.address || allData.address_line1,
        city: allData.city,
        state: allData.state,
        postal_code: allData.zip || allData.postal_code,
        primary_physician: allData.pcpName || allData.primary_physician,
        primary_physician_phone: allData.pcpPhone || allData.primary_physician_phone,
        primary_diagnosis: allData.primaryDiagnosis || allData.primary_diagnosis,
        allergies: allData.allergies,
        current_medications: allData.currentMedications || allData.current_medications,
        medical_conditions: allData.medicalDiagnoses || allData.medical_conditions,
        emergency_contact: allData.emergencyContactName || allData.emergency_contact,
        emergency_contact_phone: allData.emergencyContactPhone || allData.emergency_contact_phone,
        emergency_contact_relationship: allData.emergencyContactRelationship,
        legal_status: allData.legalStatus,
        has_guardian: allData.hasGuardian === 'Yes',
        guardian_representative: allData.guardianName,
        insurance_type: allData.insuranceType,
        insurance_member_id: allData.insuranceMemberId,
        insurance_group_number: allData.insuranceGroupNumber,
        insurance_provider: allData.insuranceProvider,
        insurance_contact_phone: allData.insuranceContactPhone,
        medicaid_id: allData.medicaidId,
        ssn_last4: allData.ssn ? String(allData.ssn).slice(-4) : null,
        substance_use_flag: !!allData.primarySubstance,
        legal_risk_flag: allData.legalStatus && allData.legalStatus !== 'None',
        spiritual_religious: allData.religiousAffiliation,
        language_preference: allData.preferredLanguage,
      };

      // Strip undefined so existing values aren't overwritten with null
      Object.keys(mapped).forEach(k => mapped[k] === undefined && delete mapped[k]);

      const response = await fetch('/api/v1/admission/pre-screening', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          screeningId: admissionId,
          // Send the wizard answers FLAT (plus normalized typed-column values
          // from `mapped`). The server reads top-level form-field names and
          // coerces them onto typed columns; everything is also kept losslessly
          // in form_data. `__steps` carries the exact per-step buckets so the
          // wizard rehydrates every step on resume (no required field lost).
          formData: { ...allData, ...mapped, [STEP_BUCKETS_KEY]: formData },
          markComplete,
          submit: markComplete,  // Pre-screening submits as standalone form
        }),
      });

      // Parse defensively: a non-JSON body (HTML 500 page) must surface the
      // HTTP status rather than blow up as a cryptic "Unexpected token" error.
      const raw = await response.text();
      let result = null;
      try { result = raw ? JSON.parse(raw) : null; } catch { /* non-JSON response */ }

      if (response.ok && result) {
        setSaved(true);
        const newId = result.data?.admissionId || result.data?.id;
        if (newId) setAdmissionId(newId);
        setIsDirty(false);
        if (markComplete) {
          try { sessionStorage.removeItem(PRESCREENING_DRAFT_KEY); } catch { /* ignore */ }
          clearFormDataFromSession('pre-screening');
        }
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
      const friendlyMsg = friendlyErrorMessage(error);
      setSubmitError(friendlyMsg);
    } finally {
      setSaving(false);
    }
    return false;
  };

  const handleAdvanceStep = async () => {
    const stepErrors = getStepErrors(formData[step], step);
    const fmtErrors = validateRuleSet(formData[step], PRE_SCREENING_RULES[step] || {}, REQUIRED_FIELD_LABELS, { skipEmpty: true });
    const allErrors = { ...stepErrors, ...fmtErrors };
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      return;
    }
    await handleSaveDraft();
    setStep(s => s + 1);
    setErrors({});
  };

  const handlePdfDownload = async (filename) => {
    setPdfGenerating(true);
    setPdfError(null);
    try {
      const allData = Object.assign({}, ...Object.values(formData));

      const result = await generateAndDownloadPdf(
        'pre-screening',
        allData,
        allData.contactPerson || 'admission',
        accessToken
      );

      if (!result.success) {
        setPdfError(result.error || 'Failed to generate PDF');
      }
    } catch (error) {
      setPdfError(error.message || 'PDF generation failed');
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleFormCompleted = async () => {
    const stepErrors = getStepErrors(formData[step], step);
    const fmtErrors = validateRuleSet(formData[step], PRE_SCREENING_RULES[step] || {}, REQUIRED_FIELD_LABELS, { skipEmpty: true });
    const allErrors = { ...stepErrors, ...fmtErrors };
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const savedOk = await handleSaveDraft(true); // markComplete=true
      if (!savedOk) return;

      setShowPdfModal(true);
      setPdfGenerating(false);
      setPdfError(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinueAfterPdf = () => {
    setShowPdfModal(false);
    // Redirect to admin pending admissions view after successful submission
    router.push('/admin?view=pending_admissions');
  };

  const currentData = formData[step];
  const setField = set(step);
  const stepComplete = isStepComplete(currentData, step);

  const stepComponents = {
    1: <Step1 data={currentData} set={setField} nursingData={nursingData} errors={errors} />,
    2: <Step2 data={currentData} set={setField} errors={errors} />,
    3: <Step3 data={currentData} set={setField} errors={errors} />,
    4: <Step4 data={currentData} set={setField} errors={errors} />,
    5: <Step5 data={currentData} set={setField} errors={errors} />,
    6: <Step6 data={currentData} set={setField} allData={formData} errors={errors} />,
  };

  // Show loading state while restoring form data
  if (isLoading) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(9,38,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        <div style={{ background: C.white, borderRadius: 12, padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 16 }}>Restoring your form...</div>
          <div style={{ width: 40, height: 40, borderRadius: "50%", border: `3px solid ${C.bgBorder}`, borderTopColor: C.teal, margin: "0 auto", animation: "spin 0.8s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: "52px 0 0 0", background: "rgba(9,38,42,0.55)", display: "flex", alignItems: "stretch", zIndex: 100, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      {/* Mobile backdrop for the step drawer */}
      {isMobile && stepNavOpen && (
        <div onClick={() => setStepNavOpen(false)} style={{ position: "fixed", inset: "52px 0 0 0", background: "rgba(9,20,18,0.5)", zIndex: 110 }} />
      )}

      {/* Sidebar — inline column on desktop, off-canvas drawer on mobile */}
      <div style={{
        width: 224, background: C.tealDark, display: "flex", flexDirection: "column", flexShrink: 0,
        ...(isMobile ? {
          position: "fixed", top: 52, left: 0, bottom: 0, zIndex: 120,
          transform: stepNavOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease", boxShadow: "4px 0 28px rgba(0,0,0,0.3)",
        } : {}),
      }}>
        <div style={{ padding: "22px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>New Admission</div>
          <div style={{ fontSize: 15, color: "#fff", fontWeight: 700, lineHeight: 1.3 }}>Pre-Admission Screening</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>Multi Options RTH</div>
        </div>

        {/* Nursing Assessment link */}
        <div style={{ margin: "12px 10px 0", background: "rgba(20,166,160,0.18)", border: "1px solid rgba(20,166,160,0.3)", borderRadius: 7, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#5eead4", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Linked To</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>Nursing Admission Assessment</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
            {nursingData?.name || "Patient not yet linked"}
          </div>
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
                padding: "9px 12px", background: active ? "rgba(255,255,255,0.1)" : "transparent",
                border: "none", borderRadius: 7, cursor: isDisabled ? "not-allowed" : "pointer", marginBottom: 3,
                borderLeft: active ? "3px solid #5eead4" : "3px solid transparent",
                color: active ? "#ccfbf1" : done ? "rgba(255,255,255,0.6)" : isDisabled ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.3)",
                opacity: isDisabled ? 0.5 : 1,
              }}>
                <span style={{
                  width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                  background: done ? C.green : active ? C.tealLight : "rgba(255,255,255,0.1)",
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
          <div style={{ margin: "0 10px 10px", background: "rgba(10,124,78,0.25)", border: "1px solid rgba(10,124,78,0.4)", borderRadius: 7, padding: "10px 12px" }}>
            <div style={{ fontSize: 11, color: "#6ee7b7", fontWeight: 600 }}>✓ Draft Saved</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>Admin review pending</div>
          </div>
        )}

        <div style={{ padding: "12px 10px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <button onClick={() => handleSaveDraft()} style={{
            width: "100%", padding: "8px 0", background: "rgba(20,166,160,0.25)",
            border: "1px solid rgba(20,166,160,0.4)", borderRadius: 6,
            color: "#ccfbf1", fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 6,
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
              border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6,
              color: "rgba(255,255,255,0.35)", fontSize: 12, cursor: "pointer",
            }}>✕ Close</button>
          )}
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: isMobile ? "12px 14px" : "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <button type="button" onClick={() => setStepNavOpen(true)} aria-label="Open steps" className="app-show-mobile" style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, color: C.tealDark, alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
            <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.teal, background: C.bg, padding: "4px 10px", borderRadius: 5 }}>
                Step {step} of {STEPS.length}
              </div>
              <div className="app-hide-mobile" style={{ display: "flex", gap: 6 }}>
                {STEPS.map(s => (
                  <div key={s.id} style={{
                    width: 18, height: 18, borderRadius: "50%",
                    background: s.id < step ? C.green : s.id === step ? C.teal : C.bgMid,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700, color: s.id <= step ? "#fff" : C.textMuted,
                  }}>
                    {s.id < step ? "✓" : s.id}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.tealDark }}>{STEPS[step - 1].label}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Pre-Admission Screening Form · HIPAA / 42 CFR Part 2</div>
            </div>
          </div>
          <div className="app-hide-mobile" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 180, height: 5, background: C.bgMid, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${(step / STEPS.length) * 100}%`, height: "100%", background: C.teal, borderRadius: 3, transition: "width 0.3s" }} />
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
                <div style={{ fontSize: 13, fontWeight: 700, color: C.red, marginBottom: 4 }}>
                  Submission Failed
                </div>
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
          <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1 || isSubmitting || saving} style={{
            padding: "9px 22px", background: "transparent", border: `1px solid ${C.bgBorder}`,
            borderRadius: 7, fontSize: 13, fontWeight: 600, color: step === 1 || isSubmitting ? C.textMuted : C.tealDark,
            cursor: step === 1 || isSubmitting || saving ? "not-allowed" : "pointer", opacity: step === 1 || isSubmitting ? 0.4 : 1,
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
                padding: "9px 18px", background: C.tealPale, border: `1px solid ${C.bgBorder}`,
                borderRadius: 7, fontSize: 13, fontWeight: 600, color: C.teal, cursor: saving || isSubmitting ? "not-allowed" : "pointer",
                opacity: saving || isSubmitting ? 0.6 : 1, display: "flex", alignItems: "center", gap: 6,
              }}>
                {saving && <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid #a8d8d4", borderTopColor: C.teal, animation: "spin 0.8s linear infinite" }} />}
                {saving ? "Saving..." : "Save Draft"}
              </button>
              {step < STEPS.length ? (
                <button
                onClick={handleAdvanceStep}
                disabled={!stepComplete || saving || isSubmitting}
                style={{
                  padding: "9px 24px", background: stepComplete && !isSubmitting ? C.teal : C.textMuted, border: "none",
                  borderRadius: 7, fontSize: 13, fontWeight: 700, color: "#fff", cursor: stepComplete && !saving && !isSubmitting ? "pointer" : "not-allowed",
                  opacity: stepComplete ? 1 : 0.5, display: "flex", alignItems: "center", gap: 6,
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
                  borderRadius: 7, fontSize: 13, fontWeight: 700, color: "#fff", cursor: saving || isSubmitting ? "not-allowed" : "pointer",
                  opacity: saving || isSubmitting ? 0.6 : 1, display: "flex", alignItems: "center", gap: 6,
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

      {/* PDF Completion Modal */}
      {showPdfModal && (
        <FormCompletionModal
          formType="pre-screening"
          fileName={generatePdfFilename('pre-screening', formData[1]?.contactPerson || 'admission')}
          isGenerating={pdfGenerating}
          onDownload={handlePdfDownload}
          onContinue={handleContinueAfterPdf}
          continueHref="/admin?view=pending_admissions"
          continueLabel="Return to Admin"
          error={pdfError}
        />
      )}

      {/* Dirty Check Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showConfirmClose}
        title="Unsaved Changes"
        message="You have unsaved changes in this form. Are you sure you want to close without saving?"
        onDiscard={() => {
          setShowConfirmClose(false);
          onClose?.();
        }}
        onKeepEditing={() => setShowConfirmClose(false)}
      />

      {/* Resume Draft Dialog */}
      <ResumeDraftDialog
        isOpen={resumeDraftPrompt}
        accentColor={C.teal}
        accentBg={C.tealPale}
        accentBorder={C.bgBorder}
        onResume={() => {
          if (pendingDraft) setFormData(pendingDraft);
          setResumeDraftPrompt(false);
          setPendingDraft(null);
        }}
        onDiscard={() => {
          try { sessionStorage.removeItem(PRESCREENING_DRAFT_KEY); } catch { /* ignore */ }
          setResumeDraftPrompt(false);
          setPendingDraft(null);
        }}
      />
    </div>
  );
}
