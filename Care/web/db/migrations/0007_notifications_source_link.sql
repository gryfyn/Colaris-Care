-- 0007_notifications_source_link.sql
-- Link a notification to the entity that produced it so the notification can be
-- auto-resolved when that task is completed. The runtime role has no DELETE on
-- care tables (by design), so "remove" is implemented as status = 'resolved',
-- which the notifications API filters out.

alter table care.notifications add column if not exists source_type text;
alter table care.notifications add column if not exists source_id uuid;

create index if not exists care_notifications_source_idx
  on care.notifications(organization_id, facility_id, source_type, source_id);
