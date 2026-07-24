# Full face-sheet record with all fields

**Date:** 2026-07-24
**Status:** Approved (design)
**Builds on:** 2026-07-24-universal-upload-autofill-design.md (the limited 6-field face-sheet edit)

## Goal

Replace the current face-sheet edit (limited to the ~6 fields the residents `PATCH` owns) with a
**real, persisted face-sheet record holding all ~90 fields** — editable, upload-to-autofill across
every field, PHI-encrypted at rest, RBAC-gated. The printable `FaceSheetDocument` view is wired to
the stored data instead of "Information on file" placeholders.

## Decisions (locked with the Founder)

1. **RBAC:** add dedicated `face_sheets:read` + `face_sheets:write` permissions. Admin/superadmin
   get write; staff get read. (Not reusing residents:update.)
2. **Source of truth:** the face sheet stores the **full** field set; on save, the overlapping core
   fields (legal name → first/last, room, care level, status) **write through** to the resident so
   the two never diverge.
3. **Staff access:** read-only, **PHI masked** as `[RESTRICTED]`; no edit/upload/save.

## The field model

The full field list is the `faceSheet` object in `src/lib/face-sheet-client.js`
(`buildFaceSheetFromResident`) — ~90 snake_case keys across these sections: Resident Identification,
Legal Status & Capability, Insurance, Diagnoses & Allergies, Medical/Behavioral Providers, Pharmacy,
Emergency Contacts, Legal Representatives/Guardian/Family, Service Coordination, Signatures, plus the
overview/at-a-glance fields.

**PHI subset** (encrypted at rest + masked for staff) — `FACE_SHEET_ENCRYPTED_FIELDS`: ssn,
previous_address, polst_dnr_date, all *_policy_id / medicare_number / medicaid_number /
insurance_phone, all *_phone / *_email / *_address (contacts, providers, pharmacy, legal reps,
guardian, conservator, nok, case manager, day program, transportation), resident_signature +
resident_signature_date, primary/secondary contact phones/emails/addresses. Non-PHI (names of
providers, diet, mobility, code status, program names, dates like admission) stays plaintext.

## Architecture

### Data layer (WO-A)
- **Migration `db/migrations/0021_face_sheets.sql`** — mirror `0005_create_admissions.sql`:
  `care.face_sheets (id uuid pk, organization_id, facility_id, resident_id, data jsonb not null
  default '{}', version int not null default 1, created_at/created_by, updated_at/updated_by,
  FKs to facilities + residents, unique(organization_id, facility_id, resident_id))`. Enable **and
  FORCE** RLS; `face_sheets_scope` policy on `organization_id = app.current_organization_id() and
  facility_id = app.current_facility_id()` (using + with check). Idempotent (`create ... if not
  exists`, `drop policy if exists`). Grants come from `scripts/apply-runtime-grants.mjs` (all tables
  in schema care) — no explicit grant in the migration.
- **RBAC** in `src/lib/roles.js`: add `FACE_SHEETS_READ='face_sheets:read'`,
  `FACE_SHEETS_WRITE='face_sheets:write'`. Add `FACE_SHEETS_READ` to `STAFF_PERMISSIONS`; admins get
  both via `Object.values(PERMISSIONS)`. Add face-sheet PHI keys to `PHI_MASKED_FIELDS.staff` /
  `.resident_care_of` (or apply masking in the API — see WO-B). Update `docs/STAFF_ADMIN_PERMISSIONS.md`.
- **Field metadata + encryption lists** in `src/lib/face-sheet-schema.js` (expand the existing file):
  `FACE_SHEET_SECTIONS` (ordered sections → ordered `{ key, label, type }` fields for the UI form),
  `FACE_SHEET_FIELDS` (flat key list), `FACE_SHEET_ENCRYPTED_FIELDS` (PHI subset above),
  `maskFaceSheetPHI(data)` helper. Keep `buildFaceSheetSchema` but expand it (see WO-B).

