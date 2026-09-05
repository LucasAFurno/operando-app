-- P0: create stock adjustment RPC
create or replace function public.app_public_create_stock_adjustment(
  p_session_token text,
  p_product_id text,
  p_quantity numeric,
  p_note text default null,
  p_branch_id text default null,
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
  v_branch_id uuid;
  v_quantity numeric := coalesce(p_quantity, 0);
  v_operation_id uuid := public.app_try_uuid(p_operation_id);
  v_replay jsonb;
  v_available numeric := 0;
  v_movement_id uuid := gen_random_uuid();
  v_result jsonb;
begin
  select * into v_ctx from public.app_public_session_context(p_session_token);

  if coalesce(v_ctx.session_role_key, 'cashier') not in ('owner', 'admin', 'warehouse') then
    raise exception 'permission_denied';
  end if;

  v_replay := private.app_mutation_replay_or_lock(v_ctx.session_commerce_id, 'stock_adjustment', v_operation_id);
  if v_replay is not null then
    return v_replay;
  end if;

  if v_quantity = 0 then
    raise exception 'invalid_quantity';
  end if;

  select * into v_product
  from public.products
  where id = v_product_id
    and commerce_id = v_ctx.session_commerce_id;

  if v_product.id is null then
    raise exception 'product_not_found';
  end if;

  v_branch_id := coalesce(
    public.app_try_uuid(p_branch_id),
    (select active_branch_id from public.control_users where id = v_ctx.session_user_id),
    (select id from public.branches where commerce_id = v_ctx.session_commerce_id order by created_at asc limit 1)
  );

  if v_branch_id is null or not exists (
    select 1 from public.branches where id = v_branch_id and commerce_id = v_ctx.session_commerce_id
  ) then
    raise exception 'branch_not_found';
  end if;

  insert into public.product_branch_stock (commerce_id, product_id, branch_id, quantity)
  values (v_ctx.session_commerce_id, v_product.id, v_branch_id, 0)
  on conflict (product_id, branch_id) do nothing;

  select quantity into v_available
  from public.product_branch_stock
  where commerce_id = v_ctx.session_commerce_id
    and product_id = v_product.id
    and branch_id = v_branch_id
  for update;

  v_available := coalesce(v_available, 0);
  if v_quantity < 0 and v_available < abs(v_quantity) then
    raise exception 'stock_insufficient';
  end if;

  update public.product_branch_stock
  set quantity = quantity + v_quantity, updated_at = now()
  where commerce_id = v_ctx.session_commerce_id
    and product_id = v_product.id
    and branch_id = v_branch_id;

  insert into public.stock_movements (
    id, commerce_id, branch_id, product_id, reference_id, reference_type,
    movement_type, quantity, notes, created_by
  ) values (
    v_movement_id,
    v_ctx.session_commerce_id,
    v_branch_id,
    v_product.id,
    v_product.id,
    'product',
    case when v_quantity > 0 then 'adjustment_in' else 'adjustment_out' end,
    v_quantity,
    trim(coalesce(nullif(p_note, ''), 'Ajuste manual de stock')),
    v_ctx.session_user_id
  );

  v_result := jsonb_build_object(
    'movement_id', v_movement_id,
    'product_id', v_product.id,
    'branch_id', v_branch_id,
    'quantity', v_quantity,
    'stock', v_available + v_quantity
  );

  return private.app_mutation_store_result(
    v_ctx.session_commerce_id, 'stock_adjustment', v_operation_id, v_movement_id, v_result
  );
end;
$$;

revoke all on function public.app_public_create_stock_adjustment(text, text, numeric, text, text, text) from public;
grant execute on function public.app_public_create_stock_adjustment(text, text, numeric, text, text, text) to anon, authenticated;
