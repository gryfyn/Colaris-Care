# Colaris Care — Daily Progress Notes (DCLLC parity)

Date: 2026-07-03
Status: Approved (design), implementing

## Goal

Replace the minimal Colaris progress-notes page (resident / type / body) with a
full **Daily Progress Notes** system that mirrors the DCLLC app
(`D:\Freelance\dcllc\dcllc`) field-for-field, for both the admin and staff
portals. Add file upload + AI parsing, a per-day "due for every resident"
worklist with an `X/N` completion counter, and an admin resident-history view.

## Fields (copied exactly from DCLLC daily progress notes)

Note meta: `resident`, `date` (picker), `shift` (morning/afternoon/night).

Body (`note_body` JSONB):
- `progressNotes` — long text (required)
- `moodBehavior[]` — Alert, Withdrawn, Agitated, Cooperative, Other
- `physicalHealth[]` — Stable, Improved, Declined
- `medicationsAdministered[]` — Morning, Noon, Evening, Bedtime, PRN
- `mealsBreakfast` %, `mealsBreakfastNotes`
- `mealsLunch` %, `mealsLunchNotes`
- `mealsDinner` %, `mealsDinnerNotes`
- `activitiesParticipated[]` — Physical, Recreational, Social, Cognitive, Therapeutic
- `incidents` — long text (optional)

Plus `approverName` (captured, **no approval gate** — admin does not approve).

## Data model — `care.daily_progress_notes` (migration 0015)

Colaris conventions: `organization_id` + `facility_id` scoping, RLS via
`app.current_organization_id()/app.current_facility_id()`, composite FK to
`care.residents(organization_id, facility_id, id)`.
`review_status` defaults to `submitted`. `UNIQUE(organization_id, facility_id,
resident_id, note_date, shift)` → one note per resident/day/shift.
Stores `staff_profile_id` (who filled) + `created_by` (user id) + `source`
(`manual` | `upload`).

## Daily "due" worklist + `X/N` counter — computed, no cron

`GET /api/v1/daily-progress-notes/pending?date=` returns active residents with
no note for that date. Counter = `residents-with-note-today / active-residents`.
Inherently "due every day for every resident"; no scheduler needed. Staff are
assignment-scoped; admin/manager see the whole facility.

## AI upload parsing

`POST /api/v1/daily-progress-notes/parse` (Node runtime): accepts a PDF or DOCX,
extracts text (`pdf-parse` / `mammoth`), runs `generateObject` (AI SDK) through
the **Vercel AI Gateway** with a zod schema matching the fields, returns
structured JSON to pre-fill the form. Degrades gracefully: on any parse/model
error the endpoint returns a clear message and manual entry still works.
Model configurable via `PROGRESS_NOTE_PARSE_MODEL`; auth via
`AI_GATEWAY_API_KEY` (or Vercel OIDC in production).

## API routes (Colaris `withApiContext`)

- `GET/POST /api/v1/daily-progress-notes` — list / create
- `GET /api/v1/daily-progress-notes/pending?date=` — due residents + counts
- `GET /api/v1/daily-progress-notes/history?resident_id=` — per-resident history
- `POST /api/v1/daily-progress-notes/parse` — AI upload

## UI

- Shared field schema `src/lib/progress-notes-schema.js` drives form, admin
  detail, and the parser.
- `src/components/records/DailyProgressNotes.jsx` — main experience, `variant`
  = `staff` | `admin`.
- Staff `/staff/progress-notes`: `X/N done today` counter, due-resident
  worklist, "Add note" (rich form) + "Upload note" (AI prefill), date selector.
- Admin `/admin/progress-notes`: "Due today" panel + counter + residents table;
  click a resident → history table (date, shift, staff who filled, approver,
  status). No approve action.

## Deploy

Neon `DATABASE_URL` already configured (host `ep-restless-moon-ahatg9rc`). Run
`node scripts/migrate-db.mjs`, add `AI_GATEWAY_API_KEY` to Vercel env, push
`feat/colaris-full-backend` → Vercel project `colaris-care` auto-builds.
