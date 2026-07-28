const buildHeaders = (anonKey) => ({
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
  'Content-Type': 'application/json',
})

const normalizeUrl = (url) => String(url || '').trim().replace(/\/+$/, '')

const safeJson = async (response) => {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export const createSupabaseCoreAdapter = (config) => {
  const baseUrl = normalizeUrl(config?.url)
  const anonKey = String(config?.anonKey || '').trim()
  const readSessionToken = typeof config?.getAccessToken === 'function' ? config.getAccessToken : () => ''
  const notifyMutation = typeof config?.onMutation === 'function' ? config.onMutation : () => {}
  const mutationRpcNames = new Set([
    'app_public_update_commerce_profile',
    'app_public_update_commerce_runtime',
    'app_public_upsert_customer',
    'app_public_upsert_branch',
    'app_public_upsert_register',
    'app_public_upsert_supplier',
    'app_public_upsert_user',
    'app_public_platform_update_commerce',
    'app_public_toggle_user_active',
    'app_public_upsert_product',
    'app_public_open_cash_session',
    'app_public_close_cash_session',
    'app_public_create_cash_movement',
    'app_public_create_sale',
    'app_public_register_invoice_payment',
    'app_public_upsert_purchase_receipt',
    'app_public_upsert_document',
  ])

  if (!baseUrl || !anonKey) return null

  const rpc = async (fnName, body) => {
    const response = await fetch(`${baseUrl}/rest/v1/rpc/${fnName}`, {
      method: 'POST',
      headers: buildHeaders(anonKey),
      body: JSON.stringify(body),
    })
    const payload = await safeJson(response)
    if (!response.ok) throw new Error(payload?.message || payload?.hint || payload?.details || `${fnName} failed (${response.status})`)
    if (mutationRpcNames.has(fnName)) notifyMutation()
    return payload
  }

  const getSessionToken = () => {
    const token = String(readSessionToken() || '').trim()
    if (!token) throw new Error('No hay sesion cloud activa.')
    return token
  }

  return {
    async loadState() {
      const state = await rpc('app_public_load_core_state', {
        p_session_token: getSessionToken(),
      })
      try {
        const summaries = await rpc('app_public_get_invoice_payment_summaries', { p_session_token: getSessionToken() })
        const byId = new Map((summaries || []).map((item) => [item.invoiceId, item]))
        state.invoices = (state.invoices || []).map((invoice) => ({ ...invoice, ...(byId.get(invoice.id) || {}) }))
      } catch (error) {
        // Permite que el resto de la aplicación siga operando mientras se
        // despliega la migración de pagos en una instancia existente.
        if (!String(error?.message || '').includes('app_public_get_invoice_payment_summaries')) throw error
      }
      return state
    },
    async updateCommerceProfile(payload) {
      return rpc('app_public_update_commerce_profile', {
        p_session_token: getSessionToken(),
        p_name: payload?.name || '',
        p_owner_email: payload?.ownerEmail || '',
        p_legal_name: payload?.legalName || '',
        p_active_plan: '',
      })
    },
    async updateCommerceRuntime(payload) {
      return rpc('app_public_update_commerce_runtime', {
        p_session_token: getSessionToken(),
        p_active_plan: payload?.activePlan || 'custom',
        p_enabled_modules: Array.isArray(payload?.enabledModules) ? payload.enabledModules : null,
        p_allow_public_signup: typeof payload?.allowPublicSignup === 'boolean' ? payload.allowPublicSignup : null,
      })
    },
    async upsertCustomer(payload) {
      return rpc('app_public_upsert_customer', {
        p_session_token: getSessionToken(),
        p_customer_id: payload?.id || null,
        p_full_name: payload?.fullName || '',
        p_phone: payload?.phone || '',
        p_email: payload?.email || '',
        p_balance: Number(payload?.balance || 0),
        p_tag: payload?.tag || '',
        p_notes: payload?.notes || '',
      })
    },
    async upsertBranch(payload) {
      return rpc('app_public_upsert_branch', {
        p_session_token: getSessionToken(),
        p_branch_id: payload?.id || null,
        p_name: payload?.name || '',
        p_code: payload?.code || '',
        p_address: payload?.address || '',
        p_is_active: payload?.isActive !== false,
      })
    },
    async upsertRegister(payload) {
      return rpc('app_public_upsert_register', {
        p_session_token: getSessionToken(),
        p_register_id: payload?.id || null,
        p_branch_id: payload?.branchId || null,
        p_name: payload?.name || '',
        p_code: payload?.code || '',
        p_cashier_user_id: payload?.cashierUserId || null,
        p_is_active: payload?.isActive !== false,
      })
    },
    async upsertSupplier(payload) {
      return rpc('app_public_upsert_supplier', {
        p_session_token: getSessionToken(),
        p_supplier_id: payload?.id || null,
        p_name: payload?.name || '',
        p_contact: payload?.contact || '',
        p_phone: payload?.phone || '',
        p_email: payload?.email || '',
        p_category: payload?.category || '',
        p_balance: Number(payload?.balance || 0),
        p_last_delivery: payload?.lastDelivery || null,
        p_notes: payload?.notes || '',
        p_is_active: payload?.isActive !== false,
      })
    },
    async upsertUser(payload) {
      return rpc('app_public_upsert_user', {
        p_session_token: getSessionToken(),
        p_user_id: payload?.id || null,
        p_full_name: payload?.fullName || '',
        p_role_key: payload?.roleKey || 'cashier',
        p_email: payload?.email || '',
        p_pin: payload?.pin || null,
        p_is_active: payload?.isActive !== false,
        p_allowed_modules: Array.isArray(payload?.allowedModules) ? payload.allowedModules : null,
        p_blocked_permissions: Array.isArray(payload?.blockedPermissions) ? payload.blockedPermissions : null,
      })
    },
    async loadPlatformOverview() {
      return rpc('app_public_platform_overview', {
        p_session_token: getSessionToken(),
      })
    },
    async updatePlatformCommerce(payload) {
      return rpc('app_public_platform_update_commerce', {
        p_session_token: getSessionToken(),
        p_commerce_id: payload?.commerceId || null,
        p_active_plan: payload?.activePlan || null,
        p_status: payload?.status || null,
        p_billing_status: payload?.billingStatus || null,
        p_allow_public_signup: typeof payload?.allowPublicSignup === 'boolean' ? payload.allowPublicSignup : null,
        p_support_owner: payload?.supportOwner || null,
        p_support_status: payload?.supportStatus || null,
        p_internal_tag: payload?.internalTag || null,
        p_commercial_note: payload?.commercialNote || null,
        p_billing_note: payload?.billingNote || null,
      })
    },
    async toggleUserActive(payload) {
      return rpc('app_public_toggle_user_active', {
        p_session_token: getSessionToken(),
        p_user_id: payload?.id || null,
        p_is_active: payload?.isActive !== false,
      })
    },
    async upsertProduct(payload) {
      return rpc('app_public_upsert_product', {
        p_session_token: getSessionToken(),
        p_product_id: payload?.id || null,
        p_name: payload?.name || '',
        p_sku: payload?.sku || '',
        p_barcode: payload?.barcode || '',
        p_stock: Number(payload?.stock || 0),
        p_sale_price: Number(payload?.salePrice || 0),
        p_cost_price: Number(payload?.costPrice || 0),
        p_min_stock: Number(payload?.minStock || 0),
        p_category: payload?.category || '',
        p_track_stock: payload?.trackStock !== false,
        p_branch_id: payload?.branchId || null,
      })
    },
    async openCashSession(payload) {
      return rpc('app_public_open_cash_session', {
        p_session_token: getSessionToken(),
        p_register_id: payload?.registerId || null,
        p_opening_amount: Number(payload?.openingAmount || 0),
      })
    },
    async closeCashSession(payload) {
      return rpc('app_public_close_cash_session', {
        p_session_token: getSessionToken(),
        p_cash_session_id: payload?.cashSessionId || null,
        p_counted_amount: Number(payload?.countedAmount || 0),
      })
    },
    async createCashMovement(payload) {
      return rpc('app_public_create_cash_movement', {
        p_session_token: getSessionToken(),
        p_cash_session_id: payload?.cashSessionId || null,
        p_kind: payload?.kind || 'income',
        p_amount: Number(payload?.amount || 0),
        p_note: payload?.note || '',
      })
    },
    async createSale(payload) {
      return rpc('app_public_create_sale', {
        p_session_token: getSessionToken(),
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
      })
    },
    async registerInvoicePayment(payload) {
      return rpc('app_public_register_invoice_payment', { p_session_token: getSessionToken(), p_invoice_id: payload?.invoiceId || null, p_method_key: payload?.method || 'transfer', p_amount: Number(payload?.amount || 0), p_reference: payload?.reference || '', p_echeq_details: payload?.echeqDetails || {} })
    },
    async registerSupplierPayment(payload) {
      return rpc('app_public_register_supplier_payment', { p_session_token: getSessionToken(), p_supplier_id: payload?.supplierId || null, p_method_key: payload?.method || 'transfer', p_amount: Number(payload?.amount || 0), p_reference: payload?.reference || '', p_branch_id: payload?.branchId || null })
    },
    async upsertPurchaseReceipt(payload) {
      return rpc('app_public_upsert_purchase_receipt', {
        p_session_token: getSessionToken(),
        p_receipt_id: payload?.id || null,
        p_supplier_id: payload?.supplierId || null,
        p_product_id: payload?.productId || null,
        p_document_number: payload?.documentNumber || '',
        p_quantity: Number(payload?.quantity || 0),
        p_unit_cost: Number(payload?.unitCost || 0),
        p_note: payload?.note || '',
        p_branch_id: payload?.branchId || null,
      })
    },
    async upsertDocument(payload) {
      return rpc('app_public_upsert_document', {
        p_session_token: getSessionToken(),
        p_document_id: payload?.id || null,
        p_branch_id: payload?.branchId || null,
        p_sale_id: payload?.saleId || null,
        p_customer_id: payload?.customerId || null,
        p_related_document_id: payload?.relatedDocumentId || null,
        p_document_number: payload?.number || '',
        p_kind: payload?.kind || 'factura',
        p_fiscal_type: payload?.type || 'B',
        p_status: payload?.status || 'Emitida',
        p_fiscal_status: payload?.fiscalStatus || 'Pendiente',
        p_total_amount: Number(payload?.totalAmount || 0),
        p_payload_json: payload?.payloadJson || {},
      })
    },
  }
}
