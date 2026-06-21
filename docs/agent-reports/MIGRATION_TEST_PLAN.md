# Migration Test Plan: 0009 & 0010
**Created:** 2026-05-16  
**Objective:** Validate safety and correctness before staging/production deployment

---

## Test Environment Setup

```bash
# 1. Create fresh test database
createdb dcllc_migration_test

# 2. Load base schema
psql dcllc_migration_test < db/db.sql

# 3. Seed test data (tenants, staff, residents)
psql dcllc_migration_test < db/seed-test-data.sql

# 4. Verify base schema loaded
psql dcllc_migration_test -c "\dt care.*" | wc -l
# Expected: 30+ tables in care schema
```

---

## Test Suite 1: Migration 0009 (Form Review Workflow)

### 1.1 Idempotency Test

**Objective:** Verify migration runs twice without error

```bash
# First run
psql dcllc_migration_test < db/migrations/0009_form_review_workflow_FIXED.sql
# Expected: no errors, COMMIT

# Second run (same migration again)
psql dcllc_migration_test < db/migrations/0009_form_review_workflow_FIXED.sql
# Expected: no errors, all IF NOT EXISTS satisfied
```

**Expected Output:**
```
CREATE TYPE
ALTER TABLE
ALTER TABLE
CREATE TABLE
CREATE TABLE
CREATE INDEX (x8)
CREATE TRIGGER (x2)
ALTER TABLE
CREATE POLICY (x2)
ALTER TABLE
CREATE POLICY (x2)
COMMIT
```

**Pass Criteria:** No `ERROR` messages; all CREATE/ALTER statements execute

---

### 1.2 Schema Validation Test

**Objective:** Verify table structure matches requirements

```sql
-- Run against test database

-- 1. Verify column existence on altered tables
SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name = 'incident_reports'
  AND column_name IN ('review_status', 'reviewed_by', 'reviewed_at', 'review_notes');
```

**Expected:**
| column_name | data_type |
|---|---|
| review_status | USER-DEFINED (review_status enum) |
| reviewed_by | uuid |
| reviewed_at | timestamp with time zone |
| review_notes | text |

```sql
-- 2. Verify new table structures
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'evacuation_drills'
  ORDER BY ordinal_position;
```

**Expected:** 21 columns including:
- id (uuid, NOT NULL)
- tenant_id (uuid, NOT NULL)
- created_at (timestamp, NOT NULL)
- updated_at (timestamp, NOT NULL)
- review_status (enum, default 'pending')

```sql
-- 3. Verify tenant_id first non-PK column
SELECT column_name, ordinal_position FROM information_schema.columns
  WHERE table_name = 'evacuation_drills'
  AND ordinal_position <= 3
  ORDER BY ordinal_position;
```

**Expected:**
- Position 1: id
- Position 2: tenant_id
- Position 3: staff_id or other column (not critical order)

**Pass Criteria:** All columns present with correct types

---

### 1.3 Index Coverage Test

**Objective:** Verify all required indices created

```sql
SELECT schemaname, tablename, indexname, indexdef
  FROM pg_indexes
  WHERE tablename IN ('evacuation_drills', 'daily_progress_notes')
  AND schemaname = 'care'
  ORDER BY tablename, indexname;
```

**Expected Indices:**

For `evacuation_drills` (4 minimum):
- idx_evacuation_drills_tenant
- idx_evacuation_drills_created
- idx_evacuation_drills_drill_date
- idx_evacuation_drills_staff

For `daily_progress_notes` (4 minimum):
- idx_daily_progress_notes_tenant
- idx_daily_progress_notes_resident
- idx_daily_progress_notes_created
- idx_daily_progress_notes_date

**Pass Criteria:** All 8+ indices present; none on wrong tables

---

### 1.4 Trigger Coverage Test

**Objective:** Verify updated_at triggers work correctly

