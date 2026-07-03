-- Migration 0015: Colaris Care daily progress notes
--
-- Rich, DCLLC-parity daily progress documentation. One note per resident per
-- day per shift. Unlike care.progress_notes (free-form shift notes), the body is
-- a structured JSONB document (mood, physical health, meds, meals, activities,
-- incidents). Admin does NOT approve these — review_status defaults to
-- 'submitted' and approver_name is captured for the record only.

create table if not exists care.daily_progress_notes (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null,
  facility_id       uuid not null,
  resident_id       uuid not null,
  staff_profile_id  uuid,
  note_date         date not null,
  shift             text not null default 'morning' check (shift in ('morning', 'afternoon', 'night')),
  note_body         jsonb not null default '{}'::jsonb,
  review_status     text not null default 'submitted' check (review_status in ('submitted', 'approved', 'rejected')),
  approver_name     text,
  source            text not null default 'manual' check (source in ('manual', 'upload')),
  version           integer not null default 1,
  created_at        timestamptz not null default now(),
  created_by        uuid,
  updated_at        timestamptz not null default now(),
  updated_by        uuid,
  unique (organization_id, facility_id, resident_id, note_date, shift),
  foreign key (organization_id, facility_id, resident_id)
    references care.residents(organization_id, facility_id, id)
);

comment on table care.daily_progress_notes is
  'Daily progress notes (DCLLC parity). Structured JSONB body; one per resident/date/shift.';

create index if not exists care_daily_progress_notes_resident_idx
  on care.daily_progress_notes(organization_id, facility_id, resident_id, note_date desc);

create index if not exists care_daily_progress_notes_date_idx
  on care.daily_progress_notes(organization_id, facility_id, note_date desc);

create index if not exists care_daily_progress_notes_staff_idx
  on care.daily_progress_notes(organization_id, facility_id, staff_profile_id, note_date desc);

alter table care.daily_progress_notes enable row level security;

drop policy if exists daily_progress_notes_scope on care.daily_progress_notes;
create policy daily_progress_notes_scope on care.daily_progress_notes
  using (organization_id = app.current_organization_id() and facility_id = app.current_facility_id())
  with check (organization_id = app.current_organization_id() and facility_id = app.current_facility_id());
