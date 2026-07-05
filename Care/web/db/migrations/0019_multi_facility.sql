-- 0019_multi_facility.sql
-- Multi-home support: an admin/manager can belong to several facilities and
-- switch the active one. All access to the RLS-forced membership/facility tables
-- goes through app.* SECURITY DEFINER functions (the runtime role colaris_app
-- does not bypass RLS), scoped to the passed user id.

-- Facilities the user is an active member of (for the switcher + sidebar list).
create or replace function app.user_facilities(p_user_id uuid)
returns table(facility_id uuid, organization_id uuid, name text, role text)
language sql stable security definer set search_path = care, app, public
as $$
  select f.id, f.organization_id, f.name, fm.role
    from care.facility_memberships fm
    join care.facilities f
      on f.organization_id = fm.organization_id and f.id = fm.facility_id
   where fm.user_id = p_user_id
     and fm.status = 'active'
     and now() >= fm.valid_from
     and (fm.valid_until is null or fm.valid_until > now())
   order by f.name;
$$;

-- Identity for a specific facility the user belongs to (for switching). Returns
-- no rows if the user has no active membership for that facility — the caller
-- treats that as "not authorized".
create or replace function app.membership_identity(p_user_id uuid, p_facility_id uuid)
returns table(
  user_id uuid, email text, display_name text,
  organization_id uuid, facility_id uuid, role text, staff_profile_id uuid
)
language sql stable security definer set search_path = care, app, public
as $$
  select u.id, u.email, u.display_name, fm.organization_id, fm.facility_id, fm.role, sp.id
    from care.users u
    join care.facility_memberships fm
      on fm.user_id = u.id
     and fm.facility_id = p_facility_id
     and fm.status = 'active'
     and now() >= fm.valid_from
     and (fm.valid_until is null or fm.valid_until > now())
    left join care.staff_profiles sp
      on sp.organization_id = fm.organization_id
     and sp.facility_id = fm.facility_id
     and sp.user_id = u.id
     and sp.status = 'active'
   where u.id = p_user_id and u.status = 'active'
   limit 1;
$$;

-- Create a new home under the user's organization and enrol the user as admin.
-- Enforces the per-user active-membership cap (p_max). Returns the new facility.
create or replace function app.create_home(
  p_user_id uuid, p_org_id uuid, p_name text, p_timezone text, p_settings jsonb, p_max integer
) returns table(facility_id uuid, name text)
language plpgsql security definer set search_path = care, app, public
as $$
declare v_count integer; v_fac uuid; v_code text;
begin
  if coalesce(trim(p_name), '') = '' then raise exception 'FACILITY_NAME_REQUIRED'; end if;

  if not exists (
    select 1 from care.facility_memberships
     where user_id = p_user_id and organization_id = p_org_id and status = 'active'
  ) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select count(*) into v_count from care.facility_memberships
   where user_id = p_user_id and status = 'active'
     and now() >= valid_from and (valid_until is null or valid_until > now());
  if v_count >= coalesce(p_max, 3) then
    raise exception 'FACILITY_LIMIT_REACHED';
  end if;

  v_code := upper(left(regexp_replace(p_name, '[^a-zA-Z0-9]', '', 'g'), 4)) || '-' || substr(md5(random()::text), 1, 4);

  insert into care.facilities(organization_id, name, code, timezone, status, settings)
    values (p_org_id, p_name, v_code, coalesce(nullif(p_timezone, ''), 'America/New_York'), 'active', coalesce(p_settings, '{}'::jsonb))
    returning id into v_fac;

  insert into care.facility_memberships(organization_id, facility_id, user_id, role, status)
    values (p_org_id, v_fac, p_user_id, 'admin', 'active');

  facility_id := v_fac; name := p_name; return next;
end; $$;

grant execute on function app.user_facilities(uuid) to colaris_app;
grant execute on function app.membership_identity(uuid, uuid) to colaris_app;
grant execute on function app.create_home(uuid, uuid, text, text, jsonb, integer) to colaris_app;