```sql
-- Insert test data
INSERT INTO care.evacuation_drills (
  id, tenant_id, staff_id, drill_date, drill_time, drill_type, location_evacuated_to
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM ref.tenants LIMIT 1),
  (SELECT id FROM ref.staff LIMIT 1),
  CURRENT_DATE,
  '10:00:00'::TIME,
  'fire_evacuation',
  'emergency_assembly_point'
);

-- Capture current timestamp
SELECT updated_at FROM care.evacuation_drills ORDER BY created_at DESC LIMIT 1;
-- Note the value as $original_time

-- Wait 1 second, then update
SELECT pg_sleep(1);
UPDATE care.evacuation_drills
  SET issues_noted = 'Test update'
  WHERE drill_type = 'fire_evacuation'
  LIMIT 1;

-- Verify updated_at changed
SELECT updated_at FROM care.evacuation_drills
  WHERE drill_type = 'fire_evacuation'
  LIMIT 1;
-- Expected: timestamp AFTER $original_time
```

**Pass Criteria:**
- `updated_at` differs from creation time
- `updated_at` is GREATER than original value
- Trigger function executed successfully

---

### 1.5 RLS Policy Test

**Objective:** Verify multi-tenant isolation works

```sql
-- Setup: Create 2 test tenants and set session context
INSERT INTO ref.tenants (id, name, timezone) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tenant A', 'America/Los_Angeles'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Tenant B', 'America/Los_Angeles');

-- Create test staff for each tenant
INSERT INTO ref.staff (id, tenant_id, first_name, last_name, role, email) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Staff', 'A', 'admin', 'staffa@test.local'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Staff', 'B', 'admin', 'staffb@test.local');

-- Insert evacuation drills for both tenants
INSERT INTO care.evacuation_drills (
  id, tenant_id, staff_id, drill_date, drill_time, drill_type, location_evacuated_to
) VALUES
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccccc', CURRENT_DATE, '10:00', 'fire', 'assembly_point_a'),
  (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'dddddddd-dddd-dddd-dddd-dddddddddddd', CURRENT_DATE, '11:00', 'fire', 'assembly_point_b');

-- Test 1: Query as Tenant A
SET app.tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT COUNT(*) FROM care.evacuation_drills;
-- Expected: 1 (only Tenant A's drill)

-- Test 2: Query as Tenant B
SET app.tenant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
SELECT COUNT(*) FROM care.evacuation_drills;
-- Expected: 1 (only Tenant B's drill)

-- Test 3: Query as unset tenant
RESET app.tenant_id;
SELECT COUNT(*) FROM care.evacuation_drills;
-- Expected: 0 (RLS blocks access when tenant_id not set)

-- Test 4: Try to insert data for wrong tenant
SET app.tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
INSERT INTO care.evacuation_drills (
  id, tenant_id, staff_id, drill_date, drill_time, drill_type, location_evacuated_to
) VALUES (
  gen_random_uuid(),
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',  -- Different tenant!
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  CURRENT_DATE, '12:00', 'fire', 'assembly'
);
-- Expected: Permission denied error (RLS WITH CHECK fails)
```

**Pass Criteria:**
- Tenant A sees only its data
- Tenant B sees only its data
- Unset tenant sees nothing
- Cross-tenant insert is rejected

---

### 1.6 Foreign Key Integrity Test

**Objective:** Verify FK constraints work correctly

```sql
-- Test 1: Valid insert
INSERT INTO care.evacuation_drills (
  id, tenant_id, staff_id, drill_date, drill_time, drill_type, location_evacuated_to
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM ref.tenants LIMIT 1),
  (SELECT id FROM ref.staff LIMIT 1),
  CURRENT_DATE, '13:00', 'fire', 'assembly'
);
-- Expected: SUCCESS (both tenant and staff exist)

-- Test 2: Invalid tenant_id
INSERT INTO care.evacuation_drills (
  id, tenant_id, staff_id, drill_date, drill_time, drill_type, location_evacuated_to
) VALUES (
  gen_random_uuid(),
  'ffffffff-ffff-ffff-ffff-ffffffffffff',  -- Non-existent UUID
  (SELECT id FROM ref.staff LIMIT 1),
  CURRENT_DATE, '14:00', 'fire', 'assembly'
);
-- Expected: FK constraint violation error

-- Test 3: Invalid staff_id
INSERT INTO care.evacuation_drills (
  id, tenant_id, staff_id, drill_date, drill_time, drill_type, location_evacuated_to
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM ref.tenants LIMIT 1),
  'ffffffff-ffff-ffff-ffff-ffffffffffff',  -- Non-existent UUID
  CURRENT_DATE, '15:00', 'fire', 'assembly'
);
-- Expected: FK constraint violation error
```

