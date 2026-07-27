-- Pagos a proveedores: una recepción genera saldo; los pagos lo reducen.
create table if not exists public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null references public.commerce_accounts(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete cascade,
  created_by uuid references public.control_users(id) on delete set null,
  method_key text not null check (method_key in ('cash', 'transfer', 'cheque', 'echeq', 'mercado_pago', 'other')),
  amount numeric(14,2) not null check (amount > 0),
  reference text not null default '',
  created_at timestamptz not null default now()
);
alter table public.supplier_payments enable row level security;
create index if not exists idx_supplier_payments_supplier on public.supplier_payments(supplier_id, created_at desc);

create or replace function public.app_sync_supplier_balance_from_receipt()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.suppliers set balance = balance + new.total_cost, last_delivery = current_date, updated_at = now()
    where id = new.supplier_id and commerce_id = new.commerce_id;
  elsif tg_op = 'DELETE' then
    update public.suppliers set balance = greatest(0, balance - old.total_cost), updated_at = now()
    where id = old.supplier_id and commerce_id = old.commerce_id;
  elsif old.supplier_id = new.supplier_id then
    update public.suppliers set balance = greatest(0, balance - old.total_cost + new.total_cost), last_delivery = current_date, updated_at = now()
    where id = new.supplier_id and commerce_id = new.commerce_id;
  else
    update public.suppliers set balance = greatest(0, balance - old.total_cost), updated_at = now()
    where id = old.supplier_id and commerce_id = old.commerce_id;
    update public.suppliers set balance = balance + new.total_cost, last_delivery = current_date, updated_at = now()
    where id = new.supplier_id and commerce_id = new.commerce_id;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists purchase_receipts_sync_supplier_balance on public.purchase_receipts;
create trigger purchase_receipts_sync_supplier_balance
after insert or update or delete on public.purchase_receipts
for each row execute function public.app_sync_supplier_balance_from_receipt();

create or replace function public.app_public_register_supplier_payment(
  p_session_token text,
  p_supplier_id text,
  p_method_key text,
  p_amount numeric,
  p_reference text default null,
  p_branch_id text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ctx record; v_supplier public.suppliers; v_payment public.supplier_payments;
  v_branch_id uuid := public.app_try_uuid(p_branch_id);
  v_amount numeric := greatest(coalesce(p_amount, 0), 0);
  v_method text := lower(trim(coalesce(p_method_key, '')));
  v_session public.cash_sessions;
begin
  select * into v_ctx from public.app_public_session_context(p_session_token);
  if coalesce(v_ctx.session_role_key, 'cashier') not in ('owner', 'admin', 'cashier', 'warehouse') then raise exception 'permission_denied'; end if;
  if v_method not in ('cash', 'transfer', 'cheque', 'echeq', 'mercado_pago', 'other') then raise exception 'invalid_payment_method'; end if;
  select * into v_supplier from public.suppliers where id = public.app_try_uuid(p_supplier_id) and commerce_id = v_ctx.session_commerce_id for update;
  if v_supplier.id is null then raise exception 'supplier_not_found'; end if;
  if v_amount <= 0 or v_amount > v_supplier.balance then raise exception 'invalid_payment_amount'; end if;
  select id into v_branch_id from public.branches where id = coalesce(v_branch_id, (select id from public.branches where commerce_id = v_ctx.session_commerce_id order by created_at limit 1)) and commerce_id = v_ctx.session_commerce_id;
  if v_branch_id is null then raise exception 'branch_not_found'; end if;
  if v_method = 'cash' then
    select * into v_session from public.cash_sessions where commerce_id = v_ctx.session_commerce_id and branch_id = v_branch_id and status = 'open' order by opened_at desc limit 1;
    if v_session.id is null then raise exception 'cash_session_required'; end if;
    insert into public.cash_movements (commerce_id, branch_id, register_id, cash_session_id, created_by, kind, amount, signed_amount, note)
    values (v_ctx.session_commerce_id, v_branch_id, v_session.register_id, v_session.id, v_ctx.session_user_id, 'expense', v_amount, -v_amount, 'Pago a proveedor ' || v_supplier.name || case when trim(coalesce(p_reference, '')) <> '' then ' · ' || trim(p_reference) else '' end);
  end if;
  insert into public.supplier_payments (commerce_id, supplier_id, branch_id, created_by, method_key, amount, reference)
  values (v_ctx.session_commerce_id, v_supplier.id, v_branch_id, v_ctx.session_user_id, v_method, v_amount, trim(coalesce(p_reference, '')))
  returning * into v_payment;
  update public.suppliers set balance = greatest(0, balance - v_amount), updated_at = now() where id = v_supplier.id;
  return jsonb_build_object('id', v_payment.id, 'supplierId', v_payment.supplier_id, 'amount', v_payment.amount, 'method', v_payment.method_key, 'reference', v_payment.reference);
end;
$$;

revoke all on function public.app_public_register_supplier_payment(text, text, text, numeric, text, text) from public;
grant execute on function public.app_public_register_supplier_payment(text, text, text, numeric, text, text) to anon, authenticated;
