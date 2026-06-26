-- 0005_create_admissions.sql
--
-- Repairs environments where care.admissions was missing. The table is defined in
-- 0001_core_schema.sql, but that file was amended to add care.admissions AFTER
-- some databases had already recorded 0001 as applied (the runner tracks files by
-- name, not content hash), so those databases never created the table. The
-- admissions POST (/api/v1/admissions) inserts a resident AND an admissions row in
-- one transaction; with the table absent the whole transaction rolled back, so no
-- admissions OR residents were ever persisted.
--
-- Idempotent: safe to run whether or not the table already exists. Grants are
-- intentionally omitted here — the runtime role gets DML via
-- scripts/apply-runtime-grants.mjs (grant ... on all tables in schema care), which
-- is the single source of truth for least-privilege grants in this repo.

create table if not exists care.admissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  facility_id uuid not null,
  resident_id uuid not null,
  admission_case_id uuid,
  status text not null default 'submitted' check (status in ('submitted', 'accepted', 'declined', 'closed')),
  candidate_first_name text not null,
  candidate_last_name text not null,
  email text,
  room text,
  care_level text,
  admitted_at date,
  submitted_at timestamptz not null default now(),
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  foreign key (organization_id, facility_id) references care.facilities(organization_id, id),
  foreign key (organization_id, facility_id, resident_id) references care.residents(organization_id, facility_id, id),
  unique (organization_id, facility_id, resident_id)
);

create index if not exists care_admissions_resident_idx
  on care.admissions(organization_id, facility_id, resident_id, submitted_at desc);

-- FORCE so even the table owner is filtered by the tenant policy (see 0004 FIX A).
alter table care.admissions enable row level security;
alter table care.admissions force row level security;

drop policy if exists admissions_scope on care.admissions;
create policy admissions_scope on care.admissions
  using (organization_id = app.current_organization_id() and facility_id = app.current_facility_id())
  with check (organization_id = app.current_organization_id() and facility_id = app.current_facility_id());
