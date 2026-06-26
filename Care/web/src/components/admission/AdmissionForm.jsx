"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, Plus, ShieldCheck, UploadCloud, X } from "lucide-react";
import {
  Field,
  TextField,
  SelectField,
  TextAreaField,
  SegmentedField,
} from "@/components/ui/fields";

const CONDITION_OPTIONS = [
  "Diabetes",
  "Hypertension",
  "COPD",
  "Depression",
  "Fall history",
  "Seizure disorder",
  "CHF",
  "Chronic pain",
];

const BEHAVIORAL_CONCERNS = [
  "Aggression",
  "Wandering",
  "Elopement Risk",
  "Self Harm Risk",
  "Suicide Risk",
  "Property Destruction",
  "Fall Risk",
];

const ADL_ITEMS = [
  "Eating",
  "Bathing",
  "Dressing",
  "Grooming",
  "Toileting",
  "Transfers",
  "Walking",
];

const DOCUMENT_TYPES = [
  "Admission Assessment",
  "Physician Orders",
  "Insurance",
  "ID",
  "Advance Directive",
  "Medication List",
  "Other Documents",
];

const EMPTY_DIAGNOSIS = { text: "" };
const EMPTY_ALLERGY = { allergen: "", reaction: "", severity: "" };
const EMPTY_MEDICATION = { medication: "", dose: "", frequency: "", route: "", startDate: "" };
const EMPTY_GOAL = { text: "" };
const EMPTY_INTERVENTION = { text: "" };
const EMPTY_RESTRICTION = { text: "" };

const EMPTY = {
  firstName: "",
  middleName: "",
  lastName: "",
  preferredName: "",
  dob: "",
  gender: "",
  pronouns: "",
  photo: null,
  residentId: "",
  phone: "",
  email: "",
  currentAddress: "",
  emergencyName: "",
  emergencyRelationship: "",
  emergencyPhone: "",
  emergencyEmail: "",
  admissionDate: "",
  expectedDischarge: "",
  facility: "",
  roomAssignment: "",
  referralSource: "",
  caseManager: "",
  primaryDiagnoses: [{ ...EMPTY_DIAGNOSIS }],
  secondaryDiagnoses: [{ ...EMPTY_DIAGNOSIS }],
  allergies: [{ ...EMPTY_ALLERGY }],
  conditions: [],
  medications: [{ ...EMPTY_MEDICATION }],
  mobility: "",
  adls: ADL_ITEMS.reduce((acc, item) => ({ ...acc, [item]: "" }), {}),
  communication: "",
  mentalHealthDiagnoses: [{ ...EMPTY_DIAGNOSIS }],
  behavioralConcerns: [],
  observationLevel: "",
  goals: [{ ...EMPTY_GOAL }],
  interventions: [{ ...EMPTY_INTERVENTION }],
  restrictions: [{ text: "Fall precautions" }, { text: "Diabetic diet" }],
  advanceDirectiveExists: "",
  healthCareAgent: "",
  healthCareAgentPhone: "",
  dnrStatus: "",
  preferredHospital: "",
  advanceDirectiveUploaded: "",
  documents: DOCUMENT_TYPES.reduce((acc, type) => ({ ...acc, [type]: null }), {}),
};

function Section({ n, eyebrow, title, note, done, children }) {
  return (
    <section className="cx-section" data-done={done ? "true" : "false"}>
      <div className="cx-rail">
        <div className="cx-node">{done ? <Check size={13} strokeWidth={3} /> : n}</div>
      </div>
      <div className="cx-sec-body">
        <div className="cx-sec-eyebrow">{eyebrow}</div>
        <h2 className="cx-sec-title">{title}</h2>
        {note && <p className="cx-sec-note">{note}</p>}
        <div className="cx-card">{children}</div>
      </div>
    </section>
  );
}

