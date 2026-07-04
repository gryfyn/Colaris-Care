-- 0016_password_management.sql
-- Self-service password change + forgot/reset flow.
--
-- Like app.login_identity, all access to care.users password_hash happens through
-- app-schema SECURITY DEFINER functions so the RLS-enforced runtime role never
-- touches the table directly. Reset tokens are stored as a deterministic sha256
-- hash of a high-entropy random token; only the raw token goes in the email link.

create table if not exists app.password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references care.users(id),
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists app_password_resets_token on app.password_resets (token_hash);
create index if not exists app_password_resets_user on app.password_resets (user_id);

-- Read a user's current password hash (for verifying the current password on a
-- self-service change). Returns null for unknown / inactive users.
create or replace function app.user_password_hash(p_user_id uuid)
returns text
language sql stable security definer set search_path = care, app, public
as $$ select password_hash from care.users where id = p_user_id and status = 'active'; $$;

-- Set a user's password. Returns true when a row was updated.
create or replace function app.set_user_password(p_user_id uuid, p_new_hash text)
returns boolean
language plpgsql security definer set search_path = care, app, public
as $$
declare v_count integer;
begin
  update care.users set password_hash = p_new_hash, updated_at = now()
    where id = p_user_id and status = 'active';
  get diagnostics v_count = row_count;
  return v_count > 0;
end; $$;

-- Create a reset token for an active user. Invalidates that user's prior unused
-- tokens. Returns the user's email + display_name so the caller can send mail,
-- or no rows when the email has no active account (caller shows a generic reply).
create or replace function app.password_reset_create(p_email text, p_token_hash text, p_ttl_minutes integer)
returns table(email text, display_name text)
language plpgsql security definer set search_path = care, app, public
as $$
declare v_user care.users%rowtype;
begin
  select * into v_user from care.users
    where lower(email) = lower(trim(p_email)) and status = 'active' limit 1;
  if not found then return; end if;

  update app.password_resets set used_at = now()
    where user_id = v_user.id and used_at is null;

  insert into app.password_resets(user_id, token_hash, expires_at)
    values (v_user.id, p_token_hash, now() + make_interval(mins => coalesce(p_ttl_minutes, 30)));

  email := v_user.email; display_name := v_user.display_name; return next;
end; $$;

-- Consume a reset token: if valid (unused + unexpired) set the user's password
-- and mark the token used. Returns true on success.
create or replace function app.password_reset_consume(p_token_hash text, p_new_hash text)
returns boolean
language plpgsql security definer set search_path = care, app, public
as $$
declare v_rec app.password_resets%rowtype;
begin
  select * into v_rec from app.password_resets
    where token_hash = p_token_hash and used_at is null and expires_at > now()
    order by created_at desc limit 1;
  if not found then return false; end if;

  update care.users set password_hash = p_new_hash, updated_at = now()
    where id = v_rec.user_id and status = 'active';
  update app.password_resets set used_at = now() where id = v_rec.id;
  return true;
end; $$;

grant execute on function app.user_password_hash(uuid) to colaris_app;
grant execute on function app.set_user_password(uuid, text) to colaris_app;
grant execute on function app.password_reset_create(text, text, integer) to colaris_app;
grant execute on function app.password_reset_consume(text, text) to colaris_app;
