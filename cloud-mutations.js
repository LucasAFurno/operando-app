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
      p_operation_id: payload?.operationId || null,
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

export const wireDataStoreCloudMutations = (api, deps) => {
  const {
    getCloudCoreAdapter,
    syncFromCloud,
    getState,
    getProduct,
    getBranch,
    getCurrentBranch,
    getCurrentRegister,
    makeOperationId,
  } = deps

  const original = { ...api }

  api.updateSale = async (saleId, payload) => {
    const adapter = getCloudCoreAdapter?.()
    if (!adapter) return original.updateSale(saleId, payload)
    const state = getState()
    const currentBranch = getCurrentBranch()
    const currentRegister = getCurrentRegister()
    await adapter.updateSale({
      ...payload,
      saleId,
      operationId: payload.operationId || makeOperationId(),
      branchId: payload.branchId || currentBranch?.id || null,
      registerId: payload.registerId || currentRegister?.id || null,
    })
    await syncFromCloud()
    return { ok: true, message: 'Venta actualizada.' }
  }

  api.cancelSale = async (saleId, reason = 'Anulacion manual') => {
    const adapter = getCloudCoreAdapter?.()
    if (!adapter) return original.cancelSale(saleId, reason)
    const state = getState()
    const sale = state.sales.find((entry) => entry.id === saleId)
    if (!sale) return { ok: false, message: 'Venta no encontrada.' }
    if (sale.status === 'cancelled') return { ok: false, message: 'La venta ya esta anulada.' }
    await adapter.cancelSale({ saleId, reason, operationId: makeOperationId() })
    await syncFromCloud()
    return { ok: true, message: 'Venta anulada y movimientos revertidos.' }
  }

  api.createReturnFromSale = async (saleId, reason = 'Devolucion total') => {
    const adapter = getCloudCoreAdapter?.()
    if (!adapter) return original.createReturnFromSale(saleId, reason)
    const state = getState()
    const sale = state.sales.find((entry) => entry.id === saleId)
    if (!sale) return { ok: false, message: 'Venta no encontrada.' }
    if (sale.status === 'returned') return { ok: false, message: 'La venta ya fue devuelta.' }
    await adapter.returnSale({ saleId, reason, operationId: makeOperationId() })
    await syncFromCloud()
    return { ok: true, message: 'Devolucion registrada y nota de credito generada.' }
  }

  api.createStockAdjustment = async (payload) => {
    const adapter = getCloudCoreAdapter?.()
    if (!adapter) return original.createStockAdjustment(payload)
    const state = getState()
    const product = getProduct(payload.productId)
    if (!product) return { ok: false, message: 'Producto no encontrado.' }
    const quantity = Number(payload.quantity || 0)
    if (!quantity) return { ok: false, message: 'La cantidad debe ser distinta de cero.' }
    await adapter.createStockAdjustment({
      productId: payload.productId,
      quantity,
      note: payload.note || '',
      branchId: getCurrentBranch()?.id || state.branches[0]?.id || null,
      operationId: makeOperationId(),
    })
    await syncFromCloud()
    return { ok: true, message: 'Ajuste de stock aplicado.' }
  }

  api.transferStock = async (payload) => {
    const adapter = getCloudCoreAdapter?.()
    if (!adapter) return original.transferStock(payload)
    const state = getState()
    const product = getProduct(payload.productId)
    if (!product) return { ok: false, message: 'Producto no encontrado.' }
    const quantity = Number(payload.quantity || 0)
    if (quantity <= 0) return { ok: false, message: 'La cantidad debe ser mayor a cero.' }
    if (payload.fromBranchId === payload.toBranchId) {
      return { ok: false, message: 'La sucursal origen y destino no pueden ser la misma.' }
    }
    const fromBranch = getBranch(payload.fromBranchId)
    const toBranch = getBranch(payload.toBranchId)
    if (!fromBranch || !toBranch) return { ok: false, message: 'Sucursal invalida.' }
    await adapter.transferStock({
      productId: payload.productId,
      quantity,
      fromBranchId: payload.fromBranchId,
      toBranchId: payload.toBranchId,
      note: payload.note || '',
      operationId: makeOperationId(),
    })
    await syncFromCloud()
    return { ok: true, message: 'Transferencia registrada entre sucursales.' }
  }

  api.removeEntity = async (entity, id) => {
    const adapter = getCloudCoreAdapter?.()
    if (!adapter) return original.removeEntity(entity, id)
    if (entity === 'register') return original.removeEntity(entity, id)
    await adapter.removeEntity({ entity, id, operationId: makeOperationId() })
    await syncFromCloud()
    return { ok: true, message: 'Registro eliminado y movimientos revertidos cuando correspondia.' }
  }

  return api
}
