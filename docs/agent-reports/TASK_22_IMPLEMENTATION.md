# Task #22: Medication Dosage Validation Implementation

## Overview
Fixed medication dosage validation to properly validate numeric dosage with unit specification in the Pre-Screening admission form.

## Changes Made

### 1. File Modified: `src/app/admission/pre-screening/page.js`

#### New Constants
- **DOSAGE_UNITS**: Array of 11 common dosage units (mg, mL, units, tablets, capsules, drops, grams, mcg, IU, patches, inhalers)

#### New Validation Functions
- **`validateMedicationDosage(med)`**: Validates a single medication
  - Checks that dosage value is numeric and > 0
  - Checks that unit is selected
  - Returns object with `valid` boolean and `errors` array

- **`validateMedicationsList(meds)`**: Validates entire medication list
  - Iterates through all medications
  - Returns aggregated validation results with medication names and specific error messages

- **`migrateLegacyMedicationFormat(meds)`**: Backward compatibility function
  - Converts old format `dosage: "500mg"` to new format `dosageValue: "500", dosageUnit: "mg"`
  - Handles both new and old format gracefully
  - Applied on form load in Step2 and Step3

#### Updated Components
1. **MedRow Component**
   - Split dosage field into two separate inputs:
     - `dosageValue`: number input only (accepts 0-999.999)
     - `dosageUnit`: dropdown select with predefined units
   - Added real-time validation with inline error messages
   - Displays error box if either dosage or unit is invalid
   - Shows user-friendly message: "Please specify dosage with unit (e.g., 500mg, 2 tablets)"
   - Marked both fields with red asterisk (*) to indicate required status

2. **Step2 Component** (Psychotropic Medications)
   - Added error display at top of medications section
   - Initializes medication state with legacy format migration
   - Shows validation errors preventing form advancement

3. **Step3 Component** (Non-Psychiatric Medications)
   - Added error display at top of medications section
   - Initializes medication state with legacy format migration
   - Shows validation errors preventing form advancement

#### Updated Validation Logic
- **`getStepErrors(data, stepId)`** function enhanced
  - For Step 2: Validates `psychMeds` array
  - For Step 3: Validates `nonPsychMeds` array
  - Blocks form advancement if any medication has invalid dosage
  - Provides specific error messages indicating which medications fail and why

#### State Structure Changes
Old format:
```javascript
{ id: 1, name: "", dosage: "500mg", prescriber: "", index: 0 }
```

New format:
```javascript
{ id: 1, name: "", dosageValue: "500", dosageUnit: "mg", prescriber: "", index: 0 }
```

## Validation Rules

### Dosage Value
- Must be a number (no text allowed)
- Must be greater than 0 (positive only)
- Error message: "Must be a positive number"

### Unit
- Must be selected from dropdown
- Cannot be empty if medication name is entered
- Error message: "Unit required"

### Combined Validation
- Only validates if medication name is filled in
- If either field is invalid, shows error: "Please specify dosage with unit (e.g., 500mg, 2 tablets)"
- Prevents form submission/advancement until resolved

## Testing

### Test Case 1: Valid Dosage Entry
1. Enter medication name: "Atorvastatin"
2. Enter dosage value: "20"
3. Select unit: "mg"
4. Expected: No errors, form can advance

### Test Case 2: Invalid Dosage - Text Input
1. Enter medication name: "Lisinopril"
2. Enter dosage value: "abc"
3. Select unit: "mg"
4. Expected: Error "Must be a positive number"

### Test Case 3: Invalid Dosage - Negative/Zero
1. Enter medication name: "Metformin"
2. Enter dosage value: "0"
3. Select unit: "mg"
4. Expected: Error "Must be a positive number"

### Test Case 4: Missing Unit
1. Enter medication name: "Aspirin"
2. Enter dosage value: "500"
3. Leave unit empty
4. Expected: Error "Unit required"

### Test Case 5: Optional Medication (Empty Row)
1. Leave medication name empty
2. Leave dosage empty
3. Leave unit empty
4. Expected: No errors (row is optional)

### Test Case 6: Legacy Data Migration
1. Load existing form with old format: `dosage: "100mg"`
2. Expected: Automatically migrates to `dosageValue: "100", dosageUnit: "mg"`
3. Display shows both fields properly populated

## UI/UX Improvements
- Numeric input prevents accidental text entry
- Dropdown ensures unit standardization
- Real-time validation with inline error messages
- Red asterisks (*) indicate required fields
- Error message box provides clear, actionable guidance
- Label color changes to red when field has error

## API Compatibility
- No backend changes needed
- Form data submitted with new `dosageValue` and `dosageUnit` fields
- Server can parse either format for backward compatibility
- Existing data persists during migration

## Files Changed
- `src/app/admission/pre-screening/page.js` (main implementation)

## Backward Compatibility
✓ Existing forms with old format load successfully
✓ Old dosage strings automatically parsed and split
✓ No data loss during migration
✓ Both formats handled gracefully in validation
