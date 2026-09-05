-- P0: transfer stock RPC
create or replace function public.app_public_transfer_stock(
  p_session_token text,
  p_product_id text,
  p_quantity numeric,
  p_from_branch_id text,
  p_to_branch_id text,
  p_note text default null,
  p_operation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_ctx record;
  v_product public.products;
  v_product_id uuid := public.app_try_uuid(p_product_id);
  v_from_branch_id uuid := public.app_try_uuid(p_from_branch_id);
  v_to_branch_id uuid := public.app_try_uuid(p_to_branch_id);
  v_quantity numeric := greatest(coalesce(p_quantity, 0), 0);
  v_operation_id uuid := public.app_try_uuid(p_operation_id);
  v_replay jsonb;
  v_available numeric := 0;
  v_transfer_id uuid := gen_random_uuid();
  v_from_name text;
  v_to_name text;
  v_note text;
  v_result jsonb;
begin
  select * into v_ctx from public.app_public_session_context(p_session_token);

  if coalesce(v_ctx.session_role_key, 'cashier') not in ('owner', 'admin', 'warehouse') then
    raise exception 'permission_denied';
  end if;

  v_replay := private.app_mutation_replay_or_lock(v_ctx.session_commerce_id, 'transfer_stock', v_operation_id);
  if v_replay is not null then
    return v_replay;
  end if;

  if v_quantity <= 0 then
    raise exception 'invalid_quantity';
  end if;

  if v_from_branch_id is null or v_to_branch_id is null or v_from_branch_id = v_to_branch_id then
    raise exception 'invalid_branch_transfer';
  end if;

  select * into v_product
  from public.products
  where id = v_product_id and commerce_id = v_ctx.session_commerce_id;

  if v_product.id is null then
    raise exception 'product_not_found';
  end if;

  select name into v_from_name
  from public.branches
  where id = v_from_branch_id and commerce_id = v_ctx.session_commerce_id;

  select name into v_to_name
  from public.branches
  where id = v_to_branch_id and commerce_id = v_ctx.session_commerce_id;

  if v_from_name is null or v_to_name is null then
    raise exception 'branch_not_found';
  end if;

  insert into public.product_branch_stock (commerce_id, product_id, branch_id, quantity)
  values (v_ctx.session_commerce_id, v_product.id, v_from_branch_id, 0)
  on conflict (product_id, branch_id) do nothing;

  insert into public.product_branch_stock (commerce_id, product_id, branch_id, quantity)
  values (v_ctx.session_commerce_id, v_product.id, v_to_branch_id, 0)
  on conflict (product_id, branch_id) do nothing;

  select quantity into v_available
  from public.product_branch_stock
  where commerce_id = v_ctx.session_commerce_id
    and product_id = v_product.id
    and branch_id = v_from_branch_id
  for update;

  v_available := coalesce(v_available, 0);
  if v_available < v_quantity then
    raise exception 'stock_insufficient';
  end if;

  perform 1 from public.product_branch_stock
  where commerce_id = v_ctx.session_commerce_id
    and product_id = v_product.id
    and branch_id = v_to_branch_id
  for update;

  update public.product_branch_stock
  set quantity = quantity - v_quantity, updated_at = now()
  where commerce_id = v_ctx.session_commerce_id
    and product_id = v_product.id
    and branch_id = v_from_branch_id;

  update public.product_branch_stock
  set quantity = quantity + v_quantity, updated_at = now()
  where commerce_id = v_ctx.session_commerce_id
    and product_id = v_product.id
    and branch_id = v_to_branch_id;

  v_note := trim(coalesce(p_note, ''));

  insert into public.stock_movements (
    commerce_id, branch_id, product_id, reference_id, reference_type,
    movement_type, quantity, notes, created_by
  ) values (
    v_ctx.session_commerce_id, v_from_branch_id, v_product.id, v_transfer_id, 'transfer',
    'transfer_out', v_quantity * -1,
    case when v_note = '' then 'Transferencia a ' || v_to_name else v_note end,
    v_ctx.session_user_id
  );

  insert into public.stock_movements (
    commerce_id, branch_id, product_id, reference_id, reference_type,
    movement_type, quantity, notes, created_by
  ) values (
    v_ctx.session_commerce_id, v_to_branch_id, v_product.id, v_transfer_id, 'transfer',
    'transfer_in', v_quantity,
    case when v_note = '' then 'Transferencia desde ' || v_from_name else v_note end,
    v_ctx.session_user_id
  );

  v_result := jsonb_build_object(
    'transfer_id', v_transfer_id,
    'product_id', v_product.id,
    'quantity', v_quantity,
    'from_branch_id', v_from_branch_id,
    'to_branch_id', v_to_branch_id
  );

  return private.app_mutation_store_result(
    v_ctx.session_commerce_id, 'transfer_stock', v_operation_id, v_transfer_id, v_result
  );
end;
$$;

revoke all on function public.app_public_transfer_stock(text, text, numeric, text, text, text, text) from public;
grant execute on function public.app_public_transfer_stock(text, text, numeric, text, text, text, text) to anon, authenticated;
