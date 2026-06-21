# Admission Forms Playwright Tests - Quick Start

## Setup

```bash
# Install dependencies (if not already done)
npm install @playwright/test pg

# Verify PostgreSQL is running
psql -U postgres -d dcllc_db -c "SELECT 1"

# Start dev server in one terminal
npm run dev

# In another terminal, run tests
npx playwright test
```

## Common Commands

### Run All Tests
```bash
npx playwright test
```

### Run Specific Test File
```bash
npx playwright test tests/admission-forms.spec.js
```

### Run Tests Matching Pattern
```bash
npx playwright test -g "Encryption"
npx playwright test -g "Pre-Screening"
npx playwright test -g "Workflow"
```

### Run with Debugging
```bash
npx playwright test --debug
```

### Run with UI Mode (Interactive)
```bash
npx playwright test --ui
```

### View Last Test Report
```bash
npx playwright show-report
```

### Run Single Test by Line
```bash
npx playwright test tests/admission-forms.spec.js:200
```

## Test Structure

```
tests/admission-forms.spec.js
├── Pre-Screening Form Tests (5 tests)
│   ├── All required fields accepted
│   ├── Form data matches JSONB blob
│   ├── PHI fields encrypted
│   ├── Metadata set correctly
│   └── Optional fields preserved
├── Nursing Assessment Tests (4 tests)
│   ├── All required fields accepted
│   ├── Form data matches JSONB blob
│   ├── Typed columns populated
│   └── Emergency contact encrypted
├── Advance Directive Tests (4 tests)
│   ├── All required fields accepted
│   ├── Form data matches JSONB blob
│   ├── Signature dates match
│   └── Healthcare agent encrypted
├── Workflow Tests (4 tests)
│   ├── admissionId returned
│   ├── Subsequent updates work
│   ├── All 3 forms in 1 record
│   └── submit=true sets pending status
└── Validation Tests (3 tests)
    ├── Missing required field error
    ├── Nursing assessment validation
    └── Invalid date format error
```

## What Each Test Does

### 1-5: Pre-Screening Form
- Submits complete pre-screening data (45+ fields)
- Verifies API returns 201 Created with admissionId
- Queries database to verify JSONB blob storage
- Confirms encryption of name, phone, email
- Checks metadata (tenant_id, created_by, created_at)
- Verifies optional fields preserved (OHP ID, insurance, etc.)

### 6-9: Nursing Assessment Form
- Submits nursing assessment (40+ fields)
- Verifies vital signs, demographics, assessments stored
- Confirms typed columns (vital_pulse, vital_temperature, etc.)
- Verifies emergency contact phone encryption
- Checks JSONB blob contains complete form

### 10-13: Advance Directive Form
- Submits advance directive with signatures
- Verifies healthcare agent preferences stored
- Confirms witness signatures and dates preserved
- Verifies healthcare agent phone encryption
- Checks JSONB blob structure

### 14-17: Multi-Form Workflow
- Tests 3-step admission process:
  1. Pre-screening (INSERT) → new admissionId
  2. Nursing assessment (UPDATE) → same record
  3. Advance directive (UPDATE) → complete record
- Verifies admissionId returned for linking forms
- Confirms all 3 JSONB blobs present after workflow
- Tests submit=true flag triggers pending status

### 18-20: Validation
- Tests required field enforcement
- Tests date format validation (YYYY-MM-DD)
- Confirms API returns 422 for invalid data
- Verifies detailed error messages in response

## Database Queries Used

### Check Submitted Form
```sql
SELECT 
  id, 
  tenant_id, 
  created_by, 
  created_at,
  pre_screening_data,
  nursing_assessment_data,
  advance_directive_data,
  is_encrypted,
  status
FROM care.pending_admissions 
WHERE id = 'admission-uuid';
```

### Decrypt PHI Field
```sql
-- Database side (pgcrypto)
SELECT pgp_sym_decrypt(full_name, 'key') FROM care.pending_admissions;

-- Or in test (Node.js crypto)
const decrypted = decryptPHI(encryptedBase64, keyHex);
```

