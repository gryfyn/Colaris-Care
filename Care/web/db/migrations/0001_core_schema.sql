create extension if not exists pgcrypto;

create schema if not exists app;
create schema if not exists care;
create schema if not exists audit_log;

create or replace function app.current_user_id()
returns uuid
language sql
stable
as $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;

create or replace function app.current_staff_id()
returns uuid
language sql
stable
as $$ select nullif(current_setting('app.staff_id', true), '')::uuid $$;

create or replace function app.current_organization_id()
returns uuid
language sql
stable
as $$ select nullif(current_setting('app.organization_id', true), '')::uuid $$;

create or replace function app.current_facility_id()
returns uuid
language sql
stable
as $$ select nullif(current_setting('app.facility_id', true), '')::uuid $$;

create or replace function app.current_action()
returns text
language sql
stable
as $$ select nullif(current_setting('app.action', true), '') $$;

create or replace function app.set_request_context(
  p_user_id uuid,
  p_staff_id uuid,
  p_organization_id uuid,
  p_facility_id uuid,
  p_action text
)
returns void
language plpgsql
as $$
begin
  perform set_config('app.user_id', coalesce(p_user_id::text, ''), true);
  perform set_config('app.staff_id', coalesce(p_staff_id::text, ''), true);
  perform set_config('app.organization_id', coalesce(p_organization_id::text, ''), true);
  perform set_config('app.facility_id', coalesce(p_facility_id::text, ''), true);
  perform set_config('app.action', coalesce(p_action, ''), true);
end;
$$;

create table if not exists care.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'onboarding' check (status in ('onboarding', 'active', 'suspended', 'offboarding', 'archived')),
  default_timezone text not null default 'America/New_York',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists care.facilities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references care.organizations(id),
  name text not null,
  code text not null,
  timezone text not null default 'America/New_York',
  status text not null default 'onboarding' check (status in ('onboarding', 'active', 'suspended', 'archived')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, code)
);

create table if not exists care.users (
  id uuid primary key default gen_random_uuid(),
  identity_provider_subject text unique,
  email text not null unique,
  display_name text not null,
  password_hash text,
  status text not null default 'active' check (status in ('invited', 'active', 'disabled', 'archived')),
  last_authenticated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists care.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references care.organizations(id),
  user_id uuid not null references care.users(id),
  role text not null check (role in ('superadmin', 'admin', 'manager', 'staff', 'resident_care_of')),
  status text not null default 'active' check (status in ('active', 'inactive', 'revoked')),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists care.facility_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  facility_id uuid not null,
  user_id uuid not null references care.users(id),
  role text not null check (role in ('admin', 'manager', 'staff', 'resident_care_of')),
  status text not null default 'active' check (status in ('active', 'inactive', 'revoked')),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  foreign key (organization_id, facility_id) references care.facilities(organization_id, id),
  unique (organization_id, facility_id, user_id)
);

create table if not exists care.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references care.users(id),
  organization_id uuid references care.organizations(id),
  facility_id uuid,
  token_hash text not null unique,
  refresh_family_id uuid not null default gen_random_uuid(),
  assurance_level text not null default 'password',
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists care.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  facility_id uuid not null,
  user_id uuid references care.users(id),
  employee_number text not null,
  first_name text not null,
  last_name text not null,
  role_title text,
  email text,
  phone text,
  status text not null default 'active' check (status in ('active', 'inactive', 'terminated', 'archived')),
  certifications jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, facility_id, id),
  unique (organization_id, facility_id, employee_number),
  foreign key (organization_id, facility_id) references care.facilities(organization_id, id)
);

create table if not exists care.residents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  facility_id uuid not null,
  first_name text not null,
  last_name text not null,
  date_of_birth date not null,
  ssn_last4 text,
  room text,
  care_level text,
  status text not null default 'active' check (status in ('pending', 'active', 'hospitalized', 'discharged', 'archived')),
  source_admission_case_id uuid,
  admitted_at date,
  discharged_at date,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (organization_id, facility_id, id),
  unique (organization_id, facility_id, first_name, last_name, date_of_birth),
  foreign key (organization_id, facility_id) references care.facilities(organization_id, id)
);

create table if not exists care.staff_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  facility_id uuid not null,
  staff_profile_id uuid not null,
  resident_id uuid not null,
  status text not null default 'active' check (status in ('active', 'inactive', 'ended')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (organization_id, facility_id, staff_profile_id) references care.staff_profiles(organization_id, facility_id, id),
  foreign key (organization_id, facility_id, resident_id) references care.residents(organization_id, facility_id, id),
  unique (organization_id, facility_id, staff_profile_id, resident_id)
);

