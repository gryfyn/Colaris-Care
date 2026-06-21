# Migration 0011 Testing Procedures
**Objective:** Verify schema compliance, RLS enforcement, and index performance after deploying `0011_schema_optimization_rls_compliance.sql`.

---

## Pre-Migration Checklist

- [ ] Backup production database
- [ ] Run on staging first (non-destructive, idempotent)
- [ ] Verify migrations 0001-0010 have been applied
- [ ] Check disk space (indices require ~50MB)

---

## Test Suite

### Test 1: Verify RLS Policy on Admission Schema

**Objective:** Ensure tenant isolation works for admission tables.

**Setup:**
```bash
# Connect to database
psql -h localhost -U care_app_rw -d dependable_care

# Test data already exists in db.sql schema, so we'll test with existing tenants
```

**Test Steps:**
```sql
-- Step 1: Connect as service role (bypass RLS) and get a tenant ID
\c dependable_care postgres

-- Create two test tenants if they don't exist
INSERT INTO ref.tenants (id, name, timezone)
VALUES 
  ('10000000-0000-0000-0000-000000000001', 'Test Facility A', 'America/Los_Angeles'),
  ('20000000-0000-0000-0000-000000000002', 'Test Facility B', 'America/Los_Angeles')
ON CONFLICT (id) DO NOTHING;

-- Step 2: Insert test data in admission.admissions for Facility A
INSERT INTO admission.admissions (tenant_id, status, submitted_at, created_at)
VALUES 
  ('10000000-0000-0000-0000-000000000001', 'pending', NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000001', 'approved', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Insert test data for Facility B
INSERT INTO admission.admissions (tenant_id, status, submitted_at, created_at)
VALUES 
  ('20000000-0000-0000-0000-000000000002', 'pending', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Step 3: Verify counts
SELECT COUNT(*) as total_records FROM admission.admissions;
-- Expected: 3 records

-- Step 4: Connect as care_app_rw role and set tenant context
SET ROLE care_app_rw;

-- Facility A: Set tenant_id to Facility A
SELECT set_config('app.tenant_id', '10000000-0000-0000-0000-000000000001', false);

-- Query: Should only see 2 records (Facility A)
SELECT id, tenant_id, status FROM admission.admissions;
-- Expected: 2 rows, all with tenant_id = 10000000-0000-0000-0000-000000000001

-- Step 5: Switch to Facility B context
SELECT set_config('app.tenant_id', '20000000-0000-0000-0000-000000000002', false);

-- Query: Should only see 1 record (Facility B)
SELECT id, tenant_id, status FROM admission.admissions;
-- Expected: 1 row, tenant_id = 20000000-0000-0000-0000-000000000002

-- Step 6: Try to access Facility A record from Facility B context (should fail)
SELECT * FROM admission.admissions 
WHERE tenant_id = '10000000-0000-0000-0000-000000000001';
-- Expected: 0 rows (RLS blocks it)

COMMIT;
```

**Success Criteria:**
- ✓ Facility A context sees only 2 records
- ✓ Facility B context sees only 1 record
- ✓ Cross-tenant access is blocked by RLS
- ✓ No errors during policy enforcement

---

### Test 2: Verify Encryption Metadata Columns

**Objective:** Ensure `is_encrypted` and `encrypted_at` columns exist and function correctly.

```sql
-- Connect as care_app_rw
\c dependable_care care_app_rw

-- Step 1: Check column structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'care' AND table_name = 'residents'
AND column_name IN ('is_encrypted', 'encrypted_at')
ORDER BY column_name;

-- Expected output:
-- Column Name    | Data Type      | Is Nullable
-- encrypted_at   | timestamp tz   | YES
-- is_encrypted   | boolean        | NO

-- Step 2: Verify default values
INSERT INTO care.residents (id, tenant_id, first_name, last_name, status)
VALUES (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', 'Test', 'User', 'active');

-- Query the newly inserted record
SELECT id, is_encrypted, encrypted_at FROM care.residents WHERE first_name = 'Test' LIMIT 1;

-- Expected: is_encrypted = FALSE, encrypted_at = NULL

-- Step 3: Simulate encryption process
UPDATE care.residents 
SET is_encrypted = TRUE, encrypted_at = CURRENT_TIMESTAMP
WHERE first_name = 'Test';

-- Verify update
SELECT id, is_encrypted, encrypted_at FROM care.residents WHERE first_name = 'Test';
-- Expected: is_encrypted = TRUE, encrypted_at = current timestamp

-- Cleanup
DELETE FROM care.residents WHERE first_name = 'Test';
```

