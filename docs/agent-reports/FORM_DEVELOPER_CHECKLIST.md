# Form Refactoring Developer Checklist

Quick reference for implementing form refactoring. Use this checklist as you work through each form.

---

## Pre-Implementation

- [ ] Read `FORM_AUDIT_REPORT.md` for full context
- [ ] Review `FORM_REFACTORING_GUIDE.md` implementation plan
- [ ] Understand validation rules in `src/lib/form-validation.js`
- [ ] Review FormHeader component in `src/components/FormHeader.jsx`
- [ ] Check refactored template in `src/app/admission/pre-screening/page-refactored.js`
- [ ] Database schema changes approved by backend lead
- [ ] API endpoints updated per guide requirements

---

## For Each Form (Pre-Screening, Nursing, Advance Directive)

### Step 1: Component Setup
- [ ] Import FormHeader component
- [ ] Import validation rules (PRE_SCREENING_RULES, NURSING_RULES, or ADVANCE_DIRECTIVE_RULES)
- [ ] Import validation function (`validateStep`)
- [ ] Import export utilities if adding export buttons
- [ ] Set up useState hooks for form data, errors, step, saving state
- [ ] Remove old modal overlay styling; use flex layout with header
- [ ] Set form max-width to 900px, centered, with padding

### Step 2: Add FormHeader
```jsx
<FormHeader
  formTitle="Form Name"
  stepLabel={STEPS[step - 1]?.label}
  currentStep={step}
  totalSteps={STEPS.length}
  tenantName="Dependable Care Residential Center"
  userName={userName} // Get from auth context
  onClose={onClose}
/>
```

### Step 3: Remove Non-Schema Fields

**Pre-Screening - DELETE**:
- [ ] SSN (belongs in residents table)
- [ ] OHP ID (belongs in residents table)
- [ ] Other Insurance details (belongs in residents table)
- [ ] PCP contact info (belongs in medical records)
- [ ] TB/COVID vaccination status (belongs in nursing assessment)
- [ ] Mobility/ADL status (belongs in nursing assessment)

**Nursing Assessment - DELETE**:
- [ ] Duplicate demographics (pre-populate from Pre-Screening instead)
- [ ] Over-detailed systems checkboxes (consolidate per guide)
- [ ] Individual pain sub-fields (use structured JSONB)
- [ ] Granular sleep disturbance checks (use JSONB array)

**Advance Directive - FIX NAMING**:
- [ ] healthcare_agent_name → agent_name
- [ ] cpr_preference → resuscitation_preference
- [ ] nutrition_preference → feeding_tube_preference (or clarify mapping)
- [ ] witness fields → add witness_2_address, notary_public_stamp

### Step 4: Add Field Validation

For each step:
```jsx
const validation = validateStep(currentData, RULES[step]);

if (!validation.isValid) {
  setErrors(validation.errors);
  return; // Don't advance
}

// Clear errors when user edits field
const set = useCallback((key, val) => {
  setFormData(prev => ({ ...prev, [key]: val }));
  if (errors[key]) {
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }
}, [errors]);
```

### Step 5: Update Field Components

For each input, add error prop:
```jsx
<Field label="Field Name" error={errors.fieldName}>
  <TextInput
    value={data.fieldName}
    onChange={v => set('fieldName', v)}
    placeholder="..."
    error={errors.fieldName}
  />
</Field>
```

Field component will:
- Show red border if error exists
- Display error message below input
- Add `*` to label for required fields
- Use HIPAA-safe error message for sensitive fields

### Step 6: Update Step Components

Each Step should:
- [ ] Receive `errors` prop from parent
- [ ] Pass `errors={errors.fieldName}` to Field components
- [ ] Display InfoBox explaining the step's purpose
- [ ] Use SectionHead for grouping
- [ ] Use Grid for multi-column layout
- [ ] Follow label/placeholder conventions from audit

### Step 7: Update Form Submission

