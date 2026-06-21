# Password Hashing & Authentication Audit
**Date**: 2026-05-16  
**Status**: CRITICAL VULNERABILITY - INCONSISTENT HASHING

---

## Executive Summary
The application uses **bcrypt with cost 12** for staff passwords (secure) but **PBKDF2 with only 1000 iterations** for resident portal accounts (dangerously weak). This represents a significant HIPAA violation and creates two-tier security: strong for staff, weak for residents.

---

## 1. Staff Password Hashing: bcrypt ✓ SECURE

### Implementation
**Files using bcrypt (cost 12)**:
- `src/app/api/v1/auth/login/route.js` - line 35: `bcrypt.compare()`
- `src/app/api/v1/auth/change-password/route.js` - line 30: `bcrypt.hash(newPassword, 12)`
- `src/app/api/v1/staff/create/route.js` - line 70: `bcrypt.hash(credentials.password, 12)`
- `src/app/api/v1/staff/route.js` - line 49: `bcrypt.hash(password, 12)`
- `src/app/api/v1/residents/route.js` - line 134: `bcrypt.hash(body.portal_password, 12)`

### Cryptographic Analysis

```javascript
const passwordHash = await bcrypt.hash(credentials.password, 12);
```

**ASSESSMENT**: ✓ Industry best practice

| Parameter | Value | Security |
|-----------|-------|----------|
| Algorithm | bcrypt (Blowfish cipher) | ✓ Designed for password hashing |
| Cost Factor | 12 | ✓ Recommended for 2024 (2^12 = 4096 iterations) |
| Salt | Auto-generated | ✓ 16 bytes, cryptographically random |
| Output | $2b$12$... | ✓ bcrypt hash format |
| Timing | ~250ms per hash | ✓ Intentional slowness prevents brute-force |
| Collision Resistance | None in bcrypt context | ✓ Hashing, not cryptographic fingerprint |

### Bcrypt Cost Factor: Cost 12 Analysis

**Current**: Cost 12 = 2^12 = 4,096 iterations

**Brute-Force Resistance**:
- Desktop GPU (8 GPUs): ~1 million guesses/second
- Time to crack one password: 4,000+ hours
- Time to crack 100 passwords: 166 days (single GPU)

**Moore's Law Impact**:
- In 2029 (5 years): Cost should increase to 13-14 for same protection
- Current cost 12 will provide 2-3x less security in 5 years

**RECOMMENDATION**: Increase to cost 14 by 2027 for long-term security.

---

## 2. CRITICAL: Resident Portal Hashing: PBKDF2 ❌ DANGEROUSLY WEAK

### Implementation
**File**: `src/app/api/v1/residents/create/route.js` lines 82-84

```javascript
const passwordHash = crypto
  .pbkdf2Sync(credentials.password, 'salt', 1000, 64, 'sha512')
  .toString('hex');
```

**File**: `src/app/api/v1/auth/change-password-required/route.js` lines 53-55

```javascript
const newPasswordHash = crypto
  .pbkdf2Sync(newPassword, 'salt', 1000, 64, 'sha512')
  .toString('hex');
```

### Vulnerability Analysis

| Issue | Impact | Severity |
|-------|--------|----------|
| **Hardcoded salt: 'salt'** | Same salt for all residents | CRITICAL |
| **1000 iterations** | 1 million times slower than NIST minimum (310,000) | CRITICAL |
| **Actually weaker than claimed** | 1000 << 310,000 (NIST 2024) | CRITICAL |
| **SHA-512 used but weak config** | Algorithm strong, parameters weak | HIGH |
| **No salt uniqueness per password** | Identical passwords hash identically | CRITICAL |

### Real-World Attack: Dictionary Attack Against Resident Passwords

**Scenario**:
1. Attacker obtains resident user_accounts table: `password_hash` column
2. Attacker builds lookup table for common healthcare passwords:
   ```
   "Password123!" → PBKDF2('Password123!', 'salt', 1000, 64, 'sha512')
   "SecurePass1!" → PBKDF2('SecurePass1!', 'salt', 1000, 64, 'sha512')
   "ResidentID!" → PBKDF2('ResidentID!', 'salt', 1000, 64, 'sha512')
   ```
