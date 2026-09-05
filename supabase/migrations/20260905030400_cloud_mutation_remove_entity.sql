-- P0: remove entity RPC
create or replace function public.app_public_remove_entity(
  p_session_token text,
  p_entity_type text,
  p_entity_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_ctx record;
  v_entity text := lower(trim(coalesce(p_entity_type, '')));
  v_entity_id uuid := public.app_try_uuid(p_entity_id);
  v_sale public.sales;
  v_receipt public.purchase_receipts;
  v_role text;
begin
  select * into v_ctx from public.app_public_session_context(p_session_token);
  v_role := coalesce(v_ctx.session_role_key, 'cashier');

  if v_entity_id is null then
    raise exception 'entity_not_found';
  end if;

  if v_entity = 'register' then
    raise exception 'use_upsert_register_for_deactivate';
  end if;

  if v_entity = 'customer' then
    if v_role not in ('owner', 'admin', 'cashier') then raise exception 'permission_denied'; end if;
    update public.customers
    set is_active = false, updated_at = now()
    where id = v_entity_id and commerce_id = v_ctx.session_commerce_id;
    if not found then raise exception 'entity_not_found'; end if;
    return jsonb_build_object('entity', v_entity, 'id', v_entity_id, 'mode', 'deactivated');
  end if;

  if v_entity = 'product' then
    if v_role not in ('owner', 'admin', 'warehouse') then raise exception 'permission_denied'; end if;
    update public.products
    set is_active = false, updated_at = now()
    where id = v_entity_id and commerce_id = v_ctx.session_commerce_id;
    if not found then raise exception 'entity_not_found'; end if;
    return jsonb_build_object('entity', v_entity, 'id', v_entity_id, 'mode', 'deactivated');
  end if;

  if v_entity = 'supplier' then
    if v_role not in ('owner', 'admin', 'warehouse') then raise exception 'permission_denied'; end if;
    update public.suppliers
    set is_active = false, updated_at = now()
    where id = v_entity_id and commerce_id = v_ctx.session_commerce_id;
    if not found then raise exception 'entity_not_found'; end if;
    return jsonb_build_object('entity', v_entity, 'id', v_entity_id, 'mode', 'deactivated');
  end if;

  if v_entity = 'branch' then
    if v_role not in ('owner', 'admin') then raise exception 'permission_denied'; end if;
    update public.branches
    set is_active = false, updated_at = now()
    where id = v_entity_id and commerce_id = v_ctx.session_commerce_id;
    if not found then raise exception 'entity_not_found'; end if;
    return jsonb_build_object('entity', v_entity, 'id', v_entity_id, 'mode', 'deactivated');
  end if;

  if v_entity in ('invoice', 'ticket') then
    if v_role not in ('owner', 'admin', 'cashier', 'warehouse') then raise exception 'permission_denied'; end if;
    delete from public.documents
    where id = v_entity_id
      and commerce_id = v_ctx.session_commerce_id
      and (
        (v_entity = 'invoice' and kind in ('factura', 'presupuesto', 'remito', 'nota_credito'))
        or (v_entity = 'ticket' and kind in ('ticket', 'postventa'))
      );
    if not found then raise exception 'entity_not_found'; end if;
    return jsonb_build_object('entity', v_entity, 'id', v_entity_id, 'mode', 'deleted');
  end if;

  if v_entity = 'cash_movement' then
    if v_role not in ('owner', 'admin', 'cashier') then raise exception 'permission_denied'; end if;
    delete from public.cash_movements
    where id = v_entity_id and commerce_id = v_ctx.session_commerce_id;
    if not found then raise exception 'entity_not_found'; end if;
    return jsonb_build_object('entity', v_entity, 'id', v_entity_id, 'mode', 'deleted');
  end if;

  if v_entity = 'purchase_receipt' then
    if v_role not in ('owner', 'admin', 'warehouse') then raise exception 'permission_denied'; end if;
    select * into v_receipt
    from public.purchase_receipts
    where id = v_entity_id and commerce_id = v_ctx.session_commerce_id
    for update;
    if v_receipt.id is null then raise exception 'entity_not_found'; end if;

    insert into public.product_branch_stock (commerce_id, product_id, branch_id, quantity)
    values (v_ctx.session_commerce_id, v_receipt.product_id, v_receipt.branch_id, 0)
    on conflict (product_id, branch_id) do nothing;

    update public.product_branch_stock
    set quantity = quantity - v_receipt.quantity, updated_at = now()
    where commerce_id = v_ctx.session_commerce_id
      and product_id = v_receipt.product_id
      and branch_id = v_receipt.branch_id;

    update public.suppliers
    set balance = greatest(0, coalesce(balance, 0) - coalesce(v_receipt.total_cost, 0)), updated_at = now()
    where id = v_receipt.supplier_id and commerce_id = v_ctx.session_commerce_id;

    delete from public.stock_movements
    where commerce_id = v_ctx.session_commerce_id
      and reference_id = v_receipt.id
      and reference_type = 'purchase_receipt';

    delete from public.purchase_receipts
    where id = v_receipt.id and commerce_id = v_ctx.session_commerce_id;

    return jsonb_build_object('entity', v_entity, 'id', v_entity_id, 'mode', 'deleted');
  end if;

  if v_entity = 'sale' then
    if v_role not in ('owner', 'admin', 'cashier') then raise exception 'permission_denied'; end if;
    select * into v_sale
    from public.sales
    where id = v_entity_id and commerce_id = v_ctx.session_commerce_id
    for update;
    if v_sale.id is null then raise exception 'entity_not_found'; end if;

    if v_sale.status not in ('cancelled', 'returned') then
      perform private.app_restore_sale_stock(
        v_ctx.session_commerce_id, v_sale, v_ctx.session_user_id,
        'Reverso por eliminacion de venta', 'return'
      );
      if v_sale.customer_id is not null then
        update public.customers
        set balance = greatest(
          0,
          coalesce(balance, 0) - greatest(coalesce(v_sale.total_amount, 0) - coalesce(v_sale.amount_paid, 0), 0)
        ), updated_at = now()
        where id = v_sale.customer_id and commerce_id = v_ctx.session_commerce_id;
      end if;
    end if;

    delete from public.documents
    where commerce_id = v_ctx.session_commerce_id and sale_id = v_sale.id;

    delete from public.sales
    where id = v_sale.id and commerce_id = v_ctx.session_commerce_id;

    return jsonb_build_object('entity', v_entity, 'id', v_entity_id, 'mode', 'deleted');
  end if;

  raise exception 'unsupported_entity_type';
end;
$$;

revoke all on function public.app_public_remove_entity(text, text, text) from public;
grant execute on function public.app_public_remove_entity(text, text, text) to anon, authenticated;
