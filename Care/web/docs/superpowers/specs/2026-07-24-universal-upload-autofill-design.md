# Universal upload-to-autofill across Colaris Care

**Date:** 2026-07-24
**Status:** Approved (design)
**Author:** Orchestrated via Glass Inc pipeline (Founder direction)

## Goal

Bring the admission form's proven "upload a document → AI extracts → fields auto-fill for
review" experience to every other record form that should have it, and repair the upload
sections that exist but are not wired. Each parser must capture **only** the fields that
appear on its own form, capture them faithfully, read **handwriting/scans** as well as
digital text, and **never invent** a field the document doesn't contain — anything unstated
is left blank for the user to complete.

## The reusable pattern (already proven, do not change)

- **`src/lib/ai-extract.js` → `parseUpload({ file, buildSchema, system, visionPrompt, ... })`**
  is the single extraction engine. Digital text (PDF/DOCX) is parsed cheaply; when there is
  little/no extractable text (a photo or handwritten scan) the raw bytes go to a vision model
  that OCRs pages and transcribes handwriting. Returns `{ parsed, fields, warning, upload }`.
- **`src/lib/document-extract.js`** handles file typing/size limits (PDF, DOCX, PNG/JPG/WEBP/HEIC,
  15 MB max) and text extraction.
- A per-domain **`/api/v1/<x>/parse/route.js`** = `runtime='nodejs'`, `maxDuration=60`,
  `requireUser(request, <write-permission>)`, a domain `system` prompt + `buildSchema(z)` whose
  fields **exactly mirror the form**, and a domain `visionPrompt`. Returns `Response.json({ data })`.
- **`src/components/records/RecordFormModal.jsx`** already renders the upload affordance and does a
  **non-destructive merge** (only non-empty parsed values overwrite; blanks are left for the user)
  when given a `parse={{ endpoint, toValues, label }}` prop. Reference wiring:
  `src/app/admin/incidents/page.jsx` (`incidentValuesFromParse` + `parse` prop).

### Two non-negotiable quality rules (apply to every work order)

1. **Schema ⊆ form fields.** The Zod schema and the `toValues` mapper output keys must be a
   subset of, or equal to, the form's own field names. Never emit a field the form doesn't have,
   and never fabricate a value the document doesn't state (leave it `null`/empty). Fields that are
   `<select>`-of-IDs (e.g. "Resident") are **excluded** from parsing — free text can't be mapped to
   an option id; the user picks those.
2. **Preserve handwriting/scan reading.** Every route goes through `parseUpload` (never a
   text-only shortcut) and sets a domain-appropriate `system` + `visionPrompt` so scanned and
   handwritten forms are read.

### Portal / RBAC gating

Add the upload on both admin and staff surfaces **only where the staff role already holds the
relevant write permission** (`src/lib/roles.js`, `docs/STAFF_ADMIN_PERMISSIONS.md`). Each `/parse`
route reuses the same permission its record's create/`POST` route requires. Consequences already
known: staff has **no** `staff:write` (staff-directory upload stays admin-only) and **no**
`residents:update` (face-sheet editable **save** is admin-only; staff face-sheet stays print/view).

## Current state (audited 2026-07-24)

| Module | Parse route | UI wired | Action |
|---|---|---|---|
| Admissions | ✅ | ✅ | Verify only (WO-5) |
| Care plans | ✅ | ✅ | Verify only (WO-5) |
| Incidents | ✅ | ✅ | Verify only (WO-5) — reference impl |
| Medications | ✅ | ✅ | Verify only (WO-5) |
| Staff directory | ✅ | ✅ | Verify only (WO-5) |
| Progress notes (= Daily Progress Note; `admin/progress-notes` & `staff/progress-notes` both render `<DailyProgressNotes>`, wired to `/daily-progress-notes/parse`) | ✅ | ✅ | Verify only (WO-5) |
| **Drug disposal** | ❌ | ❌ (uses `RecordFormModal`) | **WO-1** |
| **Evacuation drills** | ❌ | ❌ (uses `RecordFormModal`) | **WO-2** |
| **Appointments** | ❌ | ❌ (uses `RecordFormModal`) | **WO-3** |
| **Face sheets** | ❌ | picker exists → destination is print-only | **WO-4** |