### Verify JSONB Structure
```sql
SELECT pre_screening_data ->> 'referringAgency' AS agency
FROM care.pending_admissions 
WHERE id = 'admission-uuid';
```

## Environment Variables

Required for tests:

```bash
# .env.local
DATABASE_URL=postgresql://postgres:1234@localhost:5432/dcllc_db
DEV_TENANT_ENCRYPTION_KEY=dev-only-32-char-key-change-me!!
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000
```

## Test Cleanup

Tests automatically delete submitted records after running. Manual cleanup:

```bash
# Delete test records older than 1 hour
psql -U postgres -d dcllc_db <<EOF
DELETE FROM care.pending_admissions 
WHERE tenant_id = 'test-tenant' 
  AND created_at < NOW() - INTERVAL '1 hour';
EOF
```

## Troubleshooting

### "Cannot connect to PostgreSQL"
- Verify: `psql -U postgres -d dcllc_db -c "SELECT 1"`
- Check: `echo $DATABASE_URL`

### "Decryption failed"
- Verify key: `echo $DEV_TENANT_ENCRYPTION_KEY`
- Should be exactly: `dev-only-32-char-key-change-me!!`

### "Test timeout"
- Increase in `playwright.config.js`: `timeout: 90000`

### "Port 3000 already in use"
- Kill: `lsof -ti:3000 | xargs kill -9`
- Or change: `PLAYWRIGHT_TEST_BASE_URL=http://localhost:3001`

### "Orphaned test records"
```sql
-- Clean up
DELETE FROM care.pending_admissions WHERE tenant_id = 'test-tenant';
```

## Sample Test Output

```
Running 20 tests using 1 worker

✓ Pre-Screening: All required fields accepted (5.2s)
✓ Pre-Screening: Form data matches JSONB blob (4.8s)
✓ Pre-Screening: Encrypted PHI fields encrypted (5.1s)
✓ Pre-Screening: Metadata fields set (4.9s)
✓ Pre-Screening: Optional fields preserved (5.0s)

✓ Nursing Assessment: All required fields (5.3s)
✓ Nursing Assessment: Form data matches blob (5.1s)
✓ Nursing Assessment: Typed columns populated (5.0s)
✓ Nursing Assessment: Emergency contact encrypted (4.9s)

✓ Advance Directive: All required fields (5.2s)
✓ Advance Directive: Form data matches blob (5.0s)
✓ Advance Directive: Signature dates match (5.1s)
✓ Advance Directive: Healthcare agent encrypted (4.8s)

✓ Workflow: admissionId returned (5.0s)
✓ Workflow: Subsequent updates work (8.5s)
✓ Workflow: All 3 forms in 1 record (12.3s)
✓ Workflow: submit=true sets pending (5.2s)

✓ Validation: Missing required field error (3.2s)
✓ Validation: Nursing assessment validation (3.1s)
✓ Validation: Invalid date format (3.0s)

20 passed (2m 35s)
```

## Key Test Data

### Pre-Screening Sample
- Agency: "Springfield Mental Health Clinic"
- Contact: "Dr. Jane Smith" / "(503) 555-0123"
- SSN: "123-45-6789"
- County: "Multnomah"
- Substance: "Alcohol"

### Nursing Assessment Sample
- Name: "John Alexander Thompson"
- DOB: "1985-06-15"
- Age: 38
- Temperature: "98.6"
- Pulse: "72"

### Advance Directive Sample
- Agent: "Mary Thompson" / "(503) 555-2222"
- Resident: "John Alexander Thompson"
- Witness 1: "James Wilson"
- Witness 2: "Lisa Chen"

## Next Steps

1. **Run tests**: `npx playwright test`
2. **Review report**: `npx playwright show-report`
3. **Debug failures**: `npx playwright test --debug`
4. **CI integration**: Add to GitHub Actions or similar
5. **Coverage**: Extend with UI form tests (Jest + React Testing Library)

## Files

- Test suite: `tests/admission-forms.spec.js` (822 lines)
- Config: `playwright.config.js`
- Documentation: `ADMISSION_FORMS_TEST_REPORT.md`
- This guide: `PLAYWRIGHT_QUICK_START.md`