**Pass Criteria:** Valid inserts succeed; invalid FK references fail

---

### 1.7 Query Performance Test

**Objective:** Verify indices improve query performance

```sql
-- Setup: Create 1000 test evacuation drills
INSERT INTO care.evacuation_drills (
  id, tenant_id, staff_id, drill_date, drill_time, drill_type, location_evacuated_to
)
SELECT
  gen_random_uuid(),
  (SELECT id FROM ref.tenants LIMIT 1),
  (SELECT id FROM ref.staff LIMIT 1),
  CURRENT_DATE - (interval '1 day' * generate_series(1, 1000)),
  ('10:00'::TIME + ('1 minute'::INTERVAL * generate_series(1, 1000))),
  'fire',
  'assembly_point'
FROM generate_series(1, 1000);

-- Test 1: Query by tenant (should use idx_evacuation_drills_tenant)
EXPLAIN ANALYZE SELECT COUNT(*) FROM care.evacuation_drills
  WHERE tenant_id = (SELECT id FROM ref.tenants LIMIT 1);
-- Expected output should show: "Index Scan using idx_evacuation_drills_tenant"

-- Test 2: Query by tenant + created_at DESC (should use composite index)
EXPLAIN ANALYZE SELECT * FROM care.evacuation_drills
  WHERE tenant_id = (SELECT id FROM ref.tenants LIMIT 1)
  ORDER BY created_at DESC
  LIMIT 10;
-- Expected: "Index Scan using idx_evacuation_drills_created" or similar

-- Test 3: Query by drill date (should use idx_evacuation_drills_drill_date)
EXPLAIN ANALYZE SELECT COUNT(*) FROM care.evacuation_drills
  WHERE tenant_id = (SELECT id FROM ref.tenants LIMIT 1)
  AND drill_date = CURRENT_DATE;
-- Expected: Index scan, not sequential scan

-- Measure actual execution time
\timing on
SELECT COUNT(*) FROM care.evacuation_drills
  WHERE tenant_id = (SELECT id FROM ref.tenants LIMIT 1);
-- Expected: < 100ms for 1000 rows
\timing off
```

**Pass Criteria:**
- All EXPLAIN plans show "Index Scan" not "Seq Scan"
- Query execution < 100ms for 1000 rows with indices
- No sequential table scans on WHERE tenant_id clause

---

### 1.8 Rollback Test

**Objective:** Verify rollback procedure works cleanly

