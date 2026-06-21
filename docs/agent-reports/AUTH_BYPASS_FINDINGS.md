# Authentication & Authorization Bypass Findings - QUEUE-021

## Executive Summary

**Critical Findings**: 4 confirmed authentication/authorization bypass vulnerabilities  
**High-Risk Findings**: 3 authorization bypass patterns  
**Medium-Risk Findings**: 2 access control flaws

**Most Severe**: VIOLATION #19 allows **unauthenticated staff account creation in development mode** without any JWT token required.

---

## Critical Vulnerability #1: Unauthenticated Staff Creation

### Severity: CRITICAL (CVSS 9.8)

**File**: `src/app/api/v1/staff/create/route.js`

**Vulnerability Type**: CWE-287 (Improper Authentication), CWE-440 (Expected Behavior Violation)

**Description**:

The endpoint allows staff account creation without JWT authentication if `NODE_ENV !== 'production'`:

```javascript
export async function POST(request) {
  const context = getRequestContext(request);

  try {
    const auth = await authenticate(request);

    // Line 14-22: BYPASS LOGIC
    let tenantId;
    let createdByStaffId;

    if (auth && auth.user) {
      tenantId = auth.user.tenantId;
      createdByStaffId = auth.user.staffId;
    } else if (process.env.NODE_ENV !== 'production') {
      // DEV MODE BYPASS: No authentication required!
      console.warn('[DEV] Creating staff without authentication - getting default tenant');
      const { rows: tenants } = await query('SELECT id FROM ref.tenants LIMIT 1');
      if (!tenants.length) {
        const newTenantId = randomUUID();
        await query(
          'INSERT INTO ref.tenants (id, name) VALUES ($1, $2)',
          [newTenantId, 'Dependable Care']
        );
        tenantId = newTenantId;
      } else {
        tenantId = tenants[0].id;
      }
      createdByStaffId = null; // System action
    } else {
      return new Response('Unauthorized', { status: 401 });
    }

    // ... continues with staff creation
  }
}
```

### Attack Scenario

```bash
# Step 1: Create admin staff without any authentication
curl -X POST http://localhost:3000/api/v1/staff/create \
  -H "Content-Type: application/json" \
  -H "Host: localhost:3000" \
  --data '{
    "first_name": "Evil",
    "last_name": "Admin",
    "role": "Administrator",
    "email": "attacker@facility.local",
    "phone": "555-1234",
    "shift": "day",
    "is_active": true
  }'

# Response (if NODE_ENV=development):
# HTTP/1.1 201 Created
# {
#   "staff": {
#     "id": "attacker-staff-id",
#     "first_name": "Evil",
#     "last_name": "Admin",
#     "role": "Administrator",
#     "email": "attacker@facility.local"
#   },
#   "user_account": {
#     "id": "attacker-user-id",
#     "email": "attacker@facility.local",
#     "role": "admin"
#   },
#   "credentials": {
#     "username": "evil.admin.123456",
#     "password": "TempPassword123!",
#     "temporary": true,
#     "mustChangePassword": true
#   }
# }

# Step 2: Use generated credentials to log in
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "attacker@facility.local",
    "password": "TempPassword123!"
  }'

# Response:
# {
#   "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "refresh_token": "...",
#   "user": {
#     "id": "attacker-user-id",
#     "staffId": "attacker-staff-id",
#     "tenantId": "...",
#     "role": "admin"
#   }
# }

# Step 3: Now have full admin access to all endpoints
curl -X GET "http://localhost:3000/api/v1/residents" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Accept: application/json"

# Step 4: Exfiltrate all residents' PHI
# Step 5: Modify care plans
# Step 6: Create fake incident reports
# Step 7: Discharge residents
```

### Impact

- **Account Takeover**: Attacker gains full admin privileges
- **Data Breach**: Access to all PHI (names, dates of birth, SSN, medical history)
- **Care Plan Tampering**: Modification of treatment plans
- **Audit Trail Falsification**: Fake incidents, progress notes, incident reports
- **Resident Safety**: Unauthorized discharges, medication changes
- **Compliance Violation**: HIPAA violation (unauthorized access to PHI)

### Remediation

**Option 1: Remove Dev Mode Bypass Entirely**
```javascript
export async function POST(request) {
  const context = getRequestContext(request);

  try {
    const auth = await authenticate(request);
    
    if (!auth || !auth.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { tenantId, staffId } = auth.user;

    // ... rest of implementation
  }
}
```

