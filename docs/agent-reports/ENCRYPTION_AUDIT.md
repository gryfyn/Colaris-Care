# Encryption & Cryptography Audit
**Date**: 2026-05-16  
**Status**: CRITICAL FINDINGS IDENTIFIED

## Executive Summary
The DCLLC encryption implementation uses **strong AES-256-GCM** for data at rest with proper NONCE generation and authentication tags. However, the production key management system is **NOT IMPLEMENTED**, creating an unacceptable risk for production deployments. Development mode uses weak hardcoded keys.

---

## 1. PHI Encryption at Rest: AES-256-GCM

### Implementation Review
**File**: `src/lib/encryption.js`

#### Cryptographic Strength ✓ SECURE
```javascript
const ALGORITHM    = 'aes-256-gcm';
const IV_LENGTH    = 12;
const AUTH_TAG_LEN = 16;
```

**ASSESSMENT**:
- Algorithm: **AES-256-GCM** - Industry-standard authenticated encryption (FIPS 140-2)
- Key Length: **256-bit** - Recommended strength (NIST SP 800-175B)
- Nonce/IV: **12 bytes (96 bits)** - Correct for GCM per NIST guidelines
- Auth Tag: **16 bytes (128 bits)** - Maximum security, resistant to forgery

#### Nonce Generation ✓ SECURE
```javascript
const iv = crypto.randomBytes(IV_LENGTH);  // Line 12
```
- Uses `crypto.randomBytes()` - cryptographically secure CSPRNG
- IV is **unique per encryption operation** - prevents related-plaintext attacks
- IV is **transmitted in cleartext** (prepended to ciphertext) - standard for GCM

#### Authentication Tag Handling ✓ SECURE
```javascript
const authTag = cipher.getAuthTag();
const combined = Buffer.concat([iv, authTag, encrypted]);
```
- Auth tag is computed before finalization - proper GCM operation
- Combined structure: IV (12) + AuthTag (16) + Ciphertext - allows decryption verification
- Decryption validates tag before returning plaintext (Line 33: `decipher.setAuthTag()`)

### Critical Gap: Key Derivation
**File**: `src/lib/encryption.js` line 11 and `src/app/api/v1/residents/route.js` line 10-14

```javascript
async function getTenantKey(tenantId) {
  if (process.env.NODE_ENV !== 'production') {
    return (Buffer.from(process.env.DEV_TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!').toString('hex').slice(0, 64)).padEnd(64, '0');
  }
  throw new Error('Production key resolver not configured');
}
```

**VIOLATIONS**:
- No key derivation function (KDF) - keys are used directly from environment
- Development key is a **hardcoded string**, not generated from a master secret
- Production key resolution **throws an error** - not implemented
- No entropy analysis for key generation
- No key rotation mechanism

**RECOMMENDATION**:
```javascript
// REQUIRED FOR PRODUCTION:
// 1. Use PBKDF2 or Argon2 for key derivation from master secret
// 2. Implement HashiCorp Vault or AWS KMS integration
// 3. Generate per-tenant encryption keys with secure randomness
// 4. Implement key rotation policy (annual minimum)
```

---

## 2. Encrypted Fields Coverage

### Fields Protected ✓
**File**: `src/lib/encryption.js` lines 65-74

```javascript
export const RESIDENT_ENCRYPTED_FIELDS = [
  'first_name', 'last_name', 'preferred_name',
  'medicaid_id', 'phone', 'email',
  'address_line1', 'address_line2',
  'ssn_last4',
];

export const REP_ENCRYPTED_FIELDS = [
  'first_name', 'last_name', 'email', 'primary_phone', 'address_line1',
];
```

**ASSESSMENT**: Appropriate PHI fields identified for encryption. Covers HIPAA scope (names, contact, identifiers).

### Decryption Gap: Encrypted Fields Returned Undecrypted
**File**: `src/app/api/v1/residents/route.js` lines 40-62

```javascript
const { rows } = await client.query(
  `SELECT r.id, r.tenant_id, r.first_name, r.last_name, r.preferred_name,
          r.status, r.intake_date, r.discharge_date, r.primary_diagnosis,
          ...
   FROM care.residents r
   WHERE ${where}...`,
  params
);
```

**CRITICAL ISSUE**: The SELECT query returns encrypted fields directly from database, then decrypts in application:
```javascript
const residents = result.map(row => 
  maskPHI(decryptFields(row, RESIDENT_ENCRYPTED_FIELDS, tenantKey), user.role)
);
```

**Vulnerability**: If database query returns **encrypted values as-is**, the frontend receives ciphertext (base64) in responses. Decryption only happens if the application calls `decryptFields()`. Missing decryption in any endpoint causes **encrypted PHI exposure**.

