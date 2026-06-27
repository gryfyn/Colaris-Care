-- 0011_fix_provision_tenant.sql
-- Fix: the OUT columns organization_id/facility_id collided with table column
-- names inside the function body ("column reference is ambiguous"). Rename the
-- outputs to out_* so the inserts are unambiguous.

drop function if exists app.provision_tenant(text, text, text, text, text, text, text, text, integer, text, text);

create function app.provision_tenant(
  p_token text, p_org_name text, p_facility_name text, p_legal_name text,
  p_address text, p_phone text, p_email text, p_timezone text,
  p_capacity integer, p_theme text, p_layout text
) returns table(out_organization_id uuid, out_facility_id uuid)
language plpgsql security definer set search_path = app, care, public as $$
declare v_s app.signups%rowtype; v_org uuid; v_fac uuid; v_user uuid; v_slug text; v_code text;
begin
  select * into v_s from app.signups where verification_token = p_token and completed_at is null;
  if not found then raise exception 'INVALID_SIGNUP'; end if;
  if v_s.verified_at is null then raise exception 'NOT_VERIFIED'; end if;
  if coalesce(trim(p_facility_name), '') = '' then raise exception 'FACILITY_NAME_REQUIRED'; end if;

  v_slug := left(regexp_replace(lower(coalesce(nullif(p_org_name, ''), p_facility_name)), '[^a-z0-9]+', '-', 'g'), 40) || '-' || substr(md5(random()::text), 1, 6);
  v_code := upper(left(regexp_replace(p_facility_name, '[^a-zA-Z0-9]', '', 'g'), 4)) || '-' || substr(md5(random()::text), 1, 4);

  insert into care.organizations(name, slug, status, default_timezone)
    values (coalesce(nullif(p_org_name, ''), p_facility_name), v_slug, 'active', coalesce(nullif(p_timezone, ''), 'America/New_York'))
    returning id into v_org;

  insert into care.facilities(organization_id, name, code, timezone, status, settings)
    values (v_org, p_facility_name, v_code, coalesce(nullif(p_timezone, ''), 'America/New_York'), 'active',
      jsonb_strip_nulls(jsonb_build_object(
        'legalName', nullif(p_legal_name, ''), 'address', nullif(p_address, ''),
        'phone', nullif(p_phone, ''), 'email', nullif(p_email, ''),
        'licensedCapacity', p_capacity, 'theme', nullif(p_theme, ''), 'layout', nullif(p_layout, ''))))
    returning id into v_fac;

  insert into care.users(email, display_name, password_hash, status)
    values (v_s.email, coalesce(nullif(v_s.display_name, ''), v_s.email), v_s.password_hash, 'active')
    on conflict (email) do update set status = 'active', password_hash = excluded.password_hash, display_name = excluded.display_name
    returning id into v_user;

  insert into care.facility_memberships(organization_id, facility_id, user_id, role, status)
    values (v_org, v_fac, v_user, 'admin', 'active')
    on conflict (organization_id, facility_id, user_id) do update set role = 'admin', status = 'active';

  update app.signups set completed_at = now(), organization_id = v_org, facility_id = v_fac where id = v_s.id;

  out_organization_id := v_org; out_facility_id := v_fac; return next;
end; $$;

grant execute on function app.provision_tenant(text, text, text, text, text, text, text, text, integer, text, text) to colaris_app;
