# Admission Forms Refactoring Implementation Guide

**Status**: Ready for Implementation  
**Priority**: Critical  
**Effort**: 40-50 hours  
**Team**: Frontend + Backend  

---

## Overview

This guide outlines the complete refactoring of three admission form pages to:
1. Align fields with database schema exactly
2. Remove redundant/unnecessary fields
3. Implement unified professional UI with consistent navigation
4. Add PDF/JSON export functionality
5. Implement comprehensive field-level validation

---

## Deliverables Created

### 1. Audit Report
**File**: `FORM_AUDIT_REPORT.md`

Comprehensive analysis of all three forms against the database schema, including:
- Field mapping matrix (current vs. required)
- Missing fields per schema
- Extra fields not in schema
- Data type mismatches
- Duplicate fields across forms
- Navigation/UX issues
- PDF export gap
- Validation inconsistencies

**Action**: Review with clinical/compliance team to finalize field requirements

---

### 2. Shared Components

#### FormHeader.jsx
**File**: `src/components/FormHeader.jsx`

Professional header component featuring:
- Tenant logo and name
- User info display (logged in as)
- Current form title and step indicator
- Progress bar (0-100%)
- Close button with aria-label
- Consistent styling across all three forms

**Usage**:
```jsx
<FormHeader
  formTitle="Pre-Admission Screening"
  stepLabel="Referral & Funding"
  currentStep={1}
  totalSteps={6}
  tenantName="Dependable Care Residential Center"
  userName="Jane Smith, RN"
  onClose={() => router.back()}
/>
```

---

### 3. Validation Utilities

#### form-validation.js
**File**: `src/lib/form-validation.js`

Comprehensive validation system with:

**Validators**:
- `ssn`: XXX-XX-XXXX format
- `phone`: Multiple formats supported
- `email`: Standard email validation
- `date` / `dateNotFuture`: Date validation
- `required`: Field presence check
- `minLength` / `maxLength`: String length
- `numericRange`: Numeric bounds
- `medicaidId`: Medicaid ID format
- `dsmDiagnosis`: DSM-5 code validation

**Validation Rule Sets**:
- `PRE_SCREENING_RULES` (6 steps)
- `NURSING_RULES` (8 steps)
- `ADVANCE_DIRECTIVE_RULES` (4 steps)

