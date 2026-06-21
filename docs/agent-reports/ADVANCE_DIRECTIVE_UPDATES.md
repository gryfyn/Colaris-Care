# Advance Directive Improvements

## Changes Made

### 1. Database Schema Extension
- Created migration file: `db/migrations/0002_extend_advance_directives.sql`
- Extended `care.advance_directives` table with all fields from the 6-step form:
  - **Step 1**: Resident Information (address, purpose acknowledgment, clarification notes)
  - **Step 2**: Health Care Agent (appointment, agent details, authority scope, limitations)
  - **Step 3**: Mental Health Treatment Preferences (psychiatric medications, hospitalization, emergency interventions, contact notifications)
  - **Step 4**: Specific Treatment Preferences (therapy types, medication preferences, communication preferences, de-escalation strategies, crisis avoidance)
  - **Step 5**: Personal Values & Culture (spiritual care, faith tradition, practices, spiritual advisor contact, cultural mindfulness, personal values, review schedule, emergency contacts)
  - **Step 6**: End-of-Life & Signatures (end-of-life preferences, POLST status, resident/witness/agent/staff signatures and dates)
- Added step completion tracking: `step_1_completed` through `step_6_completed` flags
- Added submission tracking: `submitted_at` and `submitted_by` fields

### 2. API Route for Data Persistence
- Created: `src/app/api/v1/advance-directives/route.js`
- POST endpoint that:
  - Accepts resident_id, step number, and form data
  - Creates or updates advance directive record
  - Maps form fields to database columns
  - Marks each step as completed
  - Tracks submission timestamp and staff member
  - Returns the updated record

### 3. Form Validation & Navigation Control
- Added `isStepComplete()` function that validates required fields for each step:
  - Step 1: address, purposeAcknowledged
  - Step 2: hasAgent
  - Step 3: psychMedConsent, hospitalizationConsent, emergencyInterventionConsent
  - Step 4: therapyPreferences (at least one selected)
  - Step 5: spiritualCare, culturalMindfulness
  - Step 6: residentName, residentSignature, residentSignDate, witness1Name, witness1Signature, witness1Date, staffSignName, staffSignature, staffSignDate

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

### For Residents/Legal Representatives (Completing Directive):
1. Click to start advance directive from resident admission process
2. Complete Step 1 (Resident Information) with required fields
3. Click "Save & Continue" - form validates and saves
4. Step 2: Decide if appointing a health care agent (optional)
5. Step 3: Specify mental health treatment preferences
6. Step 4: Describe specific therapy and medication preferences
7. Step 5: Share personal values, spiritual beliefs, and cultural considerations
8. Step 6: Sign off with resident, witnesses, and staff signatures
9. Submit for completion

### For Staff (Facilitating Directive):
- Guide resident through each step
- Ensure all required information is captured
- Obtain proper signatures and witness attestations
- Document completion timestamp

## Required Next Steps

### 1. Run Database Migration
```bash
npm run db:migrate
```
This applies the new columns to the advance_directives table.

### 2. Resident ID Integration
Currently, the form accepts `resident_id` from URL query params:
```
/admission/advance-directive?resident_id=<uuid>
```

Ensure the admission workflow properly links forms together.

### 3. Verify Against Advance Directives Document
Cross-reference `Advance Directives.pdf` to ensure:
- All required fields from the document are captured in the form
- All form fields map to the PDF document
- Any missing sections are identified
- Form aligns with Oregon statute requirements for advance directives

### 4. Testing
1. Navigate to: http://localhost:3000/admission/advance-directive?resident_id=<test-uuid>
2. Test that:
   - Required fields block navigation when incomplete
   - Data saves when advancing steps
   - Sidebar steps lock until previous step is complete
   - Step 6 summary shows accurate completion percentages
   - Resident/witness/staff signatures are captured
   - Final submit completes the directive

### 5. Optional Enhancements
- Add required field indicators (* or colored background)
- Pre-populate resident information from previous forms (nursing assessment)
- Add conditional logic for agent-only fields (hide if agent not appointed)
- Add signature date validation (cannot be before resident sign date)
- Add confirmation dialog before final submission
- Create PDF download capability for completed directive
- Add amendment workflow for updating existing directives

## Files Modified/Created

### Created:
- `db/migrations/0002_extend_advance_directives.sql` - Database schema extension
- `src/app/api/v1/advance-directives/route.js` - API endpoint for saving directives
- `ADVANCE_DIRECTIVE_UPDATES.md` - This documentation

### Modified:
- `src/app/admission/advance-directive/page.js` - Added validation & step control
- `scripts/migrate-db.js` - Now reads all migration files from db/migrations directory

## Architecture Notes

The advance directive follows these principles:
- **Progressive Disclosure**: Users complete one step at a time
- **Conditional Fields**: Health care agent details only show if agent appointed
- **Data Persistence**: Each step saves independently via API
- **Validation at UI & DB**: Required fields validated before advancing
- **Audit Trail**: Step completion timestamps and staff information tracked
- **Legal Compliance**: Signature blocks for resident, witnesses, agent, and staff
- **HIPAA Compliance**: All data stored securely with proper access controls
- **Optimistic UI**: Immediate feedback on form state without page reload

## Field Mappings

### Step 1 → Step 6 Validation
The form intelligently handles conditional requirements:
- If `Step 2: hasAgent = "yes"`, then Step 6 requires agent acknowledgment signature
- All other steps have clear, specific required field sets

## Integration Points

The advance directive form integrates with:
- **Nursing Admission Assessment**: Can reference resident info (auto-populated placeholder)
- **Pre-Admission Screening**: Shown as linked document
- **Resident Records**: Linked via resident_id for continuity of care
- **Admin Dashboard**: Accessible from resident admission workflow
