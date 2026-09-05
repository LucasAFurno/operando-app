-- stub then replaced by full body
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
begin
  raise exception 'update_sale_pending_deploy';
end;
$$;

revoke all on function public.app_public_update_sale(text, text, text, text, text, numeric, text, boolean, boolean, numeric, numeric, numeric, numeric, jsonb, numeric, jsonb, text, text, text) from public;
grant execute on function public.app_public_update_sale(text, text, text, text, text, numeric, text, boolean, boolean, numeric, numeric, numeric, numeric, jsonb, numeric, jsonb, text, text, text) to anon, authenticated;
