-- Extiende la trazabilidad a toda la operación y conserva el usuario de sesión
-- en las tablas que no tienen una columna created_by propia.

create or replace function public.app_public_session_context(
  p_session_token text
)
returns table (
  session_token uuid,
  session_user_id uuid,
  session_commerce_id uuid,
  session_role_key text,
  session_is_owner boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.control_user_sessions;
  v_user public.control_users;
  v_membership public.commerce_memberships;
begin
  select * into v_session from public.control_user_sessions
  where token = public.app_try_uuid(p_session_token) and revoked_at is null and expires_at > now()
  limit 1;
  if v_session.token is null then raise exception 'session_not_found'; end if;

  select * into v_user from public.control_users where id = v_session.user_id;
  if v_user.id is null or v_user.status <> 'active' then raise exception 'user_inactive'; end if;

  select * into v_membership from public.commerce_memberships
  where commerce_id = v_session.commerce_id and user_id = v_session.user_id and status = 'active'
  order by is_owner desc, updated_at desc limit 1;
  if v_membership.id is null then raise exception 'membership_not_found'; end if;

  -- Se mantiene durante la transacción de la RPC y lo consumen los triggers.
  perform set_config('app.audit_actor_id', v_user.id::text, true);
  return query select v_session.token, v_user.id, v_session.commerce_id,
    coalesce(v_membership.role_key, v_user.role_key, 'cashier'),
    coalesce(v_membership.is_owner, v_user.is_owner, false);
end;
$$;

create or replace function public.app_audit_operational_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_after jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_entity_type text := tg_argv[0];
  v_commerce_id uuid;
  v_entity_id uuid;
  v_actor_id uuid;
  v_actor_key text;
  v_action text := lower(tg_op);
  v_index integer;
begin
  v_commerce_id := public.app_try_uuid(coalesce(v_after ->> 'commerce_id', v_before ->> 'commerce_id'));
  v_entity_id := public.app_try_uuid(coalesce(v_after ->> 'id', v_before ->> 'id'));
  if v_commerce_id is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and v_before = v_after then return new; end if;

  if array_length(tg_argv, 1) > 1 then
    for v_index in 1..array_length(tg_argv, 1) - 1 loop
      v_actor_key := tg_argv[v_index + 1];
      v_actor_id := public.app_try_uuid(coalesce(v_after ->> v_actor_key, v_before ->> v_actor_key));
      exit when v_actor_id is not null;
    end loop;
  end if;
  if v_actor_id is null then
    v_actor_id := public.app_try_uuid(current_setting('app.audit_actor_id', true));
  end if;

  if v_entity_type = 'cash_session' and tg_op = 'INSERT' then v_action := 'opened';
  elsif v_entity_type = 'cash_session' and tg_op = 'UPDATE'
    and coalesce(v_before ->> 'status', '') <> 'closed' and coalesce(v_after ->> 'status', '') = 'closed' then v_action := 'closed';
  elsif tg_op = 'INSERT' then v_action := 'created';
  elsif tg_op = 'DELETE' then v_action := 'deleted';
  else v_action := 'updated'; end if;

  insert into public.audit_logs_core (commerce_id, actor_user_id, entity_type, entity_id, action, before_data, after_data)
  values (v_commerce_id, v_actor_id, v_entity_type, v_entity_id, v_action, v_before, v_after);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists audit_customers_change on public.customers;
create trigger audit_customers_change after insert or update or delete on public.customers
for each row execute function public.app_audit_operational_change('customer');

drop trigger if exists audit_suppliers_change on public.suppliers;
create trigger audit_suppliers_change after insert or update or delete on public.suppliers
for each row execute function public.app_audit_operational_change('supplier');

drop trigger if exists audit_branches_change on public.branches;
create trigger audit_branches_change after insert or update or delete on public.branches
for each row execute function public.app_audit_operational_change('branch');

drop trigger if exists audit_registers_change on public.registers;
create trigger audit_registers_change after insert or update or delete on public.registers
for each row execute function public.app_audit_operational_change('register');

drop trigger if exists audit_documents_change on public.documents;
create trigger audit_documents_change after insert or update or delete on public.documents
for each row execute function public.app_audit_operational_change('document');

drop trigger if exists audit_product_branch_stock_change on public.product_branch_stock;
create trigger audit_product_branch_stock_change after insert or update or delete on public.product_branch_stock
for each row execute function public.app_audit_operational_change('stock_movement');

drop trigger if exists audit_commerce_accounts_change on public.commerce_accounts;
create trigger audit_commerce_accounts_change after update on public.commerce_accounts
for each row execute function public.app_audit_operational_change('business');

drop trigger if exists audit_commerce_memberships_change on public.commerce_memberships;
create trigger audit_commerce_memberships_change after insert or update or delete on public.commerce_memberships
for each row execute function public.app_audit_operational_change('user');

revoke all on function public.app_audit_operational_change() from public, anon, authenticated;
