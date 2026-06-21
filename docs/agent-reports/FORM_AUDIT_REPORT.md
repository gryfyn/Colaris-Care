# Admission Forms Audit Report
**Generated**: 2026-05-17  
**Auditor**: Frontend Team  
**Status**: In Progress

---

## Executive Summary

Three admission form wizards (Pre-Screening, Nursing Assessment, Advance Directive) were audited against the database schema for field completeness, accuracy, and consistency. Findings include:

- **Schema Mismatches**: 15+ fields missing from forms that are required by DB schema
- **Duplicate Fields**: 8 fields captured identically across multiple forms
- **Type Mismatches**: Form fields using incorrect data types vs. DB schema
- **Navigation**: Three separate modal designs with inconsistent styling
- **PDF Export**: Not yet implemented on any form
- **Validation**: Inconsistent validation rules across forms

**Priority**: Critical for HIPAA compliance and data integrity

---

## Form 1: Pre-Admission Screening

### Current Implementation
- **File**: `src/app/admission/pre-screening/page.js`
- **Steps**: 6 (Referral, MH History, Medical, Substance Use, Psychosocial, Summary)
- **Theme**: Teal/Slate color scheme
- **Status**: Partially complete

### Database Target
- **Table**: `care.pre_admission_screenings`
- **Required Fields**: 30+ columns across 6 steps

### Field Mapping Analysis

| Form Field | DB Column | Current | Status |
|---|---|---|---|
| **Step 1: Referral** | | | |
| Referring Agency | referral_source | ✓ Capture | OK |
| Referral Date | referral_date | ✓ Capture | OK |
| Funding Source | funding_source | ✓ Capture | OK |
| SSN | ❌ Not in schema | ✗ Remove | ISSUE |
| OHP ID | ❌ Not in schema | ✗ Remove | ISSUE |
| Other Insurance | ❌ Not in schema | ✗ Remove | ISSUE |
| **Step 2: Mental Health** | | | |
| Primary Diagnosis | mh_diagnosis_primary | ✓ Capture | OK |
| Diagnosis Date | ❌ Not in schema | ✗ Remove | ISSUE |
| Secondary Diagnoses | mh_diagnosis_secondary | ✓ Capture | OK |
| Psychotropic Meds | mh_current_medications | ✓ As JSONB | OK |
| Psychiatric History | mh_hospitalizations | Partial | PARTIAL |
| Outpatient Support | ❌ Not in schema | ✗ Consider | ISSUE |
| **Step 3: Medical** | | | |
| PCP Name | ❌ Not in schema | ✗ Remove | ISSUE |
| Medical Diagnoses | chronic_conditions | ✓ As JSONB | OK |
| Non-Psych Meds | current_medications | ✓ As JSONB | OK |
| Mobility Status | ❌ Not in schema | ✗ Remove | ISSUE |
| ADL Notes | ❌ Not in schema | ✗ Remove | ISSUE |
| TB Test | ❌ Not in schema | ✗ Remove | ISSUE |
| COVID Vax | ❌ Not in schema | ✗ Remove | ISSUE |
| **Step 4: Substance** | | | |
| Primary Substance | primary_substance | ✓ Capture | OK |
| Last Use Date | ❌ Not in schema | ✗ Remove | ISSUE |
| Route of Use | ❌ Not in schema | ✗ Remove | ISSUE |
| Withdrawal History | ❌ Not in schema | ✗ Remove | ISSUE |
| Previous Treatment | treatment_history | ✓ Capture | OK |
| **Step 5: Psychosocial** | | | |
| Income Source | employment_status | Partial | PARTIAL |
| Legal Status | legal_issues | Partial | PARTIAL |
| Family Support | family_support_available | ✓ Capture | OK |
| **Step 6: Summary** | | | |
| Level of Care | recommended_level_of_care | ✓ Capture | OK |
| Assessor Summary | clinical_summary | ✓ Capture | OK |