```jsx
const handleAdvanceStep = async () => {
  const validation = validateStep(formData[step], RULES[step]);
  
  if (!validation.isValid) {
    setErrors(validation.errors);
    return;
  }

  setSaving(true);
  try {
    const response = await fetch('/api/v1/admission/form-type', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        admission_id: admissionId,
        // Map form fields to DB column names exactly
        referral_source: formData[1].referringAgency,
        referral_date: formData[1].referralDate,
        // ... etc
      }),
    });
    
    if (response.ok) {
      setStep(s => s + 1);
    } else {
      const err = await response.json();
      console.error('API error:', err);
      alert('Error: ' + (err.error || 'Failed to save'));
    }
  } finally {
    setSaving(false);
  }
};
```

### Step 8: Add Export Button (Optional)

```jsx
<button onClick={() => downloadFormAsJSON({
  formType: 'form-name',
  formData: Object.assign({}, ...Object.values(formData)),
  residentName: currentData.firstName + ' ' + currentData.lastName,
})}>
  📥 Export as JSON
</button>
```

### Step 9: Update Footer/Navigation

Replace inline footer with:
```jsx
<footer style={{ background: C.white, borderTop: `1px solid ${C.border}`, padding: '14px 28px' }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}>
      ← Previous
    </button>
    
    <div style={{ display: 'flex', gap: 8 }}>
      {!validation.isValid && (
        <span style={{ color: C.red, fontSize: 12, fontWeight: 600 }}>
          ⚠ Complete all required fields
        </span>
      )}
      
      {step < STEPS.length ? (
        <button onClick={handleAdvanceStep} disabled={!validation.isValid || saving}>
          Save & Continue →
        </button>
      ) : (
        <button onClick={handleSubmit} disabled={saving}>
          {saving ? 'Submitting...' : 'Submit ✓'}
        </button>
      )}
    </div>
  </div>
</footer>
```

### Step 10: Test Each Form

- [ ] Start form, navigate through all steps
- [ ] Try submitting with incomplete required fields → error shown
- [ ] Fill all required fields → proceed enabled
- [ ] Edit field with error → error clears immediately
- [ ] Submit form → data saved to database
- [ ] Verify all DB columns populated with correct field values
- [ ] Test on mobile (should be responsive)
- [ ] Test on slow network (loading states work)
- [ ] Check accessibility (keyboard navigation, screen reader)

---

## Form-Specific Checklists

### Pre-Admission Screening

**Fields to Keep** (per schema):
- [ ] Referral source, date, contact info
- [ ] Funding source
- [ ] Living situation, county
- [ ] Presenting problem
- [ ] Primary/secondary diagnoses
- [ ] Medications (psych + non-psych, serialize as JSONB)
- [ ] Medical conditions
- [ ] Primary substance, treatment history
- [ ] Income source, employment status
- [ ] Legal status, family support
- [ ] Level of care needs
- [ ] Summary/assessor details

**Validation Rules**:
- [ ] Step 1: referringAgency (required, min 3 chars), referralDate (required, not future), contactPerson (required), livingSituation (required), county (required), presentingProblem (required, min 10 chars)
- [ ] Step 2: primaryDiagnosis (required, min 5 chars), diagnosisDate (required, not future)
- [ ] Step 3: pcpName (required), medicalDiagnoses (required, min 5 chars)
- [ ] Step 4: primarySubstance (required)
- [ ] Step 5: incomeSource (required), legalStatus (required)
- [ ] Step 6: levelOfCareNeeds (required array), strengthsSummary (required, min 20 chars), assessorName (required), assessorSignature (required), assessorDate (required, not future)

**Export**:
- [ ] Add "Export as JSON" button to Step 6 footer
- [ ] Test export includes all form data

---

### Nursing Assessment