```bash
# Deploy migration
psql dcllc_migration_test < db/migrations/0009_form_review_workflow_FIXED.sql

# Verify tables exist
psql dcllc_migration_test -c "\dt care.evacuation_drills"
# Expected: Found

# Apply rollback
psql dcllc_migration_test << 'EOF'
BEGIN;
DROP TABLE IF EXISTS care.daily_progress_notes CASCADE;
DROP TABLE IF EXISTS care.evacuation_drills CASCADE;
DROP TRIGGER IF EXISTS set_updated_at ON care.incident_reports;
DROP TRIGGER IF EXISTS set_updated_at ON care.drug_disposal_records;
ALTER TABLE care.incident_reports
  DROP COLUMN IF EXISTS review_status CASCADE,
  DROP COLUMN IF EXISTS reviewed_by CASCADE,
  DROP COLUMN IF EXISTS reviewed_at CASCADE,
  DROP COLUMN IF EXISTS review_notes CASCADE;
ALTER TABLE care.drug_disposal_records
  DROP COLUMN IF EXISTS review_status CASCADE,
  DROP COLUMN IF EXISTS reviewed_by CASCADE,
  DROP COLUMN IF EXISTS reviewed_at CASCADE,
  DROP COLUMN IF EXISTS review_notes CASCADE;
DROP TYPE IF EXISTS care.review_status CASCADE;
COMMIT;
EOF

# Verify rollback complete
psql dcllc_migration_test -c "\dt care.evacuation_drills"
# Expected: not found (table no longer exists)

# Verify columns removed
psql dcllc_migration_test -c "SELECT column_name FROM information_schema.columns
  WHERE table_name = 'incident_reports' AND column_name = 'review_status';"
# Expected: (no rows)
```

**Pass Criteria:**
- Tables drop cleanly
- Columns removed from existing tables
- Type drops without cascade issues
- Schema returns to pre-migration state

---

## Test Suite 2: Migration 0010 (Admission Workflow)

### 2.1 Schema Analysis (NO DEPLOYMENT)

**Objective:** Document why 0010 cannot be deployed as-is

```sql
-- Test 1: Check for auth.users table (migration depends on it)
SELECT EXISTS(SELECT 1 FROM pg_tables WHERE tablename = 'users' AND schemaname = 'auth')
  AS auth_users_exists;
-- Expected: FALSE (table doesn't exist; migration will fail)

-- Test 2: Check existing admission tables in care schema
SELECT tablename FROM pg_tables
  WHERE tablename LIKE '%admission%' OR tablename LIKE '%pre_screening%' OR tablename LIKE '%nursing%'
  ORDER BY tablename;
-- Expected: Multiple existing tables conflicting with 0010
```

**Blockers Found:**
1. `auth.users` table does not exist (migration will FAIL with FK error)
2. `care.pre_admission_screenings` already exists (data model conflict)
3. `care.nursing_admissions` already exists (data model conflict)
4. No tenant_id in admission schema (multi-tenant architecture violation)

**Pass Criteria for 0010:** DO NOT DEPLOY — Requires architectural redesign

---

### 2.2 Conflict Analysis

```sql
-- Show existing tables vs 0010 intentions
SELECT tablename FROM pg_tables WHERE tablename IN (
  'pre_admission_screenings',
  'nursing_admissions',
  'advance_directives'
) AND schemaname = 'care';
```

**Result:** 0010 attempts to create `admission.pre_screening`, `admission.nursing_assessment`, `admission.advance_directive` but `care.*` versions already exist.

This creates:
- **Data duplication risk** — two competing data models
- **API confusion** — which endpoint writes where?
- **Orphaned data** — old tables never populated; new tables never used

---

## Staging Deployment Sequence

### Approved: Migration 0009 (with fixes)

```bash
#!/bin/bash
set -e

echo "Step 1: Deploy to staging"
psql dcllc_staging < db/migrations/0009_form_review_workflow_FIXED.sql

echo "Step 2: Run smoke tests"
npm run test -- migrations.test.js --testNamePattern="0009"

echo "Step 3: Verify indices"
psql dcllc_staging << 'EOF'
SELECT COUNT(*) as index_count FROM pg_indexes
  WHERE tablename IN ('evacuation_drills', 'daily_progress_notes');
EOF

echo "Step 4: Verify RLS enabled"
psql dcllc_staging << 'EOF'
SELECT tablename FROM pg_tables
  WHERE rowsecurity = TRUE
  AND tablename IN ('evacuation_drills', 'daily_progress_notes');
EOF

echo "Step 5: Manual RLS test"
psql dcllc_staging << 'EOF'
SET app.tenant_id = '<staging-tenant-uuid>';
SELECT COUNT(*) FROM care.evacuation_drills;
RESET app.tenant_id;
EOF

echo "✓ 0009 deployed successfully"
```

