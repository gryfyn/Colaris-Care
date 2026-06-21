# Migration Deployment Checklist
**Status:** Ready for staging (0009 only)  
**Date:** 2026-05-16  
**Owner:** Database Team Lead

---

## Pre-Deployment Review

### Migration 0009: Form Review Workflow

- [x] Safety review completed
- [x] Issues identified and fixed
- [x] Fixed migration file created (`0009_form_review_workflow_FIXED.sql`)
- [x] Test plan documented (`MIGRATION_TEST_PLAN.md`)
- [x] Rollback procedures documented
- [x] RLS policies verified
- [x] Trigger functions verified
- [x] Indices coverage confirmed
- [x] Foreign key constraints reviewed
- [x] Data types normalized (VARCHAR → TEXT)
- [x] Documentation comments added (regulation references)

**Sign-Off Required:** [ ] Engineering Lead [ ] DevOps

---

### Migration 0010: Admission Workflow

- [x] Architecture conflicts identified
- [x] Foreign key errors documented (auth.users missing)
- [x] Tenant isolation issues confirmed (no tenant_id column)
- [x] RLS policy errors documented (default-deny breaks access)
- [x] Schema duplication found (conflicts with care.* tables)
- [x] Recommendation: DO NOT DEPLOY
- [ ] Architecture review scheduled
- [ ] Redesign decision made (extend care.* OR new admission schema)

**Sign-Off Required:** [ ] Engineering Lead [ ] Product Manager

---

## Staging Deployment (0009 Only)

### Phase 1: Pre-Deployment Verification

**Checklist:**
- [ ] Staging database exists and is healthy
  ```bash
  psql dcllc_staging -c "SELECT version();"
  ```
  Expected: PostgreSQL 14+

- [ ] Base schema is loaded on staging
  ```bash
  psql dcllc_staging -c "\dt care.*" | wc -l
  ```
  Expected: 30+ tables

- [ ] No existing migration 0009 traces
  ```bash
  psql dcllc_staging << 'EOF'
  SELECT COUNT(*) FROM pg_tables 
    WHERE tablename IN ('evacuation_drills', 'daily_progress_notes');
  EOF
  ```
  Expected: 0

- [ ] Trigger function exists
  ```bash
  psql dcllc_staging -c "\df care.set_updated_at"
  ```
  Expected: 1 row (function definition)

- [ ] Test tenants created
  ```bash
  psql dcllc_staging -c "SELECT COUNT(*) FROM ref.tenants;"
  ```
  Expected: >= 1

- [ ] Test staff created
  ```bash
  psql dcllc_staging -c "SELECT COUNT(*) FROM ref.staff;"
  ```
  Expected: >= 1

---

### Phase 2: Apply Migration

**Command:**
```bash
psql dcllc_staging < db/migrations/0009_form_review_workflow_FIXED.sql
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

**Execution Time:** 2-5 seconds

**Rollback Command (if needed):**
```bash
psql dcllc_staging << 'EOF'
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
```

**Execution Time:** 1-2 seconds

---

### Phase 3: Post-Deployment Verification

**Checklist:**
- [ ] Tables created
  ```bash
  psql dcllc_staging -c "\dt care.evacuation_drills care.daily_progress_notes"
  ```
  Expected: 2 tables found

- [ ] All columns present
  ```bash
  psql dcllc_staging << 'EOF'
  SELECT column_name, data_type 
    FROM information_schema.columns
    WHERE table_name = 'evacuation_drills'
    ORDER BY ordinal_position;
  EOF
  ```
  Expected: 21 rows (all columns with correct types)

- [ ] Indices created
  ```bash
  psql dcllc_staging << 'EOF'
  SELECT indexname FROM pg_indexes
    WHERE tablename IN ('evacuation_drills', 'daily_progress_notes')
    ORDER BY tablename, indexname;
  EOF
  ```
  Expected: 8 indices (4 per table)

- [ ] Triggers created
  ```bash
  psql dcllc_staging << 'EOF'
  SELECT trigger_name, event_object_table
    FROM information_schema.triggers
    WHERE event_object_table IN ('evacuation_drills', 'daily_progress_notes');
  EOF
  ```
  Expected: 2 triggers (one per table)

- [ ] RLS enabled
  ```bash
  psql dcllc_staging << 'EOF'
  SELECT tablename FROM pg_tables
    WHERE rowsecurity = TRUE
    AND tablename IN ('evacuation_drills', 'daily_progress_notes');
  EOF
  ```
  Expected: 2 tables with RLS enabled

- [ ] Policies created
  ```bash
  psql dcllc_staging << 'EOF'
  SELECT policyname, policycmd FROM pg_policies
    WHERE tablename IN ('evacuation_drills', 'daily_progress_notes')
    ORDER BY tablename, policyname;
  EOF
  ```
  Expected: 4 policies (2 per table: tenant_isolation, tenant_modification)

---

### Phase 4: Functional Tests

**Test 1: Idempotency**
```bash
psql dcllc_staging < db/migrations/0009_form_review_workflow_FIXED.sql
# Run twice; both should succeed without errors
```
✓ Pass if: No errors on second run

**Test 2: Insert Data**
```sql
-- Connect as authenticated user with app.tenant_id set
SET app.tenant_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';

