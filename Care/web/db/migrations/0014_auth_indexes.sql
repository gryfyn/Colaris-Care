-- 0014_auth_indexes.sql
-- Make sign-in fast. app.login_identity matches `lower(u.email)` (so the plain
-- users_email_key can't help) and joins facility_memberships on user_id (which
-- had no standalone index — the unique index leads with organization_id). These
-- two indexes turn login into index lookups instead of sequential scans.

create index if not exists care_users_lower_email_idx
  on care.users (lower(email));

create index if not exists care_facility_memberships_user_idx
  on care.facility_memberships (user_id);
