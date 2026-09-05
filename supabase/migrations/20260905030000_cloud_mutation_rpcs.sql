-- P0: RPCs de mutacion cloud para acciones que hoy solo mutan memoria local.
-- Patron: session_context + scope commerce + roles + GRANT anon/authenticated + REVOKE public.

create table if not exists private.mutation_operation_results (
  commerce_id uuid not null,
  operation_kind text not null,
  operation_id uuid not null,
  entity_id uuid,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (commerce_id, operation_kind, operation_id)
);

revoke all on table private.mutation_operation_results from public, anon, authenticated;

create or replace function private.app_mutation_replay_or_lock(
  p_commerce_id uuid,
  p_operation_kind text,
  p_operation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_existing jsonb;
begin
  if p_operation_id is null then
    return null;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_commerce_id::text || ':' || p_operation_kind || ':' || p_operation_id::text, 0)
  );

  select response into v_existing
  from private.mutation_operation_results
  where commerce_id = p_commerce_id
    and operation_kind = p_operation_kind
    and operation_id = p_operation_id;

  if v_existing is not null then
    return v_existing || jsonb_build_object('idempotent_replay', true);
  end if;

  return null;
end;
$$;

revoke all on function private.app_mutation_replay_or_lock(uuid, text, uuid) from public, anon, authenticated;

create or replace function private.app_mutation_store_result(
  p_commerce_id uuid,
  p_operation_kind text,
  p_operation_id uuid,
  p_entity_id uuid,
  p_response jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if p_operation_id is null then
    return p_response;
  end if;

  insert into private.mutation_operation_results (commerce_id, operation_kind, operation_id, entity_id, response)
  values (p_commerce_id, p_operation_kind, p_operation_id, p_entity_id, p_response)
  on conflict (commerce_id, operation_kind, operation_id) do nothing;

  return p_response;
end;
$$;

revoke all on function private.app_mutation_store_result(uuid, text, uuid, uuid, jsonb) from public, anon, authenticated;

create or replace function private.app_restore_sale_stock(
  p_commerce_id uuid,
  p_sale public.sales,
  p_user_id uuid,
  p_notes text,
  p_movement_type text default 'return'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.sale_items;
  v_product public.products;
begin
  for v_item in
    select * from public.sale_items
    where sale_id = p_sale.id
      and commerce_id = p_commerce_id
  loop
    select * into v_product
    from public.products
    where id = v_item.product_id
      and commerce_id = p_commerce_id;

    if v_product.id is null or coalesce(v_product.track_stock, true) is false then
      continue;
    end if;

    insert into public.product_branch_stock (commerce_id, product_id, branch_id, quantity)
    values (p_commerce_id, v_item.product_id, p_sale.branch_id, 0)
    on conflict (product_id, branch_id) do nothing;

    update public.product_branch_stock
    set quantity = quantity + v_item.quantity, updated_at = now()
    where commerce_id = p_commerce_id
      and product_id = v_item.product_id
      and branch_id = p_sale.branch_id;

    insert into public.stock_movements (
      commerce_id, branch_id, product_id, reference_id, reference_type,
      movement_type, quantity, notes, created_by
    ) values (
      p_commerce_id, p_sale.branch_id, v_item.product_id, p_sale.id, 'sale',
      p_movement_type, v_item.quantity, p_notes, p_user_id
    );
  end loop;
end;
$$;

revoke all on function private.app_restore_sale_stock(uuid, public.sales, uuid, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- cancel sale
-- ---------------------------------------------------------------------------
create or replace function public.app_public_cancel_sale(
  p_session_token text,
  p_sale_id text,
  p_reason text default 'Anulacion manual',
  p_operation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_ctx record;
  v_sale public.sales;
  v_sale_id uuid := public.app_try_uuid(p_sale_id);
  v_operation_id uuid := public.app_try_uuid(p_operation_id);
  v_replay jsonb;
  v_balance_due numeric := 0;
  v_cash_paid numeric := 0;
  v_reason text := trim(coalesce(nullif(p_reason, ''), 'Anulacion manual'));
  v_result jsonb;
begin
  select * into v_ctx from public.app_public_session_context(p_session_token);

  if coalesce(v_ctx.session_role_key, 'cashier') not in ('owner', 'admin', 'cashier') then
    raise exception 'permission_denied';
  end if;

  v_replay := private.app_mutation_replay_or_lock(v_ctx.session_commerce_id, 'cancel_sale', v_operation_id);
  if v_replay is not null then
    return v_replay;
  end if;

  if v_sale_id is null then
    raise exception 'sale_not_found';
  end if;

  select * into v_sale
  from public.sales
  where id = v_sale_id
    and commerce_id = v_ctx.session_commerce_id
  for update;

  if v_sale.id is null then
    raise exception 'sale_not_found';
  end if;

  if v_sale.status = 'cancelled' then
    raise exception 'sale_already_cancelled';
  end if;

  if v_sale.status = 'returned' then
    raise exception 'sale_already_returned';
  end if;

  v_balance_due := greatest(coalesce(v_sale.total_amount, 0) - coalesce(v_sale.amount_paid, 0), 0);

  select coalesce(sum(amount), 0) into v_cash_paid
  from public.sale_payments
  where sale_id = v_sale.id
    and method_key = 'cash';

  perform private.app_restore_sale_stock(
    v_ctx.session_commerce_id,
    v_sale,
    v_ctx.session_user_id,
    'Anulacion de venta: ' || v_reason,
    'return'
  );

  if v_sale.customer_id is not null and v_balance_due > 0 then
    update public.customers
    set balance = greatest(0, coalesce(balance, 0) - v_balance_due), updated_at = now()
    where id = v_sale.customer_id
      and commerce_id = v_ctx.session_commerce_id;
  end if;

  if v_cash_paid > 0 and v_sale.cash_session_id is not null
     and exists (
       select 1 from public.cash_sessions
       where id = v_sale.cash_session_id
         and commerce_id = v_ctx.session_commerce_id
         and status = 'open'
     )
  then
    insert into public.cash_movements (
      commerce_id, branch_id, register_id, cash_session_id, created_by,
      kind, amount, signed_amount, note
    ) values (
      v_ctx.session_commerce_id, v_sale.branch_id, v_sale.register_id, v_sale.cash_session_id,
      v_ctx.session_user_id, 'refund', v_cash_paid, -abs(v_cash_paid),
      'Reverso por anulacion de venta'
    );
  end if;

  delete from public.sale_payments where sale_id = v_sale.id and commerce_id = v_ctx.session_commerce_id;

  update public.sales
  set
    status = 'cancelled',
    amount_paid = 0,
    note = case
      when nullif(trim(coalesce(note, '')), '') is null then 'Anulada: ' || v_reason
      else trim(note) || ' | Anulada: ' || v_reason
    end,
    updated_at = now()
  where id = v_sale.id
  returning * into v_sale;

  update public.documents
  set status = 'Anulada', fiscal_status = 'Anulado', updated_at = now()
  where commerce_id = v_ctx.session_commerce_id
    and sale_id = v_sale.id
    and kind in ('factura', 'ticket', 'presupuesto', 'remito');

  v_result := jsonb_build_object(
    'sale_id', v_sale.id,
    'status', v_sale.status,
    'reason', v_reason
  );

  return private.app_mutation_store_result(
    v_ctx.session_commerce_id, 'cancel_sale', v_operation_id, v_sale.id, v_result
  );
end;
$$;

revoke all on function public.app_public_cancel_sale(text, text, text, text) from public;
grant execute on function public.app_public_cancel_sale(text, text, text, text) to anon, authenticated;
