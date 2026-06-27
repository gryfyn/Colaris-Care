-- 0009_staff_documents.sql
-- Allow a document to belong to a staff member (credentials / certifications)
-- in addition to a resident. Either resident_id or staff_profile_id is set.

alter table care.documents add column if not exists staff_profile_id uuid;
