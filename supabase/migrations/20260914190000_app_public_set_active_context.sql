-- Additive: set session active branch/register without opening cash.
-- Fixes multi-sucursal switch that previously only mutated client local state.
-- DO NOT apply to prod until Eustekio says so (PR review first).

CREATE OR REPLACE FUNCTION public.app_public_set_active_context(
  p_session_token text,
  p_branch_id text,
  p_register_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_ctx record;
  v_branch public.branches;
  v_register public.registers;
begin
  select * into v_ctx from public.app_public_session_context(p_session_token);

  if coalesce(v_ctx.session_role_key, 'cashier') not in ('owner', 'admin', 'cashier') then
    raise exception 'permission_denied';
  end if;

  select *
  into v_branch
  from public.branches
  where id = public.app_try_uuid(p_branch_id)
    and commerce_id = v_ctx.session_commerce_id
    and is_active = true
  limit 1;

  if v_branch.id is null then
    raise exception 'branch_not_found';
  end if;

  select *
  into v_register
  from public.registers
  where id = public.app_try_uuid(p_register_id)
    and commerce_id = v_ctx.session_commerce_id
    and branch_id = v_branch.id
    and is_active = true
  limit 1;

  if v_register.id is null then
    raise exception 'register_not_found';
  end if;

  update public.control_users
  set
    active_branch_id = v_branch.id,
    assigned_register_id = v_register.id,
    updated_at = now()
  where id = v_ctx.session_user_id;

  return jsonb_build_object(
    'branch_id', v_branch.id,
    'register_id', v_register.id,
    'active_branch_id', v_branch.id,
    'assigned_register_id', v_register.id
  );
end;
$function$;

REVOKE ALL ON FUNCTION public.app_public_set_active_context(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_public_set_active_context(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.app_public_set_active_context(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_public_set_active_context(text, text, text) TO service_role;