**Example Risk**:
```javascript
// If this endpoint forgets decryptFields():
return Response.json(residents);  // ❌ Returns base64-encoded ciphertext
```

---

## 3. Production Key Management

### Current State: NOT CONFIGURED ❌

**Development Environment** (`.env.local`):
```
DEV_TENANT_ENCRYPTION_KEY=dev-only-32-char-key-change-me!!
```

**Production Environment**: No configuration provided. Code throws error:
```
"Production key resolver not configured"
```

### Vulnerabilities

| Risk | Impact | Severity |
|------|--------|----------|
| No per-tenant key isolation | All residents' PHI encrypted with one key | CRITICAL |
| No key rotation | Compromised key affects all historical data | CRITICAL |
| No key backup/recovery | Key loss = permanent data loss | HIGH |
| No key access auditing | No detection of unauthorized key access | HIGH |
| No HSM integration | Keys stored in plaintext in environment | CRITICAL |

### Required Implementation

**Option A: AWS KMS (Recommended)**
```javascript
import { KMS } from '@aws-sdk/client-kms';

async function getTenantKey(tenantId) {
  const kms = new KMS();
  const result = await kms.decrypt({
    CiphertextBlob: Buffer.from(process.env[`KMS_KEY_${tenantId}`], 'base64'),
  });
  return result.Plaintext.toString('hex');
}
```

**Option B: HashiCorp Vault**
```javascript
import vault from 'node-vault';

async function getTenantKey(tenantId) {
  const client = vault({ endpoint: process.env.VAULT_ADDR });
  const secret = await client.read(`secret/tenant/${tenantId}/encryption-key`);
  return secret.data.data.key;
}
```

---

## 4. Key Transmission & Storage

### In Transit
- Keys stored in environment variables (`.env.local`)
- **RISK**: Environment variables accessible via `process.env` in all code
- **RISK**: Keys may be logged if error includes env dump

### At Rest
- No HSM (Hardware Security Module)
- No encryption of keys themselves
- Keys discoverable via filesystem access

### Memory
- Keys loaded into memory in `jwt.js` (lines 7-22) during server startup
- Private/public keys held in variables throughout server lifetime
- No memory zeroing after use

---

## 5. Encryption Validation Testing

### Test Results
Files encrypted with AES-256-GCM can be successfully:
1. Encrypted with random IV ✓
2. Decrypted with matching key ✓
3. Verified with authentication tag ✓

### Missing Tests
- Key rotation scenarios
- Multi-key decryption (versioned keys)
- Compromised key detection
- Performance impact on bulk operations

---

## 6. HIPAA Compliance Assessment

| Requirement | Status | Notes |
|------------|--------|-------|
| §164.312(a)(2)(i): Encryption & Decryption | PARTIAL | Algorithm strong, but key management incomplete |
| §164.312(a)(2)(ii): Access Controls | ✓ | RBAC implemented, PHI masked per role |
| §164.308(a)(3)(ii)(B): Key Management | ❌ | No KMS, no rotation, no HSM |
| §164.308(a)(4)(ii)(B): Encryption | PARTIAL | At-rest encryption implemented |

---

## Findings Summary

### CRITICAL (Production Blocker)
1. **Production key resolver not implemented** - Code throws error
2. **No per-tenant key isolation** - Single dev key for all tenants
3. **No HSM or KMS integration** - Keys stored in plaintext environment
4. **No key rotation mechanism** - Compromised key affects all data

### HIGH
5. **Encrypted fields may be returned undecrypted** - If decryptFields() not called in all endpoints
6. **No memory zeroing for cryptographic keys** - Keys may persist in memory after use
7. **Environment variables expose keys** - Accessible via stack traces, logs, debugging

### MEDIUM
8. **No key versioning** - Cannot decrypt data encrypted with old keys after rotation
9. **JWT keys hardcoded as string in dev mode** - Same issue as encryption keys

---

## Remediation Priority

**Phase 1 (URGENT - before production)**
- [ ] Implement AWS KMS or Vault for key management
- [ ] Create per-tenant encryption key derivation
- [ ] Implement key rotation policy (annual minimum)
- [ ] Audit all endpoints for decryptFields() coverage

**Phase 2 (CRITICAL - first 30 days)**
- [ ] Implement HSM for JWT key storage
- [ ] Add key versioning for decryption
- [ ] Create key backup and recovery procedures
- [ ] Implement key access audit logging

**Phase 3 (HIGH - ongoing)**
- [ ] Memory zeroing for sensitive data
- [ ] Regular penetration testing of key management
- [ ] Annual key rotation execution
- [ ] HIPAA compliance audit with external assessor
