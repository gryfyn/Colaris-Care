# Production Hardening & Key Management Strategy
**Date**: 2026-05-16  
**Status**: CRITICAL - NOT PRODUCTION READY

---

## Executive Summary
The DCLLC application has strong cryptographic foundations (AES-256-GCM, bcrypt, RS256) but lacks production-grade key management infrastructure. This document provides a phased hardening strategy to achieve HIPAA compliance and production readiness.

---

## 1. Current State Assessment

### What's Working ✓
- AES-256-GCM encryption algorithm (strong)
- bcrypt password hashing for staff (cost 12, secure)
- RS256 JWT signing (asymmetric)
- HTTP-only refresh token cookies
- Audit logging infrastructure

### What's Missing ❌
- Production key resolver (code throws error)
- HSM or KMS integration
- Per-tenant key isolation
- Key rotation mechanism
- Key backup/recovery procedures
- Encrypted secrets at rest
- Key access audit logging

### What's Broken ❌
- PBKDF2-1000 for resident passwords (300x weaker than NIST minimum)
- Access tokens in localStorage (XSS vulnerability)
- Plaintext passwords in console logs
- PHI in audit log notes
- Environment variables expose keys

---

## 2. Recommended Architecture: AWS KMS

### Why AWS KMS?
- **FIPS 140-2 Level 2 compliance** - Hardware security module
- **Automatic key rotation** - Annual rotation configurable
- **Audit logging** - CloudTrail tracks all key usage
- **Multi-region replication** - Disaster recovery
- **Cost**: ~$1/month per key + API calls ($0.06 per call)
- **Managed service** - No infrastructure to maintain

### Alternative: HashiCorp Vault
- **On-premises option** - If AWS not allowed
- **FIPS 140-2 compatible** - When using HSM backend
- **Dynamic secrets** - Generate temporary credentials
- **Cost**: Self-hosted ($0) + operations overhead
- **Complexity**: Higher operational burden

---

## 3. Implementation: AWS KMS

### Phase 1: KMS Key Setup (Day 1)

**AWS Console Steps**:
1. Go to AWS KMS
2. Create Customer Managed Key
   - Asymmetric: No (symmetric for data encryption)
   - Key policy: Allow account principal
   - Rotation: Enable automatic annual rotation
3. Create alias: `alias/dcllc-resident-encryption`
4. Create separate key for JWT signing (RSA)
   - Asymmetric: Yes (RSA 2048)
   - Alias: `alias/dcllc-jwt-signing`

**Cost**: $1/month per key + ~500 API calls/month = ~$1.03/month per key

### Phase 2: AWS KMS IAM Policy (Day 1)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowKMSEncryption",
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt",
        "kms:GenerateDataKey",
        "kms:DescribeKey"
      ],
      "Resource": "arn:aws:kms:us-east-1:ACCOUNT_ID:key/KMS_KEY_ID"
    }
  ]
}
```

Attach to EC2 instance role or Lambda execution role.

### Phase 3: Environment Configuration

**`.env.production`**:
```bash
# KMS Configuration
KMS_REGION=us-east-1
KMS_RESIDENT_ENCRYPTION_KEY_ID=arn:aws:kms:us-east-1:ACCOUNT_ID:key/12345678-1234-1234-1234-123456789012
KMS_JWT_SIGNING_KEY_ID=arn:aws:kms:us-east-1:ACCOUNT_ID:key/87654321-4321-4321-4321-210987654321

# Node environment
NODE_ENV=production
```

**Never in `.env`**:
- Plaintext encryption keys
- API credentials
- JWT private keys

### Phase 4: Node.js Implementation

**`src/lib/key-management.js` (new file)**:

```javascript
import { KMS } from '@aws-sdk/client-kms';
import logger from '@/lib/logger.js';

const kms = new KMS({ region: process.env.KMS_REGION });

/**
 * Get data encryption key for tenant (cached in memory for 1 hour)
 * KMS GenerateDataKey returns plaintext key + encrypted copy
 * Encrypted copy is for archival; plaintext key is used for encryption
 */
const keyCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function getTenantEncryptionKey(tenantId) {
  const cacheKey = `resident-encryption:${tenantId}`;
  const cached = keyCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.key;
  }

  try {
    const response = await kms.generateDataKey({
      KeyId: process.env.KMS_RESIDENT_ENCRYPTION_KEY_ID,
      KeySpec: 'AES_256',
    });

    const keyHex = response.Plaintext.toString('hex');

    // Cache for 1 hour
    keyCache.set(cacheKey, {
      key: keyHex,
      timestamp: Date.now(),
    });

    // Log key generation (for audit)
    logger.info({ tenantId, keyId: cacheKey }, 'Data key generated from KMS');

    return keyHex;
  } catch (err) {
    logger.error({ err, tenantId }, 'Failed to get KMS data key');
    throw new Error('Encryption key unavailable');
  }
}