**Success Criteria:**
- ✓ Both columns exist on all PHI tables
- ✓ Default is_encrypted = FALSE
- ✓ Can update columns independently
- ✓ encrypted_at tracks encryption timestamp

---

### Test 3: Verify updated_at Triggers

**Objective:** Ensure triggers update the `updated_at` column on modification.

```sql
-- Connect as care_app_rw
\c dependable_care care_app_rw

SET app.tenant_id = '10000000-0000-0000-0000-000000000001';

-- Step 1: Create test medication record
INSERT INTO care.medications 
  (id, tenant_id, resident_id, drug_name, created_at, updated_at)
VALUES 
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000001',
   (SELECT id FROM care.residents LIMIT 1),
   'Test Drug', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Capture the original updated_at
SELECT id, updated_at INTO temp_record FROM care.medications 
WHERE drug_name = 'Test Drug';

-- Step 2: Wait 2 seconds and update
SELECT pg_sleep(2);

UPDATE care.medications 
SET drug_name = 'Updated Drug'
WHERE drug_name = 'Test Drug';

-- Step 3: Verify updated_at changed
SELECT 
  id,
  created_at,
  updated_at,
  (updated_at > created_at) as was_updated
FROM care.medications 
WHERE drug_name = 'Updated Drug';

-- Expected: updated_at is LATER than created_at

-- Cleanup
DELETE FROM care.medications WHERE drug_name = 'Updated Drug';
```

**Success Criteria:**
- ✓ Trigger fires on UPDATE
- ✓ updated_at is set to CURRENT_TIMESTAMP
- ✓ updated_at is greater than created_at
- ✓ No trigger errors in logs

---

### Test 4: Verify Index Performance

**Objective:** Ensure new indices are used by query planner.

```sql
-- Connect as care_app_rw
\c dependable_care care_app_rw

SET app.tenant_id = '10000000-0000-0000-0000-000000000001';

-- Step 1: Check index exists
SELECT schemaname, tablename, indexname 
FROM pg_indexes
WHERE tablename = 'residents' AND indexname LIKE 'idx_residents_%'
ORDER BY indexname;

-- Expected: idx_residents_created, idx_residents_encrypted, idx_residents_status, etc.

-- Step 2: Explain query with tenant + encryption filter
EXPLAIN ANALYZE
SELECT COUNT(*) FROM care.residents
WHERE tenant_id = '10000000-0000-0000-0000-000000000001'
AND is_encrypted = TRUE;

-- Expected in EXPLAIN output:
-- Index Scan using idx_residents_encrypted on care.residents
-- Index Cond: (tenant_id = ...) AND (is_encrypted = true)

-- Step 3: Explain query sorted by created_at
EXPLAIN ANALYZE
SELECT id, first_name, created_at FROM care.residents
WHERE tenant_id = '10000000-0000-0000-0000-000000000001'
ORDER BY created_at DESC
LIMIT 10;

-- Expected:
-- Limit (actual rows=...)
--   -> Index Scan Backward using idx_residents_created on care.residents
--   Index Cond: tenant_id = ...

-- Step 4: Check index sizes
SELECT 
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_indexes pi
JOIN pg_class pc ON pc.relname = indexname
JOIN pg_index idx ON idx.indexrelid = pc.oid
WHERE schemaname = 'care' AND tablename LIKE '%residents%'
ORDER BY pg_relation_size(indexrelid) DESC;
```