**Consolidation Strategy**:
- [ ] Step 1: Pre-populate demographics from residents table (don't re-ask name/DOB/etc.)
- [ ] Step 2: Vitals → structured JSONB (temperature, pulse, respirations, o2, height, weight, BP)
- [ ] Step 3: Systems review → JSONB array per system (neuro, cardio, respiratory, GI, renal, musculoskeletal)
- [ ] Step 4: Pain/sleep → Pain JSONB + sleep TEXT description
- [ ] Step 5: Substance + MSE → Use AUDIT-C scoring, mental_status_exam JSONB
- [ ] Step 6: Risk assessments → risk_summary JSONB with boolean flags
- [ ] Step 7: Columbia-SSRS → csrs_responses JSONB + risk_level VARCHAR
- [ ] Step 8: Summary → assessment_completed_by (staff ID), assessment_date, supervisor fields

**Critical Field Mappings**:
- [ ] name → DON'T RE-CAPTURE (pre-populate from residents.first_name + residents.last_name)
- [ ] temperature → vital_temperature (numeric, 95-106°F range)
- [ ] pulse → vital_pulse (numeric, 40-200 bpm)
- [ ] pain_scale → pain_level (integer, 0-10)
- [ ] sleepPattern → sleep_history (TEXT or serialized array)
- [ ] AUDIT-C responses → audit_c_score (integer, 0-12)
- [ ] csrs1-6 → csrs_responses JSONB + calculate risk_level

**Validation Rules**:
- [ ] Step 1: DON'T validate (pre-populated)
- [ ] Step 2: temperature (95-106), pulse (40-200), respirations (8-40), o2Sat (70-100), height/weight required, allergies (required), scalp (required)
- [ ] Step 3: fluVaxConsent (required)
- [ ] Step 4: painPresent (required), sleepHours (0-24), sleepMedication (required)
- [ ] Step 5: auditC1-3 (all required), loc (required), insight (required), judgment (required)
- [ ] Step 6: violenceHcw, restraintSexualAbuse, restraintPhysicalAbuse (all required)
- [ ] Step 7: csrs1-6 (all required)
- [ ] Step 8: narrativeSummary (required, min 20 chars), rnName (required), staffNumber (required)

**Red Flags to Check**:
- [ ] Don't re-capture demographics; pre-populate only
- [ ] Systems review: consolidate 50+ checkboxes into 6 JSONB fields
- [ ] Pain assessment: structured JSONB (scale, location, type, relief methods)
- [ ] AUDIT-C: auto-calculate total score on submit
- [ ] Columbia-SSRS: auto-calculate risk level based on responses
- [ ] Step 8 fields: currently have `onChange={v => {}}`, fix to allow input

---

### Advance Directive

**Field Name Corrections**:
- [ ] healthcare_agent_name → agent_name
- [ ] healthcare_agent_relationship → agent_relationship
- [ ] healthcare_agent_phone → agent_phone
- [ ] healthcare_agent_email → agent_email
- [ ] healthcare_agent_address → agent_address
- [ ] cpr_preference → resuscitation_preference
- [ ] nutrition_preference → feeding_tube_preference (or clarify)
- [ ] ventilation_preference → mechanical_ventilation_preference
- [ ] pain_relief_preference → pain_management_preference
- [ ] donation_preference → organ_donation_preference

**Add Missing Fields**:
- [ ] Step 1: directive_type (VARCHAR), directive_date (DATE)
- [ ] Step 2: agent_acknowledgment_signature (VARCHAR), agent_acknowledgment_date (DATE)
- [ ] Step 3: NEW STEP - mh_hospitalization_preference, mh_medication_preference, mh_therapy_preference, mh_crisis_contact info
- [ ] Step 4: Add witness_2_address field, notary_public_stamp field

**Validation Rules**:
- [ ] Step 1: healthcare_agent_name (required, min 3), healthcare_agent_phone (required, valid format)
- [ ] Step 2: cpr_preference (required), nutrition_preference (required), ventilation_preference (required)
- [ ] Step 3: end_of_life_wishes (required, min 10 chars)
- [ ] Step 4: resident_name (required), resident_signature (required), resident_signature_date (required, not future), witness1_name (required), witness1_signature (required), witness1_signature_date (required, not future), witness2_name (required), witness2_signature (required), witness2_signature_date (required, not future)
- [ ] Cross-field: witness1_name ≠ witness2_name (validateWitnessesDifferent)
- [ ] Cross-field: signature dates in order (validateSignatureSequence)

**Red Flags to Check**:
- [ ] Advance Directive is missing Step 3 entirely (Mental Health Preferences) - ADD IT
- [ ] Witness validation: ensure 2 DIFFERENT people (not same person signed twice)
- [ ] Date validation: signature dates must be ≥ creation date
- [ ] Notary field: add if legal requirement exists
- [ ] Agent acknowledgment: should agent also sign?

---

## Post-Implementation Verification

### Testing Checklist
- [ ] All required fields have validation rules
- [ ] Error messages don't leak PHI (check sensitive fields)
- [ ] Form can be submitted with valid data
- [ ] Form cannot be submitted with invalid data
- [ ] Form data persists across page refresh (check localStorage or backend draft save)
- [ ] Form navigation works (Previous/Continue buttons)
- [ ] Export functionality works (JSON/CSV download)
- [ ] Mobile responsive (test on iPhone, tablet, desktop)
- [ ] Keyboard navigation works (Tab through all fields)
- [ ] Screen reader announces required field indicators

### Database Verification
- [ ] Data saved to correct table
- [ ] All form fields map to correct DB columns
- [ ] JSONB fields properly serialized/deserialized
- [ ] No "NULL" strings, proper null values
- [ ] Timestamps correct (not future-dated)
- [ ] Foreign keys valid (staff ID, tenant ID, resident ID)

### Code Quality
- [ ] No console errors or warnings
- [ ] FormHeader component used consistently
- [ ] Validation system integrated
- [ ] Field naming consistent with schema
- [ ] No hardcoded colors (use C constants)
- [ ] Proper error handling in API calls
- [ ] Loading states for async operations

---

## Common Mistakes to Avoid

❌ **MISTAKE**: Using form field names as DB column names  
✅ **FIX**: Map form field → DB column exactly per guide (e.g., referringAgency → referral_source)

❌ **MISTAKE**: Not removing non-schema fields  
✅ **FIX**: Delete all fields not in DB schema (SSN, OHP ID, PCP contact, etc.)

❌ **MISTAKE**: Re-capturing demographics in multiple forms  
✅ **FIX**: Pre-populate from residents table in Nursing/Advance Directive

❌ **MISTAKE**: Storing medication arrays as strings  
✅ **FIX**: Serialize as JSONB: `JSON.stringify([{name, dosage, prescriber}, ...])`

❌ **MISTAKE**: Not validating signature witnesses are different  
✅ **FIX**: Call validateWitnessesDifferent(witness1Name, witness2Name)

❌ **MISTAKE**: Showing detailed error messages for SSN/diagnoses  
✅ **FIX**: Use getHIPAAErrorMessage(fieldName, error) for sensitive fields

❌ **MISTAKE**: Having form data not match DB column names  
✅ **FIX**: Create explicit mapping function or object in API handler

---

## Quick Reference

### Import All Needed Utilities
```jsx
import FormHeader from '@/components/FormHeader';
import { validateStep, PRE_SCREENING_RULES } from '@/lib/form-validation';
import { downloadFormAsJSON } from '@/lib/form-pdf-export';
```

### Basic Form Structure
```jsx
export default function FormName() {
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState(/* initial */);
  
  const validation = validateStep(formData[step], RULES[step]);
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <FormHeader formTitle="..." stepLabel={...} currentStep={step} totalSteps={STEPS.length} />
      <main style={{ flex: 1, padding: '32px' }}>
        {/* Step component */}
      </main>
      <footer>
        {/* Navigation buttons */}
      </footer>
    </div>
  );
}
```

### Validate and Advance
```jsx
const handleAdvanceStep = () => {
  if (!validation.isValid) {
    setErrors(validation.errors);
    return;
  }
  setStep(s => s + 1);
};
```

---

## Resources

- Schema documentation: `FORM_AUDIT_REPORT.md`
- Implementation plan: `FORM_REFACTORING_GUIDE.md`
- Validation rules: `src/lib/form-validation.js`
- FormHeader API: `src/components/FormHeader.jsx`
- Refactored example: `src/app/admission/pre-screening/page-refactored.js`

---

**Last Updated**: 2026-05-17  
**Questions?** Contact Frontend Team Lead
