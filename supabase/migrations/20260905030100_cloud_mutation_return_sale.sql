-- P0 cloud mutations: return sale
-- ---------------------------------------------------------------------------
-- return sale (devolucion total + nota de credito)
-- ---------------------------------------------------------------------------
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

revoke all on function public.app_public_return_sale(text, text, text, text) from public;
grant execute on function public.app_public_return_sale(text, text, text, text) to anon, authenticated;
