-- Enforce commerce_memberships.blocked_permissions (+ allowed_modules) on write RPCs.
-- El panel ya oculta acciones; los SECURITY DEFINER solo miraban role_key.

create or replace function private.app_assert_membership_permission(
  p_commerce_id uuid,
  p_user_id uuid,
  p_is_owner boolean,
  p_permission text,
  p_module text default null
)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_blocked jsonb := '[]'::jsonb;
  v_allowed jsonb := '[]'::jsonb;
begin
  if coalesce(p_is_owner, false) then
    return;
  end if;

  select coalesce(m.blocked_permissions, '[]'::jsonb),
         coalesce(m.allowed_modules, '[]'::jsonb)
    into v_blocked, v_allowed
  from public.commerce_memberships m
  where m.commerce_id = p_commerce_id
    and m.user_id = p_user_id
    and m.status = 'active'
  order by m.is_owner desc, m.updated_at desc
  limit 1;

  if not found then
    raise exception 'membership_not_found';
  end if;

  if p_permission is not null
     and exists (
       select 1
       from jsonb_array_elements_text(coalesce(v_blocked, '[]'::jsonb)) as perm(value)
       where perm.value = p_permission
     ) then
    raise exception 'permission_denied';
  end if;

  if p_module is not null
     and jsonb_typeof(coalesce(v_allowed, '[]'::jsonb)) = 'array'
     and jsonb_array_length(v_allowed) > 0
     and not exists (
       select 1
       from jsonb_array_elements_text(v_allowed) as mod(value)
       where mod.value = p_module
     ) then
    raise exception 'permission_denied';
  end if;
end;
$$;

revoke all on function private.app_assert_membership_permission(uuid, uuid, boolean, text, text)
  from public, anon, authenticated;

