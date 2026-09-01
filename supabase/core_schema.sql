create extension if not exists pgcrypto;

create or replace function public.app_try_uuid(p_value text)
returns uuid
language plpgsql
immutable
as $$
begin
  if p_value is null or btrim(p_value) = '' then
    return null;
  end if;
  return p_value::uuid;
exception
  when others then
    return null;
end;
$$;

create table if not exists public.commerce_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  legal_name text not null default '',
  owner_email text not null,
  active_plan text not null default 'full' check (active_plan in ('basic', 'retail', 'full', 'custom')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  currency_code text not null default 'ARS',
  settings_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.commerce_accounts
  add column if not exists onboarding_country text not null default '',
  add column if not exists onboarding_industry text not null default '',
  add column if not exists onboarding_phone text not null default '',
  add column if not exists onboarding_email text not null default '',
  add column if not exists onboarding_needs_arca boolean,
  add column if not exists onboarding_goals jsonb not null default '[]'::jsonb,
  add column if not exists onboarding_status text not null default 'pending';

alter table public.control_users
  add column if not exists active_commerce_id uuid references public.commerce_accounts(id) on delete set null,
  add column if not exists active_branch_id uuid,
  add column if not exists assigned_register_id uuid;

create table if not exists public.commerce_memberships (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null references public.commerce_accounts(id) on delete cascade,
  user_id uuid not null references public.control_users(id) on delete cascade,
  role_key text not null default 'cashier' check (role_key in ('owner', 'admin', 'cashier', 'warehouse')),
  status text not null default 'pending' check (status in ('pending', 'active', 'disabled')),
  is_owner boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (commerce_id, user_id)
);

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null references public.commerce_accounts(id) on delete cascade,
  code text not null,
  name text not null,
  address text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (commerce_id, code)
);

