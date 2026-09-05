// P0 cloud mutation RPC wrappers (SECURITY DEFINER app_public_*)
export const cloudMutationMethods = (rpc, getSessionToken) => ({
  async cancelSale(payload) {
    return rpc('app_public_cancel_sale', {
      p_session_token: getSessionToken(),
      p_sale_id: payload?.saleId || null,
      p_reason: payload?.reason || 'Anulacion manual',
      p_operation_id: payload?.operationId || null,
    })
  },
  async returnSale(payload) {
    return rpc('app_public_return_sale', {
      p_session_token: getSessionToken(),
      p_sale_id: payload?.saleId || null,
      p_reason: payload?.reason || 'Devolucion total',
      p_operation_id: payload?.operationId || null,
    })
  },
  async updateSale(payload) {
    return rpc('app_public_update_sale', {
      p_session_token: getSessionToken(),
      p_sale_id: payload?.saleId || null,
      p_customer_id: payload?.customerId || null,
      p_channel: payload?.channel || 'Mostrador',
      p_payment_method: payload?.paymentMethod || 'cash',
      p_discount_amount: Number(payload?.discountAmount || 0),
      p_note: payload?.note || '',
      p_is_paid: payload?.isPaid === true,
      p_auto_invoice: payload?.autoInvoice === true,
      p_cash_amount: Number(payload?.cashAmount || 0),
      p_transfer_amount: Number(payload?.transferAmount || 0),
      p_mercado_pago_amount: Number(payload?.mercadoPagoAmount || 0),
      p_echeq_amount: Number(payload?.echeqAmount || 0),
      p_echeq_details: payload?.echeqDetails || {},
      p_account_amount: Number(payload?.accountAmount || 0),
      p_items: Array.isArray(payload?.items) ? payload.items : [],
      p_branch_id: payload?.branchId || null,
      p_register_id: payload?.registerId || null,
      p_operation_id: payload?.operationId || null,
    })
  },
  async createStockAdjustment(payload) {
    return rpc('app_public_create_stock_adjustment', {
      p_session_token: getSessionToken(),
      p_product_id: payload?.productId || null,
      p_quantity: Number(payload?.quantity || 0),
      p_note: payload?.note || '',
      p_branch_id: payload?.branchId || null,
      p_operation_id: payload?.operationId || null,
    })
  },
  async transferStock(payload) {
    return rpc('app_public_transfer_stock', {
      p_session_token: getSessionToken(),
      p_product_id: payload?.productId || null,
      p_quantity: Number(payload?.quantity || 0),
      p_from_branch_id: payload?.fromBranchId || null,
      p_to_branch_id: payload?.toBranchId || null,
      p_note: payload?.note || '',
      p_operation_id: payload?.operationId || null,
    })
  },
  async removeEntity(payload) {
    return rpc('app_public_remove_entity', {
      p_session_token: getSessionToken(),
      p_entity_type: payload?.entity || '',
      p_entity_id: payload?.id || null,
    })
  },
})

export const cloudMutationRpcNames = [
  'app_public_cancel_sale',
  'app_public_return_sale',
  'app_public_update_sale',
  'app_public_create_stock_adjustment',
  'app_public_transfer_stock',
  'app_public_remove_entity',
]

export const cloudMutationModules = {
  app_public_cancel_sale: ['sales', 'cash', 'products', 'customers', 'invoices', 'stock'],
  app_public_return_sale: ['sales', 'products', 'customers', 'invoices', 'stock'],
  app_public_update_sale: ['sales', 'cash', 'products', 'customers', 'invoices', 'stock'],
  app_public_create_stock_adjustment: ['products', 'stock'],
  app_public_transfer_stock: ['products', 'stock'],
  app_public_remove_entity: ['dashboard', 'sales', 'products', 'customers', 'purchases', 'invoices', 'tickets', 'cash', 'stock', 'settings'],
}
