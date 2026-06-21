# Migration Safety Review: 0009 & 0010
**Date:** 2026-05-16  
**Reviewed by:** Database Team Lead  
**Status:** REQUIRES FIXES BEFORE DEPLOYMENT

---

## EXECUTIVE SUMMARY

Both migrations have **critical safety issues** that must be fixed before production deployment:

### 0009_form_review_workflow.sql
- **Status:** UNSAFE - Missing required indices and triggers
- **Issue Level:** HIGH
- **Blocker:** No updated_at trigger on new tables; missing indices for query performance

### 0010_admission_workflow.sql
- **Status:** UNSAFE - Fundamental architectural issues
- **Issue Level:** CRITICAL
- **Blocker:** Uses BIGSERIAL + Supabase auth.users (incompatible with current schema); no tenant isolation; default-deny RLS is unusable

---

## DETAILED ANALYSIS

### Migration 0009: Form Review Workflow

#### Issues Found

1. **Missing Updated-At Triggers** (CRITICAL)
   - Tables `evacuation_drills` and `daily_progress_notes` have `updated_at` columns but NO trigger
   - Current schema requires `care.set_updated_at()` trigger on all tables with `updated_at`
   - **Impact:** `updated_at` will always stay at creation timestamp; audit trail broken
   - **Evidence:** db.sql lines 70-75 define the shared trigger function

2. **Missing Indices** (HIGH)
   - `evacuation_drills`: No indices on `tenant_id`, `created_at DESC`, `drill_date`
   - `daily_progress_notes`: No indices on `tenant_id`, `resident_id`, `created_at DESC`
   - **Impact:** O(n) scans on multi-tenant queries; performance degradation in production
   - **Pattern:** Compare with `incident_reports` (db.sql line 1088-1091) which has 2 composite indices

3. **Missing RLS Policies** (HIGH)
   - Both new tables have `tenant_id` but no Row-Level Security enforcement
   - **Impact:** Cross-tenant data leakage possible if app code has bugs
   - **Pattern:** Compare with `care.residents` in db.sql (RLS enforced on all tenant-aware tables)

4. **Data Type Issues** (MEDIUM)
   - `drill_type VARCHAR(32)` — should be TEXT per project standard (db.sql uses TEXT everywhere)
   - `shift VARCHAR(16)` — same issue

5. **Missing Column Constraints** (LOW)
   - `evacuation_drills.staff_id` required but can point to any facility's staff via FK constraint alone
   - Should add CHECK or composite unique constraint with tenant_id

#### Risks if Deployed as-Is
- Updated timestamps will never change → audit logs become useless
- Queries on new tables without indices will timeout in production
- Multi-tenant queries will full-scan entire table
- RLS bypass possible via direct API calls with crafted tenant_id

#### Required Fixes
Add to migration after table CREATE statements:

```sql
-- Indices for evacuation_drills
CREATE INDEX idx_evacuation_drills_tenant ON care.evacuation_drills(tenant_id);
CREATE INDEX idx_evacuation_drills_created ON care.evacuation_drills(created_at DESC);
CREATE INDEX idx_evacuation_drills_drill_date ON care.evacuation_drills(tenant_id, drill_date DESC);

-- Indices for daily_progress_notes
CREATE INDEX idx_daily_progress_notes_tenant ON care.daily_progress_notes(tenant_id);
CREATE INDEX idx_daily_progress_notes_resident ON care.daily_progress_notes(resident_id, created_at DESC);
CREATE INDEX idx_daily_progress_notes_created ON care.daily_progress_notes(created_at DESC);

-- Triggers
CREATE TRIGGER set_updated_at BEFORE UPDATE ON care.evacuation_drills
  FOR EACH ROW EXECUTE FUNCTION care.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON care.daily_progress_notes
  FOR EACH ROW EXECUTE FUNCTION care.set_updated_at();

-- RLS Policies
ALTER TABLE care.evacuation_drills ENABLE ROW LEVEL SECURITY;
ALTER TABLE care.daily_progress_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_evacuation ON care.evacuation_drills
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_modification_evacuation ON care.evacuation_drills
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation_notes ON care.daily_progress_notes
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_modification_notes ON care.daily_progress_notes
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

-- Data type fixes
ALTER TABLE care.evacuation_drills ALTER COLUMN drill_type TYPE TEXT;
ALTER TABLE care.daily_progress_notes ALTER COLUMN shift TYPE TEXT;
```