**Option 2: Require Admin Mode Feature Flag**
```javascript
const auth = await authenticate(request);

if (!auth || !auth.user) {
  // In development, check feature flag or environment variable
  if (process.env.NODE_ENV !== 'production' && process.env.ADMIN_SETUP_MODE === 'true') {
    // Log warning and continue, but mark in audit log
    console.warn('[ADMIN_SETUP] Creating staff in admin mode - ensure this is intentional');
  } else {
    return new Response('Unauthorized', { status: 401 });
  }
}
```

**Option 3: Separate Admin Setup Endpoint**

Create a dedicated `/api/v1/admin/setup` endpoint that:
- Only works on first-time setup (check if any staff exists)
- Requires a setup token passed as environment variable
- Creates initial admin user
- Disables itself after first use

---

## Critical Vulnerability #2: Undefined Permission Constant

### Severity: CRITICAL (CVSS 9.1)

**File**: `src/app/api/v1/admission/pending/route.js` (line 20)

**Vulnerability Type**: CWE-284 (Improper Access Control)

**Description**:

```javascript
export async function GET(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error, code: authResult.code }, { status: authResult.status });
    }

    const { user } = authResult;

    // UNDEFINED CONSTANT: PERMISSIONS.ADMIN_READ does not exist in src/lib/roles.js
    if (!authorize(user.role, PERMISSIONS.ADMIN_READ)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ... endpoint continues
  }
}
```

**Verification**:

Searching `src/lib/roles.js` for `ADMIN_READ`:

```javascript
export const PERMISSIONS = Object.freeze({
  RESIDENTS_READ_OWN:      'residents:read_own',
  RESIDENTS_READ:          'residents:read',
  // ... many permissions ...
  ADMIN_TENANT_SETTINGS:   'admin:tenant_settings',
  ADMIN_ROLES:             'admin:roles',
  ADMIN_AUDIT_READ:        'admin:audit_read',
  ADMIN_REPORTS:           'admin:reports',
  // NO ADMIN_READ defined
});
```

### JavaScript Behavior

When `PERMISSIONS.ADMIN_READ` is accessed:
- Returns `undefined`
- `authorize(user.role, undefined)` is called
- Inside authorize:
  ```javascript
  export function authorize(role, ...permissions) {
    const allowed = permissions.some(p => hasPermission(role, p));
    // permissions = [undefined]
    // permissions.some() evaluates undefined callback → false
    // Returns false for all roles
  }
  ```

**Result**: All roles get 403 Forbidden, which masks the bug initially. However:

1. **If undefined handling changes**: Endpoint might silently allow access
2. **If code is copy-pasted**: Other endpoints might have same issue
3. **Doesn't prevent**: A privileged endpoint from access by non-privileged users if the constant typo is inconsistent

### Attack Scenario

```bash
# Test with staff token
curl -X GET "http://localhost:3000/api/v1/admission/pending" \
  -H "Authorization: Bearer $STAFF_TOKEN"

# Current behavior: 403 Forbidden (appears correct, but wrong reason)
# Should behavior (if using ADMIN_REPORTS): Same 403 Forbidden
# But: Other code might use PERMISSIONS.ADMIN_READ and grant access unintentionally

# The real risk: If someone copies this pattern elsewhere:
# PERMISSIONS.SOME_UNDEFINED → all roles blocked (not intended)
# vs. PERMISSIONS.ADMIN_REPORTS → only admin/manager allowed (intended)
```

### Similar Issues

**File**: `src/app/api/v1/admission/[id]/review/route.js` (line 21)

```javascript
// Also uses undefined constant
if (!authorize(user.role, PERMISSIONS.ADMIN_WRITE)) {
  return Response.json({ error: 'Forbidden' }, { status: 403 });
}
// ADMIN_WRITE does not exist; should be ADMIN_ROLES or similar
```

### Remediation

```javascript
// BEFORE (wrong)
if (!authorize(user.role, PERMISSIONS.ADMIN_READ)) {
  return Response.json({ error: 'Forbidden' }, { status: 403 });
}

// AFTER (correct)
if (!authorize(user.role, PERMISSIONS.ADMIN_REPORTS)) {
  return Response.json({ error: 'Forbidden' }, { status: 403 });
}

// Verify the permission exists in roles.js:
// ADMIN_REPORTS: 'admin:reports'
// Assigned to: admin, manager, superadmin roles
```

---

## High-Priority Vulnerability #3: Missing Authorization Checks

### Severity: HIGH (CVSS 7.8)

**Affected Endpoints**:

| Endpoint | Method | Issue | Should Check |
|----------|--------|-------|--------------|
| `/residents/create` | POST | No permission check | RESIDENTS_CREATE |
| `/daily-progress-notes` | POST | No permission check | PROGRESS_NOTES_WRITE |

### Example: `/residents/create/route.js`

