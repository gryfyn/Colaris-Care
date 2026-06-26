# Staff and Admin Permissions

This document describes the permissions currently implemented for the `staff` and `admin` roles. It is based on the RBAC definitions in `src/lib/roles.js` and the authorization flow in `src/lib/auth-guard.js` as of June 25, 2026.

## How access is enforced

- API requests must contain a valid access-token bearer token.
- A route authorizes the user's role against one or more permission keys.
- Queries are tenant-scoped. An admin has facility-wide access within their tenant, not automatic access to other tenants.
- Some staff operations are further limited to residents actively assigned to that staff member. Care-plan lists and progress-note creation explicitly apply this restriction.
- The `staff` role has `ssn_last4` masked as `[RESTRICTED]`. The `admin` role has no fields configured for role-based masking.
- UI visibility is not the security boundary. API authorization and database scoping remain authoritative.

## Practical access summary

| Area | Staff | Admin |
|---|---|---|
| Residents | Read; no create, update, discharge, delete, or export permission | Full read, create, update, discharge, delete, and export access |
| Care plans | Read, create, update, and sign; no delete or approval permission | Full access, including delete and approval |
| Goals | Read and write | Read and write |
| Progress notes | Read, write, and sign | Read, write, and sign |
| Safety records | Read and write incidents, drug-disposal records, evacuation drills, and related safety data | Read and write |
| Releases of information (ROI) | Read and write; cannot revoke | Read, write, and revoke |
| Discharge records | Read and write, but cannot perform the resident discharge action | Read and write; can perform the resident discharge action |
| Staff records | Read only | Read, create/update, and deactivate |
| Admission forms | Write only; no general read or approve permission | Read, write, approve, and reject where supported |
| Reports and audit data | No access | Access |
| Account management | No access | Access |
| Tenant settings and role administration | No access | Access |

## Exact RBAC matrix

`Allowed` means the role owns the permission key. A route may still impose assignment, tenant, record-state, validation, or workflow restrictions.

| Permission key | Staff | Admin | Meaning |
|---|:---:|:---:|---|
| `residents:read_own` | No | Allowed | Read only a linked personal resident record |
| `residents:read` | Allowed | Allowed | Read resident records |
| `residents:create` | No | Allowed | Create resident records |
| `residents:update` | No | Allowed | Update resident records |
| `residents:discharge` | No | Allowed | Perform the resident discharge action |
| `residents:delete` | No | Allowed | Delete resident records |
| `residents:export` | No | Allowed | Export resident data |
| `care_plans:read_own` | No | Allowed | Read only linked personal care plans |
| `care_plans:read` | Allowed | Allowed | Read care plans |
| `care_plans:create` | Allowed | Allowed | Create care plans |
| `care_plans:update` | Allowed | Allowed | Update care plans |
| `care_plans:delete` | No | Allowed | Delete care plans |
| `care_plans:sign` | Allowed | Allowed | Sign care plans |
| `care_plans:approve` | No | Allowed | Approve care plans or protected form-review work |
| `goals:read_own` | No | Allowed | Read only linked personal goals |
| `goals:read` | Allowed | Allowed | Read goals |
| `goals:write` | Allowed | Allowed | Create or update goals |
| `progress_notes:read_own` | No | Allowed | Read only linked personal progress notes |
| `progress_notes:read` | Allowed | Allowed | Read progress notes |
| `progress_notes:write` | Allowed | Allowed | Create or update progress notes |
| `progress_notes:sign` | Allowed | Allowed | Sign progress notes |
| `safety:read_own` | No | Allowed | Read only linked personal safety data |
| `safety:read` | Allowed | Allowed | Read safety records |
| `safety:write` | Allowed | Allowed | Create or update safety records |
| `roi:read_own` | No | Allowed | Read only linked personal ROI records |
| `roi:read` | Allowed | Allowed | Read ROI records |
| `roi:write` | Allowed | Allowed | Create or update ROI records |
| `roi:revoke` | No | Allowed | Revoke an ROI |
| `staff:read` | Allowed | Allowed | Read permitted staff data |
| `staff:write` | No | Allowed | Create or update staff data and assignments |
| `staff:deactivate` | No | Allowed | Deactivate staff accounts |
| `admin:tenant_settings` | No | Allowed | Manage tenant settings |
| `admin:roles` | No | Allowed | Manage role configuration |
| `admin:audit_read` | No | Allowed | Read audit and credential-history data |
| `admin:reports` | No | Allowed | Access administrative dashboards, reports, and form history |
| `accounts:manage` | No | Allowed | Manage user accounts and administrative password changes |
| `discharge:read_own` | No | Allowed | Read only a linked personal discharge record |
| `discharge:read` | Allowed | Allowed | Read discharge records |
| `discharge:write` | Allowed | Allowed | Create or update discharge documentation |
| `admission:forms_read` | No | Allowed | Read admission forms and uploaded documents |
| `admission:forms_write` | Allowed | Allowed | Create or update admission forms and documents |
| `admission:forms_approve` | No | Allowed | Approve or reject admission forms |

## Portal access

- `/staff` accepts authenticated `staff`, `manager`, `admin`, and `superadmin` roles.
- `/admin` currently accepts the `admin` role (and the legacy `administrator` label used by the page guard).
- Client-side portal checks improve navigation, but every protected API operation must continue to enforce authorization on the server.

## Maintenance

Update this document whenever `src/lib/roles.js`, `src/lib/auth-guard.js`, assignment-scoping logic, or protected route checks change. The permission map is the baseline; route-specific checks determine the final access granted for an individual request.