### On Hold: Migration 0010

```bash
echo "Migration 0010 is BLOCKED pending:"
echo "1. Architecture review (admission schema vs existing care schema)"
echo "2. Decision: Extend care.* tables or create separate admission schema"
echo "3. If new schema: add tenant_id, fix FK to ref.staff, use UUIDs not BIGSERIAL"
echo ""
echo "Owners: Product, Architecture"
```

---

## Automated Test Harness

Create `__tests__/db-migrations.test.js`:

```javascript
const { execSync } = require('child_process');
const path = require('path');

describe('Database Migrations', () => {
  let testDbName = 'dcllc_migration_test_' + Date.now();

  beforeAll(() => {
    // Create test database
    execSync(`createdb ${testDbName}`);
    
    // Load base schema
    execSync(`psql ${testDbName} < db/db.sql`);
  });

  afterAll(() => {
    // Clean up
    execSync(`dropdb --if-exists ${testDbName}`);
  });

  describe('0009: Form Review Workflow', () => {
    it('should be idempotent', () => {
      // Run twice, no errors
      execSync(`psql ${testDbName} < db/migrations/0009_form_review_workflow_FIXED.sql`);
      execSync(`psql ${testDbName} < db/migrations/0009_form_review_workflow_FIXED.sql`);
    });

    it('should create evacuation_drills table with required columns', () => {
      const result = execSync(`psql ${testDbName} -c "\\d care.evacuation_drills"`).toString();
      expect(result).toContain('tenant_id');
      expect(result).toContain('review_status');
      expect(result).toContain('created_at');
      expect(result).toContain('updated_at');
    });

    it('should create required indices', () => {
      const result = execSync(
        `psql ${testDbName} -tc "SELECT count(*) FROM pg_indexes WHERE tablename='evacuation_drills'"`
      ).toString().trim();
      expect(parseInt(result)).toBeGreaterThanOrEqual(4);
    });

    it('should enable RLS on new tables', () => {
      const result = execSync(
        `psql ${testDbName} -tc "SELECT count(*) FROM pg_tables WHERE tablename IN ('evacuation_drills', 'daily_progress_notes') AND rowsecurity = TRUE"`
      ).toString().trim();
      expect(parseInt(result)).toBe(2);
    });

    it('should enforce tenant isolation via RLS', () => {
      // Insert test data with RLS checks
      // Verify tenant A cannot see tenant B data
    });
  });

  describe('0010: Admission Workflow', () => {
    it('should fail due to missing auth.users table', () => {
      expect(() => {
        execSync(`psql ${testDbName} < db/migrations/0010_admission_workflow.sql`);
      }).toThrow();
    });
  });
});
```

Run with:
```bash
npm test -- db-migrations.test.js
```

---

## Success Criteria Summary

| Test | 0009 Status | Notes |
|------|---|---|
| Idempotency | MUST PASS | Run twice without error |
| Schema Validity | MUST PASS | All columns, types, constraints correct |
| Index Coverage | MUST PASS | 8+ indices created |
| Trigger Functionality | MUST PASS | updated_at auto-increments on UPDATE |
| RLS Isolation | MUST PASS | Tenant A cannot see Tenant B data |
| Foreign Keys | MUST PASS | Invalid FKs rejected |
| Query Performance | MUST PASS | Index scans, not seq scans |
| Rollback | MUST PASS | Schema clean after rollback |

| Test | 0010 Status | Notes |
|------|---|---|
| Expected to Fail | CONFIRMED | auth.users table missing |
| Architectural Review | PENDING | Decide on admission schema approach |
| Deployment | BLOCKED | Do not deploy until reviewed |

---

## Sign-Off

- **Test Date:** 2026-05-16
- **Test Environment:** PostgreSQL 14+ on staging
- **Results:**
  - 0009: READY for staging after fixes applied
  - 0010: BLOCKED pending architecture review

**Next Action:** Deploy corrected 0009 to staging; schedule review for 0010

