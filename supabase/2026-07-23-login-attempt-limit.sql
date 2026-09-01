-- Ejecutar en el SQL Editor de Supabase para aplicar el límite a instalaciones existentes.
-- Tres claves inválidas bloquean la cuenta durante 15 minutos.

create table if not exists public.control_user_login_attempts (
  user_id uuid primary key references public.control_users(id) on delete cascade,
  failed_attempts smallint not null default 0 check (failed_attempts between 0 and 3),
  last_failed_at timestamptz not null default now(),
  locked_until timestamptz
);

create index if not exists idx_control_user_login_attempts_locked_until
  on public.control_user_login_attempts(locked_until)
  where locked_until is not null;

create or replace function public.app_public_sign_in(
  p_instance_key text,
  p_identifier text,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instance_key text := lower(nullif(trim(coalesce(p_instance_key, '')), ''));
  v_identifier text := lower(trim(coalesce(p_identifier, '')));
  v_commerce public.commerce_accounts;
  v_user public.control_users;
  v_membership public.commerce_memberships;
  v_match_commerce_id uuid;
  v_match_user_id uuid;
  v_match_membership_id uuid;
  v_token uuid;
  v_login_attempt public.control_user_login_attempts;
begin
  if v_identifier = '' then
    raise exception 'identifier_required';
  end if;

  if v_instance_key is not null then
    select * into v_commerce from public.commerce_accounts
    where lower(instance_key) = v_instance_key and status = 'active' limit 1;
    if v_commerce.id is null then raise exception 'instance_not_initialized'; end if;

    select user_row.* into v_user
    from public.control_users user_row
    join public.commerce_memberships membership on membership.user_id = user_row.id and membership.commerce_id = v_commerce.id
    where lower(coalesce(user_row.login_name, '')) = v_identifier
       or lower(coalesce(user_row.email, '')) = v_identifier
       or lower(split_part(coalesce(user_row.email, ''), '@', 1)) = v_identifier
       or lower(coalesce(user_row.full_name, '')) = v_identifier
    order by membership.is_owner desc, user_row.created_at asc limit 1;
  else
    select commerce_row.id, user_row.id, membership.id
    into v_match_commerce_id, v_match_user_id, v_match_membership_id
    from public.control_users user_row
    join public.commerce_memberships membership on membership.user_id = user_row.id and membership.status = 'active'
    join public.commerce_accounts commerce_row on commerce_row.id = membership.commerce_id and commerce_row.status = 'active' and lower(coalesce(commerce_row.instance_key, '')) <> 'operando-dev'
    where lower(coalesce(user_row.email, '')) = v_identifier
    order by case when user_row.active_commerce_id = commerce_row.id then 0 else 1 end, membership.is_owner desc, membership.updated_at desc, user_row.created_at asc
    limit 1;
    if v_match_commerce_id is not null then
      select * into v_commerce from public.commerce_accounts where id = v_match_commerce_id;
      select * into v_user from public.control_users where id = v_match_user_id;
      select * into v_membership from public.commerce_memberships where id = v_match_membership_id;
    end if;
  end if;

  if v_user.id is null then raise exception 'user_not_found'; end if;
  if v_membership.id is null then
    select * into v_membership from public.commerce_memberships where commerce_id = v_commerce.id and user_id = v_user.id limit 1;
  end if;
  if v_user.status <> 'active' or v_membership.status <> 'active' then raise exception 'user_inactive'; end if;

  select * into v_login_attempt from public.control_user_login_attempts where user_id = v_user.id for update;
  if v_login_attempt.locked_until > now() then return jsonb_build_object('ok', false, 'error', 'login_locked'); end if;
  if v_login_attempt.locked_until is not null then
    update public.control_user_login_attempts set failed_attempts = 0, locked_until = null where user_id = v_user.id;
  end if;

  if v_user.pin_hash is null or extensions.crypt(coalesce(p_pin, ''), v_user.pin_hash) <> v_user.pin_hash then
    insert into public.control_user_login_attempts as attempt (user_id, failed_attempts, last_failed_at, locked_until)
    values (v_user.id, 1, now(), null)
    on conflict (user_id) do update set
      failed_attempts = attempt.failed_attempts + 1,
      last_failed_at = now(),
      locked_until = case when attempt.failed_attempts + 1 >= 3 then now() + interval '15 minutes' else null end
    returning * into v_login_attempt;
    if v_login_attempt.locked_until is not null then return jsonb_build_object('ok', false, 'error', 'login_locked'); end if;
    return jsonb_build_object('ok', false, 'error', format('invalid_pin_attempts_remaining_%s', 3 - v_login_attempt.failed_attempts));
  end if;

  delete from public.control_user_login_attempts where user_id = v_user.id;
  insert into public.control_user_sessions (token, user_id, commerce_id)
  values (gen_random_uuid(), v_user.id, v_commerce.id) returning token into v_token;
  update public.control_users set last_login_at = now(), active_commerce_id = v_commerce.id where id = v_user.id;
  return public.app_build_public_session_payload(v_token, v_user.id, v_commerce.id);
end;
$$;

revoke all on public.control_user_login_attempts from public, anon, authenticated;
revoke all on function public.app_public_sign_in(text, text, text) from public;
grant execute on function public.app_public_sign_in(text, text, text) to anon, authenticated;
