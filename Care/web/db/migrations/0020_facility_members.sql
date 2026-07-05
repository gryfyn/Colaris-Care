-- 0020_facility_members.sql
-- Member management: an admin can add existing org users (e.g. a manager) to
-- more homes and remove them. All access via app.* SECURITY DEFINER functions
-- (RLS-forced membership tables); the actor must be an active admin of the
-- target facility. The per-user max-homes cap is enforced on add.

-- Members of a facility. Returns rows only when the actor is an active admin of
-- that facility.
create or replace function app.facility_members(p_actor uuid, p_facility uuid)
returns table(user_id uuid, name text, email text, role text, status text)
language sql stable security definer set search_path = care, app, public
as $$
  select u.id, u.display_name, u.email, fm.role, fm.status
    from care.facility_memberships fm
    join care.users u on u.id = fm.user_id
   where fm.facility_id = p_facility
     and exists (
       select 1 from care.facility_memberships a
        where a.user_id = p_actor and a.facility_id = p_facility
          and a.role = 'admin' and a.status = 'active'
          and now() >= a.valid_from and (a.valid_until is null or a.valid_until > now())
     )
   order by (fm.status <> 'active'), u.display_name;
$$;

-- Users in an org (candidates to add to a home). Actor must be an active admin
-- in the org. `homes` = count of the user's active facility memberships.
create or replace function app.org_users(p_actor uuid, p_org uuid)
returns table(user_id uuid, name text, email text, roles text, homes bigint)
language sql stable security definer set search_path = care, app, public
as $$
  select u.id, u.display_name, u.email,
         string_agg(distinct fm.role, ', ' order by fm.role),
         count(*) filter (where fm.status = 'active')
    from care.facility_memberships fm
    join care.users u on u.id = fm.user_id
   where fm.organization_id = p_org
     and exists (
       select 1 from care.facility_memberships a
        where a.user_id = p_actor and a.organization_id = p_org
          and a.role = 'admin' and a.status = 'active'
     )
   group by u.id, u.display_name, u.email
   order by u.display_name;
$$;

-- Add (or reactivate) a user's membership for a facility with a role. Enforces
-- the per-user max-homes cap. Actor must be an active admin of the facility.
create or replace function app.add_member(p_actor uuid, p_facility uuid, p_user uuid, p_role text, p_max integer)
returns boolean
language plpgsql security definer set search_path = care, app, public
as $$
declare v_org uuid; v_count integer;
begin
  select organization_id into v_org from care.facility_memberships
   where facility_id = p_facility and user_id = p_actor and role = 'admin' and status = 'active'
     and now() >= valid_from and (valid_until is null or valid_until > now())
   limit 1;
  if v_org is null then raise exception 'NOT_AUTHORIZED'; end if;
  if p_role not in ('admin', 'manager', 'staff') then raise exception 'INVALID_ROLE'; end if;
  if not exists (select 1 from care.users where id = p_user and status = 'active') then raise exception 'USER_NOT_FOUND'; end if;

  select count(*) into v_count from care.facility_memberships
   where user_id = p_user and status = 'active' and facility_id <> p_facility
     and now() >= valid_from and (valid_until is null or valid_until > now());
  if v_count >= coalesce(p_max, 3) then raise exception 'FACILITY_LIMIT_REACHED'; end if;

  insert into care.facility_memberships(organization_id, facility_id, user_id, role, status)
    values (v_org, p_facility, p_user, p_role, 'active')
    on conflict (organization_id, facility_id, user_id)
    do update set role = excluded.role, status = 'active', valid_until = null;
  return true;
end; $$;

-- Deactivate a user's membership for a facility. Actor must be an active admin of
-- the facility and cannot remove themselves.
create or replace function app.remove_member(p_actor uuid, p_facility uuid, p_user uuid)
returns boolean
language plpgsql security definer set search_path = care, app, public
as $$
begin
  if not exists (
    select 1 from care.facility_memberships
     where facility_id = p_facility and user_id = p_actor and role = 'admin' and status = 'active'
  ) then raise exception 'NOT_AUTHORIZED'; end if;
  if p_actor = p_user then raise exception 'CANNOT_REMOVE_SELF'; end if;

  update care.facility_memberships set status = 'inactive'
   where facility_id = p_facility and user_id = p_user and status = 'active';
  return found;
end; $$;

grant execute on function app.facility_members(uuid, uuid) to colaris_app;
grant execute on function app.org_users(uuid, uuid) to colaris_app;
grant execute on function app.add_member(uuid, uuid, uuid, text, integer) to colaris_app;
grant execute on function app.remove_member(uuid, uuid, uuid) to colaris_app;