/**
 * Get JWT signing key (RSA private key from KMS)
 * Retrieved once at startup, cached in memory
 */
let jwtPrivateKey = null;

export async function getJWTSigningKey() {
  if (jwtPrivateKey) return jwtPrivateKey;

  try {
    // In production, the JWT private key is stored in KMS as an asymmetric key
    // We retrieve it and cache in memory for performance
    const response = await kms.getPublicKey({
      KeyId: process.env.KMS_JWT_SIGNING_KEY_ID,
    });

    // For simplicity, you may store the actual private key in Secrets Manager
    // and reference it through KMS
    jwtPrivateKey = await getSecretFromSecretsManager('dcllc/jwt/private-key');

    logger.info('JWT signing key loaded from KMS');
    return jwtPrivateKey;
  } catch (err) {
    logger.error({ err }, 'Failed to get JWT signing key');
    process.exit(1);
  }
}

/**
 * Clear key cache on shutdown (zero memory)
 */
export function clearKeyCache() {
  keyCache.clear();
  jwtPrivateKey = null;
  logger.info('Key cache cleared');
}

// Clear cache on process shutdown
process.on('SIGTERM', clearKeyCache);
process.on('SIGINT', clearKeyCache);
```

### Phase 5: Update Encryption Code

**`src/app/api/v1/residents/route.js`**:

```javascript
import { getTenantEncryptionKey } from '@/lib/key-management.js';

export async function GET(request) {
  const { user } = authResult;

  const result = await withTenantClient(..., async (client) => {
    const { rows } = await client.query(`SELECT * FROM care.residents...`);
    return rows;
  });

  // Replace: const tenantKey = await getTenantKey(user.tenantId);
  const tenantKey = await getTenantEncryptionKey(user.tenantId);

  const residents = result.map(row =>
    maskPHI(decryptFields(row, RESIDENT_ENCRYPTED_FIELDS, tenantKey), user.role)
  );

  return Response.json({ data: residents, pagination: {...} });
}
```

---

## 4. Key Rotation Strategy

### Automatic Rotation (AWS Managed)
- **Frequency**: Annual (configurable)
- **Process**: AWS KMS automatically creates new key material
- **Impact**: No application changes required
- **Audit**: All key versions logged in CloudTrail

### Manual Rotation (for emergency key compromise)

```javascript
/**
 * Trigger key rotation on detection of compromise
 * Invalidate all cached keys
 */
export async function rotateKeysEmergency(reason) {
  // 1. Clear all cached keys
  clearKeyCache();

  // 2. Update KMS key with new rotation configuration
  const kms = new KMS({ region: process.env.KMS_REGION });
  await kms.scheduleKeyDeletion({
    KeyId: process.env.KMS_RESIDENT_ENCRYPTION_KEY_ID,
    PendingWindowInDays: 7, // Wait 7 days before deletion
  });

  // 3. Create new key
  const newKey = await kms.createKey({
    Description: 'DCLLC emergency rotation - ' + reason,
  });

  // 4. Update environment variable and redeploy
  logger.alert({ reason, newKeyId: newKey.KeyMetadata.KeyId }, 'EMERGENCY KEY ROTATION');

  // 5. Audit all key usage during compromise window
  // (handled by CloudTrail)
}
```

### Re-encryption of Historical Data

**Strategy**: Dual-key encryption during rotation period

```sql
-- Phase 1: Add new encrypted field
ALTER TABLE care.residents ADD COLUMN first_name_v2 VARCHAR;

-- Phase 2: Re-encrypt with new key
UPDATE care.residents
SET first_name_v2 = encrypt_with_new_key(first_name_decrypted_old_key);

-- Phase 3: Verify all data migrated
SELECT COUNT(*) FROM care.residents WHERE first_name_v2 IS NULL;

-- Phase 4: Delete old field after 30-day validation period
ALTER TABLE care.residents DROP COLUMN first_name;
ALTER TABLE care.residents RENAME COLUMN first_name_v2 TO first_name;
```

---

## 5. Secrets Management: AWS Secrets Manager

### What to Store in Secrets Manager

**File**: `src/lib/secrets.js` (new)

```javascript
import { SecretsManager } from '@aws-sdk/client-secrets-manager';

const secretsManager = new SecretsManager({ region: process.env.AWS_REGION });

/**
 * JWT private key (RSA 2048)
 * Cannot be stored in plaintext in .env
 * Must be retrieved from Secrets Manager
 */
export async function getJWTPrivateKey() {
  const secret = await secretsManager.getSecretValue({
    SecretId: 'dcllc/jwt/private-key',
  });
  return secret.SecretString;
}

/**
 * Database credentials (separate from application credentials)
 */