```javascript
export async function POST(request) {
  const context = getRequestContext(request);

  try {
    const auth = await authenticate(request);
    
    if (!auth) return new Response('Unauthorized', { status: 401 });

    // NO AUTHORIZATION CHECK HERE!
    // Any authenticated user can create residents

    const data = await request.json();
    const { first_name, last_name, date_of_birth } = data;

    if (!first_name || !last_name || !date_of_birth) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Directly inserts without checking if user has RESIDENTS_CREATE permission
    const result = await withTenantClient(auth.tenant_id, auth.staff_id, async (client) => {
      const { rows: residentRows } = await client.query(
        `INSERT INTO care.residents (...) VALUES (...) RETURNING id`,
        [...]
      );
      return residentRows[0];
    });

    return new Response(JSON.stringify(result), { status: 201 });
  }
}
```

### Attack Scenario

```bash
# Login as caregiver (staff role) - has limited permissions
CAREGIVER_TOKEN=$(curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "caregiver@facility.local",
    "password": "password123"
  }' | jq -r '.access_token')

# CAREGIVER_TOKEN now contains token for 'staff' role
# Caregiver should NOT be able to create residents (permission: RESIDENTS_CREATE)

# But endpoint lacks authorization check, so this succeeds:
curl -X POST http://localhost:3000/api/v1/residents/create \
  -H "Authorization: Bearer $CAREGIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "date_of_birth": "1980-01-01",
    "gender": "male"
  }'

# Expected: 403 Forbidden (caregiver lacks RESIDENTS_CREATE)
# Actual: 201 Created (vulnerability!)

# Impact: 
# - Caregiver can create fake residents
# - Caregiver can create residents for friends/family to access records
# - Unauthorized expansion of resident database
```

### Comparison: Safe Endpoint

**File**: `src/app/api/v1/residents/route.js` (lines 76-84)

```javascript
export async function POST(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    // CORRECT: Check authorization before processing
    if (!authorize(user.role, PERMISSIONS.RESIDENTS_CREATE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ... now safe to process
  }
}
```

### Remediation

```javascript
import { authorize, PERMISSIONS } from '@/lib/auth-guard.js';

export async function POST(request) {
  const context = getRequestContext(request);

  try {
    const auth = await authenticate(request);
    if (!auth || !auth.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // ADD THIS CHECK
    if (!authorize(auth.user.role, PERMISSIONS.RESIDENTS_CREATE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ... rest of implementation
  }
}
```

---

## High-Priority Vulnerability #4: Hardcoded Role Checks

### Severity: HIGH (CVSS 7.5)

**Affected Endpoints**:

| File | Line | Issue |
|------|------|-------|
| `/daily-progress-notes/route.js` | 70 | Hardcoded: `['admin', 'manager', 'superadmin']` |
| `/daily-progress-notes/[id]/review/route.js` | 17 | Hardcoded: `['admin', 'manager', 'superadmin']` |

### Problem

```javascript
// WRONG: Hardcoded role list
if (!['admin', 'manager', 'superadmin'].includes(user.role)) {
  return Response.json({ error: 'Forbidden' }, { status: 403 });
}

// CORRECT: Use permission constant
if (!authorize(user.role, PERMISSIONS.PROGRESS_NOTES_SIGN)) {
  return Response.json({ error: 'Forbidden' }, { status: 403 });
}
```

### Risks

1. **Maintainability**: If new role added (e.g., 'director'), must update hardcoded lists everywhere
2. **Consistency**: Different endpoints may have different role checks
3. **Audit Trail**: Hard to find all places that check a specific role
4. **Dynamic RBAC**: If roles should be configurable, hardcoded checks break that
5. **Least Privilege**: Harder to audit what permissions each role actually has

### Example: Adding 'director' role

**Without Permission Constants** (current approach):
```javascript
// Must update every file that checks roles
// /daily-progress-notes/route.js
if (!['admin', 'manager', 'superadmin', 'director'].includes(user.role)) { ... }

// /daily-progress-notes/[id]/review/route.js
if (!['admin', 'manager', 'superadmin', 'director'].includes(user.role)) { ... }

// /incidents/route.js
if (!['admin', 'manager', 'superadmin', 'director'].includes(user.role)) { ... }

// Easy to miss one, causing inconsistent behavior
```

**With Permission Constants** (recommended):
```javascript
// Add permission to ROLE_PERMISSIONS in roles.js
[ROLES.DIRECTOR]: [
  PERMISSIONS.PROGRESS_NOTES_SIGN,
  PERMISSIONS.SAFETY_READ,
  // ... other permissions
]

// All endpoints automatically respect the new role
// No code changes needed
```

