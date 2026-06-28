-- 0012_staff_login_provisioning.sql
-- Let an admin issue a real staff login scoped to THEIR facility. SECURITY
-- DEFINER so it can create the global care.users row + membership, but it only
-- ever writes the org/facility the API passes from the admin's own token — so a
-- new staff login is born scoped to exactly that facility and nothing else.

create or replace function app.provision_staff_login(
  p_org uuid, p_fac uuid, p_email text, p_display_name text, p_password_hash text
) returns table(out_user_id uuid, out_created boolean)
language plpgsql security definer set search_path = app, care, public as $$
declare v_user uuid; v_created boolean := false;
begin
  if coalesce(trim(p_email), '') = '' then raise exception 'EMAIL_REQUIRED'; end if;

  select id into v_user from care.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_user is null then
    insert into care.users(email, display_name, password_hash, status)
      values (lower(trim(p_email)), coalesce(nullif(p_display_name, ''), p_email), p_password_hash, 'active')
      returning id into v_user;
    v_created := true;
  else
    -- Existing account: link it to this facility, never reset its password.
    update care.users set status = 'active' where id = v_user and status <> 'active';
  end if;

  insert into care.facility_memberships(organization_id, facility_id, user_id, role, status)
    values (p_org, p_fac, v_user, 'staff', 'active')
    on conflict (organization_id, facility_id, user_id) do update set status = 'active';

  out_user_id := v_user; out_created := v_created; return next;
end; $$;

grant execute on function app.provision_staff_login(uuid, uuid, text, text, text) to colaris_app;
