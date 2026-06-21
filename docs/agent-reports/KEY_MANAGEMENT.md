# DCLLC Encryption Key Management System

**Document Version**: 1.0  
**Date**: 2026-05-18  
**Status**: PRODUCTION READY  
**HIPAA Compliance**: 45 CFR § 164.308(a)(3)(i) - Access Controls

---

## Overview

This document describes the production-grade encryption key management system for DCLLC healthcare application. All Protected Health Information (PHI) is encrypted using AES-256-GCM with cryptographically secure key derivation and multi-tenant isolation.

**Key Features**:
- Support for 3 production key management strategies (AWS KMS, HashiCorp Vault, local file)
- Per-tenant key isolation
- Automatic key caching with configurable TTL
- Stateless token refresh (no re-encryption of historical data)
- Comprehensive audit logging of all key operations
- Emergency key rotation procedures
- HIPAA & FIPS 140-2 compliance

---

## Architecture

### Key Resolution Flow

```
getTenantEncryptionKey(tenantId)
  ↓
  Check cache (1 hour TTL)
  ↓
  [If not cached]
  Strategy Selection:
    1. AWS KMS (recommended)
    2. HashiCorp Vault
    3. Local file
    4. Environment variable (dev)
  ↓
  Validate key format (64 hex chars)
  ↓
  Cache in memory
  ↓
  Return to caller
```

### Encryption/Decryption Path

```
API Request (withTenantClient)
  ↓
  getTenantEncryptionKey(user.tenantId)
  ↓
  [for SELECT] decryptFields(dbRow, RESIDENT_ENCRYPTED_FIELDS, key)
  [for INSERT] encryptFields(body, RESIDENT_ENCRYPTED_FIELDS, key)
  ↓
  audit.logSelect/Insert(..., { encryptionContext: {...} })
  ↓
  Response.json()
```

---

## Configuration & Deployment

### Development (Local)

**`.env.local`**:
```bash
ENCRYPTION_KEY_STRATEGY=env-var
DEV_TENANT_ENCRYPTION_KEY=dev-only-32-char-key-change-me!!
VALIDATE_ENCRYPTION_KEYS=false
```

**Behavior**:
- Keys generated on-the-fly from environment variable
- No caching of actual key material
- Single key for all tenants (multi-tenant emulated)

### Staging (AWS KMS Recommended)

**`.env.staging`**:
```bash
NODE_ENV=staging
ENCRYPTION_KEY_STRATEGY=aws-kms
AWS_REGION=us-east-1
KMS_RESIDENT_ENCRYPTION_KEY_ID=arn:aws:kms:us-east-1:ACCOUNT_ID:key/KEY_UUID
ENCRYPTION_KEY_CACHE_TTL_MS=3600000
VALIDATE_ENCRYPTION_KEYS=true
```

**Prerequisites**:
- AWS KMS Customer Managed Key created
- IAM role attached to EC2/Lambda with KMS decrypt permissions
- AWS credentials available via IAM role (not env vars)

### Production (AWS KMS + Vault Fallback)

**`.env.production`**:
```bash
NODE_ENV=production
ENCRYPTION_KEY_STRATEGY=aws-kms
AWS_REGION=us-east-1
KMS_RESIDENT_ENCRYPTION_KEY_ID=arn:aws:kms:us-east-1:ACCOUNT_ID:key/KEY_UUID

# Fallback (if KMS unavailable)
VAULT_ADDR=https://vault.internal.example.com:8200
VAULT_TOKEN=${VAULT_TOKEN_PROD}

ENCRYPTION_KEY_CACHE_TTL_MS=3600000
VALIDATE_ENCRYPTION_KEYS=false
```

**Deployment Checklist**:
- [ ] KMS key created and audited
- [ ] IAM role policy reviewed by security team
- [ ] Key rotation policy enabled (annual minimum)
- [ ] Vault fallback tested
- [ ] CloudWatch alarms set for key access failures
- [ ] Encrypt/decrypt round-trip test passed
- [ ] Audit logging verified
- [ ] Disaster recovery documented

---

## Key Management Strategies

### 1. AWS KMS (Recommended)

**Advantages**:
- FIPS 140-2 Level 2 compliant (Hardware Security Module)
- Automatic annual key rotation (configurable)
- CloudTrail audit logging of all key usage
- No key material in application environment
- Multi-region replication support
- Pay-per-use pricing (~$0.06/API call)

