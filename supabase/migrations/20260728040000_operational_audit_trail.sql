-- Registra una traza inmutable para las operaciones que cambian el negocio.
-- La auditoría queda desacoplada de cada RPC: cualquier insert/update/delete en
-- estas tablas operativas genera un evento, incluso si la operación se origina
-- desde una futura pantalla o integración.

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

  -- Evita ruido si una actualización no cambió datos materiales.
  if tg_op = 'UPDATE' and v_before = v_after then
    return new;
  end if;

  -- Los argumentos posteriores al tipo de entidad indican, en orden, las
  -- columnas que pueden contener al usuario responsable.
  if array_length(tg_argv, 1) > 1 then
    for v_index in 1..array_length(tg_argv, 1) - 1 loop
      v_actor_key := tg_argv[v_index + 1];
      v_actor_id := public.app_try_uuid(coalesce(v_after ->> v_actor_key, v_before ->> v_actor_key));
      exit when v_actor_id is not null;
    end loop;
  end if;

  if v_entity_type = 'cash_session' and tg_op = 'INSERT' then
    v_action := 'opened';
  elsif v_entity_type = 'cash_session' and tg_op = 'UPDATE'
    and coalesce(v_before ->> 'status', '') <> 'closed'
    and coalesce(v_after ->> 'status', '') = 'closed' then
    v_action := 'closed';
  elsif tg_op = 'INSERT' then
    v_action := 'created';
  elsif tg_op = 'DELETE' then
    v_action := 'deleted';
  else
    v_action := 'updated';
  end if;

  insert into public.audit_logs_core (
    commerce_id, actor_user_id, entity_type, entity_id, action, before_data, after_data
  ) values (
    v_commerce_id, v_actor_id, v_entity_type, v_entity_id, v_action, v_before, v_after
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.app_audit_operational_change() from public, anon, authenticated;

drop trigger if exists audit_cash_sessions_change on public.cash_sessions;
create trigger audit_cash_sessions_change
after insert or update or delete on public.cash_sessions
for each row execute function public.app_audit_operational_change('cash_session', 'closed_by', 'opened_by');

drop trigger if exists audit_cash_movements_change on public.cash_movements;
create trigger audit_cash_movements_change
after insert or update or delete on public.cash_movements
for each row execute function public.app_audit_operational_change('cash_movement', 'created_by');

drop trigger if exists audit_sales_change on public.sales;
create trigger audit_sales_change
after insert or update or delete on public.sales
for each row execute function public.app_audit_operational_change('sale', 'seller_user_id');

drop trigger if exists audit_stock_movements_change on public.stock_movements;
create trigger audit_stock_movements_change
after insert or update or delete on public.stock_movements
for each row execute function public.app_audit_operational_change('stock_movement', 'created_by');

drop trigger if exists audit_purchase_receipts_change on public.purchase_receipts;
create trigger audit_purchase_receipts_change
after insert or update or delete on public.purchase_receipts
for each row execute function public.app_audit_operational_change('purchase_receipt', 'received_by');

drop trigger if exists audit_products_change on public.products;
create trigger audit_products_change
after insert or update or delete on public.products
for each row execute function public.app_audit_operational_change('product');

create or replace function public.app_public_load_audit_logs(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ctx record;
begin
  select * into v_ctx from public.app_public_session_context(p_session_token);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id,
      'actorUserId', actor_user_id,
      'entityType', entity_type,
      'entityId', entity_id,
      'action', action,
      'beforeData', before_data,
      'afterData', after_data,
      'createdAt', created_at
    ) order by created_at desc)
    from public.audit_logs_core
    where commerce_id = v_ctx.session_commerce_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.app_public_load_audit_logs(text) from public;
grant execute on function public.app_public_load_audit_logs(text) to anon, authenticated;
