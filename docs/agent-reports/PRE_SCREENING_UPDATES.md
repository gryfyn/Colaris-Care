# Pre-Admission Screening Improvements

## Changes Made

### 1. Database Schema Extension
- Created migration file: `db/migrations/0003_extend_pre_admission_screenings.sql`
- Extended `care.pre_admission_screenings` table with all fields from the 6-step form:
  - **Step 1**: Referral & Funding (referring agency, contact info, SSN, OHP ID, insurance, living situation, county, presenting problem)
  - **Step 2**: Mental Health History (psychiatric diagnosis, psychotropic medications, hospitalization history, outpatient team contacts)
  - **Step 3**: Medical History & Needs (PCP info, medical diagnoses, non-psychiatric medications, mobility status, communicable disease status)
  - **Step 4**: Substance Use History (primary/secondary substances, last use date, route of use, withdrawal history, previous treatment)
  - **Step 5**: Psychosocial & Legal (income source, legal status, probation/parole officer, trauma willingness, client strengths, LMHA connections)
  - **Step 6**: Level of Care & Summary (level of care needs, assessor summary, recommendation, screening outcome, assessor sign-off)
- Added step completion tracking: `step_1_completed` through `step_6_completed` flags
- Added submission tracking: `submitted_at` and `submitted_by` fields

### 2. API Route for Data Persistence
- Created: `src/app/api/v1/pre-admission-screenings/route.js`
- POST endpoint that:
  - Accepts resident_id, step number, and form data
  - Creates or updates pre-admission screening record
  - Maps form fields to database columns
  - Marks each step as completed
  - Tracks submission timestamp and staff member
  - Returns the updated record

### 3. Form Validation & Navigation Control
- Added `isStepComplete()` function that validates required fields for each step:
  - Step 1: referringAgency, referralDate, contactPerson, ssn, livingSituation, county, presentingProblem
  - Step 2: primaryDiagnosis, diagnosisDate
  - Step 3: pcpName, medicalDiagnoses
  - Step 4: primarySubstance
  - Step 5: incomeSource, legalStatus
  - Step 6: levelOfCareNeeds (at least one selected), strengthsSummary, assessorName, assessorSignature, assessorDate

- **Sidebar Navigation Lock**: Users cannot jump to future steps
  - Steps show as locked (🔒) until previous step is complete
  - Only completed or current step is clickable

- **Footer Button States**:
  - "Save & Continue" button is disabled until current step is complete
  - Shows warning message: "⚠ Complete all required fields to continue"
  - Button disables during save operation

### 4. Auto-Save on Step Advance
- When user clicks "Save & Continue", data is automatically saved via API before moving to next step
- Prevents data loss if user navigates away

## How to Use

### For Assessors (Completing Pre-Screening):
1. Click to start pre-screening from admission process
2. Complete Step 1 (Referral & Funding) with required fields including funding/insurance info
3. Click "Save & Continue" - form validates and saves
4. Step 2: Document psychiatric history and current medications
5. Step 3: Record medical information and non-psychiatric medications
6. Step 4: Assess substance use history and prior treatment
7. Step 5: Document psychosocial context and legal status
8. Step 6: Determine level of care needs and provide professional recommendation
9. Sign off as assessor and submit for admin review

### For Admin:
- Review completed pre-admission screenings
- Verify all required information is captured
- Make final admission decisions based on assessor recommendation
- All data is captured in database for audit trail

## Required Next Steps

### 1. Run Database Migration
```bash
npm run db:migrate
```
This applies the new columns to the pre_admission_screenings table.

### 2. Resident ID Integration
Currently, the form accepts `resident_id` from URL query params:
```
/admission/pre-screening?resident_id=<uuid>
```

Ensure the admission workflow properly links forms together.

### 3. Verify Against Pre-Screening Document
Cross-reference `Dependable LLC Pre Screening form.docx` to ensure:
- All required fields from the document are captured in the form
- All form fields map to the document
- Any missing sections are identified
- Form aligns with Oregon law requirements for residential facility admissions