INSERT INTO care.evacuation_drills (
  id, tenant_id, staff_id, drill_date, drill_time, 
  drill_type, location_evacuated_to
) VALUES (
  gen_random_uuid(),
  'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  (SELECT id FROM ref.staff WHERE tenant_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' LIMIT 1),
  CURRENT_DATE,
  '10:00:00'::TIME,
  'fire_drill',
  'emergency_assembly_area'
);
```
✓ Pass if: Insert succeeds (1 row affected)

**Test 3: Verify RLS Isolation**
```sql
SET app.tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT COUNT(*) FROM care.evacuation_drills;
-- Should see rows for Tenant A only

RESET app.tenant_id;
SELECT COUNT(*) FROM care.evacuation_drills;
-- Should see 0 rows (RLS blocks access)
```
✓ Pass if: First query shows data; second query returns 0

**Test 4: Trigger Functionality**
```sql
SET app.tenant_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';

-- Insert a record
INSERT INTO care.evacuation_drills (
  id, tenant_id, staff_id, drill_date, drill_time, 
  drill_type, location_evacuated_to
) VALUES (
  'yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy',
  'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  (SELECT id FROM ref.staff LIMIT 1),
  CURRENT_DATE, '10:00:00'::TIME, 'fire', 'area'
);

-- Note the updated_at timestamp
SELECT updated_at FROM care.evacuation_drills 
  WHERE id = 'yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy';
-- Note: $original_time

-- Wait 1 second and update
SELECT pg_sleep(1);

UPDATE care.evacuation_drills 
  SET issues_noted = 'Test update' 
  WHERE id = 'yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy';

-- Check updated_at changed
SELECT updated_at FROM care.evacuation_drills 
  WHERE id = 'yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy';
-- Should be AFTER $original_time
```
✓ Pass if: updated_at timestamp changes with UPDATE statement

**Test 5: Index Performance**
```sql
SET app.tenant_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';

-- This should use an index scan, not sequential scan
EXPLAIN ANALYZE 
SELECT * FROM care.evacuation_drills
  WHERE tenant_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
  ORDER BY created_at DESC
  LIMIT 10;
```
✓ Pass if: Plan shows "Index Scan" (not "Seq Scan")

**Test 6: Foreign Key Constraints**
```sql
-- Try to insert with invalid tenant_id (should fail)
INSERT INTO care.evacuation_drills (
  id, tenant_id, staff_id, drill_date, drill_time, 
  drill_type, location_evacuated_to
) VALUES (
  gen_random_uuid(),
  'ffffffff-ffff-ffff-ffff-ffffffffffff',  -- Non-existent
  (SELECT id FROM ref.staff LIMIT 1),
  CURRENT_DATE, '10:00:00'::TIME, 'fire', 'area'
);
-- Expected: FK constraint violation error
```
✓ Pass if: Insert fails with FK error

---

### Phase 5: Run Automated Test Suite

```bash
# Run migration-specific tests
npm run test -- db-migrations.test.js --testNamePattern="0009"

# Expected: All tests pass
# Time: 30-60 seconds
```

✓ Pass if: All tests pass; no failures

---

### Phase 6: Performance Baseline

**Before Production Deployment:**
```sql
-- Run on staging to establish baseline
SET app.tenant_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';

\timing on

-- Query 1: Recent drills (should use index)
SELECT COUNT(*) FROM care.evacuation_drills
  WHERE tenant_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
  ORDER BY created_at DESC LIMIT 100;
-- Baseline: < 50ms

-- Query 2: Drills by date range
SELECT COUNT(*) FROM care.evacuation_drills
  WHERE tenant_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
  AND drill_date >= CURRENT_DATE - INTERVAL '30 days';
-- Baseline: < 50ms

-- Query 3: Daily notes by resident
SELECT COUNT(*) FROM care.daily_progress_notes
  WHERE tenant_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
  AND resident_id = (SELECT id FROM care.residents LIMIT 1)
  ORDER BY created_at DESC;
-- Baseline: < 50ms

