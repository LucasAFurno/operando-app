-- Session hardening (Codex P1 / Eustekio 1):
-- - TTL default 14d → 48h for new sessions
-- - Clamp active sessions to at most 48h from now
-- - List + revoke RPCs (own sessions)
-- DO NOT apply to prod until Eustekio says apply.

alter table public.control_user_sessions
  alter column expires_at set default (now() + interval '48 hours');

update public.control_user_sessions
set expires_at = least(expires_at, now() + interval '48 hours')
where revoked_at is null
  and expires_at > now() + interval '48 hours';

create or replace function public.app_public_list_sessions(
  p_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_ctx record;
  v_token uuid := public.app_try_uuid(p_session_token);
  v_sessions jsonb;
begin
  select * into v_ctx from public.app_public_session_context(p_session_token);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'token', s.token,
      'created_at', s.created_at,
      'expires_at', s.expires_at,
      'last_seen_at', s.last_seen_at,
      'is_current', s.token = v_token,
      'revoked', s.revoked_at is not null
    )
    order by s.last_seen_at desc nulls last, s.created_at desc
  ), '[]'::jsonb)
  into v_sessions
  from public.control_user_sessions s
  where s.user_id = v_ctx.session_user_id
    and s.commerce_id = v_ctx.session_commerce_id
    and s.revoked_at is null
    and s.expires_at > now();

  return jsonb_build_object(
    'ok', true,
    'ttl_hours', 48,
    'sessions', v_sessions
  );
end;
$$;

create or replace function public.app_public_revoke_session(
  p_session_token text,
  p_target_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_ctx record;
  v_target uuid := public.app_try_uuid(p_target_token);
  v_updated int := 0;
begin
  select * into v_ctx from public.app_public_session_context(p_session_token);

  if v_target is null then
    raise exception 'session_not_found';
  end if;

  update public.control_user_sessions
  set revoked_at = now()
  where token = v_target
    and user_id = v_ctx.session_user_id
    and commerce_id = v_ctx.session_commerce_id
    and revoked_at is null;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'session_not_found';
  end if;

  return jsonb_build_object('ok', true, 'revoked_token', v_target);
end;
$$;

create or replace function public.app_public_revoke_other_sessions(
  p_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_ctx record;
  v_token uuid := public.app_try_uuid(p_session_token);
  v_updated int := 0;
begin
  select * into v_ctx from public.app_public_session_context(p_session_token);

  update public.control_user_sessions
  set revoked_at = now()
  where user_id = v_ctx.session_user_id
    and commerce_id = v_ctx.session_commerce_id
    and revoked_at is null
    and token is distinct from v_token;

  get diagnostics v_updated = row_count;

  return jsonb_build_object('ok', true, 'revoked_count', v_updated);
end;
$$;

revoke all on function public.app_public_list_sessions(text) from public;
revoke all on function public.app_public_revoke_session(text, text) from public;
revoke all on function public.app_public_revoke_other_sessions(text) from public;

grant execute on function public.app_public_list_sessions(text) to anon, authenticated, service_role;
grant execute on function public.app_public_revoke_session(text, text) to anon, authenticated, service_role;
grant execute on function public.app_public_revoke_other_sessions(text) to anon, authenticated, service_role;