## Work orders

Each WO is routed through the Glass Inc pipeline as an independent
`glassinc submit --kind code --workspace <colaris> --yes` task (codex-first). Keep each small.

### WO-1 — Drug disposal upload
- New `src/lib/drug-disposal-schema.js` (option arrays if needed) + `src/app/api/v1/drug-disposal/parse/route.js`.
- Schema fields (mirror the form, exclude the resident select): `medicationName`, `quantity`,
  `reason`, `status` (`recorded|reviewed|destroyed`), `witnessName`.
- Wire `parse={{ endpoint: '/api/v1/drug-disposal/parse', toValues, label: 'Upload a disposal record to auto-fill' }}`
  into `src/app/admin/drug-disposal/page.jsx`; same on `staff/drug-disposal` iff staff hold the write permission the POST route uses.
- `system`/`visionPrompt`: "medication disposal / destruction log".

### WO-2 — Evacuation drills upload
- `src/lib/evacuation-drill-schema.js` + `/api/v1/evacuation-drills/parse/route.js`.
- Schema fields: `drillType`, `occurredAt` (ISO datetime), `durationMinutes` (number),
  `status` (`completed|in_progress|cancelled`), `summary`.
- Wire `parse` prop into `admin/evacuation-drills`; staff parity per RBAC.
- `toValues` converts `occurredAt` → `datetime-local` (reuse the incidents `toDatetimeLocal` helper).

### WO-3 — Appointments upload
- `src/lib/appointment-schema.js` + `/api/v1/appointments/parse/route.js`.
- Schema fields (exclude the resident select): `title`, `status`
  (`scheduled|confirmed|completed|cancelled`), `startsAt` (datetime), `endsAt` (datetime), `location`.
- Wire `parse` prop into `admin/appointments`; staff parity per RBAC.

### WO-4 — Face sheets: editable prefill + upload + save
- Keep the existing `AddFaceSheet` dropdown picker → `/admin/face-sheets/[id]`.
- New `src/lib/face-sheet-schema.js` + `/api/v1/face-sheets/parse/route.js` extracting the
  face-sheet fields that map to resident data (name parts, DOB, gender, room, care level,
  primary/emergency contact name+relationship+phone, allergies, primary diagnoses, physician,
  advance-directive status). Exclude anything the resident form doesn't own.
- Make `/admin/face-sheets/[id]` support an **edit mode**: **prefill** all fields from the live
  resident record (`GET /api/v1/residents/:id`), an **Upload-to-autofill** button (non-destructive
  merge over the prefilled values), user review/edit, then **Save → `PATCH`/update the resident
  record** via the existing residents update endpoint (map only fields the resident owns). The
  existing `FaceSheetDocument` printable view + **Print** stay available (view mode).
- **RBAC:** edit/save requires `residents:update` → admin/superadmin only. Staff `face-sheet`
  keeps the current print/view experience (no editable save); do not add a save that would 403.

### WO-5 — Verification & consistency pass (existing uploads)
- For admissions, care-plans, incidents, medications, staff, and progress/daily-notes: confirm
  each parse schema is a subset of its form's fields (flag/remove any extra), the merge is
  non-destructive, and the vision/handwriting path is intact. Fix mismatches only; no redesign.

## Testing / acceptance

- Each new route: `npm run build` compiles; POST with no AI key returns `{ data: { parsed:false, warning } }`
  (graceful degradation) and the form still submits manually.
- With a key: a sample PDF and a photo/handwritten scan each populate only in-form fields; unstated
  fields remain blank; a `<select>`-of-IDs field is never auto-set.
- Face sheet: pick resident → fields prefilled → upload merges → save updates the resident →
  printable view reflects the change. Staff face-sheet remains view/print (no 403).
- All affected routes return 200; zero new console errors.

## Out of scope

- No new database tables/migrations (face sheet persists via the existing resident record).
- No redesign of the admission flow or the shared extraction engine.
- No changes to RBAC definitions.