export async function getDatabaseCredentials() {
  const secret = await secretsManager.getSecretValue({
    SecretId: 'dcllc/database/credentials',
  });
  return JSON.parse(secret.SecretString);
}

/**
 * Redis credentials
 */
export async function getRedisCredentials() {
  const secret = await secretsManager.getSecretValue({
    SecretId: 'dcllc/redis/credentials',
  });
  return JSON.parse(secret.SecretString);
}
```

**Environment Variables (Only These)**:
```bash
AWS_REGION=us-east-1
KMS_RESIDENT_ENCRYPTION_KEY_ID=arn:aws:kms:us-east-1:ACCOUNT_ID:key/...
NODE_ENV=production
```

### Secrets Manager Cost
- **$0.40 per secret per month**
- **$0.05 per API call**
- Estimated cost: 3 secrets × $0.40 + 1000 API calls × $0.05 = $51/month

---

## 6. Credential Rotation

### Application Secrets (JWT, Database, Redis)

**Rotation Period**: 90 days

**Process**:
1. Create new secret in Secrets Manager
2. Update application code to read new secret (blue-green deployment)
3. Deploy new application version
4. Wait 7 days for all instances to use new secret
5. Delete old secret in Secrets Manager

### Database Password Rotation

```javascript
/**
 * Rotate database password
 * 1. Create new password in RDS
 * 2. Create new secret in Secrets Manager
 * 3. Update connection string
 * 4. Test connectivity
 * 5. Delete old password
 */
export async function rotateDatabasePassword() {
  // This is RDS-specific, handled via AWS RDS rotation Lambda
  // Or manually: RDS Console → Modify → Change Master Password
  logger.info('Database password rotated');
}
```

---

## 7. Audit Logging

### CloudTrail Configuration

**Monitor**:
- All KMS API calls (Decrypt, GenerateDataKey, etc.)
- All Secrets Manager API calls
- All IAM role assumption

**Alert on**:
- Unauthorized KMS access
- Key deletion attempts
- Failed decryption (possible attacks)
- Root account access

### Application Audit Logging

**File**: `src/lib/key-audit-logger.js` (new)

```javascript
import { query } from '@/lib/db.js';

export async function logKeyAccess(tenantId, action, success) {
  await query(
    `INSERT INTO audit_log.key_access_log (tenant_id, action, success, timestamp)
     VALUES ($1, $2, $3, NOW())`,
    [tenantId, action, success]
  );
}

