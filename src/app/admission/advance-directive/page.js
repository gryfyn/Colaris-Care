'use client';
import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { validateField, ValidationRules, getMissingFields, countCompletedFields, validateRuleSet, ADVANCE_DIRECTIVE_RULES } from '@/lib/form-validation';
import ValidationGuide from '@/components/ValidationGuide';
import { friendlyErrorMessage, formatApiError } from '@/app/lib/error-messages';
import FormCompletionModal from '@/components/FormCompletionModal';
import { generateAndDownloadPdf, generatePdfFilename, storeFormDataInSession } from '@/lib/pdf-downloader';
import { useIsMobile } from '@/lib/useIsMobile';

const C = {
  mauve:       "#ede9fe",
  mauveLight:  "#f3e8ff",
  mauveBorder: "#e9d5ff",
  purple:      "#7c3aed",
  purpleDark:  "#6d28d9",
  white:       "#ffffff",
  text:        "#1e1b4b",
  textMuted:   "#6b7280",
  green:       "#059669",
  greenBg:     "#ecfdf5",
  amber:       "#d97706",
  amberBg:     "#fffbeb",
  red:         "#dc2626",
  redBg:       "#fef2f2",
  border:      "#e5e7eb",
  slate:       "#f8fafc",
};

const STEPS = [
  { id: 1, label: "Healthcare Agent",     short: "Agent",      icon: "👤" },
  { id: 2, label: "Treatment Preferences", short: "Preferences", icon: "⚕️" },
  { id: 3, label: "Values & Beliefs",      short: "Values",     icon: "💭" },
  { id: 4, label: "Signatures",            short: "Sign",       icon: "✍️" },
];

// ─── REQUIRED FIELD DEFINITIONS ────────────────────────────────────────────
const REQUIRED_FIELD_LABELS = {
  healthcare_agent_name: 'Healthcare Agent Name',
  healthcare_agent_phone: 'Healthcare Agent Phone',
  cpr_preference: 'CPR Preference',
  nutrition_preference: 'Nutrition & Hydration Preference',
  ventilation_preference: 'Mechanical Ventilation Preference',
  end_of_life_wishes: 'End-of-Life Wishes',
  resident_name: 'Resident Name',
  resident_signature: 'Resident Signature',
  resident_signature_date: 'Resident Signature Date',
  witness1_name: 'Witness #1 Name',
  witness1_signature: 'Witness #1 Signature',
  witness1_signature_date: 'Witness #1 Signature Date',
  witness2_name: 'Witness #2 Name',
  witness2_signature: 'Witness #2 Signature',
  witness2_signature_date: 'Witness #2 Signature Date',
};

const STEP_REQUIRED_FIELDS = {
  1: ['healthcare_agent_name', 'healthcare_agent_phone'],
  2: ['cpr_preference', 'nutrition_preference', 'ventilation_preference'],
  3: ['end_of_life_wishes'],
  4: ['resident_name', 'resident_signature', 'resident_signature_date', 'witness1_name', 'witness1_signature', 'witness1_signature_date', 'witness2_name', 'witness2_signature', 'witness2_signature_date'],
};

const inputStyle = {
  width: "100%", padding: "9px 12px", border: `1px solid ${C.mauveBorder}`,
  borderRadius: 7, fontSize: 13, background: C.white, color: C.text,
  outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};
