create or replace function app.login_identity(p_email text)
returns table (
  user_id uuid,
  email text,
  display_name text,
  password_hash text,
  user_status text,
  organization_id uuid,
  facility_id uuid,
  role text,
  staff_profile_id uuid
)
language sql
stable
security definer
set search_path = care, app, public
as $$
  select
    u.id,
    u.email,
    u.display_name,
    u.password_hash,
    u.status,
    fm.organization_id,
    fm.facility_id,
    fm.role,
    sp.id
  from care.users u
  join care.facility_memberships fm
    on fm.user_id = u.id
   and fm.status = 'active'
   and now() >= fm.valid_from
   and (fm.valid_until is null or fm.valid_until > now())
  left join care.staff_profiles sp
    on sp.organization_id = fm.organization_id
   and sp.facility_id = fm.facility_id
   and sp.user_id = u.id
   and sp.status = 'active'
  where lower(u.email) = lower(trim(p_email))
    and u.status = 'active'
  order by
    case fm.role
      when 'admin' then 1
      when 'manager' then 2
      when 'staff' then 3
      else 4
    end
  limit 1;
$$;

create or replace function app.refresh_identity(
  p_user_id uuid,
  p_organization_id uuid,
  p_facility_id uuid
)
returns table (
  user_id uuid,
  email text,
  display_name text,
  organization_id uuid,
  facility_id uuid,
  role text,
  staff_profile_id uuid
)
language sql
stable
security definer
set search_path = care, app, public
as $$
  select
    u.id,
    u.email,
    u.display_name,
    fm.organization_id,
    fm.facility_id,
    fm.role,
    sp.id
  from care.users u
  join care.facility_memberships fm
    on fm.user_id = u.id
   and fm.organization_id = p_organization_id
   and fm.facility_id = p_facility_id
   and fm.status = 'active'
   and now() >= fm.valid_from
   and (fm.valid_until is null or fm.valid_until > now())
  left join care.staff_profiles sp
    on sp.organization_id = fm.organization_id
   and sp.facility_id = fm.facility_id
   and sp.user_id = u.id
   and sp.status = 'active'
  where u.id = p_user_id
    and u.status = 'active'
  limit 1;
$$;
