# Design: Admin rename + Staff portal (multi-portal Colaris Care)

**Date:** 2026-06-24
**Status:** Approved (Founder)
**Context:** Colaris Care web app (`D:/Projects/colaris-app/Care/web`, `@colaris/care-web`).
Everything built so far is actually the **Facility Admin / Manager** portal. This spec
(a) renames that portal under an `/admin` URL segment and (b) adds a second **Staff** portal
under `/staff`, modeled on a reference staff route
(read-only inspiration). The reference app served a single
company; Colaris is multi-tenant (serves many), so the staff portal is facility-scoped.

No backend yet — all pages use realistic SAMPLE data, no PHI, shapes mirroring
`docs/DATABASE_SCHEMA.md` (`organization_id` + `facility_id`) for clean Prisma wiring later.

---

## 1. Route architecture

- **Move** `src/app/(app)/*` → `src/app/admin/*` (real URL segment). All current pages become
  `/admin/dashboard`, `/admin/residents`, `/admin/staff` (manage staff), `/admin/care-plans`,
  `/admin/care-plans/[id]`, `/admin/medications`, `/admin/reports`, `/admin/compliance`,
  `/admin/face-sheets`(+`/[id]`), `/admin/appointments`, `/admin/announcements`,
  `/admin/calendar`, `/admin/daily-records`, `/admin/admission`, `/admin/settings`,
  `/admin/staff/[id]`, `/admin/residents/[id]`.
- **New** `src/app/staff/*` portal beside it (see §3).
- **Root `/`**: replace the current redirect-to-`/admission` with a minimal **portal-selector
  landing** — two cards: "Facility Admin" → `/admin/dashboard`, "Staff" → `/staff/dashboard`.
  Disposable once real auth/login exists. Uses the `.cx-` design system, centered, themed.
- **Update ALL internal links/logic**: nav hrefs in `src/components/app/prefs.jsx`
  (`NAV_GROUPS`, `SETTINGS_ITEM`), active-route matching in `Shell.jsx`
  (`pathname === href || pathname.startsWith(href + "/")`), any hardcoded `/dashboard`-style
  links or `router.push`/`redirect` calls. No dead links may remain.

## 2. Shared vs per-portal (isolation boundaries)

**Shared (reuse, do NOT duplicate):**
- `src/app/globals.css` — the `.cx-` design system + all 16 themes (incl. dark) + the custom
  sidebar scroll indicator (`.cx-nav-scroll`/`.cx-nav`/`.cx-nav-rail`/`.cx-nav-thumb`,
  absolute-inset pattern).
- `src/components/app/prefs.jsx` — `PrefsProvider` (theme/appearance, localStorage
  `colaris.prefs.v1`). Theme selection is shared across both portals.
- UI primitives: `src/components/ui/data.jsx` (Panel, PageHeader, Badge, Avatar),
  `src/components/ui/fields.jsx` (TextField, SelectField), the `Switch` pattern.

**Per-portal:**
- **Admin**: keeps existing `Shell.jsx` + `src/app/admin/layout.js` (PrefsProvider + Shell).
  Admin nav config stays in `prefs.jsx` (`NAV_GROUPS`) with hrefs re-prefixed to `/admin`.
- **Staff**: new `src/components/app/StaffShell.jsx` + a staff nav config (new export, e.g.
  `STAFF_NAV_GROUPS` in `prefs.jsx` or a dedicated `staffNav.js`). `src/app/staff/layout.js`
  wraps staff pages in PrefsProvider + StaffShell.

**StaffShell** (modeled on a reference `StaffNavigation.jsx`, rendered in the `.cx-` design system):
- Brand header (Colaris logo, clickable → `/staff/dashboard`).
- **Staff identity card**: avatar/initials, name, role (sample: e.g. "Amara Koch — Caregiver").
- **Facility-context chip** (read-only): facility + org name (e.g. "Maple Grove Care" /
  tenant org). NO facility switching for staff.
