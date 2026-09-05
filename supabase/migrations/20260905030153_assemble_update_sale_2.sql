-- assemble update_sale SQL part 2
update private._p0_sql_assemble
set body = body || $p0$lements(coalesce(p_items, '[]'::jsonb))
loop
select * into v_product
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
insert into public.sale_items (commerce_id, sale_id, product_id, quantity, unit_price, line_total)
values (v_ctx.session_commerce_id, v_sale.id, v_product.id, v_item_quantity, v_unit_price, v_line_total);
if coalesce(v_product.track_stock, true) then
update public.product_branch_stock
set quantity = quantity - v_item_quantity, updated_at = now()
where commerce_id = v_ctx.session_commerce_id
and product_id = v_product.id
and branch_id = v_branch_id;
insert into public.stock_movements (
commerce_id, branch_id, product_id, reference_id, reference_type,
movement_type, quantity, notes, created_by
) values (
v_ctx.session_commerce_id, v_branch_id, v_product.id, v_sale.id, 'sale',
'sale', v_item_quantity * -1,
'Venta ' || initcap(lower(trim(coalesce(p_channel, 'mostrador')))),
v_ctx.session_user_id
);
end if;
end loop;
if v_cash_amount > 0 then
insert into public.sale_payments (commerce_id, sale_id, method_key, amount)
values (v_ctx.session_commerce_id, v_sale.id, 'cash', v_cash_amount);
insert into public.cash_movements (
commerce_id, branch_id, register_id, cash_session_id, created_by,
kind, amount, signed_amount, note
) values (
v_ctx.session_commerce_id, v_branch_id, v_register_id, v_cash_session.id,
v_ctx.session_user_id, 'sale', v_cash_amount, abs(v_cash_amount), 'Cobro de venta'
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
if v_echeq_amount > 0 then
insert into public.sale_payments (commerce_id, sale_id, method_key, amount, metadata)
values (v_ctx.session_commerce_id, v_sale.id, 'echeq', v_echeq_amount, coalesce(p_echeq_details, '{}'::jsonb));
end if;
if v_account_amount > 0 then
insert into public.sale_payments (commerce_id, sale_id, method_key, amount)
values (v_ctx.session_commerce_id, v_sale.id, 'account', v_account_amount);
end if;
v_balance_due := greatest(v_total - v_amount_paid, 0);
if v_customer_id is not null and v_balance_due > 0 then
update public.customers
set balance = coalesce(balance, 0) + v_balance_due, updated_at = now()
where id = v_customer_id and commerce_id = v_ctx.session_commerce_id;
end if;
if coalesce(p_auto_invoice, false) and v_customer_id is not null and v_amount_paid > 0
and not exists (
select 1 from public.documents
where commerce_id = v_ctx.session_commerce_id and sale_id = v_sale.id and kind = 'factura'
)
then
v_document_id := gen_random_uuid();
v_document_number := 'FAC-' || coalesce(v_branch_code, 'SUC') || '-' || to_char(now(), 'YYYYMMDDHH24MISSMS');
insert into public.documents (
id, commerce_id, branch_id, sale_id, customer_id, document_number,
kind, fiscal_type, status, fiscal_status, total_amount, payload_json
) values (
v_document_id, v_ctx.session_commerce_id, v_branch_id, v_sale.id, v_customer_id,
v_document_number, 'factura', 'B',
case when v_amount_paid >= v_total then 'Cobrada' else 'Emitida' end,
'Pendiente', v_total, jsonb_build_object('generatedFrom', 'sale', 'saleId', v_sale.id)
);
end if;
v_result := jsonb_build_object(
'sale_id', v_sale.id,
'invoice_id', v_document_id,
'invoice_number', v_document_number,
'status', v_sale.status,
'total_amount', v_sale.total_amount,
'amount_paid', v_sale.amount_paid
);
return private.app_mutation_store_result(
v_ctx.session_commerce_id, 'update_sale', v_operation_id, v_sale.id, v_result
);
end;
$$;
revoke all on function public.app_public_update_sale(text, text, text, text, text, numeric, text, boolean, boolean, numeric, numeric, numeric, numeric, jsonb, numeric, jsonb, text, text, text) from public;
grant execute on function public.app_public_update_sale(text, text, text, text, text, numeric, text, boolean, boolean, numeric, numeric, numeric, numeric, jsonb, numeric, jsonb, text, text, text) to anon, authenticated;
$p0$
where k = 'update_sale';
