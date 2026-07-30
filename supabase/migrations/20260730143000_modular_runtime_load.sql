-- Carga modular para la web: conserva el contrato JSON existente mientras evita
-- transferir y renderizar historiales ajenos al módulo que el usuario abrió.
create or replace function public.app_public_load_runtime_state(
  p_session_token text,
  p_modules text[] default array['dashboard']::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_modules text[] := coalesce(p_modules, array['dashboard']::text[]);
  v_base jsonb;
  v_data jsonb := '{}'::jsonb;
  v_dashboard boolean;
begin
  -- Reutiliza la autorización consolidada de la RPC actual. La nueva función
  -- no concede acceso directo a ninguna tabla.
  v_state := public.app_public_export_snapshot(p_session_token);
  v_dashboard := 'dashboard' = any(v_modules);
  -- El snapshot histórico no incluye el detalle de abonos. Lo incorporamos
  -- solamente cuando se necesita facturación para conservar todos los campos
  -- que consume la pantalla de cobros.
  if v_dashboard or 'invoices' = any(v_modules) or 'reportes' = any(v_modules) then
    v_state := jsonb_set(v_state, '{invoices}', coalesce((
      select jsonb_agg(invoice || coalesce(summary, '{}'::jsonb))
      from jsonb_array_elements(coalesce(v_state -> 'invoices', '[]'::jsonb)) invoice
      left join jsonb_array_elements(public.app_public_get_invoice_payment_summaries(p_session_token)) summary
        on summary ->> 'invoiceId' = invoice ->> 'id'
    ), '[]'::jsonb));
  end if;
  v_base := v_state - array['customers','products','suppliers','cashSessions','cashMovements','sales','purchaseReceipts','invoices','tickets','stockMovements','auditLogs'];

  if v_dashboard or 'customers' = any(v_modules) then
    v_data := v_data || jsonb_build_object('customers', v_state -> 'customers');
  end if;
  if v_dashboard or 'products' = any(v_modules) or 'stock' = any(v_modules) or 'purchases' = any(v_modules) or 'sales' = any(v_modules) then
    v_data := v_data || jsonb_build_object('products', v_state -> 'products');
  end if;
  if v_dashboard or 'purchases' = any(v_modules) then
    v_data := v_data || jsonb_build_object('suppliers', v_state -> 'suppliers', 'purchaseReceipts', v_state -> 'purchaseReceipts');
  end if;
  if v_dashboard or 'cash' = any(v_modules) or 'sales' = any(v_modules) or 'reportes' = any(v_modules) then
    v_data := v_data || jsonb_build_object('cashSessions', v_state -> 'cashSessions', 'cashMovements', v_state -> 'cashMovements');
  end if;
  if v_dashboard or 'sales' = any(v_modules) or 'cash' = any(v_modules) or 'invoices' = any(v_modules) or 'reportes' = any(v_modules) then
    v_data := v_data || jsonb_build_object('sales', v_state -> 'sales');
  end if;
  if v_dashboard or 'invoices' = any(v_modules) or 'reportes' = any(v_modules) then
    v_data := v_data || jsonb_build_object('invoices', v_state -> 'invoices');
  end if;
  if 'tickets' = any(v_modules) then
    v_data := v_data || jsonb_build_object('tickets', v_state -> 'tickets');
  end if;
  if v_dashboard or 'stock' = any(v_modules) or 'products' = any(v_modules) or 'reportes' = any(v_modules) then
    v_data := v_data || jsonb_build_object('stockMovements', v_state -> 'stockMovements');
  end if;
  if 'audit' = any(v_modules) then
    v_data := v_data || jsonb_build_object('auditLogs', v_state -> 'auditLogs');
  end if;
  return v_base || v_data;
end;
$$;

revoke all on function public.app_public_load_runtime_state(text, text[]) from public;
grant execute on function public.app_public_load_runtime_state(text, text[]) to anon, authenticated;

-- Aceleran los listados ordenados por historial a medida que cada comercio crece.
create index if not exists idx_sales_commerce_sold_at on public.sales(commerce_id, sold_at desc);
create index if not exists idx_cash_movements_commerce_created_at on public.cash_movements(commerce_id, created_at desc);
create index if not exists idx_stock_movements_commerce_created_at on public.stock_movements(commerce_id, created_at desc);
create index if not exists idx_documents_commerce_issued_at on public.documents(commerce_id, issued_at desc);
create index if not exists idx_audit_logs_core_commerce_created_at on public.audit_logs_core(commerce_id, created_at desc);
