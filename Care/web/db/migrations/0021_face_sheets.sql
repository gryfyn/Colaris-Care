-- 0021_face_sheets.sql
--
-- Adds the persisted full face-sheet record. Face sheets are stored one row per
-- resident with the full field payload in data jsonb; runtime grants are
-- intentionally omitted because scripts/apply-runtime-grants.mjs grants DML on
-- care schema tables as the single source of truth.
--
-- Idempotent: safe to run whether or not the table or policy already exists.

create table if not exists care.face_sheets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  facility_id uuid not null,
  resident_id uuid not null,
  data jsonb not null default '{}'::jsonb,
  version int not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  foreign key (organization_id, facility_id) references care.facilities(organization_id, id),
  foreign key (organization_id, facility_id, resident_id) references care.residents(organization_id, facility_id, id),
  unique (organization_id, facility_id, resident_id)
);

create index if not exists care_face_sheets_resident_idx
  on care.face_sheets(organization_id, facility_id, resident_id);

-- FORCE so even the table owner is filtered by the tenant policy.
alter table care.face_sheets enable row level security;
alter table care.face_sheets force row level security;

drop policy if exists face_sheets_scope on care.face_sheets;
create policy face_sheets_scope on care.face_sheets
  using (organization_id = app.current_organization_id() and facility_id = app.current_facility_id())
  with check (organization_id = app.current_organization_id() and facility_id = app.current_facility_id());