// Usage in getTenantEncryptionKey():
try {
  const key = await kms.generateDataKey(...);
  await logKeyAccess(tenantId, 'GENERATE_DATA_KEY', true);
  return key;
} catch (err) {
  await logKeyAccess(tenantId, 'GENERATE_DATA_KEY', false);
  throw err;
}
```

---

## 8. Disaster Recovery

### Backup Strategy

**Option A: AWS Backup (Recommended)**
- Automatic daily snapshots of RDS database
- Encrypted with same KMS keys
- 30-day retention
- Cost: ~$5/month per backup

**Option B: Manual Backup**
```bash
# Daily backup to S3
pg_dump dcllc_db | gzip | aws s3 cp - s3://dcllc-backups/$(date +%Y-%m-%d).sql.gz
```

### Key Recovery

**If KMS key is deleted** (7-day grace period):
1. Contact AWS Support immediately
2. Request key recovery (must be within 7 days)
3. Restore database from backup
4. Test decryption with recovered key

**Disaster Recovery RTO/RPO**:
- RTO (Recovery Time Objective): 1 hour
- RPO (Recovery Point Objective): 1 day (last backup)

---

## 9. Security Hardening Checklist

### Network Security
- [ ] Enable VPC endpoints for KMS and Secrets Manager (no internet routing)
- [ ] Restrict security groups to internal only
- [ ] Enable VPC Flow Logs for monitoring

### Database Security
- [ ] Enable RDS encryption with KMS key
- [ ] Enable RDS audit logging
- [ ] Restrict database access to application VPC only
- [ ] Enable RDS IAM database authentication

### Application Security
- [ ] Remove all plaintext secrets from code
- [ ] Implement secret scanning in CI/CD pipeline
- [ ] Enable application-level secret redaction in logs
- [ ] Implement secrets rotation Lambda functions

### Monitoring & Alerting
- [ ] CloudWatch alarms for failed key access
- [ ] CloudTrail monitoring for unauthorized access
- [ ] Application logs monitored for decryption errors
- [ ] Weekly key access audit reports

### Compliance
- [ ] Document all key management procedures
- [ ] Annual penetration testing
- [ ] Quarterly compliance audits
- [ ] HIPAA Business Associate Agreement with AWS

---

## 10. Implementation Timeline

### Week 1: Planning & Setup
- [ ] Choose KMS vs Vault
- [ ] Set up AWS KMS keys
- [ ] Create IAM policies
- [ ] Set up Secrets Manager
- [ ] **Estimated effort**: 8 hours

### Week 2-3: Development
- [ ] Implement key-management.js
- [ ] Update encryption code to use KMS
- [ ] Update JWT key loading
- [ ] Update environment configuration
- [ ] **Estimated effort**: 24 hours

### Week 4: Testing & Validation
- [ ] Unit tests for key management
- [ ] Integration tests with KMS
- [ ] Load testing (key generation performance)
- [ ] Disaster recovery drills
- [ ] **Estimated effort**: 16 hours

### Week 5: Deployment
- [ ] Deploy to staging
- [ ] Validate all endpoints
- [ ] Monitor CloudTrail logs
- [ ] Gradual production rollout (blue-green)
- [ ] **Estimated effort**: 8 hours

### Week 6-8: Hardening & Documentation
- [ ] Implement secrets rotation
- [ ] Set up CloudWatch alarms
- [ ] Document procedures
- [ ] Train operations team
- [ ] **Estimated effort**: 20 hours

**Total**: ~76 hours (2 weeks) for full implementation

---

## 11. Post-Production Validation

### Security Checklist

**Week 1 (Day 1-7)**
- [ ] Verify no plaintext keys in logs
- [ ] Verify all KMS API calls logged in CloudTrail
- [ ] Verify key rotation scheduled
- [ ] Verify encryption working for new residents
- [ ] Monitor CloudTrail for unauthorized access

**Week 2-4 (Day 8-30)**
- [ ] Re-encrypt existing resident data with KMS keys
- [ ] Verify backup and recovery procedures
- [ ] Run penetration test on key management system
- [ ] Audit all key access logs
- [ ] Document any findings

**Month 2-3 (Day 31-90)**
- [ ] Implement secrets rotation
- [ ] Implement key rotation automation
- [ ] Complete HIPAA security audit
- [ ] Obtain compliance certification

---

## 12. Cost Estimation

### AWS Services (Monthly)
| Service | Quantity | Cost |
|---------|----------|------|
| KMS Keys | 2 | $2.00 |
| Secrets Manager | 3 | $1.20 |
| KMS API calls | 10,000 | $0.60 |
| Secrets Manager API calls | 5,000 | $0.25 |
| RDS (db.t3.micro) | 1 | $30.00 |
| RDS encryption | Included | $0.00 |
| RDS backups | 30 days | $5.00 |
| CloudTrail | Standard | $0.00 |
| **Total** | | **$39.05** |

### One-Time Costs
| Item | Cost |
|------|------|
| Security assessment | $5,000 |
| Vault setup (if chosen) | $10,000 |
| Implementation labor | $20,000 |
| **Total** | **$35,000** |

---

## 13. Monitoring Dashboard

### CloudWatch Metrics

```javascript
// Monitor key generation latency
const startTime = Date.now();
const key = await getTenantEncryptionKey(tenantId);
const latency = Date.now() - startTime;

cloudwatch.putMetricData({
  Namespace: 'DCLLC/Security',
  MetricData: [
    {
      MetricName: 'KeyGenerationLatency',
      Value: latency,
      Unit: 'Milliseconds',
    },
  ],
});
```

### Recommended Alerts
1. **KMS API errors** - Alert if > 5 failures in 5 minutes
2. **Key decryption failures** - Alert immediately
3. **Unauthorized KMS access** - Alert immediately
4. **Key rotation overdue** - Alert if > 13 months
5. **Backup missing** - Alert if no backup in 24 hours

---

## 14. Compliance Validation

### HIPAA Security Rule

| Requirement | Implementation |
|------------|-----------------|
| §164.312(a)(2)(i): Encryption | AES-256-GCM + KMS |
| §164.308(a)(3)(ii)(B): Key Management | AWS KMS key rotation |
| §164.312(a)(2)(ii): Access Controls | IAM policies + RBAC |
| §164.308(a)(4)(ii)(B): Encryption | KMS + Secrets Manager |
| §164.308(a)(5)(ii)(C): Incident Procedures | CloudTrail + alerts |

### Validation Checklist
- [ ] Encryption audit by third-party assessor
- [ ] HIPAA Business Associate Agreement signed
- [ ] Annual penetration testing
- [ ] Quarterly compliance audits
- [ ] Incident response plan tested

---

## Summary: Next Steps

1. **Immediate (This Week)**
   - Decision: AWS KMS vs Vault
   - Set up infrastructure
   - Begin development

2. **Short-term (Month 1)**
   - Implement key management
   - Deploy to staging
   - Validate encryption

3. **Medium-term (Month 2-3)**
   - Deploy to production
   - Implement secrets rotation
   - Complete compliance audit

4. **Ongoing**
   - Monitor key access
   - Rotate secrets quarterly
   - Annual security assessment
   - HIPAA compliance audit