**Setup** (AWS Console):

1. Go to AWS KMS → Customer Managed Keys
2. Create Key:
   - Symmetric: Yes
   - Key Usage: Encrypt/Decrypt
   - Alias: `alias/dcllc-resident-encryption`
   - Rotation: Enable automatic (annual)
   - Key Policy: Allow Lambda/EC2 role
3. Note Key ARN: `arn:aws:kms:REGION:ACCOUNT_ID:key/KEY_UUID`

**Costs**:
- Key creation: $1.00/month
- API calls: $0.06 per 10,000 calls
- *Estimate for 100K calls/month: ~$1.60/month*

**IAM Policy** (attach to Lambda/EC2 role):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowKMSDataKeyGeneration",
      "Effect": "Allow",
      "Action": [
        "kms:GenerateDataKey",
        "kms:Decrypt",
        "kms:DescribeKey"
      ],
      "Resource": "arn:aws:kms:REGION:ACCOUNT_ID:key/KEY_UUID"
    }
  ]
}
```

**Cloudformation Example**:
```yaml
EncryptionKey:
  Type: AWS::KMS::Key
  Properties:
    Description: DCLLC Resident PHI Encryption Key
    KeyPolicy:
      Statement:
        - Sid: Enable IAM policies
          Effect: Allow
          Principal:
            AWS: !Sub 'arn:aws:iam::${AWS::AccountId}:root'
          Action: 'kms:*'
          Resource: '*'
        - Sid: Allow Lambda to use key
          Effect: Allow
          Principal:
            AWS: !GetAtt LambdaExecutionRole.Arn
          Action:
            - 'kms:Decrypt'
            - 'kms:GenerateDataKey'
          Resource: '*'
    EnableKeyRotation: true

EncryptionKeyAlias:
  Type: AWS::KMS::Alias
  Properties:
    AliasName: alias/dcllc-resident-encryption
    TargetKeyId: !Ref EncryptionKey
```

### 2. HashiCorp Vault

**Advantages**:
- On-premises option (if AWS not allowed)
- FIPS 140-2 compatible (with HSM backend)
- Dynamic secret generation
- Detailed audit logging
- No vendor lock-in

**Setup** (Vault):

1. Enable KV secret engine:
   ```bash
   vault secrets enable -path=secret kv
   ```

2. Create per-tenant encryption keys:
   ```bash
   vault kv put secret/tenant/tenant-1/encryption-key key=a1b2c3d4...
   vault kv put secret/tenant/tenant-2/encryption-key key=e5f6g7h8...
   ```

3. Create Vault policy:
   ```hcl
   path "secret/tenant/*/encryption-key" {
     capabilities = ["read"]
   }
   ```

4. Set environment variables:
   ```bash
   VAULT_ADDR=https://vault.internal.example.com:8200
   VAULT_TOKEN=s.xxxxxxxxxxxxxxxx
   ```

**Costs**: Self-hosted (no recurring fees, ops overhead)

### 3. Local File (Development/Air-Gapped)

**Advantages**:
- No external dependencies
- Suitable for development/testing
- Useful for air-gapped deployments
- Simple to implement

**Setup**:

1. Create encryption key file:
   ```json
   {
     "tenant-1": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a",
     "tenant-2": "f0e9d8c7b6a5949392919089888786858483828180....",
   }
   ```

2. Set environment variables:
   ```bash
   ENCRYPTION_KEY_STRATEGY=local-file
   ENCRYPTION_KEY_FILE_PATH=/secrets/encryption-keys.json
   ```

3. Secure the file:
   ```bash
   chmod 600 /secrets/encryption-keys.json
   chown app:app /secrets/encryption-keys.json
   ```

**Security Considerations**:
- File must have restrictive permissions (600)
- Must be on encrypted filesystem
- Should not be in version control
- Backup key file securely (WORM storage recommended)

---

## Key Rotation Procedures

### Automatic Rotation (AWS KMS)

AWS KMS automatically creates new key material annually. No application changes required.

**Verification**:
```bash
# AWS Console: KMS → Customer Managed Keys → Select Key → Key Details
# Check "Rotation" section for "Enable key rotation"