3. Attacker matches hashes instantly
4. **Entire resident portal compromised**

### Comparison: Bcrypt vs PBKDF2-1000

```
bcrypt cost 12:           ~250ms per attempt (intentional)
PBKDF2 1000 iterations:   ~0.1ms per attempt (10x faster)

To crack 1000 common passwords:
- bcrypt: 250 seconds (4+ minutes)
- PBKDF2-1000: 100 milliseconds (instant)

GPU Attack (RTX 4090):
- bcrypt: Impractical (hardware limitations)
- PBKDF2-1000: 1 million attempts/second
```

### NIST Recommendation

**NIST SP 800-63-3 (2017)** minimum:
- PBKDF2: **at least 310,000 iterations** (SHA-1)
- Updated guidance (draft): **600,000+ iterations** for SHA-256/512

**Current implementation**: 1000 iterations = **0.3% of NIST minimum**

---

## 3. Inconsistent Hashing Strategy

### Gap: Two Different Algorithms for Two User Types

```javascript
// Staff: bcrypt cost 12 (secure) ✓
await bcrypt.hash(staffPassword, 12);

// Residents: PBKDF2 1000 iterations (weak) ❌
crypto.pbkdf2Sync(residentPassword, 'salt', 1000, 64, 'sha512');
```

**Risk**: Attacker focuses on resident passwords (easier target)
- Staff passwords: 4,096 bcrypt iterations
- Resident passwords: 1,000 PBKDF2 iterations
- **Residents (PHI-containing accounts) have 4x weaker protection**

### Why This Happened
Likely different development phases:
- Staff creation: Uses modern bcrypt
- Resident portal (added later): Uses quick PBKDF2 during early development
- No audit to enforce consistency

---

## 4. Password Generation

### Implementation
**File**: `src/lib/credential-generator.js` lines 16-38

```javascript
export function generatePassword(length = 12) {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()-_=+';

  const allChars = uppercase + lowercase + numbers + symbols;

  let password = '';
  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => 0.5 - Math.random()).join('');
}
```

**ASSESSMENT**:
- ✓ Includes uppercase, lowercase, numbers, symbols
- ✓ Length 12 characters (sufficient)
- ⚠️ Uses `Math.random()` for shuffling (not cryptographically secure)
- ⚠️ Fisher-Yates shuffle not implemented (sort-based shuffle has bias)

**Risk**: Shuffle algorithm is weak but passwords are still reasonably strong.

### Recommendation
```javascript
// Use crypto.getRandomValues for password generation
function generatePassword(length = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
}
```

---

## 5. Password Strength Validation

### Staff Passwords
**File**: `src/app/api/v1/auth/change-password/route.js`
- No minimum length validation
- No complexity requirements

### Resident Passwords
**File**: `src/app/api/v1/auth/change-password-required/route.js` lines 29-31

```javascript
if (newPassword.length < 10) {
  return new Response(
    JSON.stringify({ error: 'Password must be at least 10 characters' }),
    { status: 400 }
  );
}
```

**ASSESSMENT**:
- ✓ Minimum 10 characters (reasonable)
- ❌ No uppercase/lowercase/number/symbol requirements
- ❌ No check for common passwords (e.g., "password123")
- ❌ Staff passwords have NO validation

### NIST SP 800-63-3 Recommendations
- Minimum 8 characters (10 is better)
- ✓ Allow long passphrases
- ✓ Check against dictionary of compromised passwords
- ✓ No composition rules (4-char min with symbols) unless required by law

**Current Gap**: No compromised password checking
- Should use HaveIBeenPwned API or local database
- Many healthcare workers use hospital name + numbers

---

## 6. Password Change Flow

### Staff Flow ✓
**File**: `src/app/api/v1/auth/change-password/route.js`
1. Verify current password with bcrypt
2. Hash new password with bcrypt
3. Update database
4. Audit log entry

