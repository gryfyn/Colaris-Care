-- Setup Test Data for E2E Testing
-- Creates realistic test accounts and data for Playwright workflows

BEGIN TRANSACTION;

-- 1. Create test tenant
INSERT INTO public.tenants (id, name, created_at)
VALUES ('test-tenant-001', 'Test Healthcare Organization', NOW())
ON CONFLICT DO NOTHING;

-- 2. Create test staff accounts
INSERT INTO ref.staff (
  id, tenant_id, email, password_hash, first_name, last_name,
  role, is_active, created_at
) VALUES
  -- Admin account
  ('test-admin-001', 'test-tenant-001', 'admin@test.local',
   '$2b$10$YJ9QJjCHVJPvJH5L3F5kZeXvYmxvYu.5m3x3K3m3K3m3K3m3K3m3K',
   'Test', 'Admin', 'admin', true, NOW()),

  -- Staff account
  ('test-staff-001', 'test-tenant-001', 'staff@test.local',
   '$2b$10$YJ9QJjCHVJPvJH5L3F5kZeXvYmxvYu.5m3x3K3m3K3m3K3m3K3m3K',
   'Test', 'Staff', 'staff', true, NOW())
ON CONFLICT DO NOTHING;

-- 3. Create test residents
INSERT INTO care.residents (
  id, tenant_id, first_name, last_name, preferred_name,
  date_of_birth, age, gender, email, phone,
  medicaid_id, primary_diagnosis, legal_status,
  created_at
) VALUES
  ('test-resident-001', 'test-tenant-001', 'John', 'Doe', 'John',
   '1985-03-15'::date, 39, 'M', 'john.doe@example.com', '555-0001',
   'MED-TEST-001', 'Depression with anxiety', 'competent',
   NOW()),

  ('test-resident-002', 'test-tenant-001', 'Jane', 'Smith', 'Jane',
   '1990-07-22'::date, 34, 'F', 'jane.smith@example.com', '555-0002',
   'MED-TEST-002', 'Bipolar disorder', 'competent',
   NOW())
ON CONFLICT DO NOTHING;

-- 4. Create staff assignments
INSERT INTO care.staff_assignments (
  id, resident_id, staff_id, is_active, created_at
) VALUES
  ('assign-001', 'test-resident-001', 'test-staff-001', true, NOW()),
  ('assign-002', 'test-resident-002', 'test-staff-001', true, NOW())
ON CONFLICT DO NOTHING;

-- 5. Create test appointments
INSERT INTO care.appointments (
  id, tenant_id, resident_id, staff_id, appointment_type,
  title, description, scheduled_at, duration_minutes,
  status, created_by, created_at
) VALUES
  ('appt-001', 'test-tenant-001', 'test-resident-001', 'test-staff-001',
   'medical', 'Regular Checkup', 'Monthly medical examination',
   NOW() + INTERVAL '3 days', 60, 'scheduled', 'test-staff-001', NOW()),

  ('appt-002', 'test-tenant-001', 'test-resident-002', 'test-staff-001',
   'therapy', 'Therapy Session', 'Weekly therapy',
   NOW() + INTERVAL '2 days', 45, 'scheduled', 'test-staff-001', NOW())
ON CONFLICT DO NOTHING;

-- 6. Create test progress notes
INSERT INTO care.daily_progress_notes (
  id, tenant_id, resident_id, staff_id, note_date, shift,
  content, mood_level, behavior_notes, medical_notes,
  review_status, created_at
) VALUES
  ('note-001', 'test-tenant-001', 'test-resident-001', 'test-staff-001',
   CURRENT_DATE, 'morning',
   'Patient had a good morning. Took breakfast well. Mood seems stable. Participated in group activity.',
   'stable', 'Cooperative and engaged', 'Vitals normal',
   'pending', NOW()),

  ('note-002', 'test-tenant-001', 'test-resident-002', 'test-staff-001',
   CURRENT_DATE, 'afternoon',
   'Patient attended therapy session. Good progress noted. Engaged in discussion about coping strategies.',
   'improved', 'More talkative than usual', 'No concerns',
   'pending', NOW())
ON CONFLICT DO NOTHING;

-- 7. Create test care plans
INSERT INTO care.care_plans (
  id, tenant_id, resident_id, primary_counselor_id,
  status, effective_date, review_date,
  primary_diagnosis, goals_summary,
  created_at
) VALUES
  ('plan-001', 'test-tenant-001', 'test-resident-001', 'test-staff-001',
   'draft', CURRENT_DATE, CURRENT_DATE + INTERVAL '90 days',
   'Depression with anxiety', 'Improve mood regulation and anxiety management',
   NOW())
ON CONFLICT DO NOTHING;

COMMIT;

-- Verify data was created
SELECT 'Staff Accounts' as data_type, COUNT(*) as count FROM ref.staff WHERE tenant_id = 'test-tenant-001';
SELECT 'Residents' as data_type, COUNT(*) as count FROM care.residents WHERE tenant_id = 'test-tenant-001';
SELECT 'Progress Notes' as data_type, COUNT(*) as count FROM care.daily_progress_notes WHERE tenant_id = 'test-tenant-001';
SELECT 'Appointments' as data_type, COUNT(*) as count FROM care.appointments WHERE tenant_id = 'test-tenant-001';
SELECT 'Care Plans' as data_type, COUNT(*) as count FROM care.care_plans WHERE tenant_id = 'test-tenant-001';