- **Clock In/Out** control (sample state, toggles a clocked-in indicator).
- Grouped nav (Facility / Clinical / Communications / System) using the SAME custom
  scroll-indicator pattern as admin (absolute-inset `.cx-nav`, JS-driven thumb), and the
  collapse/expand toggle + mobile drawer behavior.
- Theme-aware (works across all 16 themes).

## 3. Staff portal pages (full staff-portal set)

All `.cx-`-styled, sample data, no PHI, facility-scoped. Each list page follows the existing
list → `/[id]` detail pattern with a local `data.js` where detail views apply.

- **Facility group:** Dashboard (`/staff/dashboard`), Residents (`/staff/residents` +
  `/[id]`).
- **Clinical group:** Care Plan (`/staff/care-plan`), Appointments (`/staff/appointments`),
  Progress Notes (`/staff/progress-notes`), Medications (`/staff/medications` — **operational
  rounds only**, carry the same explicit "no clinical detail" disclaimer the admin medications
  page uses), Face Sheet (`/staff/face-sheet`), Incident Reports (`/staff/incidents`), Drug
  Disposal (`/staff/drug-disposal`), Evacuation Drill (`/staff/evacuation`).
- **Communications group:** Announcements (`/staff/announcements`), Notifications
  (`/staff/notifications`), Resident Requests (`/staff/resident-requests`), Calendar
  (`/staff/calendar`), Profile (`/staff/profile`).
- **System:** Settings (`/staff/settings`).

**Staff Settings (staff-appropriate subset only):** Profile (name/role/contact, read-mostly),
Appearance (the shared theme picker — same component/behavior as admin), Notifications
(email/in-app toggles relevant to staff: new assignments, incident alerts, announcements,
shift reminders). **Exclude** facility profile, billing, account management, and roles &
access — those remain admin-only.

## 4. Multi-tenancy

Staff belong to exactly one facility within one tenant org. The facility/org name renders as a
read-only chip in StaffShell; all staff sample data is scoped to that single facility. Data
object shapes include `organizationId` + `facilityId` fields (even though hardcoded in sample
data) so the later Prisma/RLS layer (`organization_id` + `facility_id`, mandatory RLS per
`docs/DATABASE_SCHEMA.md`) wires in cleanly. No tenant/facility switching in the staff UI.

## 5. Execution plan (decomposed subtasks, routed through Glass Inc)

Run as a decomposed set of subtasks (gate → Engineering → review → human approval → ledger):

1. **Rename/move** `(app)` → `admin`: move all routes, add `src/app/admin/layout.js`, fix every
   nav href + active-route logic + root `/` portal-selector landing. Verify all `/admin/*`
   routes return 200 and no link points at a bare/old path.
2. **Staff foundation**: `StaffShell.jsx`, staff nav config, `src/app/staff/layout.js`, the
   facility-context chip, Clock In/Out, identity card, and `/staff/settings` (Profile +
   Appearance + Notifications). `/staff/dashboard` placeholder so the shell renders.
3. **Staff Facility + Clinical pages**: dashboard, residents(+detail), care-plan, appointments,
   progress-notes, medications (operational-only), face-sheet, incidents, drug-disposal,
   evacuation.
4. **Staff Communications pages**: announcements, notifications, resident-requests, calendar,
   profile.

**Per-subtask acceptance:** target routes return 200; navigation works in expanded + collapsed
+ mobile-drawer states; sidebar scrolls (custom thumb tracks); all 16 themes incl. dark render
correctly; no console errors; no PHI; existing admin portal unaffected.

## 6. Out of scope (YAGNI)

Auth/login/RBAC enforcement, real backend/persistence/Prisma schema, facility switching for
staff, the sensitive admission wizard (separate product), and any real billing/payment
integration. The `/` portal selector is a temporary stand-in for a future login/role redirect.
