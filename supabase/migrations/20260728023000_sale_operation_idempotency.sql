-- Una venta puede vencer en el navegador aun cuando PostgreSQL la confirme.
-- Esta bitacora hace que el mismo intento siempre devuelva el mismo resultado.
create table if not exists private.sale_operation_results (
  commerce_id uuid not null,
  operation_id uuid not null,
  sale_id uuid not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (commerce_id, operation_id),
  unique (commerce_id, sale_id)
);

revoke all on table private.sale_operation_results from public, anon, authenticated;

create or replace function public.app_public_create_sale(
  p_session_token text,
  p_customer_id text,
  p_channel text,
  p_payment_method text,
  p_discount_amount numeric,
  p_note text,
  p_is_paid boolean,
  p_auto_invoice boolean,
  p_cash_amount numeric,
  p_transfer_amount numeric,
  p_mercado_pago_amount numeric,
  p_echeq_amount numeric,
  p_echeq_details jsonb,
  p_account_amount numeric,
  p_items jsonb,
  p_branch_id text,
  p_register_id text,
  p_operation_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_ctx record;
  v_branch_id uuid;
  v_operation_id uuid;
  v_result jsonb;
  v_existing jsonb;
  v_stock record;
begin
  select * into v_ctx from public.app_public_session_context(p_session_token);
  v_operation_id := public.app_try_uuid(p_operation_id);

  if v_operation_id is null then
    raise exception 'operation_id_required';
  end if;

  -- Serializa solamente reintentos del mismo clic, no las ventas de otras cajas.
  perform pg_advisory_xact_lock(hashtextextended(v_ctx.session_commerce_id::text || ':' || v_operation_id::text, 0));

  select response into v_existing
  from private.sale_operation_results
  where commerce_id = v_ctx.session_commerce_id
    and operation_id = v_operation_id;

  if v_existing is not null then
    return v_existing || jsonb_build_object('idempotent_replay', true);
  end if;

  v_branch_id := coalesce(
    public.app_try_uuid(p_branch_id),
    (select active_branch_id from public.control_users where id = v_ctx.session_user_id),
    (select id from public.branches where commerce_id = v_ctx.session_commerce_id order by created_at asc limit 1)
  );

  -- Toma las filas de stock en un orden estable antes de validar y descontar.
  -- De este modo dos cajas no pueden aprobar a la vez la ultima unidad.
  for v_stock in
    select stock.product_id
    from public.product_branch_stock stock
    join public.products product on product.id = stock.product_id
    where stock.commerce_id = v_ctx.session_commerce_id
      and stock.branch_id = v_branch_id
      and product.track_stock is not false
      and stock.product_id in (
        select public.app_try_uuid(item ->> 'productId')
        from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) item
      )
    order by stock.product_id
    for update of stock
  loop
    null;
  end loop;

  v_result := public.app_public_create_sale(
    p_session_token, p_customer_id, p_channel, p_payment_method,
    p_discount_amount, p_note, p_is_paid, p_auto_invoice,
    p_cash_amount, p_transfer_amount, p_mercado_pago_amount,
    p_echeq_amount, p_echeq_details, p_account_amount, p_items,
    p_branch_id, p_register_id
  );

  insert into private.sale_operation_results (commerce_id, operation_id, sale_id, response)
  values (
    v_ctx.session_commerce_id,
    v_operation_id,
    (v_result ->> 'sale_id')::uuid,
    v_result
  );

  return v_result;
end;
$$;

revoke all on function public.app_public_create_sale(text, text, text, text, numeric, text, boolean, boolean, numeric, numeric, numeric, numeric, jsonb, numeric, jsonb, text, text, text) from public;
revoke all on function public.app_public_create_sale(text, text, text, text, numeric, text, boolean, boolean, numeric, numeric, numeric, numeric, jsonb, numeric, jsonb, text, text, text) from authenticated;
grant execute on function public.app_public_create_sale(text, text, text, text, numeric, text, boolean, boolean, numeric, numeric, numeric, numeric, jsonb, numeric, jsonb, text, text, text) to anon;
grant execute on function public.app_public_create_sale(text, text, text, text, numeric, text, boolean, boolean, numeric, numeric, numeric, numeric, jsonb, numeric, jsonb, text, text, text) to authenticated;
