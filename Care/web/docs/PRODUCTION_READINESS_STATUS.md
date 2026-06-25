# Production Readiness Status

This file is the handoff checklist for Claude after applying all staged artifacts.

## Completed In Staged Artifacts

- Backend foundation: database pool, transaction-local RLS context, auth guard, RBAC helper, staff assignment helper.
- Core schema: organizations, facilities, users, memberships, sessions, staff, residents, assignments, care plans, medications, MAR, progress notes, incidents, disposal, evacuation, notifications, announcements, appointments, documents, admissions, ROI, discharge, audit, outbox, idempotency.
- Auth: login, refresh, logout, me, signed refresh cookie, signed non-PHI portal cookie, login form integration.
- Protection: `/admin` and `/staff` proxy checks.
- APIs: collection routes, operational routes, action routes.
- UI: high-traffic admin/staff pages wired to API with fixture fallback.
- Compliance: full admin compliance page, compliance summary API, audit read API.
- Deployment: production checklist, monitoring guide, incident runbooks, production config verifier.
- Tests: focused RBAC/password/auth/residents route tests.
- Readiness: health and ready endpoints.

## Must Verify After Applying

- Migrations apply cleanly against a fresh PostgreSQL database.
- Seed script creates login-compatible password hashes.
- Login works for admin and staff seed accounts.
- `/admin` rejects staff-only sessions.
- `/staff` accepts staff/admin/superadmin sessions.
- Staff care-plan/progress-note access is assignment scoped.
- Admin audit route rejects staff.
- UI pages still build after JSX linting.
- API route imports resolve under Next.js.
- All tests pass.

## Known Follow-Up Risks

- Some UI pages remain fixture-heavy beyond list-level API reads.
- Full form submissions are not wired for every clinical form.
- Redis/session revocation is optional in the staged code; add a shared store before high-risk production.
- Object storage upload/download authorization still needs endpoint-specific hardening.
- RLS policies are broad tenant/facility policies; route-level RBAC carries action specificity. Add database action-specific policies before regulated production if required by deployment policy.