### Resident Flow: Missing Current Password Verification ❌
**File**: `src/app/api/v1/auth/change-password-required/route.js` lines 49-50

```javascript
// Note: In production, you should verify currentPassword against the hash
// For now, we're assuming authentication middleware verified it
```

**CRITICAL**: Comment indicates incomplete implementation
- Resident doesn't verify old password
- Only checks that they're authenticated
- If session is hijacked, attacker can change password

**Fix Required**:
```javascript
import bcrypt from 'bcryptjs';

// Verify current password before allowing change
const match = await bcrypt.compare(currentPassword, userRows[0].password_hash);
if (!match) {
  return new Response(JSON.stringify({ error: 'Current password is incorrect' }), { status: 401 });
}
```

---

## 7. HIPAA Password Compliance

### Requirement Analysis

**§ 164.312(a)(2)(i)**: "Implement encryption and decryption mechanisms"
- ✓ Hashing used (one-way encryption)
- ⚠️ Resident hashing is too weak

**§ 164.312(f)**: "Implement security measures for workstations and workstation use"
- ❌ No password policy for workstation access
- ❌ No password expiry requirements

**§ 164.312(b)**: "Implement hardware, software, and procedural mechanisms that record and examine access and activity related to information on a HIPAA information system"
- ✓ Audit log logs password changes
- ❌ Failed password attempts not being logged on wrong route

**HITECH § 13402**: "Reasonable efforts to ensure the integrity of any personal health information which is electronically transmitted"
- ⚠️ bcrypt is reasonable for staff
- ❌ PBKDF2-1000 is NOT reasonable for residents

---

## 8. Password Storage in Audit Log

### Issue
**File**: `src/app/api/v1/residents/create/route.js` lines 108-126

```javascript
await client.query(
  `INSERT INTO audit_log.credential_history (
    tenant_id, user_account_id, staff_id, resident_id, credential_type, username, password_hash,
    was_temporary, generated_by, reason, notes, generated_at
  ) VALUES (...)`,
  [
    auth.tenant_id,
    userAccountId,
    auth.staff_id,
    residentId,
    'resident',
    credentials.username,
    passwordHash,  // ⚠️ Storing hash, not plaintext (good)
    true,
    auth.staff_id,
    'Resident portal account creation on admission',
    `Resident: ${first_name} ${last_name}, Diagnosis: ${primary_diagnosis || 'none provided'}`,  // ⚠️ PHI in audit log notes
  ]
);
```

**Assessment**:
- ✓ Password hash stored (not plaintext)
- ❌ PHI (resident diagnosis) stored in audit log notes field
- ❌ No masking of diagnosis in logs

---

## 9. Temporary Credential Exposure

### Console Logging
**File**: `src/app/api/v1/staff/create/route.js` lines 169-183

```javascript
console.log(`   Username:     ${credentials.username}`);
console.log(`   Password:     ${credentials.password}`);  // ❌ PASSWORD IN CONSOLE
console.log(`   Created by: Staff ID ${createdByStaffId}`);
console.log(`   Timestamp: ${new Date().toISOString()}`);
```

**Risk**:
- Console output captured by monitoring systems
- Visible in server logs
- Stored in log aggregation services (CloudWatch, ELK, Datadog)
- Password exposed to anyone with log access

**Fix**: Remove password from logging
```javascript
// Only log that credentials were generated, not the password
console.log(`\nStaff created: ${staffRows[0].first_name} ${staffRows[0].last_name}`);
console.log('Temporary credentials generated and provided via API response only.');
```

### API Response: Credentials Exposed ✓ CORRECT
**File**: `src/app/api/v1/staff/create/route.js` lines 160-165

```javascript
credentials: {
  username: credentials.username,
  password: credentials.password,
  temporary: true,
  mustChangePassword: true,
},
```

This is appropriate - credentials shown only to the admin creating the account. They must securely share with the staff member.

---

## 10. Password Reset: Not Implemented

**Missing**: No mechanism to reset forgotten passwords
- No "Forgot Password" endpoint
- Users locked out if they forget password
- Requires admin intervention (workaround)