### API (WO-B)
- **`GET /api/v1/face-sheets/[residentId]/route.js`** — `requireUser(FACE_SHEETS_READ)`,
  `withApiContext`. Load the face_sheets row for the resident; `decryptFields(data,
  FACE_SHEET_ENCRYPTED_FIELDS, tenantKey, aad)` for admin/superadmin, or `maskFaceSheetPHI` for
  staff. If no row exists, return defaults derived from the resident record (name/room/care level/
  status/admission date) so the editor prefills. AAD binds org+facility+`face_sheets`+rowId+field.
- **`PUT /api/v1/face-sheets/[residentId]/route.js`** — `requireUser(FACE_SHEETS_WRITE)`. Upsert:
  `encryptFields` the PHI subset, `insert ... on conflict (organization_id, facility_id,
  resident_id) do update set data=..., version=version+1, updated_*`. In the SAME transaction,
  **write through** the overlapping core fields to `care.residents` (first_name/last_name/room/
  care_level/status) via the existing update path. Never persist a raw ssn without encryption.
- **Expand `POST /api/v1/face-sheets/parse`** — `buildFaceSheetSchema(z)` grows to the **full** field
  set (all ~90 keys, nullish; enums where the form constrains). Gate stays `FACE_SHEETS_WRITE`
  (was RESIDENTS_UPDATE). System/visionPrompt already face-sheet oriented.

### UI (WO-C)
- Rewrite the edit mode in `src/app/admin/face-sheets/[id]/page.jsx` to render the **full sectioned
  form** from `FACE_SHEET_SECTIONS` (grouped, collapsible sections; reuse `ui/fields`
  TextField/SelectField/TextAreaField + `.cx-` styles). Prefill from `GET /face-sheets/[id]`.
  Upload-to-autofill POSTs to `/face-sheets/parse` and non-destructively merges ALL returned fields.
  Save → `PUT /face-sheets/[id]`, then refetch + return to view. Gate the Edit/Upload/Save
  affordances on `hasPermission(user.role, FACE_SHEETS_WRITE)`.

### Printable view + staff (WO-D)
- Wire `src/components/face-sheets/FaceSheetDocument.jsx` (and `buildFaceSheetFromResident`) to the
  **stored face-sheet data**: real values for admins (decrypted), `[RESTRICTED]` for staff (masked),
  falling back to resident-derived defaults when a field is empty. Ensure `staff/face-sheet` is
  read-only + masked (no Edit button — gated by `FACE_SHEETS_WRITE` which staff lack).

## Deploy & verify

- Build all WOs; `npm run build` compiles.
- **Run migration 0021 against prod Neon**: `node scripts/migrate-db.mjs` with env from `.env.local`
  (`MIGRATION_DATABASE_URL` = the DIRECT/unpooled endpoint). Then `node scripts/verify-rls.mjs` to
  confirm the new table enforces FORCE RLS.
- Deploy to Vercel (from repo root `D:/Projects/colaris-app`, project colaris-care).
- Playwright verify on prod as admin: open a resident's face sheet → Edit shows all sections
  prefilled → upload a sample document auto-fills across sections → Save persists (reopen shows saved
  values, printable view reflects them). Confirm a staff login sees PHI as `[RESTRICTED]` and no Edit.

## Testing / acceptance

- New table: `verify-rls.mjs` passes for `care.face_sheets` (RLS FORCED, tenant-scoped).
- Encryption: stored `data` jsonb shows ciphertext (not plaintext) for the PHI subset; admin GET
  decrypts, staff GET returns `[RESTRICTED]`.
- Write-through: editing legal name/room/care level/status on the sheet updates the resident record.
- Parse: a sample face-sheet doc fills fields across multiple sections; unstated fields stay blank;
  select-of-IDs are never auto-set.
- RBAC: staff `PUT` → 403; staff Edit button absent; admin `PUT` → 200.

## Out of scope

- Face-sheet versioning/history (1:1 current row; audit via existing audit_events if wired).
- Document attachment storage changes (R2 wiring unchanged).
- No changes to the shared extractor or unrelated modules.