\timing off
```

**Record Baseline:**
- Query 1 Time: _______ ms
- Query 2 Time: _______ ms
- Query 3 Time: _______ ms

---

### Phase 7: Staging Sign-Off

**Approval Checklist:**
- [ ] All verification tests passed
- [ ] All functional tests passed
- [ ] Automated test suite passed
- [ ] Performance baselines established
- [ ] No errors in application logs
- [ ] Rollback tested (if applicable)
- [ ] Team has reviewed changes

**Sign-Offs Required:**
- [ ] Database Team Lead: __________________ Date: __________
- [ ] DevOps Lead: _________________________ Date: __________
- [ ] Engineering Lead: ____________________ Date: __________

---

## Production Deployment (0009 Only)

**Scheduled For:** ____________________  
**Deployment Window:** ________________ (off-peak hours recommended)  
**Estimated Duration:** 5-10 seconds  

### Pre-Production Deployment

- [ ] Create backup of production database
  ```bash
  pg_dump dcllc_prod > dcllc_prod_backup_$(date +%Y%m%d_%H%M%S).sql
  ```

- [ ] Notify stakeholders of deployment window

- [ ] Have rollback plan ready (see Rollback Command above)

- [ ] Verify production database is healthy
  ```bash
  psql dcllc_prod -c "SELECT version();"
  ```

- [ ] Verify no active queries on migration-affected tables
  ```bash
  psql dcllc_prod << 'EOF'
  SELECT pid, usename, query FROM pg_stat_activity
    WHERE state != 'idle'
    AND query NOT LIKE '%pg_stat_activity%';
  EOF
  ```

### Production Deployment Command

```bash
# Deploy to production
psql dcllc_prod < db/migrations/0009_form_review_workflow_FIXED.sql

# Verify success (same checklist as staging Phase 3)
psql dcllc_prod -c "\dt care.evacuation_drills care.daily_progress_notes"
```

### Post-Production Verification

- [ ] Tables exist
- [ ] All indices created
- [ ] RLS enabled
- [ ] No new errors in application logs
- [ ] Monitor query performance (should match staging baselines)

---

## Migration 0010: BLOCKED

### Decision Required

**Question:** What is the strategy for admission workflow?

**Options:**
1. **Extend existing care.* tables** (RECOMMENDED)
   - Use existing: `care.pre_admission_screenings`, `care.nursing_admissions`
   - Add review workflow columns (like 0009)
   - Easier to integrate with existing API/UI
   - **Timeline:** Can proceed immediately
   - **Approval:** Engineering Lead

2. **Create new admission schema** (Requires redesign)
   - Rewrite 0010 following DCLLC architecture
   - Add tenant_id, fix FK references, use UUIDs
   - Create separate unified admission workflow
   - **Timeline:** 2-3 weeks for redesign + testing
   - **Approval:** Product + Architecture + Engineering

3. **Adopt Supabase auth schema** (Organizational change)
   - Requires migration of entire application authentication
   - Not recommended without full architectural review
   - **Timeline:** Major undertaking (4+ weeks)
   - **Approval:** CTO + Engineering Lead

### Decision Log

**Decision:** [ ] Option 1 [ ] Option 2 [ ] Option 3

**Decided By:** ___________________________ Date: __________

**Rationale:**
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

**Next Steps:**
_________________________________________________________________
_________________________________________________________________

---

## Rollback Procedure

**If any phase fails:**

1. **Immediate:** Stop deployment
2. **Notify:** Engineering Lead, DevOps, Product Manager
3. **Analyze:** Review error logs
4. **Decide:** Roll back or fix and retry
5. **Execute:** Rollback script (see Phase 2 above)
6. **Verify:** Schema returns to pre-migration state
7. **Communicate:** Update stakeholders
8. **Document:** Root cause analysis

**Rollback Confirmation:**
```sql
-- Verify tables are gone
SELECT COUNT(*) FROM pg_tables 
  WHERE tablename IN ('evacuation_drills', 'daily_progress_notes');
-- Expected: 0

-- Verify columns are gone
SELECT COUNT(*) FROM information_schema.columns
  WHERE table_name = 'incident_reports'
  AND column_name IN ('review_status', 'reviewed_by');
-- Expected: 0 (all review columns removed)

-- Verify type is gone
SELECT COUNT(*) FROM pg_type WHERE typname = 'review_status';
-- Expected: 0
```

---

## Final Checklist

Before closing this deployment:

- [ ] 0009 successfully deployed to staging
- [ ] All tests passed on staging
- [ ] Staging sign-offs collected
- [ ] 0009 successfully deployed to production
- [ ] All tests passed on production
- [ ] Performance baselines met
- [ ] Stakeholders notified
- [ ] 0010 decision documented and recorded
- [ ] 0010 next steps scheduled (if applicable)
- [ ] Deployment log closed
- [ ] Post-mortem scheduled (if issues occurred)

---

## Sign-Off

**Deployment Completed:** [ ] Yes [ ] No [ ] Rolled Back

**Date/Time:** ________________________

**Deployed By:** _______________________

**Verified By:** ________________________

**Issues:** None [ ] / See notes [ ]

**Notes:**
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

---

END OF CHECKLIST