**HIPAA Risk**: Users may share passwords to regain access instead of using reset.

---

## Findings Summary

### CRITICAL (Production Blocker)
1. **Resident password hashing: PBKDF2 with only 1000 iterations** - 300x weaker than NIST minimum
2. **Hardcoded salt 'salt' for all residents** - Identical passwords hash identically
3. **No password verification in resident password change** - Session hijacking allows account takeover
4. **Plaintext passwords in console logs** - Exposed to monitoring systems

### HIGH
5. **Inconsistent hashing algorithms** - Staff (bcrypt), residents (PBKDF2) creates two-tier security
6. **No password complexity validation for staff** - Weak passwords accepted
7. **No compromised password checking** - Common healthcare passwords not blocked
8. **No password expiry policy** - Compromised passwords valid indefinitely

### MEDIUM
9. **PHI (diagnosis) logged in credential history** - Audit log contains unmasked PHI
10. **No password reset mechanism** - Users may share passwords instead of resetting
11. **Shuffle algorithm uses Math.random()** - Password generation has weak randomization

---

## Remediation Priority

**PHASE 1 (URGENT - BLOCKING PRODUCTION)**
- [ ] Update ALL resident password hashes to bcrypt cost 12
  ```sql
  -- This requires migration of existing hashes (cannot re-hash hashes)
  -- Option A: Force password reset for all residents on next login
  -- Option B: If original passwords stored somewhere, re-hash with bcrypt
  ```
- [ ] Update password hashing in code:
  ```javascript
  // Both staff and residents use bcrypt cost 12
  const hash = await bcrypt.hash(password, 12);
  ```
- [ ] Remove plaintext passwords from console logs
- [ ] Add password verification to resident change-password route

**PHASE 2 (CRITICAL - First 30 days)**
- [ ] Implement password complexity requirements (for both staff and residents)
- [ ] Add compromised password checking (HaveIBeenPwned API)
- [ ] Implement password reset flow
- [ ] Audit all passwords in credential_history for PHI leakage
- [ ] Remove PHI from audit log notes field

**PHASE 3 (HIGH - Ongoing)**
- [ ] Implement password expiry policy (90 days recommended)
- [ ] Plan to increase bcrypt cost to 14 by 2027
- [ ] Add rate limiting on password change endpoints
- [ ] Implement password history (prevent reuse of last N passwords)
- [ ] Annual security review of password policies

---

## Code Patches

### Critical Patch 1: Uniform Bcrypt Hashing
```javascript
// src/lib/password-hashing.js (new file)
import bcrypt from 'bcryptjs';

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// Remove all crypto.pbkdf2Sync calls
```

### Critical Patch 2: Verify Current Password
```javascript
// src/app/api/v1/auth/change-password-required/route.js
import bcrypt from 'bcryptjs';

// Add password verification
const { rows: userRows } = await client.query(
  `SELECT id, password_hash FROM care.user_accounts WHERE tenant_id = $1 AND staff_id = $2`,
  [auth.tenant_id, auth.staff_id]
);

const match = await bcrypt.compare(currentPassword, userRows[0].password_hash);
if (!match) {
  return new Response(
    JSON.stringify({ error: 'Current password is incorrect' }),
    { status: 401 }
  );
}
```

### Critical Patch 3: Remove Console Logging
```javascript
// src/app/api/v1/staff/create/route.js
// REMOVE all console.log lines containing credentials.username or credentials.password
// KEEP only response body with credentials
```

---

## Testing Recommendations

```bash
# Test 1: Verify bcrypt is used for all password types
npm test -- password-hashing.test.js

# Test 2: Verify password change requires current password
curl -X POST /api/v1/auth/change-password \
  -H "Authorization: Bearer <token>" \
  -d '{"currentPassword": "wrong", "newPassword": "NewPass123!"}'
# Should return 401 Unauthorized

# Test 3: Performance test (should be slow due to bcrypt)
time npm run test:performance -- password-hashing
# bcrypt: ~250ms per hash (expected)
# PBKDF2-1000: ~0.1ms (if found, needs update)
```
