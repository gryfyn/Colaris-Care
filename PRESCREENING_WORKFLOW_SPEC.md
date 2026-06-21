# Pre-Screening-First Admission Workflow — Build Spec

This is the shared contract for the new admission workflow. All agents MUST follow
the API shapes and status lifecycle below exactly so the pieces integrate.

## Goal (new flow)
1. Admin opens **Pre-Screening** from the admin sidebar (new nav item under "Admissions").
2. Admin fills the pre-screening form standalone. It is the ONLY form that creates a
   Pending Admission. NO auto-pull from a nursing assessment (pre-screening is now first).
3. The submitted pre-screening appears in **Pending Admissions**. Admin can:
   - View every field (read-only, full detail),
   - **Download a PDF** of the pre-screening,
   - **Approve** or **Decline** (decline requires a reason).
4. When **approved**, the row is NOT yet a resident. It becomes selectable under
   **Residents → Admit Resident** as a dropdown of approved pre-screenings.
5. Selecting a name navigates to the **Nursing Assessment** with `?admission_id=<id>`.
   The nursing form loads the pre-screening data, shows the already-captured identity
   fields **read-only** (cannot edit), and the user fills in what is missing.
6. After Nursing Assessment → **Advance Directive** (unchanged order).
7. When the Advance Directive is finalized (`submit:true`), the **resident is created**
   (+ portal account + notifications) and the admission status becomes `admitted`.

## Status lifecycle (care.pending_admissions.status)
- `pending`   — pre-screening submitted, awaiting admin decision. (submitted_at IS NOT NULL)
- `approved`  — admin approved; appears in Admit-Resident dropdown; NOT yet a resident.
- `rejected`  — admin declined (rejection_reason required).
- `admitted`  — nursing + advance directive completed; care.residents row created.

DB migration 0027 extends the CHECK constraint to allow `'admitted'`.

## API CONTRACT (authoritative)

### POST /api/v1/admission/forms   (existing — extend)
- Pre-screening submit: body `{ formType:'pre-screening', formData, markComplete:true, submit:true }`
  → sets `pre_screening_complete=true`, `status='pending'`, `submitted_at=NOW()`.
  (Pre-screening ALONE can submit — do not require the other two forms.)
- Nursing / advance-directive drafts & completes: unchanged (update by admissionId).
- Advance-directive submit on an `approved` row:
  body `{ admissionId, formType:'advance-directive', formData, markComplete:true, submit:true }`
  → marks advance_directive_complete, then FINALIZES: create care.residents row +
    resident_care_of portal account + "care plan due" + credentials notifications
    (move this logic out of the review route), set `status='admitted'`.
  Response includes `{ residentId, residentName, credentials }`.

### PATCH /api/v1/admission/[id]/review   (existing — change approve behavior)
- `{ status:'approved', notes? }` → ONLY set `status='approved'`, `approved_by`, `approved_at`.
  DO NOT create a resident or portal account here anymore (moved to finalize on advance-directive submit).
- `{ status:'rejected', notes }` → unchanged (notes required).

### GET /api/v1/admission/approved   (NEW)
- Auth: ADMISSION_FORMS_READ. Lists rows where `status='approved'` AND `advance_directive_complete=false`.
- Returns `{ data: [{ id, full_name (decrypted), date_of_birth, submitted_at, approved_at }] }`
  ordered by approved_at DESC. Used to populate the Admit-Resident dropdown.

### GET /api/v1/admission/forms/[id]   (existing — already returns pre_screening_data etc.)
- Used by the nursing form to load pre-screening data for read-only display + prefill.

### POST /api/v1/admission/generate-pdf   (existing)
- `{ formType:'pre-screening', formData, filename }` → PDF blob. Used by Pending Admissions "Download PDF".

## Pre-screening identity fields
Pre-screening must now collect client identity itself (was read-only from nursing):
- `clientFullName` (maps to `full_name`), `dateOfBirth` (→ `date_of_birth`), `pronouns` (→ `pronoun`).
Add these as editable inputs in Step 1. Keep them in the JSONB blob too.
Update the forms route `pickTyped` fieldMap so `clientFullName→full_name`,
`dateOfBirth→date_of_birth`, `pronouns→pronoun` (and keep `referringAgency` OUT of full_name —
it was incorrectly mapped to full_name before; map referringAgency to its own blob field only).

## Files by workstream (avoid cross-editing)
- W1 DB:        db/migrations/0027_*.sql
- W2 Backend:   src/app/api/v1/admission/forms/route.js,
                src/app/api/v1/admission/[id]/review/route.js,
                src/app/api/v1/admission/approved/route.js (new),
                src/app/api/v1/admission/forms/[id]/approve/route.js (align/keep consistent)
- W3 Pre-screen UI: src/app/admission/pre-screening/page.js
- W4 Pending UI: src/app/admin/PendingAdmissionsSection.js
- W5 Admit flow: src/app/admin/page.js (ResidentsSection), src/app/admission/nursing-assessment/page.js,
                src/app/admission/advance-directive/page.js (verify final submit)
- Nav:          src/app/admin/AdminNavigation.jsx + admin/page.js view switch (add 'pre_screening' nav)

## Conventions
- Inline styles with a local `C` color object (see existing files). lucide-react icons.
- Auth: authenticate → authorize(PERMISSIONS...) → withTenantClient → audit. See existing routes.
- PHI columns encrypted via encryptFields/decryptFields with getTenantKey(). Don't log PHI.
- This is NOT stock Next.js — read node_modules/next/dist/docs if unsure about App Router APIs.
