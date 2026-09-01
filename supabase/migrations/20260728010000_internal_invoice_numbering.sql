-- Nunca presentar una factura como ARCA sin que exista una autorización/CAE.
-- Las ventas facturadas sin integración fiscal quedan como comprobantes internos correlativos.
with internal_documents as (
  select id, row_number() over (partition by commerce_id order by issued_at, id) as sequence
  from public.documents
  where payload_json ->> 'generatedFrom' = 'sale'
    and coalesce(payload_json ->> 'consumerFinal', 'false') = 'true'
    and document_number like 'FAC-%'
)
update public.documents document
set
  document_number = 'INT-0001-' || lpad(internal_documents.sequence::text, 8, '0'),
  fiscal_type = 'X',
  fiscal_status = 'Interno',
  payload_json = document.payload_json || jsonb_build_object('internalDocument', true, 'fiscalAuthorization', false),
  updated_at = now()
from internal_documents
where document.id = internal_documents.id;

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
  v_customer_id uuid;
  v_total numeric;
  v_amount_paid numeric;
  v_document_id uuid;
  v_document_number text;
  v_internal_sequence integer;
begin
  if v_echeq > 0 and lower(coalesce(p_payment_method, '')) = 'mixed' then raise exception 'echeq_mixed_not_supported'; end if;
  if lower(coalesce(p_payment_method, '')) = 'echeq' and trim(coalesce(p_echeq_details ->> 'number', '')) = '' then raise exception 'echeq_number_required'; end if;

  v_result := public.app_public_create_sale(
    p_session_token, p_customer_id, p_channel,
    case when lower(coalesce(p_payment_method, '')) = 'echeq' then 'mercado_pago' else p_payment_method end,
    p_discount_amount, p_note, p_is_paid, false, p_cash_amount, p_transfer_amount,
    case when lower(coalesce(p_payment_method, '')) = 'echeq' then v_echeq else p_mercado_pago_amount end,
    p_account_amount, p_items, p_branch_id, p_register_id
  );
  v_sale_id := (v_result ->> 'sale_id')::uuid;

  if coalesce(p_auto_invoice, false) and coalesce((v_result ->> 'amount_paid')::numeric, 0) > 0 then
    select sale.commerce_id, sale.branch_id, sale.customer_id, sale.total_amount, sale.amount_paid
      into v_commerce_id, v_branch_id, v_customer_id, v_total, v_amount_paid
    from public.sales sale
    where sale.id = v_sale_id;

    if not exists (select 1 from public.documents where sale_id = v_sale_id) then
      perform pg_advisory_xact_lock(hashtext('operando_internal_invoice:' || v_commerce_id::text));
      select coalesce(max(nullif(substring(document_number from '^INT-0001-([0-9]{8})$'), '')::integer), 0) + 1
        into v_internal_sequence
      from public.documents
      where commerce_id = v_commerce_id;

      v_document_id := gen_random_uuid();
      v_document_number := 'INT-0001-' || lpad(v_internal_sequence::text, 8, '0');
      insert into public.documents (
        id, commerce_id, branch_id, sale_id, customer_id, document_number,
        kind, fiscal_type, status, fiscal_status, total_amount, payload_json
      ) values (
        v_document_id, v_commerce_id, v_branch_id, v_sale_id, v_customer_id, v_document_number,
        'factura', 'X', case when v_amount_paid >= v_total then 'Cobrada' else 'Emitida' end, 'Interno', v_total,
        jsonb_build_object('generatedFrom', 'sale', 'saleId', v_sale_id, 'consumerFinal', true, 'internalDocument', true, 'fiscalAuthorization', false)
      );
      v_result := v_result || jsonb_build_object('invoice_id', v_document_id, 'invoice_number', v_document_number);
    end if;
  end if;

  if lower(coalesce(p_payment_method, '')) = 'echeq' then
    update public.sales set payment_method = 'echeq', updated_at = now() where id = v_sale_id;
    update public.sale_payments set method_key = 'echeq', metadata = coalesce(p_echeq_details, '{}'::jsonb) where sale_id = v_sale_id and method_key = 'mercado_pago';
  end if;
  return v_result;
end;
$$;

revoke all on function public.app_public_create_sale(text, text, text, text, numeric, text, boolean, boolean, numeric, numeric, numeric, numeric, jsonb, numeric, jsonb, text, text) from public;
revoke all on function public.app_public_create_sale(text, text, text, text, numeric, text, boolean, boolean, numeric, numeric, numeric, numeric, jsonb, numeric, jsonb, text, text) from authenticated;
grant execute on function public.app_public_create_sale(text, text, text, text, numeric, text, boolean, boolean, numeric, numeric, numeric, numeric, jsonb, numeric, jsonb, text, text) to anon, authenticated;