### Issues Identified

1. **Extra Fields (Not in Schema)**:
   - SSN, OHP ID, Other Insurance (belong in residents table, not pre-screening)
   - PCP contact info, mobility status, ADL notes, TB/COVID status
   - Diagnosis date, route of use, withdrawal details

2. **Missing Fields (In Schema)**:
   - `estimated_length_of_stay_days` (Step 1)
   - `recovery_status` (Step 4)
   - `housing_status`, `court_ordered_treatment` (Step 5)
   - `screening_clinician_license`, `screening_date` (Step 6)
   - `admission_recommended` (Step 6)

3. **Type Mismatches**:
   - Medications: Form uses array of objects, DB expects JSONB
   - Medical conditions: Form uses textarea, DB expects JSONB

4. **Validation Issues**:
   - No validation for SSN format
   - No check for insurance ID format
   - Missing required field markers

---

## Form 2: Nursing Assessment

### Current Implementation
- **File**: `src/app/admission/nursing-assessment/page.js`
- **Steps**: 8 (Demographics, Vitals, Systems, Pain/Sleep, Substance, Risks, Suicide, Summary)
- **Theme**: Purple/Lilac color scheme
- **Status**: Comprehensive but oversized

### Database Target
- **Table**: `care.nursing_admissions`
- **Required Fields**: 40+ columns across 8 steps

### Critical Issues

1. **Overly Comprehensive** (Not matching schema):
   - 200+ individual form fields vs. 40 DB columns
   - Step 3 (Systems Review): Captures ~50 checkbox items, DB has 6 TEXT fields
   - Step 4 (Pain/Sleep): Over 20 fields, DB has 9 columns
   - Step 5 (Substance): 15 fields vs. 8 DB columns

2. **Data Serialization Problem**:
   - Form captures granular checkboxes
   - DB expects TEXT/JSONB
   - Mismatch in resolution: form is too detailed

3. **Missing Required Fields**:
   - `assessment_completed_by` (staff ID)
   - `assessment_date`
   - `supervisor_review_date`, `supervisor_id`
   - `submitted_at`, `submitted_by`

4. **Step 8 (Summary) Issues**:
   - Read-only fields with `onChange={v => {}}` (should be disabled)
   - No actual signature capture mechanism
   - Missing sign-off metadata

---

## Form 3: Advance Directive

### Current Implementation
- **File**: `src/app/admission/advance-directive/page.js`
- **Steps**: 4 (Healthcare Agent, Preferences, Values, Signatures)
- **Theme**: Purple/Mauve color scheme
- **Status**: Simplified but field-incomplete

### Database Target
- **Table**: `care.advance_directives`
- **Required Fields**: 30+ columns across 6 DB steps (form has only 4)

### Issues

1. **Missing Entire DB Step**:
   - Form has 4 steps; DB schema has 6 logical sections
   - Missing: Mental Health Treatment Preferences (Step 3 in DB)
   - Form conflates Steps 2-4 of DB into single form sections

2. **Field Naming Mismatch**:
   - Form: `healthcare_agent_name` → DB: `agent_name`
   - Form: `cpr_preference` → DB: `resuscitation_preference`
   - Form: `nutrition_preference` → DB: `feeding_tube_preference` (mismatch)

3. **Missing Fields**:
   - `directive_type`, `directive_date` (Step 1 in DB)
   - `mh_hospitalization_preference`, `mh_medication_preference` (Step 3 in DB)
   - `agent_acknowledgment_signature`, `agent_acknowledgment_date`
   - All witness fields in DB (witness_2_address missing, etc.)
   - `notary_public_stamp`

4. **Signature Validation**:
   - No actual signature capture (just text input)
   - No witness verification
   - No notary field

---

## Duplicate Fields Across Forms

