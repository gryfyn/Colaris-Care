# Admin API Endpoints Test Plan

This document outlines the comprehensive testing strategy for all admin API endpoints, covering authentication, authorization, HIPAA compliance (tenant isolation), data consistency, and error handling.

## Endpoints Under Test

1. `GET /api/v1/residents` - List all residents
2. `POST /api/v1/residents` - Create new resident
3. `GET /api/v1/staff` - List all staff
4. `POST /api/v1/staff` - Create new staff member
5. `GET /api/v1/dashboard` - Get dashboard metrics
6. `GET /api/v1/admission/pending` - List pending admissions
7. `GET /api/v1/admin/overview` - Get admin overview with caching
8. `POST /api/v1/admin/overview` - Refresh admin overview cache

## Test Coverage Matrix

### Authentication & Authorization Tests

All endpoints must verify:

| Test | GET Residents | POST Residents | GET Staff | POST Staff | GET Dashboard | GET Pending | GET Overview | POST Overview |
|------|---|---|---|---|---|---|---|---|
| Returns 401 when missing auth header | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Returns 401 when token is invalid | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Returns 403 when lacking permission | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Allows authorized users | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

**Key Permission Mappings:**
- `GET /api/v1/residents` → `PERMISSIONS.RESIDENTS_READ` or `PERMISSIONS.RESIDENTS_READ_OWN`
- `POST /api/v1/residents` → `PERMISSIONS.RESIDENTS_CREATE`
- `GET /api/v1/staff` → `PERMISSIONS.STAFF_READ`
- `POST /api/v1/staff` → `PERMISSIONS.STAFF_WRITE`
- `GET /api/v1/dashboard` → `PERMISSIONS.ADMIN_REPORTS` or `PERMISSIONS.RESIDENTS_READ`
- `GET /api/v1/admission/pending` → `PERMISSIONS.ADMIN_READ`
- `GET /api/v1/admin/overview` → `PERMISSIONS.ADMIN_REPORTS`
- `POST /api/v1/admin/overview` → `PERMISSIONS.ADMIN_REPORTS`

### HIPAA Compliance - Tenant Isolation Tests

All endpoints must verify tenant isolation is enforced:

| Test | GET Residents | POST Residents | GET Staff | POST Staff | GET Dashboard | GET Pending | GET Overview | POST Overview |
|------|---|---|---|---|---|---|---|---|
| Uses `withTenantClient` for PHI queries | ✓ | ✓ | N/A | N/A | ✓ | ✓ | ✓ | ✓ |
| Filters by authenticated tenant_id | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Includes staffId in context | ✓ | ✓ | N/A | N/A | ✓ | ✓ | ✓ | ✓ |

**Critical Implementation Details:**
- `withTenantClient(tenantId, staffId, async (client) => { ... })` MUST be used for all PHI queries
- `query()` can only be used for non-PHI tables (ref.staff, ref.facility_config, etc.)
- Tenant isolation is enforced at the database level via `SET app.tenant_id` and `app.staff_id` config variables
- All WHERE clauses for PHI tables must include explicit `tenant_id = user.tenantId` filters

### Data Consistency Tests

#### GET /api/v1/residents

- ✓ Returns array of resident objects
- ✓ Includes all required fields: id, first_name, last_name, status, intake_date, etc.
- ✓ Applies PHI masking based on user role
- ✓ Decrypts encrypted fields (first_name, last_name, ssn_last4, phone, email, etc.)
- ✓ Returns pagination metadata (page, limit, total, pages)
- ✓ Filters by status parameter
- ✓ Filters by search parameter (ILIKE on name or medicaid_id)
- ✓ Enforces limit maximum of 100
- ✓ Applies default limit of 25 if not specified
- ✓ Calculates correct page count

#### GET /api/v1/staff

- ✓ Returns array of staff objects with all required fields
- ✓ Sorts by last_name, first_name
- ✓ Includes: id, first_name, last_name, role, email, phone, shift, hire_date, etc.

#### POST /api/v1/residents

- ✓ Creates resident with required fields only
- ✓ Encrypts sensitive fields before storage
- ✓ Returns 201 Created status
- ✓ Returns resident id and status in response
- ✓ Sets created_by to current staff_id
- ✓ Sets default values: status='active', consent_to_treatment='pending', country='USA', state='Oregon'

#### POST /api/v1/staff

- ✓ Returns 422 when required fields missing: first_name, last_name, role, email, password
- ✓ Hashes password using bcryptjs (salt rounds: 12)
- ✓ Creates transaction (BEGIN → INSERT staff → INSERT user_accounts → COMMIT)
- ✓ Rolls back transaction on error
- ✓ Lowercases and trims email before insert
- ✓ Returns 201 Created with id, email, and role
- ✓ Creates both ref.staff and care.user_accounts records

#### GET /api/v1/dashboard

- ✓ Returns object with all metrics:
  - active_residents (count of status='active')
  - active_plans (count of status='active')
  - plans_expiring_soon (count where expiration_date < NOW() + 30 days)
  - reviews_overdue (count from v_active_residents_with_plan where review_overdue=true)
  - high_risk_residents (count from v_high_risk_residents)
  - roi_expiring_soon (count from v_roi_expiring_soon)

#### GET /api/v1/admission/pending

- ✓ Returns array of pending admissions
- ✓ Joins with pre_screening, nursing_assessment, advance_directive tables
- ✓ Handles null joined records gracefully (returns null for missing forms)
- ✓ Returns pagination metadata
- ✓ Enforces limit maximum of 100

