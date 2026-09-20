-- Optional product SKU / internal code (Eustekio + Lucas).
-- Blank SKU stored as NULL so multiple products can omit it.
-- Unique (commerce_id, sku) keeps uniqueness only when sku is present (Postgres allows multiple NULLs).

update public.products
set sku = null
where trim(coalesce(sku, '')) = '';

alter table public.products
  alter column sku drop not null;

-- Recreate unique if it was named differently in older DBs.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.products'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%(commerce_id, sku)%'
  ) then
    execute (
      select format('alter table public.products drop constraint %I', conname)
      from pg_constraint
      where conrelid = 'public.products'::regclass
        and contype = 'u'
        and pg_get_constraintdef(oid) ilike '%(commerce_id, sku)%'
      limit 1
    );
  end if;
end $$;

alter table public.products
  add constraint products_commerce_id_sku_key unique (commerce_id, sku);

create or replace function public.app_public_upsert_product(
  p_session_token text,
  p_product_id text default null,
  p_name text default null,
  p_sku text default null,
  p_barcode text default null,
  p_stock numeric default 0,
  p_sale_price numeric default 0,
  p_cost_price numeric default 0,
  p_min_stock numeric default 0,
  p_category text default null,
  p_track_stock boolean default true,
  p_branch_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ctx record;
  v_product public.products;
  v_product_id uuid := coalesce(public.app_try_uuid(p_product_id), gen_random_uuid());
  v_branch_id uuid;
  v_existing_stock numeric := 0;
  v_new_stock numeric := greatest(coalesce(p_stock, 0), 0);
  v_delta numeric := 0;
  v_sku text := nullif(trim(coalesce(p_sku, '')), '');
begin
  select * into v_ctx from public.app_public_session_context(p_session_token);

  if coalesce(v_ctx.session_role_key, 'cashier') not in ('owner', 'admin', 'warehouse') then
    raise exception 'permission_denied';
  end if;

  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'product_name_required';
  end if;

  v_branch_id := coalesce(
    public.app_try_uuid(p_branch_id),
    (select active_branch_id from public.control_users where id = v_ctx.session_user_id),
    (select id from public.branches where commerce_id = v_ctx.session_commerce_id order by created_at asc limit 1)
  );

  if v_branch_id is null then
    raise exception 'branch_not_found';
  end if;

  if exists (
    select 1
    from public.products
    where id = v_product_id
      and commerce_id <> v_ctx.session_commerce_id
  ) then
    raise exception 'product_not_in_commerce';
  end if;

  insert into public.products (
    id,
    commerce_id,
    name,
    sku,
    barcode,
    category,
    sale_price,
    cost_price,
    min_stock,
    track_stock,
    is_active
  )
  values (
    v_product_id,
    v_ctx.session_commerce_id,
    trim(p_name),
    v_sku,
    trim(coalesce(p_barcode, '')),
    trim(coalesce(p_category, '')),
    greatest(coalesce(p_sale_price, 0), 0),
    greatest(coalesce(p_cost_price, 0), 0),
    greatest(coalesce(p_min_stock, 0), 0),
    coalesce(p_track_stock, true),
    true
  )
  on conflict (id) do update
  set
    name = excluded.name,
    sku = excluded.sku,
    barcode = excluded.barcode,
    category = excluded.category,
    sale_price = excluded.sale_price,
    cost_price = excluded.cost_price,
    min_stock = excluded.min_stock,
    track_stock = excluded.track_stock,
    updated_at = now()
  returning * into v_product;

  select quantity
  into v_existing_stock
  from public.product_branch_stock
  where commerce_id = v_ctx.session_commerce_id
    and product_id = v_product.id
    and branch_id = v_branch_id;

  v_existing_stock := coalesce(v_existing_stock, 0);
  v_delta := v_new_stock - v_existing_stock;

  insert into public.product_branch_stock (
    commerce_id,
    product_id,
    branch_id,
    quantity
  )
  values (
    v_ctx.session_commerce_id,
    v_product.id,
    v_branch_id,
    v_new_stock
  )
  on conflict (product_id, branch_id) do update
  set
    quantity = excluded.quantity,
    updated_at = now();

  if coalesce(v_product.track_stock, true) and v_delta <> 0 then
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
      v_product.id,
      'product',
      case when v_delta >= 0 then 'adjustment_in' else 'adjustment_out' end,
      v_delta,
      case when v_existing_stock = 0 then 'Stock inicial' else 'Ajuste de stock desde producto' end,
      v_ctx.session_user_id
    );
  end if;

  return jsonb_build_object(
    'id', v_product.id,
    'name', v_product.name,
    'sku', v_product.sku,
    'barcode', v_product.barcode,
    'category', v_product.category,
    'sale_price', v_product.sale_price,
    'cost_price', v_product.cost_price,
    'min_stock', v_product.min_stock,
    'track_stock', v_product.track_stock,
    'branch_id', v_branch_id,
    'stock', v_new_stock
  );
end;
$$;

revoke all on function public.app_public_upsert_product(text, text, text, text, text, numeric, numeric, numeric, numeric, text, boolean, text) from public;
revoke all on function public.app_public_upsert_product(text, text, text, text, text, numeric, numeric, numeric, numeric, text, boolean, text) from authenticated;
grant execute on function public.app_public_upsert_product(text, text, text, text, text, numeric, numeric, numeric, numeric, text, boolean, text) to anon;
grant execute on function public.app_public_upsert_product(text, text, text, text, text, numeric, numeric, numeric, numeric, text, boolean, text) to service_role;
