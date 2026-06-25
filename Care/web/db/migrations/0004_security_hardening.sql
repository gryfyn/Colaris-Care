-- 0004_security_hardening.sql
-- FIX PASS 2 — database security hardening.
--
-- This migration is additive and idempotent. It does NOT recreate the tables in
-- 0001/0003; it tightens what is already there:
--   FIX A — force row level security on every tenant-scoped table.
--   FIX B — replace the permissive app.set_request_context with a validated
--           SECURITY DEFINER function.
--   FIX C — move residents.ssn_last4 to envelope-encrypted columns and drop the
--           plaintext column.
-- (FIX D — least-privilege runtime role — lives in scripts/apply-runtime-grants.mjs.)

-- ---------------------------------------------------------------------------
-- FIX A — Forced RLS
-- ---------------------------------------------------------------------------
-- ENABLE makes a role obey policies; it does NOT bind the table OWNER. FORCE
-- removes the owner exemption, so even the role that owns the table (and the app
-- role, whatever its privileges) is filtered by the policies below. Every
-- tenant-scoped table (organization_id / facility_id) is listed explicitly, plus
-- the identity tables that already carry self-scoping policies, so nothing relies
-- on an implicit owner bypass.
--
-- NOTE: the SECURITY DEFINER functions in this schema (app.set_request_context,
-- app.login_identity, app.refresh_identity) read the identity tables BEFORE any
-- tenant GUC is set. With FORCE RLS in effect those functions only work when their
-- OWNER bypasses RLS — i.e. they must be owned by the migration/owner role, which
-- carries BYPASSRLS (or is a superuser). The app runtime role must NOT own them and
-- must NOT have BYPASSRLS (see scripts/apply-runtime-grants.mjs and
-- docs/DATABASE_SECURITY_VERIFICATION.md).

do $$
declare
  t text;
  tenant_tables text[] := array[
    -- organization / facility scoped
    'care.organizations',
    'care.facilities',
    'care.organization_memberships',
    'care.facility_memberships',
    'care.staff_profiles',
    'care.residents',
    'care.staff_assignments',
    'care.care_plans',
    'care.medications',
    'care.medication_administrations',
    'care.progress_notes',
    'care.incident_reports',
    'care.drug_disposals',
    'care.evacuation_drills',
    'care.notifications',
    'care.announcements',
    'care.appointments',
    'care.documents',
    'care.admission_cases',
    'care.roi_records',
    'care.discharge_records',
    'care.resident_requests',
    'care.outbox_events',
    'care.idempotency_records',
    'audit_log.audit_events',
    -- global identity tables (self / membership scoped policies already exist)
    'care.users',
    'care.sessions'
  ];
begin
  foreach t in array tenant_tables loop
    -- care.resident_requests is created in 0003; guard so this migration can run
    -- even if an optional table is absent.
    if to_regclass(t) is not null then
      execute format('alter table %s enable row level security', t);
      execute format('alter table %s force row level security', t);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- FIX B — Validated request-context function
-- ---------------------------------------------------------------------------
-- Replaces the permissive setter that trusted raw ids. The signature is
-- unchanged (uuid, uuid, uuid, uuid, text) and the GUC names are unchanged, so
-- src/lib/db.js withRequestContext() and the existing grants keep working.
--
-- The caller is validated BEFORE any GUC is set:
--   * the user exists and is active;
--   * the user is a member of the organization (organization OR facility
--     membership, both honored because the stateless JWT is minted from
--     facility_memberships in app.login_identity);
--   * a supplied facility belongs to the organization AND the user has access to
--     it (facility membership, or an org-level membership);
--   * a supplied action is recognized (module:verb shape).
-- On any failure it RAISEs and the surrounding transaction rolls back, so a query
-- can never run with unvalidated tenant context.
--
-- Sessions: the current login is STATELESS RS256 JWT (verified for expiry by the
-- app before this is called) and does NOT persist care.sessions rows, so a session
-- row is NOT required. Session validation is therefore optional; if/when a
-- session id is threaded through, it can be validated here without changing the
-- callers. The GUC names below are exactly what app.current_* and SET LOCAL read.

