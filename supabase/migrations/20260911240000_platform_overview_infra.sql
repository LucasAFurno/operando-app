-- Consola Operando: enriquecer platform_overview con señales de infra desde Postgres.
-- No cambia el contrato de summary/users/commerces; solo agrega el objeto `infra`.
-- Execute solo via auth-gateway (service_role), igual que el GRANT vigente.

create or replace function public.app_public_platform_overview(
  p_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.control_user_sessions;
  v_user public.control_users;
  v_db_size_bytes bigint;
  v_connections integer;
  v_cache_hit_pct numeric;
begin
  select * into v_session
  from public.control_user_sessions
  where token = public.app_try_uuid(p_session_token)
    and revoked_at is null
    and expires_at > now()
  limit 1;

  if v_session.token is null then raise exception 'session_not_found'; end if;

  select * into v_user from public.control_users where id = v_session.user_id limit 1;
  if v_user.id is null or v_user.status <> 'active' then raise exception 'user_inactive'; end if;
  if not coalesce(v_user.is_platform_admin, false) then raise exception 'platform_admin_required'; end if;

  begin
    v_db_size_bytes := pg_database_size(current_database());
  exception when others then
    v_db_size_bytes := null;
  end;

  begin
    select count(*)::integer into v_connections from pg_stat_activity;
  exception when others then
    v_connections := null;
  end;

  begin
    select case
      when (coalesce(sum(blks_hit), 0) + coalesce(sum(blks_read), 0)) = 0 then null
      else round((sum(blks_hit)::numeric / nullif(sum(blks_hit) + sum(blks_read), 0)) * 100, 2)
    end
    into v_cache_hit_pct
    from pg_stat_database
    where datname = current_database();
  exception when others then
    v_cache_hit_pct := null;
  end;

  return jsonb_build_object(
    'summary', jsonb_build_object(
      'total_commerces', (select count(*) from public.commerce_accounts),
      'trial_commerces', (select count(*) from public.commerce_accounts where billing_status = 'trial'),
      'active_commerces', (select count(*) from public.commerce_accounts where status = 'active'),
      'paused_commerces', (select count(*) from public.commerce_accounts where status = 'paused' or billing_status = 'paused'),
      'expired_commerces', (select count(*) from public.commerce_accounts where billing_status in ('past_due', 'cancelled')),
      'total_users', (select count(*) from public.control_users),
      'total_branches', (select count(*) from public.branches),
      'total_registers', (select count(*) from public.registers)
    ),
    'infra', jsonb_build_object(
      'db_size_bytes', v_db_size_bytes,
      'db_size_pretty', case when v_db_size_bytes is null then null else pg_size_pretty(v_db_size_bytes) end,
      'connections', v_connections,
      'cache_hit_pct', v_cache_hit_pct,
      'source', 'postgres',
      'checked_at', to_jsonb(now())
    ),
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cu.id,
        'full_name', cu.full_name,
        'email', cu.email,
        'status', cu.status,
        'is_platform_admin', coalesce(cu.is_platform_admin, false),
        'created_at', cu.created_at,
        'last_login_at', cu.last_login_at,
        'memberships', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', cm.id,
            'commerce_id', commerce.id,
            'commerce_name', commerce.name,
            'instance_key', commerce.instance_key,
            'role_key', cm.role_key,
            'status', cm.status,
            'is_owner', cm.is_owner
          ) order by cm.is_owner desc, commerce.name asc)
          from public.commerce_memberships cm
          join public.commerce_accounts commerce on commerce.id = cm.commerce_id
          where cm.user_id = cu.id
        ), '[]'::jsonb),
        'activity', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', event_id,
            'entity_type', entity_type,
            'action', action,
            'commerce_id', commerce_id,
            'commerce_name', commerce_name,
            'created_at', created_at
          ) order by created_at desc)
          from (
            select * from (
              select
                audit.id::text as event_id,
                audit.entity_type,
                audit.action,
                audit.commerce_id,
                commerce.name as commerce_name,
                audit.created_at
              from public.audit_logs_core audit
              join public.commerce_accounts commerce on commerce.id = audit.commerce_id
              where audit.actor_user_id = cu.id
              union all
              select
                'account-' || cu.id::text,
                'user',
                'created',
                null::uuid,
                null::text,
                cu.created_at
            ) raw_events
            order by created_at desc
            limit 80
          ) events
        ), '[]'::jsonb)
      ) order by coalesce(cu.last_login_at, cu.created_at) desc, cu.full_name asc)
      from public.control_users cu
    ), '[]'::jsonb),
    'commerces', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', commerce.id,
        'name', commerce.name,
        'instance_key', commerce.instance_key,
        'owner_email', commerce.owner_email,
        'active_plan', commerce.active_plan,
        'status', commerce.status,
        'billing_status', commerce.billing_status,
        'onboarding_status', commerce.onboarding_status,
        'allow_public_signup', commerce.allow_public_signup,
        'trial_started_at', commerce.trial_started_at,
        'trial_ends_at', commerce.trial_ends_at,
        'created_at', commerce.created_at,
        'updated_at', commerce.updated_at,
        'last_access_at', (select max(member_user.last_login_at) from public.commerce_memberships cm join public.control_users member_user on member_user.id = cm.user_id where cm.commerce_id = commerce.id),
        'branches_count', (select count(*) from public.branches where commerce_id = commerce.id),
        'registers_count', (select count(*) from public.registers where commerce_id = commerce.id),
        'users_count', (select count(*) from public.commerce_memberships where commerce_id = commerce.id and status = 'active'),
        'support_owner', coalesce(commerce.settings_json -> 'platformAdmin' ->> 'supportOwner', ''),
        'support_status', coalesce(commerce.settings_json -> 'platformAdmin' ->> 'supportStatus', 'pendiente'),
        'billing_note', coalesce(commerce.settings_json -> 'platformAdmin' ->> 'billingNote', ''),
        'commercial_note', coalesce(commerce.settings_json -> 'platformAdmin' ->> 'commercialNote', ''),
        'internal_tag', coalesce(commerce.settings_json -> 'platformAdmin' ->> 'internalTag', ''),
        'enabled_modules', public.app_effective_enabled_modules(commerce.id),
        'branches', coalesce((select jsonb_agg(jsonb_build_object('id', branch.id, 'name', branch.name, 'code', branch.code, 'address', branch.address, 'is_active', branch.is_active) order by branch.created_at asc) from public.branches branch where branch.commerce_id = commerce.id), '[]'::jsonb),
        'registers', coalesce((select jsonb_agg(jsonb_build_object('id', register.id, 'branch_id', register.branch_id, 'name', register.name, 'code', register.code, 'is_active', register.is_active) order by register.created_at asc) from public.registers register where register.commerce_id = commerce.id), '[]'::jsonb),
        'users', coalesce((select jsonb_agg(jsonb_build_object('id', member_user.id, 'full_name', member_user.full_name, 'email', member_user.email, 'role_key', cm.role_key, 'status', cm.status, 'is_owner', cm.is_owner, 'last_login_at', member_user.last_login_at) order by cm.is_owner desc, member_user.created_at asc) from public.commerce_memberships cm join public.control_users member_user on member_user.id = cm.user_id where cm.commerce_id = commerce.id), '[]'::jsonb)
      ) order by commerce.created_at desc)
      from public.commerce_accounts commerce
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.app_public_platform_overview(text) from public;
revoke all on function public.app_public_platform_overview(text) from anon;
revoke all on function public.app_public_platform_overview(text) from authenticated;
grant execute on function public.app_public_platform_overview(text) to service_role;