# CLI:
aws kms describe-key --key-id arn:aws:kms:REGION:ACCOUNT_ID:key/KEY_UUID
# Look for "KeyRotationEnabled": true
```

**Impact on Existing Data**:
- All previously encrypted data remains encrypted with old key material
- Old key versions always remain available for decryption
- New encryptions use new key material
- **No re-encryption of existing data needed**

### Manual Key Rotation (Emergency)

Perform manual rotation if key compromise is suspected.

**Process**:

1. **Alert Security Team**
   ```bash
   # Log incident
   echo "Encryption key compromise suspected" > /var/log/security.log
   ```

2. **Invalidate Current Key Cache**
   ```bash
   curl -X POST http://localhost:3000/api/v1/admin/encryption/rotate-emergency \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"reason": "Key compromise suspected - manual rotation"}'
   ```

3. **Generate New Key Material** (AWS KMS):
   ```bash
   # Create new customer master key
   aws kms create-key \
     --description "DCLLC Emergency Key Rotation" \
     --region us-east-1

   # Update environment variable
   export KMS_RESIDENT_ENCRYPTION_KEY_ID=arn:aws:kms:us-east-1:ACCOUNT_ID:key/NEW_KEY_UUID

   # Restart application
   systemctl restart dcllc-api
   ```

4. **Re-encrypt Sensitive Data** (Optional, if old key was compromised)
   ```javascript
   // Manual re-encryption job (runs once)
   async function reEncryptAllResidents() {
     const { rows } = await pool.query('SELECT id, tenant_id FROM care.residents');
     
     for (const resident of rows) {
       const oldKey = await getLegacyKey(resident.tenant_id);
       const newKey = await getTenantEncryptionKey(resident.tenant_id);
       
       // Decrypt with old key, re-encrypt with new key
       const { rows: [data] } = await pool.query(
         'SELECT * FROM care.residents WHERE id = $1',
         [resident.id]
       );
       
       const decrypted = decryptFields(data, RESIDENT_ENCRYPTED_FIELDS, oldKey);
       const reEncrypted = encryptFields(decrypted, RESIDENT_ENCRYPTED_FIELDS, newKey);
       
       await pool.query(
         'UPDATE care.residents SET ...',
         [reEncrypted.first_name, reEncrypted.last_name, ...]
       );
     }
   }
   ```

5. **Verify New Key Working**
   ```bash
   # Test encryption/decryption round-trip
   node -e "
     const { validateKeyManagement } = require('./src/lib/key-management.js');
     validateKeyManagement().then(() => console.log('Key validation PASSED'));
   "
   ```

6. **Archive Old Key Material**
   ```bash
   # Store old key material in cold storage (WORM)
   # Example: AWS Glacier, secure USB, HSM backup
   aws s3 cp /tmp/old-key-backup.enc s3://cold-storage-bucket/encryption-keys/key-20260518.enc
   ```

7. **Update Documentation**
   ```markdown
   ## Key Rotation Log
   - **Date**: 2026-05-18
   - **Reason**: Emergency rotation
   - **Old Key ID**: arn:aws:kms:us-east-1:ACCOUNT_ID:key/OLD_UUID
   - **New Key ID**: arn:aws:kms:us-east-1:ACCOUNT_ID:key/NEW_UUID
   - **Re-encryption**: Yes (2M records)
   - **Verification**: PASSED
   - **Status**: COMPLETED
   ```

### Key Rotation Monitoring

**CloudWatch Alarms**:
```yaml
KeyGenerationErrors:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmDescription: Alert if KMS key generation fails
    MetricName: UserErrorCount
    Namespace: AWS/KMS
    Statistic: Sum
    Period: 60
    EvaluationPeriods: 1
    Threshold: 5
    ComparisonOperator: GreaterThanThreshold
    Alarm Actions:
      - !Ref SecurityTeamSNSTopic
```

**Audit Logging**:
```sql
-- Monitor key access patterns
SELECT
  event_type,
  COUNT(*) as count,
  MIN(created_at) as first_access,
  MAX(created_at) as last_access
FROM audit_log.event_log
WHERE encryption_context IS NOT NULL
GROUP BY event_type
ORDER BY last_access DESC;
```

---

## Audit Logging Integration

All encryption operations are logged to `audit_log.event_log` with encryption context.

### Audit Log Schema

```sql
ALTER TABLE audit_log.event_log
ADD COLUMN encryption_context JSONB;

