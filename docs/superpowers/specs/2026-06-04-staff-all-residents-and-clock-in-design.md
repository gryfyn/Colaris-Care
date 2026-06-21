# Staff: all-resident access + top-bar clock-in/out

**Date:** 2026-06-04
**Branch:** fix/admission-typed-mapping-and-pdf (or a new feature branch)

## Context

Two changes to the staff portal:

1. **Staff are in charge of all residents, not just assigned ones.** Today the staff
   portal and several clinical APIs force-filter to `care.staff_assignments`, so a staff
   member only sees residents explicitly assigned to them. The business reality is that
   staff care for every resident in the facility. The `staff` role *already* holds the
   `residents:read` permission (`src/lib/roles.js:74`); the restriction lives in
   staff-specific query scoping, not in the permission model.

2. **Clock-in / clock-out from the top bar, persisted in Neon.** Staff need to punch
   in/out. The `care.staff_time_records` table, its indices, RLS, and the
   `care.v_staff_clocked_in` view already exist in `db/db.sql` (lines ~1172–1192,
   1520–1521, 1636–1646) but have no API routes or UI, and may not be applied on the
   Neon production DB.

## Part 1 — All-resident access

### Frontend (`src/app/staff/page.js`)
- The Dashboard and "My Residents" view currently call `/api/v1/staff/assignments`
  (assigned-only). Switch the resident list to `GET /api/v1/residents?limit=100`, which
  returns all tenant residents (staff already authorized). Map the response shape
  (`first_name`, `last_name`, `primary_diagnosis`, `status`) into the existing table.
- Keep the dashboard "residents" count sourced from this same all-residents fetch.

### Clinical APIs — stop auto-restricting staff
These routes set `staffOnly = ... || user.role === 'staff'`, forcing the
`staff_assignments` JOIN/filter for every staff request:
- `src/app/api/v1/medications/route.js` (~line 49, 65–69)
- `src/app/api/v1/care-plans/route.js` (~line 44, 60–63)
- `src/app/api/v1/incidents/route.js` (~line 185, 205–208)
- `src/app/api/v1/drug-disposal/route.js` (~line 158, 174–177)

Change each so `staffOnly` is driven **only** by the explicit `?staff_only=1` query
param — not auto-enabled by role. This keeps an opt-in "just mine" filter available for
later while defaulting staff to all residents. Tenant isolation through
`withTenantClient` is unchanged.

### Per-record write guards
`src/app/api/v1/medications/[id]/administer/route.js` (and any sibling write route)
rejects staff who aren't assigned to the resident via a `staff_assignments` lookup.
Remove that assignment gate for the `staff` role; authorization remains role-based +
tenant-scoped.

### Frontend fetches that pass `staff_only=1`
The staff medications view calls `/api/v1/medications?staff_only=1&...`
(`src/app/staff/page.js` ~line 1004). Drop the `staff_only=1` param on staff clinical
fetches so they receive all residents' records.

## Part 2 — Clock-in / clock-out

### Migration
Add `db/migrations/00NN_staff_time_records.sql` (next free number) that idempotently
ensures the `care.shift_type` enum, `care.staff_time_records` table, its two indices,
the `updated_at` trigger, RLS policies, grants, and the `care.v_staff_clocked_in` view
exist — mirroring the definitions already in `db/db.sql`. Idempotent
(`CREATE ... IF NOT EXISTS`, `DROP POLICY IF EXISTS` first) so it is safe on Neon where
`db.sql` base objects may already be present.

### APIs (authenticate → withTenantClient → audit)
New folder `src/app/api/v1/staff/time-records/`:
- `status/route.js` — `GET`: returns `{ data: { clocked_in: bool, record: {...}|null } }`
  by selecting the open record (`clock_out IS NULL`) for `user.staffId` using the
  `idx_time_records_open` partial index.
- `clock-in/route.js` — `POST`: 409 if an open record already exists; else insert
  `(tenant_id, staff_id, clock_in = now(), shift)` where **shift is auto-derived from
  the server clock** (day / swing / night). Audit `logInsert`.
- `clock-out/route.js` — `POST`: update the open record's `clock_out = now()`; 404 if
  none open. Audit `logUpdate`.

Auth: `authenticate` → must be `staff`/`manager`/`admin`/`superadmin`. All queries run
inside `withTenantClient(user.tenantId, user.staffId, ...)`.

Shift derivation (server local time): day 06:00–13:59, swing 14:00–21:59,
night 22:00–05:59. (Confirm enum values against `care.shift_type` — `db.sql` shows
`'day','night','swing'`.)

### UI (`src/app/staff/page.js`)
- Add clock state to `StaffShell` (or the top-bar component): `clockedIn`, `openRecord`,
  loaded on mount from `/status`.
- Insert a button in the right-side action group, between the date display and the
  notifications bell. Uses `--staff-*` tokens + `lucide-react` `Clock`:
  - Off the clock: neutral surface, label "Clock In".
  - On the clock: `--staff-success` background, label "Clock Out" with a live elapsed
    timer (e.g. "2h 14m") from `clock_in`.
- Clicking calls clock-in or clock-out, then refreshes status. Use the existing
  authenticated fetch pattern (`authHeaders(auth.accessToken, csrfToken)`).

## Out of scope
- Manager/admin timesheet review UI, break tracking, late/early flags, overrides.
- Editing or deleting `staff_assignments` (left intact; simply no longer used to gate
  staff resident access).

## Verification
1. `node scripts/migrate-db.js` applies cleanly (and is idempotent on re-run).
2. Dev server: log in as seeded staff. "My Residents" lists **all** residents, not a
   subset. Open a resident's medications/care-plans — visible regardless of assignment.
3. Top bar: "Clock In" → button flips to green "Clock Out" with elapsed timer; reload
   page → still clocked in (status persisted). "Clock Out" → flips back. Verify a row in
   `care.staff_time_records` on Neon with `clock_in`/`clock_out` set.
4. Existing tests still pass (`npm test`); add a regression test for the clock-in/out +
   status endpoints and for staff seeing unassigned residents.
