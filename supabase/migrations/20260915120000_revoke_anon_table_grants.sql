-- Harden surface: business tables are RPC-only for the anon (publishable) key.
-- Client today uses supabase.rpc(...)+p_session_token; direct REST table access is not required.
-- Does NOT revoke EXECUTE on app_public_* functions.
-- Does NOT touch authenticated/service_role table grants (anon key is the browser path).
-- DO NOT apply to prod until Eustekio says apply. Smoke after apply: login + load_*_state + create_sale.

REVOKE ALL ON TABLE
  public.audit_logs_core,
  public.branches,
  public.cash_movements,
  public.cash_sessions,
  public.commerce_accounts,
  public.commerce_memberships,
  public.customers,
  public.document_payments,
  public.documents,
  public.product_branch_stock,
  public.products,
  public.purchase_receipts,
  public.registers,
  public.sale_items,
  public.sale_payments,
  public.sales,
  public.stock_movements,
  public.supplier_payments,
  public.suppliers
FROM anon;

-- Future tables created by the migration owner in public should not inherit broad anon grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon;
