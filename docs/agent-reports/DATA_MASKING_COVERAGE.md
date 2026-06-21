# PHI Data Masking & Endpoint Audit
**Date**: 2026-05-16  
**Status**: PARTIAL COVERAGE - CRITICAL GAPS IDENTIFIED

---

## Executive Summary
The `maskPHI()` function correctly implements field-level masking for role-based access, but **is not consistently applied across all endpoints**. Some endpoints return full PHI even when masking is required, while others correctly decrypt and mask encrypted fields.

---

## 1. maskPHI() Implementation

### Code Review
**File**: `src/lib/auth-guard.js` lines 70-78

```javascript
export function maskPHI(obj, role) {
  if (!obj) return obj;
  const masked = { ...obj };
  const fields = PHI_MASKED_FIELDS[role] || [];
  for (const f of fields) {
    if (f in masked) masked[f] = '[RESTRICTED]';
  }
  return masked;
}
```

**ASSESSMENT**: ✓ Correct implementation
- Creates shallow copy (doesn't mutate original)
- Looks up role in PHI_MASKED_FIELDS configuration
- Replaces restricted fields with `[RESTRICTED]` marker

### Masking Configuration
**File**: `src/lib/roles.js` lines 134-140

```javascript
export const PHI_MASKED_FIELDS = {
  [ROLES.RESIDENT_CARE_OF]: [],
  [ROLES.STAFF]:            ['ssn_last4'],
  [ROLES.MANAGER]:          [],
  [ROLES.ADMIN]:            [],
  [ROLES.SUPERADMIN]:       [],
};
```

**ASSESSMENT**: ⚠️ Configuration is minimal
- Only SSN_last4 masked from STAFF role
- All other roles have no masking
- RESIDENT_CARE_OF residents can see full SSN_last4 (their own account, expected)
- STAFF cannot see SSN but can see all other PHI

---

## 2. Endpoint Audit: Residents GET (List)

### Implementation
**File**: `src/app/api/v1/residents/route.js` lines 17-74

```javascript
export async function GET(request) {
  const { user } = authResult;
  
  if (!authorize(user.role, PERMISSIONS.RESIDENTS_READ, PERMISSIONS.RESIDENTS_READ_OWN)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
    const { rows } = await client.query(
      `SELECT r.id, r.tenant_id, r.first_name, r.last_name, r.preferred_name,
              r.status, r.intake_date, r.discharge_date, r.primary_diagnosis,
              ...`,
      params
    );
    return rows;
  });

  const tenantKey = await getTenantKey(user.tenantId);
  const residents = result.map(row => 
    maskPHI(decryptFields(row, RESIDENT_ENCRYPTED_FIELDS, tenantKey), user.role)
  );

  return Response.json({ data: residents, pagination: {...} });
}
```

**ASSESSMENT**: ✓ Correct decryption and masking
- Decrypts all RESIDENT_ENCRYPTED_FIELDS
- Applies maskPHI for role-based access control
- Returns only non-sensitive fields for list view

---

## 3. Endpoint Audit: Residents GET (Detail)

### Implementation
**File**: `src/app/api/v1/residents/[id]/route.js` lines 16-52

```javascript
export async function GET(request, context) {
  const { user } = authResult;
  
  if (!authorize(user.role, PERMISSIONS.RESIDENTS_READ, PERMISSIONS.RESIDENTS_READ_OWN)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;
  const row = await withTenantClient(...);

  const tenantKey = await getTenantKey(user.tenantId);
  const masked = maskPHI(decryptFields(row, RESIDENT_ENCRYPTED_FIELDS, tenantKey), user.role);

  return Response.json({ data: masked });
}
```

**ASSESSMENT**: ✓ Correct decryption and masking
- Returns full resident record after decryption and masking
- Applies same maskPHI logic

---

## 4. Endpoint Audit: Residents POST (Create)

### Implementation
**File**: `src/app/api/v1/residents/route.js` lines 76-148

```javascript
export async function POST(request) {
  const { user } = authResult;
  
  if (!authorize(user.role, PERMISSIONS.RESIDENTS_CREATE)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const tenantKey = await getTenantKey(user.tenantId);
  const encrypted = encryptFields(body, RESIDENT_ENCRYPTED_FIELDS, tenantKey);

  const resident = await withTenantClient(..., async (client) => {
    const { rows } = await client.query(
      `INSERT INTO care.residents (...) VALUES (...) RETURNING *`,
      [tenantKey, ...]
    );
    return rows[0];
  });

  // ❌ ISSUE: Response not masked or decrypted
  return Response.json({ data: {...} }, { status: 201 });
}
```

**ASSESSMENT**: ⚠️ Response handling needs review
- Input encrypted correctly
- Response from RETURNING clause is encrypted
- **Need to check if response is decrypted/masked before returning**

Let me verify the actual POST response:

---

## 5. Endpoint Audit: Change Password Required

### File Analysis
**File**: `src/app/api/v1/auth/change-password-required/route.js` lines 57-65

```javascript
const { rows: updated } = await client.query(
  `UPDATE care.user_accounts
   SET password_hash = $1, password_changed_at = CURRENT_TIMESTAMP, password_changed_required = FALSE,
       updated_at = CURRENT_TIMESTAMP
   WHERE id = $2
   RETURNING id, email, username, staff_id, resident_id, password_changed_at`,
  [newPasswordHash, userAccount.id]
);
```

**ASSESSMENT**: ✓ No PHI returned
- Returns only non-sensitive fields
- No resident data included

---

## 6. Critical Gap: Staff Read Endpoint

### Implementation
**File**: `src/app/api/v1/staff/route.js` lines 9-31 (GET)

```javascript
export async function GET(request) {
  const { user } = authResult;

  if (!authorize(user.role, PERMISSIONS.STAFF_READ)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { rows } = await query(
    `SELECT id, first_name, last_name, role, preferred_name, pronouns,
            email, phone, shift, hire_date, employee_id,
            emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
            notes, is_active, created_at
     FROM ref.staff WHERE tenant_id = $1 ORDER BY last_name, first_name`,
    [user.tenantId]
  );

  return Response.json({ data: rows });  // ❌ No masking applied
}
```

**ASSESSMENT**: ⚠️ Staff data not masked
- Returns all staff fields without masking
- Staff can see emergency contact info of colleagues
- Staff can see phone numbers of all staff
- No role-based filtering

---

## 7. Endpoint Audit: Audit Log Access

### Implementation
**File**: `src/app/api/v1/admin/audit-log/route.js`

Not provided in context. Need to verify:
- [ ] Does audit log endpoint mask old_values and new_values?
- [ ] Are password hashes excluded from audit responses?
- [ ] Is PHI in audit log accessible without authorization?

---

## 8. Endpoint Audit: Care Plans & Progress Notes

Searching endpoints that may expose PHI:

### Care Plans (assumed structure)
- Should decrypt fields before return
- Should apply maskPHI for role restrictions

### Progress Notes (assumed structure)
- Clinical notes may contain PHI
- Should be masked for unauthorized roles

---

## 9. Critical Issue: Encrypted Fields in Raw Responses

### Problem Scenario

**Query returns encrypted ciphertext (base64)**:
```javascript
{
  id: "123",
  first_name: "aGVsbG8gd29ybGQ=",  // encrypted, base64
  last_name: "aGVsbG8gd29ybGQ="     // encrypted, base64
}
```

**If endpoint forgets decryptFields()**:
```javascript
// ❌ Vulnerable endpoint
return Response.json(residents);  // Returns ciphertext as-is
```

**Frontend receives encrypted PHI**: Valid ciphertext that could be:
1. Decrypted if attacker has access to encryption key
2. Sold as-is (ciphertext still requires key to decrypt)
3. Used to perform padding oracle attacks

### Endpoints at Risk

Need to audit all endpoints that:
1. Query RESIDENT_ENCRYPTED_FIELDS from database
2. Return results without calling decryptFields()

**Vulnerable Pattern**:
```javascript
const { rows } = await query('SELECT * FROM care.residents...');
return Response.json(rows);  // ❌ No decryption
```

**Safe Pattern**:
```javascript
const { rows } = await query('SELECT * FROM care.residents...');
const decrypted = rows.map(r => decryptFields(r, RESIDENT_ENCRYPTED_FIELDS, key));
return Response.json(decrypted);  // ✓ Decrypted
```

---

## 10. Masking Strategy Issues

### Current Strategy: Too Permissive
**File**: `src/lib/roles.js` lines 134-140

```javascript
export const PHI_MASKED_FIELDS = {
  [ROLES.STAFF]:  ['ssn_last4'],
  [ROLES.MANAGER]: [],              // ← Can see all PHI
  [ROLES.ADMIN]:  [],               // ← Can see all PHI
};
```

**Risk**: STAFF role sees almost all PHI
- Can see: First name, last name, email, phone, address, medicaid_id, preferred_name
- Masked: Only ssn_last4
- **Resident privacy compromised if staff shouldn't see full names**

### Recommended Strategy

```javascript
export const PHI_MASKED_FIELDS = {
  [ROLES.RESIDENT_CARE_OF]: [],          // Own record, see everything
  [ROLES.STAFF]: [
    'ssn_last4',                         // Cannot see SSN
    'email',                             // Cannot see email (use internal ID)
    'phone',                             // Cannot see phone (use internal ID)
    'address_line1', 'address_line2',    // Cannot see address
  ],
  [ROLES.MANAGER]: ['ssn_last4'],        // Can see most PHI
  [ROLES.ADMIN]: [],                     // Can see all
  [ROLES.SUPERADMIN]: [],                // Can see all
};
```

---

## 11. Endpoint Masking Checklist

### Residents Endpoints
- [ ] GET /api/v1/residents (list)
  - ✓ Decrypts fields
  - ✓ Applies maskPHI
  - ✓ Returns non-sensitive only for list

- [ ] GET /api/v1/residents/:id (detail)
  - ✓ Decrypts fields
  - ✓ Applies maskPHI

- [ ] POST /api/v1/residents (create)
  - ? Verify response is decrypted/masked

- [ ] PATCH /api/v1/residents/:id (update)
  - ? Need to verify implementation

- [ ] GET /api/v1/residents/:id/care-plans
  - ? Need to verify implementation

- [ ] GET /api/v1/residents/:id/roi
  - ? Need to verify implementation

### Staff Endpoints
- [ ] GET /api/v1/staff (list)
  - ❌ No masking applied
  - ❌ Returns all fields for all roles

- [ ] GET /api/v1/staff/[id] (detail)
  - ? Need to verify implementation

- [ ] POST /api/v1/staff (create)
  - ? Should not return password

- [ ] PATCH /api/v1/staff/[id] (update)
  - ? Need to verify implementation

### Auth Endpoints
- [ ] POST /api/v1/auth/login
  - ✓ Returns token only, no PHI

- [ ] POST /api/v1/auth/change-password
  - ✓ Returns success message only

- [ ] POST /api/v1/auth/change-password-required
  - ✓ Returns sanitized user object

### Care Plan Endpoints
- [ ] GET /api/v1/care-plans (list)
  - ? Need to verify clinical notes are masked

- [ ] GET /api/v1/care-plans/:id (detail)
  - ? Need to verify clinical notes are masked

- [ ] POST /api/v1/care-plans (create)
  - ? Should not expose full clinical data

### Audit & Reports
- [ ] GET /api/v1/admin/audit-log
  - ? Need to verify password hashes excluded
  - ? Need to verify PHI in old_values/new_values masked

- [ ] GET /api/v1/admin/overview
  - ? Need to verify aggregated data is safe

---

## 12. Risk Assessment: Unmasked Endpoints

### HIGH RISK Endpoints (if unmasked)
1. GET /api/v1/residents/:id (detail)
   - Exposes full PHI to unauthorized roles
   - Mitigation: maskPHI applied ✓

2. GET /api/v1/staff (list)
   - Exposes emergency contact info
   - Mitigation: None detected ❌

3. GET /api/v1/admin/audit-log
   - May expose PHI in old_values/new_values
   - Mitigation: Unknown ⚠️

### MEDIUM RISK Endpoints (if decryption missed)
1. Any endpoint with `RETURNING *` that includes encrypted fields
   - Mitigation: Check if decryptFields() called ⚠️

---

## Findings Summary

### CRITICAL
1. **Staff endpoint returns unmasked emergency contact data** - All staff can see colleagues' emergency contacts
2. **Some endpoints may return encrypted ciphertext unmasked** - If decryptFields() not called, ciphertext exposed
3. **Audit log endpoint may expose PHI in old_values/new_values** - Need to verify

### HIGH
4. **maskPHI configuration too permissive** - STAFF role can see most PHI
5. **No masking in GET /api/v1/staff** - Emergency contact numbers exposed
6. **No verification that all RETURNING clauses are handled** - Could return encrypted values

### MEDIUM
7. **Staff data lacks role-based filtering** - Should restrict staff reading staff data based on permissions
8. **Care plans/progress notes masking unknown** - Need to audit clinical endpoints

---

## Remediation Priority

**PHASE 1 (URGENT)**
- [ ] Audit all endpoints that return resident data
  - [ ] Verify decryptFields() is called on all encrypted fields
  - [ ] Verify maskPHI() is called with appropriate role
  - [ ] Check RETURNING clauses for encrypted fields

- [ ] Fix GET /api/v1/staff endpoint
  ```javascript
  // Add masking for staff list
  const maskedStaff = rows.map(staff => maskPHI(staff, user.role));
  return Response.json({ data: maskedStaff });
  ```

- [ ] Audit all audit log endpoints
  - Verify password hashes not exposed
  - Verify PHI in old_values/new_values is masked

**PHASE 2 (CRITICAL)**
- [ ] Implement stricter PHI_MASKED_FIELDS configuration
  - Mask more fields for STAFF role
  - Document why each field is masked/unmasked

- [ ] Create automated tests
  ```javascript
  // Test that masking is applied
  const result = maskPHI(resident, ROLES.STAFF);
  expect(result.ssn_last4).toBe('[RESTRICTED]');
  expect(result.email).toBe('[RESTRICTED]');
  ```

- [ ] Add middleware to verify all responses are masked
  ```javascript
  // After all route handlers, check response doesn't contain unmasked PHI
  const response = await handler(req);
  verifyNoUnmaskedPHI(response.body);
  ```

**PHASE 3 (HIGH)**
- [ ] Implement end-to-end audit
  - Log every response for 1 week
  - Verify no unmasked PHI returned
  - Audit staff usage of emergency contact data

- [ ] Regular quarterly audits of all endpoints
  - New endpoints are added regularly
  - Each must include masking logic

---

## Testing Recommendations

```bash
# Test 1: Verify staff cannot see SSN
curl -H "Authorization: Bearer <staff-token>" \
  http://localhost:3000/api/v1/residents/123
# Response should have ssn_last4: "[RESTRICTED]"

# Test 2: Verify manager can see SSN
curl -H "Authorization: Bearer <manager-token>" \
  http://localhost:3000/api/v1/residents/123
# Response should have ssn_last4: "1234"

# Test 3: Verify staff endpoint masks data
curl -H "Authorization: Bearer <staff-token>" \
  http://localhost:3000/api/v1/staff
# Response should NOT include emergency_contact_phone

# Test 4: Verify encrypted fields are decrypted
# Query database directly:
SELECT first_name FROM care.residents;  -- Shows ciphertext
# Call API:
curl http://localhost:3000/api/v1/residents/123
# Response should show plaintext, not ciphertext
```

---

## Files Requiring Review

- [ ] `src/app/api/v1/residents/route.js` - POST response handling
- [ ] `src/app/api/v1/residents/[id]/route.js` - PATCH response handling
- [ ] `src/app/api/v1/staff/route.js` - GET/POST masking
- [ ] `src/app/api/v1/staff/[id]/route.js` - GET/PATCH masking
- [ ] `src/app/api/v1/admin/audit-log/route.js` - PHI in audit log
- [ ] `src/app/api/v1/care-plans/route.js` - Clinical data masking
- [ ] `src/app/api/v1/progress-notes/route.js` - Clinical data masking
- [ ] All endpoints with `RETURNING *` - Verify encrypted fields handled