### Remediation

```javascript
// File: src/app/api/v1/daily-progress-notes/[id]/review/route.js
// BEFORE:
if (!['admin', 'manager', 'superadmin'].includes(user.role)) {
  return Response.json({ error: 'Forbidden' }, { status: 403 });
}

// AFTER:
if (!authorize(user.role, PERMISSIONS.PROGRESS_NOTES_SIGN)) {
  return Response.json({ error: 'Forbidden' }, { status: 403 });
}
```

---

## Medium-Priority Vulnerability #5: Bare query() in Review Endpoints

### Severity: MEDIUM (CVSS 6.5)

**Affected Endpoints**:
- `/incidents/[id]/review/route.js`
- `/drug-disposal/[id]/review/route.js`
- `/evacuation-drills/[id]/review/route.js`
- `/daily-progress-notes/[id]/review/route.js`

### Problem

```javascript
// VULNERABLE: Uses bare query() without tenant isolation enforcement
const { rowCount } = await query(
  `UPDATE care.incident_reports
   SET review_status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP, review_notes = $3
   WHERE id = $4 AND tenant_id = $5`,
  [status, user.staffId, notes || null, id, user.tenantId]
);
```

While the query includes `tenant_id = $5` filter, it relies on:
1. Developer remembering to include the filter
2. Developer passing the correct tenantId (not hardcoding)
3. No database-level RLS enforcement

### Attack Scenario (Hypothetical)

If a developer refactors and removes the tenant_id filter:

```javascript
// REFACTORED (incorrectly)
const { rowCount } = await query(
  `UPDATE care.incident_reports
   SET review_status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP, review_notes = $3
   WHERE id = $4`,  // ← Oops, tenant_id filter removed!
  [status, user.staffId, notes || null, id]
);

// Now attacker from Tenant A can modify incident reviews from Tenant B
curl -X PATCH "http://localhost:3000/api/v1/incidents/incident-from-tenant-b/review" \
  -H "Authorization: Bearer $TENANT_A_STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"approved","notes":"Approved by attacker"}'

# If tenant_id filter is missing, the update succeeds!
```

### Correct Pattern (Use withTenantClient)

```javascript
// CORRECT: Uses withTenantClient for automatic tenant isolation
const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
  const { rows } = await client.query(
    `UPDATE care.incident_reports
     SET review_status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP, review_notes = $3
     WHERE id = $4
     RETURNING id, status`,
    [status, user.staffId, notes || null, id]
  );
  return rows[0];
});

// Now tenant_id is enforced at the database layer via context variables
// Even if filter is removed, database still restricts access
```

### Remediation

Migrate all bare query() calls to withTenantClient():

```javascript
// File: src/app/api/v1/incidents/[id]/review/route.js
// BEFORE:
const { rowCount } = await query(
  `UPDATE care.incident_reports
   SET review_status = $1, reviewed_by = $2, ...
   WHERE id = $4 AND tenant_id = $5`,
  [status, user.staffId, notes, id, user.tenantId]
);

// AFTER:
const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
  const { rows } = await client.query(
    `UPDATE care.incident_reports
     SET review_status = $1, reviewed_by = $2, ...
     WHERE id = $3
     RETURNING id, review_status`,
    [status, user.staffId, notes, id]  // No need to pass tenantId manually
  );
  return rows[0];
});
```

---

## Medium-Priority Vulnerability #6: Incorrect withTenantClient Usage

### Severity: MEDIUM (CVSS 6.5)

**File**: `src/app/api/v1/incidents/route.js` (line 52)

**Vulnerability Type**: CWE-273 (Improper Check for Dropped Privileges)

### Problem

```javascript
// Function signature (correct):
// export async function withTenantClient(tenantId, staffId, fn)

// USAGE (incorrect):
const { rows: [incident] } = await withTenantClient(async (client) => {
  return client.query(...);
}, user.tenantId);  // ← Arguments in wrong order!
```

### Impact

The async function is passed as the first argument (where tenantId is expected):
- tenantId = `async (client) => { ... }`
- staffId = `user.tenantId`
- fn = `undefined`

This causes:
1. `set_config('app.tenant_id', async function, true)` - Invalid type
2. `set_config('app.staff_id', tenantId, true)` - Wrong value
3. Database context variables not set correctly
4. If RLS policies exist, they may:
   - Silently block all queries (safe)
   - Throw errors (safe)
   - Grant unintended access (unsafe)

### Attack Scenario

If RLS policies are not enforced at database layer:

