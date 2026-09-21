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
    persistLocal,
  } = deps

  const original = { ...api }

  // Parche local post-RPC: evita syncFromCloud completo tras ajuste/transferencia.
  const saveLocalAfterPatch = () => {
    if (typeof persistLocal === 'function') persistLocal()
  }

  const ensureStockByBranch = (product) => {
    if (!product.stockByBranch || typeof product.stockByBranch !== 'object') {
      product.stockByBranch = {}
    }
    return product.stockByBranch
  }

  const resyncProductStockTotal = (product) => {
    product.stock = Object.values(ensureStockByBranch(product)).reduce(
      (sum, quantity) => sum + Number(quantity || 0),
      0,
    )
    return product.stock
  }

  const patchProductBranchStockAbsolute = (productId, branchId, absoluteStock) => {
    const product = getProduct(productId)
    if (!product || !branchId) return false
    const next = Number(absoluteStock)
    if (!Number.isFinite(next)) return false
    ensureStockByBranch(product)[String(branchId)] = Math.max(0, next)
    resyncProductStockTotal(product)
    return true
  }

  const patchProductBranchStockDelta = (productId, branchId, delta) => {
    const product = getProduct(productId)
    if (!product || !branchId) return false
    const change = Number(delta)
    if (!Number.isFinite(change)) return false
    const map = ensureStockByBranch(product)
    const key = String(branchId)
    const current = Number(map[key] ?? 0)
    map[key] = Math.max(0, current + change)
    resyncProductStockTotal(product)
    return true
  }

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
    const branchId = getCurrentBranch()?.id || state.branches[0]?.id || null
    const rpcResult = await adapter.createStockAdjustment({
      productId: payload.productId,
      quantity,
      note: payload.note || '',
      branchId,
      operationId: makeOperationId(),
    })
    // RPC: { movement_id, product_id, branch_id, quantity, stock } — stock = qty absoluta post-ajuste.
    const patchProductId = rpcResult?.product_id || payload.productId
    const patchBranchId = rpcResult?.branch_id || branchId
    if (rpcResult?.stock != null) {
      patchProductBranchStockAbsolute(patchProductId, patchBranchId, rpcResult.stock)
      saveLocalAfterPatch()
    } else if (rpcResult?.quantity != null && patchBranchId) {
      patchProductBranchStockDelta(patchProductId, patchBranchId, rpcResult.quantity)
      saveLocalAfterPatch()
    }
    return { ok: true, message: 'Ajuste de stock aplicado.' }
  }

  api.transferStock = async (payload) => {
    const adapter = getCloudCoreAdapter?.()
    if (!adapter) return original.transferStock(payload)
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
    const rpcResult = await adapter.transferStock({
      productId: payload.productId,
      quantity,
      fromBranchId: payload.fromBranchId,
      toBranchId: payload.toBranchId,
      note: payload.note || '',
      operationId: makeOperationId(),
    })
    // RPC: { transfer_id, product_id, quantity, from_branch_id, to_branch_id } — sin stock absoluto.
    // Camino seguro mínimo: aplicar deltas locales post-éxito (sin syncFromCloud).
    const patchProductId = rpcResult?.product_id || payload.productId
    const fromId = rpcResult?.from_branch_id || payload.fromBranchId
    const toId = rpcResult?.to_branch_id || payload.toBranchId
    const movedQty = Number(rpcResult?.quantity ?? quantity)
    if (fromId && toId && Number.isFinite(movedQty) && movedQty > 0) {
      patchProductBranchStockDelta(patchProductId, fromId, -movedQty)
      patchProductBranchStockDelta(patchProductId, toId, movedQty)
      saveLocalAfterPatch()
    }
    return { ok: true, message: 'Transferencia registrada entre sucursales.' }
  }

  api.removeEntity = async (entity, id) => {
    const adapter = getCloudCoreAdapter?.()
    if (!adapter) return original.removeEntity(entity, id)
    if (entity === 'register') return original.removeEntity(entity, id)

    const user = typeof deps.getCurrentUser === 'function' ? deps.getCurrentUser() : null
    const roleKey = String(user?.roleKey || user?.role_key || '').toLowerCase()
    const isOwnerAdmin = Boolean(
      user?.isOwner || user?.isPlatformAdmin || roleKey === 'owner' || roleKey === 'admin',
    )

    // Cashiers (and non-admin roles) must cancel sales instead of hard-delete.
    if (entity === 'sale' && !isOwnerAdmin) {
      return api.cancelSale(id, 'Anulacion (eliminacion permanente solo owner/admin)')
    }

    try {
      await adapter.removeEntity({ entity, id, operationId: makeOperationId() })
      await syncFromCloud()
      return { ok: true, message: 'Registro eliminado y movimientos revertidos cuando correspondia.' }
    } catch (error) {
      const msg = String(error?.message || '')
      if (entity === 'sale' && /use_cancel_sale|permission_denied/i.test(msg)) {
        return api.cancelSale(id, 'Anulacion (eliminacion permanente no permitida)')
      }
      const hints = {
        sale: 'Solo owner/admin pueden eliminar ventas permanentemente. Usa Anular venta.',
        invoice: 'Solo owner/admin pueden eliminar facturas/comprobantes permanentemente.',
        ticket: 'Solo owner/admin pueden eliminar tickets permanentemente.',
        cash_movement: 'Solo owner/admin pueden eliminar movimientos de caja.',
        purchase_receipt: 'Solo owner/admin pueden eliminar comprobantes de compra.',
      }
      if (/permission_denied|use_cancel_sale/i.test(msg)) {
        return { ok: false, message: hints[entity] || 'No tienes permiso para eliminar este registro.' }
      }
      throw error
    }
  }

  return api
}