-- harden fn_app_public_cancel_sale.sql (sales:write / sales)
create or replace function public.app_public_cancel_sale(
  p_session_token text,
  p_sale_id text,
  p_reason text default 'Anulacion manual',
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
  v_balance_due numeric := 0;
  v_cash_paid numeric := 0;
  v_reason text := trim(coalesce(nullif(p_reason, ''), 'Anulacion manual'));
  v_result jsonb;
begin
  select * into v_ctx from public.app_public_session_context(p_session_token);
  perform private.app_assert_membership_permission(
    v_ctx.session_commerce_id,
    v_ctx.session_user_id,
    v_ctx.session_is_owner,
    'sales:write',
    'sales'
  );

  if coalesce(v_ctx.session_role_key, 'cashier') not in ('owner', 'admin', 'cashier') then
    raise exception 'permission_denied';
  end if;

  v_replay := private.app_mutation_replay_or_lock(v_ctx.session_commerce_id, 'cancel_sale', v_operation_id);
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

  if v_sale.status = 'cancelled' then
    raise exception 'sale_already_cancelled';
  end if;

  if v_sale.status = 'returned' then
    raise exception 'sale_already_returned';
  end if;

  v_balance_due := greatest(coalesce(v_sale.total_amount, 0) - coalesce(v_sale.amount_paid, 0), 0);

  select coalesce(sum(amount), 0) into v_cash_paid
  from public.sale_payments
  where sale_id = v_sale.id
    and method_key = 'cash';

  perform private.app_restore_sale_stock(
    v_ctx.session_commerce_id,
    v_sale,
    v_ctx.session_user_id,
    'Anulacion de venta: ' || v_reason,
    'return'
  );

  if v_sale.customer_id is not null and v_balance_due > 0 then
    update public.customers
    set balance = greatest(0, coalesce(balance, 0) - v_balance_due), updated_at = now()
    where id = v_sale.customer_id
      and commerce_id = v_ctx.session_commerce_id;
  end if;

  if v_cash_paid > 0 and v_sale.cash_session_id is not null
     and exists (
       select 1 from public.cash_sessions
       where id = v_sale.cash_session_id
         and commerce_id = v_ctx.session_commerce_id
         and status = 'open'
     )
  then
    insert into public.cash_movements (
      commerce_id, branch_id, register_id, cash_session_id, created_by,
      kind, amount, signed_amount, note
    ) values (
      v_ctx.session_commerce_id, v_sale.branch_id, v_sale.register_id, v_sale.cash_session_id,
      v_ctx.session_user_id, 'refund', v_cash_paid, -abs(v_cash_paid),
      'Reverso por anulacion de venta'
    );
  end if;

  delete from public.sale_payments where sale_id = v_sale.id and commerce_id = v_ctx.session_commerce_id;

  update public.sales
  set
    status = 'cancelled',
    amount_paid = 0,
    note = case
      when nullif(trim(coalesce(note, '')), '') is null then 'Anulada: ' || v_reason
      else trim(note) || ' | Anulada: ' || v_reason
    end,
    updated_at = now()
  where id = v_sale.id
  returning * into v_sale;

  update public.documents
  set status = 'Anulada', fiscal_status = 'Anulado', updated_at = now()
  where commerce_id = v_ctx.session_commerce_id
    and sale_id = v_sale.id
    and kind in ('factura', 'ticket', 'presupuesto', 'remito');

  v_result := jsonb_build_object(
    'sale_id', v_sale.id,
    'status', v_sale.status,
    'reason', v_reason
  );

  return private.app_mutation_store_result(
    v_ctx.session_commerce_id, 'cancel_sale', v_operation_id, v_sale.id, v_result
  );
end;
$$;

-- harden fn_app_public_return_sale.sql (sales:write / sales)
create or replace function public.app_public_return_sale(
  p_session_token text,
  p_sale_id text,
  p_reason text default 'Devolucion total',
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
  v_reason text := trim(coalesce(nullif(p_reason, ''), 'Devolucion total'));
  v_document_id uuid := gen_random_uuid();
  v_document_number text;
  v_branch_code text := 'SUC';
  v_related_document_id uuid;
  v_result jsonb;
begin
  select * into v_ctx from public.app_public_session_context(p_session_token);
  perform private.app_assert_membership_permission(
    v_ctx.session_commerce_id,
    v_ctx.session_user_id,
    v_ctx.session_is_owner,
    'sales:write',
    'sales'
  );

  if coalesce(v_ctx.session_role_key, 'cashier') not in ('owner', 'admin', 'cashier') then
    raise exception 'permission_denied';
  end if;

  v_replay := private.app_mutation_replay_or_lock(v_ctx.session_commerce_id, 'return_sale', v_operation_id);
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

  if v_sale.status = 'returned' then
    raise exception 'sale_already_returned';
  end if;

  if v_sale.status = 'cancelled' then
    raise exception 'sale_already_cancelled';
  end if;

  perform private.app_restore_sale_stock(
    v_ctx.session_commerce_id,
    v_sale,
    v_ctx.session_user_id,
    'Devolucion de venta: ' || v_reason,
    'return'
  );

  if v_sale.customer_id is not null then
    update public.customers
    set balance = greatest(0, coalesce(balance, 0) - coalesce(v_sale.total_amount, 0)), updated_at = now()
    where id = v_sale.customer_id
      and commerce_id = v_ctx.session_commerce_id;
  end if;

  select code into v_branch_code from public.branches where id = v_sale.branch_id;
  v_document_number := 'NC-' || coalesce(v_branch_code, 'SUC') || '-' || to_char(now(), 'YYYYMMDDHH24MISSMS');

  select id into v_related_document_id
  from public.documents
  where commerce_id = v_ctx.session_commerce_id
    and sale_id = v_sale.id
    and kind = 'factura'
  order by issued_at desc
  limit 1;

  insert into public.documents (
    id, commerce_id, branch_id, sale_id, customer_id, related_document_id,
    document_number, kind, fiscal_type, status, fiscal_status, total_amount, payload_json
  ) values (
    v_document_id,
    v_ctx.session_commerce_id,
    v_sale.branch_id,
    v_sale.id,
    v_sale.customer_id,
    v_related_document_id,
    v_document_number,
    'nota_credito',
    'B',
    'Emitida',
    'Pendiente',
    coalesce(v_sale.total_amount, 0),
    jsonb_build_object('generatedFrom', 'return', 'saleId', v_sale.id, 'reason', v_reason)
  );

  update public.sales
  set
    status = 'returned',
    note = case
      when nullif(trim(coalesce(note, '')), '') is null then 'Devuelta: ' || v_reason
      else trim(note) || ' | Devuelta: ' || v_reason
    end,
    updated_at = now()
  where id = v_sale.id
  returning * into v_sale;

  v_result := jsonb_build_object(
    'sale_id', v_sale.id,
    'status', v_sale.status,
    'credit_note_id', v_document_id,
    'credit_note_number', v_document_number,
    'reason', v_reason
  );

  return private.app_mutation_store_result(
    v_ctx.session_commerce_id, 'return_sale', v_operation_id, v_sale.id, v_result
  );
end;
$$;

-- harden fn_app_public_update_sale.sql (sales:write / sales)
create or replace function public.app_public_update_sale(
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
perform private.app_assert_membership_permission(v_ctx.session_commerce_id, v_ctx.session_user_id, v_ctx.session_is_owner, 'sales:write', 'sales');
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
delete from public.sale_payments where sale_id = v_sale.id and commerce_id = v_ctx.session_commerce_id;
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
for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
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

-- harden fn_app_public_create_stock_adjustment.sql (products:adjust / products)
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
  perform private.app_assert_membership_permission(
    v_ctx.session_commerce_id,
    v_ctx.session_user_id,
    v_ctx.session_is_owner,
    'products:adjust',
    'products'
  );

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

-- harden fn_app_public_transfer_stock.sql (products:transfer / products)
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
  perform private.app_assert_membership_permission(
    v_ctx.session_commerce_id,
    v_ctx.session_user_id,
    v_ctx.session_is_owner,
    'products:transfer',
    'products'
  );

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

-- harden fn_app_public_create_sale.sql (sales:write / sales)
create or replace function public.app_public_create_sale(
  p_session_token text,
  p_customer_id text,
  p_channel text,
  p_payment_method text,
  p_discount_amount numeric,
  p_note text,
  p_is_paid boolean,
  p_auto_invoice boolean,
  p_cash_amount numeric,
  p_transfer_amount numeric,
  p_mercado_pago_amount numeric,
  p_echeq_amount numeric,
  p_echeq_details jsonb,
  p_account_amount numeric,
  p_items jsonb,
  p_branch_id text,
  p_register_id text,
  p_operation_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
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
$$;

-- harden remove_entity per entity permission
create or replace function public.app_public_remove_entity(
  p_session_token text,
  p_entity_type text,
  p_entity_id text,
  p_operation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_ctx record;
  v_entity text := lower(trim(coalesce(p_entity_type, '')));
  v_entity_id uuid := public.app_try_uuid(p_entity_id);
  v_operation_id uuid := public.app_try_uuid(p_operation_id);
  v_replay jsonb;
  v_sale public.sales;
  v_receipt public.purchase_receipts;
  v_role text;
  v_result jsonb;
begin
  select * into v_ctx from public.app_public_session_context(p_session_token);
  v_role := coalesce(v_ctx.session_role_key, 'cashier');

  v_replay := private.app_mutation_replay_or_lock(
    v_ctx.session_commerce_id, 'remove_entity', v_operation_id
  );
  if v_replay is not null then
    return v_replay;
  end if;

  if v_entity_id is null then
    raise exception 'entity_not_found';
  end if;

  if v_entity = 'register' then
    raise exception 'use_upsert_register_for_deactivate';
  end if;

  -- Soft-deactivate: keep existing role gates
  if v_entity = 'customer' then
    if v_role not in ('owner', 'admin', 'cashier') then raise exception 'permission_denied'; end if;
    perform private.app_assert_membership_permission(v_ctx.session_commerce_id, v_ctx.session_user_id, v_ctx.session_is_owner, 'customers:write', 'customers');
    update public.customers
    set is_active = false, updated_at = now()
    where id = v_entity_id and commerce_id = v_ctx.session_commerce_id;
    if not found then raise exception 'entity_not_found'; end if;
    v_result := jsonb_build_object('entity', v_entity, 'id', v_entity_id, 'mode', 'deactivated');
    return private.app_mutation_store_result(
      v_ctx.session_commerce_id, 'remove_entity', v_operation_id, v_entity_id, v_result
    );
  end if;

  if v_entity = 'product' then
    if v_role not in ('owner', 'admin', 'warehouse') then raise exception 'permission_denied'; end if;
    perform private.app_assert_membership_permission(v_ctx.session_commerce_id, v_ctx.session_user_id, v_ctx.session_is_owner, 'products:write', 'products');
    update public.products
    set is_active = false, updated_at = now()
    where id = v_entity_id and commerce_id = v_ctx.session_commerce_id;
    if not found then raise exception 'entity_not_found'; end if;
    v_result := jsonb_build_object('entity', v_entity, 'id', v_entity_id, 'mode', 'deactivated');
    return private.app_mutation_store_result(
      v_ctx.session_commerce_id, 'remove_entity', v_operation_id, v_entity_id, v_result
    );
  end if;

  if v_entity = 'supplier' then
    if v_role not in ('owner', 'admin', 'warehouse') then raise exception 'permission_denied'; end if;
    perform private.app_assert_membership_permission(v_ctx.session_commerce_id, v_ctx.session_user_id, v_ctx.session_is_owner, 'purchases:write', 'purchases');
    update public.suppliers
    set is_active = false, updated_at = now()
    where id = v_entity_id and commerce_id = v_ctx.session_commerce_id;
    if not found then raise exception 'entity_not_found'; end if;
    v_result := jsonb_build_object('entity', v_entity, 'id', v_entity_id, 'mode', 'deactivated');
    return private.app_mutation_store_result(
      v_ctx.session_commerce_id, 'remove_entity', v_operation_id, v_entity_id, v_result
    );
  end if;

  if v_entity = 'branch' then
    if v_role not in ('owner', 'admin') then raise exception 'permission_denied'; end if;
    perform private.app_assert_membership_permission(v_ctx.session_commerce_id, v_ctx.session_user_id, v_ctx.session_is_owner, 'branches:manage', 'branches');
    update public.branches
    set is_active = false, updated_at = now()
    where id = v_entity_id and commerce_id = v_ctx.session_commerce_id;
    if not found then raise exception 'entity_not_found'; end if;
    v_result := jsonb_build_object('entity', v_entity, 'id', v_entity_id, 'mode', 'deactivated');
    return private.app_mutation_store_result(
      v_ctx.session_commerce_id, 'remove_entity', v_operation_id, v_entity_id, v_result
    );
  end if;

  -- Hard-delete financial/ledger entities: owner/admin only
  if v_entity in ('invoice', 'ticket') then
    if v_role not in ('owner', 'admin') then
      raise exception 'permission_denied';
    end if;
    if v_entity = 'invoice' then
      perform private.app_assert_membership_permission(v_ctx.session_commerce_id, v_ctx.session_user_id, v_ctx.session_is_owner, 'invoices:write', 'invoices');
    else
      perform private.app_assert_membership_permission(v_ctx.session_commerce_id, v_ctx.session_user_id, v_ctx.session_is_owner, 'tickets:write', 'tickets');
    end if;
    delete from public.documents
    where id = v_entity_id
      and commerce_id = v_ctx.session_commerce_id
      and (
        (v_entity = 'invoice' and kind in ('factura', 'presupuesto', 'remito', 'nota_credito'))
        or (v_entity = 'ticket' and kind in ('ticket', 'postventa'))
      );
    if not found then raise exception 'entity_not_found'; end if;
    v_result := jsonb_build_object('entity', v_entity, 'id', v_entity_id, 'mode', 'deleted');
    return private.app_mutation_store_result(
      v_ctx.session_commerce_id, 'remove_entity', v_operation_id, v_entity_id, v_result
    );
  end if;

  if v_entity = 'cash_movement' then
    if v_role not in ('owner', 'admin') then
      raise exception 'permission_denied';
    end if;
    perform private.app_assert_membership_permission(v_ctx.session_commerce_id, v_ctx.session_user_id, v_ctx.session_is_owner, 'cash:operate', 'cash');
    delete from public.cash_movements
    where id = v_entity_id and commerce_id = v_ctx.session_commerce_id;
    if not found then raise exception 'entity_not_found'; end if;
    v_result := jsonb_build_object('entity', v_entity, 'id', v_entity_id, 'mode', 'deleted');
    return private.app_mutation_store_result(
      v_ctx.session_commerce_id, 'remove_entity', v_operation_id, v_entity_id, v_result
    );
  end if;

  if v_entity = 'purchase_receipt' then
    if v_role not in ('owner', 'admin') then
      raise exception 'permission_denied';
    end if;
    perform private.app_assert_membership_permission(v_ctx.session_commerce_id, v_ctx.session_user_id, v_ctx.session_is_owner, 'purchases:write', 'purchases');
    select * into v_receipt
    from public.purchase_receipts
    where id = v_entity_id and commerce_id = v_ctx.session_commerce_id
    for update;
    if v_receipt.id is null then raise exception 'entity_not_found'; end if;

    insert into public.product_branch_stock (commerce_id, product_id, branch_id, quantity)
    values (v_ctx.session_commerce_id, v_receipt.product_id, v_receipt.branch_id, 0)
    on conflict (product_id, branch_id) do nothing;

    update public.product_branch_stock
    set quantity = quantity - v_receipt.quantity, updated_at = now()
    where commerce_id = v_ctx.session_commerce_id
      and product_id = v_receipt.product_id
      and branch_id = v_receipt.branch_id;

    update public.suppliers
    set balance = greatest(0, coalesce(balance, 0) - coalesce(v_receipt.total_cost, 0)), updated_at = now()
    where id = v_receipt.supplier_id and commerce_id = v_ctx.session_commerce_id;

    delete from public.stock_movements
    where commerce_id = v_ctx.session_commerce_id
      and reference_id = v_receipt.id
      and reference_type = 'purchase_receipt';

    delete from public.purchase_receipts
    where id = v_receipt.id and commerce_id = v_ctx.session_commerce_id;

    v_result := jsonb_build_object('entity', v_entity, 'id', v_entity_id, 'mode', 'deleted');
    return private.app_mutation_store_result(
      v_ctx.session_commerce_id, 'remove_entity', v_operation_id, v_entity_id, v_result
    );
  end if;

  if v_entity = 'sale' then
    if v_role not in ('owner', 'admin') then
      raise exception 'permission_denied: use cancel_sale';
    end if;
    perform private.app_assert_membership_permission(v_ctx.session_commerce_id, v_ctx.session_user_id, v_ctx.session_is_owner, 'sales:write', 'sales');
    select * into v_sale
    from public.sales
    where id = v_entity_id and commerce_id = v_ctx.session_commerce_id
    for update;
    if v_sale.id is null then raise exception 'entity_not_found'; end if;

    if v_sale.status not in ('cancelled', 'returned') then
      perform private.app_restore_sale_stock(
        v_ctx.session_commerce_id, v_sale, v_ctx.session_user_id,
        'Reverso por eliminacion de venta', 'return'
      );
      if v_sale.customer_id is not null then
        update public.customers
        set balance = greatest(
          0,
          coalesce(balance, 0) - greatest(coalesce(v_sale.total_amount, 0) - coalesce(v_sale.amount_paid, 0), 0)
        ), updated_at = now()
        where id = v_sale.customer_id and commerce_id = v_ctx.session_commerce_id;
      end if;
    end if;

    delete from public.documents
    where commerce_id = v_ctx.session_commerce_id and sale_id = v_sale.id;

    delete from public.sales
    where id = v_sale.id and commerce_id = v_ctx.session_commerce_id;

    v_result := jsonb_build_object('entity', v_entity, 'id', v_entity_id, 'mode', 'deleted');
    return private.app_mutation_store_result(
      v_ctx.session_commerce_id, 'remove_entity', v_operation_id, v_entity_id, v_result
    );
  end if;

  raise exception 'unsupported_entity_type';
end;
$$;