create table if not exists care.care_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  facility_id uuid not null,
  resident_id uuid not null,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'superseded', 'archived')),
  summary text,
  goals jsonb not null default '[]'::jsonb,
  reviewed_at date,
  next_review_at date,
  signed_at timestamptz,
  approved_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  foreign key (organization_id, facility_id, resident_id) references care.residents(organization_id, facility_id, id)
);

create unique index if not exists care_one_active_plan_per_resident
on care.care_plans(organization_id, facility_id, resident_id)
where status = 'active';

create table if not exists care.medications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  facility_id uuid not null,
  resident_id uuid not null,
  name text not null,
  dosage text,
  route text,
  frequency text,
  status text not null default 'active' check (status in ('active', 'held', 'stopped', 'archived')),
  start_date date,
  stop_date date,
  prescriber text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (organization_id, facility_id, id),
  foreign key (organization_id, facility_id, resident_id) references care.residents(organization_id, facility_id, id)
);

create table if not exists care.medication_administrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  facility_id uuid not null,
  resident_id uuid not null,
  medication_id uuid not null,
  scheduled_for timestamptz not null,
  outcome text not null default 'due' check (outcome in ('due', 'administered', 'held', 'refused', 'missed', 'cancelled')),
  administered_at timestamptz,
  administered_by uuid,
  note text,
  created_at timestamptz not null default now(),
  foreign key (organization_id, facility_id, resident_id) references care.residents(organization_id, facility_id, id),
  foreign key (organization_id, facility_id, medication_id) references care.medications(organization_id, facility_id, id)
);

create table if not exists care.progress_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  facility_id uuid not null,
  resident_id uuid not null,
  note_type text not null default 'shift',
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'signed', 'voided')),
  occurred_at timestamptz not null default now(),
  signed_at timestamptz,
  signed_by uuid,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  foreign key (organization_id, facility_id, resident_id) references care.residents(organization_id, facility_id, id)
);

create table if not exists care.incident_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  facility_id uuid not null,
  resident_id uuid,
  incident_type text not null,
  severity text not null default 'low' check (severity in ('low', 'moderate', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'under_review', 'closed', 'voided')),
  occurred_at timestamptz not null,
  summary text not null,
  follow_up_due_at date,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  foreign key (organization_id, facility_id) references care.facilities(organization_id, id),
  foreign key (organization_id, facility_id, resident_id) references care.residents(organization_id, facility_id, id)
);

create table if not exists care.drug_disposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  facility_id uuid not null,
  resident_id uuid,
  medication_name text not null,
  quantity text not null,
  reason text not null,
  status text not null default 'recorded' check (status in ('recorded', 'reviewed', 'voided')),
  disposed_at timestamptz not null default now(),
  witness_name text,
  created_at timestamptz not null default now(),
  created_by uuid,
  foreign key (organization_id, facility_id) references care.facilities(organization_id, id),
  foreign key (organization_id, facility_id, resident_id) references care.residents(organization_id, facility_id, id)
);

create table if not exists care.evacuation_drills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  facility_id uuid not null,
  drill_type text not null,
  status text not null default 'completed' check (status in ('scheduled', 'completed', 'cancelled')),
  occurred_at timestamptz not null,
  duration_minutes integer,
  summary text,
  created_at timestamptz not null default now(),
  created_by uuid,
  foreign key (organization_id, facility_id) references care.facilities(organization_id, id)
);

create table if not exists care.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  facility_id uuid not null,
  user_id uuid references care.users(id),
  title text not null,
  body text not null,
  status text not null default 'unread' check (status in ('unread', 'read', 'archived')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  foreign key (organization_id, facility_id) references care.facilities(organization_id, id)
);

create table if not exists care.announcements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  facility_id uuid not null,
  title text not null,
  body text not null,
  audience text not null default 'all' check (audience in ('all', 'admin', 'staff')),
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  foreign key (organization_id, facility_id) references care.facilities(organization_id, id)
);

create table if not exists care.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  facility_id uuid not null,
  resident_id uuid,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  created_by uuid,
  foreign key (organization_id, facility_id) references care.facilities(organization_id, id),
  foreign key (organization_id, facility_id, resident_id) references care.residents(organization_id, facility_id, id)
);

create table if not exists care.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  facility_id uuid not null,
  resident_id uuid,
  document_type text not null,
  title text not null,
  object_key text not null,
  sha256 text,
  status text not null default 'active' check (status in ('active', 'archived', 'revoked')),
  created_at timestamptz not null default now(),
  created_by uuid,
  foreign key (organization_id, facility_id) references care.facilities(organization_id, id),
  foreign key (organization_id, facility_id, resident_id) references care.residents(organization_id, facility_id, id)
);