const labelStyle = {
  display: "block", fontSize: 12, fontWeight: 600, color: C.purpleDark,
  marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em",
};
const sectionHeadStyle = {
  fontSize: 13, fontWeight: 700, color: C.purple, textTransform: "uppercase",
  letterSpacing: "0.08em", borderBottom: `2px solid ${C.mauveBorder}`,
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
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        ...inputStyle,
        borderColor: hasError ? C.red : C.mauveBorder,
        borderWidth: hasError ? '1.5px' : '1px',
        backgroundColor: hasError ? 'rgba(220,38,38,0.03)' : C.white,
      }}
    />
  );
}
function TextArea({ value, onChange, placeholder, rows = 3 }) {
  return <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />;
}
function RadioGroup({ label, options, value, onChange }) {
  return (
    <div>
      {label && <div style={{ ...labelStyle, marginBottom: 8 }}>{label}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px" }}>
        {options.map(o => {
          const val = o.value ?? o, lbl = o.label ?? o, ch = value === val;
          return (
            <label key={String(val)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.text, cursor: "pointer" }}>
              <span onClick={() => onChange(val)} style={{ width: 16, height: 16, borderRadius: "50%", border: `1.5px solid ${ch ? C.purple : C.mauveBorder}`, background: ch ? C.purple : C.white, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                {ch && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff", display: "block" }} />}
              </span>{lbl}
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

function Step1({ data, set, errors = {} }) {
  return (
    <div>
      <InfoBox color={C.purple} bg={C.mauveLight}>
        Designate a healthcare agent who will make medical decisions on your behalf if you are unable to do so. Fields marked with <span style={{ color: C.red, fontWeight: 700 }}>*</span> are required.
      </InfoBox>
      <SectionHead>Healthcare Agent Information</SectionHead>
      <Grid cols={2}>
        <Field label="Healthcare Agent Full Name" span={2} required={true} error={errors.healthcare_agent_name} hasError={!!errors.healthcare_agent_name}>
          <TextInput value={data.healthcare_agent_name} onChange={v => set("healthcare_agent_name", v)} placeholder="Full name" hasError={!!errors.healthcare_agent_name} />
        </Field>
        <Field label="Relationship to Resident">
          <TextInput value={data.healthcare_agent_relationship} onChange={v => set("healthcare_agent_relationship", v)} placeholder="e.g., Spouse, Daughter, Son" />
        </Field>
        <Field label="Phone Number" required={true} error={errors.healthcare_agent_phone} hasError={!!errors.healthcare_agent_phone}>
          <TextInput value={data.healthcare_agent_phone} onChange={v => set("healthcare_agent_phone", v)} placeholder="(503) 000-0000" hasError={!!errors.healthcare_agent_phone} />
        </Field>
        <Field label="Email Address">
          <TextInput type="email" value={data.healthcare_agent_email} onChange={v => set("healthcare_agent_email", v)} placeholder="agent@example.com" />
        </Field>
        <Field label="Address" span={2}>
          <TextInput value={data.healthcare_agent_address} onChange={v => set("healthcare_agent_address", v)} placeholder="Street, City, State, ZIP" />
        </Field>
      </Grid>

      <SectionHead>Alternate Healthcare Agent (if primary unavailable)</SectionHead>
      <Grid cols={2}>
        <Field label="Alternate Agent Name" span={2}>
          <TextInput value={data.alternate_agent_name} onChange={v => set("alternate_agent_name", v)} placeholder="Full name (optional)" />
        </Field>
        <Field label="Phone Number">
          <TextInput value={data.alternate_agent_phone} onChange={v => set("alternate_agent_phone", v)} placeholder="(503) 000-0000" />
        </Field>
      </Grid>
    </div>
  );
}

function Step2({ data, set, errors = {} }) {
  return (
    <div>
      <InfoBox color={C.amber} bg={C.amberBg}>
        Indicate your preferences for medical treatment in various scenarios. All preferences marked with <span style={{ color: C.red, fontWeight: 700 }}>*</span> are required.
      </InfoBox>
      <SectionHead>Cardiopulmonary Resuscitation (CPR)</SectionHead>
      <div style={{ borderLeft: `3px solid ${errors.cpr_preference ? C.red : C.purple}`, paddingLeft: 16, marginBottom: 20 }}>
        <RadioGroup value={data.cpr_preference} onChange={v => set("cpr_preference", v)} options={[
          {value: "full", label: "Full CPR including intubation and mechanical ventilation"},
          {value: "limited", label: "Limited CPR (no intubation)"},
          {value: "comfort_only", label: "Comfort measures only (DNR)"},
        ]} />
        {errors.cpr_preference && <div style={{ fontSize: 12, color: C.red, marginTop: 6, fontWeight: 500 }}>* {errors.cpr_preference}</div>}
      </div>

      <SectionHead>Artificial Nutrition and Hydration</SectionHead>
      <div style={{ borderLeft: `3px solid ${errors.nutrition_preference ? C.red : C.purple}`, paddingLeft: 16, marginBottom: 20 }}>
        <RadioGroup value={data.nutrition_preference} onChange={v => set("nutrition_preference", v)} options={[
          {value: "full", label: "Full artificial nutrition and hydration (tube feeding, IV)"},
          {value: "comfort", label: "Limited: only for comfort"},
          {value: "none", label: "No artificial nutrition or hydration"},
        ]} />
        {errors.nutrition_preference && <div style={{ fontSize: 12, color: C.red, marginTop: 6, fontWeight: 500 }}>* {errors.nutrition_preference}</div>}
      </div>

      <SectionHead>Mechanical Ventilation / Breathing Support</SectionHead>
      <div style={{ borderLeft: `3px solid ${errors.ventilation_preference ? C.red : C.purple}`, paddingLeft: 16, marginBottom: 20 }}>
        <RadioGroup value={data.ventilation_preference} onChange={v => set("ventilation_preference", v)} options={[
          {value: "yes", label: "Yes, use mechanical ventilation if needed"},
          {value: "limited", label: "Only if reversible condition"},
          {value: "no", label: "No mechanical ventilation"},
        ]} />
        {errors.ventilation_preference && <div style={{ fontSize: 12, color: C.red, marginTop: 6, fontWeight: 500 }}>* {errors.ventilation_preference}</div>}
      </div>

      <SectionHead>Hospitalization and Intensive Care</SectionHead>
      <RadioGroup value={data.hospitalization_preference} onChange={v => set("hospitalization_preference", v)} options={[
        {value: "yes", label: "Yes, admit to hospital/ICU for treatment"},
        {value: "limited", label: "Only if condition is reversible"},
        {value: "no", label: "No hospitalization (home or facility only)"},
      ]} />

      <SectionHead>Pain Management and Comfort</SectionHead>
      <RadioGroup label="Use of medication for pain relief, even if it may shorten life:" value={data.pain_relief_preference} onChange={v => set("pain_relief_preference", v)} options={[
        {value: "always", label: "Always use pain relief"},
        {value: "as_needed", label: "Use only when necessary"},
        {value: "minimal", label: "Minimize medication use"},
      ]} />

      <SectionHead>Organ and Tissue Donation</SectionHead>
      <RadioGroup value={data.donation_preference} onChange={v => set("donation_preference", v)} options={[
        {value: "yes", label: "Yes, donate organs and tissues"},
        {value: "no", label: "No donation"},
        {value: "decide_later", label: "Let family decide"},
      ]} />
    </div>
  );
}

function Step3({ data, set, errors = {} }) {
  return (
    <div>
      <InfoBox color={C.green} bg={C.greenBg}>
        Share your personal values, beliefs, and goals for end-of-life care. The field marked with <span style={{ color: C.red, fontWeight: 700 }}>*</span> is required.
      </InfoBox>
      <SectionHead>Personal Values & Beliefs</SectionHead>
      <Field label="What is most important to you at the end of life?" required={true} error={errors.end_of_life_wishes} hasError={!!errors.end_of_life_wishes}>
        <TextArea value={data.end_of_life_wishes} onChange={v => set("end_of_life_wishes", v)} placeholder="e.g., being at home, spending time with family, controlling pain, spiritual care, etc." rows={4} />
      </Field>

      <div style={{ marginTop: 14 }}>
        <Field label="Religious or Cultural Practices to Honor">
          <TextArea value={data.cultural_religious_practices} onChange={v => set("cultural_religious_practices", v)} placeholder="Describe any practices, traditions, or beliefs that should guide care..." rows={3} />
        </Field>
      </div>

      <div style={{ marginTop: 14 }}>
        <Field label="What would you consider an unacceptable quality of life?">
          <TextArea value={data.unacceptable_quality_of_life} onChange={v => set("unacceptable_quality_of_life", v)} placeholder="Describe conditions or circumstances you would find unacceptable..." rows={3} />
        </Field>
      </div>

      <SectionHead>Additional Instructions</SectionHead>
      <Field label="Any other wishes, preferences, or instructions for my healthcare agent?">
        <TextArea value={data.additional_instructions} onChange={v => set("additional_instructions", v)} placeholder="Provide any additional guidance..." rows={3} />
      </Field>
    </div>
  );
}

function Step4({ data, set, errors = {} }) {
  return (
    <div>
      <InfoBox color={C.red} bg={C.redBg}>
        This advance directive must be signed by you and witnessed by two individuals who are not family members or healthcare providers. All signature fields marked with <span style={{ color: C.red, fontWeight: 700 }}>*</span> are required.
      </InfoBox>

      <SectionHead>Resident Signature</SectionHead>
      <Grid cols={2}>
        <Field label="Resident Printed Name" span={2} required={true} error={errors.resident_name} hasError={!!errors.resident_name}>
          <TextInput value={data.resident_name} onChange={v => set("resident_name", v)} placeholder="Full legal name" readOnly={false} hasError={!!errors.resident_name} />
        </Field>
        <Field label="Resident Signature (Type full name)" required={true} error={errors.resident_signature} hasError={!!errors.resident_signature}>
          <TextInput value={data.resident_signature} onChange={v => set("resident_signature", v)} placeholder="Type your full name to sign" hasError={!!errors.resident_signature} />
        </Field>
        <Field label="Date Signed" required={true} error={errors.resident_signature_date} hasError={!!errors.resident_signature_date}>
          <TextInput type="date" value={data.resident_signature_date} onChange={v => set("resident_signature_date", v)} hasError={!!errors.resident_signature_date} />
        </Field>
      </Grid>

      <SectionHead>Witness #1 Information</SectionHead>
      <Grid cols={2}>
        <Field label="Witness #1 Printed Name" span={2} required={true} error={errors.witness1_name} hasError={!!errors.witness1_name}>
          <TextInput value={data.witness1_name} onChange={v => set("witness1_name", v)} placeholder="Full name" hasError={!!errors.witness1_name} />
        </Field>
        <Field label="Address">
          <TextInput value={data.witness1_address} onChange={v => set("witness1_address", v)} placeholder="Street, City, State, ZIP" />
        </Field>
        <Field label="Phone">
          <TextInput value={data.witness1_phone} onChange={v => set("witness1_phone", v)} placeholder="(503) 000-0000" />
        </Field>
        <Field label="Witness #1 Signature (Type full name)" required={true} error={errors.witness1_signature} hasError={!!errors.witness1_signature}>
          <TextInput value={data.witness1_signature} onChange={v => set("witness1_signature", v)} placeholder="Type your full name to sign" hasError={!!errors.witness1_signature} />
        </Field>
        <Field label="Date Signed" required={true} error={errors.witness1_signature_date} hasError={!!errors.witness1_signature_date}>
          <TextInput type="date" value={data.witness1_signature_date} onChange={v => set("witness1_signature_date", v)} hasError={!!errors.witness1_signature_date} />
        </Field>
      </Grid>

      <SectionHead>Witness #2 Information</SectionHead>
      <Grid cols={2}>
        <Field label="Witness #2 Printed Name" span={2} required={true} error={errors.witness2_name} hasError={!!errors.witness2_name}>
          <TextInput value={data.witness2_name} onChange={v => set("witness2_name", v)} placeholder="Full name" hasError={!!errors.witness2_name} />
        </Field>
        <Field label="Address">
          <TextInput value={data.witness2_address} onChange={v => set("witness2_address", v)} placeholder="Street, City, State, ZIP" />
        </Field>
        <Field label="Phone">
          <TextInput value={data.witness2_phone} onChange={v => set("witness2_phone", v)} placeholder="(503) 000-0000" />
        </Field>
        <Field label="Witness #2 Signature (Type full name)" required={true} error={errors.witness2_signature} hasError={!!errors.witness2_signature}>
          <TextInput value={data.witness2_signature} onChange={v => set("witness2_signature", v)} placeholder="Type your full name to sign" hasError={!!errors.witness2_signature} />
        </Field>
        <Field label="Date Signed" required={true} error={errors.witness2_signature_date} hasError={!!errors.witness2_signature_date}>
          <TextInput type="date" value={data.witness2_signature_date} onChange={v => set("witness2_signature_date", v)} hasError={!!errors.witness2_signature_date} />
        </Field>
      </Grid>
    </div>
  );
}

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
  return errors;
};

const formDataChanged = (initial, current) => {
  if (!initial) return false;
  const initialStr = JSON.stringify(initial);
  const currentStr = JSON.stringify(current);
  return initialStr !== currentStr;
};

const ADVANCE_DIRECTIVE_DRAFT_KEY = 'admission_advance_directive_draft';

function ResumeDraftDialog({ isOpen, onResume, onDiscard, accentColor, accentBg, accentBorder }) {
  if (!isOpen) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(30,27,75,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 32, maxWidth: 440, width: "90%", boxShadow: "0 20px 25px rgba(0,0,0,0.15)" }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: accentColor, marginBottom: 10 }}>Resume your draft?</div>
        <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, marginBottom: 24 }}>
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
    <div style={{ position: "fixed", inset: 0, background: "rgba(30,27,75,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
      <div style={{ background: C.white, borderRadius: 12, padding: 32, maxWidth: 420, boxShadow: "0 20px 25px rgba(0,0,0,0.15)" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.purpleDark, marginBottom: 12 }}>{title}</div>
        <div style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6, marginBottom: 24 }}>{message}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onKeepEditing} style={{ padding: "9px 20px", background: C.mauveLight, border: `1px solid ${C.mauveBorder}`, borderRadius: 7, fontSize: 13, fontWeight: 600, color: C.purple, cursor: "pointer" }}>Keep Editing</button>
          <button onClick={onDiscard} style={{ padding: "9px 20px", background: C.red, border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, color: C.white, cursor: "pointer" }}>Discard Changes</button>
        </div>
      </div>
    </div>
  );
}

function deriveAdvanceDirectiveDefaults(admission, defaultForm) {
  const loaded = { ...defaultForm };

  if (admission?.advance_directive_data && typeof admission.advance_directive_data === 'object') {
    Object.assign(loaded, admission.advance_directive_data);
  }

  const residentName =
    admission?.full_name ||
    admission?.nursing_assessment_data?.full_name ||
    admission?.nursing_assessment_data?.name ||
    admission?.pre_screening_data?.full_name ||
    admission?.pre_screening_data?.contactPerson ||
    admission?.pre_screening_data?.referringAgency ||
    '';

  if (!loaded.resident_name && residentName) {
    loaded.resident_name = residentName;
  }

  return loaded;
}

export default function AdvanceDirectiveWizard({ onClose }) {
  const router = useRouter();
  const { auth, loading: authLoading } = useAuth() || {};
  const accessToken = auth?.accessToken;
  const isMobile = useIsMobile(768);
  const [stepNavOpen, setStepNavOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  // This advance directive's own draft id (advance_id; admission_id kept as a
  // legacy alias) plus the chain it was started from.
  const [admissionId, setAdmissionId] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('advance_id') || params.get('admission_id') || null;
    }
    return null;
  });
  const [nursingId] = useState(() => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('nursing_id') : null));
  const [screeningId] = useState(() => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('screening_id') : null));
  const [formData, setFormData] = useState({
    healthcare_agent_name: "", healthcare_agent_relationship: "", healthcare_agent_phone: "",
    healthcare_agent_email: "", healthcare_agent_address: "", alternate_agent_name: "",
    alternate_agent_phone: "", cpr_preference: "", nutrition_preference: "", ventilation_preference: "",
    hospitalization_preference: "", pain_relief_preference: "", donation_preference: "",
    end_of_life_wishes: "", cultural_religious_practices: "", unacceptable_quality_of_life: "",
    additional_instructions: "", resident_name: "", resident_signature: "", resident_signature_date: "",
    witness1_name: "", witness1_address: "", witness1_phone: "", witness1_signature: "", witness1_signature_date: "",
    witness2_name: "", witness2_address: "", witness2_phone: "", witness2_signature: "", witness2_signature_date: "",
  });
  const [initialFormData, setInitialFormData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [resumeDraftPrompt, setResumeDraftPrompt] = useState(false);
  const [pendingDraft, setPendingDraft] = useState(null);

  // Load previously saved form data on mount if admissionId is provided
  useEffect(() => {
    const loadFormData = async () => {
      if (authLoading) return;
      const defaultForm = {
        healthcare_agent_name: "", healthcare_agent_relationship: "", healthcare_agent_phone: "",
        healthcare_agent_email: "", healthcare_agent_address: "", alternate_agent_name: "",
        alternate_agent_phone: "", cpr_preference: "", nutrition_preference: "", ventilation_preference: "",
        hospitalization_preference: "", pain_relief_preference: "", donation_preference: "",
        end_of_life_wishes: "", cultural_religious_practices: "", unacceptable_quality_of_life: "",
        additional_instructions: "", resident_name: "", resident_signature: "", resident_signature_date: "",
        witness1_name: "", witness1_address: "", witness1_phone: "", witness1_signature: "", witness1_signature_date: "",
        witness2_name: "", witness2_address: "", witness2_phone: "", witness2_signature: "", witness2_signature_date: "",
      };

      // The useState initializer reads window during SSR (null), so on a soft
      // client navigation `admissionId` can be null even though the URL carries
      // it. Re-resolve from the live URL here (this effect runs only client-side)
      // — without it, the final submit would create a new row instead of
      // finalizing the approved admission.
      const sp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const liveId = admissionId || sp?.get('advance_id') || sp?.get('admission_id') || null;
      const liveNursing = nursingId || sp?.get('nursing_id') || null;
      const liveScreening = screeningId || sp?.get('screening_id') || null;
      if (liveId && liveId !== admissionId) setAdmissionId(liveId);

      const headers = { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) };
      // Assemble an admission-shaped object: this AD draft's own blob + the
      // upstream pre-screening / nursing data so the resident name (and other
      // carried-forward identity fields) pre-fill.
      const merged = {};
      try {
        if (liveId) {
          const r = await fetch(`/api/v1/admission/advance-directive/${liveId}`, { headers, credentials: 'same-origin' });
          if (r.ok) merged.advance_directive_data = (await r.json()).data?.advance_directive_data || {};
        }
        if (liveScreening) {
          const rs = await fetch(`/api/v1/admission/pre-screening/${liveScreening}`, { headers, credentials: 'same-origin' });
          if (rs.ok) merged.pre_screening_data = (await rs.json()).data?.pre_screening_data || {};
        }
        if (liveNursing) {
          const rn = await fetch(`/api/v1/admission/nursing-assessment/${liveNursing}`, { headers, credentials: 'same-origin' });
          if (rn.ok) merged.nursing_assessment_data = (await rn.json()).data?.nursing_assessment_data || {};
        }
        const loaded = deriveAdvanceDirectiveDefaults(merged, defaultForm);
        setFormData(loaded);
        setInitialFormData(loaded);
      } catch (error) {
        setInitialFormData(defaultForm);
      } finally {
        setIsLoading(false);
      }
    };

    loadFormData();
  }, [admissionId, nursingId, screeningId, accessToken, authLoading]);

  // ── Check sessionStorage for draft on mount (after server-load settles)
  useEffect(() => {
    if (isLoading) return;
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(ADVANCE_DIRECTIVE_DRAFT_KEY);
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
          sessionStorage.setItem(ADVANCE_DIRECTIVE_DRAFT_KEY, JSON.stringify(formData));
          setLastSavedTime(new Date());
          setIsDirty(false);
        } catch {
          // storage quota exceeded — silently skip
        }
      }
    }, 30000);
    return () => clearInterval(saveTimer);
  }, [formData, isDirty]);

  // Track interacted fields so on-blur format checks only flag fields the user
  // actually entered.
  const touchedRef = useRef(new Set());

  const set = useCallback((key, val) => {
    touchedRef.current.add(key);
    setFormData(prev => ({ ...prev, [key]: val }));
    setSaved(false);
    setIsDirty(true);
    // Clear error for this field once user starts correcting it
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[key];
      return newErrors;
    });
  }, []);

  // On blur, re-check the format of any touched, non-empty field in this step
  // and surface problems (with recommended entry) in the right-side guide.
  const handleBlurValidate = useCallback(() => {
    const rules = ADVANCE_DIRECTIVE_RULES[step];
    if (!rules) return;
    const fmtErrors = validateRuleSet(formData, rules, REQUIRED_FIELD_LABELS, {
      only: Array.from(touchedRef.current),
      skipEmpty: true,
    });
    setErrors(prev => ({ ...prev, ...fmtErrors }));
  }, [step, formData]);

  const handleSubmit = async () => {
    if (!accessToken) {
      setSubmitError('Please log in again before saving this admission form.');
      return false;
    }
    // The advance directive may not have its own draft row yet — the server
    // creates one on submit and finalizes the admission from the upstream
    // pre-screening / nursing chain. Only block if we have nothing to finalize
    // against (no advance draft AND no upstream chain ids).
    if (!admissionId && !nursingId && !screeningId) {
      setSubmitError('No admission found. Please start this admission from the approved pre-screening.');
      return false;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      const mapped = {
        has_advance_directive: true,
        resident_name: formData.resident_name,
        healthcare_agent_name: formData.healthcare_agent_name,
        healthcare_agent_phone: formData.healthcare_agent_phone,
        healthcare_agent_relationship: formData.healthcare_agent_relationship,
        alternate_agent_name: formData.alternate_agent_name,
        alternate_agent_phone: formData.alternate_agent_phone,
        mental_health_preferences: formData.mental_health_preferences,
        psychiatric_med_preferences: formData.psychiatric_med_preferences,
        hospitalization_preference: formData.hospitalization_preference,
        emergency_interventions: [
          formData.cpr_preference && `CPR: ${formData.cpr_preference}`,
          formData.nutrition_preference && `Nutrition: ${formData.nutrition_preference}`,
          formData.ventilation_preference && `Ventilation: ${formData.ventilation_preference}`,
          formData.pain_relief_preference && `Pain relief: ${formData.pain_relief_preference}`,
        ].filter(Boolean).join('; ') || null,
        specific_treatment_preferences: formData.additional_instructions,
        personal_values: formData.unacceptable_quality_of_life,
        religious_cultural_preferences: formData.cultural_religious_practices,
        end_of_life_wishes: formData.end_of_life_wishes,
        resident_signature: formData.resident_signature,
        resident_signature_date: formData.resident_signature_date,
        witness1_name: formData.witness1_name,
        witness1_signature: formData.witness1_signature,
        witness1_date: formData.witness1_signature_date,
        witness2_name: formData.witness2_name,
        witness2_signature: formData.witness2_signature,
        witness2_date: formData.witness2_signature_date,
      };
      Object.keys(mapped).forEach(k => mapped[k] === undefined && delete mapped[k]);

      const response = await fetch('/api/v1/admission/advance-directive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          advanceId: admissionId,
          nursingId,
          preScreeningId: screeningId,
          // Send the answers FLAT (plus normalized values from `mapped`); the
          // full payload is also stored losslessly in form_data on the server.
          formData: { ...formData, ...mapped },
          markComplete: true,
          submit: true, // final form — flips status to submitted AND finalizes (creates resident)
        }),
      });

      // Parse defensively: a non-JSON body (HTML 500 page) must surface the
      // HTTP status rather than blow up as a cryptic "Unexpected token" error.
      const raw = await response.text();
      let data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch { /* non-JSON response */ }

      if (response.ok && data) {
        setSaved(true);
        try { sessionStorage.removeItem(ADVANCE_DIRECTIVE_DRAFT_KEY); } catch { /* ignore */ }
        return true;
      } else if (data) {
        setSubmitError(formatApiError(data));
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

  const handlePdfDownload = async (filename) => {
    setPdfGenerating(true);
    setPdfError(null);
    try {
      const result = await generateAndDownloadPdf(
        'advance-directive',
        formData,
        formData.resident_name || 'admission',
        accessToken
      );

      if (!result.success) {
        const friendlyMsg = friendlyErrorMessage(result.error || 'Failed to generate PDF');
        setPdfError(friendlyMsg);
      }
    } catch (error) {
      const friendlyMsg = friendlyErrorMessage(error);
      setPdfError(friendlyMsg);
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleFormCompleted = async () => {
    setIsSubmitting(true);
    try {
      const submitted = await handleSubmit();
      if (!submitted) return;

      storeFormDataInSession('advance-directive', formData);
      setShowPdfModal(true);
      setPdfGenerating(false);
      setPdfError(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinueAfterPdf = () => {
    setShowPdfModal(false);
    router.push('/admin?view=residents');
  };

  const currentData = formData;
  const stepComplete = isStepComplete(currentData, step);

  const stepComponents = {
    1: <Step1 data={currentData} set={set} errors={errors} />,
    2: <Step2 data={currentData} set={set} errors={errors} />,
    3: <Step3 data={currentData} set={set} errors={errors} />,
    4: <Step4 data={currentData} set={set} errors={errors} />,
  };

  // Show loading state while restoring form data
  if (isLoading) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(30,27,75,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        <div style={{ background: C.white, borderRadius: 12, padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 16 }}>Restoring your form...</div>
          <div style={{ width: 40, height: 40, borderRadius: "50%", border: `3px solid ${C.border}`, borderTopColor: C.purple, margin: "0 auto", animation: "spin 0.8s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: "52px 0 0 0", background: "rgba(30,27,75,0.55)", display: "flex", alignItems: "stretch", zIndex: 100, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      {isMobile && stepNavOpen && (
        <div onClick={() => setStepNavOpen(false)} style={{ position: "fixed", inset: "52px 0 0 0", background: "rgba(15,12,40,0.5)", zIndex: 110 }} />
      )}
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
          <div style={{ fontSize: 15, color: "#fff", fontWeight: 700 }}>Advance Directive</div>
        </div>
        <div style={{ flex: 1, padding: "16px 10px", overflowY: "auto" }}>
          {STEPS.map(s => {
            const done = s.id < step;
            const active = s.id === step;
            const canAccess = done || active || (s.id > 1 && isStepComplete(formData, s.id - 1));
            const isDisabled = !canAccess;
            return (
              <button key={s.id} onClick={() => { if (!isDisabled) { setStep(s.id); setStepNavOpen(false); } }} disabled={isDisabled} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                background: active ? "rgba(255,255,255,0.12)" : "transparent", border: "none", borderRadius: 7,
                cursor: isDisabled ? "not-allowed" : "pointer", marginBottom: 3, borderLeft: active ? "3px solid #e9d5ff" : "3px solid transparent",
                color: active ? "#e9d5ff" : done ? "rgba(255,255,255,0.6)" : isDisabled ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.35)", opacity: isDisabled ? 0.5 : 1,
              }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, background: done ? C.green : active ? "#a78bfa" : "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: done ? 11 : 10, color: "#fff", fontWeight: 700 }}>
                  {done ? "✓" : s.id}
                </span>
                <span style={{ fontSize: 12, fontWeight: active ? 700 : 400, textAlign: "left" }}>{s.short}</span>
                {isDisabled && s.id > step && <span style={{ marginLeft: "auto", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>🔒</span>}
              </button>
            );
          })}
        </div>
        <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          {onClose && (
            <button onClick={() => {
              if (initialFormData && formDataChanged(initialFormData, formData)) {
                setShowConfirmClose(true);
              } else {
                onClose();
              }
            }} style={{ width: "100%", padding: "7px 0", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer" }}>✕ Close</button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.mauveLight, overflow: "hidden" }}>
        <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: isMobile ? "12px 14px" : "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <button type="button" onClick={() => setStepNavOpen(true)} aria-label="Open steps" className="app-show-mobile" style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, color: C.purpleDark, alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
            <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.purple, background: C.mauveLight, padding: "4px 10px", borderRadius: 5 }}>
                Step {step} of {STEPS.length}
              </div>
              <div className="app-hide-mobile" style={{ display: "flex", gap: 6 }}>
                {STEPS.map(s => (
                  <div key={s.id} style={{
                    width: 18, height: 18, borderRadius: "50%",
                    background: s.id < step ? C.green : s.id === step ? C.purple : C.mauveBorder,
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
            <div style={{ width: 180, height: 5, background: C.mauveBorder, borderRadius: 3, overflow: "hidden" }}>
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

        <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px 14px" : "24px 32px" }} onBlur={handleBlurValidate}>
          {stepComponents[step]}
        </div>

        <div style={{ background: C.white, borderTop: `1px solid ${C.border}`, padding: isMobile ? "12px 14px" : "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexShrink: 0 }}>
          <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1 || isSubmitting || saving} style={{
            padding: "9px 22px", background: "transparent", border: `1px solid ${C.mauveBorder}`, borderRadius: 7,
            fontSize: 13, fontWeight: 600, color: step === 1 || isSubmitting ? C.textMuted : C.purpleDark, cursor: step === 1 || isSubmitting || saving ? "not-allowed" : "pointer",
            opacity: step === 1 || isSubmitting ? 0.4 : 1,
          }}>← Previous</button>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexDirection: "column" }}>
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>
              {countCompletedFields(currentData, STEP_REQUIRED_FIELDS[step] || [])} of {(STEP_REQUIRED_FIELDS[step] || []).length} required fields complete
            </div>
            {lastSavedTime && (
              <div style={{ fontSize: 11, color: C.green, fontWeight: 500 }}>
                Auto-saved at {lastSavedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
            {Object.keys(errors).length > 0 && (
              <div style={{ fontSize: 12, color: C.red, fontWeight: 600 }}>
                ⚠ {Object.keys(errors).length} field{Object.keys(errors).length !== 1 ? 's' : ''} need attention
              </div>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {step < STEPS.length ? (
                <button
                  onClick={() => {
                    const stepErrors = getStepErrors(currentData, step);
                    Object.assign(stepErrors, validateRuleSet(currentData, ADVANCE_DIRECTIVE_RULES[step] || {}, REQUIRED_FIELD_LABELS, { skipEmpty: true }));
                    if (Object.keys(stepErrors).length > 0) {
                      setErrors(stepErrors);
                      return;
                    }
                    setStep(s => s + 1);
                    setErrors({});
                  }}
                  disabled={!stepComplete || isSubmitting || saving}
                  style={{
                    padding: "9px 24px", background: stepComplete && !isSubmitting ? C.purple : C.textMuted, border: "none", borderRadius: 7,
                    fontSize: 13, fontWeight: 700, color: "#fff", cursor: stepComplete && !isSubmitting && !saving ? "pointer" : "not-allowed", opacity: stepComplete ? 1 : 0.5, display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  Continue →
                </button>
              ) : (
                <button
                  onClick={() => {
                    const stepErrors = getStepErrors(currentData, step);
                    Object.assign(stepErrors, validateRuleSet(currentData, ADVANCE_DIRECTIVE_RULES[step] || {}, REQUIRED_FIELD_LABELS, { skipEmpty: true }));
                    if (Object.keys(stepErrors).length > 0) {
                      setErrors(stepErrors);
                      return;
                    }
                    handleFormCompleted();
                  }}
                  disabled={saving || isSubmitting}
                  style={{
                    padding: "9px 24px", background: C.green, border: "none", borderRadius: 7,
                    fontSize: 13, fontWeight: 700, color: "#fff", cursor: saving || isSubmitting ? "not-allowed" : "pointer", opacity: saving || isSubmitting ? 0.6 : 1, display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  {isSubmitting && <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite" }} />}
                  {saving || isSubmitting ? "Submitting..." : "Submit Advance Directive ✓"}
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
          formType="advance-directive"
          fileName={generatePdfFilename('advance-directive', formData.resident_name || 'admission')}
          isGenerating={pdfGenerating}
          onDownload={handlePdfDownload}
          onContinue={handleContinueAfterPdf}
          continueHref="/admin?view=residents"
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
        accentColor={C.purple}
        accentBg={C.mauveLight}
        accentBorder={C.mauveBorder}
        onResume={() => {
          if (pendingDraft) setFormData(pendingDraft);
          setResumeDraftPrompt(false);
          setPendingDraft(null);
        }}
        onDiscard={() => {
          try { sessionStorage.removeItem(ADVANCE_DIRECTIVE_DRAFT_KEY); } catch { /* ignore */ }
          setResumeDraftPrompt(false);
          setPendingDraft(null);
        }}
      />
    </div>
  );
}
