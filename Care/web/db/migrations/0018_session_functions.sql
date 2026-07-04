-- 0018_session_functions.sql
-- SECURITY DEFINER accessors for session tracking + sign-in activity.
--
-- The runtime role (colaris_app) does NOT bypass RLS, and care.sessions,
-- care.users and audit_log.audit_events use FORCE ROW LEVEL SECURITY. The
-- login/refresh/logout writes happen with no request context (pre-auth), so —
-- exactly like app.login_identity — they must go through definer functions
-- owned by the RLS-bypassing owner. Reads are scoped to p_user_id inside the
-- function so a caller can only ever see their own rows.

create or replace function app.session_record(
  p_user_id uuid, p_org uuid, p_fac uuid, p_token_hash text,
  p_expires_at timestamptz, p_user_agent text, p_ip text
) returns void
language sql security definer set search_path = care, app, public as $$
  insert into care.sessions(user_id, organization_id, facility_id, token_hash, expires_at, user_agent, source_ip, last_seen_at)
  values (p_user_id, p_org, p_fac, p_token_hash, p_expires_at, p_user_agent, p_ip, now())
  on conflict (token_hash) do nothing;
$$;

create or replace function app.session_rotate(p_old_hash text, p_new_hash text, p_expires_at timestamptz)
returns void
language sql security definer set search_path = care, app, public as $$
  update care.sessions set token_hash = p_new_hash, last_seen_at = now(), expires_at = p_expires_at
   where token_hash = p_old_hash and revoked_at is null;
$$;

create or replace function app.session_revoke_by_token(p_token_hash text)
returns void
language sql security definer set search_path = care, app, public as $$
  update care.sessions set revoked_at = now() where token_hash = p_token_hash and revoked_at is null;
$$;

create or replace function app.session_revoke(p_user_id uuid, p_session_id uuid)
returns boolean
language plpgsql security definer set search_path = care, app, public as $$
declare v_count integer;
begin
  update care.sessions set revoked_at = now()
   where id = p_session_id and user_id = p_user_id and revoked_at is null;
  get diagnostics v_count = row_count;
  return v_count > 0;
end; $$;

create or replace function app.session_list(p_user_id uuid)
returns table(id uuid, token_hash text, user_agent text, source_ip text, issued_at timestamptz, last_seen_at timestamptz)
language sql stable security definer set search_path = care, app, public as $$
  select id, token_hash, user_agent, source_ip, issued_at, last_seen_at
    from care.sessions
   where user_id = p_user_id and revoked_at is null and expires_at > now()
   order by last_seen_at desc nulls last, issued_at desc
   limit 50;
$$;

create or replace function app.auth_event_log(p_org uuid, p_fac uuid, p_user_id uuid, p_outcome text, p_ip text, p_metadata jsonb)
returns void
language sql security definer set search_path = care, audit_log, app, public as $$
  insert into audit_log.audit_events(organization_id, facility_id, actor_user_id, action, outcome, source_ip, metadata)
  values (p_org, p_fac, p_user_id, 'auth:login', p_outcome, p_ip, coalesce(p_metadata, '{}'::jsonb));
$$;

create or replace function app.auth_event_list(p_user_id uuid)
returns table(occurred_at timestamptz, outcome text, source_ip text, metadata jsonb)
language sql stable security definer set search_path = care, audit_log, app, public as $$
  select occurred_at, outcome, source_ip, metadata
    from audit_log.audit_events
   where actor_user_id = p_user_id and action = 'auth:login'
   order by occurred_at desc
   limit 20;
$$;

grant execute on function app.session_record(uuid, uuid, uuid, text, timestamptz, text, text) to colaris_app;
grant execute on function app.session_rotate(text, text, timestamptz) to colaris_app;
grant execute on function app.session_revoke_by_token(text) to colaris_app;
grant execute on function app.session_revoke(uuid, uuid) to colaris_app;
grant execute on function app.session_list(uuid) to colaris_app;
grant execute on function app.auth_event_log(uuid, uuid, uuid, text, text, jsonb) to colaris_app;
grant execute on function app.auth_event_list(uuid) to colaris_app;
