-- 0013_performance_indexes.sql
-- Make list queries lightning fast at multi-tenant scale. RLS rewrites every
-- query with `organization_id = ... AND facility_id = ...`, so each hot list
-- needs a composite index that leads with (organization_id, facility_id) and
-- continues with the table's filter/sort column. Without these, the records
-- tables below (which only had a PK) do sequential scans across all tenants.

-- announcements: where status='published' order by starts_at desc
create index if not exists care_announcements_scope_idx
  on care.announcements (organization_id, facility_id, status, starts_at desc);

-- appointments: order by starts_at asc
create index if not exists care_appointments_scope_idx
  on care.appointments (organization_id, facility_id, starts_at);

-- documents: filtered by resident_id OR staff_profile_id, order created_at desc
create index if not exists care_documents_resident_idx
  on care.documents (organization_id, facility_id, resident_id, created_at desc)
  where resident_id is not null;
create index if not exists care_documents_staff_idx
  on care.documents (organization_id, facility_id, staff_profile_id, created_at desc)
  where staff_profile_id is not null;

-- drug_disposals: order by disposed_at desc
create index if not exists care_drug_disposals_scope_idx
  on care.drug_disposals (organization_id, facility_id, disposed_at desc);

-- evacuation_drills: order by occurred_at desc
create index if not exists care_evacuation_drills_scope_idx
  on care.evacuation_drills (organization_id, facility_id, occurred_at desc);

-- incident_reports: order by occurred_at desc
create index if not exists care_incident_reports_scope_idx
  on care.incident_reports (organization_id, facility_id, occurred_at desc);

-- discharge_records: order by updated_at desc
create index if not exists care_discharge_records_scope_idx
  on care.discharge_records (organization_id, facility_id, updated_at desc);

-- notifications list: where (user_id is null or user_id=$1) and status<>'archived'
--                     order by created_at desc
create index if not exists care_notifications_inbox_idx
  on care.notifications (organization_id, facility_id, user_id, created_at desc);

-- medications: joined to residents, often filtered by resident
create index if not exists care_medications_resident_idx
  on care.medications (organization_id, facility_id, resident_id);