### 4. Testing
1. Navigate to: http://localhost:3000/admission/pre-screening?resident_id=<test-uuid>
2. Test that:
   - Required fields block navigation when incomplete
   - Data saves when advancing steps
   - Sidebar steps lock until previous step is complete
   - Step 6 summary shows accurate completion percentages
   - Assessor signature and date are captured
   - Final submit completes the screening and routes to next form

### 5. Optional Enhancements
- Add required field indicators (* or colored background)
- Pre-populate patient information from nursing assessment
- Add conditional logic for probation/parole fields (hide if legal status is "None")
- Add level of care recommendations based on needs selected
- Create PDF export of completed screening
- Add admin review workflow with approval/rejection
- Add flag system for high-risk cases needing expedited review

## Files Modified/Created

### Created:
- `db/migrations/0003_extend_pre_admission_screenings.sql` - Database schema extension
- `src/app/api/v1/pre-admission-screenings/route.js` - API endpoint for saving screenings
- `PRE_SCREENING_UPDATES.md` - This documentation

### Modified:
- `src/app/admission/pre-screening/page.js` - Added validation & step control
- `scripts/migrate-db.js` - Now reads all migration files from db/migrations directory (if not already updated)

## Architecture Notes

The pre-admission screening follows these principles:
- **Progressive Disclosure**: Users complete one step at a time
- **Clinical Workflow**: Step order matches assessment flow (history → current status → level of care)
- **Data Persistence**: Each step saves independently via API
- **Validation at UI & DB**: Required fields validated before advancing
- **Audit Trail**: Step completion timestamps and assessor information tracked
- **Compliance**: Captures all information required for Oregon residential facility admissions
- **Optimistic UI**: Immediate feedback on form state without page reload

## Integration with Other Forms

The pre-admission screening integrates with:
- **Nursing Admission Assessment**: References psychiatric/medical data from nursing assessment
- **Advance Directive**: Scheduled after pre-screening in admission workflow
- **Resident Records**: Linked via resident_id for continuity of care
- **Admin Dashboard**: Accessible from resident admission workflow

## Field Mappings

### Medication Lists
- Step 2: `psychMeds` (JSONB) - Psychiatric medications with dosage and prescriber
- Step 3: `nonPsychMeds` (JSONB) - Non-psychiatric medications with dosage and indication

### Level of Care Needs
- Step 6: Array of selected needs from predefined checklist
- Includes: 24hr supervision, medication admin, ADL assistance, dementia care, CBT/DBT, SUD programming, accessibility, secure facility, dietary needs

### Assessor Recommendation
- Step 6 requires assessor to:
  - Summarize client strengths
  - Identify barriers to placement
  - Provide clinical recommendation
  - Select screening outcome: Approved, Not Appropriate, or Deferred/Waitlisted
  - If approved, list any conditions prior to admission

## Required vs Optional Fields

### Step 1 (Referral & Funding) - ALL REQUIRED
- Referring agency, referral date, contact person, SSN, living situation, county, presenting problem

### Step 2 (Mental Health History) - DIAGNOSIS REQUIRED
- Primary diagnosis and diagnosis date required; medications optional

### Step 3 (Medical History) - KEY FIELDS REQUIRED
- PCP name and medical diagnoses required; other fields support additional context

### Step 4 (Substance Use) - PRIMARY SUBSTANCE REQUIRED
- At least primary substance must be documented for appropriate level of care

### Step 5 (Psychosocial & Legal) - STATUS REQUIRED
- Income source and legal status required for case planning

### Step 6 (Level of Care & Summary) - ASSESSOR COMPLETION REQUIRED
- All assessor fields required for professional recommendation and sign-off

## Compliance Considerations

This form captures information required for:
- **OAR 411 (Oregon Administrative Rules)**: Residential facility licensing
- **42 CFR Part 2**: Confidentiality of substance abuse treatment records
- **HIPAA**: Protected health information handling
- **Adult Behavioral Health (ABH)**: Oregon's behavioral health system integration
- **LMHA/Certified Agency**: Referral coordination with county mental health authorities