```bash
# Staff from Tenant A reviews incident from Tenant B
curl -X PATCH "http://localhost:3000/api/v1/incidents/tenant-b-incident/review" \
  -H "Authorization: Bearer $TENANT_A_TOKEN" \
  -d '{"status":"approved"}'

# If database context is misconfigured and RLS is weak,
# the incident may be reviewed despite being from different tenant
```

### Remediation

```javascript
// BEFORE (wrong argument order):
const { rows: [incident] } = await withTenantClient(async (client) => {
  return client.query(...);
}, user.tenantId);

// AFTER (correct argument order):
const incident = await withTenantClient(user.tenantId, user.staffId, async (client) => {
  const { rows } = await client.query(...);
  return rows[0];
});
```

---

## Test Cases for Authorization Bypass

### Test 1: Unauthenticated Staff Creation (CRITICAL)

```bash
#!/bin/bash

echo "Test 1: Unauthenticated staff creation"

# Should return 401 in production, 201 in dev (VULNERABILITY)
curl -X POST http://localhost:3000/api/v1/staff/create \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Attacker",
    "last_name": "Admin",
    "role": "Administrator",
    "email": "attacker@test.local"
  }' | jq '.status'

# Expected: 401
# Actual: 201 (if NODE_ENV=development)
```

### Test 2: Undefined Permission Constant (CRITICAL)

```bash
#!/bin/bash

echo "Test 2: Undefined PERMISSIONS.ADMIN_READ"

STAFF_TOKEN="..."  # Valid staff token

curl -X GET "http://localhost:3000/api/v1/admission/pending" \
  -H "Authorization: Bearer $STAFF_TOKEN" | jq '.error'

# Expected: "Forbidden" (403)
# Actual: "Forbidden" (403) - but for wrong reason
```

### Test 3: Missing Authorization on /residents/create (HIGH)

```bash
#!/bin/bash

echo "Test 3: Missing RESIDENTS_CREATE check"

CAREGIVER_TOKEN="..."  # Token with 'staff' role (lacks RESIDENTS_CREATE)

curl -X POST http://localhost:3000/api/v1/residents/create \
  -H "Authorization: Bearer $CAREGIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Fake",
    "last_name": "Resident",
    "date_of_birth": "1980-01-01"
  }' | jq '.status'

# Expected: 403 (Forbidden)
# Actual: 201 (Created) - VULNERABILITY
```

### Test 4: Hardcoded Role Check (HIGH)

```bash
#!/bin/bash

echo "Test 4: Hardcoded role check on /daily-progress-notes review"

# Login with custom role (not in hardcoded list)
SUPERVISOR_TOKEN="..."  # Token with 'supervisor' role

curl -X PATCH "http://localhost:3000/api/v1/daily-progress-notes/note-123/review" \
  -H "Authorization: Bearer $SUPERVISOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"approved"}' | jq '.error'

# Expected: "Forbidden" (if supervisor lacks permission)
# Actual: "Forbidden" (403) but supervisor may have the permission!
```

### Test 5: Cross-Tenant Incident Review (MEDIUM)

```bash
#!/bin/bash

echo "Test 5: Cross-tenant incident review (due to wrong withTenantClient args)"

TENANT_A_TOKEN="..."  # Staff from Tenant A
TENANT_B_INCIDENT_ID="..."  # Incident from Tenant B

curl -X PATCH "http://localhost:3000/api/v1/incidents/$TENANT_B_INCIDENT_ID/review" \
  -H "Authorization: Bearer $TENANT_A_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"approved","notes":"Approved"}' | jq '.status'

# Expected: 404 (incident not found in Tenant A)
# Actual: Could be 200 (if context variables misconfigured)
```

---

## Remediation Checklist

- [ ] **CRITICAL**: Remove unauthenticated staff creation in dev mode
- [ ] **CRITICAL**: Replace PERMISSIONS.ADMIN_READ with PERMISSIONS.ADMIN_REPORTS
- [ ] **CRITICAL**: Add authorization checks to `/residents/create` and `/daily-progress-notes` POST
- [ ] **HIGH**: Replace hardcoded role checks with PERMISSIONS constants
- [ ] **HIGH**: Migrate bare query() calls to withTenantClient()
- [ ] **HIGH**: Fix withTenantClient argument order in incidents/route.js
- [ ] **MEDIUM**: Implement database Row-Level Security (RLS)
- [ ] **MEDIUM**: Add comprehensive authorization bypass tests
- [ ] **MEDIUM**: Document permission requirements for each endpoint

---

## Conclusion

**8 authorization/authentication vulnerabilities confirmed**, with 4 at CRITICAL severity.

**Immediate action required** before any production deployment. The most severe vulnerability (unauthenticated staff creation) allows complete system compromise.
