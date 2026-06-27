-- 0006_staff_time_entries.sql
-- Staff clock-in / clock-out time tracking. One open row (clock_out_at is null)
-- per user means "currently clocked in". Tenant-scoped + forced RLS like the
-- other care tables; runtime DML grants come from apply-runtime-grants.mjs.

create table if not exists care.staff_time_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  facility_id uuid not null,
  user_id uuid not null,
  clock_in_at timestamptz not null default now(),
  clock_out_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (organization_id, facility_id) references care.facilities(organization_id, id)
);

create index if not exists care_time_entries_open_idx
  on care.staff_time_entries(organization_id, facility_id, user_id, clock_out_at);

alter table care.staff_time_entries enable row level security;
alter table care.staff_time_entries force row level security;

drop policy if exists staff_time_entries_scope on care.staff_time_entries;
create policy staff_time_entries_scope on care.staff_time_entries
  using (organization_id = app.current_organization_id() and facility_id = app.current_facility_id())
  with check (organization_id = app.current_organization_id() and facility_id = app.current_facility_id());