create table if not exists care.admission_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  facility_id uuid not null,
  case_number text not null,
  candidate_first_name text not null,
  candidate_last_name text not null,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'admitted', 'archived')),
  current_step text,
  answers jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  foreign key (organization_id, facility_id) references care.facilities(organization_id, id),
  unique (organization_id, facility_id, case_number)
);

create table if not exists care.roi_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  facility_id uuid not null,
  resident_id uuid not null,
  recipient text not null,
  purpose text not null,
  status text not null default 'active' check (status in ('draft', 'active', 'revoked', 'expired')),
  effective_at date,
  expires_at date,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  foreign key (organization_id, facility_id, resident_id) references care.residents(organization_id, facility_id, id)
);

create table if not exists care.discharge_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  facility_id uuid not null,
  resident_id uuid not null,
  status text not null default 'draft' check (status in ('draft', 'completed', 'voided')),
  discharge_date date,
  destination text,
  summary text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  foreign key (organization_id, facility_id, resident_id) references care.residents(organization_id, facility_id, id)
);

create table if not exists audit_log.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  facility_id uuid,
  occurred_at timestamptz not null default now(),
  actor_user_id uuid,
  actor_staff_id uuid,
  session_id uuid,
  action text not null,
  target_type text,
  target_id uuid,
  outcome text not null default 'success' check (outcome in ('success', 'failure', 'denied')),
  reason text,
  correlation_id text,
  request_id text,
  source_ip text,
  metadata jsonb not null default '{}'::jsonb,
  previous_hash text,
  event_hash text
);

create table if not exists care.outbox_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  facility_id uuid,
  aggregate_type text not null,
  aggregate_id uuid not null,
  event_type text not null,
  event_version integer not null default 1,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  available_at timestamptz not null default now(),
  published_at timestamptz,
  attempts integer not null default 0,
  unique (id)
);

create table if not exists care.idempotency_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  actor_id uuid not null,
  operation text not null,
  key_hash text not null,
  request_hash text not null,
  response_status integer,
  response_body_ref text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (organization_id, actor_id, operation, key_hash)
);

create index if not exists care_residents_scope_status_idx
  on care.residents(organization_id, facility_id, status, updated_at desc);
create index if not exists care_care_plans_resident_idx
  on care.care_plans(organization_id, facility_id, resident_id, updated_at desc);
create index if not exists care_progress_notes_resident_idx
  on care.progress_notes(organization_id, facility_id, resident_id, occurred_at desc);
create index if not exists care_med_admin_due_idx
  on care.medication_administrations(organization_id, facility_id, outcome, scheduled_for);
create index if not exists care_outbox_ready_idx
  on care.outbox_events(available_at, id) where published_at is null;
create index if not exists audit_events_target_idx
  on audit_log.audit_events(organization_id, target_type, target_id, occurred_at desc);

alter table care.organizations enable row level security;
alter table care.facilities enable row level security;
alter table care.users enable row level security;
alter table care.organization_memberships enable row level security;
alter table care.facility_memberships enable row level security;
alter table care.sessions enable row level security;
alter table care.staff_profiles enable row level security;
alter table care.residents enable row level security;
alter table care.staff_assignments enable row level security;
alter table care.care_plans enable row level security;
alter table care.medications enable row level security;
alter table care.medication_administrations enable row level security;
alter table care.progress_notes enable row level security;
alter table care.incident_reports enable row level security;
alter table care.drug_disposals enable row level security;
alter table care.evacuation_drills enable row level security;
alter table care.notifications enable row level security;
alter table care.announcements enable row level security;
alter table care.appointments enable row level security;
alter table care.documents enable row level security;
alter table care.admission_cases enable row level security;
alter table care.roi_records enable row level security;
alter table care.discharge_records enable row level security;
alter table audit_log.audit_events enable row level security;
alter table care.outbox_events enable row level security;
alter table care.idempotency_records enable row level security;

create policy organizations_scope on care.organizations
  using (id = app.current_organization_id())
  with check (id = app.current_organization_id());

create policy users_self on care.users
  using (id = app.current_user_id())
  with check (id = app.current_user_id());

create policy facilities_scope on care.facilities
  using (organization_id = app.current_organization_id() and id = app.current_facility_id())
  with check (organization_id = app.current_organization_id() and id = app.current_facility_id());

create policy organization_memberships_scope on care.organization_memberships
  using (organization_id = app.current_organization_id())
  with check (organization_id = app.current_organization_id());

create policy facility_memberships_scope on care.facility_memberships
  using (organization_id = app.current_organization_id() and facility_id = app.current_facility_id())
  with check (organization_id = app.current_organization_id() and facility_id = app.current_facility_id());

