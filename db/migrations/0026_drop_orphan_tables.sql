-- 0026: Drop orphaned, empty, unreferenced tables (schema audit 2026-06-06).
--
-- Tier A+B from the audit: every table below was verified in production to have
-- 0 rows, no references anywhere in the application code, and no incoming
-- foreign keys from active tables. They are leftovers from an earlier schema
-- design that the current app never wired up.
--
-- staff_time_records additionally backs the (also unused) view
-- care.v_staff_clocked_in, which CASCADE removes.
--
-- Intentionally NOT dropped here: the "v2 clinical-notes" cluster
-- (care.daily_progress_notes_v2 + blood_glucose_readings + mental_status_exams
-- + view v_unsigned_daily_notes), because daily_progress_notes_v2 is still
-- referenced by a FK from the active care.medication_administrations table.
-- Removing that subsystem is a separate, deliberate migration.
--
-- This migration runs AFTER db.sql in migrate-db.js, so it also neutralizes the
-- CREATE TABLE IF NOT EXISTS statements that still live in the genesis schema.

DROP VIEW  IF EXISTS care.v_staff_clocked_in            CASCADE;

DROP TABLE IF EXISTS care.initial_screenings            CASCADE;
DROP TABLE IF EXISTS care.care_plan_signatures          CASCADE;
DROP TABLE IF EXISTS care.care_plan_cultural_identity   CASCADE;
DROP TABLE IF EXISTS care.resident_specific_plans       CASCADE;
DROP TABLE IF EXISTS care.incident_injury_zones         CASCADE;
DROP TABLE IF EXISTS care.evacuation_drill_participants CASCADE;
DROP TABLE IF EXISTS care.suicide_risk_assessments      CASCADE;
DROP TABLE IF EXISTS care.staff_time_records            CASCADE;
