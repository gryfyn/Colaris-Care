# Colaris Care Web — Project Setup Instructions

## Project Goal

Build and maintain the **Colaris Care Web App** as a SaaS-ready care-management interface for assisted living and residential care workflows.

This repository currently contains the **web frontend** for Colaris Care. It has separate **admin** and **staff** workspaces, shared app shells, demo data-driven screens, and workflow pages for residents, staff, medications, clinical records, notifications, and facility operations.

The current priority is to keep the product UI consistent while completing care-workflow content and preparing the app for a backend/data layer later.

---

## 1. Current Tech Stack

This project is currently:

- Next.js `16.2.4`
- React `19.2.4`
- JavaScript, not TypeScript
- App Router under `src/app`
- CSS Modules and global CSS
- Lucide React icons
- Jest and Testing Library
- Playwright config present for browser/e2e coverage

Installed package scripts:

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run test
npm run test:watch
npm run test:coverage
```

Do not assume Prisma, Auth.js, shadcn/ui, TanStack Query, React Hook Form, Zod, Zustand, Resend, or Cloudflare R2 are installed. Add those only when the backend/data milestone explicitly starts.

---

## 2. Local Setup

From this directory:

```bash
cd D:\Projects\colaris-app\Care\web
npm install
npm run dev
```

Open:

```txt
http://localhost:3000
```

Important routes:

```txt
/                         SaaS landing page
/admin/dashboard          Admin workspace
/staff/dashboard          Staff workspace
```

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm`:

```bash
npm.cmd run lint
npm.cmd run dev
```

---

## 3. Environment Variables

Use `.env.example` as the local template and `.env.production.example` for production-like configuration.

Current environment areas:

- Next.js runtime/API URL
- PostgreSQL connection placeholder
- Cloudinary face-sheet photo upload credentials
- JWT key paths and expiration settings
- Security/rate-limit settings
- PHI encryption key strategy
- Logging level

For local development:

```bash
copy .env.example .env.local
```

Then fill only the values required by the feature being worked on. Many current UI pages are demo-data driven and do not require a live database.

Never commit real secrets, production keys, PHI, credentials, or private JWT keys.

---

## 4. Current Project Structure

```txt
src/
├── app/
│   ├── page.js
│   ├── page.module.css
│   ├── layout.js
│   ├── globals.css
│   ├── admin/
│   │   ├── dashboard/
│   │   ├── admission/
│   │   ├── residents/
│   │   ├── staff/
│   │   ├── care-plans/
│   │   ├── medications/
│   │   ├── progress-notes/
│   │   ├── incidents/
│   │   ├── drug-disposal/
│   │   ├── evacuation-drills/
│   │   ├── face-sheets/
│   │   ├── notifications/
│   │   ├── reports/
│   │   ├── compliance/
│   │   ├── appointments/
│   │   ├── announcements/
│   │   ├── calendar/
│   │   └── settings/
│   └── staff/
│       ├── dashboard/
│       ├── residents/
│       ├── profile/
│       ├── care-plan/
│       ├── medications/
│       ├── progress-notes/
│       ├── incidents/
│       ├── drug-disposal/
│       ├── evacuation/
│       ├── face-sheet/
│       ├── notifications/
│       ├── resident-requests/
│       ├── appointments/
│       ├── announcements/
│       ├── calendar/
│       └── settings/
│
├── components/
│   ├── app/
│   │   ├── Shell.jsx
│   │   ├── StaffShell.jsx
│   │   ├── ModulePage.jsx
│   │   ├── Onboarding.jsx
│   │   └── prefs.jsx
│   ├── admission/
│   ├── medications/
│   ├── records/
│   └── ui/
```

Keep admin-specific screens under `src/app/admin`. Keep staff-specific screens under `src/app/staff`. Put reusable workflow components under `src/components`.

---

## 5. Product Areas in Scope

### Admin workspace

Admin pages should support facility oversight and review workflows:

- Dashboard
- Admission
- Residents
- Staff
- Care plans
- Medications
- Progress Notes
- Incident Reports
- Drug Disposal
- Evacuation Drills
- Face sheets
- Reports
- Compliance
- Appointments
- Announcements
- Notifications
- Calendar
- Settings

### Staff workspace

Staff pages should support direct care and shift workflows:

- Dashboard
- Resident list/profile access
- Staff profile
- Care plan access
- Medication administration
- Progress Notes
- Incident Reports
- Drug Disposal
- Evacuation Drill records
- Face sheets
- Notifications
- Resident requests
- Appointments
- Announcements
- Calendar
- Settings

---

## 6. Current Implementation Rules

Follow these rules while the app is still frontend/demo-data focused:

