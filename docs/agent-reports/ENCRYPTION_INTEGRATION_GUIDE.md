# Encryption Integration Guide for DCLLC API Routes

**Purpose**: Show how to integrate the new key management system into existing and new API routes.

---

## Quick Start: Using getTenantEncryptionKey in API Routes

### Pattern 1: Decrypt PHI on SELECT

```javascript
import { getTenantEncryptionKey } from '@/lib/key-management.js';
import { decryptFields, RESIDENT_ENCRYPTED_FIELDS } from '@/lib/encryption.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

export async function GET(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    // Get tenant encryption key
    const tenantKey = await getTenantEncryptionKey(user.tenantId);

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows } = await client.query(
        'SELECT * FROM care.residents WHERE id = $1',
        [residentId]
      );
      return rows[0];
    });

    // Decrypt all PHI fields
    const resident = decryptFields(result, RESIDENT_ENCRYPTED_FIELDS, tenantKey);

    // Log with encryption context
    await audit.logSelect({
      tableName: 'care.residents',
      recordId: resident.id,
      residentId: resident.id,
      req: { user },
      encryptionContext: {
        strategy: process.env.ENCRYPTION_KEY_STRATEGY || 'env-var',
        tenantId: user.tenantId,
        encryptedFieldsCount: RESIDENT_ENCRYPTED_FIELDS.length,
        cipherSuite: 'AES-256-GCM',
      },
    });

    return Response.json({ data: resident });
  } catch (err) {
    return handleError(err);
  }
}
```

### Pattern 2: Encrypt PHI on INSERT

```javascript
import { getTenantEncryptionKey } from '@/lib/key-management.js';
import { encryptFields, RESIDENT_ENCRYPTED_FIELDS } from '@/lib/encryption.js';

export async function POST(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    const body = await request.json();

    // Validate input
    if (!body.first_name || !body.last_name) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get encryption key and encrypt PHI fields
    const tenantKey = await getTenantEncryptionKey(user.tenantId);
    const encrypted = encryptFields(body, RESIDENT_ENCRYPTED_FIELDS, tenantKey);

    const resident = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO care.residents (
           tenant_id, first_name, last_name, preferred_name,
           phone, email, address_line1, address_line2,
           medicaid_id, ssn_last4, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          user.tenantId,
          encrypted.first_name,
          encrypted.last_name,
          encrypted.preferred_name,
          encrypted.phone,
          encrypted.email,
          encrypted.address_line1,
          encrypted.address_line2,
          encrypted.medicaid_id,
          encrypted.ssn_last4,
          user.staffId,
        ]
      );
      return rows[0];
    });

    // Log encryption operation
    await audit.logInsert({
      tableName: 'care.residents',
      recordId: resident.id,
      residentId: resident.id,
      newValues: encrypted,
      req: { user },
      encryptionContext: {
        strategy: process.env.ENCRYPTION_KEY_STRATEGY || 'env-var',
        tenantId: user.tenantId,
        encryptedFieldsCount: RESIDENT_ENCRYPTED_FIELDS.length,
      },
    });

    return Response.json({ data: resident }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
```

### Pattern 3: Encrypt PHI on UPDATE

```javascript
export async function PATCH(request) {
  try {
    const { id } = request.params;
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    const updates = await request.json();

    // Get current data (for audit diff)
    const currentKey = await getTenantEncryptionKey(user.tenantId);
    const { rows: [current] } = await pool.query(
      'SELECT * FROM care.residents WHERE id = $1 AND tenant_id = $2',
      [id, user.tenantId]
    );

    // Decrypt current values
    const currentDecrypted = decryptFields(current, RESIDENT_ENCRYPTED_FIELDS, currentKey);

    // Encrypt updates
    const encrypted = encryptFields(updates, RESIDENT_ENCRYPTED_FIELDS, currentKey);

    // Update database
    const updated = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const setClauses = Object.entries(encrypted)
        .map(([key, _], i) => `${key} = $${i + 2}`)
        .join(', ');

      const { rows } = await client.query(
        `UPDATE care.residents SET ${setClauses}, updated_at = NOW()
         WHERE id = $1 AND tenant_id = $${Object.keys(encrypted).length + 2}
         RETURNING *`,
        [id, ...Object.values(encrypted), user.tenantId]
      );
      return rows[0];
    });

    // Log with diff
    const updatedDecrypted = decryptFields(updated, RESIDENT_ENCRYPTED_FIELDS, currentKey);
    const diffKeys = Object.keys(updates);

    await audit.logUpdate({
      tableName: 'care.residents',
      recordId: id,
      residentId: id,
      oldValues: currentDecrypted,
      newValues: updatedDecrypted,
      diffKeys: diffKeys.join(','),
      req: { user },
      encryptionContext: {
        strategy: process.env.ENCRYPTION_KEY_STRATEGY || 'env-var',
        tenantId: user.tenantId,
        encryptedFieldsCount: diffKeys.length,
      },
    });

    return Response.json({ data: updatedDecrypted });
  } catch (err) {
    return handleError(err);
  }
}
```

---

## Updating Existing Routes

### Before (Old Pattern with Hardcoded getTenantKey)

```javascript
async function getTenantKey(tenantId) {
  if (process.env.NODE_ENV !== 'production') {
    return (Buffer.from(process.env.DEV_TENANT_ENCRYPTION_KEY || 'dev-only-32-char-key-change-me!!').toString('hex').slice(0, 64)).padEnd(64, '0');
  }
  throw new Error('Production key resolver not configured');
}

const tenantKey = await getTenantKey(user.tenantId);
```

### After (New Pattern with Key Management)

```javascript
import { getTenantEncryptionKey } from '@/lib/key-management.js';

const tenantKey = await getTenantEncryptionKey(user.tenantId);
```

### Files Needing Updates

- `src/app/api/v1/residents/route.js`
- `src/app/api/v1/residents/[id]/route.js`
- `src/app/api/v1/admin/residents/route.js`
- `src/app/api/v1/admission/forms/route.js`
- `src/app/api/v1/admission/forms/[id]/approve/route.js`
- `src/app/api/v1/care-plans/route.js`

---

## Environment Variables Reference

### Development

```bash
ENCRYPTION_KEY_STRATEGY=env-var
DEV_TENANT_ENCRYPTION_KEY=dev-only-32-char-key-change-me!!
VALIDATE_ENCRYPTION_KEYS=false
```

### Production (AWS KMS)

```bash
ENCRYPTION_KEY_STRATEGY=aws-kms
AWS_REGION=us-east-1
KMS_RESIDENT_ENCRYPTION_KEY_ID=arn:aws:kms:us-east-1:ACCOUNT_ID:key/KEY_UUID
ENCRYPTION_KEY_CACHE_TTL_MS=3600000
VALIDATE_ENCRYPTION_KEYS=false
```

---

## Testing

```bash
npm test -- src/__tests__/encryption/key-management.test.js
```

All 22 tests pass, covering:
- Key resolution from all strategies
- Encryption/decryption round-trips
- Cache behavior
- Key rotation
- Error handling
- Multi-tenant isolation

---

## Further Reading

- [KEY_MANAGEMENT.md](./KEY_MANAGEMENT.md) - Complete key management documentation
- [src/lib/key-management.js](./src/lib/key-management.js) - Implementation
- [src/__tests__/encryption/key-management.test.js](./src/__tests__/encryption/key-management.test.js) - Test examples