create policy sessions_self on care.sessions
  using (user_id = app.current_user_id())
  with check (user_id = app.current_user_id());

create policy staff_profiles_scope on care.staff_profiles
  using (organization_id = app.current_organization_id() and facility_id = app.current_facility_id())
  with check (organization_id = app.current_organization_id() and facility_id = app.current_facility_id());

create policy residents_scope on care.residents
  using (organization_id = app.current_organization_id() and facility_id = app.current_facility_id())
  with check (organization_id = app.current_organization_id() and facility_id = app.current_facility_id());

create policy staff_assignments_scope on care.staff_assignments
  using (organization_id = app.current_organization_id() and facility_id = app.current_facility_id())
  with check (organization_id = app.current_organization_id() and facility_id = app.current_facility_id());

create policy care_plans_scope on care.care_plans
  using (organization_id = app.current_organization_id() and facility_id = app.current_facility_id())
  with check (organization_id = app.current_organization_id() and facility_id = app.current_facility_id());

create policy medications_scope on care.medications
  using (organization_id = app.current_organization_id() and facility_id = app.current_facility_id())
  with check (organization_id = app.current_organization_id() and facility_id = app.current_facility_id());

create policy medication_administrations_scope on care.medication_administrations
  using (organization_id = app.current_organization_id() and facility_id = app.current_facility_id())
  with check (organization_id = app.current_organization_id() and facility_id = app.current_facility_id());

create policy progress_notes_scope on care.progress_notes
  using (organization_id = app.current_organization_id() and facility_id = app.current_facility_id())
  with check (organization_id = app.current_organization_id() and facility_id = app.current_facility_id());

create policy incident_reports_scope on care.incident_reports
  using (organization_id = app.current_organization_id() and facility_id = app.current_facility_id())
  with check (organization_id = app.current_organization_id() and facility_id = app.current_facility_id());

create policy drug_disposals_scope on care.drug_disposals
  using (organization_id = app.current_organization_id() and facility_id = app.current_facility_id())
  with check (organization_id = app.current_organization_id() and facility_id = app.current_facility_id());

create policy evacuation_drills_scope on care.evacuation_drills
  using (organization_id = app.current_organization_id() and facility_id = app.current_facility_id())
  with check (organization_id = app.current_organization_id() and facility_id = app.current_facility_id());

create policy notifications_scope on care.notifications
  using (organization_id = app.current_organization_id() and facility_id = app.current_facility_id())
  with check (organization_id = app.current_organization_id() and facility_id = app.current_facility_id());

create policy announcements_scope on care.announcements
  using (organization_id = app.current_organization_id() and facility_id = app.current_facility_id())
  with check (organization_id = app.current_organization_id() and facility_id = app.current_facility_id());

create policy appointments_scope on care.appointments
  using (organization_id = app.current_organization_id() and facility_id = app.current_facility_id())
  with check (organization_id = app.current_organization_id() and facility_id = app.current_facility_id());

create policy documents_scope on care.documents
  using (organization_id = app.current_organization_id() and facility_id = app.current_facility_id())
  with check (organization_id = app.current_organization_id() and facility_id = app.current_facility_id());

create policy admission_cases_scope on care.admission_cases
  using (organization_id = app.current_organization_id() and facility_id = app.current_facility_id())
  with check (organization_id = app.current_organization_id() and facility_id = app.current_facility_id());

create policy roi_records_scope on care.roi_records
  using (organization_id = app.current_organization_id() and facility_id = app.current_facility_id())
  with check (organization_id = app.current_organization_id() and facility_id = app.current_facility_id());

create policy discharge_records_scope on care.discharge_records
  using (organization_id = app.current_organization_id() and facility_id = app.current_facility_id())
  with check (organization_id = app.current_organization_id() and facility_id = app.current_facility_id());

create policy audit_events_scope on audit_log.audit_events
  using (organization_id = app.current_organization_id() and (facility_id is null or facility_id = app.current_facility_id()))
  with check (organization_id = app.current_organization_id() and (facility_id is null or facility_id = app.current_facility_id()));

create policy outbox_events_scope on care.outbox_events
  using (organization_id = app.current_organization_id() and (facility_id is null or facility_id = app.current_facility_id()))
  with check (organization_id = app.current_organization_id() and (facility_id is null or facility_id = app.current_facility_id()));

create policy idempotency_records_scope on care.idempotency_records
  using (organization_id = app.current_organization_id() and actor_id = app.current_user_id())
  with check (organization_id = app.current_organization_id() and actor_id = app.current_user_id());