CREATE INDEX idx_event_log_encryption_context 
  ON audit_log.event_log USING GIN (encryption_context);
```

### Encryption Context in Audit Logs

**Example**:
```javascript
// When decrypting resident data
await audit.logSelect({
  tableName: 'care.residents',
  req: { user },
  encryptionContext: {
    strategy: 'aws-kms',
    tenantId: user.tenantId,
    keyId: 'arn:aws:kms:us-east-1:ACCOUNT_ID:key/KEY_UUID',
    encryptedFieldsCount: 9,
    cipherSuite: 'AES-256-GCM',
  }
});
```

**Audit Query**:
```sql
-- Find all PHI decryptions in last 24 hours
SELECT
  actor_id,
  actor_role,
  event_type,
  table_name,
  resident_id,
  encryption_context->>'strategy' as encryption_strategy,
  encryption_context->>'encryptedFieldsCount' as fields_decrypted,
  created_at
FROM audit_log.event_log
WHERE
  created_at > NOW() - INTERVAL '24 hours'
  AND phi_accessed = true
  AND encryption_context IS NOT NULL
ORDER BY created_at DESC;
```

---

## Token Refresh & Stateless Design

**Important**: Token refresh does NOT trigger re-encryption of PHI.

### Why Stateless?

1. **Performance**: No unnecessary decryption/re-encryption
2. **Simplicity**: Token and data encryption are independent
3. **Correctness**: Historical data encrypted with original key remains valid

### Implementation

```javascript
// src/app/api/v1/auth/refresh/route.js
export async function POST(request) {
  const decoded = verifyToken(refreshToken, 'refresh');
  
  // Generate new access token (NO key-based operations)
  const newAccessToken = signAccessToken({
    userId: decoded.sub,
    tenantId: decoded.tenantId,
    role: decoded.role,
    staffId: decoded.staffId,
  });

  // PHI data encryption key remains unchanged
  // No decryption or re-encryption occurs
  
  return Response.json({ accessToken: newAccessToken });
}
```

### Consequences

- Access token expiry (15 minutes) is independent of key rotation
- PHI decryption works with any valid key for the tenant
- Key rotation does not require token refresh
- Tokens never contain encrypted data

---

## HIPAA Compliance Checklist

- [x] **45 CFR § 164.308(a)(3)(i) - Encryption Key Management**
  - Keys stored in secure system (KMS/Vault/encrypted file)
  - Keys never logged or displayed
  - Per-tenant key isolation enforced
  - Automatic key rotation enabled
  - Key destruction procedures documented

- [x] **45 CFR § 164.312(a)(2)(i) - Encryption & Decryption**
  - AES-256-GCM algorithm (NIST-approved)
  - Random IV for each encryption (prevents known-plaintext attacks)
  - Authentication tag validation (detects tampering)
  - All PHI fields encrypted at rest

- [x] **45 CFR § 164.312(b) - Audit Controls**
  - All key generation logged
  - All key access logged
  - All PHI encryption/decryption logged
  - Audit logs retained for 6+ years
  - Audit logs protected from tampering

- [x] **45 CFR § 164.312(c)(2) - Encryption & Decryption**
  - Encryption in transit (HTTPS/TLS)
  - Encryption at rest (AES-256-GCM)
  - Key transmission via secure channels only

---

## Troubleshooting

### "Encryption key unavailable"

**Cause**: Key resolution failed (KMS/Vault/file inaccessible)

**Resolution**:
```bash
# Check configuration
echo $ENCRYPTION_KEY_STRATEGY
echo $KMS_RESIDENT_ENCRYPTION_KEY_ID

# Test KMS access
aws kms describe-key --key-id $KMS_RESIDENT_ENCRYPTION_KEY_ID

# Check CloudWatch logs
aws logs tail /aws/lambda/dcllc-api --follow

# Check Vault status
curl https://vault.internal/v1/sys/health

# Restart application
systemctl restart dcllc-api
```

### "Invalid encryption key format"

**Cause**: Key from resolver doesn't match expected format (64 hex chars)

**Resolution**:
```bash
# Validate key format
echo "a1b2c3d4..." | grep -E '^[a-f0-9]{64}$'