---

### Migration 0010: Admission Workflow

#### Critical Issues

1. **Schema/Table Mismatch** (CRITICAL)
   - Migration uses `BIGSERIAL PRIMARY KEY` for all tables
   - Creates separate `admission` schema with different data model
   - Current codebase already has `care.pre_admission_screenings`, `care.nursing_admissions`, `care.advance_directives` in db.sql
   - **Conflict:** Two competing data models for same business entity
   - **Impact:** This will create orphaned tables; duplicate data flows; inconsistent APIs

2. **Foreign Key Conflicts** (CRITICAL)
   - References `auth.users(id)` which does NOT exist in current schema
   - Current schema has `care.user_accounts` (UUIDs), `ref.staff` (UUIDs)
   - References `admission.pre_screening(id)`, `admission.nursing_assessment(id)`, `admission.advance_directive(id)` before they're created
   - **Impact:** Migration will fail during execution (FK constraint violation)

3. **No Tenant Isolation** (CRITICAL)
   - admission.admissions table has NO tenant_id column
   - RLS policy comment says "no tenant column, inherent isolation assumed"
   - **This is unsafe** — violates multi-tenant architecture
   - **Impact:** All tenants can see all admissions; data leakage confirmed

4. **Broken RLS Strategy** (HIGH)
   - Uses default-deny policy: `USING (FALSE) WITH CHECK (FALSE)`
   - This makes the tables completely inaccessible
   - Comment says "Enable bypass for service role if exists" but doesn't implement it
   - **Impact:** Tables are locked down but grant at schema level doesn't override
   - **No working policies:** Rows will be blocked from all queries

5. **Missing Updated_at Triggers** (HIGH)
   - No `updated_at` column at all
   - No trigger pattern for audit trail
   - Should follow project standard from db.sql

6. **Inconsistent Naming** (MEDIUM)
   - NEW schema `admission` but current schema uses `care` for all clinical data
   - Will cause confusion in future maintenance
   - Inconsistent with OAR 309 workflow already in `care.nursing_admissions` (db.sql line 1205)

#### Evidence of Duplicate Existing Tables
From db.sql:
- Line 571: `care.pre_admission_screenings` — already exists with proper schema
- Line 1205: `care.nursing_admissions` — already exists with 8-step wizard
- Near line 1300+: `care.advance_directives` — already exists

Migration 0010 creates competing tables with different IDs and structure.

#### Is This Repairable?
**Not easily.** Options:
1. **Drop 0010 entirely** — merge admission workflow into existing tables instead
2. **Complete rewrite of 0010** — use UUIDs, add tenant_id to every table, use current admissions schema
3. **Hybrid approach** — create bridge tables to map admission schema to care schema

#### Recommendation
**DO NOT DEPLOY 0010.** It requires architectural redesign.

---

## ROLLBACK PROCEDURES

