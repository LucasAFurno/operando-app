-- assemble update_sale SQL part 1
update private._p0_sql_assemble
set body = body || $p0$ce_id;
v_branch_id := coalesce(
public.app_try_uuid(p_branch_id),
v_sale.branch_id,
(select active_branch_id from public.control_users where id = v_ctx.session_user_id),
(select id from public.branches where commerce_id = v_ctx.session_commerce_id order by created_at asc limit 1)
);
if v_branch_id is null or not exists (
select 1 from public.branches where id = v_branch_id and commerce_id = v_ctx.session_commerce_id
) then
raise exception 'branch_not_found';
end if;
select code into v_branch_code from public.branches where id = v_branch_id;
v_register_id := coalesce(
public.app_try_uuid(p_register_id),
v_sale.register_id,
(select assigned_register_id from public.control_users where id = v_ctx.session_user_id),
(select id from public.registers where commerce_id = v_ctx.session_commerce_id and branch_id = v_branch_id order by created_at asc limit 1)
);
if v_customer_id is not null and not exists (
select 1 from public.customers where id = v_customer_id and commerce_id = v_ctx.session_commerce_id
) then
raise exception 'customer_not_in_commerce';
end if;
for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
loop
select * into v_product
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
select coalesce(quantity, 0) into v_available
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
if v_payment_method = 'mixed' then
v_raw_paid := v_cash_amount + v_transfer_amount + v_mp_amount + v_echeq_amount + v_account_amount;
elsif v_payment_method = 'cash' then
v_cash_amount := case when coalesce(p_is_paid, false) then v_total else v_cash_amount end;
v_raw_paid := v_cash_amount;
elsif v_payment_method = 'transfer' then
v_transfer_amount := case when coalesce(p_is_paid, false) then v_total else v_transfer_amount end;
v_raw_paid := v_transfer_amount;
elsif v_payment_method = 'mercado_pago' then
v_mp_amount := case when coalesce(p_is_paid, false) then v_total else v_mp_amount end;
v_raw_paid := v_mp_amount;
elsif v_payment_method = 'echeq' then
v_echeq_amount := case when coalesce(p_is_paid, false) then v_total else v_echeq_amount end;
v_raw_paid := v_echeq_amount;
elsif v_payment_method = 'account' then
v_account_amount := v_total;
v_raw_paid := v_cash_amount + v_transfer_amount + v_mp_amount + v_echeq_amount;
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
select * into v_cash_session
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
update public.sales
set
branch_id = v_branch_id,
register_id = v_register_id,
customer_id = v_customer_id,
cash_session_id = case when v_cash_amount > 0 then v_cash_session.id else null end,
channel = lower(trim(coalesce(p_channel, 'mostrador'))),
payment_method = v_payment_method,
status = v_sale_status,
subtotal_amount = v_subtotal,
discount_amount = v_discount,
total_amount = v_total,
amount_paid = v_amount_paid,
total_quantity = v_total_quantity,
note = trim(coalesce(p_note, '')),
updated_at = now()
where id = v_sale.id
returning * into v_sale;
for v_item in select value from jsonb_array_e$p0$
where k = 'update_sale';