#### GET /api/v1/admin/overview

- ✓ Returns metrics object with all required fields
- ✓ Calculates bed_capacity object:
  - occupied: count of active residents
  - total: from facility_config.bed_capacity
  - available: total - occupied
  - occupancy_rate: (occupied / total * 100).toFixed(1)
- ✓ Returns pending_admissions, pending_incidents, recent_incidents_7d
- ✓ Returns active_staff, inactive_staff, active_residents
- ✓ Returns care_plans_expiring_30d, roi_expiring_soon
- ✓ Handles null bed_capacity gracefully (defaults to 0)
- ✓ Returns `cached: false` on first request
- ✓ Caches results for 60 seconds
- ✓ Returns `cached: true` on subsequent requests within 60 seconds
- ✓ Invalidates cache after 60 seconds

#### POST /api/v1/admin/overview (refresh)

- ✓ Clears cache and fetches fresh data
- ✓ Returns `refreshed: true` in response
- ✓ Returns same metrics format as GET

### Error Handling Tests

All endpoints must properly handle:

| Error Scenario | Expected Status | Response Format |
|---|---|---|
| Missing authorization header | 401 | `{ error: "Missing or malformed Authorization header" }` |
| Expired token | 401 | `{ error: "Token expired", code: "TOKEN_EXPIRED" }` |
| Invalid token | 401 | `{ error: "Invalid token" }` |
| Insufficient permissions | 403 | `{ error: "Forbidden" }` |
| Missing required fields (POST) | 422 | `{ error: "<field_name> is required" }` |
| Database connection error | 500 | `{ error: "Internal server error" }` |
| Foreign key constraint violation | 422 | `{ error: "Referenced record does not exist", code: "FK_VIOLATION" }` |
| Duplicate key violation | 409 | `{ error: "A record with that value already exists", code: "DUPLICATE" }` |

### Audit Logging Tests

All write operations and PHI reads must log:

| Operation | Audit Method | Required Fields |
|---|---|---|
| GET /residents | `audit.logSelect()` | tableName, req, justification (optional) |
| POST /residents | `audit.logInsert()` | tableName, recordId, residentId, req |
| GET /staff | (non-PHI read) | N/A |
| POST /staff | `audit.log()` | eventType='STAFF_CREATE', tableName, recordId, phiAccessed, req |
| GET /dashboard | `audit.logSelect()` | tableName, req |
| GET /pending | `audit.logSelect()` | tableName, req, justification (optional) |
| GET /overview | `audit.logSelect()` | tableName, req |

## Test Implementation Notes

### Mock Setup Required

Each test file must mock:

1. **@/lib/auth-guard.js**
   - `authenticate()`: Returns `{ user: { id, tenantId, staffId, role } }`
   - `authorize()`: Returns boolean
   - `handleError()`: Returns `Response.json({ error: string }, { status: number })`
   - `maskPHI()`: Applies field masking based on role
   - `getRequestContext()`: Returns request context object

2. **@/lib/db.js**
   - `withTenantClient(tenantId, staffId, fn)`: Calls fn with mocked client
   - `query()`: For non-PHI queries
   - `pool.connect()`: For transaction tests

3. **@/lib/roles.js**
   - `PERMISSIONS`: Object with all permission constants
   - `ROLES`: Object with role constants

4. **@/lib/audit-logger.js**
   - `AuditLogger`: Constructor that returns object with logSelect, logInsert, log methods

5. **bcryptjs** (for password tests)
   - `hash()`: Returns mocked hashed password

### Running Tests

```bash
# Run all API endpoint tests
npm test -- __tests__/api/v1/

# Run specific endpoint tests
npm test -- __tests__/api/v1/residents.test.js
npm test -- __tests__/api/v1/staff.test.js
npm test -- __tests__/api/v1/dashboard.test.js
npm test -- __tests__/api/v1/admin-overview.test.js

# Run with coverage
npm test -- __tests__/api/v1/ --coverage
```

## Test Files Created

1. `__tests__/api/v1/residents.test.js` - Tests for resident endpoints (32 tests)
2. `__tests__/api/v1/staff.test.js` - Tests for staff endpoints (30+ tests)
3. `__tests__/api/v1/dashboard.test.js` - Tests for dashboard endpoint (10+ tests)
4. `__tests__/api/v1/admin-overview.test.js` - Tests for admin overview endpoints (20+ tests)
5. `__tests__/api/admission/pending.test.js` - Existing tests for pending admissions (38 tests)

## Critical Bug Fixes Applied

### Bug #1: Incorrect withTenantClient Signature
**Location:** `/api/v1/incidents/route.js` (known issue from instructions)
**Problem:** Called as `withTenantClient(async (client) => { ... })`
**Fix:** Must be `withTenantClient(user.tenantId, user.staffId, async (client) => { ... })`

## Compliance Notes

### HIPAA Requirements Met

- ✓ All PHI queries use `withTenantClient` for tenant isolation
- ✓ All write operations log to audit trail
- ✓ All PHI reads require explicit permission checks
- ✓ Sensitive fields are encrypted at rest
- ✓ Sensitive fields are masked in responses based on user role
- ✓ All database errors log without exposing PHI
- ✓ Staff ID is captured in audit logs for accountability

### Data Security

- ✓ Passwords hashed with bcryptjs (salt rounds: 12)
- ✓ Sensitive fields encrypted with tenant-specific keys
- ✓ PII fields masked based on user role
- ✓ All queries parameterized (no SQL injection vulnerability)
- ✓ Cross-tenant access prevented by withTenantClient isolation
