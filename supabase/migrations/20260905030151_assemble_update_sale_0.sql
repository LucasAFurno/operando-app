-- assemble update_sale SQL part 0/2
create table if not exists private._p0_sql_assemble (
  k text primary key,
  body text not null default ''
);
revoke all on table private._p0_sql_assemble from public, anon, authenticated;
insert into private._p0_sql_assemble(k, body) values ('update_sale', $p0$create or replace function public.app_public_update_sale(
p_session_token text,
p_sale_id text,
p_customer_id text default null,
p_channel text default 'Mostrador',
p_payment_method text default 'cash',
p_discount_amount numeric default 0,
p_note text default null,
p_is_paid boolean default false,
p_auto_invoice boolean default false,
p_cash_amount numeric default 0,
p_transfer_amount numeric default 0,
p_mercado_pago_amount numeric default 0,
p_echeq_amount numeric default 0,
p_echeq_details jsonb default '{}'::jsonb,
p_account_amount numeric default 0,
p_items jsonb default '[]'::jsonb,
p_branch_id text default null,
p_register_id text default null,
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
v_old_balance_due numeric := 0;
v_old_cash numeric := 0;
v_branch_id uuid;
v_register_id uuid;
v_customer_id uuid := public.app_try_uuid(p_customer_id);
v_cash_session public.cash_sessions;
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
v_echeq_amount numeric := greatest(coalesce(p_echeq_amount, 0), 0);
v_account_amount numeric := greatest(coalesce(p_account_amount, 0), 0);
v_total_quantity numeric := 0;
v_sale_status text;
v_balance_due numeric := 0;
v_document_id uuid := null;
v_document_number text := null;
v_branch_code text := 'SUC';
v_payment_method text := lower(trim(coalesce(p_payment_method, 'cash')));
v_result jsonb;
begin
select * into v_ctx from public.app_public_session_context(p_session_token);
if coalesce(v_ctx.session_role_key, 'cashier') not in ('owner', 'admin', 'cashier') then
raise exception 'permission_denied';
end if;
v_replay := private.app_mutation_replay_or_lock(v_ctx.session_commerce_id, 'update_sale', v_operation_id);
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
if v_sale.status in ('cancelled', 'returned') then
raise exception 'sale_not_editable';
end if;
if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
raise exception 'sale_items_required';
end if;
if v_echeq_amount > 0 and v_payment_method = 'mixed' then
raise exception 'echeq_mixed_not_supported';
end if;
if v_payment_method = 'echeq' and trim(coalesce(p_echeq_details ->> 'number', '')) = '' then
raise exception 'echeq_number_required';
end if;
v_old_balance_due := greatest(coalesce(v_sale.total_amount, 0) - coalesce(v_sale.amount_paid, 0), 0);
select coalesce(sum(amount), 0) into v_old_cash
from public.sale_payments
where sale_id = v_sale.id and method_key = 'cash';
perform private.app_restore_sale_stock(
v_ctx.session_commerce_id, v_sale, v_ctx.session_user_id,
'Reverso por edicion de venta', 'return'
);
if v_sale.customer_id is not null and v_old_balance_due > 0 then
update public.customers
set balance = greatest(0, coalesce(balance, 0) - v_old_balance_due), updated_at = now()
where id = v_sale.customer_id and commerce_id = v_ctx.session_commerce_id;
end if;
if v_old_cash > 0 and v_sale.cash_session_id is not null
and exists (select 1 from public.cash_sessions where id = v_sale.cash_session_id and status = 'open')
then
insert into public.cash_movements (
commerce_id, branch_id, register_id, cash_session_id, created_by,
kind, amount, signed_amount, note
) values (
v_ctx.session_commerce_id, v_sale.branch_id, v_sale.register_id, v_sale.cash_session_id,
v_ctx.session_user_id, 'refund', v_old_cash, -abs(v_old_cash), 'Reverso por edicion de venta'
);
end if;
delete from public.sale_items where sale_id = v_sale.id and commerce_id = v_ctx.session_commerce_id;
delete from public.sale_payments where sale_id = v_sale.id and commerce_id = v_ctx.session_commer$p0$)
on conflict (k) do update set body = excluded.body;
