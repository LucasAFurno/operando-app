-- Las ventas de mostrador pueden facturarse a consumidor final, sin cliente asociado.
-- La sobrecarga conserva el manejo de e-cheq y completa el comprobante que el RPC
-- base omite cuando p_customer_id es nulo.
create or replace function public.app_public_create_sale(
  p_session_token text, p_customer_id text, p_channel text, p_payment_method text, p_discount_amount numeric, p_note text,
  p_is_paid boolean, p_auto_invoice boolean, p_cash_amount numeric, p_transfer_amount numeric, p_mercado_pago_amount numeric,
  p_echeq_amount numeric, p_echeq_details jsonb, p_account_amount numeric, p_items jsonb, p_branch_id text, p_register_id text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_result jsonb;
  v_sale_id uuid;
  v_echeq numeric := greatest(coalesce(p_echeq_amount, 0), 0);
  v_commerce_id uuid;
  v_branch_id uuid;
  v_branch_code text;
  v_total numeric;
  v_amount_paid numeric;
  v_document_id uuid;
  v_document_number text;
begin
  if v_echeq > 0 and lower(coalesce(p_payment_method, '')) = 'mixed' then
    raise exception 'echeq_mixed_not_supported';
  end if;
  if lower(coalesce(p_payment_method, '')) = 'echeq' and trim(coalesce(p_echeq_details ->> 'number', '')) = '' then
    raise exception 'echeq_number_required';
  end if;

  v_result := public.app_public_create_sale(
    p_session_token,
    p_customer_id,
    p_channel,
    case when lower(coalesce(p_payment_method, '')) = 'echeq' then 'mercado_pago' else p_payment_method end,
    p_discount_amount,
    p_note,
    p_is_paid,
    p_auto_invoice,
    p_cash_amount,
    p_transfer_amount,
    case when lower(coalesce(p_payment_method, '')) = 'echeq' then v_echeq else p_mercado_pago_amount end,
    p_account_amount,
    p_items,
    p_branch_id,
    p_register_id
  );

  v_sale_id := (v_result ->> 'sale_id')::uuid;

  if coalesce(p_auto_invoice, false)
    and nullif(trim(coalesce(p_customer_id, '')), '') is null
    and coalesce((v_result ->> 'amount_paid')::numeric, 0) > 0
    and coalesce(v_result ->> 'invoice_id', '') = '' then
    select sale.commerce_id, sale.branch_id, branch.code, sale.total_amount, sale.amount_paid
      into v_commerce_id, v_branch_id, v_branch_code, v_total, v_amount_paid
    from public.sales sale
    join public.branches branch on branch.id = sale.branch_id
    where sale.id = v_sale_id;

    if not exists (select 1 from public.documents where sale_id = v_sale_id) then
      v_document_id := gen_random_uuid();
      v_document_number := 'FAC-' || coalesce(v_branch_code, 'SUC') || '-' || to_char(now(), 'YYYYMMDDHH24MISSMS') || '-' || left(replace(v_sale_id::text, '-', ''), 8);

      insert into public.documents (
        id, commerce_id, branch_id, sale_id, customer_id, document_number,
        kind, fiscal_type, status, fiscal_status, total_amount, payload_json
      ) values (
        v_document_id, v_commerce_id, v_branch_id, v_sale_id, null, v_document_number,
        'factura', 'B', case when v_amount_paid >= v_total then 'Cobrada' else 'Emitida' end, 'Pendiente', v_total,
        jsonb_build_object('generatedFrom', 'sale', 'saleId', v_sale_id, 'consumerFinal', true)
      );

      v_result := v_result || jsonb_build_object('invoice_id', v_document_id, 'invoice_number', v_document_number);
    end if;
  end if;

  if lower(coalesce(p_payment_method, '')) = 'echeq' then
    update public.sales set payment_method = 'echeq', updated_at = now() where id = v_sale_id;
    update public.sale_payments
    set method_key = 'echeq', metadata = coalesce(p_echeq_details, '{}'::jsonb)
    where sale_id = v_sale_id and method_key = 'mercado_pago';
  end if;

  return v_result;
end;
$$;

revoke all on function public.app_public_create_sale(text, text, text, text, numeric, text, boolean, boolean, numeric, numeric, numeric, numeric, jsonb, numeric, jsonb, text, text) from public;
revoke all on function public.app_public_create_sale(text, text, text, text, numeric, text, boolean, boolean, numeric, numeric, numeric, numeric, jsonb, numeric, jsonb, text, text) from authenticated;
grant execute on function public.app_public_create_sale(text, text, text, text, numeric, text, boolean, boolean, numeric, numeric, numeric, numeric, jsonb, numeric, jsonb, text, text) to anon;
grant execute on function public.app_public_create_sale(text, text, text, text, numeric, text, boolean, boolean, numeric, numeric, numeric, numeric, jsonb, numeric, jsonb, text, text) to authenticated;