# Run validation test
VALIDATE_ENCRYPTION_KEYS=true node -e "
  require('./src/lib/key-management.js')
    .validateKeyManagement()
"
```

### Cache Issues

**Symptom**: Decryption fails after key rotation

**Cause**: Stale key in memory cache

**Resolution**:
```bash
# Clear cache via admin endpoint
curl -X POST http://localhost:3000/api/v1/admin/encryption/clear-cache \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Or restart application
systemctl restart dcllc-api
```

### Decryption Errors

**"Decryption error — possible key mismatch or tampered data"**

This error occurs when:
1. Wrong key used to decrypt (wrong tenant, rotated key not available)
2. Data was tampered with (GCM auth tag validation failed)
3. Corrupted ciphertext

**Resolution**:
```javascript
// Wrap decryption in try-catch
try {
  const decrypted = decryptFields(row, RESIDENT_ENCRYPTED_FIELDS, key);
} catch (err) {
  logger.error({ err, rowId: row.id }, 'Decryption failed');
  // Report to security team
  await notifySecurityTeam({
    severity: 'CRITICAL',
    issue: 'PHI decryption failure',
    resident_id: row.id,
    tenant_id: user.tenantId,
  });
  return Response.json(
    { error: 'Data integrity error — contact support' },
    { status: 500 }
  );
}
```

---

## Performance Tuning

### Key Cache TTL

**Default**: 1 hour (3600000 ms)

- **Pros**: Reduces external service calls
- **Cons**: Delayed key rotation (up to 1 hour)

**Recommendation**:
- **Development**: 1 hour
- **Staging**: 30 minutes
- **Production**: 1 hour (balance between performance and rotation latency)

```bash
ENCRYPTION_KEY_CACHE_TTL_MS=1800000  # 30 minutes
```

### Batch Operations

For bulk encryption/decryption (e.g., data migrations):

```javascript
// Bad: Fetch key for each record
for (const record of records) {
  const key = await getTenantEncryptionKey(record.tenant_id);  // ❌ Too many calls
  encrypt(record, key);
}

// Good: Cache key across batch
const keyCache = new Map();
for (const record of records) {
  let key = keyCache.get(record.tenant_id);
  if (!key) {
    key = await getTenantEncryptionKey(record.tenant_id);
    keyCache.set(record.tenant_id, key);
  }
  encrypt(record, key);
}
```

### Monitoring

```sql
-- Monitor key resolution performance
SELECT
  DATE_TRUNC('minute', created_at) as minute,
  COUNT(*) as key_resolutions,
  COUNT(DISTINCT tenant_id) as unique_tenants
FROM audit_log.event_log
WHERE event_type = 'KEY_RESOLUTION'
GROUP BY DATE_TRUNC('minute', created_at)
ORDER BY minute DESC;
```

---

## Testing

### Unit Tests

```bash
npm test -- src/__tests__/encryption/key-management.test.js
```

Covers:
- Key resolution (all strategies)
- Encryption/decryption round-trips
- Cache behavior
- Key rotation
- Error handling
- Multi-tenant isolation

### Integration Tests

```bash
npm test -- src/__tests__/encryption/integration.test.js
```

Covers:
- End-to-end PHI encryption flow
- API endpoint encryption/decryption
- Audit logging with encryption context
- Cross-tenant isolation

### Load Testing

```bash
# Simulate 1000 concurrent key resolutions
ab -n 1000 -c 10 http://localhost:3000/api/v1/residents
```

Expected:
- Cache hit rate > 95%
- P95 latency < 50ms
- Key resolution failures < 1%

---

## References

- [NIST SP 800-175B: AES Key Derivation](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-175b.pdf)
- [HIPAA Encryption Requirements](https://www.hhs.gov/hipaa/for-professionals/security/special-topics/encryption/index.html)
- [AWS KMS Best Practices](https://docs.aws.amazon.com/kms/latest/developerguide/best-practices.html)
- [HashiCorp Vault Documentation](https://www.vaultproject.io/docs)

---

## Support

For key management issues:
1. Check troubleshooting section above
2. Review audit logs: `SELECT * FROM audit_log.event_log WHERE encryption_context IS NOT NULL`
3. Contact: security@dependablecarewellness.com