**Helper Functions**:
- `validateField(value, rules)` - Single field validation
- `validateStep(stepData, stepRules)` - Entire step validation
- `getHIPAAErrorMessage(fieldName, error)` - Sanitized error messages (doesn't leak PHI)
- `validateWitnessesDifferent()` - Cross-field validation for advance directive
- `validateSignatureSequence()` - Date ordering validation

**HIPAA Compliance**:
- Sensitive field detection (SSN, phone, diagnosis)
- Generic error messages for sensitive fields in client-side validation
- No detailed error messages that could expose protected health information

**Usage**:
```jsx
const { errors, isValid } = validateStep(formData[step], PRE_SCREENING_RULES[step]);

if (!isValid) {
  // Show errors
  setErrors(errors);
  return;
}

// Proceed to next step
```

---

### 4. PDF/Export Utilities

#### form-pdf-export.js
**File**: `src/lib/form-pdf-export.js`

Multiple export format support:

**Functions**:
1. `downloadFormAsJSON()` - Structured JSON export with metadata
2. `downloadFormAsText()` - Plain text with line breaks
3. `downloadFormAsCSV()` - Spreadsheet-compatible format
4. `exportFormToPDF()` - PDF export (requires @react-pdf/renderer integration)

**Features**:
- Automatic filename generation: `{formType}_{residentName}_{date}.{ext}`
- PHI filtering (removes internal IDs, timestamps)
- Array flattening for readability
- Proper escaping for CSV/JSON formats
- Browser-native download (no server dependency)

**Usage**:
```jsx
<button onClick={() => downloadFormAsJSON({
  formType: 'pre-screening',
  formData: allFormData,
  residentName: 'John Doe',
})}>
  Export as JSON
</button>
```

**Note**: PDF export currently uses JSON/CSV as fallback. To fully implement PDF:
1. Install `@react-pdf/renderer`
2. Extend `FormPDF` component with form-specific layout
3. Use `pdf()` utility to generate blob and trigger download

---

## Implementation Checklist

### Phase 1: Foundation (Week 1)
- [ ] Review and approve `FORM_AUDIT_REPORT.md`
- [ ] Confirm field requirements with clinical team
- [ ] Get sign-off on missing/extra field decisions
- [ ] Set up new component/utility files (already done)
- [ ] Verify validation rules are complete

### Phase 2: Pre-Screening Refactoring (Week 2)
- [ ] Implement Step 1 (Referral) with validation
- [ ] Implement Steps 2-5 with proper field mapping
- [ ] Implement Step 6 (Summary) with required fields
- [ ] Add export button functionality
- [ ] Test with sample data
- [ ] Verify all schema fields are captured

### Phase 3: Nursing Assessment Refactoring (Week 2-3)
- [ ] Reduce field count from 200+ to match schema (40 columns)
- [ ] Reorganize systems review (use TEXT/JSONB serialization)
- [ ] Fix Step 8 read-only fields
- [ ] Implement signature capture UI
- [ ] Add validation for vital signs ranges
- [ ] Test AUDIT-C scoring logic

### Phase 4: Advance Directive Refactoring (Week 3)
- [ ] Add missing Step 3 (Mental Health Preferences)
- [ ] Fix field naming to match DB schema exactly
- [ ] Add witness validation (2 different people required)
- [ ] Implement date ordering validation
- [ ] Add notary field
- [ ] Test signature sequence validation

### Phase 5: Integration & Testing (Week 3-4)
- [ ] Create form flow test scenarios
- [ ] Test data flow from form → API → database
- [ ] Verify PDF/JSON export integrity
- [ ] Security audit (HIPAA compliance)
- [ ] Cross-browser testing
- [ ] Mobile responsiveness check

### Phase 6: Deployment (Week 4)
- [ ] Documentation update
- [ ] Staff training materials
- [ ] Deployment to staging
- [ ] User acceptance testing
- [ ] Production deployment

---

## Database Schema Alignment

### Pre-Admission Screening
**Table**: `care.pre_admission_screenings`

Required field mappings:

```
Step 1: Referral & Funding
- referral_source ← referringAgency
- referral_date ← referralDate
- funding_source ← fundingSource
- estimated_length_of_stay_days ← estLengthOfStay (ADD THIS)

Step 2: Mental Health History
- mh_diagnosis_primary ← primaryDiagnosis
- mh_diagnosis_secondary ← secondaryDiagnoses
- mh_current_medications ← psychMeds (as JSONB)
- mh_hospitalizations ← psychHospitalizations

Step 3: Medical History
- medical_history_summary ← medicalDiagnoses
- chronic_conditions ← medicalDiagnoses (as JSONB)
- current_medications ← nonPsychMeds (as JSONB)
- medication_allergies ← drugAllergies
- medical_allergies ← medicalAllergies
- surgical_history ← surgicalHistory

Step 4: Substance Use
- primary_substance ← primarySubstance
- substance_use_summary ← substanceUseSummary
- treatment_history ← previousTreatment
- recovery_status ← recoveryStatus

Step 5: Psychosocial & Legal
- family_support_available ← familySupport
- family_contacts ← familyContacts
- employment_status ← incomeSource
- housing_status ← livingSituation (from Step 1)
- legal_issues ← legalStatus
- court_ordered_treatment ← courtOrdered

Step 6: Summary & Sign-off
- recommended_level_of_care ← levelOfCareNeeds
- clinical_summary ← strengthsSummary
- screening_clinician_name ← assessorName
- screening_clinician_license ← assessorTitle (ADD TO DB)
- screening_date ← assessorDate
- admission_recommended ← screeningOutcome
- submitted_by ← current user ID
- submitted_at ← current timestamp
```

**Remove from form**:
- SSN (belongs in residents table)
- OHP ID (belongs in residents table)
- PCP contact (belongs in medical records)
- TB/COVID status (belongs in nursing assessment)
- Mobility/ADL details (belongs in nursing assessment)

---

### Nursing Assessment
**Table**: `care.nursing_admissions`

Critical changes:

```
Step 1: Demographics
- All demographic fields already captured in Pre-Screening
- PRE-POPULATE from residents table instead of re-asking
- Only capture: orientation_items

Step 2: Vital Signs
- Create structured vital_signs JSONB:
  {
    "temperature_f": 98.6,
    "pulse": 72,
    "respirations": 16,
    "o2_saturation": 98,
    "height_inches": 68,
    "weight_lbs": 165,
    "bp_systolic": 120,
    "bp_diastolic": 80
  }
- Keep separate columns for critical values (weight, height for BMI)

Step 3-7: Systems Review (CONSOLIDATE)
- Instead of 50+ checkboxes → 6 TEXT fields
- Serialize as:
  {
    "neurological": ["headaches", "tremors"],
    "cardiovascular": ["hypertension", "palpitations"],
    "respiratory": ["asthma", "sleep_apnea"],
    "gi_endocrine": ["diabetes", "constipation"],
    "renal": ["uti_history"],
    "musculoskeletal": ["joint_pain", "edema"]
  }

Step 4: Pain/Sleep/Nutrition
- pain_assessment JSONB:
  {
    "present": true,
    "scale": 6,
    "location": "lower back",
    "type": ["dull", "aching"]
  }
- sleep_history: TEXT description
- nutrition_assessment JSONB with concerns array

Step 5: Substance & Mental Status
- audit_c_score: INTEGER (0-12)
- substance_history: TEXT
- mental_status_exam JSONB with all fields

Step 6: Risk Assessments
- risk_summary JSONB with boolean flags for each category

Step 7: Suicide Risk (Columbia-SSRS)
- csrs_score: INTEGER
- csrs_responses: JSONB with Q1-Q6 answers
- risk_level: VARCHAR('low'|'moderate'|'high')

Step 8: Sign-off
- assessment_completed_by: INTEGER (staff ID)
- assessment_date: DATE
- supervisor_review_date: DATE (nullable)
- supervisor_id: INTEGER (nullable)
- submitted_by: INTEGER (current user)
- submitted_at: TIMESTAMP
- clinical_summary: TEXT (required)
```

---

### Advance Directive
**Table**: `care.advance_directives`

Field name corrections:

```
Step 1: Directive Info
- directive_type ← form type ('Living Will', 'Healthcare POA', etc.)
- directive_date ← date of directive creation

Step 2: Healthcare Agent
- agent_name ← healthcare_agent_name
- agent_relationship ← healthcare_agent_relationship
- agent_phone ← healthcare_agent_phone
- agent_email ← healthcare_agent_email
- agent_address ← healthcare_agent_address
- agent_acknowledgment_signature ← ADD THIS (agent signs acknowledgment)
- agent_acknowledgment_date ← ADD THIS
- alternate_agent_name ← alternate_agent_name
- alternate_agent_relationship ← ADD THIS
- alternate_agent_phone ← alternate_agent_phone

Step 3: Mental Health Preferences (NEW - add to form)
- mh_hospitalization_preference ← [yes|no|limited]
- mh_medication_preference ← TEXT description
- mh_therapy_preference ← TEXT description
- mh_crisis_contact_name ← TEXT
- mh_crisis_contact_phone ← TEXT

Step 4: Treatment Preferences
- resuscitation_preference ← cpr_preference
- mechanical_ventilation_preference ← ventilation_preference
- feeding_tube_preference ← nutrition_preference (CLARIFY: field mismatch)
- dialysis_preference ← ADD IF NEEDED
- blood_transfusion_preference ← ADD IF NEEDED
- organ_donation_preference ← donation_preference
- pain_management_preference ← pain_relief_preference

Step 5: Personal Values & Culture
- cultural_beliefs ← cultural_religious_practices
- religious_beliefs ← cultural_religious_practices (split)
- important_life_values ← end_of_life_wishes
- spiritual_practices ← ADD IF NEEDED

Step 6: End-of-Life & Signatures
- quality_of_life_preferences ← unacceptable_quality_of_life
- palliative_care_preferences ← ADD IF NEEDED
- location_of_death_preference ← ADD IF NEEDED
- funeral_arrangements ← ADD IF NEEDED
- resident_signature ← resident_signature
- resident_signature_date ← resident_signature_date
- witness_1_name ← witness1_name
- witness_1_signature ← witness1_signature
- witness_1_signature_date ← witness1_signature_date
- witness_2_name ← witness2_name
- witness_2_signature ← witness2_signature
- witness_2_signature_date ← witness2_signature_date
- notary_public_stamp ← ADD NOTARY FIELD
```

---

## API Endpoints to Update

After form refactoring, update these endpoints:

```
POST /api/v1/admission/pre-screening
- Input validation against PRE_SCREENING_RULES
- Field mapping to care.pre_admission_screenings
- Serialize medications/conditions as JSONB
- Return: { admission_id, status, errors (if validation fails) }

POST /api/v1/admission/nursing-assessment
- Input validation against NURSING_RULES
- Consolidate systems review into JSONB
- Calculate AUDIT-C score
- Return: { admission_id, status }

POST /api/v1/admission/advance-directive
- Input validation against ADVANCE_DIRECTIVE_RULES
- Validate witnesses are different
- Check signature date sequences
- Return: { admission_id, status }

GET /api/v1/admission/:id/export
- Query params: format (pdf|json|csv|txt)
- Return downloadable file with form data
```

---

## Testing Strategy

### Unit Tests
- Validation rules (each validator function)
- Field mapping (data transformation)
- Export functions (format correctness)

### Integration Tests
- Form submission → API → Database
- Data persistence across steps
- Draft save/resume functionality
- Concurrent form submissions

### Security Tests
- XSS prevention (input sanitization)
- CSRF token validation
- PHI field encryption
- Access control (user can only see their own admissions)

### Compliance Tests
- HIPAA: Field-level encryption for PHI
- 42 CFR Part 2: Substance use disclosure controls
- Digital signature validity (timestamp order)
- Audit trail (all modifications logged)

---

## Migration Strategy

For existing draft forms in database:

1. **Backup all current admission data**
   ```sql
   CREATE TABLE care.pre_admission_screenings_backup AS
   SELECT * FROM care.pre_admission_screenings;
   ```

2. **Data migration script**
   - Map old field names to new schema
   - Consolidate extra fields into JSONB
   - Handle type conversions (text → array, etc.)
   - Validate no data loss

3. **Rollback plan**
   - Keep backup tables for 30 days
   - Document exact migration queries
   - Test on staging environment first

---

## Success Criteria

- [ ] All three forms use FormHeader component
- [ ] All form fields map exactly to database schema
- [ ] No duplicate field captures across forms
- [ ] Validation rules catch all invalid inputs
- [ ] PDF/JSON export works for all forms
- [ ] Error messages are HIPAA-compliant
- [ ] Mobile responsive on all devices
- [ ] 100% test coverage for validation rules
- [ ] Form submission → Database roundtrip successful
- [ ] Staff training complete and documented

---

## Timeline

**Week 1**: Foundation (4-6 hours)
**Week 2**: Pre-Screening + Nursing (12-15 hours)
**Week 3**: Advance Directive + Integration (10-12 hours)
**Week 4**: Testing + Deployment (8-10 hours)

**Total**: 40-50 hours

---

## Questions for Stakeholder Review

1. **Pre-Screening extra fields**: Should SSN, OHP ID, insurance details be removed or moved?
2. **Nursing Assessment granularity**: Is the consolidated JSONB approach acceptable, or do we need individual DB columns?
3. **Advance Directive enhancements**: Should we add notary signature capture? Digital signature provider integration?
4. **PDF export**: Should we use @react-pdf/renderer or server-side PDF generation?
5. **Data retention**: How long should draft forms be stored? Should there be an auto-expire?
6. **Role-based field access**: Should some fields be hidden based on staff role?
7. **Multi-language**: Should forms support Spanish (majority of residents)?

---

**Next Step**: Schedule stakeholder review meeting to approve audit findings and answer outstanding questions before implementation begins.
