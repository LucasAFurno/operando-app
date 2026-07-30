-- Las cuentas operativas no requieren correo: ingresan con usuario + clave.
-- El correo se conserva para propietarios existentes (facturación y recuperación).

alter table public.control_users
  alter column email drop not null;

drop function if exists public.app_public_upsert_user(text, text, text, text, text, text, boolean, jsonb, jsonb);

create function public.app_public_upsert_user(
  p_session_token text,
  p_user_id text default null,
  p_full_name text default null,
  p_role_key text default 'cashier',
  p_login_name text default null,
  p_pin text default null,
  p_is_active boolean default true,
  p_allowed_modules jsonb default null,
  p_blocked_permissions jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_ctx record;
  v_user public.control_users;
  v_membership public.commerce_memberships;
  v_user_id uuid := public.app_try_uuid(p_user_id);
  v_role_key text := lower(coalesce(nullif(trim(p_role_key), ''), 'cashier'));
  v_full_name text := trim(coalesce(p_full_name, ''));
  v_login_name text := lower(trim(coalesce(p_login_name, '')));
  v_email text;
  v_pin_hash text;
  v_status text := case when coalesce(p_is_active, true) then 'active' else 'disabled' end;
  v_allowed_modules jsonb := '[]'::jsonb;
  v_blocked_permissions jsonb := '[]'::jsonb;
begin
  select * into v_ctx from public.app_public_session_context(p_session_token);

  if not (coalesce(v_ctx.session_is_owner, false) or coalesce(v_ctx.session_role_key, '') in ('owner', 'admin')) then
    raise exception 'admin_required';
  end if;
  if v_full_name = '' then raise exception 'user_name_required'; end if;
  if v_login_name = '' then raise exception 'login_name_required'; end if;
  if v_login_name !~ '^[a-z0-9][a-z0-9._-]{2,31}$' then raise exception 'invalid_login_name'; end if;
  if v_role_key not in ('admin', 'cashier', 'warehouse') then raise exception 'invalid_role_key'; end if;
  if v_user_id is null and nullif(coalesce(p_pin, ''), '') is null then raise exception 'pin_required'; end if;
  if nullif(coalesce(p_pin, ''), '') is not null and length(p_pin) < 6 then raise exception 'pin_too_short'; end if;

  select coalesce(jsonb_agg(value), '[]'::jsonb) into v_allowed_modules
  from (select distinct value from jsonb_array_elements_text(coalesce(p_allowed_modules, '[]'::jsonb)) as value where value in ('dashboard','customers','sales','cash','branches','registers','products','purchases','invoices','tickets','reports','settings')) filtered_allowed;
  select coalesce(jsonb_agg(value), '[]'::jsonb) into v_blocked_permissions
  from (select distinct value from jsonb_array_elements_text(coalesce(p_blocked_permissions, '[]'::jsonb)) as value where value in ('customers:write','sales:write','cash:operate','branches:manage','registers:manage','products:write','products:adjust','products:transfer','purchases:write','invoices:write','tickets:write','reports:export','settings:manage')) filtered_blocked;

  if v_user_id is not null then
    select * into v_membership from public.commerce_memberships where commerce_id = v_ctx.session_commerce_id and user_id = v_user_id limit 1;
    if v_membership.id is null then raise exception 'user_not_in_commerce'; end if;
    select * into v_user from public.control_users where id = v_user_id;
    if v_user.id is null then raise exception 'user_not_found'; end if;
    if coalesce(v_membership.is_owner, false) and not coalesce(v_ctx.session_is_owner, false) then raise exception 'owner_required'; end if;
    if v_ctx.session_user_id = v_user_id and coalesce(p_is_active, true) = false then raise exception 'cannot_disable_current_session'; end if;
    v_email := v_user.email;
  else
    v_user_id := gen_random_uuid();
    v_email := null;
  end if;

  if exists (select 1 from public.control_users where lower(coalesce(login_name, '')) = v_login_name and id <> v_user_id) then
    raise exception 'login_name_already_exists';
  end if;

  v_pin_hash := case when nullif(coalesce(p_pin, ''), '') is not null then extensions.crypt(p_pin, extensions.gen_salt('bf')) else null end;

  insert into public.control_users (id, email, login_name, full_name, role_key, status, is_owner, pin_hash, active_commerce_id)
  values (v_user_id, v_email, v_login_name, v_full_name, case when coalesce(v_membership.is_owner, false) then 'admin' else v_role_key end, case when coalesce(v_membership.is_owner, false) then 'active' else v_status end, coalesce(v_membership.is_owner, false), v_pin_hash, v_ctx.session_commerce_id)
  on conflict (id) do update set
    email = coalesce(public.control_users.email, excluded.email),
    login_name = excluded.login_name,
    full_name = excluded.full_name,
    role_key = case when public.control_users.is_owner then public.control_users.role_key else excluded.role_key end,
    status = case when public.control_users.is_owner then 'active' else excluded.status end,
    pin_hash = coalesce(excluded.pin_hash, public.control_users.pin_hash),
    active_commerce_id = coalesce(public.control_users.active_commerce_id, excluded.active_commerce_id),
    updated_at = now()
  returning * into v_user;

  insert into public.commerce_memberships (commerce_id, user_id, role_key, status, is_owner, allowed_modules, blocked_permissions)
  values (v_ctx.session_commerce_id, v_user.id, case when coalesce(v_membership.is_owner, false) then 'admin' else v_role_key end, case when coalesce(v_membership.is_owner, false) then 'active' else v_status end, coalesce(v_membership.is_owner, false), v_allowed_modules, v_blocked_permissions)
  on conflict (commerce_id, user_id) do update set
    role_key = case when public.commerce_memberships.is_owner then public.commerce_memberships.role_key else excluded.role_key end,
    status = case when public.commerce_memberships.is_owner then 'active' else excluded.status end,
    allowed_modules = excluded.allowed_modules,
    blocked_permissions = excluded.blocked_permissions,
    updated_at = now()
  returning * into v_membership;

  return jsonb_build_object('id', v_user.id, 'full_name', v_user.full_name, 'email', v_user.email, 'login_name', coalesce(v_user.login_name, ''), 'role_key', coalesce(v_membership.role_key, v_user.role_key), 'status', coalesce(v_membership.status, v_user.status), 'is_owner', coalesce(v_membership.is_owner, v_user.is_owner), 'allowed_modules', coalesce(v_membership.allowed_modules, '[]'::jsonb), 'blocked_permissions', coalesce(v_membership.blocked_permissions, '[]'::jsonb), 'created_at', v_user.created_at, 'updated_at', v_user.updated_at);
end;
$$;

revoke all on function public.app_public_upsert_user(text, text, text, text, text, text, boolean, jsonb, jsonb) from public, authenticated;
grant execute on function public.app_public_upsert_user(text, text, text, text, text, text, boolean, jsonb, jsonb) to anon;