create table if not exists public.registers (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null references public.commerce_accounts(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  code text not null,
  name text not null,
  cashier_user_id uuid references public.control_users(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (commerce_id, code)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null references public.commerce_accounts(id) on delete cascade,
  full_name text not null,
  phone text not null default '',
  email text not null default '',
  balance numeric(14,2) not null default 0,
  tag text not null default '',
  notes text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null references public.commerce_accounts(id) on delete cascade,
  name text not null,
  contact text not null default '',
  phone text not null default '',
  email text not null default '',
  category text not null default '',
  balance numeric(14,2) not null default 0,
  last_delivery date,
  notes text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null references public.commerce_accounts(id) on delete cascade,
  sku text not null,
  barcode text not null default '',
  name text not null,
  category text not null default '',
  sale_price numeric(14,2) not null default 0,
  cost_price numeric(14,2) not null default 0,
  min_stock numeric(14,2) not null default 0,
  track_stock boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (commerce_id, sku)
);

create table if not exists public.product_branch_stock (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null references public.commerce_accounts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  quantity numeric(14,2) not null default 0,
  updated_at timestamptz not null default now(),
  unique (product_id, branch_id)
);

create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null references public.commerce_accounts(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  register_id uuid not null references public.registers(id) on delete cascade,
  opened_by uuid references public.control_users(id) on delete set null,
  closed_by uuid references public.control_users(id) on delete set null,
  opening_amount numeric(14,2) not null default 0,
  counted_amount numeric(14,2),
  expected_amount numeric(14,2),
  difference_amount numeric(14,2),
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null references public.commerce_accounts(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  register_id uuid references public.registers(id) on delete set null,
  cash_session_id uuid references public.cash_sessions(id) on delete set null,
  created_by uuid references public.control_users(id) on delete set null,
  kind text not null check (kind in ('income', 'deposit', 'expense', 'withdrawal', 'sale', 'refund', 'adjustment')),
  amount numeric(14,2) not null default 0,
  signed_amount numeric(14,2) not null default 0,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null references public.commerce_accounts(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  register_id uuid references public.registers(id) on delete set null,
  seller_user_id uuid references public.control_users(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  cash_session_id uuid references public.cash_sessions(id) on delete set null,
  channel text not null default 'mostrador',
  payment_method text not null default 'cash',
  status text not null default 'pending' check (status in ('pending', 'partial', 'completed', 'cancelled', 'returned')),
  subtotal_amount numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  amount_paid numeric(14,2) not null default 0,
  total_quantity numeric(14,2) not null default 0,
  note text not null default '',
  sold_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null references public.commerce_accounts(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric(14,2) not null default 0,
  unit_price numeric(14,2) not null default 0,
  line_total numeric(14,2) not null default 0
);

create table if not exists public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null references public.commerce_accounts(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  method_key text not null check (method_key in ('cash', 'transfer', 'mercado_pago', 'account')),
  amount numeric(14,2) not null default 0
);

create table if not exists public.purchase_receipts (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null references public.commerce_accounts(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  received_by uuid references public.control_users(id) on delete set null,
  document_number text not null default '',
  quantity numeric(14,2) not null default 0,
  unit_cost numeric(14,2) not null default 0,
  total_cost numeric(14,2) not null default 0,
  note text not null default '',
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null references public.commerce_accounts(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  related_document_id uuid references public.documents(id) on delete set null,
  document_number text not null,
  kind text not null check (kind in ('ticket', 'presupuesto', 'factura', 'remito', 'nota_credito', 'postventa')),
  fiscal_type text not null default 'B',
  status text not null default 'emitida',
  fiscal_status text not null default 'pendiente',
  total_amount numeric(14,2) not null default 0,
  payload_json jsonb not null default '{}'::jsonb,
  issued_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (commerce_id, document_number)
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null references public.commerce_accounts(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  product_id uuid not null references public.products(id) on delete restrict,
  reference_id uuid,
  reference_type text not null default 'adjustment',
  movement_type text not null check (movement_type in ('purchase', 'sale', 'return', 'adjustment_in', 'adjustment_out', 'transfer_in', 'transfer_out')),
  quantity numeric(14,2) not null default 0,
  notes text not null default '',
  created_by uuid references public.control_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs_core (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null references public.commerce_accounts(id) on delete cascade,
  actor_user_id uuid references public.control_users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists commerce_accounts_touch_updated_at on public.commerce_accounts;
create trigger commerce_accounts_touch_updated_at before update on public.commerce_accounts
for each row execute function public.touch_updated_at();

drop trigger if exists commerce_memberships_touch_updated_at on public.commerce_memberships;
create trigger commerce_memberships_touch_updated_at before update on public.commerce_memberships
for each row execute function public.touch_updated_at();

drop trigger if exists branches_touch_updated_at on public.branches;
create trigger branches_touch_updated_at before update on public.branches
for each row execute function public.touch_updated_at();

drop trigger if exists registers_touch_updated_at on public.registers;
create trigger registers_touch_updated_at before update on public.registers
for each row execute function public.touch_updated_at();

drop trigger if exists customers_touch_updated_at on public.customers;
create trigger customers_touch_updated_at before update on public.customers
for each row execute function public.touch_updated_at();

drop trigger if exists suppliers_touch_updated_at on public.suppliers;
create trigger suppliers_touch_updated_at before update on public.suppliers
for each row execute function public.touch_updated_at();

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at before update on public.products
for each row execute function public.touch_updated_at();

drop trigger if exists product_branch_stock_touch_updated_at on public.product_branch_stock;
create trigger product_branch_stock_touch_updated_at before update on public.product_branch_stock
for each row execute function public.touch_updated_at();

drop trigger if exists sales_touch_updated_at on public.sales;
create trigger sales_touch_updated_at before update on public.sales
for each row execute function public.touch_updated_at();

drop trigger if exists purchase_receipts_touch_updated_at on public.purchase_receipts;
create trigger purchase_receipts_touch_updated_at before update on public.purchase_receipts
for each row execute function public.touch_updated_at();

drop trigger if exists documents_touch_updated_at on public.documents;
create trigger documents_touch_updated_at before update on public.documents
for each row execute function public.touch_updated_at();

create index if not exists idx_control_users_active_commerce_id on public.control_users(active_commerce_id);
create index if not exists idx_commerce_memberships_user_id on public.commerce_memberships(user_id);
create index if not exists idx_commerce_memberships_commerce_id on public.commerce_memberships(commerce_id);
create index if not exists idx_branches_commerce_id on public.branches(commerce_id);
create index if not exists idx_registers_branch_id on public.registers(branch_id);
create index if not exists idx_customers_commerce_id on public.customers(commerce_id);
create index if not exists idx_suppliers_commerce_id on public.suppliers(commerce_id);
create index if not exists idx_products_commerce_id on public.products(commerce_id);
create index if not exists idx_product_branch_stock_branch_id on public.product_branch_stock(branch_id);
create index if not exists idx_sales_branch_id on public.sales(branch_id);
create index if not exists idx_sales_customer_id on public.sales(customer_id);
create index if not exists idx_sale_items_sale_id on public.sale_items(sale_id);
create index if not exists idx_documents_sale_id on public.documents(sale_id);
create index if not exists idx_documents_branch_id on public.documents(branch_id);
create index if not exists idx_cash_sessions_register_id on public.cash_sessions(register_id);
create index if not exists idx_cash_movements_cash_session_id on public.cash_movements(cash_session_id);
create index if not exists idx_stock_movements_product_id on public.stock_movements(product_id);

create or replace function public.app_user_has_commerce_access(p_commerce_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.commerce_memberships membership
    where membership.user_id = (select auth.uid())
      and membership.commerce_id = p_commerce_id
      and membership.status = 'active'
  );
$$;

create or replace function public.app_user_is_commerce_admin(p_commerce_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.commerce_memberships membership
    where membership.user_id = (select auth.uid())
      and membership.commerce_id = p_commerce_id
      and membership.status = 'active'
      and membership.role_key in ('owner', 'admin')
  );
$$;

create or replace function public.app_user_can_access_branch(p_commerce_id uuid, p_branch_id uuid)
returns boolean
language sql
stable
as $$
  select
    (select public.app_user_is_commerce_admin(p_commerce_id))
    or exists (
      select 1
      from public.control_users cu
      join public.commerce_memberships membership
        on membership.user_id = cu.id
       and membership.commerce_id = p_commerce_id
       and membership.status = 'active'
      where cu.id = (select auth.uid())
        and (
          p_branch_id is null
          or cu.active_branch_id is null
          or cu.active_branch_id = p_branch_id
        )
    );
$$;

create or replace function public.current_commerce_context()
returns table (
  commerce_id uuid,
  commerce_name text,
  owner_email text,
  active_plan text,
  user_id uuid,
  user_email text,
  full_name text,
  role_key text,
  membership_status text,
  is_owner boolean,
  active_branch_id uuid,
  assigned_register_id uuid
)
language sql
stable
as $$
  select
    commerce.id,
    commerce.name,
    commerce.owner_email,
    commerce.active_plan,
    user_row.id,
    user_row.email,
    user_row.full_name,
    membership.role_key,
    membership.status,
    membership.is_owner,
    user_row.active_branch_id,
    user_row.assigned_register_id
  from public.control_users user_row
  join public.commerce_memberships membership
    on membership.user_id = user_row.id
   and membership.commerce_id = user_row.active_commerce_id
  join public.commerce_accounts commerce
    on commerce.id = membership.commerce_id
  where user_row.id = (select auth.uid());
$$;

create or replace function public.bootstrap_control_user(
  p_full_name text default null,
  p_commerce_name text default null
)
returns public.control_users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_name text := nullif(trim(coalesce(p_full_name, '')), '');
  v_bootstrap_owner_email constant text := '';
  v_user public.control_users;
  v_commerce public.commerce_accounts;
  v_membership public.commerce_memberships;
  v_slug text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if v_email = '' then
    raise exception 'missing_email';
  end if;

  if v_name is null then
    v_name := split_part(v_email, '@', 1);
  end if;

  insert into public.control_users (
    id,
    email,
    full_name,
    role_key,
    status,
    is_owner
  )
  values (
    v_uid,
    v_email,
    v_name,
    'cashier',
    'pending',
    false
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = case
      when public.control_users.full_name is null or public.control_users.full_name = '' then excluded.full_name
      else public.control_users.full_name
    end
  returning * into v_user;

  select *
  into v_commerce
  from public.commerce_accounts
  order by created_at asc
  limit 1;

  if v_commerce.id is null and v_bootstrap_owner_email <> '' and v_email = v_bootstrap_owner_email then
    v_slug := regexp_replace(lower(coalesce(nullif(trim(coalesce(p_commerce_name, '')), ''), 'operando-control')), '[^a-z0-9]+', '-', 'g');
    v_slug := trim(both '-' from v_slug);
    if v_slug = '' then
      v_slug := 'operando-control';
    end if;

    insert into public.commerce_accounts (
      name,
      slug,
      legal_name,
      owner_email,
      active_plan,
      settings_json
    )
    values (
      coalesce(nullif(trim(coalesce(p_commerce_name, '')), ''), 'operando.app'),
      v_slug,
      coalesce(nullif(trim(coalesce(p_commerce_name, '')), ''), 'operando.app'),
      v_email,
      'full',
      jsonb_build_object('created_from', 'bootstrap')
    )
    returning * into v_commerce;
  end if;

  if v_commerce.id is not null then
    insert into public.commerce_memberships (
      commerce_id,
      user_id,
      role_key,
      status,
      is_owner
    )
    values (
      v_commerce.id,
      v_uid,
      case when lower(v_commerce.owner_email) = v_email then 'owner' else 'cashier' end,
      case when lower(v_commerce.owner_email) = v_email then 'active' else 'pending' end,
      lower(v_commerce.owner_email) = v_email
    )
    on conflict (commerce_id, user_id) do update
    set
      role_key = case
        when public.commerce_memberships.is_owner then public.commerce_memberships.role_key
        when lower(v_commerce.owner_email) = v_email then 'owner'
        else public.commerce_memberships.role_key
      end,
      status = case
        when public.commerce_memberships.is_owner then public.commerce_memberships.status
        when lower(v_commerce.owner_email) = v_email then 'active'
        else public.commerce_memberships.status
      end,
      is_owner = public.commerce_memberships.is_owner or lower(v_commerce.owner_email) = v_email
    returning * into v_membership;

    update public.control_users
    set
      active_commerce_id = coalesce(public.control_users.active_commerce_id, v_commerce.id),
      role_key = case
        when v_membership.role_key in ('owner', 'admin') then 'admin'
        when v_membership.role_key = 'warehouse' then 'warehouse'
        else 'cashier'
      end,
      status = v_membership.status,
      is_owner = v_membership.is_owner
    where id = v_uid
    returning * into v_user;
  end if;

  return v_user;
end;
$$;

create or replace function public.upsert_commerce_profile(
  p_name text,
  p_owner_email text,
  p_legal_name text default null,
  p_active_plan text default null
)
returns public.commerce_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_commerce_id uuid;
  v_row public.commerce_accounts;
begin
  select cu.active_commerce_id
  into v_commerce_id
  from public.control_users cu
  where cu.id = v_user_id;

  if v_commerce_id is null then
    raise exception 'missing_active_commerce';
  end if;

  if not public.app_user_is_commerce_admin(v_commerce_id) then
    raise exception 'forbidden';
  end if;

  update public.commerce_accounts
  set
    name = coalesce(nullif(trim(p_name), ''), name),
    owner_email = lower(coalesce(nullif(trim(p_owner_email), ''), owner_email)),
    legal_name = coalesce(nullif(trim(coalesce(p_legal_name, '')), ''), legal_name),
    active_plan = coalesce(nullif(trim(coalesce(p_active_plan, '')), ''), active_plan)
  where id = v_commerce_id
  returning * into v_row;

  if lower(v_row.owner_email) = lower(coalesce((select email from public.control_users where id = v_user_id), '')) then
    update public.commerce_memberships
    set role_key = 'owner', status = 'active', is_owner = true
    where commerce_id = v_commerce_id and user_id = v_user_id;

    update public.control_users
    set is_owner = true, role_key = 'admin', status = 'active'
    where id = v_user_id;
  end if;

  return v_row;
end;
$$;

create or replace function public.import_snapshot_to_core(p_instance_key text default 'operando-dev')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snapshot jsonb;
  v_business jsonb;
  v_commerce_id uuid;
  v_owner_id uuid;
  v_branch jsonb;
  v_register jsonb;
  v_customer jsonb;
  v_supplier jsonb;
  v_product jsonb;
  v_sale jsonb;
  v_sale_item jsonb;
  v_invoice jsonb;
  v_ticket jsonb;
  v_receipt jsonb;
  v_cash_session jsonb;
  v_cash_movement jsonb;
  v_stock_movement jsonb;
  v_audit jsonb;
  v_branch_id uuid;
  v_register_id uuid;
  v_sale_id uuid;
begin
  select state_json into v_snapshot
  from public.app_snapshots
  where instance_key = p_instance_key;

  if v_snapshot is null then
    raise exception 'snapshot_not_found';
  end if;

  v_business := coalesce(v_snapshot -> 'business', '{}'::jsonb);

  select cu.id, cu.active_commerce_id
  into v_owner_id, v_commerce_id
  from public.control_users cu
  where cu.id = (select auth.uid());

  if v_commerce_id is null then
    perform public.bootstrap_control_user(
      coalesce((select full_name from public.control_users where id = (select auth.uid())), 'Administrador'),
      coalesce(v_business ->> 'name', 'operando.app')
    );

    select cu.id, cu.active_commerce_id
    into v_owner_id, v_commerce_id
    from public.control_users cu
    where cu.id = (select auth.uid());
  end if;

  if v_commerce_id is null then
    raise exception 'missing_commerce_context';
  end if;

  update public.commerce_accounts
  set
    name = coalesce(nullif(v_business ->> 'name', ''), name),
    legal_name = coalesce(nullif(v_business ->> 'organization', ''), legal_name),
    active_plan = coalesce(nullif(v_business ->> 'activePlan', ''), active_plan),
    settings_json = coalesce(settings_json, '{}'::jsonb) || jsonb_build_object('imported_from_snapshot', p_instance_key, 'enabledModules', coalesce(v_business -> 'enabledModules', '[]'::jsonb))
  where id = v_commerce_id;

  for v_branch in
    select value from jsonb_array_elements(coalesce(v_snapshot -> 'branches', '[]'::jsonb))
  loop
    insert into public.branches (id, commerce_id, code, name, address, is_active)
    values (
      coalesce(public.app_try_uuid(v_branch ->> 'id'), gen_random_uuid()),
      v_commerce_id,
      coalesce(nullif(v_branch ->> 'code', ''), 'SUC'),
      coalesce(nullif(v_branch ->> 'name', ''), 'Sucursal'),
      coalesce(v_branch ->> 'address', ''),
      coalesce((v_branch ->> 'isActive')::boolean, true)
    )
    on conflict (id) do update
    set
      code = excluded.code,
      name = excluded.name,
      address = excluded.address,
      is_active = excluded.is_active;
  end loop;

  for v_customer in
    select value from jsonb_array_elements(coalesce(v_snapshot -> 'customers', '[]'::jsonb))
  loop
    insert into public.customers (id, commerce_id, full_name, phone, email, balance, tag, is_active)
    values (
      coalesce(public.app_try_uuid(v_customer ->> 'id'), gen_random_uuid()),
      v_commerce_id,
      coalesce(nullif(v_customer ->> 'fullName', ''), 'Cliente'),
      coalesce(v_customer ->> 'phone', ''),
      coalesce(v_customer ->> 'email', ''),
      coalesce((v_customer ->> 'balance')::numeric, 0),
      coalesce(v_customer ->> 'tag', ''),
      true
    )
    on conflict (id) do update
    set
      full_name = excluded.full_name,
      phone = excluded.phone,
      email = excluded.email,
      balance = excluded.balance,
      tag = excluded.tag;
  end loop;

  for v_supplier in
    select value from jsonb_array_elements(coalesce(v_snapshot -> 'suppliers', '[]'::jsonb))
  loop
    insert into public.suppliers (id, commerce_id, name, contact, phone, email, category, balance, last_delivery, is_active)
    values (
      coalesce(public.app_try_uuid(v_supplier ->> 'id'), gen_random_uuid()),
      v_commerce_id,
      coalesce(nullif(v_supplier ->> 'name', ''), 'Proveedor'),
      coalesce(v_supplier ->> 'contact', ''),
      coalesce(v_supplier ->> 'phone', ''),
      coalesce(v_supplier ->> 'email', ''),
      coalesce(v_supplier ->> 'category', ''),
      coalesce((v_supplier ->> 'balance')::numeric, 0),
      nullif(v_supplier ->> 'lastDelivery', '')::date,
      true
    )
    on conflict (id) do update
    set
      name = excluded.name,
      contact = excluded.contact,
      phone = excluded.phone,
      email = excluded.email,
      category = excluded.category,
      balance = excluded.balance;

  end loop;

  for v_product in
    select value from jsonb_array_elements(coalesce(v_snapshot -> 'products', '[]'::jsonb))
  loop
    insert into public.products (id, commerce_id, sku, barcode, name, category, sale_price, cost_price, min_stock, track_stock, is_active)
    values (
      coalesce(public.app_try_uuid(v_product ->> 'id'), gen_random_uuid()),
      v_commerce_id,
      coalesce(nullif(v_product ->> 'sku', ''), concat('SKU-', substring(gen_random_uuid()::text, 1, 8))),
      coalesce(v_product ->> 'barcode', ''),
      coalesce(nullif(v_product ->> 'name', ''), 'Producto'),
      coalesce(v_product ->> 'category', ''),
      coalesce((v_product ->> 'salePrice')::numeric, 0),
      coalesce((v_product ->> 'costPrice')::numeric, 0),
      coalesce((v_product ->> 'minStock')::numeric, 0),
      coalesce((v_product ->> 'trackStock')::boolean, true),
      true
    )
    on conflict (id) do update
    set
      sku = excluded.sku,
      barcode = excluded.barcode,
      name = excluded.name,
      category = excluded.category,
      sale_price = excluded.sale_price,
      cost_price = excluded.cost_price,
      min_stock = excluded.min_stock,
      track_stock = excluded.track_stock;
  end loop;

  for v_branch in
    select value from jsonb_array_elements(coalesce(v_snapshot -> 'branches', '[]'::jsonb))
  loop
    v_branch_id := coalesce(public.app_try_uuid(v_branch ->> 'id'), gen_random_uuid());

    for v_product in
      select value from jsonb_array_elements(coalesce(v_snapshot -> 'products', '[]'::jsonb))
    loop
      insert into public.product_branch_stock (commerce_id, product_id, branch_id, quantity)
      values (
        v_commerce_id,
        coalesce(public.app_try_uuid(v_product ->> 'id'), gen_random_uuid()),
        v_branch_id,
        coalesce(((v_product -> 'stockByBranch') ->> (v_branch ->> 'id'))::numeric, 0)
      )
      on conflict (product_id, branch_id) do update
      set quantity = excluded.quantity;
    end loop;
  end loop;

  if not exists (select 1 from public.product_branch_stock where commerce_id = v_commerce_id) then
    update public.control_users
    set active_branch_id = (
      select id from public.branches
      where commerce_id = v_commerce_id
      order by created_at asc
      limit 1
    )
    where id = v_owner_id;
  end if;

  for v_register in
    select value from jsonb_array_elements(coalesce(v_snapshot -> 'registers', '[]'::jsonb))
  loop
    insert into public.registers (id, commerce_id, branch_id, code, name, is_active)
    values (
      coalesce(public.app_try_uuid(v_register ->> 'id'), gen_random_uuid()),
      v_commerce_id,
      coalesce(public.app_try_uuid(v_register ->> 'branchId'), (select id from public.branches where commerce_id = v_commerce_id order by created_at asc limit 1)),
      coalesce(nullif(v_register ->> 'code', ''), 'CAJA'),
      coalesce(nullif(v_register ->> 'name', ''), 'Caja'),
      coalesce((v_register ->> 'isActive')::boolean, true)
    )
    on conflict (id) do update
    set
      branch_id = excluded.branch_id,
      code = excluded.code,
      name = excluded.name,
      is_active = excluded.is_active;
  end loop;

  for v_cash_session in
    select value from jsonb_array_elements(coalesce(v_snapshot -> 'cashSessions', '[]'::jsonb))
  loop
    insert into public.cash_sessions (
      id, commerce_id, branch_id, register_id, opened_by, closed_by, opening_amount, counted_amount, expected_amount, difference_amount, status, opened_at, closed_at
    )
    values (
      coalesce(public.app_try_uuid(v_cash_session ->> 'id'), gen_random_uuid()),
      v_commerce_id,
      coalesce(public.app_try_uuid(v_cash_session ->> 'branchId'), (select id from public.branches where commerce_id = v_commerce_id order by created_at asc limit 1)),
      public.app_try_uuid(v_cash_session ->> 'registerId'),
      v_owner_id,
      v_owner_id,
      coalesce((v_cash_session ->> 'openingAmount')::numeric, 0),
      nullif(v_cash_session ->> 'countedAmount', '')::numeric,
      nullif(v_cash_session ->> 'expectedAmount', '')::numeric,
      nullif(v_cash_session ->> 'differenceAmount', '')::numeric,
      coalesce(nullif(v_cash_session ->> 'status', ''), 'open'),
      coalesce(nullif(v_cash_session ->> 'openedAt', '')::timestamptz, now()),
      nullif(v_cash_session ->> 'closedAt', '')::timestamptz
    )
    on conflict (id) do update
    set
      branch_id = excluded.branch_id,
      register_id = excluded.register_id,
      opening_amount = excluded.opening_amount,
      counted_amount = excluded.counted_amount,
      expected_amount = excluded.expected_amount,
      difference_amount = excluded.difference_amount,
      status = excluded.status,
      opened_at = excluded.opened_at,
      closed_at = excluded.closed_at;
  end loop;

  for v_cash_movement in
    select value from jsonb_array_elements(coalesce(v_snapshot -> 'cashMovements', '[]'::jsonb))
  loop
    insert into public.cash_movements (
      id, commerce_id, branch_id, register_id, cash_session_id, created_by, kind, amount, signed_amount, note, created_at
    )
    values (
      coalesce(public.app_try_uuid(v_cash_movement ->> 'id'), gen_random_uuid()),
      v_commerce_id,
      coalesce(public.app_try_uuid(v_cash_movement ->> 'branchId'), (select id from public.branches where commerce_id = v_commerce_id order by created_at asc limit 1)),
      public.app_try_uuid(v_cash_movement ->> 'registerId'),
      public.app_try_uuid(v_cash_movement ->> 'cashSessionId'),
      v_owner_id,
      coalesce(nullif(v_cash_movement ->> 'kind', ''), 'adjustment'),
      coalesce((v_cash_movement ->> 'amount')::numeric, 0),
      coalesce((v_cash_movement ->> 'signedAmount')::numeric, 0),
      coalesce(v_cash_movement ->> 'note', ''),
      coalesce(nullif(v_cash_movement ->> 'createdAt', '')::timestamptz, now())
    )
    on conflict (id) do nothing;
  end loop;

  for v_sale in
    select value from jsonb_array_elements(coalesce(v_snapshot -> 'sales', '[]'::jsonb))
  loop
    v_sale_id := coalesce(public.app_try_uuid(v_sale ->> 'id'), gen_random_uuid());

    insert into public.sales (
      id, commerce_id, branch_id, register_id, seller_user_id, customer_id, cash_session_id, channel, payment_method, status,
      subtotal_amount, discount_amount, total_amount, amount_paid, total_quantity, note, sold_at
    )
    values (
      v_sale_id,
      v_commerce_id,
      coalesce(public.app_try_uuid(v_sale ->> 'branchId'), (select id from public.branches where commerce_id = v_commerce_id order by created_at asc limit 1)),
      public.app_try_uuid(v_sale ->> 'registerId'),
      v_owner_id,
      public.app_try_uuid(v_sale ->> 'customerId'),
      public.app_try_uuid(v_sale ->> 'cashSessionId'),
      coalesce(nullif(v_sale ->> 'channel', ''), 'mostrador'),
      coalesce(nullif(v_sale ->> 'paymentMethod', ''), 'cash'),
      coalesce(nullif(v_sale ->> 'status', ''), 'pending'),
      coalesce((v_sale ->> 'subtotalAmount')::numeric, (v_sale ->> 'totalAmount')::numeric, 0),
      coalesce((v_sale ->> 'discountAmount')::numeric, 0),
      coalesce((v_sale ->> 'totalAmount')::numeric, 0),
      coalesce((v_sale ->> 'amountPaid')::numeric, 0),
      coalesce((v_sale ->> 'totalQuantity')::numeric, 0),
      coalesce(v_sale ->> 'note', ''),
      coalesce(nullif(v_sale ->> 'soldAt', '')::timestamptz, now())
    )
    on conflict (id) do update
    set
      branch_id = excluded.branch_id,
      register_id = excluded.register_id,
      customer_id = excluded.customer_id,
      channel = excluded.channel,
      payment_method = excluded.payment_method,
      status = excluded.status,
      subtotal_amount = excluded.subtotal_amount,
      discount_amount = excluded.discount_amount,
      total_amount = excluded.total_amount,
      amount_paid = excluded.amount_paid,
      total_quantity = excluded.total_quantity,
      note = excluded.note,
      sold_at = excluded.sold_at;

    delete from public.sale_items where sale_id = v_sale_id;
    delete from public.sale_payments where sale_id = v_sale_id;

    for v_sale_item in
      select value from jsonb_array_elements(coalesce(v_sale -> 'items', '[]'::jsonb))
    loop
      insert into public.sale_items (commerce_id, sale_id, product_id, quantity, unit_price, line_total)
      values (
        v_commerce_id,
        v_sale_id,
        coalesce(public.app_try_uuid(v_sale_item ->> 'productId'), (select id from public.products where commerce_id = v_commerce_id order by created_at asc limit 1)),
        coalesce((v_sale_item ->> 'quantity')::numeric, 0),
        coalesce((v_sale_item ->> 'unitPrice')::numeric, 0),
        coalesce((v_sale_item ->> 'lineTotal')::numeric, 0)
      );
    end loop;

    insert into public.sale_payments (commerce_id, sale_id, method_key, amount)
    select v_commerce_id, v_sale_id, payment.key, coalesce((payment.value)::text::numeric, 0)
    from jsonb_each(coalesce(v_sale -> 'paymentBreakdown', '{}'::jsonb)) as payment
    where coalesce((payment.value)::text::numeric, 0) <> 0;
  end loop;

  for v_receipt in
    select value from jsonb_array_elements(coalesce(v_snapshot -> 'purchaseReceipts', '[]'::jsonb))
  loop
    insert into public.purchase_receipts (
      id, commerce_id, branch_id, supplier_id, product_id, received_by, document_number, quantity, unit_cost, total_cost, note, received_at
    )
    values (
      coalesce(public.app_try_uuid(v_receipt ->> 'id'), gen_random_uuid()),
      v_commerce_id,
      coalesce(public.app_try_uuid(v_receipt ->> 'branchId'), (select id from public.branches where commerce_id = v_commerce_id order by created_at asc limit 1)),
      coalesce(public.app_try_uuid(v_receipt ->> 'supplierId'), (select id from public.suppliers where commerce_id = v_commerce_id order by created_at asc limit 1)),
      coalesce(public.app_try_uuid(v_receipt ->> 'productId'), (select id from public.products where commerce_id = v_commerce_id order by created_at asc limit 1)),
      v_owner_id,
      coalesce(v_receipt ->> 'documentNumber', ''),
      coalesce((v_receipt ->> 'quantity')::numeric, 0),
      coalesce((v_receipt ->> 'unitCost')::numeric, 0),
      coalesce((v_receipt ->> 'totalCost')::numeric, 0),
      coalesce(v_receipt ->> 'note', ''),
      coalesce(nullif(v_receipt ->> 'receivedAt', '')::timestamptz, now())
    )
    on conflict (id) do nothing;
  end loop;

  for v_invoice in
    select value from jsonb_array_elements(coalesce(v_snapshot -> 'invoices', '[]'::jsonb))
  loop
    insert into public.documents (
      id, commerce_id, branch_id, sale_id, customer_id, document_number, kind, fiscal_type, status, fiscal_status, total_amount, issued_at, payload_json
    )
    values (
      coalesce(public.app_try_uuid(v_invoice ->> 'id'), gen_random_uuid()),
      v_commerce_id,
      coalesce(public.app_try_uuid(v_invoice ->> 'branchId'), (select id from public.branches where commerce_id = v_commerce_id order by created_at asc limit 1)),
      public.app_try_uuid(v_invoice ->> 'saleId'),
      public.app_try_uuid(v_invoice ->> 'customerId'),
      coalesce(nullif(v_invoice ->> 'number', ''), concat('DOC-', substring(gen_random_uuid()::text, 1, 8))),
      case lower(coalesce(v_invoice ->> 'kind', 'factura'))
        when 'nota de credito' then 'nota_credito'
        when 'presupuesto' then 'presupuesto'
        when 'remito' then 'remito'
        else 'factura'
      end,
      coalesce(nullif(v_invoice ->> 'type', ''), 'B'),
      lower(coalesce(v_invoice ->> 'status', 'emitida')),
      lower(coalesce(v_invoice ->> 'fiscalStatus', 'pendiente')),
      coalesce((v_invoice ->> 'totalAmount')::numeric, 0),
      coalesce(nullif(v_invoice ->> 'dueDate', '')::timestamptz, now()),
      v_invoice
    )
    on conflict (id) do update
    set
      document_number = excluded.document_number,
      kind = excluded.kind,
      fiscal_type = excluded.fiscal_type,
      status = excluded.status,
      fiscal_status = excluded.fiscal_status,
      total_amount = excluded.total_amount,
      payload_json = excluded.payload_json;
  end loop;

  for v_ticket in
    select value from jsonb_array_elements(coalesce(v_snapshot -> 'tickets', '[]'::jsonb))
  loop
    insert into public.documents (
      id, commerce_id, branch_id, sale_id, customer_id, document_number, kind, fiscal_type, status, fiscal_status, total_amount, issued_at, payload_json
    )
    values (
      coalesce(public.app_try_uuid(v_ticket ->> 'id'), gen_random_uuid()),
      v_commerce_id,
      coalesce(public.app_try_uuid(v_ticket ->> 'branchId'), (select id from public.branches where commerce_id = v_commerce_id order by created_at asc limit 1)),
      public.app_try_uuid(v_ticket ->> 'saleId'),
      public.app_try_uuid(v_ticket ->> 'customerId'),
      coalesce(nullif(v_ticket ->> 'number', ''), concat('TCK-', substring(gen_random_uuid()::text, 1, 8))),
      'postventa',
      'B',
      lower(coalesce(v_ticket ->> 'status', 'emitida')),
      'interno',
      0,
      coalesce(nullif(v_ticket ->> 'updatedAt', '')::timestamptz, now()),
      v_ticket
    )
    on conflict (id) do update
    set
      document_number = excluded.document_number,
      status = excluded.status,
      payload_json = excluded.payload_json;
  end loop;

  for v_stock_movement in
    select value from jsonb_array_elements(coalesce(v_snapshot -> 'stockMovements', '[]'::jsonb))
  loop
    insert into public.stock_movements (
      id, commerce_id, branch_id, product_id, reference_id, reference_type, movement_type, quantity, notes, created_by, created_at
    )
    values (
      coalesce(public.app_try_uuid(v_stock_movement ->> 'id'), gen_random_uuid()),
      v_commerce_id,
      public.app_try_uuid(v_stock_movement ->> 'branchId'),
      coalesce(public.app_try_uuid(v_stock_movement ->> 'productId'), (select id from public.products where commerce_id = v_commerce_id order by created_at asc limit 1)),
      public.app_try_uuid(v_stock_movement ->> 'referenceId'),
      coalesce(v_stock_movement ->> 'type', 'adjustment'),
      coalesce(v_stock_movement ->> 'type', 'adjustment'),
      coalesce((v_stock_movement ->> 'quantity')::numeric, 0),
      coalesce(v_stock_movement ->> 'notes', ''),
      v_owner_id,
      coalesce(nullif(v_stock_movement ->> 'createdAt', '')::timestamptz, now())
    )
    on conflict (id) do nothing;
  end loop;

  for v_audit in
    select value from jsonb_array_elements(coalesce(v_snapshot -> 'auditLogs', '[]'::jsonb))
  loop
    insert into public.audit_logs_core (
      id, commerce_id, actor_user_id, entity_type, entity_id, action, before_data, after_data, created_at
    )
    values (
      coalesce(public.app_try_uuid(v_audit ->> 'id'), gen_random_uuid()),
      v_commerce_id,
      v_owner_id,
      coalesce(v_audit ->> 'entityType', 'system'),
      public.app_try_uuid(v_audit ->> 'entityId'),
      coalesce(v_audit ->> 'action', 'imported'),
      v_audit -> 'beforeData',
      v_audit -> 'afterData',
      coalesce(nullif(v_audit ->> 'createdAt', '')::timestamptz, now())
    )
    on conflict (id) do nothing;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'commerce_id', v_commerce_id,
    'imported_at', now(),
    'instance_key', p_instance_key
  );
end;
$$;

revoke all on function public.bootstrap_control_user(text, text) from public;
grant execute on function public.bootstrap_control_user(text, text) to authenticated;

revoke all on function public.upsert_commerce_profile(text, text, text, text) from public;
grant execute on function public.upsert_commerce_profile(text, text, text, text) to authenticated;

revoke all on function public.import_snapshot_to_core(text) from public;
grant execute on function public.import_snapshot_to_core(text) to authenticated;

revoke all on function public.current_commerce_context() from public;
grant execute on function public.current_commerce_context() to authenticated;

grant usage on schema public to authenticated;

grant select, update on public.control_users to authenticated;
grant select on public.commerce_memberships to authenticated;
grant select, update on public.commerce_accounts to authenticated;
grant select, insert, update, delete on public.branches to authenticated;
grant select, insert, update, delete on public.registers to authenticated;
grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.suppliers to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.product_branch_stock to authenticated;
grant select, insert, update, delete on public.cash_sessions to authenticated;
grant select, insert, update, delete on public.cash_movements to authenticated;
grant select, insert, update, delete on public.sales to authenticated;
grant select, insert, update, delete on public.sale_items to authenticated;
grant select, insert, update, delete on public.sale_payments to authenticated;
grant select, insert, update, delete on public.purchase_receipts to authenticated;
grant select, insert, update, delete on public.documents to authenticated;
grant select, insert, update, delete on public.stock_movements to authenticated;
grant select, insert on public.audit_logs_core to authenticated;

alter table public.control_users enable row level security;
alter table public.commerce_accounts enable row level security;
alter table public.commerce_memberships enable row level security;
alter table public.branches enable row level security;
alter table public.registers enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.product_branch_stock enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.cash_movements enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.sale_payments enable row level security;
alter table public.purchase_receipts enable row level security;
alter table public.documents enable row level security;
alter table public.stock_movements enable row level security;
alter table public.audit_logs_core enable row level security;

drop policy if exists control_users_select on public.control_users;
create policy control_users_select
on public.control_users
for select
to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1
    from public.commerce_memberships self_membership
    join public.commerce_memberships peer_membership
      on peer_membership.commerce_id = self_membership.commerce_id
     and peer_membership.user_id = public.control_users.id
    where self_membership.user_id = (select auth.uid())
      and self_membership.status = 'active'
      and peer_membership.status in ('pending', 'active', 'disabled')
  )
);

drop policy if exists control_users_update on public.control_users;
create policy control_users_update
on public.control_users
for update
to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1
    from public.commerce_memberships self_membership
    join public.commerce_memberships peer_membership
      on peer_membership.commerce_id = self_membership.commerce_id
     and peer_membership.user_id = public.control_users.id
    where self_membership.user_id = (select auth.uid())
      and self_membership.status = 'active'
      and self_membership.role_key in ('owner', 'admin')
  )
)
with check (
  id = (select auth.uid())
  or exists (
    select 1
    from public.commerce_memberships self_membership
    join public.commerce_memberships peer_membership
      on peer_membership.commerce_id = self_membership.commerce_id
     and peer_membership.user_id = public.control_users.id
    where self_membership.user_id = (select auth.uid())
      and self_membership.status = 'active'
      and self_membership.role_key in ('owner', 'admin')
  )
);

drop policy if exists commerce_accounts_select on public.commerce_accounts;
create policy commerce_accounts_select
on public.commerce_accounts
for select
to authenticated
using ((select public.app_user_has_commerce_access(id)));

drop policy if exists commerce_accounts_update on public.commerce_accounts;
create policy commerce_accounts_update
on public.commerce_accounts
for update
to authenticated
using ((select public.app_user_is_commerce_admin(id)))
with check ((select public.app_user_is_commerce_admin(id)));

drop policy if exists commerce_memberships_select on public.commerce_memberships;
create policy commerce_memberships_select
on public.commerce_memberships
for select
to authenticated
using ((select public.app_user_has_commerce_access(commerce_id)));

drop policy if exists commerce_memberships_update on public.commerce_memberships;
create policy commerce_memberships_update
on public.commerce_memberships
for update
to authenticated
using ((select public.app_user_is_commerce_admin(commerce_id)))
with check ((select public.app_user_is_commerce_admin(commerce_id)));

drop policy if exists branches_access on public.branches;
create policy branches_access
on public.branches
for all
to authenticated
using ((select public.app_user_can_access_branch(commerce_id, id)))
with check ((select public.app_user_can_access_branch(commerce_id, id)));

drop policy if exists registers_access on public.registers;
create policy registers_access
on public.registers
for all
to authenticated
using ((select public.app_user_can_access_branch(commerce_id, branch_id)))
with check ((select public.app_user_can_access_branch(commerce_id, branch_id)));

drop policy if exists customers_access on public.customers;
create policy customers_access
on public.customers
for all
to authenticated
using ((select public.app_user_has_commerce_access(commerce_id)))
with check ((select public.app_user_has_commerce_access(commerce_id)));

drop policy if exists suppliers_access on public.suppliers;
create policy suppliers_access
on public.suppliers
for all
to authenticated
using ((select public.app_user_has_commerce_access(commerce_id)))
with check ((select public.app_user_has_commerce_access(commerce_id)));

drop policy if exists products_access on public.products;
create policy products_access
on public.products
for all
to authenticated
using ((select public.app_user_has_commerce_access(commerce_id)))
with check ((select public.app_user_has_commerce_access(commerce_id)));

drop policy if exists product_branch_stock_access on public.product_branch_stock;
create policy product_branch_stock_access
on public.product_branch_stock
for all
to authenticated
using ((select public.app_user_can_access_branch(commerce_id, branch_id)))
with check ((select public.app_user_can_access_branch(commerce_id, branch_id)));

drop policy if exists cash_sessions_access on public.cash_sessions;
create policy cash_sessions_access
on public.cash_sessions
for all
to authenticated
using ((select public.app_user_can_access_branch(commerce_id, branch_id)))
with check ((select public.app_user_can_access_branch(commerce_id, branch_id)));

drop policy if exists cash_movements_access on public.cash_movements;
create policy cash_movements_access
on public.cash_movements
for all
to authenticated
using ((select public.app_user_can_access_branch(commerce_id, branch_id)))
with check ((select public.app_user_can_access_branch(commerce_id, branch_id)));

drop policy if exists sales_access on public.sales;
create policy sales_access
on public.sales
for all
to authenticated
using ((select public.app_user_can_access_branch(commerce_id, branch_id)))
with check ((select public.app_user_can_access_branch(commerce_id, branch_id)));

drop policy if exists sale_items_access on public.sale_items;
create policy sale_items_access
on public.sale_items
for all
to authenticated
using (
  exists (
    select 1
    from public.sales sale_row
    where sale_row.id = sale_items.sale_id
      and (select public.app_user_can_access_branch(sale_row.commerce_id, sale_row.branch_id))
  )
)
with check (
  exists (
    select 1
    from public.sales sale_row
    where sale_row.id = sale_items.sale_id
      and (select public.app_user_can_access_branch(sale_row.commerce_id, sale_row.branch_id))
  )
);

drop policy if exists sale_payments_access on public.sale_payments;
create policy sale_payments_access
on public.sale_payments
for all
to authenticated
using (
  exists (
    select 1
    from public.sales sale_row
    where sale_row.id = sale_payments.sale_id
      and (select public.app_user_can_access_branch(sale_row.commerce_id, sale_row.branch_id))
  )
)
with check (
  exists (
    select 1
    from public.sales sale_row
    where sale_row.id = sale_payments.sale_id
      and (select public.app_user_can_access_branch(sale_row.commerce_id, sale_row.branch_id))
  )
);

drop policy if exists purchase_receipts_access on public.purchase_receipts;
create policy purchase_receipts_access
on public.purchase_receipts
for all
to authenticated
using ((select public.app_user_can_access_branch(commerce_id, branch_id)))
with check ((select public.app_user_can_access_branch(commerce_id, branch_id)));

drop policy if exists documents_access on public.documents;
create policy documents_access
on public.documents
for all
to authenticated
using ((select public.app_user_can_access_branch(commerce_id, branch_id)))
with check ((select public.app_user_can_access_branch(commerce_id, branch_id)));

drop policy if exists stock_movements_access on public.stock_movements;
create policy stock_movements_access
on public.stock_movements
for all
to authenticated
using ((select public.app_user_can_access_branch(commerce_id, branch_id)))
with check ((select public.app_user_can_access_branch(commerce_id, branch_id)));

drop policy if exists audit_logs_core_select on public.audit_logs_core;
create policy audit_logs_core_select
on public.audit_logs_core
for select
to authenticated
using ((select public.app_user_has_commerce_access(commerce_id)));

drop policy if exists audit_logs_core_insert on public.audit_logs_core;
create policy audit_logs_core_insert
on public.audit_logs_core
for insert
to authenticated
with check ((select public.app_user_has_commerce_access(commerce_id)));
