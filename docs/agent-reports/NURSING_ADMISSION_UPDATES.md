# Nursing Admission Improvements

## Changes Made

### 1. Database Schema Extension
- Created migration file: `db/migrations/0001_extend_nursing_admissions.sql`
- Extended `care.nursing_admissions` table with all fields from the 8-step form:
  - **Step 1**: Demographics (name, DOB, gender, pronouns, emergency contact, reason for admission, orientation)
  - **Step 2**: Vital Signs & Allergies (temperature, pulse, respirations, O2 sat, height, weight, allergy details, skin findings)
  - **Step 3**: Review of Systems (neurological, cardiovascular, respiratory, GI, renal, musculoskeletal, EENT, skin, infectious disease screening)
  - **Step 4**: Pain, Sleep & Nutrition (pain assessment, sleep patterns, tobacco use, nutrition, ADL levels)
  - **Step 5**: Substance Abuse & Mental Status (AUDIT-C scores, substance use history, mental status examination fields)
  - **Step 6**: Risk Assessments (elopement, violence, trauma, sexual victimization, sexual aggression, restraint)
  - **Step 7**: Suicide Risk (C-SSRS protocol, protective/risk factors, observation level)
  - **Step 8**: Summary & Sign-off (narrative summary, RN signature, staff number)
- Added step completion tracking: `step_1_completed` through `step_8_completed` flags

### 2. API Route for Data Persistence
- Created: `src/app/api/v1/nursing-admissions/route.js`
- POST endpoint that:
  - Accepts resident_id, step number, and form data
  - Creates or updates nursing admission record
  - Maps form fields to database columns
  - Marks each step as completed
  - Returns the updated record

### 3. Form Validation & Navigation Control
- Added `isStepComplete()` function that validates required fields for each step:
  - Step 1: name, DOB, age, gender, pronouns, language, emergency contact info, reason for admission
  - Step 2: temperature, pulse, respirations, O2 sat, height, weight, allergy status, scalp inspection
  - Step 3: flu vaccine consent (can be expanded)
  - Step 4: pain status, sleep hours, sleep medication
  - Step 5: AUDIT-C scores (all 3), LOC, insight, judgment
  - Step 6: violence assessment, restraint history
  - Step 7: All 6 C-SSRS questions
  - Step 8: narrative summary, RN name, staff number

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

### For Clinicians (RN Admitting):
1. Click "+ Admit Resident" from admin dashboard
2. Complete Step 1 (Demographics) with required fields
3. Click "Save & Continue" - form validates and saves
4. Complete Steps 2-7 following the same pattern
5. Step 8 shows overall completion summary
6. Sign off with RN name and submit for admin review

### For Admin:
- Review completed nursing assessments in draft status
- All data is captured in database for audit trail

## Required Next Steps

### 1. Run Database Migration
```bash
npm run db:migrate
```
This applies the new columns to the nursing_admissions table.

### 2. Resident ID Integration
Currently, the form accepts `resident_id` from URL query params:
```
/admission/nursing-admission?resident_id=<uuid>
```

The admin flow should either:
- Create a resident record first, then redirect to nursing admission with resident_id
- OR allow the nursing admission form to create/link to a resident

### 3. Verify Against Nursing Assessment Document
Cross-reference `Dependable LLC Nursing Assesment.pdf` to ensure:
- All required fields from the document are captured in the form
- All form fields map to the PDF document
- Any missing sections are identified

### 4. Testing
1. Navigate to: http://localhost:3000/admission/nursing-admission?resident_id=<test-uuid>
2. Test that:
   - Required fields block navigation when incomplete
   - Data saves when advancing steps
   - Sidebar steps lock until previous step is complete
   - Step 8 summary shows accurate completion percentages
   - Final submit routes to admin review

### 5. Optional Enhancements
- Auto-calculate BMI from height/weight
- Auto-calculate AUDIT-C score and risk level
- Auto-calculate C-SSRS risk level
- Add required field indicators (* or colored background)
- Add confirmation dialog before submitting for admin review
- Track edit history of admission records

## Files Modified/Created

### Created:
- `db/migrations/0001_extend_nursing_admissions.sql` - Database schema extension
- `src/app/api/v1/nursing-admissions/route.js` - API endpoint for saving assessments
- `NURSING_ADMISSION_UPDATES.md` - This documentation

### Modified:
- `src/app/admission/nursing-admission/page.js` - Added validation & step control
- `scripts/migrate-db.js` - Updated to read migration files from db/migrations directory

## Architecture Notes

The nursing assessment follows these principles:
- **Progressive Disclosure**: Users complete one step at a time
- **Data Persistence**: Each step saves independently via API
- **Validation at UI & DB**: Required fields validated before advancing
- **Audit Trail**: Step completion timestamps tracked in database
- **HIPAA Compliance**: All data stored in encrypted PHI fields
- **Optimistic UI**: Immediate feedback on form state without page reload
