-- Applied to prod rfwsnqmjkclxhbmidbkm 2026-09-06 by Supra (orden Eustekio).
-- Scope branch/register to session commerce on app_public_create_sale overloads.
-- Also assert sales:write on core + echeq wrapper (operation_id wrapper already asserts).
-- No DROP of overloads.

CREATE OR REPLACE FUNCTION public.app_public_create_sale(p_session_token text, p_customer_id text DEFAULT NULL::text, p_channel text DEFAULT 'Mostrador'::text, p_payment_method text DEFAULT 'cash'::text, p_discount_amount numeric DEFAULT 0, p_note text DEFAULT NULL::text, p_is_paid boolean DEFAULT false, p_auto_invoice boolean DEFAULT false, p_cash_amount numeric DEFAULT 0, p_transfer_amount numeric DEFAULT 0, p_mercado_pago_amount numeric DEFAULT 0, p_account_amount numeric DEFAULT 0, p_items jsonb DEFAULT '[]'::jsonb, p_branch_id text DEFAULT NULL::text, p_register_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare
  v_ctx record;
  v_branch_id uuid;
  v_register_id uuid;
  v_customer_id uuid := public.app_try_uuid(p_customer_id);
  v_cash_session public.cash_sessions;
  v_sale public.sales;
  v_item jsonb;
  v_product public.products;
  v_item_quantity numeric;
  v_unit_price numeric;
  v_line_total numeric;
  v_available numeric;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_total numeric := 0;
  v_raw_paid numeric := 0;
  v_amount_paid numeric := 0;
  v_cash_amount numeric := greatest(coalesce(p_cash_amount, 0), 0);
  v_transfer_amount numeric := greatest(coalesce(p_transfer_amount, 0), 0);
  v_mp_amount numeric := greatest(coalesce(p_mercado_pago_amount, 0), 0);
  v_account_amount numeric := greatest(coalesce(p_account_amount, 0), 0);
  v_total_quantity numeric := 0;
  v_sale_status text;
  v_balance_due numeric := 0;
  v_document_id uuid := null;
  v_document_number text := null;
  v_branch_code text := 'SUC';
begin
  select * into v_ctx from public.app_public_session_context(p_session_token);

  if coalesce(v_ctx.session_role_key, 'cashier') not in ('owner', 'admin', 'cashier') then
    raise exception 'permission_denied';
  end if;

  perform private.app_assert_membership_permission(
    v_ctx.session_commerce_id,
    v_ctx.session_user_id,
    v_ctx.session_is_owner,
    'sales:write',
    'sales'
  );

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'sale_items_required';
  end if;

  v_branch_id := coalesce(
    public.app_try_uuid(p_branch_id),
    (select active_branch_id from public.control_users where id = v_ctx.session_user_id),
    (select id from public.branches where commerce_id = v_ctx.session_commerce_id order by created_at asc limit 1)
  );

  if v_branch_id is null
     or not exists (
       select 1 from public.branches
       where id = v_branch_id
         and commerce_id = v_ctx.session_commerce_id
     )
  then
    raise exception 'branch_not_found';
  end if;

  select code into v_branch_code
  from public.branches
  where id = v_branch_id
    and commerce_id = v_ctx.session_commerce_id;

  v_register_id := coalesce(
    public.app_try_uuid(p_register_id),
    (select assigned_register_id from public.control_users where id = v_ctx.session_user_id),
    (select id from public.registers where commerce_id = v_ctx.session_commerce_id and branch_id = v_branch_id order by created_at asc limit 1)
  );

  if v_register_id is null
     or not exists (
       select 1 from public.registers
       where id = v_register_id
         and commerce_id = v_ctx.session_commerce_id
         and branch_id = v_branch_id
     )
  then
    raise exception 'register_not_found';
  end if;

  if v_customer_id is not null and not exists (
    select 1 from public.customers where id = v_customer_id and commerce_id = v_ctx.session_commerce_id
  ) then
    raise exception 'customer_not_in_commerce';
  end if;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    select *
    into v_product
    from public.products
    where id = public.app_try_uuid(v_item ->> 'productId')
      and commerce_id = v_ctx.session_commerce_id
    limit 1;

    if v_product.id is null then
      raise exception 'product_not_found';
    end if;

    v_item_quantity := greatest(coalesce((v_item ->> 'quantity')::numeric, 0), 0);
    if v_item_quantity <= 0 then
      continue;
    end if;

    v_unit_price := greatest(coalesce(v_product.sale_price, 0), 0);
    v_line_total := v_unit_price * v_item_quantity;
    v_subtotal := v_subtotal + v_line_total;
    v_total_quantity := v_total_quantity + v_item_quantity;

    if coalesce(v_product.track_stock, true) then
      select coalesce(quantity, 0)
      into v_available
      from public.product_branch_stock
      where commerce_id = v_ctx.session_commerce_id
        and product_id = v_product.id
        and branch_id = v_branch_id;

      v_available := coalesce(v_available, 0);
      if v_available < v_item_quantity then
        raise exception 'stock_insufficient_for_%', v_product.name;
      end if;
    end if;
  end loop;

  if v_total_quantity <= 0 then
    raise exception 'sale_items_required';
  end if;

  v_discount := greatest(0, least(coalesce(p_discount_amount, 0), v_subtotal));
  v_total := v_subtotal - v_discount;

  if lower(coalesce(p_payment_method, 'cash')) = 'mixed' then
    v_raw_paid := v_cash_amount + v_transfer_amount + v_mp_amount + v_account_amount;
  elsif lower(coalesce(p_payment_method, 'cash')) = 'cash' then
    v_cash_amount := case when coalesce(p_is_paid, false) then v_total else greatest(coalesce(p_cash_amount, 0), 0) end;
    v_raw_paid := v_cash_amount;
  elsif lower(coalesce(p_payment_method, 'cash')) = 'transfer' then
    v_transfer_amount := case when coalesce(p_is_paid, false) then v_total else greatest(coalesce(p_transfer_amount, 0), 0) end;
    v_raw_paid := v_transfer_amount;
  elsif lower(coalesce(p_payment_method, 'cash')) = 'mercado_pago' then
    v_mp_amount := case when coalesce(p_is_paid, false) then v_total else greatest(coalesce(p_mercado_pago_amount, 0), 0) end;
    v_raw_paid := v_mp_amount;
  elsif lower(coalesce(p_payment_method, 'cash')) = 'account' then
    v_account_amount := v_total;
    v_raw_paid := greatest(coalesce(v_cash_amount, 0), 0) + greatest(coalesce(v_transfer_amount, 0), 0) + greatest(coalesce(v_mp_amount, 0), 0);
  else
    raise exception 'invalid_payment_method';
  end if;

  if v_raw_paid > v_total then
    raise exception 'amount_paid_exceeds_total';
  end if;

  v_amount_paid := greatest(0, least(v_raw_paid, v_total));
  v_sale_status := case
    when v_total <= 0 then 'completed'
    when v_amount_paid <= 0 then 'pending'
    when v_amount_paid >= v_total then 'completed'
    else 'partial'
  end;

  if v_cash_amount > 0 then
    select *
    into v_cash_session
    from public.cash_sessions
    where commerce_id = v_ctx.session_commerce_id
      and register_id = v_register_id
      and status = 'open'
    order by opened_at desc
    limit 1;

    if v_cash_session.id is null then
      raise exception 'cash_session_required';
    end if;
  end if;

  insert into public.sales (
    commerce_id,
    branch_id,
    register_id,
    seller_user_id,
    customer_id,
    cash_session_id,
    channel,
    payment_method,
    status,
    subtotal_amount,
    discount_amount,
    total_amount,
    amount_paid,
    total_quantity,
    note
  )
  values (
    v_ctx.session_commerce_id,
    v_branch_id,
    v_register_id,
    v_ctx.session_user_id,
    v_customer_id,
    case when v_cash_amount > 0 then v_cash_session.id else null end,
    lower(trim(coalesce(p_channel, 'mostrador'))),
    lower(trim(coalesce(p_payment_method, 'cash'))),
    v_sale_status,
    v_subtotal,
    v_discount,
    v_total,
    v_amount_paid,
    v_total_quantity,
    trim(coalesce(p_note, ''))
  )
  returning * into v_sale;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    select *
    into v_product
    from public.products
    where id = public.app_try_uuid(v_item ->> 'productId')
      and commerce_id = v_ctx.session_commerce_id
    limit 1;

    v_item_quantity := greatest(coalesce((v_item ->> 'quantity')::numeric, 0), 0);
    if v_product.id is null or v_item_quantity <= 0 then
      continue;
    end if;

    v_unit_price := greatest(coalesce(v_product.sale_price, 0), 0);
    v_line_total := v_unit_price * v_item_quantity;

    insert into public.sale_items (
      commerce_id,
      sale_id,
      product_id,
      quantity,
      unit_price,
      line_total
    )
    values (
      v_ctx.session_commerce_id,
      v_sale.id,
      v_product.id,
      v_item_quantity,
      v_unit_price,
      v_line_total
    );

    if coalesce(v_product.track_stock, true) then
      update public.product_branch_stock
      set
        quantity = quantity - v_item_quantity,
        updated_at = now()
      where commerce_id = v_ctx.session_commerce_id
        and product_id = v_product.id
        and branch_id = v_branch_id;

      insert into public.stock_movements (
        commerce_id,
        branch_id,
        product_id,
        reference_id,
        reference_type,
        movement_type,
        quantity,
        notes,
        created_by
      )
      values (
        v_ctx.session_commerce_id,
        v_branch_id,
        v_product.id,
        v_sale.id,
        'sale',
        'sale',
        v_item_quantity * -1,
        'Venta ' || initcap(lower(trim(coalesce(p_channel, 'mostrador')))),
        v_ctx.session_user_id
      );
    end if;
  end loop;

  if v_cash_amount > 0 then
    insert into public.sale_payments (commerce_id, sale_id, method_key, amount)
    values (v_ctx.session_commerce_id, v_sale.id, 'cash', v_cash_amount);

    insert into public.cash_movements (
      commerce_id,
      branch_id,
      register_id,
      cash_session_id,
      created_by,
      kind,
      amount,
      signed_amount,
      note
    )
    values (
      v_ctx.session_commerce_id,
      v_branch_id,
      v_register_id,
      v_cash_session.id,
      v_ctx.session_user_id,
      'sale',
      v_cash_amount,
      abs(v_cash_amount),
      'Cobro de venta'
    );
  end if;

  if v_transfer_amount > 0 then
    insert into public.sale_payments (commerce_id, sale_id, method_key, amount)
    values (v_ctx.session_commerce_id, v_sale.id, 'transfer', v_transfer_amount);
  end if;

  if v_mp_amount > 0 then
    insert into public.sale_payments (commerce_id, sale_id, method_key, amount)
    values (v_ctx.session_commerce_id, v_sale.id, 'mercado_pago', v_mp_amount);
  end if;

  if v_account_amount > 0 then
    insert into public.sale_payments (commerce_id, sale_id, method_key, amount)
    values (v_ctx.session_commerce_id, v_sale.id, 'account', v_account_amount);
  end if;

  v_balance_due := greatest(v_total - v_amount_paid, 0);
  if v_customer_id is not null and v_balance_due > 0 then
    update public.customers
    set
      balance = coalesce(balance, 0) + v_balance_due,
      updated_at = now()
    where id = v_customer_id
      and commerce_id = v_ctx.session_commerce_id;
  end if;

  if coalesce(p_auto_invoice, false) and v_customer_id is not null and v_amount_paid > 0 then
    v_document_id := gen_random_uuid();
    v_document_number := 'FAC-' || coalesce(v_branch_code, 'SUC') || '-' || to_char(now(), 'YYYYMMDDHH24MISSMS');

    insert into public.documents (
      id,
      commerce_id,
      branch_id,
      sale_id,
      customer_id,
      document_number,
      kind,
      fiscal_type,
      status,
      fiscal_status,
      total_amount,
      payload_json
    )
    values (
      v_document_id,
      v_ctx.session_commerce_id,
      v_branch_id,
      v_sale.id,
      v_customer_id,
      v_document_number,
      'factura',
      'B',
      case when v_amount_paid >= v_total then 'Cobrada' else 'Emitida' end,
      'Pendiente',
      v_total,
      jsonb_build_object(
        'generatedFrom', 'sale',
        'saleId', v_sale.id
      )
    );
  end if;

  return jsonb_build_object(
    'sale_id', v_sale.id,
    'invoice_id', v_document_id,
    'invoice_number', v_document_number,
    'status', v_sale.status,
    'total_amount', v_sale.total_amount,
    'amount_paid', v_sale.amount_paid
  );
end;
$function$;


CREATE OR REPLACE FUNCTION public.app_public_create_sale(p_session_token text, p_customer_id text, p_channel text, p_payment_method text, p_discount_amount numeric, p_note text, p_is_paid boolean, p_auto_invoice boolean, p_cash_amount numeric, p_transfer_amount numeric, p_mercado_pago_amount numeric, p_echeq_amount numeric, p_echeq_details jsonb, p_account_amount numeric, p_items jsonb, p_branch_id text, p_register_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare
  v_ctx record;
  v_result jsonb;
  v_sale_id uuid;
  v_echeq numeric := greatest(coalesce(p_echeq_amount, 0), 0);
  v_commerce_id uuid;
  v_branch_id uuid;
  v_customer_id uuid;
  v_total numeric;
  v_amount_paid numeric;
  v_document_id uuid;
  v_document_number text;
  v_internal_sequence integer;
begin
  select * into v_ctx from public.app_public_session_context(p_session_token);
  perform private.app_assert_membership_permission(
    v_ctx.session_commerce_id,
    v_ctx.session_user_id,
    v_ctx.session_is_owner,
    'sales:write',
    'sales'
  );

  if v_echeq > 0 and lower(coalesce(p_payment_method, '')) = 'mixed' then raise exception 'echeq_mixed_not_supported'; end if;
  if lower(coalesce(p_payment_method, '')) = 'echeq' and trim(coalesce(p_echeq_details ->> 'number', '')) = '' then raise exception 'echeq_number_required'; end if;

  v_result := public.app_public_create_sale(
    p_session_token, p_customer_id, p_channel,
    case when lower(coalesce(p_payment_method, '')) = 'echeq' then 'mercado_pago' else p_payment_method end,
    p_discount_amount, p_note, p_is_paid, false, p_cash_amount, p_transfer_amount,
    case when lower(coalesce(p_payment_method, '')) = 'echeq' then v_echeq else p_mercado_pago_amount end,
    p_account_amount, p_items, p_branch_id, p_register_id
  );
  v_sale_id := (v_result ->> 'sale_id')::uuid;

  if coalesce(p_auto_invoice, false) and coalesce((v_result ->> 'amount_paid')::numeric, 0) > 0 then
    select sale.commerce_id, sale.branch_id, sale.customer_id, sale.total_amount, sale.amount_paid
      into v_commerce_id, v_branch_id, v_customer_id, v_total, v_amount_paid
    from public.sales sale
    where sale.id = v_sale_id;

    if not exists (select 1 from public.documents where sale_id = v_sale_id) then
      perform pg_advisory_xact_lock(hashtext('pclaf_internal_invoice:' || v_commerce_id::text));
      select coalesce(max(nullif(substring(document_number from '^INT-0001-([0-9]{8})$'), '')::integer), 0) + 1
        into v_internal_sequence
      from public.documents
      where commerce_id = v_commerce_id;

      v_document_id := gen_random_uuid();
      v_document_number := 'INT-0001-' || lpad(v_internal_sequence::text, 8, '0');
      insert into public.documents (
        id, commerce_id, branch_id, sale_id, customer_id, document_number,
        kind, fiscal_type, status, fiscal_status, total_amount, payload_json
      ) values (
        v_document_id, v_commerce_id, v_branch_id, v_sale_id, v_customer_id, v_document_number,
        'factura', 'X', case when v_amount_paid >= v_total then 'Cobrada' else 'Emitida' end, 'Interno', v_total,
        jsonb_build_object('generatedFrom', 'sale', 'saleId', v_sale_id, 'consumerFinal', true, 'internalDocument', true, 'fiscalAuthorization', false)
      );
      v_result := v_result || jsonb_build_object('invoice_id', v_document_id, 'invoice_number', v_document_number);
    end if;
  end if;

  if lower(coalesce(p_payment_method, '')) = 'echeq' then
    update public.sales set payment_method = 'echeq', updated_at = now() where id = v_sale_id;
    update public.sale_payments set method_key = 'echeq', metadata = coalesce(p_echeq_details, '{}'::jsonb) where sale_id = v_sale_id and method_key = 'mercado_pago';
  end if;
  return v_result;
end;
$function$;


CREATE OR REPLACE FUNCTION public.app_public_create_sale(p_session_token text, p_customer_id text, p_channel text, p_payment_method text, p_discount_amount numeric, p_note text, p_is_paid boolean, p_auto_invoice boolean, p_cash_amount numeric, p_transfer_amount numeric, p_mercado_pago_amount numeric, p_echeq_amount numeric, p_echeq_details jsonb, p_account_amount numeric, p_items jsonb, p_branch_id text, p_register_id text, p_operation_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare
  v_ctx record;
  v_branch_id uuid;
  v_operation_id uuid;
  v_result jsonb;
  v_existing jsonb;
  v_stock record;
begin
  select * into v_ctx from public.app_public_session_context(p_session_token);
  perform private.app_assert_membership_permission(
    v_ctx.session_commerce_id,
    v_ctx.session_user_id,
    v_ctx.session_is_owner,
    'sales:write',
    'sales'
  );
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

  if v_branch_id is null
     or not exists (
       select 1 from public.branches
       where id = v_branch_id
         and commerce_id = v_ctx.session_commerce_id
     )
  then
    raise exception 'branch_not_found';
  end if;

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
$function$;