function MultiSelectChips({ label, options, value, onChange, span2 = true, hint }) {
  function toggle(option) {
    onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option]);
  }

  return (
    <Field label={label} span2={span2} hint={hint}>
      <div className="cx-chips" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            className="cx-chip"
            data-on={value.includes(option) ? "true" : "false"}
            key={option}
            type="button"
            onClick={() => toggle(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </Field>
  );
}

function FileField({ label, value, onChange, accept = ".pdf,.png,.jpg,.jpeg,.doc,.docx", span2 }) {
  return (
    <Field label={label} optional span2={span2}>
      {(id) => (
        <label className="cx-upload" htmlFor={id}>
          <UploadCloud size={17} />
          <span>{value?.name || "Choose file"}</span>
          <input
            id={id}
            type="file"
            accept={accept}
            onChange={(event) => onChange(event.target.files?.[0] || null)}
          />
        </label>
      )}
    </Field>
  );
}

function DynamicRows({ title, rows, addLabel, onAdd, onRemove, children }) {
  return (
    <div className="cx-dynamic cx-span2">
      <div className="cx-dynamic-head">
        <span>{title}</span>
        <button className="cx-btn cx-btn-ghost cx-btn-compact" type="button" onClick={onAdd}>
          <Plus size={14} /> {addLabel}
        </button>
      </div>
      <div className="cx-dynamic-list">
        {rows.map((row, index) => (
          <div className="cx-dynamic-row" key={index}>
            {children(row, index)}
            {rows.length > 1 && (
              <button
                className="cx-icon-btn"
                type="button"
                aria-label={`Remove ${title} row ${index + 1}`}
                onClick={() => onRemove(index)}
              >
                <X size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdmissionForm() {
  const [v, setV] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [toast, setToast] = useState("");

  const set = (key) => (value) => {
    setV((state) => ({ ...state, [key]: value }));
    if (errors[key]) setErrors((state) => ({ ...state, [key]: undefined }));
  };

  const initials = useMemo(() => {
    const first = v.firstName.trim()[0] || "";
    const last = v.lastName.trim()[0] || "";
    return (first + last).toUpperCase();
  }, [v.firstName, v.lastName]);

  const fullName = [v.firstName, v.middleName, v.lastName].filter(Boolean).join(" ").trim();
  const documentCount = Object.values(v.documents).filter(Boolean).length + (v.photo ? 1 : 0);

  const complete = {
    1: Boolean(v.firstName && v.lastName && v.dob && v.gender && v.emergencyName && v.emergencyPhone && v.admissionDate && v.facility && v.roomAssignment),
    2: Boolean(v.primaryDiagnoses.some((item) => item.text) || v.secondaryDiagnoses.some((item) => item.text) || v.conditions.length || v.medications.some((med) => med.medication)),
    3: Boolean(v.mobility && ADL_ITEMS.every((item) => v.adls[item]) && v.communication),
    4: Boolean(v.observationLevel || v.behavioralConcerns.length || v.mentalHealthDiagnoses.some((item) => item.text)),
    5: Boolean(v.goals.some((goal) => goal.text) || v.interventions.some((item) => item.text) || v.restrictions.some((item) => item.text)),
    6: Boolean(v.advanceDirectiveExists || v.dnrStatus || v.preferredHospital),
    7: documentCount > 0,
  };

  function updateArrayRow(key, index, field, value) {
    setV((state) => ({
      ...state,
      [key]: state[key].map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)),
    }));
  }

  function addArrayRow(key, row) {
    setV((state) => ({ ...state, [key]: [...state[key], row] }));
  }

  function removeArrayRow(key, index) {
    setV((state) => ({ ...state, [key]: state[key].filter((_, rowIndex) => rowIndex !== index) }));
  }

  function setAdl(item, value) {
    setV((state) => ({ ...state, adls: { ...state.adls, [item]: value } }));
  }

  function setDocument(type, file) {
    setV((state) => ({ ...state, documents: { ...state.documents, [type]: file } }));
  }

  function validate() {
    const nextErrors = {};
    if (!v.firstName.trim()) nextErrors.firstName = "Required";
    if (!v.lastName.trim()) nextErrors.lastName = "Required";
    if (!v.dob) nextErrors.dob = "Required";
    if (!v.gender) nextErrors.gender = "Required";
    if (!v.emergencyName.trim()) nextErrors.emergencyName = "Required";
    if (!v.emergencyPhone.trim()) nextErrors.emergencyPhone = "Required";
    if (!v.admissionDate) nextErrors.admissionDate = "Required";
    if (!v.facility.trim()) nextErrors.facility = "Required";
    if (!v.roomAssignment.trim()) nextErrors.roomAssignment = "Required";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function onSave() {
    if (!validate()) {
      const first = document.querySelector('.cx-field[data-error="true"]');
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setDone(true);
    }, 850);
  }

  function saveDraft() {
    setToast("Draft captured locally. Backend submission is not wired yet.");
    setTimeout(() => setToast(""), 2600);
  }

  if (done) {
    return (
      <div className="cx-page">
        <div className="cx-done">
          <div className="cx-done-mark"><Check size={30} strokeWidth={2.5} /></div>
          <h2>Admission packet captured</h2>
          <p>
            {fullName || "The resident"} has a complete draft admission packet. Document storage and final
            submission are ready to connect to Cloudflare R2 and the backend when that milestone starts.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="cx-btn cx-btn-primary" onClick={() => { setV(EMPTY); setDone(false); }}>
              New admission
            </button>
            <button className="cx-btn cx-btn-ghost" onClick={() => setDone(false)}>
              Review packet
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cx-page cx-admission-wizard">
      <div className="cx-head">
        <div>
          <div className="cx-eyebrow">Colaris Admission Wizard</div>
          <h1 className="cx-h1">New resident admission</h1>
          <p className="cx-lede">
            Capture only the operational details needed to start care. Full assessment PDFs remain uploaded
            documents instead of being recreated as long forms.
          </p>
        </div>
        <div className="cx-nameplate" aria-live="polite">
          <div className={`cx-np-avatar${initials ? "" : " cx-np-empty"}`}>{initials || "—"}</div>
          <div style={{ minWidth: 0 }}>
            <div className={`cx-np-name${fullName ? "" : " cx-np-placeholder"}`}>
              {fullName || "New resident"}
            </div>
            <div className="cx-np-meta">
              {v.roomAssignment ? <span className="cx-np-pill">{v.roomAssignment}</span> : <span>Room pending</span>}
              {v.admissionDate && <span>Admit {v.admissionDate}</span>}
              {documentCount > 0 && <span>{documentCount} file{documentCount === 1 ? "" : "s"}</span>}
            </div>
          </div>
        </div>
      </div>

      <Section
        n={1}
        eyebrow="Step 1"
        title="Basic Information"
        note="Essential demographics, contact details, emergency contact, and admission placement."
        done={complete[1]}
      >
        <div className="cx-subgrid">
          <div className="cx-subhead">Personal Information</div>
          <TextField label="First Name" required value={v.firstName} onChange={set("firstName")} error={errors.firstName} />
          <TextField label="Middle Name" optional value={v.middleName} onChange={set("middleName")} />
          <TextField label="Last Name" required value={v.lastName} onChange={set("lastName")} error={errors.lastName} />
          <TextField label="Preferred Name" optional value={v.preferredName} onChange={set("preferredName")} />
          <TextField label="Date of Birth" required type="date" value={v.dob} onChange={set("dob")} error={errors.dob} />
          <SelectField label="Gender" required value={v.gender} onChange={set("gender")} error={errors.gender} options={["Female", "Male", "Non-binary", "Other", "Prefer not to say"]} />
          <SelectField label="Preferred Pronouns" optional value={v.pronouns} onChange={set("pronouns")} options={["She/her", "He/him", "They/them", "Other", "Prefer not to say"]} />
          <TextField label="Resident ID" optional value={v.residentId} onChange={set("residentId")} placeholder="Optional internal ID" />
          <FileField label="Photo" value={v.photo} onChange={set("photo")} accept=".png,.jpg,.jpeg,.webp" />

          <div className="cx-subhead">Contact Information</div>
          <TextField label="Phone Number" type="tel" value={v.phone} onChange={set("phone")} />
          <TextField label="Email" type="email" value={v.email} onChange={set("email")} />
          <TextAreaField label="Current Address" value={v.currentAddress} onChange={set("currentAddress")} placeholder="Street, city, state, ZIP" />

          <div className="cx-subhead">Emergency Contact</div>
          <TextField label="Full Name" required value={v.emergencyName} onChange={set("emergencyName")} error={errors.emergencyName} />
          <TextField label="Relationship" value={v.emergencyRelationship} onChange={set("emergencyRelationship")} />
          <TextField label="Phone Number" required type="tel" value={v.emergencyPhone} onChange={set("emergencyPhone")} error={errors.emergencyPhone} />
          <TextField label="Email" optional type="email" value={v.emergencyEmail} onChange={set("emergencyEmail")} />

          <div className="cx-subhead">Admission Information</div>
          <TextField label="Admission Date" required type="date" value={v.admissionDate} onChange={set("admissionDate")} error={errors.admissionDate} />
          <TextField label="Expected Discharge" optional type="date" value={v.expectedDischarge} onChange={set("expectedDischarge")} />
          <TextField label="Facility" required value={v.facility} onChange={set("facility")} error={errors.facility} placeholder="Colaris Care Residence" />
          <TextField label="Room Assignment" required value={v.roomAssignment} onChange={set("roomAssignment")} error={errors.roomAssignment} placeholder="Room 204B" />
          <SelectField label="Referral Source" value={v.referralSource} onChange={set("referralSource")} options={["Family", "Hospital", "Physician", "Self", "Case manager", "Other facility", "Other"]} />
          <TextField label="Case Manager" optional value={v.caseManager} onChange={set("caseManager")} />
        </div>
      </Section>

      <Section
        n={2}
        eyebrow="Step 2"
        title="Clinical Overview"
        note="Only capture clinical items that affect day-to-day care. Do not recreate the full nursing assessment."
        done={complete[2]}
      >
        <div className="cx-grid">
          <DynamicRows
            title="Primary Diagnosis"
            addLabel="Add diagnosis"
            rows={v.primaryDiagnoses}
            onAdd={() => addArrayRow("primaryDiagnoses", { ...EMPTY_DIAGNOSIS })}
            onRemove={(index) => removeArrayRow("primaryDiagnoses", index)}
          >
            {(row, index) => (
              <input
                className="cx-input"
                value={row.text}
                onChange={(event) => updateArrayRow("primaryDiagnoses", index, "text", event.target.value)}
                placeholder="Type primary diagnosis"
              />
            )}
          </DynamicRows>
          <DynamicRows
            title="Secondary Diagnoses"
            addLabel="Add diagnosis"
            rows={v.secondaryDiagnoses}
            onAdd={() => addArrayRow("secondaryDiagnoses", { ...EMPTY_DIAGNOSIS })}
            onRemove={(index) => removeArrayRow("secondaryDiagnoses", index)}
          >
            {(row, index) => (
              <input
                className="cx-input"
                value={row.text}
                onChange={(event) => updateArrayRow("secondaryDiagnoses", index, "text", event.target.value)}
                placeholder="Type secondary diagnosis"
              />
            )}
          </DynamicRows>
          <DynamicRows
            title="Allergies"
            addLabel="Add allergy"
            rows={v.allergies}
            onAdd={() => addArrayRow("allergies", { ...EMPTY_ALLERGY })}
            onRemove={(index) => removeArrayRow("allergies", index)}
          >
            {(row, index) => (
              <>
                <input className="cx-input" value={row.allergen} onChange={(event) => updateArrayRow("allergies", index, "allergen", event.target.value)} placeholder="Allergen" />
                <input className="cx-input" value={row.reaction} onChange={(event) => updateArrayRow("allergies", index, "reaction", event.target.value)} placeholder="Reaction" />
                <select className="cx-select" value={row.severity} onChange={(event) => updateArrayRow("allergies", index, "severity", event.target.value)}>
                  <option value="">Severity</option>
                  <option>Mild</option>
                  <option>Moderate</option>
                  <option>Severe</option>
                  <option>Life-threatening</option>
                </select>
              </>
            )}
          </DynamicRows>
          <MultiSelectChips label="Current Medical Conditions" value={v.conditions} onChange={set("conditions")} options={CONDITION_OPTIONS} hint="Tags such as Diabetes, Hypertension, COPD, Depression." />
          <DynamicRows
            title="Current Medications"
            addLabel="Add medication"
            rows={v.medications}
            onAdd={() => addArrayRow("medications", { ...EMPTY_MEDICATION })}
            onRemove={(index) => removeArrayRow("medications", index)}
          >
            {(row, index) => (
              <>
                <input className="cx-input" value={row.medication} onChange={(event) => updateArrayRow("medications", index, "medication", event.target.value)} placeholder="Medication" />
                <input className="cx-input" value={row.dose} onChange={(event) => updateArrayRow("medications", index, "dose", event.target.value)} placeholder="Dose" />
                <input className="cx-input" value={row.frequency} onChange={(event) => updateArrayRow("medications", index, "frequency", event.target.value)} placeholder="Frequency" />
                <input className="cx-input" value={row.route} onChange={(event) => updateArrayRow("medications", index, "route", event.target.value)} placeholder="Route" />
                <input className="cx-input" type="date" value={row.startDate} onChange={(event) => updateArrayRow("medications", index, "startDate", event.target.value)} aria-label="Start Date" />
              </>
            )}
          </DynamicRows>
        </div>
      </Section>

      <Section
        n={3}
        eyebrow="Step 3"
        title="Functional Assessment"
        note="Quick operational assessment for mobility, ADLs, and communication needs."
        done={complete[3]}
      >
        <div className="cx-grid">
          <SegmentedField label="Mobility" span2 value={v.mobility} onChange={set("mobility")} options={["Independent", "Supervision", "Walker", "Wheelchair", "Bedbound"]} />
          <div className="cx-adl-table cx-span2">
            <div className="cx-adl-head">
              <span>Activities of Daily Living</span>
              <span>Independent</span>
              <span>Needs Assistance</span>
              <span>Dependent</span>
            </div>
            {ADL_ITEMS.map((item) => (
              <div className="cx-adl-row" key={item}>
                <span>{item}</span>
                {["Independent", "Needs Assistance", "Dependent"].map((choice) => (
                  <button
                    type="button"
                    key={choice}
                    data-on={v.adls[item] === choice ? "true" : "false"}
                    onClick={() => setAdl(item, v.adls[item] === choice ? "" : choice)}
                  >
                    {choice}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <SegmentedField label="Communication" span2 value={v.communication} onChange={set("communication")} options={["Verbal", "Non-verbal", "Interpreter Required"]} />
        </div>
      </Section>

      <Section
        n={4}
        eyebrow="Step 4"
        title="Behavioral & Mental Health"
        note="Operational risk information that affects staffing, supervision, and daily routines."
        done={complete[4]}
      >
        <div className="cx-grid">
          <DynamicRows
            title="Mental Health Diagnosis"
            addLabel="Add diagnosis"
            rows={v.mentalHealthDiagnoses}
            onAdd={() => addArrayRow("mentalHealthDiagnoses", { ...EMPTY_DIAGNOSIS })}
            onRemove={(index) => removeArrayRow("mentalHealthDiagnoses", index)}
          >
            {(row, index) => (
              <input
                className="cx-input"
                value={row.text}
                onChange={(event) => updateArrayRow("mentalHealthDiagnoses", index, "text", event.target.value)}
                placeholder="Type mental health diagnosis"
              />
            )}
          </DynamicRows>
          <MultiSelectChips label="Behavioral Concerns" value={v.behavioralConcerns} onChange={set("behavioralConcerns")} options={BEHAVIORAL_CONCERNS} />
          <SelectField label="Observation Level" span2 value={v.observationLevel} onChange={set("observationLevel")} options={["Routine", "Every 30 Minutes", "Every 15 Minutes", "1:1 Observation"]} />
        </div>
      </Section>

      <Section
        n={5}
        eyebrow="Step 5"
        title="Care Plan"
        note="Capture structured goals, interventions, and restrictions without long narrative blocks."
        done={complete[5]}
      >
        <div className="cx-grid">
          <DynamicRows
            title="Goals"
            addLabel="Add goal"
            rows={v.goals}
            onAdd={() => addArrayRow("goals", { ...EMPTY_GOAL })}
            onRemove={(index) => removeArrayRow("goals", index)}
          >
            {(row, index) => (
              <input className="cx-input" value={row.text} onChange={(event) => updateArrayRow("goals", index, "text", event.target.value)} placeholder="Goal" />
            )}
          </DynamicRows>
          <DynamicRows
            title="Interventions"
            addLabel="Add intervention"
            rows={v.interventions}
            onAdd={() => addArrayRow("interventions", { ...EMPTY_INTERVENTION })}
            onRemove={(index) => removeArrayRow("interventions", index)}
          >
            {(row, index) => (
              <input className="cx-input" value={row.text} onChange={(event) => updateArrayRow("interventions", index, "text", event.target.value)} placeholder="Intervention" />
            )}
          </DynamicRows>
          <DynamicRows
            title="Restrictions"
            addLabel="Add restriction"
            rows={v.restrictions}
            onAdd={() => addArrayRow("restrictions", { ...EMPTY_RESTRICTION })}
            onRemove={(index) => removeArrayRow("restrictions", index)}
          >
            {(row, index) => (
              <input className="cx-input" value={row.text} onChange={(event) => updateArrayRow("restrictions", index, "text", event.target.value)} placeholder="Fall precautions, diabetic diet, no stairs, supervised outings" />
            )}
          </DynamicRows>
        </div>
      </Section>

      <Section
        n={6}
        eyebrow="Step 6"
        title="Advance Directives"
        note="Capture the status and responsible contacts. Detailed treatment preferences remain in the uploaded document."
        done={complete[6]}
      >
        <div className="cx-grid">
          <SegmentedField label="Advance Directive Exists?" value={v.advanceDirectiveExists} onChange={set("advanceDirectiveExists")} options={["Yes", "No", "Unknown"]} />
          <SelectField label="DNR Status" value={v.dnrStatus} onChange={set("dnrStatus")} options={["Full Code", "DNR", "DNI", "Comfort Measures Only", "Unknown"]} />
          <TextField label="Health Care Agent" value={v.healthCareAgent} onChange={set("healthCareAgent")} />
          <TextField label="Health Care Agent Phone" type="tel" value={v.healthCareAgentPhone} onChange={set("healthCareAgentPhone")} />
          <TextField label="Preferred Hospital" span2 value={v.preferredHospital} onChange={set("preferredHospital")} />
          <SegmentedField label="Advance Directive Uploaded?" span2 value={v.advanceDirectiveUploaded} onChange={set("advanceDirectiveUploaded")} options={["Yes", "No", "Pending"]} />
        </div>
      </Section>

      <Section
        n={7}
        eyebrow="Step 7"
        title="Documents"
        note="Upload supporting files. Storage is prepared for Cloudflare R2, but this screen currently captures files locally until backend wiring is added."
        done={complete[7]}
      >
        <div className="cx-grid">
          {DOCUMENT_TYPES.map((type) => (
            <FileField key={type} label={type} value={v.documents[type]} onChange={(file) => setDocument(type, file)} />
          ))}
          <div className="cx-r2-note cx-span2">
            <ShieldCheck size={16} />
            <span>Production storage target: Cloudflare R2. Database should store metadata and object keys only.</span>
          </div>
        </div>
      </Section>

      <div className="cx-actionbar">
        <span className="cx-ab-info">
          <ShieldCheck size={15} strokeWidth={2} color="#0E7C66" />
          {toast || "Admission packet only. Final persistence and R2 uploads are not wired yet."}
        </span>
        <span className="cx-ab-spacer" />
        <button className="cx-btn cx-btn-quiet" type="button" onClick={() => setV(EMPTY)}>Clear</button>
        <button className="cx-btn cx-btn-ghost" type="button" onClick={saveDraft}>Save draft</button>
        <button className="cx-btn cx-btn-primary" type="button" onClick={onSave} disabled={saving}>
          {saving ? <><Loader2 size={15} className="cx-spin" /> Capturing…</> : <>Capture admission packet</>}
        </button>
      </div>
    </div>
  );
}
