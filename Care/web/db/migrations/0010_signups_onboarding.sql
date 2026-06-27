-- 0010_signups_onboarding.sql
-- Self-serve signup + onboarding. Pre-tenant data lives in app.signups (outside
-- the care tenant schema, so the RLS-enforced runtime role never reads password
-- hashes directly). All access goes through SECURITY DEFINER functions, which
-- also let provisioning create a brand-new org/facility/admin (bypassing RLS,
-- since there is no tenant context yet).

create table if not exists app.signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  display_name text,
  verification_token text,
  verified_at timestamptz,
  completed_at timestamptz,
  organization_id uuid,
  facility_id uuid,
  created_at timestamptz not null default now()
);
create unique index if not exists app_signups_email_active on app.signups (lower(email)) where completed_at is null;
create index if not exists app_signups_token on app.signups (verification_token);

-- Create a pending signup (rejects emails that already have an active user).
create or replace function app.signup_create(p_email text, p_password_hash text, p_display_name text, p_token text)
returns uuid language plpgsql security definer set search_path = app, care, public as $$
declare v_id uuid;
begin
  if exists (select 1 from care.users where lower(email) = lower(trim(p_email)) and status = 'active') then
    raise exception 'EMAIL_EXISTS';
  end if;
  delete from app.signups where lower(email) = lower(trim(p_email)) and completed_at is null;
  insert into app.signups(email, password_hash, display_name, verification_token)
    values (lower(trim(p_email)), p_password_hash, p_display_name, p_token)
    returning id into v_id;
  return v_id;
end; $$;

-- Mark a signup's email verified; returns the email (null if token unknown).
create or replace function app.signup_verify(p_token text)
returns text language plpgsql security definer set search_path = app, care, public as $$
declare v_email text;
begin
  update app.signups set verified_at = coalesce(verified_at, now())
    where verification_token = p_token and completed_at is null
    returning email into v_email;
  return v_email;
end; $$;

-- Lightweight status lookup for the verify / onboarding screens.
create or replace function app.signup_status(p_token text)
returns table(email text, display_name text, verified boolean, completed boolean)
language sql stable security definer set search_path = app, care, public as $$
  select email, display_name, verified_at is not null, completed_at is not null
  from app.signups where verification_token = p_token limit 1;
$$;

-- Provision a new tenant from a verified signup: organization + facility + admin
-- user + membership. Idempotent on the user/membership. Returns the new ids.
create or replace function app.provision_tenant(
  p_token text, p_org_name text, p_facility_name text, p_legal_name text,
  p_address text, p_phone text, p_email text, p_timezone text,
  p_capacity integer, p_theme text, p_layout text
) returns table(organization_id uuid, facility_id uuid)
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

  organization_id := v_org; facility_id := v_fac; return next;
end; $$;

grant execute on function app.signup_create(text, text, text, text) to colaris_app;
grant execute on function app.signup_verify(text) to colaris_app;
grant execute on function app.signup_status(text) to colaris_app;
grant execute on function app.provision_tenant(text, text, text, text, text, text, text, text, integer, text, text) to colaris_app;