**Success Criteria:**
- ✓ All new indices are created and visible
- ✓ EXPLAIN ANALYZE shows Index Scan (not Seq Scan)
- ✓ Query execution time < 10ms
- ✓ Index sizes are reasonable (< 1GB total)

---

### Test 5: Verify NOT NULL Constraints

**Objective:** Ensure tenant_id cannot be NULL on PHI tables.

```sql
-- Connect as postgres (superuser, can bypass constraints)
\c dependable_care postgres

-- Step 1: Try to insert NULL tenant_id on residents
INSERT INTO care.residents (id, tenant_id, first_name, last_name, status)
VALUES (gen_random_uuid(), NULL, 'Null Test', 'User', 'active');

-- Expected error:
-- ERROR: null value in column "tenant_id" violates not-null constraint

-- Step 2: Verify constraint is listed
SELECT constraint_name, column_name
FROM information_schema.constraint_column_usage
WHERE table_schema = 'care' AND table_name = 'residents' AND column_name = 'tenant_id';

-- Expected: should show NOT NULL constraint

-- Step 3: Check on admission schema
SELECT constraint_name, column_name
FROM information_schema.constraint_column_usage
WHERE table_schema = 'admission' AND column_name = 'tenant_id';

-- Expected: admission tables should have tenant_id NOT NULL
```

**Success Criteria:**
- ✓ Cannot insert NULL tenant_id
- ✓ Constraint exists in system catalog
- ✓ All PHI tables have constraint

---

### Test 6: Verify RLS Grant Permissions

**Objective:** Ensure care_app_rw role has proper permissions.

```sql
-- Connect as postgres (superuser)
\c dependable_care postgres

-- Step 1: Check role permissions
SELECT grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'admission' AND grantee = 'care_app_rw'
ORDER BY privilege_type;

-- Expected: SELECT, INSERT, UPDATE, DELETE on all admission tables

-- Step 2: Check schema usage
SELECT grantee, privilege_type
FROM information_schema.schema_privileges
WHERE schema_name = 'admission';

-- Expected: USAGE privilege for care_app_rw

-- Step 3: Connect as care_app_rw and verify access
\c dependable_care care_app_rw

SET app.tenant_id = '10000000-0000-0000-0000-000000000001';

-- Should be able to read
SELECT COUNT(*) FROM admission.admissions;

-- Should be able to insert
INSERT INTO admission.admissions (tenant_id, status)
VALUES ('10000000-0000-0000-0000-000000000001', 'pending');

-- Should be able to update
UPDATE admission.admissions SET status = 'approved' WHERE status = 'pending' LIMIT 1;

-- Cleanup
DELETE FROM admission.admissions WHERE status = 'approved';
```

**Success Criteria:**
- ✓ care_app_rw has SELECT, INSERT, UPDATE, DELETE
- ✓ care_app_rw has USAGE on admission schema
- ✓ Can execute all DML operations

---

### Test 7: Integration Test - withTenantClient()

**Objective:** Verify application-level tenant context works with RLS.

**File:** Create `test/db-rls.test.js`

```javascript
const { pool, withTenantClient } = require('../src/lib/db');

describe('RLS Enforcement via withTenantClient()', () => {
  let tenantA = '10000000-0000-0000-0000-000000000001';
  let tenantB = '20000000-0000-0000-0000-000000000002';

  test('Tenant A cannot see Tenant B records', async () => {
    const resultA = await withTenantClient(tenantA, null, async (client) => {
      const { rows } = await client.query(
        `SELECT COUNT(*) as count FROM admission.admissions 
         WHERE tenant_id = $1`,
        [tenantB]
      );
      return rows[0].count;
    });

    expect(resultA).toBe(0); // Should not see tenant B records
  });

  test('Tenant A sees only Tenant A records', async () => {
    const resultA = await withTenantClient(tenantA, null, async (client) => {
      const { rows } = await client.query(
        `SELECT COUNT(*) as count FROM admission.admissions 
         WHERE tenant_id = $1`,
        [tenantA]
      );
      return rows[0].count;
    });

    expect(resultA).toBeGreaterThan(0); // Should see own records
  });

  test('Tenant context is properly isolated', async () => {
    const [countA, countB] = await Promise.all([
      withTenantClient(tenantA, null, async (client) => {
        const { rows } = await client.query(
          `SELECT COUNT(*) as count FROM admission.admissions`
        );
        return rows[0].count;
      }),
      withTenantClient(tenantB, null, async (client) => {
        const { rows } = await client.query(
          `SELECT COUNT(*) as count FROM admission.admissions`
        );
        return rows[0].count;
      })
    ]);

    // Counts should differ or be zero (isolation verified)
    expect(countA).not.toBe(countB);
  });
});
```

