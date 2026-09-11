-- Additive private fiscal FK indexes
BEGIN;
CREATE INDEX IF NOT EXISTS idx_fiscal_invoice_events_invoice_id ON private.fiscal_invoice_events (invoice_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_sale_id ON private.fiscal_invoices (sale_id);
COMMIT;