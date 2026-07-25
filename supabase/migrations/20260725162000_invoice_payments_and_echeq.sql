-- Abonos de comprobantes y e-cheq. Las tablas existentes siguen protegidas por
-- las RPCs con session context; no se otorga acceso directo a tablas nuevas.
alter table public.documents add column if not exists amount_paid numeric(14,2) not null default 0;
alter table public.sale_payments add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.sale_payments drop constraint if exists sale_payments_method_key_check;
alter table public.sale_payments add constraint sale_payments_method_key_check check (method_key in ('cash', 'transfer', 'mercado_pago', 'echeq', 'account'));

update public.documents document
set amount_paid = least(document.total_amount, sale.amount_paid)
from public.sales sale
where document.sale_id = sale.id and document.amount_paid = 0;

create table if not exists public.document_payments (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null references public.commerce_accounts(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete set null,
  method_key text not null check (method_key in ('cash', 'transfer', 'mercado_pago', 'echeq')),
  amount numeric(14,2) not null check (amount > 0),
  reference text not null default '',
  echeq_details jsonb not null default '{}'::jsonb,
  created_by uuid references public.control_users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.document_payments enable row level security;

create or replace function public.app_public_get_invoice_payment_summaries(p_session_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_ctx record;
begin
  select * into v_ctx from public.app_public_session_context(p_session_token);
  return coalesce((select jsonb_agg(jsonb_build_object('invoiceId', id, 'amountPaid', amount_paid, 'paymentHistory', coalesce((select jsonb_agg(jsonb_build_object('id', payment.id, 'amount', payment.amount, 'method', payment.method_key, 'reference', payment.reference, 'echeqDetails', payment.echeq_details, 'recordedAt', payment.created_at) order by payment.created_at desc) from public.document_payments payment where payment.document_id = document.id), '[]'::jsonb))) from public.documents document where commerce_id = v_ctx.session_commerce_id), '[]'::jsonb);
end;
$$;

create or replace function public.app_public_register_invoice_payment(
  p_session_token text, p_invoice_id text, p_method_key text, p_amount numeric,
  p_reference text default null, p_echeq_details jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ctx record; v_document public.documents; v_sale public.sales; v_amount numeric := greatest(coalesce(p_amount, 0), 0);
  v_due numeric; v_method text := lower(trim(coalesce(p_method_key, ''))); v_session public.cash_sessions;
begin
  select * into v_ctx from public.app_public_session_context(p_session_token);
  if coalesce(v_ctx.session_role_key, 'cashier') not in ('owner', 'admin', 'cashier') then raise exception 'permission_denied'; end if;
  select * into v_document from public.documents where id = public.app_try_uuid(p_invoice_id) and commerce_id = v_ctx.session_commerce_id for update;
  if v_document.id is null then raise exception 'invoice_not_found'; end if;
  if v_method not in ('cash', 'transfer', 'mercado_pago', 'echeq') then raise exception 'invalid_payment_method'; end if;
  if v_method = 'echeq' and trim(coalesce(p_echeq_details ->> 'number', '')) = '' then raise exception 'echeq_number_required'; end if;
  v_due := greatest(v_document.total_amount - v_document.amount_paid, 0);
  if v_amount <= 0 or v_amount > v_due then raise exception 'invalid_payment_amount'; end if;
  if v_method = 'cash' then
    select * into v_session from public.cash_sessions where commerce_id = v_ctx.session_commerce_id and branch_id = v_document.branch_id and status = 'open' order by opened_at desc limit 1;
    if v_session.id is null then raise exception 'cash_session_required'; end if;
    insert into public.cash_movements (commerce_id, branch_id, register_id, cash_session_id, created_by, kind, amount, signed_amount, note) values (v_ctx.session_commerce_id, v_document.branch_id, v_session.register_id, v_session.id, v_ctx.session_user_id, 'sale', v_amount, v_amount, 'Abono ' || v_document.document_number || case when trim(coalesce(p_reference, '')) <> '' then ' · ' || trim(p_reference) else '' end);
  end if;
  insert into public.document_payments (commerce_id, document_id, sale_id, method_key, amount, reference, echeq_details, created_by) values (v_ctx.session_commerce_id, v_document.id, v_document.sale_id, v_method, v_amount, trim(coalesce(p_reference, '')), coalesce(p_echeq_details, '{}'::jsonb), v_ctx.session_user_id);
  update public.documents set amount_paid = amount_paid + v_amount, status = case when amount_paid + v_amount >= total_amount then 'Cobrada' else 'Emitida' end, updated_at = now() where id = v_document.id returning * into v_document;
  if v_document.sale_id is not null then
    select * into v_sale from public.sales where id = v_document.sale_id for update;
    update public.sales set amount_paid = least(total_amount, amount_paid + v_amount), status = case when amount_paid + v_amount >= total_amount then 'completed' else 'partial' end, updated_at = now() where id = v_sale.id;
    insert into public.sale_payments (commerce_id, sale_id, method_key, amount, metadata) values (v_ctx.session_commerce_id, v_sale.id, v_method, v_amount, case when v_method = 'echeq' then coalesce(p_echeq_details, '{}'::jsonb) else '{}'::jsonb end);
  end if;
  if v_document.customer_id is not null then update public.customers set balance = greatest(0, balance - v_amount), updated_at = now() where id = v_document.customer_id and commerce_id = v_ctx.session_commerce_id; end if;
  return jsonb_build_object('invoiceId', v_document.id, 'amountPaid', v_document.amount_paid, 'status', v_document.status);
end;
$$;

-- El RPC vigente no conocía e-cheq. Esta sobrecarga lo traduce a un cobro válido
-- y lo reclasifica luego, preservando toda la validación de venta existente.
create or replace function public.app_public_create_sale(
  p_session_token text, p_customer_id text, p_channel text, p_payment_method text, p_discount_amount numeric, p_note text,
  p_is_paid boolean, p_auto_invoice boolean, p_cash_amount numeric, p_transfer_amount numeric, p_mercado_pago_amount numeric,
  p_echeq_amount numeric, p_echeq_details jsonb, p_account_amount numeric, p_items jsonb, p_branch_id text, p_register_id text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_result jsonb; v_sale_id uuid; v_echeq numeric := greatest(coalesce(p_echeq_amount, 0), 0);
begin
  if v_echeq > 0 and lower(coalesce(p_payment_method, '')) = 'mixed' then raise exception 'echeq_mixed_not_supported'; end if;
  if lower(coalesce(p_payment_method, '')) = 'echeq' and trim(coalesce(p_echeq_details ->> 'number', '')) = '' then raise exception 'echeq_number_required'; end if;
  v_result := public.app_public_create_sale(p_session_token, p_customer_id, p_channel, case when lower(coalesce(p_payment_method, '')) = 'echeq' then 'mercado_pago' else p_payment_method end, p_discount_amount, p_note, p_is_paid, p_auto_invoice, p_cash_amount, p_transfer_amount, case when lower(coalesce(p_payment_method, '')) = 'echeq' then v_echeq else p_mercado_pago_amount end, p_account_amount, p_items, p_branch_id, p_register_id);
  if lower(coalesce(p_payment_method, '')) = 'echeq' then
    v_sale_id := (v_result ->> 'sale_id')::uuid;
    update public.sales set payment_method = 'echeq', updated_at = now() where id = v_sale_id;
    update public.sale_payments set method_key = 'echeq', metadata = coalesce(p_echeq_details, '{}'::jsonb) where sale_id = v_sale_id and method_key = 'mercado_pago';
  end if;
  return v_result;
end;
$$;

revoke all on function public.app_public_get_invoice_payment_summaries(text) from public;
revoke all on function public.app_public_register_invoice_payment(text, text, text, numeric, text, jsonb) from public;
revoke all on function public.app_public_create_sale(text, text, text, text, numeric, text, boolean, boolean, numeric, numeric, numeric, numeric, jsonb, numeric, jsonb, text, text) from public;
grant execute on function public.app_public_get_invoice_payment_summaries(text) to anon, authenticated;
grant execute on function public.app_public_register_invoice_payment(text, text, text, numeric, text, jsonb) to anon, authenticated;
grant execute on function public.app_public_create_sale(text, text, text, text, numeric, text, boolean, boolean, numeric, numeric, numeric, numeric, jsonb, numeric, jsonb, text, text) to anon, authenticated;
