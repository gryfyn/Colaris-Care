create table if not exists care.resident_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references care.organizations(id),
  facility_id uuid not null references care.facilities(id),
  resident_id uuid references care.residents(id),
  request_type text not null,
  detail text not null,
  priority text not null default 'routine' check (priority in ('routine', 'soon', 'priority')),
  status text not null default 'new' check (status in ('new', 'in_progress', 'completed', 'cancelled')),
  assigned_staff_id uuid references care.staff_profiles(id),
  completed_at timestamptz,
  created_by uuid references care.users(id),
  updated_by uuid references care.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists resident_requests_facility_status_idx on care.resident_requests(facility_id, status, created_at desc);
create index if not exists resident_requests_resident_idx on care.resident_requests(resident_id);
create index if not exists resident_requests_assigned_staff_idx on care.resident_requests(assigned_staff_id);

alter table care.resident_requests enable row level security;

drop policy if exists resident_requests_tenant_isolation on care.resident_requests;
create policy resident_requests_tenant_isolation on care.resident_requests
  using (
    organization_id = nullif(current_setting('app.organization_id', true), '')::uuid
    and facility_id = nullif(current_setting('app.facility_id', true), '')::uuid
  )
  with check (
    organization_id = nullif(current_setting('app.organization_id', true), '')::uuid
    and facility_id = nullif(current_setting('app.facility_id', true), '')::uuid
  );