| Field | Pre-Screening | Nursing | Advance Directive | Issue |
|---|---|---|---|---|
| Client Full Name | ✓ Step 1 | ✓ Step 1 | ✓ Step 4 | Redundant; should be in residents table |
| Date of Birth | ✓ Step 1 | ✓ Step 1 | ✗ | Captured twice in nursing |
| Pronouns | ✓ Step 1 | ✓ Step 1 | ✗ | Redundant |
| Emergency Contact | ✓ Step 1 | ✓ Step 1 | ✗ | Redundant |
| Gender | ✓ Form | ✓ Step 1 | ✗ | Redundant |
| Primary Diagnosis | ✓ Step 2 | ✗ | ✗ | OK (different contexts) |
| Medications | ✓ Step 2-3 | ✓ Step 1-7 | ✗ | Both capture; nursing is overly detailed |

**Solution**: Pre-populate demographic fields from residents table; don't re-capture.

---

## Navigation & UX Issues

### Current State
- Three completely separate modal wizards
- No unified header/footer
- No "Back to Admission Dashboard" breadcrumb
- No progress tracking across forms
- No tenant branding visible
- No user info display
- Each modal has different styling

### Desired State
- Consistent header bar (tenant logo, user info, current form name)
- Unified breadcrumb navigation
- Visual indication of 3-form flow
- Consistent color theme
- Professional healthcare UI aesthetic

---

## PDF Export

### Current State
- Not implemented on any form
- @react-pdf/renderer available but unused

### Requirements
- Export each step as separate page
- Include header (facility name, resident info, date)
- Professional layout with form values
- Filename: `admission_[form_type]_[resident_id]_[date].pdf`

---

## Validation Issues

### Pre-Screening
- SSN validation: None
- Phone format: None
- Required field indicators: Inconsistent
- Error messages: Generic

### Nursing Assessment
- Vital signs: No range checks
- Pain scale: No validation
- Checkboxes: No "at least one required" checks
- Read-only fields: Accepted onChange events

### Advance Directive
- Signature fields: Treated as text input
- Witness validation: None
- Date validation: No check for future dates
- Required witness count: Not enforced (needs 2)

---

## Recommendations

### Immediate (Critical)
1. **Remove non-schema fields** from all three forms
2. **Fix field mappings** to match DB column names exactly
3. **Add missing required fields** per schema
4. **Create unified header/navigation** component
5. **Implement proper validation** with error messaging

### Short-term (High Priority)
1. **Deduplicate demographics** - use single capture in first form, pre-populate others
2. **Implement PDF export** on all forms
3. **Fix read-only fields** in summary steps (use disabled, not onChange={v => {}})
4. **Add signature capture** UI (digital signature or timestamp-based)

### Medium-term (Enhancement)
1. **Type safety**: Use TypeScript for form data
2. **Field-level encryption** for PHI (SSN, diagnoses)
3. **Auto-save draft** functionality
4. **Offline support** with sync
5. **Mobile-responsive** design

### Long-term (Architectural)
1. **Form builder** abstraction (reduce code duplication)
2. **Schema-driven UI** generation (reduce maintenance)
3. **Multi-language support** for forms

---

## Compliance Notes

### HIPAA Concerns
- PHI fields (SSN, diagnoses, medications) not encrypted at rest
- No audit trail for form access/modification
- No role-based field masking
- Signatures not legally binding (electronic signature standard needed)

### 42 CFR Part 2
- Substance use history must be clearly marked and separated
- Cannot share with non-authorized recipients
- Need explicit consent before disclosure

---

## Next Steps

1. Review this audit with clinical team
2. Clarify which non-schema fields are actually needed
3. Decide on signature capture method
4. Design unified form header/navigation
5. Implement schema-aligned refactor
6. Add PDF export functionality
7. Comprehensive testing with sample data
8. HIPAA compliance audit

---

**Status**: Awaiting approval to proceed with refactoring
**Estimated Effort**: 40-50 hours (audit + refactor + testing + PDF)