1. Preserve the existing Colaris UI language and shell layout.
2. Do not replace the UI with generic templates.
3. Keep admin and staff workflows consistent where they represent the same process.
4. Maintain route-specific behavior when copying content from the DCLLC reference project.
5. Keep submissions disabled or mocked when requested; do not invent backend persistence.
6. Store shared sample data in component-level data modules when no backend exists yet.
7. Prefer reusable components for repeated clinical review/forms.
8. Do not add large libraries unless the current task requires them.
9. Do not remove working routes while renaming; add compatibility redirects/re-exports when useful.
10. Validate changes with targeted lint/build checks when practical.

---

## 7. Current Workflow Expectations

### Medications

Admin medication pages should focus on medication oversight, prescription/review content, and administration history.

Staff medication pages should focus on administration workflow:

- Show scheduled medications.
- Allow administered / not-given actions.
- Show progress such as `2/8 administered`.
- Show pending count.
- Remove a medication from the active queue once recorded for the shift.
- Keep final submission/backend persistence out of scope until requested.

### Clinical Records

Clinical record workflows include:

- Progress Notes
- Incident Reports
- Drug Disposal
- Evacuation Drills

Staff pages should provide the form/workflow experience. Admin pages should provide review, search, filter, and status-management behavior. Keep submit/review persistence mocked until a backend milestone is started.

Use the visible label **Progress Notes**. Do not present this module as “Daily Records” in navigation, even if a compatibility route still exists.

### Staff Management

Admin staff management should include:

- Staff list/review page
- Add Staff flow
- Profile-style fields matching the staff profile route
- Emergency contact, credential, and access/permission sections when present in the reference workflow
- Disabled/mock submit behavior until backend persistence is requested

---

## 8. Backend/Data Layer Roadmap

Do not implement this section unless explicitly requested. When the project moves from demo UI to real data, add the backend in controlled milestones.

Recommended stack for that later milestone:

- PostgreSQL
- Prisma or another agreed ORM
- Auth/session layer
- Zod validation
- Server Actions and/or Route Handlers
- File storage for uploads
- Audit logging
- Tenant/facility isolation

Core backend entities will likely include:

```txt
Facility
User
Resident
StaffProfile
CarePlan
Medication
MedicationAdministration
ProgressNote
IncidentReport
DrugDisposal
EvacuationDrill
Notification
Document
AuditLog
```

Every facility-owned entity must include a facility/tenant key, and every query must enforce facility isolation.

Do not store resident medical data or PHI in JWT/session payloads.

---

## 9. Testing and Verification

Use targeted checks while developing:

```bash
npm.cmd run lint -- src/app/page.js
npm.cmd run lint -- src/components/app/Shell.jsx
npm.cmd run lint -- src/app/staff/medications/page.jsx
```

Use broader checks before handoff when time allows:

```bash
npm.cmd run lint
npm.cmd run build
npm.cmd run test
```

If the full test/lint suite reports pre-existing issues unrelated to the current task, document that clearly instead of hiding it.

Manual smoke checks:

```txt
/ loads the SaaS landing page
/admin/dashboard loads the admin shell
/admin/staff/new loads the Add Staff form
/admin/medications loads admin medication content
/staff/medications loads staff administration queue
/admin/progress-notes loads review workflow
/staff/progress-notes loads form workflow
/admin/incidents and /staff/incidents load
/admin/drug-disposal and /staff/drug-disposal load
/admin/evacuation-drills and /staff/evacuation load
/admin/notifications loads from the admin sidebar
```

---

## 10. Deployment Notes

Current production docs live in `DEPLOYMENT.md`, but verify them before using because the current repository does not appear to include all Docker/database files referenced there.

For the current frontend-only state, the practical deployment path is:

```bash
npm install
npm run lint
npm run build
npm run start
```

When deploying publicly:

- Set required environment variables.
- Use HTTPS.
- Do not use demo secrets.
- Confirm PHI/security settings before entering real patient data.
- Confirm that backend persistence, auth, tenant isolation, audit logging, and upload storage are implemented before production healthcare use.

---

## 11. What Not To Build Yet

Do not add these unless explicitly requested:

```txt
Redux
Mobile app
Billing suite
Workforce suite
AI suite
Family portal
SMS messaging
Realtime collaboration
Offline mode
Complex permission matrix
Unrequested backend persistence
Unrequested database migrations
Unrequested external service integrations
```

---

## 12. Agent Instructions for This Project

When working on this repository:

1. Read the relevant local Next.js docs before coding because this project uses Next.js 16.
2. Keep changes scoped to the requested feature.
3. Preserve existing user work and unrelated files.
4. Use `rg` / `rg --files` for search when available.
5. Use `apply_patch` for file edits.
6. Do not use destructive git commands.
7. Use `npm.cmd` on Windows when PowerShell blocks `npm`.
8. Prefer targeted lint checks for changed files, then broader checks when useful.
9. Keep submissions mocked/disabled when the user says to skip submissions.
10. Keep the app SaaS-ready without claiming production readiness until auth, persistence, audit logging, and tenant isolation are implemented.

Main objective:

Finish Colaris Care as a polished, SaaS-ready healthcare care-management web app while keeping the current project architecture and UI consistent.