### For 0009 (if deployed without fixes)
```sql
-- Immediate: Remove RLS (if fixed version deployed)
ALTER TABLE care.evacuation_drills DISABLE ROW LEVEL SECURITY;
ALTER TABLE care.daily_progress_notes DISABLE ROW LEVEL SECURITY;

-- Drop triggers
DROP TRIGGER IF EXISTS set_updated_at ON care.evacuation_drills;
DROP TRIGGER IF EXISTS set_updated_at ON care.daily_progress_notes;

-- Drop indices
DROP INDEX IF EXISTS idx_evacuation_drills_tenant;
DROP INDEX IF EXISTS idx_evacuation_drills_created;
DROP INDEX IF EXISTS idx_evacuation_drills_drill_date;
DROP INDEX IF EXISTS idx_daily_progress_notes_tenant;
DROP INDEX IF EXISTS idx_daily_progress_notes_resident;
DROP INDEX IF EXISTS idx_daily_progress_notes_created;

-- Drop columns from existing tables
ALTER TABLE care.incident_reports
  DROP COLUMN IF EXISTS review_status,
  DROP COLUMN IF EXISTS reviewed_by,
  DROP COLUMN IF EXISTS reviewed_at,
  DROP COLUMN IF EXISTS review_notes;

ALTER TABLE care.drug_disposal_records
  DROP COLUMN IF EXISTS review_status,
  DROP COLUMN IF EXISTS reviewed_by,
  DROP COLUMN IF EXISTS reviewed_at,
  DROP COLUMN IF EXISTS review_notes;

-- Drop new tables
DROP TABLE IF EXISTS care.daily_progress_notes;
DROP TABLE IF EXISTS care.evacuation_drills;

-- Drop enum
DROP TYPE IF EXISTS care.review_status;

-- Restart: Run corrected migration
```

### For 0010 (if deployed as-is — will likely fail)
```sql
-- Drop entire admission schema
DROP SCHEMA IF EXISTS admission CASCADE;

-- Verify no orphaned sequences
SELECT * FROM information_schema.sequences WHERE sequence_schema = 'admission';
```

---

## TESTING CHECKLIST

Before any migration deployment:

- [ ] **Idempotency Test:** Run migration twice on staging, verify no errors on second run
- [ ] **Schema Validation:** Compare new schema against db.sql master definition
- [ ] **RLS Test:** Verify `current_setting('app.tenant_id')` is set before any queries
- [ ] **Index Performance:** Run EXPLAIN ANALYZE on tenant-filtered queries
- [ ] **Trigger Test:** Update a row, verify `updated_at` changes
- [ ] **FK Test:** Try to insert invalid FK references, expect constraint violation
- [ ] **Rollback Test:** Deploy migration, then rollback script, verify schema is clean
- [ ] **Multi-tenant Test:** Insert data with tenant A, verify tenant B cannot see it

---

## STAGING DEPLOYMENT PLAN

### Phase 1: 0009 (with fixes)
```bash
# 1. Apply corrected migration
psql dcllc_staging < db/migrations/0009_form_review_workflow_FIXED.sql

# 2. Smoke tests
npm run test -- db-migration-0009

# 3. Manual RLS verification
SELECT * FROM care.evacuation_drills 
  WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000';
  -- Should fail with "permission denied" if RLS working

# 4. Performance test
EXPLAIN ANALYZE SELECT * FROM care.evacuation_drills 
  WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000' 
  ORDER BY created_at DESC LIMIT 10;
  -- Should show "Index Scan" not "Seq Scan"
```

### Phase 2: 0010 (BLOCKED)
- **Status:** HOLD pending architectural review
- **Owner:** Product team + Architecture
- **Action:** Schedule design review to decide:
  - Keep existing `care.*` tables + extend
  - Replace with new `admission.*` schema
  - Hybrid bridge approach

---

## MIGRATION TRACKING

| File | Status | Safety | Notes |
|------|--------|--------|-------|
| 0009_form_review_workflow.sql | ⚠️ REVIEW | HIGH RISK | Missing indices, triggers, RLS. Needs fixes. |
| 0010_admission_workflow.sql | 🚫 BLOCKED | CRITICAL | Schema conflicts, FK errors, no tenant isolation. Requires redesign. |

---

## SIGN-OFF

- **Code Review:** PENDING FIXES
- **Staging Approval:** PENDING TEST
- **Production Ready:** NO

**Next Steps:**
1. Fix 0009 per recommendations above
2. Create new migration file (0011) with corrected 0009
3. Schedule architecture review for 0010
4. Run full test suite on staging