**Success Criteria:**
- ✓ All integration tests pass
- ✓ No RLS bypass possible via app code
- ✓ Tenant context properly isolated

---

## Rollback Procedure

If issues occur during testing, rollback using:

```bash
# In database
psql -d dependable_care < db/ROLLBACK_0011.sql
```

**File:** Create `db/ROLLBACK_0011.sql`

```sql
BEGIN;

-- Drop indices (in reverse order of creation)
DROP INDEX IF EXISTS idx_suicide_encrypted;
DROP INDEX IF EXISTS idx_suicide_tenant;
DROP INDEX IF EXISTS idx_mse_encrypted;
DROP INDEX IF EXISTS idx_mse_tenant;
-- ... (continue for all indices)

-- Drop RLS policies on admission schema
DROP POLICY IF EXISTS tenant_modification ON admission.advance_directive;
DROP POLICY IF EXISTS tenant_isolation ON admission.advance_directive;
DROP POLICY IF EXISTS tenant_modification ON admission.nursing_assessment;
DROP POLICY IF EXISTS tenant_isolation ON admission.nursing_assessment;
DROP POLICY IF EXISTS tenant_modification ON admission.pre_screening;
DROP POLICY IF EXISTS tenant_isolation ON admission.pre_screening;
DROP POLICY IF EXISTS tenant_modification ON admission.admissions;
DROP POLICY IF EXISTS tenant_isolation ON admission.admissions;

-- Drop triggers
DROP TRIGGER IF EXISTS trg_updated_at ON care.suicide_risk_assessments;
DROP TRIGGER IF EXISTS trg_updated_at ON care.mental_status_exams;
DROP TRIGGER IF EXISTS trg_updated_at ON care.medication_administrations;
DROP TRIGGER IF EXISTS trg_updated_at ON care.medications;

-- Drop encryption columns (if needed)
ALTER TABLE IF EXISTS care.suicide_risk_assessments DROP COLUMN IF EXISTS encrypted_at;
ALTER TABLE IF EXISTS care.suicide_risk_assessments DROP COLUMN IF EXISTS is_encrypted;
-- ... (continue for all tables)

-- WARNING: Do NOT drop tenant_id from admission schema (causes data loss)

COMMIT;
```

---

## Success Checklist

- [ ] Test 1: RLS enforces tenant isolation
- [ ] Test 2: Encryption metadata columns exist
- [ ] Test 3: updated_at triggers fire correctly
- [ ] Test 4: Indices are used by query planner
- [ ] Test 5: NOT NULL constraints prevent NULL tenant_id
- [ ] Test 6: RLS grants are correct
- [ ] Test 7: Integration tests pass
- [ ] No errors in application logs
- [ ] No performance regression (queries < 10ms)
- [ ] Audit logs record access events

---

## Deployment

Once all tests pass:

1. Schedule maintenance window (5-15 min)
2. Run migration on production
3. Monitor query performance (Datadog/CloudWatch)
4. Verify audit logs populate
5. Communicate completion to stakeholders

---

**Test Plan Prepared By:** Database Team  
**For:** Migration 0011 Deployment  
**Last Updated:** 2026-05-16
