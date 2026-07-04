-- 0017_session_tracking.sql
-- Give care.sessions the device/context columns needed to power the Settings
-- "Security & sessions" tab with real data. Sessions are written on login,
-- rotated on refresh, and revoked on logout / manual sign-out. Sign-in activity
-- is read from audit_log.audit_events (action = 'auth:login').

alter table care.sessions add column if not exists user_agent text;
alter table care.sessions add column if not exists source_ip text;
alter table care.sessions add column if not exists last_seen_at timestamptz;

create index if not exists care_sessions_user_active
  on care.sessions(user_id, last_seen_at desc)
  where revoked_at is null;

create index if not exists audit_events_actor_login_idx
  on audit_log.audit_events(actor_user_id, occurred_at desc)
  where action = 'auth:login';
