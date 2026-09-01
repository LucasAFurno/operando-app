-- El permiso de plataforma se decide en el servidor y debe acompañar cada
-- inicio/restauración de sesión. Sin este campo, el cliente interpreta al
-- usuario como administrador del comercio y no como administrador Operando.
create or replace function public.app_build_public_session_payload(
  p_token uuid,
  p_user_id uuid,
  p_commerce_id uuid
)
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
  select *
  into v_user
  from public.control_users
  where id = p_user_id;

  select *
  into v_membership
  from public.commerce_memberships
  where commerce_id = p_commerce_id
    and user_id = p_user_id
  order by is_owner desc, updated_at desc
  limit 1;

  select *
  into v_commerce
  from public.commerce_accounts
  where id = p_commerce_id;

  if v_user.id is null or v_membership.id is null or v_commerce.id is null then
    raise exception 'session_not_found';
  end if;

  return jsonb_build_object(
    'session_token', p_token,
    'profile', jsonb_build_object(
      'id', v_user.id,
      'email', v_user.email,
      'login_name', coalesce(v_user.login_name, ''),
      'full_name', v_user.full_name,
      'role_key', coalesce(v_membership.role_key, v_user.role_key, 'cashier'),
      'status', v_membership.status,
      'is_owner', coalesce(v_membership.is_owner, v_user.is_owner, false),
      'is_platform_admin', coalesce(v_user.is_platform_admin, false),
      'active_branch_id', v_user.active_branch_id,
      'assigned_register_id', v_user.assigned_register_id,
      'allowed_modules', coalesce(v_membership.allowed_modules, '[]'::jsonb),
      'blocked_permissions', coalesce(v_membership.blocked_permissions, '[]'::jsonb)
    ),
    'commerce_context', jsonb_build_object(
      'commerce_id', v_commerce.id,
      'instance_key', v_commerce.instance_key,
      'commerce_name', v_commerce.name,
      'legal_name', v_commerce.legal_name,
      'owner_email', v_commerce.owner_email,
      'active_plan', v_commerce.active_plan,
      'status', v_commerce.status,
      'billing_status', v_commerce.billing_status,
      'onboarding_status', v_commerce.onboarding_status,
      'trial_ends_at', v_commerce.trial_ends_at,
      'allow_public_signup', v_commerce.allow_public_signup
    )
  );
end;
$$;

revoke all on function public.app_build_public_session_payload(uuid, uuid, uuid) from public;
