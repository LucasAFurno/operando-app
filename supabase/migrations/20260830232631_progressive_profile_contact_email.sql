-- Contacto obligatorio al completar el perfil progresivo.
-- Conserva la compatibilidad: cuentas existentes toman su email propietario como valor inicial.
alter table public.commerce_accounts
  add column if not exists onboarding_email text not null default '';

update public.commerce_accounts
set onboarding_email = owner_email
where onboarding_email = '' and owner_email <> '';

create or replace function public.app_build_public_session_payload(p_token uuid, p_user_id uuid, p_commerce_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.control_users;
  v_membership public.commerce_memberships;
  v_commerce public.commerce_accounts;
begin
  select * into v_user from public.control_users where id = p_user_id;
  select * into v_membership from public.commerce_memberships where commerce_id = p_commerce_id and user_id = p_user_id order by is_owner desc, updated_at desc limit 1;
  select * into v_commerce from public.commerce_accounts where id = p_commerce_id;
  if v_user.id is null or v_membership.id is null or v_commerce.id is null then raise exception 'session_not_found'; end if;
  return jsonb_build_object(
    'session_token', p_token,
    'profile', jsonb_build_object('id', v_user.id, 'email', v_user.email, 'login_name', coalesce(v_user.login_name, ''), 'full_name', v_user.full_name, 'role_key', coalesce(v_membership.role_key, v_user.role_key, 'cashier'), 'status', v_membership.status, 'is_owner', coalesce(v_membership.is_owner, v_user.is_owner, false), 'active_branch_id', v_user.active_branch_id, 'assigned_register_id', v_user.assigned_register_id),
    'commerce_context', jsonb_build_object('commerce_id', v_commerce.id, 'instance_key', v_commerce.instance_key, 'commerce_name', v_commerce.name, 'legal_name', v_commerce.legal_name, 'owner_email', v_commerce.owner_email, 'active_plan', v_commerce.active_plan, 'status', v_commerce.status, 'onboarding_country', v_commerce.onboarding_country, 'onboarding_industry', v_commerce.onboarding_industry, 'onboarding_phone', v_commerce.onboarding_phone, 'onboarding_email', v_commerce.onboarding_email, 'onboarding_needs_arca', v_commerce.onboarding_needs_arca, 'onboarding_goals', v_commerce.onboarding_goals, 'onboarding_status', v_commerce.onboarding_status)
  );
end;
$$;

drop function if exists public.app_public_update_progressive_profile(text, text, text, text, boolean, jsonb, text);

create function public.app_public_update_progressive_profile(
  p_session_token text,
  p_country text default '',
  p_industry text default '',
  p_phone text default '',
  p_email text default '',
  p_needs_arca boolean default null,
  p_operational_goals jsonb default '[]'::jsonb,
  p_status text default 'pending'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ctx record;
  v_commerce public.commerce_accounts;
  v_goals jsonb := coalesce(p_operational_goals, '[]'::jsonb);
  v_status text := lower(trim(coalesce(p_status, 'pending')));
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  select * into v_ctx from public.app_public_session_context(p_session_token);
  if not coalesce(v_ctx.session_is_owner, false) then raise exception 'owner_required'; end if;
  if length(trim(coalesce(p_country, ''))) > 80 or length(trim(coalesce(p_industry, ''))) > 100 or length(trim(coalesce(p_phone, ''))) > 30 or length(v_email) > 254 then raise exception 'progressive_profile_value_too_long'; end if;
  if v_status = 'complete' and (trim(coalesce(p_phone, '')) = '' or v_email = '') then raise exception 'progressive_contact_required'; end if;
  if trim(coalesce(p_phone, '')) <> '' and trim(p_phone) !~ '^[+()0-9[:space:]-]{6,30}$' then raise exception 'invalid_phone'; end if;
  if v_email <> '' and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'invalid_email'; end if;
  if v_status not in ('pending', 'complete') then raise exception 'invalid_onboarding_status'; end if;
  if jsonb_typeof(v_goals) <> 'array' or jsonb_array_length(v_goals) > 5 or exists (select 1 from jsonb_array_elements_text(v_goals) goal where goal not in ('vender', 'stock', 'caja', 'clientes', 'facturacion', 'sucursales')) then raise exception 'invalid_operational_goals'; end if;

  update public.commerce_accounts
  set onboarding_country = trim(coalesce(p_country, '')), onboarding_industry = trim(coalesce(p_industry, '')), onboarding_phone = trim(coalesce(p_phone, '')), onboarding_email = v_email, onboarding_needs_arca = p_needs_arca, onboarding_goals = v_goals, onboarding_status = v_status, updated_at = now()
  where id = v_ctx.session_commerce_id
  returning * into v_commerce;

  return jsonb_build_object('onboarding_country', v_commerce.onboarding_country, 'onboarding_industry', v_commerce.onboarding_industry, 'onboarding_phone', v_commerce.onboarding_phone, 'onboarding_email', v_commerce.onboarding_email, 'onboarding_needs_arca', v_commerce.onboarding_needs_arca, 'onboarding_goals', v_commerce.onboarding_goals, 'onboarding_status', v_commerce.onboarding_status);
end;
$$;

revoke all on function public.app_public_update_progressive_profile(text, text, text, text, text, boolean, jsonb, text) from public, authenticated;
grant execute on function public.app_public_update_progressive_profile(text, text, text, text, text, boolean, jsonb, text) to anon;