create or replace function app.set_request_context(
  p_user_id uuid,
  p_staff_id uuid,
  p_organization_id uuid,
  p_facility_id uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = care, app, public
as $$
declare
  v_user_active boolean;
  v_is_member boolean;
  v_facility_in_org boolean;
  v_facility_access boolean;
begin
  -- Identity is mandatory: no anonymous tenant context.
  if p_user_id is null then
    raise exception 'set_request_context: user id is required'
      using errcode = 'check_violation';
  end if;
  if p_organization_id is null then
    raise exception 'set_request_context: organization id is required'
      using errcode = 'check_violation';
  end if;

  -- 1. User exists and is active.
  select (u.status = 'active') into v_user_active
    from care.users u
   where u.id = p_user_id;
  if v_user_active is distinct from true then
    raise exception 'set_request_context: user % is not active or does not exist', p_user_id
      using errcode = 'insufficient_privilege';
  end if;

  -- 2. User is a member of the organization (org membership OR any facility
  --    membership inside the org — both confer org membership).
  select exists (
    select 1
      from care.organization_memberships om
     where om.organization_id = p_organization_id
       and om.user_id = p_user_id
       and om.status = 'active'
       and now() >= om.valid_from
       and (om.valid_until is null or om.valid_until > now())
  ) or exists (
    select 1
      from care.facility_memberships fm
     where fm.organization_id = p_organization_id
       and fm.user_id = p_user_id
       and fm.status = 'active'
       and now() >= fm.valid_from
       and (fm.valid_until is null or fm.valid_until > now())
  ) into v_is_member;
  if not v_is_member then
    raise exception 'set_request_context: user % is not an active member of organization %', p_user_id, p_organization_id
      using errcode = 'insufficient_privilege';
  end if;

  -- 3. A supplied facility must belong to the organization AND be reachable by
  --    the user (facility membership, or an org-level membership).
  if p_facility_id is not null then
    select exists (
      select 1
        from care.facilities f
       where f.id = p_facility_id
         and f.organization_id = p_organization_id
    ) into v_facility_in_org;
    if not v_facility_in_org then
      raise exception 'set_request_context: facility % is not in organization %', p_facility_id, p_organization_id
        using errcode = 'insufficient_privilege';
    end if;

    select exists (
      select 1
        from care.facility_memberships fm
       where fm.organization_id = p_organization_id
         and fm.facility_id = p_facility_id
         and fm.user_id = p_user_id
         and fm.status = 'active'
         and now() >= fm.valid_from
         and (fm.valid_until is null or fm.valid_until > now())
    ) or exists (
      select 1
        from care.organization_memberships om
       where om.organization_id = p_organization_id
         and om.user_id = p_user_id
         and om.status = 'active'
         and now() >= om.valid_from
         and (om.valid_until is null or om.valid_until > now())
    ) into v_facility_access;
    if not v_facility_access then
      raise exception 'set_request_context: user % has no access to facility %', p_user_id, p_facility_id
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  -- 4. A supplied action must be a recognized module:verb identifier.
  if p_action is not null and p_action <> ''
     and p_action !~ '^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$' then
    raise exception 'set_request_context: unrecognized action %', p_action
      using errcode = 'check_violation';
  end if;

  -- Validation passed — set the transaction-local context the app reads back.
  perform set_config('app.user_id', p_user_id::text, true);
  perform set_config('app.staff_id', coalesce(p_staff_id::text, ''), true);
  perform set_config('app.organization_id', p_organization_id::text, true);
  perform set_config('app.facility_id', coalesce(p_facility_id::text, ''), true);
  perform set_config('app.action', coalesce(p_action, ''), true);
end;
$$;

-- Do not let arbitrary roles call the setter; the runtime role is granted
-- EXECUTE explicitly in scripts/apply-runtime-grants.mjs.
revoke all on function app.set_request_context(uuid, uuid, uuid, uuid, text) from public;

-- ---------------------------------------------------------------------------
-- FIX C — Envelope encryption for residents.ssn_last4
-- ---------------------------------------------------------------------------
-- Application-level AES-256-GCM envelope encryption (src/lib/encryption.js), with
-- AAD bound to (organization, facility, table, row, field) per
-- docs/DATABASE_SCHEMA.md §8. The plaintext column is dropped so no SSN digits are
-- ever stored at rest.
--   ssn_last4_ciphertext   base64(iv|tag|ciphertext) produced by encryptPHI
--   ssn_last4_key_version  cipher/key version for rotation
--   ssn_last4_lookup_hash  tenant-keyed deterministic HMAC for equality search
alter table care.residents
  add column if not exists ssn_last4_ciphertext text,
  add column if not exists ssn_last4_key_version smallint,
  add column if not exists ssn_last4_lookup_hash text;

create index if not exists care_residents_ssn_lookup_idx
  on care.residents(organization_id, facility_id, ssn_last4_lookup_hash)
  where ssn_last4_lookup_hash is not null;

-- Remove the plaintext PHI column. Seed data carries no real SSNs and the live
-- routes now read/write only the encrypted columns above.
alter table care.residents drop column if exists ssn_last4;
