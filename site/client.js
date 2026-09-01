import { createBrowserDataStore } from './data-store.js?v=__OPERANDO_ASSET_VERSION__'
import { createCloudAuthManager } from './cloud-auth.js?v=__OPERANDO_ASSET_VERSION__'
import { createClient as createSupabaseRealtimeClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8'

const currency = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const today = new Date().toISOString().slice(0, 10)
const productName = 'Operando'
const appVersion = '__OPERANDO_RELEASE_VERSION__'
const supportUrl = 'https://wa.me/5491135708345?text=Hola%20operando.app%2C%20necesito%20soporte%20de%20operando.app.'
const bulkImportSupportUrl = 'https://wa.me/5491135708345?text=Hola%20operando.app%2C%20necesito%20cargar%20productos%20desde%20una%20planilla%20en%20operando.app.'
const publicSiteUrl = 'https://operando.app'
const themeStorageKey = 'operando-control-theme'
const sectionStorageKey = 'operando-control-section'
const instanceStorageKey = 'operando-control-instance'
const dataStorageKey = 'operando-control-data'
const cloudConfigStorageKey = 'operando-control-cloud-config'
const onboardingStorageKey = 'operando-control-onboarding-v1'
const defaultSupabaseUrl = 'https://rfwsnqmjkclxhbmidbkm.supabase.co'
const canPersistInBrowser = Boolean(globalThis.window?.operandoDesktop?.isDesktop)

let store = null
let authManager = null
const safeStorage = {
  getItem(key, fallback = '') {
    if (!canPersistInBrowser) return fallback
    try {
      const value = globalThis.localStorage?.getItem(key)
      return value ?? fallback
    } catch {
      return fallback
    }
  },
  setItem(key, value) {
    if (!canPersistInBrowser) return
    try {
      globalThis.localStorage?.setItem(key, value)
    } catch {
      // Ignore storage write failures in restricted browsers
    }
  },
  removeItem(key) {
    if (!canPersistInBrowser) return
    try {
      globalThis.localStorage?.removeItem(key)
    } catch {
      // Ignore storage cleanup failures in restricted browsers
    }
  },
}

const icon = (path) => `
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    ${path}
  </svg>
`

const navItems = [
  { id: 'dashboard', moduleKey: 'dashboard', label: 'Resumen', permission: 'dashboard:view', icon: icon('<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V20h14v-9.5"/>') },
  { id: 'clientes', moduleKey: 'customers', label: 'Clientes', permission: 'customers:view', icon: icon('<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="3"/><path d="M20 8v6"/><path d="M17 11h6"/>') },
  { id: 'ventas', moduleKey: 'sales', label: 'Ventas', permission: 'sales:view', icon: icon('<path d="M4 17h16"/><path d="M7 17V9"/><path d="M12 17V5"/><path d="M17 17v-6"/>') },
  { id: 'caja', moduleKey: 'cash', label: 'Caja', permission: 'cash:view', icon: icon('<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16"/><path d="M16 14h2"/>') },
  { id: 'productos', moduleKey: 'products', label: 'Catálogo', permission: 'products:view', icon: icon('<path d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z"/><path d="M3 7.5V16.5L12 21l9-4.5V7.5"/>') },
  { id: 'compras', moduleKey: 'purchases', label: 'Compras', permission: 'purchases:view', icon: icon('<circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/><path d="M3 4h2l2.4 10.5h10.8L21 8H8"/>') },
  { id: 'facturacion', moduleKey: 'invoices', label: 'Facturación', permission: 'invoices:view', icon: icon('<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4"/><path d="M10 12h6"/><path d="M10 16h6"/>') },
  { id: 'tickets', moduleKey: 'tickets', label: 'Servicios', permission: 'tickets:view', icon: icon('<rect x="4" y="5" width="16" height="10" rx="2"/><path d="M8 19h8"/><path d="M10 15v4"/><path d="M14 15v4"/>') },
  { id: 'reportes', moduleKey: 'reports', label: 'Informes', permission: 'reports:view', icon: icon('<path d="M5 19V9"/><path d="M12 19V5"/><path d="M19 19v-8"/><path d="M3 19h18"/>') },
  { id: 'auditoria', moduleKey: 'audit', label: 'Actividad', permission: 'audit:view', icon: icon('<path d="M12 3v9l5 3"/><circle cx="12" cy="12" r="9"/><path d="M3 12h2M19 12h2"/>') },
  { id: 'mi-admin', moduleKey: 'settings', label: 'Consola Operando', permission: 'settings:view', platformOnly: true, icon: icon('<path d="M4 19.5v-9l8-5 8 5v9"/><path d="M9 19.5v-4h6v4"/><path d="M8 9h8"/><path d="M12 3v3"/>') },
  { id: 'ajustes', moduleKey: 'settings', label: 'Configuración', permission: 'settings:view', icon: icon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.33 1V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-.33-1A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1-.33H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1-.33A1.65 1.65 0 0 0 4.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8 4.6a1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .33-1V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 .33 1 1.65 1.65 0 0 0 1 .6 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 8a1.65 1.65 0 0 0 .6 1 1.65 1.65 0 0 0 1 .33H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1 .33 1.65 1.65 0 0 0-.51 1.34Z"/>') },
]

const app = document.querySelector('#app')
const bootStatus = document.querySelector('#boot-status')
const preloadSite = document.querySelector('#preload-site')
let theme = 'dark'
let activeSection = 'dashboard'
let loginMessage = ''
let signupMessage = ''
let feedbackMessage = ''
let saleEditingId = ''
let purchaseEditingId = ''
let invoiceEditingId = ''
let ticketEditingId = ''
let branchEditingId = ''
let branchSearchQuery = ''
let registerEditingId = ''
let userEditingId = ''
let reportRegisterFilter = 'all'
let reportDateFrom = ''
let reportDateTo = ''
let saleDraftQuantities = {}
let saleQuickAddCode = ''
let saleCustomerSearchQuery = ''
let saleOperationId = ''
let saleSubmissionInFlight = false
const makeSaleOperationId = () => {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  } catch {
    // The fallback preserves the UUID format accepted by the cloud RPC.
  }
  const randomHex = () => Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0')
  return `${randomHex()}-${randomHex().slice(0, 4)}-4${randomHex().slice(0, 3)}-8${randomHex().slice(0, 3)}-${randomHex()}${randomHex().slice(0, 4)}`
}
let topbarSearch = ''
let cloudSyncBusy = false
let liveSyncBusy = false
let liveSyncDebounceTimer = null
let operationalRealtimeClient = null
let operationalRealtimeChannel = null
let unsubscribeOperationalChanges = null
const pendingOperationalDomains = new Set()
let customerFormOpen = false
let customerEditingId = ''
let customerSearchQuery = ''
let customerMapPreviewId = ''
let saleFormOpen = false
let cashFormOpen = false
let productFormOpen = false
let productEditingId = ''
let productSearchQuery = ''
let stockAdjustmentFormOpen = false
let stockTransferFormOpen = false
let supplierFormOpen = false
let supplierEditingId = ''
let supplierSearchQuery = ''
let purchaseFormOpen = false
let purchaseDraftItems = {}
let purchaseQuickAddCode = ''
let purchaseSupplierSearch = ''
let supplierPaymentDraft = null
let supplierPaymentPanelOpen = false
let purchaseReceiptsExpanded = false
let purchaseSuppliersExpanded = false
let dashboardStockExpanded = false
let dashboardAuditExpanded = false
let auditModuleFilter = 'all'
let auditPeriodFilter = 'all'
let auditSearchQuery = ''
let auditDateFrom = ''
let auditDateTo = ''
let supplierMapPreviewId = ''
let invoiceFormOpen = false
let invoicePaymentId = ''
let ticketFormOpen = false
let branchFormOpen = false
let registerFormOpen = false
let commerceContext = null
let setupStatus = null
let authInstanceKey = ''
let authViewMode = 'landing'
let recoveryState = null
let hardwareScanBuffer = ''
let hardwareScanTimer = null
let hardwareScanListenerBound = false
let onboardingKeyListenerBound = false
let feedbackTimer = null
let pendingScrollTop = false
let accountAlertsOpen = false
let dismissedAccountAlertIds = new Set()
let supportMenuOpen = false
let settingsPanelOpen = ''
let progressiveProfilePromptOpen = true
let progressiveProfileStep = 1
let progressiveProfileGoalsDraft = null
let progressiveProfileError = ''
let arcaSetupStep = 1
let arcaCsrGenerated = false
let arcaCertificateName = ''
let arcaVerificationState = 'idle'
let arcaConnectionStatus = 'attention'
let arcaFiscal = { cuit: '', legalName: '', pointOfSale: '', csrPem: '', certificatePem: '' }
let platformUserSelectedId = ''
let platformUserFilter = 'all'
let platformUserSearchQuery = ''
let pendingScrollSelector = ''
let userDraftRoleId = 'role-cashier'
let onboarding = { visible: false, step: 0, completed: [] }
let onboardingLoadedFor = ''
let onboardingSeenReportedFor = ''
let onboardingPausedFor = ''
let pendingOnboardingFocus = false
const pageSizeOptions = [10, 20, 50, 100, 1000]

const onboardingSteps = [
  { id: 'product', section: 'productos', selector: '[data-action="open-product-form"]', title: 'Cargá un producto', text: 'Usá “Agregar producto” para dar de alta el primer artículo.' },
  { id: 'cash', section: 'caja', selector: '[data-action="open-cash-form"]', title: 'Abrí la caja', text: 'Usá “Abrir caja” antes de cobrar en efectivo. Transferencias y cuenta no la requieren.' },
  { id: 'cart', section: 'ventas', selector: '.scanner-row', title: 'Buscá o escaneá', text: 'Escribí o escaneá el artículo y tocá “Agregar” para sumarlo al carrito.' },
  { id: 'charge', section: 'ventas', selector: '.pos-charge-button', title: 'Confirmá el cobro', text: 'Revisá el medio de pago y cobrá una sola vez. El botón se desactiva mientras se procesa.' },
  { id: 'receipt', section: 'ventas', selector: 'details.row-more-menu--sales > summary', title: 'Emití el comprobante', text: 'Abrí las acciones de una venta y elegí “Factura” o uno de los tickets.' },
]

const getOnboardingStorageKey = () => `${onboardingStorageKey}:${commerceContext?.commerce_id || authInstanceKey || 'local'}:${store?.getSnapshot?.().meta?.currentUserId || 'user'}`
const saveOnboarding = () => safeStorage.setItem(getOnboardingStorageKey(), JSON.stringify(onboarding))
const loadOnboarding = (guideSeenAt = '') => {
  onboarding = { visible: !guideSeenAt, step: 0, completed: [] }
  if (guideSeenAt) return
  try {
    const saved = JSON.parse(safeStorage.getItem(getOnboardingStorageKey(), ''))
    if (saved && Array.isArray(saved.completed)) onboarding = { visible: false, step: Number(saved.step) || 0, completed: saved.completed }
  } catch { /* La guía es opcional: un estado inválido no afecta la operación. */ }
}
const currentOnboardingStep = () => onboardingSteps[onboarding.step] || onboardingSteps.find((step) => !onboarding.completed.includes(step.id)) || null
const completeOnboardingStep = (id) => {
  if (!onboarding.completed.includes(id)) onboarding.completed.push(id)
  onboarding.step = onboardingSteps.findIndex((step) => !onboarding.completed.includes(step.id))
  saveOnboarding()
}
const resumeOnboardingAfterStep = (id) => {
  if (onboardingPausedFor !== id) return
  onboardingPausedFor = ''
  if (!currentOnboardingStep()) {
    onboarding.visible = false
    saveOnboarding()
    return
  }
  onboarding.visible = true
  pendingOnboardingFocus = true
  saveOnboarding()
}
const guideCard = () => {
  const step = onboarding.visible ? currentOnboardingStep() : null
  if (!step) return ''
  const position = Math.max(1, onboardingSteps.findIndex((entry) => entry.id === step.id) + 1)
  return `<div class="onboarding-layer"><div class="onboarding-scrim onboarding-scrim-top" aria-hidden="true"></div><div class="onboarding-scrim onboarding-scrim-right" aria-hidden="true"></div><div class="onboarding-scrim onboarding-scrim-bottom" aria-hidden="true"></div><div class="onboarding-scrim onboarding-scrim-left" aria-hidden="true"></div><div class="onboarding-target-ring" aria-hidden="true"></div><aside class="onboarding-card" role="dialog" aria-modal="true" aria-labelledby="onboarding-title" aria-live="polite"><div class="onboarding-card-head"><span>Guía inicial · ${position}/${onboardingSteps.length}</span><button type="button" class="onboarding-close" data-action="dismiss-onboarding" aria-label="Omitir guía">×</button></div><h2 id="onboarding-title">${step.title}</h2><p>${step.text}</p><div class="onboarding-actions"><button type="button" class="primary-action" data-action="focus-onboarding-control">Mostrar dónde hacerlo</button><button type="button" class="text-action" data-action="next-onboarding-step">Siguiente</button><button type="button" class="text-action" data-action="dismiss-onboarding">Omitir por ahora</button></div></aside></div>`
}

const arcaTenantId = () => `arca-${String(commerceContext?.commerce_id || '').toLowerCase()}`
const callArca = async (action, payload = {}) => {
  const session = authManager?.getSession()
  const cloud = store?.getCloudConnection()
  if (!session?.sessionToken || !cloud?.url || !commerceContext?.commerce_id) throw new Error('Inicia sesion como propietario para configurar ARCA.')
  const response = await fetch(`${String(cloud.url).replace(/\/$/, '')}/functions/v1/fiscal-gateway`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-operando-session': session.sessionToken },
    body: JSON.stringify({ action, tenantId: arcaTenantId(), ...payload }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result?.message || result?.error || `ARCA no respondio (${response.status})`)
  return result
}
const listPagination = {
  clientes: { page: 1, pageSize: 20 },
  ventas: { page: 1, pageSize: 20 },
  productos: { page: 1, pageSize: 20 },
  recepciones: { page: 1, pageSize: 20 },
  proveedores: { page: 1, pageSize: 20 },
  'stock-critico': { page: 1, pageSize: 20 },
}

const normalizeInstanceKey = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-') || 'operando-dev'
const createCommerceKey = (value) => String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || `comercio-${Date.now().toString().slice(-6)}`
const persistInstanceKey = (value) => {
  authInstanceKey = normalizeInstanceKey(value)
  safeStorage.setItem(instanceStorageKey, authInstanceKey)
  return authInstanceKey
}

const requestScrollTop = () => {
  pendingScrollTop = true
}

const flushScrollTop = () => {
  if (!pendingScrollTop) return
  pendingScrollTop = false
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    document.querySelector('.page')?.scrollTo?.({ top: 0, left: 0, behavior: 'auto' })
  })
}

const queueScrollToSelector = (selector) => {
  pendingScrollSelector = selector || ''
}

const flushPendingScrollTarget = () => {
  if (!pendingScrollSelector) return
  const selector = pendingScrollSelector
  pendingScrollSelector = ''
  requestAnimationFrame(() => {
    const element = document.querySelector(selector)
    const target = element?.closest?.('.panel') || element
    if (!target) return
    const page = document.querySelector('.page')
    if (page) {
      const pageRect = page.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      const nextTop = page.scrollTop + (targetRect.top - pageRect.top) - 18
      page.scrollTo({ top: Math.max(nextTop, 0), left: 0, behavior: 'smooth' })
    } else {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    const focusable = target.querySelector('input, select, textarea, button')
    window.setTimeout(() => {
      focusable?.focus?.({ preventScroll: true })
    }, 140)
  })
}

const loadCloudAccess = async (sessionPayload = null) => {
  if (!authManager) throw new Error('La conexion cloud no esta lista.')
  const currentSession = sessionPayload || authManager.getSession()
  if (!currentSession?.sessionToken) throw new Error('No hay sesion valida para sincronizar.')
  commerceContext = currentSession.commerceContext || null
  store.setCloudAccessToken(currentSession.sessionToken)
  const activeProfile = store.setCloudAuthSession(currentSession.profile, [])
  if (!activeProfile) {
    commerceContext = null
    store.clearCloudAuthSession()
    throw new Error('No se pudo activar la sesion del usuario.')
  }
  await store.syncFromCloud(activeProfile.isPlatformAdmin ? ['platform'] : ['dashboard'])
  store.setCloudAuthSession(currentSession.profile, [])
  startOperationalRealtime()
  return activeProfile
}

const formHasUnsavedChanges = (form) => Array.from(form.elements || []).some((field) => {
  if (field.disabled || field.type === 'button' || field.type === 'submit' || field.type === 'reset') return false
  if (field.type === 'file') return Boolean(field.files?.length)
  if (field instanceof HTMLSelectElement) return Array.from(field.options).some((option) => option.selected !== option.defaultSelected)
  if (field.type === 'checkbox' || field.type === 'radio') return field.checked !== field.defaultChecked
  return typeof field.value === 'string' && field.value !== field.defaultValue
})

const hasPendingOperationalForm = () => Boolean(
  saleFormOpen || cashFormOpen || productFormOpen || stockAdjustmentFormOpen || stockTransferFormOpen
  || supplierFormOpen || purchaseFormOpen || invoiceFormOpen || ticketFormOpen || branchFormOpen
  || registerFormOpen || customerFormOpen || invoicePaymentId
) || Array.from(document.forms).some(formHasUnsavedChanges)

const operationDomains = {
  app_public_create_sale: ['sales', 'cash', 'stock', 'customers', 'invoices', 'audit'],
  app_public_register_invoice_payment: ['sales', 'cash', 'customers', 'invoices', 'audit'],
  app_public_open_cash_session: ['cash', 'audit'],
  app_public_close_cash_session: ['cash', 'audit'],
  app_public_create_cash_movement: ['cash', 'audit'],
  app_public_upsert_product: ['products', 'stock', 'audit'],
  app_public_upsert_purchase_receipt: ['purchases', 'products', 'stock', 'suppliers', 'audit'],
  app_public_upsert_customer: ['customers', 'sales', 'audit'],
  app_public_upsert_supplier: ['suppliers', 'purchases', 'audit'],
  app_public_upsert_branch: ['branches', 'registers', 'audit'],
  app_public_upsert_register: ['registers', 'cash', 'audit'],
  app_public_upsert_document: ['invoices', 'tickets', 'audit'],
  app_public_update_commerce_profile: ['settings'],
  app_public_update_commerce_runtime: ['settings'],
  app_public_upsert_user: ['settings'],
  app_public_toggle_user_active: ['settings'],
  app_public_platform_update_commerce: ['platform'],
}

const sectionDomains = {
  dashboard: ['sales', 'cash', 'stock', 'customers', 'invoices', 'purchases', 'audit'],
  clientes: ['customers', 'sales'], ventas: ['sales', 'cash', 'stock', 'customers', 'invoices'], caja: ['cash', 'sales'],
  sucursales: ['branches'], cajeros: ['registers'], productos: ['products', 'stock'],
  compras: ['purchases', 'products', 'stock', 'suppliers'], facturacion: ['invoices', 'sales', 'customers'],
  tickets: ['tickets', 'sales', 'customers'], reportes: ['sales', 'cash', 'stock', 'purchases', 'invoices'], auditoria: ['audit', 'sales', 'cash', 'stock', 'purchases', 'products', 'invoices', 'settings'],
  ajustes: ['settings', 'branches', 'registers'], 'mi-admin': ['platform'],
}

const isCurrentSectionAffected = () => (sectionDomains[activeSection] || []).some((domain) => pendingOperationalDomains.has(domain))

const syncLiveData = async () => {
  if (liveSyncBusy || cloudSyncBusy || document.hidden || !store?.isAuthenticated?.() || hasPendingOperationalForm()) return
  liveSyncBusy = true
  try {
    const result = await store.syncFromCloud(sectionDomains[activeSection] || ['dashboard'])
    // No redibujamos mientras alguien está completando una operación: se evita
    // perder lo que escribió. Los datos sí quedan listos para mostrarse al cerrar el formulario.
    if (result?.ok) {
      pendingOperationalDomains.clear()
      render()
    }
  } catch {
    // Una falla momentánea de red no debe interrumpir la operación de caja.
  } finally {
    liveSyncBusy = false
  }
}

const queueLiveSync = () => {
  if (liveSyncDebounceTimer) window.clearTimeout(liveSyncDebounceTimer)
  liveSyncDebounceTimer = window.setTimeout(() => {
    liveSyncDebounceTimer = null
    void syncLiveData()
  }, 120)
}

const receiveOperationalChange = (payload = {}) => {
  const domains = operationDomains[payload.operation] || []
  domains.forEach((domain) => pendingOperationalDomains.add(domain))
  if (isCurrentSectionAffected()) queueLiveSync()
}

const stopOperationalRealtime = () => {
  if (liveSyncDebounceTimer) window.clearTimeout(liveSyncDebounceTimer)
  liveSyncDebounceTimer = null
  unsubscribeOperationalChanges?.()
  unsubscribeOperationalChanges = null
  if (operationalRealtimeClient && operationalRealtimeChannel) void operationalRealtimeClient.removeChannel(operationalRealtimeChannel)
  operationalRealtimeChannel = null
  operationalRealtimeClient = null
}

const startOperationalRealtime = () => {
  if (operationalRealtimeChannel || !store?.subscribeToOperationalChanges) return
  const cloud = store.getCloudConnection()
  const commerceId = String(commerceContext?.commerce_id || '').trim()
  if (!cloud?.url || !cloud?.anonKey || !commerceId) return

  operationalRealtimeClient = createSupabaseRealtimeClient(cloud.url, cloud.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  operationalRealtimeChannel = operationalRealtimeClient
    .channel(`commerce:${commerceId}:operations`, { config: { private: false, broadcast: { self: false, ack: false } } })
    .on('broadcast', { event: 'core_changed' }, (message) => receiveOperationalChange(message?.payload))
    .subscribe()

  unsubscribeOperationalChanges = store.subscribeToOperationalChanges((operation) => {
    if (!operationalRealtimeChannel) return
    void operationalRealtimeChannel.send({ type: 'broadcast', event: 'core_changed', payload: { operation } })
  })

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void syncLiveData()
  })
}

const money = (value) => currency.format(Number(value) || 0)
const balanceTone = (value) => Number(value || 0) > 0 ? 'balance-due' : 'balance-clear'
const balanceText = (value) => Number(value || 0) > 0 ? 'Debe' : 'Al dia'
const balanceBadge = (value) => `<span class="balance-badge ${balanceTone(value)}"><strong>${money(value)}</strong><small>${balanceText(value)}</small></span>`
const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')
const formatTicketUpdatedAt = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return 'Sin actualizaciones'
  const normalized = raw.replace(/(\.\d{3})\d+(?=[+-]\d{2}:\d{2}$)/, '$1')
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return escapeHtml(raw.replace('T', ' ').slice(0, 16))
  const day = date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')
  const time = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${day}<br /><small>${time}</small>`
}
const formatCashHistoryDate = (value, withTime = false) => {
  const raw = String(value || '').trim()
  if (!raw) return 'Sin fecha'
  const normalized = raw.replace(/(\.\d{3})\d+(?=[+-]\d{2}:\d{2}$)/, '$1')
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return escapeHtml(raw.replace('T', ' ').slice(0, withTime ? 16 : 10))
  const day = date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')
  if (!withTime) return day
  const time = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${day} · ${time}`
}
const maskEmail = (value) => {
  const email = String(value || '').trim().toLowerCase()
  if (!email || !email.includes('@')) return ''
  const [name, domain] = email.split('@')
  if (!name || !domain) return email
  if (name.length <= 2) return `${name[0] || '*'}***@${domain}`
  return `${name.slice(0, 2)}***${name.slice(-1)}@${domain}`
}
const getPublicAppBaseUrl = () => {
  const origin = String(window.location.origin || '').trim()
  if (!origin) return publicSiteUrl
  if (/localhost|127\.0\.0\.1/i.test(origin)) return publicSiteUrl
  return origin
}
const getRequestedPublicView = () => {
  try {
    const params = new URLSearchParams(window.location.search || '')
    const requested = String(params.get('view') || '').trim().toLowerCase()
    return requested === 'login' || requested === 'signup' ? requested : ''
  } catch {
    return ''
  }
}

const operandoEntry = String(window.__operandoEntry || '').trim().toLowerCase()
const isPanelRoute = () => /^\/(?:panel|app)(?:\/|$)/i.test(window.location.pathname || '')
const isStandaloneAppRoute = isPanelRoute
const isAuthRoute = () => /^\/(?:ingresar|crear-cuenta|recuperar-clave|restablecer-clave)(?:\/|$)/i.test(window.location.pathname || '')
const authModeFromPath = () => ({
  ingresar: 'login',
  'crear-cuenta': 'signup',
  'recuperar-clave': 'recovery',
  'restablecer-clave': 'reset',
})[String(window.location.pathname || '').replace(/^\/+|\/+$/g, '').split('/')[0].toLowerCase()] || ''
const appSectionPaths = { dashboard: '', clientes: 'clientes', ventas: 'ventas', caja: 'caja', productos: 'catalogo', compras: 'compras', facturacion: 'facturacion', tickets: 'servicios', reportes: 'informes', auditoria: 'actividad', ajustes: 'configuracion', 'mi-admin': 'consola', sucursales: 'sucursales', cajeros: 'cajeros' }
const legacySectionPaths = { 'caja-diaria': 'caja', productos: 'productos', tickets: 'tickets', reportes: 'reportes', auditoria: 'auditoria', ajustes: 'ajustes', 'mi-admin': 'mi-admin' }
const sectionFromPath = () => {
  const segment = String(window.location.pathname || '').replace(/^\/(?:panel|app)\/?/i, '').split('/')[0].toLowerCase()
  return Object.entries(appSectionPaths).find(([, path]) => path === segment)?.[0] || legacySectionPaths[segment] || 'dashboard'
}
const syncSectionPath = () => {
  if (!isPanelRoute()) return
  const target = appSectionPaths[activeSection] ? `/panel/${appSectionPaths[activeSection]}/` : '/panel/'
  if (window.location.pathname !== target) window.history.pushState({ section: activeSection }, '', target)
}
const canonicalizeLegacyPanelRoute = () => {
  if (operandoEntry !== 'legacy') return
  const legacySection = String(window.location.pathname || '').replace(/^\/app\/?/i, '').split('/')[0].toLowerCase()
  const section = legacySectionPaths[legacySection] || Object.entries(appSectionPaths).find(([, path]) => path === legacySection)?.[0] || 'dashboard'
  const target = appSectionPaths[section] ? `/panel/${appSectionPaths[section]}/` : '/panel/'
  window.history.replaceState({}, '', `${target}${window.location.search}${window.location.hash}`)
}
const canonicalizeRecoveryRoute = () => {
  const url = new URL(window.location.href)
  if (url.searchParams.get('auth_action') !== 'recover' || /^\/restablecer-clave\/?$/i.test(url.pathname)) return
  url.pathname = '/restablecer-clave/'
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}
const mapPublicAuthError = (message, context = 'login') => {
  const normalized = String(message || '').trim().toLowerCase()
  if (!normalized) return context === 'signup' ? 'No se pudo crear la cuenta.' : 'No se pudo iniciar sesion.'
  if (/failed to fetch|fetch failed|networkerror|network request failed|load failed/.test(normalized)) {
    return 'No pudimos comunicarnos con el sistema. Revisá tu conexión e intentá nuevamente en unos minutos.'
  }
  const rateLimit = normalized.match(/^login_rate_limited:(\d+)$/)
  if (rateLimit) {
    const minutes = Math.ceil(Number(rateLimit[1]) / 60)
    return `Por seguridad espera ${minutes} minuto${minutes === 1 ? '' : 's'} antes de volver a intentarlo.`
  }
  const messages = {
    user_not_found: 'No pudimos iniciar sesion. Revisa tus datos o recupera el acceso.',
    invalid_credentials: 'No pudimos iniciar sesion. Revisa tus datos o recupera el acceso.',
    access_denied: 'No pudimos iniciar sesion. Revisa tus datos o recupera el acceso.',
    security_not_configured: 'El acceso seguro todavia no esta configurado. Contacta a soporte.',
    turnstile_required: 'Completa la verificacion de seguridad antes de continuar.',
    turnstile_failed: 'La verificacion vencio o no pudo validarse. Completala nuevamente.',
    turnstile_unavailable: 'La verificacion de seguridad no esta disponible. Intenta de nuevo en unos minutos.',
    login_rate_limited: 'Por seguridad debes esperar unos minutos antes de volver a intentarlo.',
    invalid_pin: 'La clave no coincide. Pruebala de nuevo o recupera el acceso.',
    login_locked: 'Por seguridad bloqueamos el acceso durante 15 minutos después de 3 claves incorrectas. Puedes esperar y volver a intentarlo, o recuperar tu clave ahora.',
    owner_email_already_exists: 'Ya existe una cuenta con ese correo. Puedes entrar o recuperar la clave.',
    login_name_already_exists: 'Ese nombre de usuario ya está en uso. Elegí otro.',
    login_name_required: 'Escribí un nombre de usuario para continuar.',
    invalid_login_name: 'El usuario debe tener entre 3 y 32 caracteres y solo puede usar letras, números, punto, guion o guion bajo.',
    instance_already_initialized: 'Ese comercio ya existe. Inicia sesion con la cuenta principal.',
    instance_not_initialized: 'Ese acceso todavia no tiene una cuenta activa. Crea tu comercio o pide ayuda.',
    commerce_name_required: 'Escribe el nombre comercial para continuar.',
    owner_name_required: 'Escribe tu nombre para crear la cuenta.',
    owner_email_required: 'Escribe un correo valido para crear la cuenta.',
    owner_pin_too_short: 'La clave debe tener al menos 6 caracteres.',
    email_required: 'Escribe tu correo para continuar.',
    duplicate_key_value_violates_unique_constraint_control_users_email_key: 'Ya existe una cuenta con ese correo. Entra o recupera el acceso.',
    password_confirmation_mismatch: 'Las claves nuevas no coinciden.',
    recovery_session_missing: 'El enlace de recuperacion ya no es valido. Pide uno nuevo.',
    'password should be at least 6 characters.': 'La clave debe tener al menos 6 caracteres.',
    password_too_short: 'La clave debe tener al menos 6 caracteres.',
    'sell item required': 'Agrega al menos un producto antes de registrar la venta.',
    sell_item_required: 'Agrega al menos un producto antes de registrar la venta.',
    'sale item required': 'Agrega al menos un producto antes de registrar la venta.',
    sale_item_required: 'Agrega al menos un producto antes de registrar la venta.',
    sale_items_required: 'Agrega al menos un producto antes de registrar la venta.',
    cash_session_required: 'Caja cerrada. Abri una caja para poder registrar la venta.',
    'duplicate key value violates unique constraint "products_commerce_id_sku_key"': 'Ya existe un producto con ese SKU en este comercio.',
    'duplicate key value violates unique constraint "documents_commerce_id_document_number_key"': 'Ese numero de comprobante ya existe. Usa otro o dejalo vacio para autogenerarlo.',
    'column "status" of relation "branches" does not exist': 'Estamos terminando una actualizacion interna del alta. Escribe a soporte y lo habilitamos enseguida.',
    'column "status" of relation "registers" does not exist': 'Estamos terminando una actualizacion interna del alta. Escribe a soporte y lo habilitamos enseguida.',
  }
  const remainingMatch = normalized.match(/^invalid_pin_attempts_remaining_(\d+)$/)
  if (remainingMatch) {
    const remaining = Number(remainingMatch[1])
    return `La clave no coincide. Te queda${remaining === 1 ? '' : 'n'} ${remaining} intento${remaining === 1 ? '' : 's'} antes del bloqueo temporal. Si no la recuerdas, puedes recuperar tu clave.`
  }
  return messages[normalized] || (context === 'signup'
    ? 'No se pudo crear la cuenta. Revisá los datos e intentá nuevamente.'
    : 'No se pudo completar la operación. Revisá los datos e intentá nuevamente.')
}

const mapInvoicePaymentError = (message) => {
  const normalized = String(message || '').trim().toLowerCase()
  if (normalized.includes('invalid_payment_amount')) return 'No se registró el abono porque el importe debe ser mayor a $0 y no puede superar el saldo pendiente de esta factura. Revisá el monto e intentá otra vez.'
  if (normalized.includes('invoice_not_found')) return 'No se registró el abono porque no encontramos la factura seleccionada. Actualizá la pantalla e intentá otra vez.'
  if (normalized.includes('invalid_payment_method')) return 'No se registró el abono porque el medio de pago seleccionado no es válido. Elegí uno de la lista e intentá otra vez.'
  if (normalized.includes('cash_session_required')) return 'No se registró el abono en efectivo porque la caja está cerrada. Abrí la caja de esta sucursal e intentá otra vez.'
  if (normalized.includes('echeq_number_required')) return 'No se registró el abono porque falta el número de e-cheq.'
  if (normalized.includes('permission_denied')) return 'No se registró el abono porque tu usuario no tiene permiso para cobrar facturas.'
  return `No se pudo registrar el abono. ${message || 'Revisá la conexión e intentá otra vez.'}`
}
const applyTheme = () => { document.documentElement.dataset.theme = theme }
const markBootComplete = () => {
  window.__operandoBooted = true
  document.body?.removeAttribute('data-booting')
  preloadSite?.setAttribute('hidden', 'hidden')
  bootStatus?.remove()
}
const saveSection = () => safeStorage.setItem(sectionStorageKey, activeSection)
const resetBrokenBrowserState = () => {
  safeStorage.removeItem(dataStorageKey)
  safeStorage.removeItem(cloudConfigStorageKey)
}
const byRecentDate = (items, key) => items.slice().sort((a, b) => String(b[key]).localeCompare(String(a[key])))
const isWithinDateRange = (value, from, to) => {
  const normalized = String(value || '').slice(0, 10)
  if (!normalized) return false
  if (from && normalized < from) return false
  if (to && normalized > to) return false
  return true
}
const csvEscape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
const bulkProductColumns = ['Nombre', 'SKU', 'Codigo de barras', 'Stock inicial', 'Precio de venta', 'Costo', 'Stock minimo', 'Categoria', 'Controlar stock']
const normalizeImportHeader = (value) => String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
const parseDelimitedRows = (content, delimiter) => { const rows = []; let row = []; let cell = ''; let quoted = false; for (let index = 0; index < content.length; index += 1) { const character = content[index]; if (character === '"') { if (quoted && content[index + 1] === '"') { cell += '"'; index += 1 } else quoted = !quoted } else if (character === delimiter && !quoted) { row.push(cell.trim()); cell = '' } else if ((character === '\n' || character === '\r') && !quoted) { if (character === '\r' && content[index + 1] === '\n') index += 1; row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = '' } else cell += character } row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); return rows }
const downloadBulkProductTemplate = () => { const csv = `\ufeff${[bulkProductColumns, Array(bulkProductColumns.length).fill('')].map((row) => row.map(csvEscape).join(';')).join('\r\n')}`; const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'plantilla-productos-operando.csv'; link.click(); URL.revokeObjectURL(url) }
const importBulkProductsFile = async (event) => {
  const file = event.target.files?.[0]; if (!file) return
  try {
    if (!/\.(csv|txt)$/i.test(file.name)) throw new Error('Usa la plantilla descargada desde aqui en formato CSV compatible con Excel.')
    const content = (await file.text()).replace(/^\ufeff/, ''); const delimiter = content.split(/\r?\n/, 1)[0].includes(';') ? ';' : ','; const [headers = [], ...dataRows] = parseDelimitedRows(content, delimiter); const headerIndexes = Object.fromEntries(headers.map((header, index) => [normalizeImportHeader(header), index])); const valueAt = (row, ...names) => { const index = names.map(normalizeImportHeader).map((name) => headerIndexes[name]).find((entry) => entry !== undefined); return index === undefined ? '' : String(row[index] || '').trim() }
    if (headerIndexes.nombre === undefined || headerIndexes.sku === undefined || headerIndexes.preciodeventa === undefined) throw new Error('La planilla debe conservar las columnas Nombre, SKU y Precio de venta de la plantilla.')
    const errors = []; const rows = dataRows.map((row, index) => { const name = valueAt(row, 'nombre'); const sku = valueAt(row, 'sku'); const salePrice = valueAt(row, 'precio de venta'); if (!name && !sku && !salePrice) return null; if (!name || !sku || salePrice === '') errors.push(index + 2); const trackStock = valueAt(row, 'controlar stock').toLowerCase(); return { name, sku, barcode: valueAt(row, 'codigo de barras'), stock: valueAt(row, 'stock inicial') || 0, salePrice: salePrice || 0, costPrice: valueAt(row, 'costo') || 0, minStock: valueAt(row, 'stock minimo') || 0, category: valueAt(row, 'categoria') || 'General', trackStock: !['no', 'false', '0'].includes(trackStock) } }).filter(Boolean)
    if (!rows.length) throw new Error('La planilla no tiene productos para importar.'); if (errors.length) throw new Error(`Completa Nombre, SKU y Precio de venta en las filas: ${errors.join(', ')}.`); const result = await store.importProducts(rows, 'create-only'); feedbackMessage = result.message || ''
  } catch (error) { feedbackMessage = error.message || 'No se pudo importar la planilla.' } finally { event.target.value = ''; render() }
}
const readCurrentSaleQuantities = () => Object.fromEntries(
  [...document.querySelectorAll('input[name^="qty_"]')]
    .map((input) => [input.name.replace('qty_', ''), Number(input.value || 0)])
    .filter(([, quantity]) => quantity > 0),
)

const stockMovementTypeLabel = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  const labels = {
    adjustment_in: 'Ajuste de ingreso',
    adjustment_out: 'Ajuste de salida',
    transfer_in: 'Transferencia recibida',
    transfer_out: 'Transferencia enviada',
    purchase: 'Compra recibida',
    sale: 'Salida por venta',
    return_in: 'Devolucion recibida',
    return_out: 'Devolucion entregada',
    opening: 'Stock inicial',
  }
  return labels[normalized] || (value || 'Movimiento')
}

const cashMovementKindLabel = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  const labels = {
    income: 'Ingreso',
    expense: 'Gasto',
    withdrawal: 'Retiro',
    deposit: 'Deposito',
    adjustment: 'Ajuste',
    opening: 'Apertura',
    closing: 'Cierre',
    sale: 'Cobro de venta',
  }
  return labels[normalized] || (value || 'Movimiento')
}

const dataTable = (headers, rows, className = '') => `
  <div class="${`data-table ${className}`.trim()}">
    <div class="data-head">${headers.map((header) => `<span>${header}</span>`).join('')}</div>
    ${rows.length ? rows.join('') : '<div class="data-empty">No hay registros todavia.</div>'}
  </div>
`

const inventoryTable = (rows) => `
  <div class="inventory-table">
    <div class="inventory-head">
      <span>Producto</span>
      <span>Codigo</span>
      <span>Stock suc.</span>
      <span>Total</span>
      <span>Precio</span>
      <span>Accion</span>
    </div>
    ${rows.length ? rows.join('') : '<div class="data-empty">No hay productos cargados todavia.</div>'}
  </div>
`

const normalizeUserPermissionSet = (snapshot, entry = {}) => {
  const rolePermissions = snapshot.roles.find((role) => role.id === entry.roleId)?.permissions || []
  const blocked = new Set(Array.isArray(entry.blockedPermissions) ? entry.blockedPermissions : [])
  return rolePermissions.filter((permission) => !blocked.has(permission))
}

const modulePermissionMap = {
  dashboard: 'dashboard:view',
  customers: 'customers:view',
  sales: 'sales:view',
  cash: 'cash:view',
  branches: 'branches:view',
  registers: 'registers:view',
  products: 'products:view',
  purchases: 'purchases:view',
  invoices: 'invoices:view',
  tickets: 'tickets:view',
  reports: 'reports:view',
  audit: 'audit:view',
  settings: 'settings:view',
}

const isAdministratorAccount = (snapshot, entry = {}, fallbackRoleId = '') => {
  const roleId = entry.roleId || fallbackRoleId
  const roleKey = snapshot.roles.find((role) => role.id === roleId)?.key
  return Boolean(entry.isPlatformAdmin || entry.isOwner || roleKey === 'admin')
}

const normalizeUserModuleScope = (snapshot, entry = {}, fallbackRoleId = '') => {
  const isAdministrator = isAdministratorAccount(snapshot, entry, fallbackRoleId)
  const businessModules = Array.isArray(snapshot.business?.enabledModules) ? [...snapshot.business.enabledModules] : []
  if (isAdministrator) {
    if (!businessModules.includes('dashboard')) businessModules.unshift('dashboard')
    if (!businessModules.includes('audit')) businessModules.push('audit')
    if (!businessModules.includes('settings')) businessModules.push('settings')
  }
  const overrides = Array.isArray(entry.allowedModules) ? entry.allowedModules.filter(Boolean) : []
  if (overrides.length) {
    const scopedModules = businessModules.filter((moduleKey) => overrides.includes(moduleKey))
    if (isAdministrator) {
      if (!scopedModules.includes('dashboard')) scopedModules.unshift('dashboard')
      if (!scopedModules.includes('audit')) scopedModules.push('audit')
      if (!scopedModules.includes('settings')) scopedModules.push('settings')
    }
    if (scopedModules.length) return isAdministrator ? scopedModules : scopedModules.filter((moduleKey) => moduleKey !== 'settings')
  }
  const roleId = entry.roleId || fallbackRoleId
  if (!roleId) return isAdministrator ? businessModules : businessModules.filter((moduleKey) => moduleKey !== 'settings')
  const rolePermissions = snapshot.roles.find((role) => role.id === roleId)?.permissions || []
  const roleModules = businessModules.filter((moduleKey) => rolePermissions.includes(modulePermissionMap[moduleKey]))
  const effectiveModules = roleModules.length ? roleModules : businessModules
  return isAdministrator ? effectiveModules : effectiveModules.filter((moduleKey) => moduleKey !== 'settings')
}

const permissionLabelMap = {
  'customers:write': 'Editar clientes',
  'sales:write': 'Registrar ventas',
  'cash:operate': 'Operar caja',
  'branches:manage': 'Gestionar sucursales',
  'registers:manage': 'Gestionar cajas',
  'products:write': 'Editar productos',
  'products:adjust': 'Ajustar stock',
  'products:transfer': 'Transferir stock',
  'purchases:write': 'Registrar compras',
  'invoices:write': 'Emitir comprobantes',
  'tickets:write': 'Gestionar tickets',
  'reports:export': 'Exportar reportes',
  'settings:manage': 'Administrar usuarios y modulos',
}

const renderUserScopeSelector = (ui, editingUser, canManageUsers) => {
  const fallbackRoleId = editingUser?.roleId || userDraftRoleId || 'role-cashier'
  const isAdministrator = isAdministratorAccount(ui.snapshot, editingUser || {}, fallbackRoleId)
  const selectedModules = new Set(normalizeUserModuleScope(ui.snapshot, editingUser, fallbackRoleId))
  const blockedPermissions = new Set(Array.isArray(editingUser?.blockedPermissions) ? editingUser.blockedPermissions : [])
  const configurableModules = Object.values(ui.moduleCatalog).filter((module) => (
    module.key !== 'settings' && (!isAdministrator || module.key !== 'dashboard')
  ))
  return `
    <div class="full-span permission-scope-block">
      <div class="panel-note"><strong>Modulos visibles</strong><span>Elige las pantallas que esta cuenta puede usar.</span></div>
      ${isAdministrator ? '<div class="info-strip"><strong>Accesos fijos</strong><span>Inicio y Ajustes siempre estan disponibles para administradores.</span></div>' : ''}
      <div class="permission-option-grid module-option-grid">
        ${configurableModules.map((module) => `<label class="permission-option ${selectedModules.has(module.key) ? 'is-active' : ''}"><input type="checkbox" name="allowedModules" value="${module.key}" ${selectedModules.has(module.key) ? 'checked' : ''} ${canManageUsers ? '' : 'disabled'} /><span><strong>${module.name}</strong><small>${selectedModules.has(module.key) ? 'Visible' : 'Oculto'}</small></span></label>`).join('')}
      </div>
    </div>
    <div class="full-span permission-scope-block">
      <div class="panel-note"><strong>Permisos de accion</strong><span>Marca solamente las acciones que este usuario no debe realizar.</span></div>
      <div class="permission-option-grid action-option-grid">
        ${Object.entries(permissionLabelMap).map(([permission, label]) => `<label class="permission-option ${blockedPermissions.has(permission) ? 'is-blocked' : 'is-active'}"><input type="checkbox" name="blockedPermissions" value="${permission}" ${blockedPermissions.has(permission) ? 'checked' : ''} ${canManageUsers ? '' : 'disabled'} /><span><strong>${label}</strong><small>${blockedPermissions.has(permission) ? 'Bloqueada' : 'Permitida'}</small></span></label>`).join('')}
      </div>
    </div>
  `
}

const actionButton = (entity, id) => `<button type="button" class="inline-action" data-delete="${entity}" data-id="${id}">Eliminar</button>`
const rowActionsMenu = (label, actions, variant = '') => `
  <details class="row-more-menu${variant ? ` ${variant}` : ''}">
    <summary aria-label="${label}" title="${label}"><span aria-hidden="true">&#8942;</span></summary>
    <div class="row-more-popover">${actions}</div>
  </details>
`
const createToggleButton = (key, isOpen, label = 'Agregar') => `<button type="button" class="add-action${isOpen ? ' is-open' : ''}" data-action="${isOpen ? `close-${key}-form` : `open-${key}-form`}" aria-label="${isOpen ? 'Cerrar' : label}"><span class="add-action-icon" aria-hidden="true">${isOpen ? '&times;' : '+'}</span><span>${isOpen ? 'Cerrar' : label}</span></button>`
const closeProductUtilityForms = () => {
  productFormOpen = false
  stockAdjustmentFormOpen = false
  stockTransferFormOpen = false
}
const closePurchaseUtilityForms = () => {
  supplierFormOpen = false
  purchaseFormOpen = false
  purchaseEditingId = ''
  purchaseDraftItems = {}
  purchaseQuickAddCode = ''
  purchaseSupplierSearch = ''
}
const closeStructureUtilityForms = () => {
  branchFormOpen = false
  registerFormOpen = false
  branchEditingId = ''
  registerEditingId = ''
}
const closeDocumentUtilityForms = () => {
  invoiceFormOpen = false
  invoicePaymentId = ''
  ticketFormOpen = false
  invoiceEditingId = ''
  ticketEditingId = ''
}
const saleActionButtons = (sale) => rowActionsMenu('Acciones de venta', `
    <button type="button" class="inline-action is-strong" data-sale-action="edit" data-id="${sale.id}">Editar</button>
    <button type="button" class="inline-action" data-sale-action="invoice" data-id="${sale.id}">Factura</button>
    <button type="button" class="inline-action" data-sale-action="ticket" data-id="${sale.id}">Ticket</button>
    <button type="button" class="inline-action" data-sale-action="receipt-80" data-id="${sale.id}">Ticket 80 mm</button>
    <button type="button" class="inline-action" data-sale-action="receipt-58" data-id="${sale.id}">Ticket 58 mm</button>
    <button type="button" class="inline-action" data-sale-action="export" data-id="${sale.id}">Exportar</button>
    <button type="button" class="inline-action" data-sale-action="return" data-id="${sale.id}">Devolver</button>
    <button type="button" class="inline-action" data-sale-action="cancel" data-id="${sale.id}">Anular</button>
    <button type="button" class="inline-action danger sale-delete-action" data-delete="sale" data-id="${sale.id}">Eliminar venta</button>
  `, 'row-more-menu--sales')
const purchaseActionButtons = (receipt) => rowActionsMenu('Acciones de recepción', `
    <button type="button" class="inline-action" data-purchase-action="edit" data-id="${receipt.id}">Editar</button>
    <button type="button" class="inline-action danger" data-delete="purchase_receipt" data-id="${receipt.id}">Eliminar</button>
  `)
const invoiceActionButtons = (invoice) => rowActionsMenu('Acciones de comprobante', `
    <button type="button" class="inline-action is-strong" data-invoice-action="pay" data-id="${invoice.id}" ${invoiceBalance(invoice) <= 0 ? 'disabled' : ''}>Abonar</button>
    <button type="button" class="inline-action" data-invoice-action="view" data-id="${invoice.id}">Ver</button>
    <button type="button" class="inline-action" data-invoice-action="print" data-id="${invoice.id}">Imprimir</button>
    <button type="button" class="inline-action danger" data-delete="invoice" data-id="${invoice.id}">Eliminar</button>
  `)

const invoiceEmissionLabel = (invoice) => invoice.fiscalStatus === 'Interno' ? 'Interno · no fiscal' : 'ARCA'
const invoiceBalance = (invoice) => Math.max(0, Number(invoice?.totalAmount || 0) - Number(invoice?.amountPaid || 0))
const ticketActionButtons = (ticket) => rowActionsMenu('Acciones de ticket', `
    <button type="button" class="inline-action" data-ticket-action="edit" data-id="${ticket.id}">Editar</button>
    <button type="button" class="inline-action danger" data-delete="ticket" data-id="${ticket.id}">Eliminar</button>
  `)
const branchActionButtons = (branch) => `
  <div class="inline-action-group">
    <button type="button" class="inline-action" data-branch-action="select" data-id="${branch.id}">Usar</button>
    <button type="button" class="inline-action" data-branch-action="edit" data-id="${branch.id}">Editar</button>
    <button type="button" class="inline-action danger" data-branch-action="delete" data-id="${branch.id}">Eliminar</button>
  </div>
`
const registerActionButtons = (register) => `
  <button type="button" class="inline-action" data-register-action="edit" data-id="${register.id}">Editar</button>
  <button type="button" class="inline-action danger" data-delete="register" data-id="${register.id}">Eliminar</button>
`
const userActionButtons = (user) => `
  <div class="inline-action-group">
    <button type="button" class="inline-action" data-user-action="edit" data-id="${user.id}">Editar</button>
    <button type="button" class="inline-action" data-user-action="toggle" data-id="${user.id}" data-active="${user.isActive ? 'true' : 'false'}">${user.isActive ? 'Desactivar' : 'Activar'}</button>
  </div>
`
const planLabels = {
  basic: 'Gestion base',
  retail: 'Mostrador',
  full: 'Operacion',
  multi: 'Multi sucursal',
  custom: 'Personalizado',
}

const scannerInputSelector = {
  sales: 'input[name="quickAddCode"]',
  products: 'input[name="barcode"]',
}

const focusScannerInput = (targetKey) => {
  const input = document.querySelector(scannerInputSelector[targetKey] || '')
  if (!input) return false
  input.focus()
  input.select?.()
  return true
}

const routeHardwareScan = (rawValue) => {
  const scanned = String(rawValue || '').trim()
  if (!scanned) return false
  if (activeSection === 'ventas') {
    const product = store.findProductByCode(scanned)
    if (!product) {
      feedbackMessage = 'No encontre un producto con ese codigo.'
      render()
      return true
    }
    saleDraftQuantities = {
      ...readCurrentSaleQuantities(),
      [product.id]: Number(readCurrentSaleQuantities()[product.id] || 0) + 1,
    }
    saleQuickAddCode = ''
    feedbackMessage = ''
    render()
    return true
  }
  if (activeSection === 'productos') {
    const barcodeInput = document.querySelector(scannerInputSelector.products)
    if (!barcodeInput) return false
    barcodeInput.value = scanned
    barcodeInput.dispatchEvent(new Event('input', { bubbles: true }))
    feedbackMessage = 'Codigo de barras capturado.'
    return true
  }
  return false
}

const clearHardwareScanBuffer = () => {
  hardwareScanBuffer = ''
  if (hardwareScanTimer) {
    clearTimeout(hardwareScanTimer)
    hardwareScanTimer = null
  }
}

const queueHardwareScanCharacter = (char) => {
  if (!char) return
  hardwareScanBuffer += char
  if (hardwareScanTimer) clearTimeout(hardwareScanTimer)
  hardwareScanTimer = window.setTimeout(() => {
    clearHardwareScanBuffer()
  }, 180)
}

const bindHardwareScanner = () => {
  if (hardwareScanListenerBound) return
  document.addEventListener('keydown', (event) => {
    if (!['ventas', 'productos'].includes(activeSection)) return
    const target = event.target
    const isEditable = target instanceof HTMLElement && (
      target.tagName === 'INPUT'
      || target.tagName === 'TEXTAREA'
      || target.tagName === 'SELECT'
      || target.isContentEditable
    )
    if (isEditable) return
    if (event.key === 'Enter') {
      if (hardwareScanBuffer) {
        event.preventDefault()
        const scannedCode = hardwareScanBuffer
        clearHardwareScanBuffer()
        routeHardwareScan(scannedCode)
      }
      return
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      queueHardwareScanCharacter(event.key)
    }
  })
  hardwareScanListenerBound = true
}
const planCatalog = {
  basic: {
    name: 'Gestion base',
    description: 'Para el cliente que quiere empezar simple con proveedores, productos y facturacion.',
    idealFor: 'Prueba inicial, servicio tecnico o gestion sin mostrador.',
    modules: ['products', 'purchases', 'invoices'],
  },
  retail: {
    name: 'Mostrador',
    description: 'Para un local con una sola caja y venta diaria sin abrumar con sucursales.',
    idealFor: 'Negocio chico con una caja.',
    modules: ['customers', 'sales', 'cash', 'products', 'invoices'],
  },
  full: {
    name: 'Operacion',
    description: 'Suma compras, reportes y control operativo para un comercio que ya trabaja a diario.',
    idealFor: 'Comercio estable con stock y seguimiento.',
    modules: ['customers', 'sales', 'cash', 'products', 'purchases', 'invoices', 'reports'],
  },
  multi: {
    name: 'Multi sucursal',
    description: 'Habilita toda la estructura para varias cajas, sucursales, tickets y reportes completos.',
    idealFor: 'Locales con crecimiento o varias cajas.',
    modules: Object.keys({
      dashboard: true,
      customers: true,
      sales: true,
      cash: true,
      branches: true,
      registers: true,
      products: true,
      purchases: true,
      invoices: true,
      tickets: true,
      reports: true,
      settings: true,
    }),
  },
}
const getInitials = (name) => String(name || '')
  .split(' ')
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0]?.toUpperCase() || '')
  .join('') || 'PC'
const getScopedStock = (product, branchId) => {
  const branchStock = product?.stockByBranch && typeof product.stockByBranch === 'object' ? product.stockByBranch : null
  if (branchId && branchStock) return Number(branchStock[branchId] || 0)
  return Number(product?.stock || 0)
}
const buildQuickSearchTargets = (ui) => {
  const normalizedEntries = []
  const pushTarget = (section, label, keywords = []) => {
    normalizedEntries.push({
      section,
      label,
      search: [label, ...keywords].filter(Boolean).join(' ').toLowerCase(),
    })
  }
  for (const item of getAllowedNav(ui)) pushTarget(item.id, item.label, [item.moduleKey])
  for (const customer of ui.snapshot.customers) pushTarget('clientes', customer.fullName, [customer.email, customer.phone, customer.tag])
  for (const product of ui.snapshot.products) pushTarget('productos', product.name, [product.sku, product.barcode, product.category])
  for (const supplier of ui.snapshot.suppliers) pushTarget('compras', supplier.name, [supplier.contact, supplier.phone, supplier.category])
  for (const invoice of ui.snapshot.invoices) pushTarget('facturacion', invoice.number, [invoice.kind, invoice.type, invoice.status])
  for (const ticket of ui.snapshot.tickets) pushTarget('tickets', ticket.number, [ticket.device, ticket.issue, ticket.status])
  for (const branch of ui.snapshot.branches) pushTarget('ajustes', branch.name, [branch.code, branch.address, 'sucursales'])
  for (const register of ui.snapshot.registers) pushTarget('ajustes', register.name, [register.code, 'puestos de cobro', 'cajas'])
  return normalizedEntries
}
const clearFeedbackSoon = () => {
  if (feedbackTimer) window.clearTimeout(feedbackTimer)
  if (!feedbackMessage) return
  const currentMessage = feedbackMessage
  feedbackTimer = window.setTimeout(() => {
    if (feedbackMessage !== currentMessage) return
    feedbackMessage = ''
    document.querySelectorAll('.feedback-banner').forEach((banner) => banner.remove())
  }, 2800)
}
const getAllowedNav = (ui) => navItems.filter((item) => (
  (ui.user?.isPlatformAdmin
    ? item.platformOnly
    : store.canAccessModule(item.moduleKey, item.permission))
  && (!item.ownerOnly || ui.user?.isOwner)
  && (!item.platformOnly || ui.user?.isPlatformAdmin)
))

const getUiState = () => {
  const snapshot = store.getSnapshot()
  const storedProgressiveProfile = snapshot.business.progressiveProfile || {}
  const progressiveProfile = {
    country: storedProgressiveProfile.country || commerceContext?.onboarding_country || '', industry: storedProgressiveProfile.industry || commerceContext?.onboarding_industry || '', phone: storedProgressiveProfile.phone || commerceContext?.onboarding_phone || '', email: storedProgressiveProfile.email || commerceContext?.onboarding_email || commerceContext?.owner_email || '',
    needsArca: storedProgressiveProfile.needsArca ?? commerceContext?.onboarding_needs_arca ?? null,
    operationalGoals: Array.isArray(storedProgressiveProfile.operationalGoals) && storedProgressiveProfile.operationalGoals.length ? storedProgressiveProfile.operationalGoals : (Array.isArray(commerceContext?.onboarding_goals) ? commerceContext.onboarding_goals : []),
    status: commerceContext?.onboarding_status || storedProgressiveProfile.status || 'pending',
  }
  const user = snapshot.users.find((entry) => entry.id === snapshot.session.userId) || snapshot.users[0]
  const role = snapshot.roles.find((entry) => entry.id === user?.roleId) || snapshot.roles[0]
  const customerMap = new Map(snapshot.customers.map((item) => [item.id, item]))
  const userMap = new Map(snapshot.users.map((item) => [item.id, item]))
  const supplierMap = new Map(snapshot.suppliers.map((item) => [item.id, item]))
  const branchMap = new Map(snapshot.branches.map((item) => [item.id, item]))
  const activeRegisters = snapshot.registers.filter((register) => register.isActive !== false)
  const registerMap = new Map(activeRegisters.map((item) => [item.id, item]))
  const openCashSession = snapshot.cashSessions.find((session) => session.status === 'open') || null
  const cashSales = snapshot.sales.filter((sale) => sale.cashSessionId === openCashSession?.id && sale.paymentMethod === 'cash')
  const cashSalesTotal = cashSales.reduce((sum, sale) => sum + sale.amountPaid, 0)
  const currentBranch = branchMap.get(snapshot.business.currentBranchId) || snapshot.branches[0]
  const currentRegister = registerMap.get(snapshot.business.currentRegisterId) || activeRegisters.find((register) => register.branchId === currentBranch?.id) || null
  const branchRegisters = activeRegisters.filter((register) => register.branchId === currentBranch?.id)
  const scopedProducts = snapshot.products.map((product) => ({
    ...product,
    scopedStock: getScopedStock(product, currentBranch?.id),
    totalStock: Number(product.stock || 0),
  }))
  const productMap = new Map(scopedProducts.map((item) => [item.id, item]))
  const scopedSales = snapshot.sales.filter((sale) => sale.branchId === currentBranch?.id && (reportRegisterFilter === 'all' || sale.registerId === reportRegisterFilter))
  const scopedInvoices = snapshot.invoices.filter((invoice) => invoice.branchId === currentBranch?.id)
  const scopedTickets = snapshot.tickets.filter((ticket) => ticket.branchId === currentBranch?.id)
  const scopedReceipts = snapshot.purchaseReceipts.filter((receipt) => {
    const product = productMap.get(receipt.productId)
    return !product?.branchId || product.branchId === currentBranch?.id || reportRegisterFilter === 'all'
  })
  const scopedCashSessions = snapshot.cashSessions.filter((session) => session.branchId === currentBranch?.id && (reportRegisterFilter === 'all' || session.registerId === reportRegisterFilter))
  const scopedCashMovements = snapshot.cashMovements.filter((movement) => movement.branchId === currentBranch?.id && (reportRegisterFilter === 'all' || movement.registerId === reportRegisterFilter))
  const salesById = new Map(snapshot.sales.map((sale) => [sale.id, sale]))
  const scopedStockMovements = snapshot.stockMovements.filter((movement) => {
    if (movement.branchId && movement.branchId !== currentBranch?.id) return false
    const sale = salesById.get(movement.referenceId)
    if (sale && reportRegisterFilter !== 'all') return sale.registerId === reportRegisterFilter
    return reportRegisterFilter === 'all' || !movement.registerId || movement.registerId === reportRegisterFilter
  })
  const sessionCashMovementTotal = openCashSession ? snapshot.cashMovements.filter((movement) => movement.cashSessionId === openCashSession.id).reduce((sum, movement) => sum + Number(movement.signedAmount || 0), 0) : 0

  const enrichedSales = byRecentDate(snapshot.sales, 'soldAt').map((sale) => ({
    ...sale,
    customerName: customerMap.get(sale.customerId)?.fullName || 'Mostrador',
    itemSummary: sale.items.map((item) => `${productMap.get(item.productId)?.name || 'Articulo'} x${item.quantity}`).join(', '),
    branchName: branchMap.get(sale.branchId)?.name || 'Sucursal',
    registerName: registerMap.get(sale.registerId)?.name || 'Sin caja',
    paymentSummary: sale.paymentMethod === 'mixed'
      ? `Mixto: Ef ${money(sale.paymentBreakdown?.cash || 0)} / Tr ${money(sale.paymentBreakdown?.transfer || 0)} / MP ${money(sale.paymentBreakdown?.mercadoPago || 0)}`
      : sale.paymentMethod,
  }))
  const filteredSales = byRecentDate(enrichedSales.filter((sale) => sale.branchId === currentBranch?.id && (reportRegisterFilter === 'all' || sale.registerId === reportRegisterFilter)), 'soldAt')
  const reportScopedSales = filteredSales.filter((sale) => isWithinDateRange(sale.soldAt, reportDateFrom, reportDateTo))
  const enrichedInvoices = byRecentDate(scopedInvoices, 'dueDate').map((invoice) => ({ ...invoice, customerName: customerMap.get(invoice.customerId)?.fullName || 'Consumidor final', branchName: branchMap.get(invoice.branchId)?.name || 'Sucursal' }))
  const enrichedTickets = byRecentDate(scopedTickets, 'updatedAt').map((ticket) => ({ ...ticket, customerName: customerMap.get(ticket.customerId)?.fullName || 'Sin cliente', branchName: branchMap.get(ticket.branchId)?.name || 'Sucursal' }))
  const enrichedScopedReceipts = byRecentDate(scopedReceipts, 'receivedAt').map((receipt) => ({
    ...receipt,
    supplierName: supplierMap.get(receipt.supplierId)?.name || 'Proveedor',
    productName: productMap.get(receipt.productId)?.name || 'Producto',
  }))
  const reportScopedInvoices = enrichedInvoices.filter((invoice) => isWithinDateRange(invoice.dueDate, reportDateFrom, reportDateTo))
  const reportScopedTickets = enrichedTickets.filter((ticket) => isWithinDateRange(ticket.updatedAt, reportDateFrom, reportDateTo))
  const reportScopedReceipts = enrichedScopedReceipts.filter((receipt) => isWithinDateRange(receipt.receivedAt, reportDateFrom, reportDateTo))
  const reportScopedCashMovements = scopedCashMovements.filter((movement) => isWithinDateRange(movement.createdAt, reportDateFrom, reportDateTo))
  const reportScopedStockMovements = scopedStockMovements.filter((movement) => isWithinDateRange(movement.createdAt, reportDateFrom, reportDateTo))
  const enrichedUsers = snapshot.users.map((entry) => {
    const effectiveModules = normalizeUserModuleScope(snapshot, entry, entry.roleId)
    return {
      ...entry,
      roleName: snapshot.roles.find((roleEntry) => roleEntry.id === entry.roleId)?.name || 'Sin rol',
      moduleScopeCount: effectiveModules.length,
      blockedPermissionsCount: Array.isArray(entry.blockedPermissions) ? entry.blockedPermissions.length : 0,
      effectiveModules,
      effectivePermissions: normalizeUserPermissionSet(snapshot, entry),
    }
  })
  const auditModuleByEntity = {
    sale: ['sales', 'cash', 'stock'], cash_movement: ['cash'], cash_session: ['cash'],
    product: ['products', 'stock'], stock_movement: ['stock', 'products'], stock_adjustment: ['stock', 'products'], stock_transfer: ['stock', 'products'],
    purchase_receipt: ['purchases', 'products', 'stock'], supplier: ['purchases'], customer: ['customers'],
    invoice: ['invoices', 'sales'], ticket: ['tickets'], document: ['invoices'], branch: ['settings'], register: ['settings', 'cash'],
    user: ['settings'], user_assignment: ['settings'], business: ['settings'], business_module: ['settings'], business_plan: ['settings'], session: ['settings'], system: ['settings'],
  }
  const auditModuleLabels = { sales: 'Ventas', cash: 'Caja', stock: 'Stock', products: 'Productos', purchases: 'Compras', customers: 'Clientes', invoices: 'Facturación', tickets: 'Tickets', settings: 'Configuración' }
  const auditEntityLabels = { sale: 'venta', cash_movement: 'movimiento de caja', cash_session: 'sesión de caja', product: 'producto', stock_movement: 'movimiento de stock', stock_adjustment: 'ajuste de stock', stock_transfer: 'transferencia de stock', purchase_receipt: 'ingreso de mercadería', supplier: 'proveedor', customer: 'cliente', invoice: 'factura', ticket: 'ticket', document: 'comprobante', branch: 'sucursal', register: 'caja', user: 'usuario', user_assignment: 'acceso de usuario', business: 'comercio', business_module: 'módulo', business_plan: 'plan', session: 'sesión', system: 'sistema' }
  let enrichedAudit = byRecentDate(snapshot.auditLogs, 'createdAt').map((log) => {
    const afterData = log.afterData || log.after_data || {}
    const beforeData = log.beforeData || log.before_data || {}
    const documentKind = afterData.kind || beforeData.kind
    const modules = log.entityType === 'document' && documentKind === 'ticket' ? ['tickets'] : (auditModuleByEntity[log.entityType] || ['settings'])
    const entityLabel = log.entityType === 'user_assignment' && (afterData.assigned_user_name || beforeData.assigned_user_name) ? `acceso de ${afterData.assigned_user_name || beforeData.assigned_user_name}` : (log.entityType === 'document' ? (documentKind === 'ticket' ? 'ticket' : (documentKind === 'factura' ? 'factura' : 'comprobante')) : (auditEntityLabels[log.entityType] || log.entityType || 'registro'))
    return { ...log, afterData, beforeData, actorName: userMap.get(log.actorUserId)?.fullName || 'Sistema', modules, moduleLabel: auditModuleLabels[modules[0]], entityLabel }
  })
  const auditedEntities = new Set(enrichedAudit.map((entry) => `${entry.entityType}:${entry.entityId}`))
  const inferredAudit = [
    ...filteredSales.map((sale) => ({ entityType: 'sale', entityId: sale.id, createdAt: sale.soldAt, actorUserId: sale.createdBy, afterData: sale })),
    ...scopedCashMovements.map((movement) => ({ entityType: 'cash_movement', entityId: movement.id, createdAt: movement.createdAt, actorUserId: movement.createdBy, afterData: movement })),
    ...scopedStockMovements.map((movement) => ({ entityType: 'stock_movement', entityId: movement.id, createdAt: movement.createdAt, actorUserId: movement.createdBy, afterData: movement })),
    ...enrichedScopedReceipts.map((receipt) => ({ entityType: 'purchase_receipt', entityId: receipt.id, createdAt: receipt.receivedAt, actorUserId: receipt.createdBy, afterData: receipt })),
    ...enrichedInvoices.map((invoice) => ({ entityType: 'invoice', entityId: invoice.id, createdAt: invoice.issuedAt || invoice.dueDate, actorUserId: invoice.createdBy, afterData: invoice })),
    ...enrichedTickets.map((ticket) => ({ entityType: 'ticket', entityId: ticket.id, createdAt: ticket.updatedAt, actorUserId: ticket.createdBy, afterData: ticket })),
  ].filter((entry) => entry.entityId && entry.createdAt && !auditedEntities.has(`${entry.entityType}:${entry.entityId}`)).map((entry) => {
    const modules = auditModuleByEntity[entry.entityType] || ['settings']
    return { ...entry, id: `inferred-${entry.entityType}-${entry.entityId}`, action: 'registered', actorName: userMap.get(entry.actorUserId)?.fullName || 'Sistema', modules, moduleLabel: auditModuleLabels[modules[0]], entityLabel: auditEntityLabels[entry.entityType] || 'registro' }
  })
  enrichedAudit = byRecentDate([...enrichedAudit, ...inferredAudit], 'createdAt')
  const auditActionLabels = {
    created: 'Creó un registro',
    updated: 'Actualizó un registro',
    deleted: 'Eliminó un registro',
    cancelled: 'Anuló una operación',
    returned: 'Registró una devolución',
    opened: 'Abrió una sesión',
    closed: 'Cerró una sesión',
    signed_in: 'Inició sesión',
    signed_out: 'Cerró sesión',
    assigned: 'Asignó un usuario',
    unassigned: 'Quitó un usuario',
    enabled: 'Habilitó una opción',
    disabled: 'Deshabilitó una opción',
  }
  const recentCommerceActivity = [
    ...filteredSales.map((sale) => ({ id: `sale-${sale.id}`, module: 'sales', createdAt: sale.soldAt, title: 'Venta registrada', detail: `${sale.customerName} · ${money(sale.totalAmount)}` })),
    ...enrichedScopedReceipts.map((receipt) => ({ id: `receipt-${receipt.id}`, module: 'purchases', createdAt: receipt.receivedAt, title: 'Ingreso de mercadería', detail: `${receipt.productName} · ${receipt.supplierName}` })),
    ...scopedCashMovements.map((movement) => ({ id: `cash-${movement.id}`, module: 'cash', createdAt: movement.createdAt, title: `Movimiento de caja · ${movement.kind === 'expense' ? 'Egreso' : 'Ingreso'}`, detail: movement.note || money(Math.abs(Number(movement.signedAmount || movement.amount || 0))) })),
    ...scopedStockMovements.map((movement) => ({ id: `stock-${movement.id}`, module: 'stock', createdAt: movement.createdAt, title: 'Movimiento de stock', detail: `${productMap.get(movement.productId)?.name || 'Producto'} · ${Number(movement.quantity || 0) > 0 ? '+' : ''}${movement.quantity || 0}` })),
    ...enrichedAudit
      .filter((log) => !['sale', 'purchase_receipt', 'cash_movement', 'stock_adjustment', 'stock_transfer'].includes(log.entityType))
      .map((log) => ({ id: `audit-${log.id}`, module: log.modules[0] || 'settings', createdAt: log.createdAt, title: auditActionLabels[log.action] || 'Actividad registrada', detail: `${log.actorName} · ${log.entityType}` })),
  ].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 50)

  return {
    snapshot,
    moduleCatalog: store.moduleCatalog,
    modulePresets: store.modulePresets,
    user,
    role,
    commerceContext,
    progressiveProfile,
    platformAdmin: store.getPlatformAdminData?.() || null,
    cloudConnection: store.getCloudConnection(),
    isAuthenticated: store.isAuthenticated(),
    openCashSession,
    cashSalesTotal,
    sessionCashMovementTotal,
    expectedCash: openCashSession ? Number(openCashSession.openingAmount) + cashSalesTotal + sessionCashMovementTotal : 0,
    unpaidSales: scopedSales.reduce((sum, sale) => sum + Math.max(0, Number(sale.totalAmount || 0) - Number(sale.amountPaid || 0)), 0),
    totalSales: scopedSales.reduce((sum, sale) => sum + sale.totalAmount, 0),
    pendingInvoices: scopedInvoices.filter((invoice) => invoice.status !== 'Cobrada').reduce((sum, invoice) => sum + invoice.totalAmount, 0),
    scopedProducts,
    lowStock: scopedProducts.filter((product) => product.trackStock && product.scopedStock <= product.minStock),
    topProducts: [...scopedSales.reduce((map, sale) => {
      for (const item of sale.items) {
        const key = productMap.get(item.productId)?.name || 'Sin producto'
        map.set(key, (map.get(key) || 0) + item.quantity)
      }
      return map
    }, new Map()).entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    enrichedSales: filteredSales,
    enrichedInvoices,
    enrichedTickets,
    enrichedAudit,
    auditModuleLabels,
    recentCommerceActivity,
    enrichedUsers,
    enrichedReceipts: byRecentDate(snapshot.purchaseReceipts, 'receivedAt').map((receipt) => ({
      ...receipt,
      supplierName: supplierMap.get(receipt.supplierId)?.name || 'Proveedor',
      productName: productMap.get(receipt.productId)?.name || 'Producto',
    })),
    currentBranch,
    currentRegister,
    branchRegisters,
    scopedCashSessions,
    scopedStockMovements,
    scopedCashMovements,
    reportDateFrom,
    reportDateTo,
    reportScopedSales,
    reportScopedInvoices,
    reportScopedTickets,
    reportScopedReceipts,
    reportScopedCashMovements,
    reportScopedStockMovements,
    enrichedRegisters: activeRegisters.map((register) => ({
      ...register,
      branchName: branchMap.get(register.branchId)?.name || 'Sucursal',
      cashierName: userMap.get(register.cashierUserId)?.fullName || 'Sin asignar',
    })),
    enrichedCashMovements: byRecentDate(scopedCashMovements, 'createdAt').map((movement) => ({
      ...movement,
      registerName: registerMap.get(movement.registerId)?.name || 'Caja',
      actorName: userMap.get(movement.createdBy)?.fullName || 'Usuario',
    })),
  }
}

const standaloneAuthView = (ui) => {
  const mode = recoveryState ? 'reset' : (authModeFromPath() || authViewMode)
  const content = mode === 'login' ? `
    <div class="auth-heading"><p class="kicker">Acceso seguro</p><h1 id="auth-title">Entrá a tu operación</h1><p>Ingresá con tus datos para abrir el panel de tu comercio.</p></div>
    <form class="login-form" data-form="login" autocomplete="on">
      <label>Correo o usuario<input type="text" name="identifier" placeholder="nombre@comercio.com" autocomplete="username" autocapitalize="off" spellcheck="false" required /></label>
      <div class="auth-field-row"><label>Clave<input type="password" name="pin" placeholder="Tu clave" autocomplete="current-password" required /></label><a class="auth-inline-link" href="/recuperar-clave/">¿Olvidaste tu clave?</a></div>
      ${window.__operandoTurnstileSiteKey ? `<div class="turnstile-container" data-sitekey="${window.__operandoTurnstileSiteKey}"></div>` : ''}
      ${loginMessage ? `<p class="login-error" role="alert">${loginMessage}</p>` : ''}
      <button type="submit">Ingresar al panel</button>
    </form>
    <p class="auth-route-note">¿Todavía no usás Operando? <a href="/crear-cuenta/">Crear cuenta</a></p>`
    : mode === 'signup' ? `
      <div class="auth-heading"><p class="kicker">Empezá ahora</p><h1 id="auth-title">Creá tu cuenta</h1><p>Configurá tu comercio y empezá a trabajar desde el panel.</p></div>
      <form class="login-form compact-signup-form" data-form="instance-setup" autocomplete="on">
        <div class="login-form-grid-1"><label>Nombre comercial<input type="text" name="commerceName" placeholder="Mi comercio" autocomplete="organization" required /></label><label>Tu nombre<input type="text" name="ownerName" placeholder="Nombre del responsable" autocomplete="name" required /></label><label>Email<input type="email" name="ownerEmail" placeholder="tu@email.com" autocomplete="email" autocapitalize="off" spellcheck="false" required /></label><label>Clave<input type="password" name="ownerPin" placeholder="Mínimo 6 caracteres" autocomplete="new-password" required /></label></div>
        <input type="hidden" name="instanceKey" value="" /><input type="hidden" name="ownerLogin" value="" /><input type="hidden" name="branchName" value="Casa central" /><input type="hidden" name="branchCode" value="CASA" /><input type="hidden" name="registerName" value="Caja 1" /><input type="hidden" name="registerCode" value="CAJA-01" />
        ${signupMessage ? `<p class="login-error" role="alert">${signupMessage}</p>` : ''}<button type="submit">Crear cuenta y abrir el panel</button>
      </form><p class="auth-route-note">¿Ya tenés cuenta? <a href="/ingresar/">Ingresar</a></p>`
    : mode === 'recovery' ? `
      <div class="auth-heading"><p class="kicker">Recuperar acceso</p><h1 id="auth-title">Volvé a entrar</h1><p>Escribí tu correo y te enviaremos un enlace seguro para crear una clave nueva.</p></div>
      <form class="login-form" data-form="access-recovery" autocomplete="on"><label>Correo electrónico<input type="email" name="email" placeholder="nombre@comercio.com" autocomplete="email" autocapitalize="off" spellcheck="false" required /></label>${window.__operandoTurnstileSiteKey ? `<div class="turnstile-container" data-sitekey="${window.__operandoTurnstileSiteKey}"></div>` : ''}${loginMessage ? `<p class="login-error" role="alert">${loginMessage}</p>` : ''}<button type="submit">Enviar enlace de recuperación</button></form><p class="auth-route-note"><a href="/ingresar/">Volver a ingresar</a></p>`
    : mode === 'reset' && recoveryState ? `
      <div class="auth-heading"><p class="kicker">Restablecer clave</p><h1 id="auth-title">Creá una clave nueva</h1><p>Vas a recuperar el acceso de ${maskEmail(recoveryState.email) || 'tu cuenta'}.</p></div>
      <form class="login-form" data-form="password-recovery" autocomplete="off"><label>Nueva clave<input type="password" name="password" placeholder="Mínimo 6 caracteres" autocomplete="new-password" required /></label><label>Repetir nueva clave<input type="password" name="passwordConfirm" placeholder="Repetí la nueva clave" autocomplete="new-password" required /></label>${loginMessage ? `<p class="login-error" role="alert">${loginMessage}</p>` : ''}<button type="submit">Guardar nueva clave</button></form>`
    : `<div class="auth-heading"><p class="kicker">Enlace de recuperación</p><h1 id="auth-title">Este enlace ya no está disponible</h1><p>Por seguridad, los enlaces de recuperación vencen rápido y solo se pueden usar una vez.</p></div><a class="auth-primary-link" href="/recuperar-clave/">Pedir un enlace nuevo</a><p class="auth-route-note"><a href="/ingresar/">Volver a ingresar</a></p>`
  return `<div class="login-shell auth-standalone-shell"><main class="auth-standalone" aria-labelledby="auth-title"><a class="auth-back-link" href="/">← Volver al sitio</a><section class="login-card auth-standalone-card"><div class="auth-brand"><img src="/operando-logo.png?v=operando-20260831" alt="Operando" /><div><strong>Operando</strong><span>Gestión comercial online</span></div></div>${content}</section><p class="auth-support">¿Necesitás ayuda? <button type="button" class="auth-text-action" data-action="open-support">Hablar con soporte</button></p></main></div>`
}

const paginateList = (items, listKey) => {
  const pagination = listPagination[listKey]
  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pagination.pageSize))
  pagination.page = Math.min(Math.max(1, pagination.page), totalPages)
  const startIndex = (pagination.page - 1) * pagination.pageSize
  const endIndex = Math.min(startIndex + pagination.pageSize, totalItems)
  return {
    items: items.slice(startIndex, endIndex),
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalItems,
    totalPages,
    startIndex,
    endIndex,
  }
}

const paginationControls = (listKey, pageData) => `
  <div class="list-pagination" aria-label="Paginacion de registros">
    <span class="pagination-count">${pageData.totalItems ? `${pageData.startIndex + 1}-${pageData.endIndex} de ${pageData.totalItems}` : '0 registros'}</span>
    <label class="pagination-size">Mostrar
      <select data-page-size="${listKey}" aria-label="Registros por pagina">
        ${pageSizeOptions.map((size) => `<option value="${size}" ${pageData.pageSize === size ? 'selected' : ''}>${size}</option>`).join('')}
      </select>
    </label>
    <div class="pagination-actions">
      <button type="button" class="ghost-action" data-page-list="${listKey}" data-page-action="previous" ${pageData.page <= 1 ? 'disabled' : ''}>Anterior</button>
      <span>Pagina ${pageData.page} de ${pageData.totalPages}</span>
      <button type="button" class="ghost-action" data-page-list="${listKey}" data-page-action="next" ${pageData.page >= pageData.totalPages ? 'disabled' : ''}>Siguiente</button>
    </div>
  </div>
`

const paginatedDataTable = (headers, items, listKey, rowTemplate, className = '') => {
  const pageData = paginateList(items, listKey)
  return `${dataTable(headers, pageData.items.map(rowTemplate), className)}${paginationControls(listKey, pageData)}`
}

const paginatedInventoryTable = (items, listKey, rowTemplate) => {
  const pageData = paginateList(items, listKey)
  return `${inventoryTable(pageData.items.map(rowTemplate))}${paginationControls(listKey, pageData)}`
}

const paginatedCardList = (items, listKey, rowTemplate) => {
  const pageData = paginateList(items, listKey)
  return `${pageData.items.length ? pageData.items.map(rowTemplate).join('') : '<p class="empty-state">No hay registros todavia.</p>'}${paginationControls(listKey, pageData)}`
}

const loginView = (ui) => {
  if ((window.__operandoAppEntry || isStandaloneAppRoute()) && authViewMode === 'landing') authViewMode = 'login'
  if (recoveryState) {
    authViewMode = 'reset'
    return standaloneAuthView(ui)
  }

  if (authViewMode === 'login' || authViewMode === 'signup' || authViewMode === 'recovery' || authViewMode === 'reset' || isAuthRoute()) return standaloneAuthView(ui)

  return `
  <div class="login-shell login-shell-home">
    <div class="public-home">
      <header class="public-topbar">
        <div class="public-topbar-brand">
          <img class="public-topbar-logo" src="/operando-logo.png?v=operando-20260831" alt="Operando" />
          <div class="public-topbar-copy">
            <strong>${productName}</strong>
            <span>Control comercial online</span>
          </div>
        </div>
        <div class="public-topbar-actions">
          <button type="button" class="ghost-action topbar-auth-button" data-action="show-login">Iniciar sesion</button>
          <button type="button" class="primary-action topbar-auth-button" data-action="show-signup">Crear cuenta</button>
        </div>
        ${authViewMode !== 'landing' ? `
        <div class="public-auth-popover">
          ${authViewMode === 'login' ? `
          <div class="login-card compact-auth-card" id="acceso-login">
            <p class="kicker">${ui.cloudConnection.enabled ? 'Ingreso al sistema' : 'Acceso temporalmente bloqueado'}</p>
            <h2>Entrar</h2>
            <p class="login-copy">Ingresa con tu correo y tu clave para seguir trabajando.</p>
            <form class="login-form" data-form="login" autocomplete="off">
              <label>Usuario o email<input type="text" name="identifier" value="" placeholder="tu usuario" autocomplete="username" autocapitalize="off" spellcheck="false" required /></label>
              <label>Clave<input type="password" name="pin" value="" placeholder="Tu clave" autocomplete="current-password" required /></label>
              ${window.__operandoTurnstileSiteKey ? `<div class="turnstile-container" data-sitekey="${window.__operandoTurnstileSiteKey}"></div>` : ''}
              ${loginMessage ? `<p class="login-error">${loginMessage}</p>` : ''}
              <button type="submit">Ingresar</button>
            </form>
            <div class="login-actions">
              <button type="button" class="ghost-action" data-action="recover-password">Recuperar clave</button>
              <button type="button" class="ghost-action" data-action="back-landing">Cerrar</button>
            </div>
          </div>
          ` : ''}
          ${authViewMode === 'signup' ? `
          <div class="login-card compact-auth-card login-card-secondary" id="acceso-signup">
            <p class="kicker">Prueba gratis</p>
            <h2>Crear cuenta</h2>
            <p class="login-copy">Crea tu acceso principal y empieza a usar el sistema en minutos.</p>
            <form class="login-form compact-signup-form" data-form="instance-setup" autocomplete="off">
              <div class="login-form-grid-1">
                <label>Nombre comercial<input type="text" name="commerceName" value="" placeholder="Mi comercio" autocomplete="organization" required /></label>
                <label>Tu nombre<input type="text" name="ownerName" value="" placeholder="Nombre del responsable" autocomplete="name" required /></label>
                <label>Email<input type="email" name="ownerEmail" value="" placeholder="tu@email.com" autocomplete="email" autocapitalize="off" spellcheck="false" required /></label>
                <label>Clave<input type="password" name="ownerPin" value="" placeholder="Minimo 6 caracteres" autocomplete="new-password" required /></label>
              </div>
              <input type="hidden" name="instanceKey" value="" />
              <input type="hidden" name="ownerLogin" value="" />
              <input type="hidden" name="branchName" value="Casa central" />
              <input type="hidden" name="branchCode" value="CASA" />
              <input type="hidden" name="registerName" value="Caja 1" />
              <input type="hidden" name="registerCode" value="CAJA-01" />
              ${signupMessage ? `<p class="login-error">${signupMessage}</p>` : ''}
              <button type="submit">Crear cuenta y empezar</button>
            </form>
            <div class="login-actions">
              <button type="button" class="ghost-action" data-action="back-landing">Cerrar</button>
            </div>
          </div>
          ` : ''}
        </div>
        ` : ''}
      </header>
      <section class="public-hero">
        <div class="public-hero-copy">
          <p class="kicker">Sistema de ventas, caja y stock</p>
          <h1>${productName}</h1>
          <p class="login-copy login-copy-hero">Software de gestion comercial para kioscos, tiendas, locales y negocios que necesitan vender, cobrar, controlar stock, clientes, compras y comprobantes desde una sola web.</p>
          ${feedbackMessage ? `<div class="feedback-banner">${feedbackMessage}</div>` : ''}
          <div class="login-badges">
            <span class="login-badge ${ui.cloudConnection.enabled ? 'is-ok' : 'is-warn'}">${ui.cloudConnection.enabled ? 'Base online activa' : 'Activacion pendiente'}</span>
            <span class="login-badge">Ventas y caja</span>
            <span class="login-badge">Stock y clientes</span>
            <span class="login-badge">Comprobantes</span>
          </div>
          <div class="landing-seo-block">
            <p>operando.app funciona como punto de venta web con control de caja, productos, inventario, clientes, proveedores, tickets y facturacion para comercios que quieren operar desde PC o celular sin instalar programas complejos.</p>
            <p>Empieza simple para no abrumar al cliente y despues crece con usuarios, permisos, sucursales, varias cajas y reportes segun la necesidad real del negocio.</p>
          </div>
          <div class="login-actions landing-primary-actions">
            <button type="button" class="primary-action hero-action" data-action="show-signup">Probar gratis</button>
            <button type="button" class="ghost-action hero-action" data-action="show-login">Ya tengo cuenta</button>
          </div>
          <div class="landing-proof-grid">
            <article class="landing-proof-card"><strong>100% web</strong><span>Acceso online desde PC, notebook o celular.</span></article>
            <article class="landing-proof-card"><strong>Ventas y caja</strong><span>Cobros, apertura, cierre y arqueo en una sola pantalla.</span></article>
            <article class="landing-proof-card"><strong>Stock real</strong><span>Productos, compras, ajustes y transferencias por sucursal.</span></article>
            <article class="landing-proof-card"><strong>Listo para crecer</strong><span>Usuarios, permisos, comprobantes y reportes comerciales.</span></article>
          </div>
          <div class="landing-sector-strip">
            <strong>Ideal para</strong>
            <div class="landing-sector-chips">
              <span class="landing-sector-chip">Kioscos</span>
              <span class="landing-sector-chip">Locales de barrio</span>
              <span class="landing-sector-chip">Tiendas</span>
              <span class="landing-sector-chip">Servicios tecnicos</span>
              <span class="landing-sector-chip">Comercios con una o varias cajas</span>
            </div>
          </div>
          <div class="public-feature-grid">
            <article class="landing-feature-card"><strong>Vende y cobra rapido</strong><span>Ventas multi item, medios de pago, caja y comprobantes desde una operacion clara.</span></article>
            <article class="landing-feature-card"><strong>Controla mercaderia sin enredos</strong><span>Catalogo, stock por sucursal, compras, proveedores y lector de codigo para trabajar mas rapido.</span></article>
            <article class="landing-feature-card"><strong>Ordena tu negocio y no solo una caja</strong><span>Clientes, usuarios, permisos, tickets, reportes y base cloud pensada para crecer sin rehacer el sistema.</span></article>
          </div>
          <div class="landing-contact compact-contact">
            <div>
              <strong>Implementacion y soporte directo</strong>
              <span>Te ayudamos a activar tu comercio, probar la app y empezar a usarla por WhatsApp.</span>
            </div>
            <button type="button" class="ghost-action" data-action="open-support">Hablar con soporte</button>
          </div>
        </div>
      </section>
    </div>
  </div>
`
}
const loginViewV2 = (ui) => `
  <div class="login-shell login-shell-home">
    <div class="login-grid">
      <section class="login-overview">
        <div class="login-overview-card">
          <div class="login-brand-row">
            <img class="login-logo login-logo-large" src="/operando-logo.png?v=operando-20260831" alt="Operando" />
            <div class="login-brand-copy">
              <p class="kicker">Sistema de gestion comercial</p>
              <h1>${productName}</h1>
            </div>
          </div>
          <p class="login-copy login-copy-hero">Un sistema comercial web para vender, cobrar, controlar stock y ordenar el negocio desde un solo lugar, sin instalar nada y con acceso desde PC o celular.</p>
          <div class="login-badges">
            <span class="login-badge">Ventas</span>
            <span class="login-badge">Caja</span>
            <span class="login-badge">Stock</span>
            <span class="login-badge">Comprobantes</span>
          </div>
          <div class="login-seo-copy">
            <p>operando.app es un software de gestion comercial para kioscos, locales, tiendas y negocios que necesitan vender, cobrar, ordenar stock y emitir comprobantes desde la web.</p>
            <p>La herramienta arranca simple para no abrumar y despues puede crecer con usuarios, cajas, sucursales y modulos segun el tipo de comercio.</p>
          </div>
          <div class="login-hero-note">
            <strong>Entra si ya tenes cuenta.</strong>
            <span>Si es tu primera vez, crea tu cuenta y empeza a probar.</span>
          </div>
          <div class="landing-feature-stack">
            <article class="landing-feature-card">
              <strong>Operacion diaria simple</strong>
              <span>Ventas, caja y cobros con una vista clara y lista para trabajar.</span>
            </article>
            <article class="landing-feature-card">
              <strong>Control de stock real</strong>
              <span>Productos, ingresos, ajustes y orden para cada comercio.</span>
            </article>
            <article class="landing-feature-card">
              <strong>Listo para crecer</strong>
              <span>Usuarios, permisos, reportes y soporte comercial cuando lo necesites.</span>
            </article>
          </div>
          <div class="landing-contact">
            <div>
              <strong>Contacto Operando</strong>
              <span>Consultas comerciales, implementacion y soporte por WhatsApp</span>
            </div>
            <button type="button" class="ghost-action" data-action="open-support">Hablar con soporte</button>
          </div>
          <div class="login-actions login-cta-row">
            <button type="button" class="primary-action hero-action" data-action="show-login">Iniciar sesion</button>
            <button type="button" class="ghost-action hero-action" data-action="show-signup">Crear cuenta</button>
          </div>
        </div>
      </section>
      <section class="login-side ${authViewMode === 'landing' ? 'is-hidden' : ''}">
        ${authViewMode === 'login' ? `
        <div class="login-card">
          <p class="kicker">${ui.cloudConnection.enabled ? 'Ingreso al sistema' : 'Acceso temporalmente bloqueado'}</p>
          <h2>Entrar</h2>
          <p class="login-copy">Ingresa con tu correo y tu clave para volver a tu panel.</p>
          <form class="login-form" data-form="login" autocomplete="off">
            <label>Usuario o email<input type="text" name="identifier" value="" placeholder="tu usuario" autocomplete="username" autocapitalize="off" spellcheck="false" data-lpignore="true" required /></label>
            <label>Clave<input type="password" name="pin" placeholder="Tu clave" autocomplete="current-password" required /></label>
            <input type="hidden" name="instanceKey" value="${ui.cloudConnection.environment === 'development' ? (ui.cloudConnection.instanceKey || 'operando-dev') : ''}" />
            ${window.__operandoTurnstileSiteKey ? `<div class="turnstile-container" data-sitekey="${window.__operandoTurnstileSiteKey}"></div>` : ''}
            <p class="login-hints">Si no recuerdas tu clave, puedes pedir recuperacion o hablar con soporte.</p>
            ${loginMessage ? `<p class="login-error">${loginMessage}</p>` : ''}
            <button type="submit">Ingresar</button>
          </form>
          <div class="login-actions">
            <button type="button" class="ghost-action" data-action="recover-password">Recuperar acceso</button>
            <button type="button" class="ghost-action" data-action="back-landing">Volver</button>
            <button type="button" class="ghost-action" data-action="open-support">Necesito ayuda</button>
          </div>
        </div>
        ` : ''}
        ${authViewMode === 'signup' ? `
        <div class="login-card login-card-secondary">
          <p class="kicker">Prueba gratis</p>
          <h2>Crear cuenta</h2>
          <p class="login-copy">Completa tus datos y se crea tu comercio con acceso administrador para empezar a usarlo en minutos.</p>
          <form class="login-form compact-signup-form" data-form="instance-setup" autocomplete="off">
            <div class="login-form-grid-1">
              <label>Nombre comercial<input type="text" name="commerceName" value="" placeholder="Mi comercio" autocomplete="organization" required /></label>
              <label>Tu nombre<input type="text" name="ownerName" value="" placeholder="Nombre del responsable" autocomplete="name" required /></label>
              <label>Email<input type="email" name="ownerEmail" value="" placeholder="tu@email.com" autocomplete="email" autocapitalize="off" spellcheck="false" required /></label>
              <label>Clave<input type="password" name="ownerPin" value="" placeholder="Minimo 6 caracteres" autocomplete="new-password" required /></label>
            </div>
            <input type="hidden" name="instanceKey" value="" />
            <input type="hidden" name="ownerLogin" value="" />
            <input type="hidden" name="branchName" value="Casa central" />
            <input type="hidden" name="branchCode" value="CASA" />
            <input type="hidden" name="registerName" value="Caja 1" />
            <input type="hidden" name="registerCode" value="CAJA-01" />
            <div class="login-inline-note">
              <strong>Alta automatica</strong>
              <span>Se crea tu comercio, tu usuario administrador y la primera caja para arrancar sin pasos tecnicos.</span>
            </div>
            ${signupMessage ? `<p class="login-error">${signupMessage}</p>` : ''}
            <button type="submit">Crear cuenta y empezar</button>
          </form>
          <div class="login-actions">
            <button type="button" class="ghost-action" data-action="back-landing">Volver</button>
            <button type="button" class="ghost-action" data-action="open-support">Hablar con soporte</button>
          </div>
        </div>
        ` : ''}
      </section>
    </div>
  </div>
`

const setupView = (ui) => `
  <div class="login-shell">
    <div class="login-card login-card-wide">
      <img class="login-logo" src="/operando-logo.png?v=operando-20260831" alt="Operando" />
      <p class="kicker">Alta inicial</p>
      <h1>${productName}</h1>
      <p class="login-copy">Completa tus datos y dejamos listo tu comercio con una cuenta administradora para empezar a trabajar sin configuraciones raras.</p>
      <form class="login-form compact-signup-form" data-form="instance-setup" autocomplete="off">
        <div class="login-form-grid-1">
          <label>Nombre comercial<input type="text" name="commerceName" value="" placeholder="Mi comercio" autocomplete="organization" required /></label>
          <label>Tu nombre<input type="text" name="ownerName" value="" placeholder="Nombre del responsable" autocomplete="name" required /></label>
          <label>Email<input type="email" name="ownerEmail" value="" placeholder="tu@email.com" autocomplete="email" autocapitalize="off" spellcheck="false" required /></label>
          <label>Clave<input type="password" name="ownerPin" value="" placeholder="Minimo 6 caracteres" autocomplete="new-password" required /></label>
        </div>
        <input type="hidden" name="instanceKey" value="" />
        <input type="hidden" name="ownerLogin" value="" />
        <input type="hidden" name="branchName" value="Casa central" />
        <input type="hidden" name="branchCode" value="CASA" />
        <input type="hidden" name="registerName" value="Caja 1" />
        <input type="hidden" name="registerCode" value="CAJA-01" />
        <div class="login-inline-note">
          <strong>Alta automatica</strong>
          <span>Se crea tu cuenta principal y una caja inicial lista para arrancar.</span>
        </div>
        ${loginMessage ? `<p class="login-error">${loginMessage}</p>` : ''}
        <button type="submit">Crear cuenta y empezar</button>
      </form>
      <div class="login-actions">
        <button type="button" class="ghost-action" data-action="back-landing">Volver</button>
        <button type="button" class="ghost-action" data-action="open-support">Hablar con soporte</button>
      </div>
    </div>
  </div>
`

const cloudActivationView = (ui) => `
  <div class="login-shell">
    <div class="login-card login-card-wide">
      <img class="login-logo" src="/operando-logo.png?v=operando-20260831" alt="Operando" />
      <p class="kicker">Activacion requerida</p>
      <h1>${productName}</h1>
      <p class="login-copy">Esta instalacion necesita la base cloud conectada antes de permitir ingresos o pruebas con clientes.</p>
      <div class="info-strip"><strong>Base obligatoria</strong><span>Sin conexion activa la app queda bloqueada para evitar pruebas falsas o datos perdidos.</span></div>
      <form class="login-form" data-form="cloud-connection">
        <div class="login-form-grid-2">
          <label>URL Supabase<input type="url" name="url" value="${ui.cloudConnection.url || defaultSupabaseUrl}" placeholder="https://xxxx.supabase.co" required /></label>
          <label>Clave publica<input type="text" name="anonKey" value="${ui.cloudConnection.anonKey || ''}" placeholder="sb_publishable_xxx o anon key" required /></label>
          <label class="full-span">Instancia<input type="text" name="instanceKey" value="${ui.cloudConnection.instanceKey || 'operando-dev'}" placeholder="operando-dev" required /></label>
        </div>
        <button type="submit">Activar base</button>
      </form>
      ${feedbackMessage ? `<div class="feedback-banner">${feedbackMessage}</div>` : ''}
      <div class="login-actions">
        <button type="button" class="ghost-action" data-action="open-support">Necesito asistencia</button>
      </div>
    </div>
  </div>
`

const progressiveSuggestion = (profile) => {
  if (profile.needsArca === true) return 'Podemos guiarte para preparar la facturación ARCA cuando estés listo.'
  const labels = { vender: 'agilizar ventas', stock: 'ordenar el stock', caja: 'organizar la caja', clientes: 'gestionar clientes', facturacion: 'emitir comprobantes', sucursales: 'preparar sucursales' }
  const firstGoal = (profile.operationalGoals || []).find((goal) => labels[goal])
  return firstGoal ? `Sugerencia inicial: ${labels[firstGoal]}.` : 'Podés seguir operando y completar este perfil cuando te resulte útil.'
}

const dashboardView = (ui) => `
  <section class="view-section">
    <div class="section-header"><div><p class="kicker">Resumen diario</p><h2>Operacion del local</h2></div><div class="panel-inline-stats section-inline-stats dashboard-inline-stats">
      <span class="panel-inline-stat"><strong>${money(ui.totalSales)}</strong><span>Ventas</span></span>
      <span class="panel-inline-stat"><strong>${money(ui.unpaidSales)}</strong><span>Por cobrar</span></span>
      <span class="panel-inline-stat"><strong>${ui.openCashSession ? money(ui.expectedCash) : 'Cerrada'}</strong><span>Caja</span></span>
      <span class="panel-inline-stat"><strong>${money(ui.pendingInvoices)}</strong><span>Facturas</span></span>
    </div></div>
    ${feedbackMessage ? `<div class="feedback-banner">${feedbackMessage}</div>` : ''}
    ${ui.user?.isOwner && ui.progressiveProfile.status === 'complete' ? `<div class="info-strip progressive-suggestion"><strong>${ui.progressiveProfile.industry ? `Sugerencia para ${escapeHtml(ui.progressiveProfile.industry)}` : 'Sugerencia para tu operación'}</strong><span>${progressiveSuggestion(ui.progressiveProfile)}</span></div>` : ''}
    <section class="dashboard-grid dashboard-operation-grid">
      <article class="panel"><div class="panel-head"><div><h3>Ventas recientes</h3><p>Con multiples articulos</p></div></div><div class="list">
        ${ui.enrichedSales.slice(0, 5).map((sale) => `<div class="list-row"><div><strong>${sale.customerName}</strong><p>${sale.itemSummary}</p></div><div class="right"><strong>${money(sale.totalAmount)}</strong><p>${sale.channel} - ${sale.paymentMethod}</p></div></div>`).join('')}
      </div></article>
      <article class="panel"><div class="panel-head"><div><h3>Top productos</h3><p>Ranking de movimiento</p></div></div><div class="top-list">
        ${ui.topProducts.length ? ui.topProducts.map(([name, qty], index) => `<div class="top-row"><span>${index + 1}</span><div><strong>${name}</strong><p>${qty} unidades vendidas</p></div></div>`).join('') : '<p class="empty-state">Todavia no hay ventas cargadas.</p>'}
      </div></article>
      <article class="panel dashboard-stock-panel"><div class="panel-head"><div><h3>Stock critico</h3><p>${ui.lowStock.length ? `${ui.lowStock.length} articulos para revisar` : 'Inventario estable'}</p></div></div><div class="alert-list">
        ${ui.lowStock.length ? (() => { const visibleStock = dashboardStockExpanded ? ui.lowStock : ui.lowStock.slice(0, 10); return `${visibleStock.map((product) => `<div class="alert-card"><strong>${product.name}</strong><p>Stock ${product.scopedStock} en ${ui.currentBranch?.name || 'sucursal'} / minimo ${product.minStock}</p></div>`).join('')}${ui.lowStock.length > 10 ? `<button type="button" class="ghost-action dashboard-show-more" data-action="toggle-dashboard-stock">${dashboardStockExpanded ? 'Ver menos' : `Ver más (${ui.lowStock.length - 10})`}</button>` : ''}` })() : '<div class="alert-card ok"><strong>Sin alertas</strong><p>No hay productos con stock bajo.</p></div>'}
      </div></article>
      <article class="panel dashboard-audit-panel"><div class="panel-head"><div><h3>Auditoría</h3><p>Lo último que pasó en el comercio</p></div></div><div class="timeline-list">
        ${ui.recentCommerceActivity.length ? (() => { const visibleActivity = dashboardAuditExpanded ? ui.recentCommerceActivity : ui.recentCommerceActivity.slice(0, 10); return `${visibleActivity.map((activity) => `<div class="timeline-item"><strong>${activity.title}</strong><p>${activity.detail}</p><span>${String(activity.createdAt || '').slice(0, 16).replace('T', ' ')}</span></div>`).join('')}${ui.recentCommerceActivity.length > 10 ? `<button type="button" class="ghost-action dashboard-show-more" data-action="toggle-dashboard-audit">${dashboardAuditExpanded ? 'Ver menos' : `Ver más (${ui.recentCommerceActivity.length - 10})`}</button>` : ''}` })() : '<p class="empty-state">Todavía no hay movimientos registrados.</p>'}
      </div></article>
    </section>
  </section>
`

const dashboardActivityIcon = (activity) => {
  if (activity.module === 'invoices') return icon('<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4"/><path d="M10 12h6M10 16h6"/>')
  if (activity.module === 'customers') return icon('<circle cx="12" cy="8" r="3"/><path d="M5 21c.5-4 3-6 7-6s6.5 2 7 6"/>')
  if (activity.module === 'products') return icon('<path d="m12 3 8 4.5-8 4.5-8-4.5z"/><path d="M4 7.5V16.5l8 4.5 8-4.5V7.5"/>')
  if (activity.id.startsWith('sale-')) return icon('<path d="M4 6h16l-2 8H6z"/><path d="M8 14v4h8v-4"/><path d="M9 10h.01M15 10h.01"/>')
  if (activity.id.startsWith('cash-')) return icon('<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16"/><path d="M16 14h2"/>')
  if (activity.id.startsWith('stock-') || activity.id.startsWith('receipt-')) return icon('<path d="m12 3 8 4.5-8 4.5-8-4.5z"/><path d="M4 7.5V16.5l8 4.5 8-4.5V7.5"/>')
  return icon('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 1.5"/>')
}

const dashboardViewV2 = (ui) => {
  const pendingInvoiceCount = ui.enrichedInvoices.filter((invoice) => invoice.status !== 'Cobrada').length
  const visibleActivity = ui.recentCommerceActivity.slice(0, 4)
  const activityTime = (createdAt) => String(createdAt || '').slice(11, 16) || '--:--'
  const topProductMax = Math.max(1, ...ui.topProducts.slice(0, 5).map(([, qty]) => Number(qty) || 0))
  return `
  <section class="view-section dashboard-view">
    <div class="section-header dashboard-header"><div><p class="kicker">Resumen diario</p><h2>Operación del local</h2></div><div class="dashboard-quick-actions">
      <button type="button" class="primary-action" data-dashboard-section="ventas">Nueva venta</button>
      <button type="button" class="ghost-action" data-dashboard-section="facturacion">Cobro</button>
      <button type="button" class="ghost-action" data-dashboard-section="caja">Ingreso de caja</button>
    </div></div>
    ${feedbackMessage ? `<div class="feedback-banner">${feedbackMessage}</div>` : ''}
    <section class="dashboard-kpi-grid" aria-label="Resumen de operación">
      <button type="button" class="dashboard-kpi-card" data-dashboard-section="ventas"><span>Ventas</span><strong>${money(ui.totalSales)}</strong><small>Hoy</small></button>
      <button type="button" class="dashboard-kpi-card" data-dashboard-section="caja"><span>Caja</span><strong>${ui.openCashSession ? money(ui.expectedCash) : 'Cerrada'}</strong><small>${ui.openCashSession ? 'Sesión actual' : 'Abrir caja para operar'}</small></button>
      <button type="button" class="dashboard-kpi-card" data-dashboard-section="facturacion"><span>Por cobrar</span><strong>${money(ui.unpaidSales)}</strong><small>Ventas pendientes</small></button>
      <button type="button" class="dashboard-kpi-card" data-dashboard-section="facturacion"><span>Facturas pendientes</span><strong>${money(ui.pendingInvoices)}</strong><small>${pendingInvoiceCount} comprobante${pendingInvoiceCount === 1 ? '' : 's'}</small></button>
    </section>
    <section class="dashboard-attention" aria-label="Atención hoy">
      <p>Atención hoy</p>
      <button type="button" data-dashboard-section="caja"><span class="attention-status ${ui.openCashSession ? 'is-ok' : 'is-alert'}"></span><strong>Caja ${ui.openCashSession ? 'abierta' : 'cerrada'}</strong><small>${ui.openCashSession ? 'Lista para operar' : 'Requiere apertura'}</small></button>
      <button type="button" data-dashboard-section="productos"><span class="attention-status ${ui.lowStock.length ? 'is-alert' : 'is-ok'}"></span><strong>${ui.lowStock.length} producto${ui.lowStock.length === 1 ? '' : 's'} crítico${ui.lowStock.length === 1 ? '' : 's'}</strong><small>${ui.lowStock.length ? 'Requieren reposición' : 'Inventario estable'}</small></button>
      <button type="button" data-dashboard-section="facturacion"><span class="attention-status ${pendingInvoiceCount ? 'is-alert' : 'is-ok'}"></span><strong>${pendingInvoiceCount} factura${pendingInvoiceCount === 1 ? '' : 's'} pendiente${pendingInvoiceCount === 1 ? '' : 's'}</strong><small>${pendingInvoiceCount ? `Por ${money(ui.pendingInvoices)}` : 'Sin comprobantes pendientes'}</small></button>
    </section>
    <section class="dashboard-primary-grid">
      <article class="panel dashboard-sales-panel"><div class="panel-head"><div><h3>Ventas recientes</h3><p>Últimas operaciones registradas</p></div><button type="button" class="ghost-action dashboard-panel-link" data-dashboard-section="ventas">Ver todas</button></div><div class="dashboard-sales-list">
        ${ui.enrichedSales.length ? ui.enrichedSales.slice(0, 5).map((sale) => `<div class="dashboard-sale-row"><div><strong>${escapeHtml(sale.itemSummary)}</strong><p>${escapeHtml(sale.customerName)} · ${escapeHtml(sale.paymentMethod || 'Sin medio de pago')}</p></div><div><strong>${money(sale.totalAmount)}</strong><time>${activityTime(sale.soldAt)}</time></div></div>`).join('') : '<p class="empty-state">Todavía no hay ventas registradas.</p>'}
      </div></article>
      <article class="panel dashboard-stock-panel"><div class="panel-head"><div><h3>Stock crítico</h3><p>${ui.lowStock.length ? 'Productos que requieren reposición' : 'Inventario estable'}</p></div><button type="button" class="ghost-action dashboard-panel-link" data-dashboard-section="productos">Ver ${ui.lowStock.length || ''} productos</button></div><div class="dashboard-stock-list">
        ${ui.lowStock.length ? ui.lowStock.slice(0, 4).map((product) => `<div class="dashboard-stock-row"><strong>${escapeHtml(product.name)}</strong><span>Stock <b>${product.scopedStock}</b> · mínimo ${product.minStock}</span></div>`).join('') : '<div class="alert-card ok"><strong>Sin alertas</strong><p>No hay productos con stock bajo.</p></div>'}
      </div>${ui.lowStock.length > 4 ? `<button type="button" class="dashboard-stock-summary" data-dashboard-section="productos"><strong>${ui.lowStock.length - 4} productos más requieren revisión</strong><span>Ver faltantes y reponer stock →</span></button>` : ''}</article>
    </section>
    <section class="dashboard-secondary-grid">
      <article class="panel dashboard-top-panel"><div class="panel-head"><div><h3>Top productos</h3><p>Ranking por unidades vendidas</p></div><button type="button" class="ghost-action dashboard-panel-link" data-dashboard-section="reportes">Ver ranking</button></div><div class="dashboard-top-list">
        ${ui.topProducts.length ? ui.topProducts.slice(0, 5).map(([name, qty], index) => `<div class="dashboard-top-row" style="--rank-width: ${Math.max(12, Math.round((Number(qty) / topProductMax) * 100))}%"><span>${index + 1}</span><strong>${escapeHtml(name)}</strong><small>${qty} unidades</small><i aria-hidden="true"></i></div>`).join('') : '<p class="empty-state">Todavía no hay ventas cargadas.</p>'}
      </div></article>
      <article class="panel dashboard-audit-panel"><div class="panel-head"><div><h3>Actividad reciente</h3><p>Últimos movimientos registrados</p></div></div><div class="dashboard-activity-list">
        ${visibleActivity.length ? visibleActivity.map((activity) => `<div class="dashboard-activity-row module-${activity.module || 'settings'}"><span class="dashboard-activity-icon" aria-hidden="true">${dashboardActivityIcon(activity)}</span><div><strong>${escapeHtml(activity.title)}</strong><p>${escapeHtml(activity.detail)}</p></div><time>${activityTime(activity.createdAt)}</time></div>`).join('') : '<p class="empty-state">Todavía no hay movimientos registrados.</p>'}
      </div>${ui.recentCommerceActivity.length ? '<button type="button" class="dashboard-audit-link" data-dashboard-section="auditoria">Abrir auditoría <span aria-hidden="true">→</span></button>' : ''}</article>
    </section>
  </section>
`
}

const customersView = (ui) => `
  <section class="view-section"><div class="section-header"><div><p class="kicker">Clientes</p><h2>Base comercial</h2></div></div>
    <section class="content-grid single-focus">
      <article class="panel"><div class="panel-head"><div><h3>Alta de cliente</h3><p>Cuenta corriente y contacto</p></div></div>
        <form class="form-grid" data-form="customer">
          <label>Nombre<input type="text" name="fullName" required /></label>
          <label>Telefono<input type="text" name="phone" required /></label>
          <label>Email<input type="email" name="email" /></label>
          <label>Saldo<input type="number" name="balance" min="0" value="0" required /></label>
          <label class="full-span">Etiqueta<input type="text" name="tag" required /></label>
          <button type="submit">Guardar cliente</button>
        </form>
      </article>
      <article class="panel"><div class="panel-head"><div><h3>Clientes</h3><p>Preparado para cuentas corrientes</p></div></div>
        ${dataTable(['Cliente', 'Telefono', 'Email', 'Saldo', 'Accion'], ui.snapshot.customers.map((customer) => `<div class="data-row"><span>${customer.fullName}</span><span>${customer.phone || '-'}</span><span>${customer.email || '-'}</span>${balanceBadge(customer.balance)}<span>${actionButton('customer', customer.id)}</span></div>`))}
      </article>
    </section>
  </section>
`

const customersViewV2 = (ui) => `
  ${(() => {
    const editingCustomer = ui.snapshot.customers.find((customer) => customer.id === customerEditingId)
    const query = customerSearchQuery.trim().toLowerCase()
    const customers = (query ? ui.snapshot.customers.filter((customer) => [customer.fullName, customer.phone, customer.email, customer.cuit].some((value) => String(value || '').toLowerCase().includes(query))) : ui.snapshot.customers.slice(0, 10))
    return `
  <section class="view-section"><div class="section-header"><div><p class="kicker">Clientes</p><h2>Base comercial</h2></div><div class="panel-inline-stats section-inline-stats">
      <span class="panel-inline-stat"><strong>${ui.snapshot.customers.length}</strong><span>Activos</span></span>
      <span class="panel-inline-stat"><strong>${money(ui.snapshot.customers.reduce((sum, customer) => sum + Number(customer.balance || 0), 0))}</strong><span>Saldo</span></span>
      <span class="panel-inline-stat"><strong>${ui.snapshot.customers.filter((customer) => String(customer.tag || '').toLowerCase().includes('mostrador')).length}</strong><span>Rapidos</span></span>
    </div></div>
    ${feedbackMessage ? `<div class="feedback-banner">${feedbackMessage}</div>` : ''}
    <section class="module-board customers-board">
      <div class="module-main">
        ${customerFormOpen ? `<article class="panel"><div class="panel-head"><div><h3>${editingCustomer ? 'Editar cliente' : 'Nuevo cliente'}</h3><p>Contacto, direccion y datos fiscales</p></div><div class="settings-actions"><button type="button" class="ghost-action" data-action="close-customer-form">Cerrar</button></div></div>
          <form class="form-grid" data-form="customer">
          <input type="hidden" name="customerId" value="${editingCustomer?.id || ''}" />
          <label>Nombre<input type="text" name="fullName" value="${escapeHtml(editingCustomer?.fullName || '')}" required /></label>
          <label>Telefono<input type="text" name="phone" value="${escapeHtml(editingCustomer?.phone || '')}" placeholder="Opcional" /></label>
          <label>Email<input type="email" name="email" value="${escapeHtml(editingCustomer?.email || '')}" placeholder="Opcional" /></label>
          <label>CUIT<input type="text" name="cuit" value="${escapeHtml(editingCustomer?.cuit || '')}" placeholder="20-12345678-9" /></label>
          <label class="full-span">Direccion<input type="text" name="address" data-address-map-input value="${escapeHtml(editingCustomer?.address || '')}" placeholder="Calle, numero, localidad" /></label>
          <div class="address-map full-span"><div><strong>Ubicacion en Google Maps</strong><a class="inline-action" data-address-map-link target="_blank" rel="noreferrer" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(editingCustomer?.address || '')}">Abrir en Maps</a></div><iframe data-address-map title="Mapa de la direccion del cliente" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${editingCustomer?.address ? `https://www.google.com/maps?q=${encodeURIComponent(editingCustomer.address)}&output=embed` : 'about:blank'}"></iframe><p data-address-map-empty ${editingCustomer?.address ? 'hidden' : ''}>Escribí una dirección para visualizarla en el mapa.</p></div>
          <label>Saldo inicial<input type="number" name="balance" min="0" value="${editingCustomer?.balance || 0}" /></label>
          <label>Etiqueta<input type="text" name="tag" value="${escapeHtml(editingCustomer?.tag || '')}" placeholder="Mayorista, taller..." /></label>
            <button type="submit">${editingCustomer ? 'Guardar cambios' : 'Guardar cliente'}</button>
            <button type="button" class="ghost-action" data-action="close-customer-form">Cancelar</button>
          </form>
        </article>` : ''}
        <article class="panel"><div class="panel-head"><div><h3>${query ? 'Resultados' : 'Ultimos 10 clientes'}</h3><p>Tocá un cliente para ver su información; editá sólo cuando haga falta.</p></div><div class="settings-actions">${createToggleButton('customer', customerFormOpen, 'Agregar cliente')}</div></div>
          <div class="stock-adjustment-search"><span class="pos-search-icon" aria-hidden="true">${icon('<circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/>')}</span><input type="search" data-customer-search value="${escapeHtml(customerSearchQuery)}" placeholder="Buscar cliente" aria-label="Buscar cliente" /></div>
          <div class="timeline-list">${customers.map((customer) => `<div class="timeline-item contact-result"><button type="button" class="contact-result-main" data-action="view-customer-map" data-id="${customer.id}"><strong>${escapeHtml(customer.fullName)}</strong><p>${escapeHtml(customer.phone || customer.email || customer.cuit || 'Sin datos de contacto')}</p><span>${escapeHtml(customer.address || 'Sin dirección')} · ${balanceText(customer.balance)} ${money(customer.balance)}</span></button><span class="contact-result-actions"><button type="button" class="inline-action" data-action="edit-customer" data-id="${customer.id}">Editar</button>${actionButton('customer', customer.id)}</span>${customerMapPreviewId === customer.id ? `<div class="customer-map-preview">${customer.address ? `<iframe title="Ubicación de ${escapeHtml(customer.fullName)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${encodeURIComponent(customer.address)}&output=embed"></iframe><a class="inline-action" target="_blank" rel="noreferrer" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address)}">Abrir en Maps</a>` : '<p>Este cliente todavía no tiene una dirección cargada.</p>'}</div>` : ''}</div>`).join('') || '<p class="empty-state">No hay clientes para esta búsqueda.</p>'}</div>
        </article>
      </div>
    </section>
  </section>
`})()}
`

const salesView = (ui) => `
  ${(() => {
    const editingSale = ui.snapshot.sales.find((sale) => sale.id === saleEditingId)
    if (editingSale && !Object.keys(saleDraftQuantities).length) {
      saleDraftQuantities = Object.fromEntries((editingSale.items || []).map((item) => [item.productId, item.quantity]))
    }
    const quantities = new Map(Object.entries(Object.keys(saleDraftQuantities).length ? saleDraftQuantities : Object.fromEntries((editingSale?.items || []).map((item) => [item.productId, item.quantity]))))
    return `
  <section class="view-section"><div class="section-header"><div><p class="kicker">Ventas</p><h2>Venta multi-item</h2></div></div>
    ${feedbackMessage ? `<div class="feedback-banner">${feedbackMessage}</div>` : ''}
    <section class="content-grid single-focus">
      <article class="panel">
        <div class="panel-head"><div><h3>${editingSale ? 'Editar venta' : 'Nueva venta'}</h3><p>${editingSale ? 'Actualiza stock, cobro y comprobantes' : 'Carga rapida para mostrador o venta asistida'}</p></div></div>
        <form class="form-grid sales-form" data-form="sale">
          <input type="hidden" name="saleId" value="${editingSale?.id || ''}" />
          <label>Cliente<select name="customerId"><option value="">Mostrador</option>${ui.snapshot.customers.map((customer) => `<option value="${customer.id}" ${editingSale?.customerId === customer.id ? 'selected' : ''}>${customer.fullName}</option>`).join('')}</select></label>
          <label>Canal<select name="channel"><option ${editingSale?.channel === 'Mostrador' ? 'selected' : ''}>Mostrador</option><option ${editingSale?.channel === 'WhatsApp' ? 'selected' : ''}>WhatsApp</option><option ${editingSale?.channel === 'Transferencia' ? 'selected' : ''}>Transferencia</option><option ${editingSale?.channel === 'Mercado Libre' ? 'selected' : ''}>Mercado Libre</option></select></label>
          <label>Pago<select name="paymentMethod"><option value="cash" ${editingSale?.paymentMethod === 'cash' ? 'selected' : ''}>Efectivo</option><option value="transfer" ${editingSale?.paymentMethod === 'transfer' ? 'selected' : ''}>Transferencia</option><option value="mercado_pago" ${editingSale?.paymentMethod === 'mercado_pago' ? 'selected' : ''}>Mercado Pago</option><option value="account" ${editingSale?.paymentMethod === 'account' ? 'selected' : ''}>Cuenta corriente</option><option value="mixed" ${editingSale?.paymentMethod === 'mixed' ? 'selected' : ''}>Mixto</option></select></label>
          <div class="toggle-grid full-span">
            <label class="checkbox-row compact-toggle"><input type="checkbox" name="isPaid" ${editingSale ? (editingSale.status === 'completed' ? 'checked' : '') : 'checked'} /><span>Cobrado</span></label>
            <label class="checkbox-row compact-toggle"><input type="checkbox" name="autoInvoice" /><span>Generar factura</span></label>
          </div>
          <label>Descuento<input type="number" min="0" name="discountAmount" value="${editingSale?.discountAmount || 0}" /></label>
          <label>Monto cobrado<input type="number" min="0" name="amountPaid" value="${editingSale?.amountPaid || 0}" /></label>
          <details class="sales-payment-detail full-span">
            <summary>Desglose de pago mixto</summary>
            <div class="payment-split-grid">
              <label>Efectivo<input type="number" min="0" name="cashAmount" value="${editingSale?.paymentBreakdown?.cash || 0}" /></label>
              <label>Transferencia<input type="number" min="0" name="transferAmount" value="${editingSale?.paymentBreakdown?.transfer || 0}" /></label>
              <label>Mercado Pago<input type="number" min="0" name="mercadoPagoAmount" value="${editingSale?.paymentBreakdown?.mercadoPago || 0}" /></label>
              <label>Cuenta corriente<input type="number" min="0" name="accountAmount" value="${editingSale?.paymentBreakdown?.account || 0}" /></label>
            </div>
          </details>
          <label class="full-span">Observaciones<input type="text" name="note" value="${editingSale?.note || ''}" placeholder="Detalle interno, referencia o condicion comercial" /></label>
          <div class="priority-list compact-list full-span sales-status-strip">
            <div class="priority-item"><strong>Sucursal</strong><p>${ui.currentBranch?.name || '-'}</p></div>
            <div class="priority-item"><strong>Caja</strong><p>${ui.openCashSession?.registerId ? (ui.enrichedRegisters.find((register) => register.id === ui.openCashSession.registerId)?.name || 'Caja activa') : (ui.currentRegister?.name || 'Sin caja seleccionada')}</p></div>
            <div class="priority-item"><strong>Modo</strong><p>${ui.openCashSession ? 'Venta ligada a caja abierta' : 'Transferencia o cuenta sin caja'}</p></div>
          </div>
          <div class="full-span">
            <div class="panel-head"><div><h3>Escaner rapido</h3><p>Lee codigo de barras, SKU o nombre exacto</p></div></div>
            <div class="inline-action-group scanner-row">
              <input type="text" class="scanner-input" name="quickAddCode" value="${saleQuickAddCode}" placeholder="Escanea o escribe codigo" />
              <button type="button" class="primary-action" data-action="quick-add-sale">Agregar</button>
            </div>
          </div>
          <p class="form-note full-span">Las ventas en efectivo solo se pueden registrar con una caja abierta. Los reportes toman sucursal y caja actual.</p>
          <div class="full-span cart-builder">
            ${ui.scopedProducts.map((product) => `
              <div class="cart-line">
                <div><strong>${product.name}</strong><p>${money(product.salePrice)} / stock ${product.scopedStock} / cod. ${product.barcode || '-'}</p></div>
                <input type="number" min="0" value="${quantities.get(product.id) || 0}" name="qty_${product.id}" />
              </div>`).join('')}
          </div>
          <button type="submit">${editingSale ? 'Guardar cambios' : 'Registrar venta'}</button>
          ${editingSale ? '<button type="button" class="danger-action" data-action="cancel-sale-edit">Cancelar edicion</button>' : ''}
        </form>
      </article>
      <article class="panel"><div class="panel-head"><div><h3>Historial</h3><p>Ventas recientes y acciones rapidas</p></div></div>
        <div class="sales-table">${paginatedDataTable(['Cliente', 'Detalle', 'Cobro', 'Acciones'], ui.enrichedSales, 'ventas', (sale) => `<div class="data-row sales-history-row"><span>${sale.customerName}<br /><small>${sale.status === 'completed' ? 'Cobrada' : sale.status === 'partial' ? 'Pago parcial' : sale.status === 'cancelled' ? 'Anulada' : sale.status === 'returned' ? 'Devuelta' : 'Pendiente'}</small></span><span>${sale.itemSummary}${sale.note ? `<br /><small>${sale.note}</small>` : ''}<br /><small>${sale.branchName} / ${sale.registerName} / ${sale.paymentSummary}</small></span><span>${money(sale.amountPaid)} / ${money(sale.totalAmount)}${sale.discountAmount ? `<br /><small>Desc. ${money(sale.discountAmount)}</small>` : ''}</span><span>${saleActionButtons(sale)}</span></div>`)}</div>
      </article>
    </section>
  </section>
`})()}
`

const cashView = (ui) => `
  <section class="view-section"><div class="section-header"><div><p class="kicker">Caja</p><h2>Apertura y cierre</h2></div></div>
    <section class="dashboard-grid reports-layout">
      <article class="panel">
        <div class="panel-head"><div><h3>Estado actual</h3><p>Control diario de efectivo</p></div></div>
        <div class="priority-list">
          <div class="priority-item"><strong>Estado</strong><p>${ui.openCashSession ? 'Abierta' : 'Cerrada'}</p></div>
          <div class="priority-item"><strong>Sucursal</strong><p>${ui.currentBranch?.name || '-'}</p></div>
          <div class="priority-item"><strong>Caja</strong><p>${ui.openCashSession?.registerId ? (ui.enrichedRegisters.find((register) => register.id === ui.openCashSession.registerId)?.name || 'Caja') : (ui.currentRegister?.name || 'Elegi una caja')}</p></div>
          <div class="priority-item"><strong>Fondo inicial</strong><p>${money(ui.openCashSession?.openingAmount || 0)}</p></div>
          <div class="priority-item"><strong>Ajustes manuales</strong><p>${money(ui.sessionCashMovementTotal)}</p></div>
          <div class="priority-item"><strong>Efectivo esperado</strong><p>${money(ui.expectedCash)}</p></div>
        </div>
      </article>
      <article class="panel">
        <div class="panel-head"><div><h3>${ui.openCashSession ? 'Cerrar caja' : 'Abrir caja'}</h3><p>${ui.openCashSession ? 'Informa el efectivo contado' : 'Defini el fondo inicial'}</p></div></div>
        <form class="form-grid" data-form="${ui.openCashSession ? 'close-cash' : 'open-cash'}">
          ${ui.openCashSession ? '' : `<label>Caja<select name="registerId" required>${ui.branchRegisters.map((register) => `<option value="${register.id}" ${ui.currentRegister?.id === register.id ? 'selected' : ''}>${register.name} (${register.code})</option>`).join('')}</select></label>`}
          <label>${ui.openCashSession ? 'Efectivo contado' : 'Monto inicial'}<input type="number" min="0" name="${ui.openCashSession ? 'countedAmount' : 'openingAmount'}" value="${ui.openCashSession ? ui.expectedCash : 0}" required /></label>
          <button type="submit">${ui.openCashSession ? 'Cerrar caja' : 'Abrir caja'}</button>
        </form>
      </article>
      <article class="panel"><div class="panel-head"><div><h3>Movimiento manual</h3><p>Ingresos, gastos y retiros</p></div></div>
        ${ui.openCashSession ? `<form class="form-grid" data-form="cash-movement">
          <label>Tipo<select name="kind"><option value="income">Ingreso</option><option value="deposit">Deposito</option><option value="expense">Gasto</option><option value="withdrawal">Retiro</option></select></label>
          <label>Importe<input type="number" min="1" name="amount" required /></label>
          <label class="full-span">Detalle<input type="text" name="note" placeholder="Motivo del movimiento" required /></label>
          <button type="submit">Registrar movimiento</button>
        </form>` : '<p class="empty-state">Abri una caja para registrar movimientos manuales.</p>'}
      </article>
      <article class="panel"><div class="panel-head"><div><h3>Ultimos cierres</h3><p>Diferencias y arqueo</p></div></div><div class="timeline-list">
        ${byRecentDate(ui.scopedCashSessions.filter((session) => session.status === 'closed'), 'closedAt').slice(0, 5).map((session) => `<div class="timeline-item"><strong>Cierre ${session.closedAt?.slice(0, 10) || '-'}</strong><p>Contado ${money(session.countedAmount || 0)} / diferencia ${money(session.differenceAmount || 0)}</p><span>${ui.enrichedRegisters.find((register) => register.id === session.registerId)?.name || 'Caja'} / fondo ${money(session.openingAmount || 0)}</span></div>`).join('') || '<p class="empty-state">Todavia no hay cierres para este filtro.</p>'}
      </div></article>
      <article class="panel"><div class="panel-head"><div><h3>Bitacora de caja</h3><p>Impacta en el arqueo esperado</p></div></div><div class="timeline-list">
        ${ui.enrichedCashMovements.slice(0, 6).map((movement) => `<div class="timeline-item"><strong>${cashMovementKindLabel(movement.kind)}</strong><p>${movement.note}</p><span>${movement.registerName} / ${money(movement.signedAmount)} / ${movement.createdAt.slice(0, 16).replace('T', ' ')}</span></div>`).join('') || '<p class="empty-state">Todavia no hay movimientos manuales.</p>'}
      </div></article>
    </section>
  </section>
`

const salesViewV2 = (ui) => `
  ${(() => {
    const editingSale = ui.snapshot.sales.find((sale) => sale.id === saleEditingId)
    const selectedSaleCustomer = ui.snapshot.customers.find((customer) => customer.id === editingSale?.customerId)
    const showSaleForm = true
    if (editingSale && !Object.keys(saleDraftQuantities).length) {
      saleDraftQuantities = Object.fromEntries((editingSale.items || []).map((item) => [item.productId, item.quantity]))
    }
    const quantities = new Map(Object.entries(Object.keys(saleDraftQuantities).length ? saleDraftQuantities : Object.fromEntries((editingSale?.items || []).map((item) => [item.productId, item.quantity]))))
    const selectedProducts = ui.scopedProducts.filter((product) => Number(quantities.get(product.id) || 0) > 0)
    const cartUnits = selectedProducts.reduce((sum, product) => sum + Number(quantities.get(product.id) || 0), 0)
    const cartSubtotal = selectedProducts.reduce((sum, product) => sum + (Number(quantities.get(product.id) || 0) * Number(product.salePrice || 0)), 0)
    return `
  <section class="view-section"><div class="section-header"><div><p class="kicker">Ventas</p><h2>Venta multi-item</h2></div><div class="panel-inline-stats section-inline-stats">
      <span class="panel-inline-stat"><strong>${ui.enrichedSales.length}</strong><span>Ventas</span></span>
      <span class="panel-inline-stat"><strong>${money(ui.totalSales)}</strong><span>Total</span></span>
      <span class="panel-inline-stat"><strong>${money(ui.unpaidSales)}</strong><span>Por cobrar</span></span>
    </div></div>
    ${feedbackMessage ? `<div class="feedback-banner">${feedbackMessage}</div>` : ''}
    <section class="stacked-section">
      ${showSaleForm ? `<article class="panel pos-sale-panel">
        <div class="panel-head pos-sale-head"><div><h3>${editingSale ? 'Editar venta' : 'Punto de venta'}</h3><p>${editingSale ? 'Actualiza los articulos y el cobro' : 'Busca un articulo o escanea su codigo para comenzar'}</p></div><button type="button" class="pos-cash-badge ${ui.openCashSession ? 'is-open' : 'is-closed'}" data-section="caja" aria-label="Ir a Caja">Caja ${ui.openCashSession ? 'abierta' : 'cerrada'}</button></div>
        <form class="form-grid sales-form pos-sale-form" data-form="sale">
          <input type="hidden" name="saleId" value="${editingSale?.id || ''}" />
          <div class="full-span pos-product-search">
            <span class="pos-search-icon" aria-hidden="true">${icon('<circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/>')}</span>
            <input type="text" class="scanner-input" name="quickAddCode" value="${saleQuickAddCode}" list="sale-product-options" autocomplete="off" placeholder="Buscar articulo, SKU o escanear codigo de barras" aria-label="Buscar articulo" />
            <datalist id="sale-product-options">${ui.scopedProducts.map((product) => `<option value="${escapeHtml(product.name)}">${escapeHtml(product.sku || product.barcode || '')}</option>`).join('')}</datalist>
          </div>
          <div class="full-span pos-checkout-layout">
            <section class="pos-cart">
              <div class="pos-cart-head"><div><strong>Articulos</strong><span>${cartUnits} unidades</span></div><div class="pos-total"><span>Total</span><output data-sale-total>${money(Math.max(0, cartSubtotal - Number(editingSale?.discountAmount || 0)))}</output></div></div>
              <div class="cart-builder">
                ${selectedProducts.length ? selectedProducts.map((product) => `
                  <div class="cart-line sale-cart-line ${product.trackStock && product.scopedStock <= product.minStock ? 'is-low' : ''}">
                    <div><strong>${product.name}</strong><p>${money(product.salePrice)} c/u · stock ${product.scopedStock}</p></div>
                    <label class="cart-quantity"><span>Cantidad</span><input type="number" min="0" max="${product.trackStock ? product.scopedStock : 999999}" value="${quantities.get(product.id) || 0}" name="qty_${product.id}" data-sale-price="${Number(product.salePrice || 0)}" /></label>
                    <strong class="cart-line-total">${money(Number(quantities.get(product.id) || 0) * Number(product.salePrice || 0))}</strong>
                  </div>`).join('') : '<div class="pos-cart-empty"><strong>Venta vacia</strong><span>Busca o escanea el primer articulo.</span></div>'}
              </div>
            </section>
            <aside class="pos-payment-panel">
              <label class="pos-customer-field">Cliente<div class="pos-customer-search"><div class="stock-adjustment-search"><span class="pos-search-icon" aria-hidden="true">${icon('<circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/>')}</span><input type="search" data-sale-customer-search value="${escapeHtml(selectedSaleCustomer?.fullName || saleCustomerSearchQuery)}" placeholder="Buscar cliente o dejar Mostrador" autocomplete="off" list="sale-customer-options" aria-label="Buscar cliente" /><datalist id="sale-customer-options">${ui.snapshot.customers.map((customer) => `<option value="${escapeHtml(customer.fullName)}">${escapeHtml([customer.phone, customer.email].filter(Boolean).join(' · '))}</option>`).join('')}</datalist></div><label class="pos-invoice-toggle" title="Generar comprobante interno al cobrar"><input type="checkbox" name="autoInvoice" /><span>Facturar</span></label><input type="hidden" name="customerId" value="${editingSale?.customerId || ''}" /><button type="button" class="pos-customer-counter" data-action="set-counter-customer">Mostrador</button></div></label>
              <label class="pos-payment-field">Medio de pago<select name="paymentMethod"><option value="cash" ${editingSale?.paymentMethod === 'cash' ? 'selected' : ''}>Efectivo</option><option value="transfer" ${editingSale?.paymentMethod === 'transfer' ? 'selected' : ''}>Transferencia</option><option value="mercado_pago" ${editingSale?.paymentMethod === 'mercado_pago' ? 'selected' : ''}>Mercado Pago</option><option value="echeq" ${editingSale?.paymentMethod === 'echeq' ? 'selected' : ''}>E-cheq</option><option value="account" ${editingSale?.paymentMethod === 'account' ? 'selected' : ''}>Cuenta corriente</option><option value="mixed" ${editingSale?.paymentMethod === 'mixed' ? 'selected' : ''}>Pago mixto</option></select></label>
              <label class="pos-echeq-field" data-echeq-field hidden>Número de e-cheq<input type="text" name="echeqNumber" placeholder="Ej.: 00123456" autocomplete="off" /></label>
              <details class="sales-payment-detail"><summary>Mas opciones</summary>
                <div class="pos-payment-advanced">
                  <label class="pos-discount-field"><span>Descuento</span><div class="pos-discount-control"><select name="discountMode" aria-label="Tipo de descuento"><option value="amount">$</option><option value="percent">%</option></select><input type="number" min="0" name="discountValue" value="${editingSale?.discountAmount || 0}" aria-label="Valor del descuento" /><input type="hidden" name="discountAmount" value="${editingSale?.discountAmount || 0}" /></div><small data-discount-help>Importe en pesos</small></label>
                </div>
                <details class="pos-payment-breakdown"><summary>Desglosar cobro</summary><div class="payment-split-grid">
                <label>Canal<select name="channel"><option ${editingSale?.channel === 'Mostrador' ? 'selected' : ''}>Mostrador</option><option ${editingSale?.channel === 'WhatsApp' ? 'selected' : ''}>WhatsApp</option><option ${editingSale?.channel === 'Transferencia' ? 'selected' : ''}>Transferencia</option><option ${editingSale?.channel === 'Mercado Libre' ? 'selected' : ''}>Mercado Libre</option></select></label>
                <label>Monto cobrado<input type="number" min="0" name="amountPaid" value="${editingSale?.amountPaid || 0}" /></label>
                <label>Efectivo<input type="number" min="0" name="cashAmount" value="${editingSale?.paymentBreakdown?.cash || 0}" /></label>
                <label>Transferencia<input type="number" min="0" name="transferAmount" value="${editingSale?.paymentBreakdown?.transfer || 0}" /></label>
                <label>Mercado Pago<input type="number" min="0" name="mercadoPagoAmount" value="${editingSale?.paymentBreakdown?.mercadoPago || 0}" /></label>
                <label>E-cheq<input type="number" min="0" name="echeqAmount" value="${editingSale?.paymentBreakdown?.echeq || 0}" /></label>
                <label>N° e-cheq<input type="text" name="echeqNumber" /></label>
                <label>Cuenta corriente<input type="number" min="0" name="accountAmount" value="${editingSale?.paymentBreakdown?.account || 0}" /></label>
                <label class="full-span">Observaciones<input type="text" name="note" value="${editingSale?.note || ''}" placeholder="Opcional" /></label>
                </div></details>
              </details>
              <button type="submit" class="pos-charge-button" ${selectedProducts.length ? '' : 'disabled'}>${editingSale ? 'Guardar cambios' : 'Cobrar'}</button>
              ${editingSale ? '<button type="button" class="danger-action" data-action="cancel-sale-edit">Cancelar edicion</button>' : ''}
            </aside>
          </div>
        </form>
      </article>` : ''}
      <article class="panel"><div class="panel-head"><div><h3>Historial</h3><p>Ventas recientes y acciones rapidas</p></div></div>
        <div class="sales-table">${dataTable(['Cliente', 'Detalle', 'Cobro', 'Acciones'], ui.enrichedSales.map((sale) => `<div class="data-row sales-history-row"><span>${sale.customerName}<br /><small>${sale.status === 'completed' ? 'Cobrada' : sale.status === 'partial' ? 'Pago parcial' : sale.status === 'cancelled' ? 'Anulada' : sale.status === 'returned' ? 'Devuelta' : 'Pendiente'}</small></span><span>${sale.itemSummary}${sale.note ? `<br /><small>${sale.note}</small>` : ''}<br /><small>${sale.branchName} / ${sale.registerName} / ${sale.paymentSummary}</small></span><span>${money(sale.amountPaid)} / ${money(sale.totalAmount)}${sale.discountAmount ? `<br /><small>Desc. ${money(sale.discountAmount)}</small>` : ''}</span><span>${saleActionButtons(sale)}</span></div>`))}</div>
      </article>
    </section>
  </section>
`})()}
`

const cashViewLegacy = (ui) => `
  <section class="view-section"><div class="section-header"><div><p class="kicker">Caja</p><h2>Apertura y cierre</h2></div><div class="panel-inline-stats section-inline-stats">
      <span class="panel-inline-stat"><strong>${ui.openCashSession ? 'Abierta' : 'Cerrada'}</strong><span>Estado</span></span>
      <span class="panel-inline-stat"><strong>${money(ui.expectedCash)}</strong><span>Efectivo</span></span>
      <span class="panel-inline-stat"><strong>${ui.enrichedCashMovements.length}</strong><span>Movimientos</span></span>
    </div></div>
    <section class="module-board cash-board ${showCashForm ? '' : 'board-expanded'}">
      <article class="panel module-side">
        <div class="panel-head"><div><h3>Estado actual</h3><p>Control diario de efectivo</p></div></div>
        <div class="priority-list">
          <div class="priority-item"><strong>Estado</strong><p>${ui.openCashSession ? 'Abierta' : 'Cerrada'}</p></div>
          <div class="priority-item"><strong>Sucursal</strong><p>${ui.currentBranch?.name || '-'}</p></div>
          <div class="priority-item"><strong>Caja</strong><p>${ui.openCashSession?.registerId ? (ui.enrichedRegisters.find((register) => register.id === ui.openCashSession.registerId)?.name || 'Caja') : (ui.currentRegister?.name || 'Elegi una caja')}</p></div>
          <div class="priority-item"><strong>Fondo inicial</strong><p>${money(ui.openCashSession?.openingAmount || 0)}</p></div>
          <div class="priority-item"><strong>Ajustes manuales</strong><p>${money(ui.sessionCashMovementTotal)}</p></div>
          <div class="priority-item"><strong>Efectivo esperado</strong><p>${money(ui.expectedCash)}</p></div>
        </div>
      </article>
      <div class="module-main">
        <div class="compact-form-grid">
          <article class="panel">
            <div class="panel-head"><div><h3>${ui.openCashSession ? 'Cerrar caja' : 'Abrir caja'}</h3><p>${ui.openCashSession ? 'Informa el efectivo contado' : 'Defini el fondo inicial'}</p></div></div>
            <form class="form-grid compact-form" data-form="${ui.openCashSession ? 'close-cash' : 'open-cash'}">
              ${ui.openCashSession ? '' : `<label>Caja<select name="registerId" required>${ui.branchRegisters.map((register) => `<option value="${register.id}" ${ui.currentRegister?.id === register.id ? 'selected' : ''}>${register.name} (${register.code})</option>`).join('')}</select></label>`}
              <label>${ui.openCashSession ? 'Efectivo contado' : 'Monto inicial'}<input type="number" min="0" name="${ui.openCashSession ? 'countedAmount' : 'openingAmount'}" value="${ui.openCashSession ? ui.expectedCash : 0}" required /></label>
              <button type="submit">${ui.openCashSession ? 'Cerrar caja' : 'Abrir caja'}</button>
            </form>
          </article>
          <article class="panel"><div class="panel-head"><div><h3>Movimiento manual</h3><p>Ingresos, gastos y retiros</p></div></div>
            ${ui.openCashSession ? `<form class="form-grid compact-form" data-form="cash-movement">
              <label>Tipo<select name="kind"><option value="income">Ingreso</option><option value="deposit">Deposito</option><option value="expense">Gasto</option><option value="withdrawal">Retiro</option></select></label>
              <label>Importe<input type="number" min="1" name="amount" required /></label>
              <label class="full-span">Detalle<input type="text" name="note" placeholder="Motivo del movimiento" required /></label>
              <button type="submit">Registrar movimiento</button>
            </form>` : '<p class="empty-state">Abri una caja para registrar movimientos manuales.</p>'}
          </article>
        </div>
        <article class="panel"><div class="panel-head"><div><h3>Ultimos cierres</h3><p>Diferencias y arqueo</p></div></div><div class="timeline-list">
          ${byRecentDate(ui.scopedCashSessions.filter((session) => session.status === 'closed'), 'closedAt').slice(0, 5).map((session) => `<div class="timeline-item"><strong>Cierre ${session.closedAt?.slice(0, 10) || '-'}</strong><p>Contado ${money(session.countedAmount || 0)} / diferencia ${money(session.differenceAmount || 0)}</p><span>${ui.enrichedRegisters.find((register) => register.id === session.registerId)?.name || 'Caja'} / fondo ${money(session.openingAmount || 0)}</span></div>`).join('') || '<p class="empty-state">Todavia no hay cierres para este filtro.</p>'}
        </div></article>
        <article class="panel"><div class="panel-head"><div><h3>Bitacora de caja</h3><p>Impacta en el arqueo esperado</p></div></div><div class="timeline-list">
          ${ui.enrichedCashMovements.slice(0, 6).map((movement) => `<div class="timeline-item"><strong>${cashMovementKindLabel(movement.kind)}</strong><p>${movement.note}</p><span>${movement.registerName} / ${money(movement.signedAmount)} / ${movement.createdAt.slice(0, 16).replace('T', ' ')}</span></div>`).join('') || '<p class="empty-state">Todavia no hay movimientos manuales.</p>'}
        </div></article>
      </div>
    </section>
  </section>
`

const cashViewV2 = (ui) => `
  ${(() => {
    const showCashForm = cashFormOpen
    const lastClosedSession = byRecentDate(ui.scopedCashSessions.filter((session) => session.status === 'closed'), 'closedAt')[0]
    return `
  <section class="view-section"><div class="section-header"><div><p class="kicker">Caja</p><h2>Apertura y cierre</h2></div><div class="panel-inline-stats section-inline-stats">
      <span class="panel-inline-stat"><strong>${ui.openCashSession ? 'Abierta' : 'Cerrada'}</strong><span>Estado</span></span>
      <span class="panel-inline-stat"><strong>${money(ui.expectedCash)}</strong><span>Efectivo esperado</span></span>
      <span class="panel-inline-stat"><strong>${ui.enrichedCashMovements.length}</strong><span>Movimientos</span></span>
    </div></div>
    <section class="stacked-section">
      <article class="panel">
        <div class="panel-head" data-cash-operation><div><h3>Operacion de caja</h3><p>Primero ves el estado y operas solo si hace falta</p></div><div class="settings-actions">${createToggleButton('cash', showCashForm, ui.openCashSession ? 'Operar caja' : 'Abrir caja')}</div></div>
        <div class="summary-mini-row">
          <div class="summary-mini-card"><strong>Estado</strong><span>${ui.openCashSession ? 'Abierta' : 'Cerrada'}</span></div>
          <div class="summary-mini-card"><strong>Sucursal</strong><span>${ui.currentBranch?.name || '-'}</span></div>
          <div class="summary-mini-card"><strong>Caja</strong><span>${ui.openCashSession?.registerId ? (ui.enrichedRegisters.find((register) => register.id === ui.openCashSession.registerId)?.name || 'Caja') : (ui.currentRegister?.name || 'Elegi una caja')}</span></div>
          <div class="summary-mini-card"><strong>Efectivo esperado</strong><span>${money(ui.expectedCash)}</span></div>
          <div class="summary-mini-card"><strong>Ajustes manuales</strong><span>${money(ui.sessionCashMovementTotal)}</span></div>
          <div class="summary-mini-card"><strong>Ultima diferencia</strong><span>${money(lastClosedSession?.differenceAmount || 0)}</span></div>
        </div>
        ${showCashForm ? `<div class="compact-form-grid">
            <article class="panel section-panel-nested">
              <div class="panel-head"><div><h3>${ui.openCashSession ? 'Cerrar caja' : 'Abrir caja'}</h3><p>${ui.openCashSession ? 'Informa el efectivo contado' : 'Define el fondo inicial'}</p></div></div>
              <form class="form-grid compact-form" data-form="${ui.openCashSession ? 'close-cash' : 'open-cash'}">
                ${ui.openCashSession ? '' : `<label>Caja<select name="registerId" required>${ui.branchRegisters.map((register) => `<option value="${register.id}" ${ui.currentRegister?.id === register.id ? 'selected' : ''}>${register.name} (${register.code})</option>`).join('')}</select></label>`}
                <label>${ui.openCashSession ? 'Efectivo contado' : 'Monto inicial'}<input type="number" min="0" name="${ui.openCashSession ? 'countedAmount' : 'openingAmount'}" value="${ui.openCashSession ? ui.expectedCash : 0}" required /></label>
                <button type="submit">${ui.openCashSession ? 'Cerrar caja' : 'Abrir caja'}</button>
                <button type="button" class="ghost-action" data-action="close-cash-form">Cancelar</button>
              </form>
            </article>
            <article class="panel section-panel-nested"><div class="panel-head"><div><h3>Movimiento manual</h3><p>Ingresos, gastos y retiros</p></div></div>
              ${ui.openCashSession ? `<form class="form-grid compact-form" data-form="cash-movement">
                <label>Tipo<select name="kind"><option value="income">Ingreso</option><option value="deposit">Deposito</option><option value="expense">Gasto</option><option value="withdrawal">Retiro</option></select></label>
                <label>Importe<input type="number" min="1" name="amount" required /></label>
                <label class="full-span">Detalle<input type="text" name="note" placeholder="Motivo del movimiento" required /></label>
                <button type="submit">Registrar movimiento</button>
              </form>` : '<p class="empty-state">Abri una caja para registrar movimientos manuales.</p>'}
            </article>
          </div>` : ''}
      </article>
      <section class="cash-history-grid">
      <article class="panel"><div class="panel-head"><div><h3>Ultimos cierres</h3><p>Diferencias y arqueo</p></div></div><div class="timeline-list">
          ${byRecentDate(ui.scopedCashSessions.filter((session) => session.status === 'closed'), 'closedAt').slice(0, 5).map((session) => `<div class="timeline-item"><strong>Cierre · ${formatCashHistoryDate(session.closedAt)}</strong><p>Contado ${money(session.countedAmount || 0)} · Diferencia ${money(session.differenceAmount || 0)}</p><span>${ui.enrichedRegisters.find((register) => register.id === session.registerId)?.name || 'Caja'} · Fondo ${money(session.openingAmount || 0)}</span></div>`).join('') || '<p class="empty-state">Todavia no hay cierres para este filtro.</p>'}
        </div></article>
      <article class="panel"><div class="panel-head"><div><h3>Bitacora de caja</h3><p>Impacta en el arqueo esperado</p></div></div><div class="timeline-list">
          ${ui.enrichedCashMovements.slice(0, 5).map((movement) => { const label = cashMovementKindLabel(movement.kind); const note = String(movement.note || '').trim(); const hasDistinctNote = note && note.toLocaleLowerCase('es-AR') !== label.toLocaleLowerCase('es-AR'); return `<div class="timeline-item"><strong>${label}</strong><p>${escapeHtml(movement.registerName || 'Caja')} · ${money(movement.signedAmount)} · ${formatCashHistoryDate(movement.createdAt, true)}</p>${hasDistinctNote ? `<span>${escapeHtml(note)}</span>` : ''}</div>` }).join('') || '<p class="empty-state">Todavia no hay movimientos manuales.</p>'}
        </div></article>
      </section>
    </section>
  </section>
`})()}
`

const productsView = (ui) => {
  const search = productSearchQuery.trim().toLowerCase()
  const lastSoldAtByProduct = new Map()
  for (const sale of ui.enrichedSales) {
    for (const item of sale.items || []) {
      if (!lastSoldAtByProduct.has(item.productId)) lastSoldAtByProduct.set(item.productId, sale.soldAt)
    }
  }
  const matchingProducts = ui.scopedProducts.filter((product) => [product.name, product.sku, product.barcode, product.category].some((value) => String(value || '').toLowerCase().includes(search)))
  const visibleProducts = search
    ? matchingProducts
    : [...ui.scopedProducts].sort((left, right) => String(lastSoldAtByProduct.get(right.id) || '').localeCompare(String(lastSoldAtByProduct.get(left.id) || ''))).slice(0, 10)
  const productRow = (product) => {
    const margin = Number(product.salePrice || 0) > 0 ? ((Number(product.salePrice || 0) - Number(product.costPrice || 0)) / Number(product.salePrice || 0)) * 100 : 0
    if (productEditingId !== product.id) return `<article class="product-summary-row ${product.trackStock && product.scopedStock <= product.minStock ? 'is-low' : ''}">
      <div class="product-summary-main"><strong>${escapeHtml(product.name)}</strong><span>${escapeHtml(product.sku || product.barcode || 'Sin codigo')}</span></div>
      <div class="product-summary-meta"><strong>${money(product.salePrice)}</strong><span>${product.category || 'Sin categoria'} · stock ${Number(product.scopedStock || 0)}</span></div>
      <div class="product-summary-actions"><button type="button" class="inline-action" data-action="edit-product-inline" data-id="${product.id}">Editar</button></div>
    </article>`
    return `<form class="product-item ${product.trackStock && product.scopedStock <= product.minStock ? 'is-low' : ''}" data-form="product-inline">
      <input type="hidden" name="productId" value="${product.id}" />
      <label class="product-name-field">Producto<input type="text" name="name" value="${escapeHtml(product.name)}" required /></label>
      <label>SKU<input type="text" name="sku" value="${escapeHtml(product.sku || '')}" /></label>
      <label>Codigo de barras<input type="text" name="barcode" value="${escapeHtml(product.barcode || '')}" /></label>
      <label>Categoria<input type="text" name="category" value="${escapeHtml(product.category || '')}" /></label>
      <label>Minimo<input type="number" name="minStock" min="0" value="${Number(product.minStock || 0)}" /></label>
      <label>Stock suc.<span class="product-stock-value"><strong>${Number(product.scopedStock || 0)}</strong><small>Se ajusta con la accion</small></span></label>
      <label>Costo unit.<input type="number" name="costPrice" min="0" step="0.01" value="${Number(product.costPrice || 0)}" /></label>
      <label>Precio venta<input type="number" name="salePrice" min="0" step="0.01" value="${Number(product.salePrice || 0)}" /></label>
      <label>Margen %<span class="product-margin-value">${margin.toFixed(1)}%</span></label>
      <label class="field-check product-track-stock"><input type="checkbox" name="trackStock" ${product.trackStock ? 'checked' : ''} /><span class="field-check-box" aria-hidden="true"></span><span>Controlar stock</span></label>
      <div class="product-item-actions">
        <button type="submit" class="primary-action">Guardar</button>
        <button type="button" class="inline-action" data-action="adjust-product-stock" data-id="${product.id}">Ajustar stock</button>
        <button type="button" class="inline-action" data-action="transfer-product-stock" data-id="${product.id}">Transferir</button>
        <button type="button" class="ghost-action" data-action="cancel-product-inline-edit">Cancelar</button>
        <button type="button" class="danger-action" data-delete="product" data-id="${product.id}">Quitar</button>
      </div>
    </form>`
  }
  return `
  <section class="view-section"><div class="section-header"><div><p class="kicker">Productos</p><h2>Catalogo y stock</h2></div><div class="panel-inline-stats section-inline-stats">
      <span class="panel-inline-stat"><strong>${ui.scopedProducts.length}</strong><span>Productos</span></span>
      <span class="panel-inline-stat"><strong>${ui.lowStock.length}</strong><span>Stock bajo</span></span>
      <span class="panel-inline-stat"><strong>${ui.scopedStockMovements.length}</strong><span>Movimientos</span></span>
    </div></div>
    ${feedbackMessage ? `<div class="feedback-banner">${feedbackMessage}</div>` : ''}
    <section class="module-board products-board">
      <div class="module-main">
        ${productFormOpen ? `<article class="panel"><div class="panel-head"><div><h3>Nuevo producto</h3><p>Carga simple para empezar rapido</p></div><div class="settings-actions"><button type="button" class="ghost-action" data-action="close-product-form">Cerrar</button></div></div>
          <form class="form-grid" data-form="product">
            <label>Nombre<input type="text" name="name" required /></label>
            <label>SKU<input type="text" name="sku" required /></label>
            <label>Codigo de barras<input type="text" class="scanner-input" name="barcode" placeholder="Escanea o escribe codigo" /></label>
            <label>Stock<input type="number" name="stock" min="0" required /></label>
            <label>Precio venta<input type="number" name="salePrice" min="0" required /></label>
            <label>Costo<input type="number" name="costPrice" min="0" required /></label>
            <label>Minimo<input type="number" name="minStock" min="0" required /></label>
            <label>Categoria<input type="text" name="category" data-guide-category required /></label>
            <label class="field-check full-span"><input type="checkbox" name="trackStock" checked /><span class="field-check-box" aria-hidden="true"></span><span>Controlar stock de este articulo</span></label>
            <div class="full-span inline-action-group scanner-row">
              <button type="button" class="inline-action" data-action="focus-product-barcode">Usar lector</button>
              <span class="scanner-inline-copy">Captura el codigo desde un lector USB o escribilo manualmente.</span>
            </div>
            <button type="submit">Guardar producto</button>
          </form>
        </article>` : ''}
        ${stockAdjustmentFormOpen ? `<article class="panel"><div class="panel-head"><div><h3>Ajuste de stock</h3><p>Ingreso o salida manual por diferencia</p></div><div class="settings-actions"><button type="button" class="ghost-action" data-action="close-stock-adjustment-form">Cerrar</button></div></div>
          <form class="form-grid compact-form" data-form="stock-adjustment">
            <label class="stock-adjustment-product">Producto<div class="stock-adjustment-search"><span class="pos-search-icon" aria-hidden="true">${icon('<circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/>')}</span><input type="search" name="productSearch" list="stock-adjustment-product-options" autocomplete="off" placeholder="Buscar producto, SKU o codigo de barras" aria-label="Buscar producto" required /><datalist id="stock-adjustment-product-options">${ui.scopedProducts.map((product) => `<option value="${escapeHtml(product.name)}">${escapeHtml(product.sku || product.barcode || '')} · stock ${product.scopedStock}</option>`).join('')}</datalist></div></label>
            <label>Cantidad (+/-)<input type="number" name="quantity" required /></label>
            <label class="full-span">Motivo<input type="text" name="note" placeholder="Conteo, rotura, merma o correccion" required /></label>
            <button type="submit">Aplicar ajuste</button>
          </form>
        </article>` : ''}
        ${stockTransferFormOpen ? `<article class="panel"><div class="panel-head"><div><h3>Transferencia</h3><p>Movimiento entre sucursales</p></div><div class="settings-actions"><button type="button" class="ghost-action" data-action="close-stock-transfer-form">Cerrar</button></div></div>
          <form class="form-grid compact-form" data-form="stock-transfer">
            <label class="stock-adjustment-product">Producto<div class="stock-adjustment-search"><span class="pos-search-icon" aria-hidden="true">${icon('<circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/>')}</span><input type="search" name="productSearch" list="stock-transfer-product-options" autocomplete="off" placeholder="Buscar producto, SKU o codigo de barras" aria-label="Buscar producto" required /><datalist id="stock-transfer-product-options">${ui.scopedProducts.map((product) => `<option value="${escapeHtml(product.name)}">${escapeHtml(product.sku || product.barcode || '')} · stock ${product.scopedStock}</option>`).join('')}</datalist></div></label>
            <label>Cantidad<input type="number" min="1" name="quantity" required /></label>
            <label>Desde<select name="fromBranchId" required>${ui.snapshot.branches.map((branch) => `<option value="${branch.id}" ${ui.currentBranch?.id === branch.id ? 'selected' : ''}>${branch.name}</option>`).join('')}</select></label>
            <label>Hacia<select name="toBranchId" required>${ui.snapshot.branches.map((branch) => `<option value="${branch.id}">${branch.name}</option>`).join('')}</select></label>
            <label class="full-span">Detalle<input type="text" name="note" placeholder="Reposicion entre locales" /></label>
            <button type="submit">Registrar transferencia</button>
          </form>
        </article>` : ''}
        <article class="panel inventory-panel">
          <div class="panel-head inventory-headline">
            <div><h3>Inventario</h3><p>${search ? `${visibleProducts.length} resultado${visibleProducts.length === 1 ? '' : 's'}` : 'Ultimos 10 productos vendidos'}</p></div>
          </div>
          <div class="inventory-action-bar">
            ${createToggleButton('product', productFormOpen, 'Agregar producto')}
            ${createToggleButton('stock-adjustment', stockAdjustmentFormOpen, 'Ajuste de stock')}
            ${createToggleButton('stock-transfer', stockTransferFormOpen, 'Transferencia')}
          </div>
          <div class="bulk-import-card"><div class="bulk-import-copy"><strong>Carga masiva de productos</strong><span>Descarga la plantilla, completala en Excel y subila. Las columnas ya estan ordenadas para importar sin duplicar productos.</span><small>Campos obligatorios: Nombre, SKU y Precio de venta.</small></div><div class="bulk-import-actions"><button type="button" class="inline-action" data-action="download-product-template">Descargar plantilla Excel</button><label class="primary-action bulk-upload-action">Subir planilla<input type="file" data-input="bulk-product-import" accept=".csv,text/csv,.txt,text/plain" hidden /></label><button type="button" class="text-action" data-action="request-bulk-import">Prefiero que lo hagan por mi</button></div></div>
          <div class="product-search-row"><label class="stock-adjustment-search"><span class="pos-search-icon" aria-hidden="true">${icon('<circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/>')}</span><input type="search" data-product-search value="${escapeHtml(productSearchQuery)}" placeholder="Buscar producto, SKU, codigo o categoria" aria-label="Buscar productos" /></label>${search ? '<button type="button" class="ghost-action" data-action="clear-product-search">Limpiar</button>' : ''}</div>
          <div class="product-list" aria-label="Articulos del inventario">${visibleProducts.length ? visibleProducts.map(productRow).join('') : '<p class="empty-state">No encontramos productos con esa busqueda.</p>'}</div>
        </article>
      </div>
    </section>
  </section>
`
}

const purchasesView = (ui) => `
  ${(() => {
    const editingReceipt = ui.snapshot.purchaseReceipts.find((receipt) => receipt.id === purchaseEditingId)
    return `
  <section class="view-section"><div class="section-header"><div><p class="kicker">Compras</p><h2>Proveedores y recepcion</h2></div></div>
    ${feedbackMessage ? `<div class="feedback-banner">${feedbackMessage}</div>` : ''}
    <section class="dashboard-grid reports-layout">
      <article class="panel"><div class="panel-head"><div><h3>Alta de proveedor</h3><p>Base de compras</p></div></div>
        <form class="form-grid" data-form="supplier">
          <label>Empresa<input type="text" name="name" required /></label>
          <label>Contacto<input type="text" name="contact" required /></label>
          <label>Telefono<input type="text" name="phone" required /></label>
          <label>Saldo pendiente<input type="number" name="balance" min="0" required /></label>
          <label>Ultima entrega<input type="date" name="lastDelivery" value="${today}" required /></label>
          <label>Categoria<input type="text" name="category" required /></label>
          <button type="submit">Guardar proveedor</button>
        </form>
      </article>
      <article class="panel"><div class="panel-head"><div><h3>${editingReceipt ? 'Editar recepcion' : 'Recepcion de compra'}</h3><p>${editingReceipt ? 'Recalcula stock y saldo del proveedor' : 'Ingresa stock y costo'}</p></div></div>
        <form class="form-grid" data-form="purchase-receipt">
          <input type="hidden" name="receiptId" value="${editingReceipt?.id || ''}" />
          <label class="stock-adjustment-product">Proveedor<div class="stock-adjustment-search"><span class="pos-search-icon" aria-hidden="true">${icon('<circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/>')}</span><input type="search" name="supplierSearch" value="${escapeHtml(purchaseSupplierSearch || ui.snapshot.suppliers.find((supplier) => supplier.id === editingReceipt?.supplierId)?.name || '')}" list="purchase-supplier-options" autocomplete="off" placeholder="Buscar proveedor, contacto o teléfono" aria-label="Buscar proveedor" required /><datalist id="purchase-supplier-options">${ui.snapshot.suppliers.map((supplier) => `<option value="${escapeHtml(supplier.name)}">${escapeHtml([supplier.contact, supplier.phone].filter(Boolean).join(' · '))}</option>`).join('')}</datalist></div></label>
          <label class="stock-adjustment-product">Producto<div class="stock-adjustment-search"><span class="pos-search-icon" aria-hidden="true">${icon('<circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/>')}</span><input type="search" name="productSearch" value="${escapeHtml(ui.snapshot.products.find((product) => product.id === editingReceipt?.productId)?.name || '')}" list="purchase-product-options" autocomplete="off" placeholder="Buscar producto, SKU o codigo de barras" aria-label="Buscar producto" required /><datalist id="purchase-product-options">${ui.snapshot.products.map((product) => `<option value="${escapeHtml(product.name)}">${escapeHtml(product.sku || product.barcode || '')}</option>`).join('')}</datalist></div></label>
          <label>Comprobante<input type="text" name="documentNumber" value="${editingReceipt?.documentNumber || ''}" placeholder="FAC-000123" /></label>
          <label>Cantidad<input type="number" min="1" name="quantity" value="${editingReceipt?.quantity || ''}" required /></label>
          <label>Costo unitario<input type="number" min="0" name="unitCost" value="${editingReceipt?.unitCost || ''}" required /></label>
          <label class="full-span">Observaciones<input type="text" name="note" value="${editingReceipt?.note || ''}" placeholder="Pedido, lote, condicion o referencia" /></label>
          <button type="submit">${editingReceipt ? 'Guardar cambios' : 'Registrar recepcion'}</button>
          ${editingReceipt ? '<button type="button" class="danger-action" data-action="cancel-purchase-edit">Cancelar edicion</button>' : ''}
        </form>
      </article>
      <article class="panel"><div class="panel-head"><div><h3>Recepciones recientes</h3><p>Con impacto en stock</p></div></div>
        ${dataTable(['Proveedor', 'Producto', 'Cantidad', 'Costo', 'Accion'], ui.enrichedReceipts.map((receipt) => `<div class="data-row"><span>${receipt.supplierName}<br /><small>${receipt.documentNumber || 'Sin comprobante'}</small></span><span>${receipt.productName}${receipt.note ? `<br /><small>${receipt.note}</small>` : ''}</span><span>${receipt.quantity}</span><span>${money(receipt.totalCost)}</span><span>${purchaseActionButtons(receipt)}</span></div>`))}
      </article>
      <article class="panel"><div class="panel-head"><div><h3>Proveedores</h3><p>Saldos y categorias</p></div></div>
        ${dataTable(['Proveedor', 'Categoria', 'Saldo', 'Ultima', 'Accion'], ui.snapshot.suppliers.map((supplier) => `<div class="data-row"><span>${supplier.name}</span><span>${supplier.category}</span>${balanceBadge(supplier.balance)}<span>${supplier.lastDelivery}</span><span>${actionButton('supplier', supplier.id)}</span></div>`))}
      </article>
    </section>
  </section>
`})()}
`

const purchasesViewLegacy = (ui) => `
  ${(() => {
    const editingReceipt = ui.snapshot.purchaseReceipts.find((receipt) => receipt.id === purchaseEditingId)
    return `
  <section class="view-section"><div class="section-header"><div><p class="kicker">Compras</p><h2>Proveedores y recepcion</h2></div><div class="panel-inline-stats section-inline-stats">
      <span class="panel-inline-stat"><strong>${ui.snapshot.suppliers.length}</strong><span>Proveedores</span></span>
      <span class="panel-inline-stat"><strong>${ui.enrichedReceipts.length}</strong><span>Compras</span></span>
      <span class="panel-inline-stat"><strong>${money(ui.snapshot.suppliers.reduce((sum, supplier) => sum + Number(supplier.balance || 0), 0))}</strong><span>Saldo</span></span>
    </div></div>
    ${feedbackMessage ? `<div class="feedback-banner">${feedbackMessage}</div>` : ''}
    <section class="module-board purchases-board ${showPurchaseForm ? '' : 'board-expanded'}">
      <div class="module-main">
        <article class="panel"><div class="panel-head"><div><h3>${editingReceipt ? 'Editar recepcion' : 'Recepcion de compra'}</h3><p>${editingReceipt ? 'Recalcula stock y saldo del proveedor' : 'Ingresa stock y costo'}</p></div></div>
          <form class="form-grid compact-form" data-form="purchase-receipt">
            <input type="hidden" name="receiptId" value="${editingReceipt?.id || ''}" />
            <label>Proveedor<select name="supplierId" required>${ui.snapshot.suppliers.map((supplier) => `<option value="${supplier.id}" ${editingReceipt?.supplierId === supplier.id ? 'selected' : ''}>${supplier.name}</option>`).join('')}</select></label>
            <label class="stock-adjustment-product">Producto<div class="stock-adjustment-search"><span class="pos-search-icon" aria-hidden="true">${icon('<circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/>')}</span><input type="search" name="productSearch" value="${escapeHtml(ui.snapshot.products.find((product) => product.id === editingReceipt?.productId)?.name || '')}" list="purchase-product-options" autocomplete="off" placeholder="Buscar producto, SKU o codigo de barras" aria-label="Buscar producto" required /><datalist id="purchase-product-options">${ui.snapshot.products.map((product) => `<option value="${escapeHtml(product.name)}">${escapeHtml(product.sku || product.barcode || '')}</option>`).join('')}</datalist></div></label>
            <label>Comprobante<input type="text" name="documentNumber" value="${editingReceipt?.documentNumber || ''}" placeholder="FAC-000123" /></label>
            <label>Cantidad<input type="number" min="1" name="quantity" value="${editingReceipt?.quantity || ''}" required /></label>
            <label>Costo unitario<input type="number" min="0" name="unitCost" value="${editingReceipt?.unitCost || ''}" required /></label>
            <label class="full-span">Observaciones<input type="text" name="note" value="${editingReceipt?.note || ''}" placeholder="Pedido, lote, condicion o referencia" /></label>
            <button type="submit">${editingReceipt ? 'Guardar cambios' : 'Registrar recepcion'}</button>
            ${editingReceipt ? '<button type="button" class="danger-action" data-action="cancel-purchase-edit">Cancelar edicion</button>' : ''}
          </form>
        </article>
        <div class="compact-form-grid">
          <article class="panel"><div class="panel-head"><div><h3>Recepciones recientes</h3><p>Con impacto en stock</p></div></div>
            ${dataTable(['Proveedor', 'Producto', 'Cantidad', 'Costo', 'Accion'], ui.enrichedReceipts.map((receipt) => `<div class="data-row"><span>${receipt.supplierName}<br /><small>${receipt.documentNumber || 'Sin comprobante'}</small></span><span>${receipt.productName}${receipt.note ? `<br /><small>${receipt.note}</small>` : ''}</span><span>${receipt.quantity}</span><span>${money(receipt.totalCost)}</span><span>${purchaseActionButtons(receipt)}</span></div>`))}
          </article>
          <article class="panel"><div class="panel-head"><div><h3>Proveedores</h3><p>Base visible para comprar y reponer</p></div></div>
            <div class="settings-actions">${createToggleButton('supplier', supplierFormOpen, 'Agregar proveedor')}</div>
            ${dataTable(['Proveedor', 'Categoria', 'Saldo', 'Ultima', 'Accion'], ui.snapshot.suppliers.map((supplier) => `<div class="data-row"><span>${supplier.name}</span><span>${supplier.category}</span>${balanceBadge(supplier.balance)}<span>${supplier.lastDelivery}</span><span>${actionButton('supplier', supplier.id)}</span></div>`))}
          </article>
        </div>
        ${supplierFormOpen ? `<article class="panel"><div class="panel-head"><div><h3>Nuevo proveedor</h3><p>Base comercial de compras</p></div></div>
          <form class="form-grid" data-form="supplier">
            <label>Empresa<input type="text" name="name" required /></label>
            <label>Contacto<input type="text" name="contact" required /></label>
            <label>Telefono<input type="text" name="phone" required /></label>
            <label>Saldo pendiente<input type="number" name="balance" min="0" required /></label>
            <label>Ultima entrega<input type="date" name="lastDelivery" value="${today}" required /></label>
            <label>Categoria<input type="text" name="category" required /></label>
            <button type="submit">Guardar proveedor</button>
          </form>
        </article>` : ''}
      </div>
    </section>
  </section>
`})()}
`

const purchasesViewV2 = (ui) => `
  ${(() => {
    const editingReceipt = ui.snapshot.purchaseReceipts.find((receipt) => receipt.id === purchaseEditingId)
    const editingSupplier = ui.snapshot.suppliers.find((supplier) => supplier.id === supplierEditingId)
    const supplierQuery = supplierSearchQuery.trim().toLowerCase()
    const normalizeSupplierSearch = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const matchesSupplierQuery = (value) => {
      const candidate = normalizeSupplierSearch(value)
      const query = normalizeSupplierSearch(supplierQuery)
      return !query || candidate.includes(query)
    }
    const visibleSuppliers = (supplierQuery ? ui.snapshot.suppliers.filter((supplier) => [supplier.name, supplier.fantasyName, supplier.tradeName, supplier.contact, supplier.phone, supplier.email, supplier.cuit, supplier.address].some(matchesSupplierQuery)) : ui.snapshot.suppliers.slice(0, 10))
    const receiptPreview = purchaseReceiptsExpanded ? ui.enrichedReceipts : ui.enrichedReceipts.slice(0, 3)
    const supplierPreview = supplierQuery ? visibleSuppliers : (purchaseSuppliersExpanded ? ui.snapshot.suppliers : ui.snapshot.suppliers.slice(0, 3))
    const debtSuppliers = ui.snapshot.suppliers.filter((supplier) => Number(supplier.balance || 0) > 0)
    const paymentHistory = (ui.snapshot.supplierPayments || []).slice(0, 6)
    const showPurchaseForm = purchaseFormOpen || Boolean(editingReceipt)
    if (editingReceipt && !Object.keys(purchaseDraftItems).length) {
      const product = ui.snapshot.products.find((item) => item.id === editingReceipt.productId)
      if (product) purchaseDraftItems = { [product.id]: { productId: product.id, quantity: editingReceipt.quantity, unitCost: editingReceipt.unitCost, name: product.name, sku: product.sku || '', barcode: product.barcode || '', category: product.category || 'General', minStock: Number(product.minStock || 0), salePrice: Number(product.salePrice || 0), trackStock: product.trackStock !== false } }
    }
    const purchaseLines = Object.entries(purchaseDraftItems).map(([key, detail]) => {
      const product = detail.productId ? ui.snapshot.products.find((item) => item.id === detail.productId) : ui.snapshot.products.find((item) => item.id === key)
      return { key, product, isNew: Boolean(detail.isNew), ...detail, name: detail.name ?? product?.name ?? '', sku: detail.sku ?? product?.sku ?? '', barcode: detail.barcode ?? product?.barcode ?? '', category: detail.category ?? product?.category ?? 'General', minStock: Number(detail.minStock ?? product?.minStock ?? 0), salePrice: Number(detail.salePrice ?? product?.salePrice ?? 0), trackStock: detail.trackStock ?? product?.trackStock !== false }
    }).filter((line) => line.isNew || line.product)
    return `
  <section class="view-section"><div class="section-header"><div><p class="kicker">Compras</p><h2>Proveedores y recepcion</h2></div><div class="panel-inline-stats section-inline-stats">
      <span class="panel-inline-stat"><strong>${ui.snapshot.suppliers.length}</strong><span>Proveedores</span></span>
      <span class="panel-inline-stat"><strong>${ui.enrichedReceipts.length}</strong><span>Recepciones</span></span>
      <span class="panel-inline-stat"><strong>${money(ui.snapshot.suppliers.reduce((sum, supplier) => sum + Number(supplier.balance || 0), 0))}</strong><span>Saldo proveedor</span></span>
    </div></div>
    ${feedbackMessage ? `<div class="feedback-banner">${feedbackMessage}</div>` : ''}
    <section class="stacked-section">
      ${showPurchaseForm ? `<article class="panel">
        <div class="panel-head"><div><h3>${editingReceipt ? 'Editar compra' : 'Nueva compra'}</h3><p>Ingresa stock y costo del proveedor</p></div><div class="settings-actions">${editingReceipt ? '' : '<button type="button" class="ghost-action" data-action="close-purchase-form">Cerrar</button>'}</div></div>
        <form class="form-grid compact-form" data-form="purchase-receipt">
          <input type="hidden" name="receiptId" value="${editingReceipt?.id || ''}" />
          <input type="hidden" name="purchaseItems" value="${escapeHtml(JSON.stringify(purchaseLines.map((line) => ({ key: line.key, productId: line.product?.id || '', isNew: line.isNew, name: line.name, sku: line.sku, barcode: line.barcode, category: line.category, minStock: line.minStock, trackStock: line.trackStock, quantity: line.quantity, unitCost: line.unitCost, salePrice: line.salePrice }))))}" />
          <label class="stock-adjustment-product">Proveedor<div class="stock-adjustment-search"><span class="pos-search-icon" aria-hidden="true">${icon('<circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/>')}</span><input type="search" name="supplierSearch" value="${escapeHtml(purchaseSupplierSearch || ui.snapshot.suppliers.find((supplier) => supplier.id === editingReceipt?.supplierId)?.name || '')}" list="purchase-supplier-options" autocomplete="off" placeholder="Buscar proveedor, contacto o teléfono" aria-label="Buscar proveedor" required /><datalist id="purchase-supplier-options">${ui.snapshot.suppliers.map((supplier) => `<option value="${escapeHtml(supplier.name)}">${escapeHtml([supplier.contact, supplier.phone].filter(Boolean).join(' · '))}</option>`).join('')}</datalist></div></label>
          <label class="stock-adjustment-product">Agregar productos<div class="purchase-product-add"><div class="stock-adjustment-search"><span class="pos-search-icon" aria-hidden="true">${icon('<circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/>')}</span><input type="search" data-purchase-product-search value="${escapeHtml(purchaseQuickAddCode)}" list="purchase-product-options" autocomplete="off" placeholder="Buscar producto, SKU o código de barras" aria-label="Buscar producto" /><datalist id="purchase-product-options">${ui.snapshot.products.map((product) => `<option value="${escapeHtml(product.name)}">${escapeHtml(product.sku || product.barcode || '')}</option>`).join('')}</datalist></div><button type="button" class="ghost-action" data-action="add-new-purchase-product">Nuevo producto</button></div></label>
          <label>Comprobante<input type="text" name="documentNumber" value="${editingReceipt?.documentNumber || ''}" placeholder="FAC-000123" /></label>
          <div class="purchase-payment-hint"><strong>Condición de pago</strong><span>Al contado, parcial o a cuenta corriente se registra al confirmar el pago al proveedor.</span></div>
          <div class="full-span purchase-cart">${purchaseLines.length ? purchaseLines.map((line) => { const margin = Number(line.unitCost) > 0 ? ((Number(line.salePrice) - Number(line.unitCost)) / Number(line.unitCost)) * 100 : 0; const field = (label, name, value, extra = '') => `<label><span>${label}</span><input ${extra} value="${escapeHtml(String(value ?? ''))}" data-purchase-field="${line.key}" data-field="${name}" /></label>`; return `<div class="purchase-line">${field('Producto', 'name', line.name, 'type="text" required')}${field('SKU', 'sku', line.sku, 'type="text"')}${field('Código barras', 'barcode', line.barcode, 'type="text"')}${field('Categoría', 'category', line.category, 'type="text"')}${field('Mínimo', 'minStock', line.minStock, 'type="number" min="0"')}${field('Cantidad', 'quantity', line.quantity, 'type="number" min="1" required')}${field('Costo unit.', 'unitCost', line.unitCost, 'type="number" min="0" required')}${field('Precio venta', 'salePrice', line.salePrice, 'type="number" min="0" required step="0.01"')}${field('Margen %', 'margin', margin.toFixed(1), 'type="number" min="0" step="0.1"')}<div class="purchase-line-stock-action"><label class="checkbox-row compact-toggle purchase-stock-toggle"><input type="checkbox" ${line.trackStock ? 'checked' : ''} data-purchase-field="${line.key}" data-field="trackStock" /><span>Controlar stock</span></label><button type="button" class="inline-action danger" data-action="remove-purchase-product" data-id="${line.key}">Quitar</button></div></div>` }).join('') : '<div class="pos-cart-empty"><strong>Compra vacía</strong><span>Buscá un producto o creá uno nuevo para agregarlo a la compra.</span></div>'}</div>
          <label class="full-span">Observaciones<input type="text" name="note" value="${editingReceipt?.note || ''}" placeholder="Pedido, lote o condicion" /></label>
          <div class="purchase-form-actions full-span"><button type="submit" ${purchaseLines.length ? '' : 'disabled'}>${editingReceipt ? 'Guardar cambios' : 'Registrar compra'}</button>${editingReceipt ? '<button type="button" class="danger-action" data-action="cancel-purchase-edit">Cancelar edición</button>' : '<button type="button" class="ghost-action" data-action="close-purchase-form">Cancelar</button>'}</div>
        </form>
      </article>` : ''}
      ${supplierPaymentDraft ? (() => { const supplier = ui.snapshot.suppliers.find((entry) => entry.id === supplierPaymentDraft.supplierId); const suggestedAmount = Math.min(Number(supplierPaymentDraft.amount || 0), Number(supplier?.balance || 0)); return supplier ? `<article class="panel supplier-payment-panel"><div class="panel-head"><div><h3>Registrar pago al proveedor</h3><p>${escapeHtml(supplier.name)} · Compra registrada por ${money(supplierPaymentDraft.amount)} · Saldo pendiente ${money(supplier.balance)}</p></div></div><form class="form-grid compact-form" data-form="supplier-payment"><input type="hidden" name="supplierId" value="${supplier.id}" /><label>Importe a pagar<input type="number" name="amount" min="0.01" max="${supplier.balance}" step="0.01" value="${suggestedAmount}" required /></label><label>Medio de pago<select name="method"><option value="cash">Efectivo</option><option value="transfer" selected>Transferencia</option><option value="cheque">Cheque</option><option value="echeq">E-cheq</option><option value="mercado_pago">Mercado Pago</option><option value="other">Otro</option></select></label><label class="full-span">Referencia (opcional)<input name="reference" placeholder="Nº de transferencia, cheque o comprobante" /></label><div class="purchase-form-actions full-span"><button type="submit">Registrar pago</button><button type="button" class="ghost-action" data-action="leave-supplier-payment">Dejar pendiente</button></div></form></article>` : '' })() : ''}
      ${supplierPaymentPanelOpen ? `<article class="panel supplier-payment-panel"><div class="panel-head"><div><h3>Pagos a proveedores</h3><p>Buscá solamente proveedores con saldo pendiente.</p></div><button type="button" class="ghost-action" data-action="close-supplier-payment-panel">Cerrar</button></div><form class="form-grid compact-form" data-form="supplier-payment"><label class="stock-adjustment-product">Proveedor<div class="stock-adjustment-search"><span class="pos-search-icon" aria-hidden="true">${icon('<circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/>')}</span><input type="search" name="supplierSearch" list="supplier-payment-options" autocomplete="off" placeholder="Buscar proveedor con deuda" required /><datalist id="supplier-payment-options">${debtSuppliers.map((supplier) => `<option value="${escapeHtml(supplier.name)}">Saldo ${money(supplier.balance)}</option>`).join('')}</datalist></div></label><label>Importe a pagar<input type="number" name="amount" min="0.01" step="0.01" required /></label><label>Medio de pago<select name="method"><option value="cash">Efectivo</option><option value="transfer" selected>Transferencia</option><option value="cheque">Cheque</option><option value="echeq">E-cheq</option><option value="mercado_pago">Mercado Pago</option><option value="other">Otro</option></select></label><label>Referencia (opcional)<input name="reference" placeholder="Nº de transferencia, cheque o comprobante" /></label><div class="purchase-form-actions full-span"><button type="submit" ${debtSuppliers.length ? '' : 'disabled'}>Registrar pago</button></div></form>${paymentHistory.length ? `<div class="timeline-list purchase-payment-history">${paymentHistory.map((payment) => { const supplier = ui.snapshot.suppliers.find((entry) => entry.id === payment.supplierId); return `<div class="timeline-item"><strong>${escapeHtml(supplier?.name || 'Proveedor')} · ${money(payment.amount)}</strong><p>${escapeHtml(payment.method || 'Pago')} ${payment.reference ? `· ${escapeHtml(payment.reference)}` : ''}</p></div>` }).join('')}</div>` : '<p class="empty-state">Los pagos registrados aparecerán acá.</p>'}</article>` : ''}
      ${supplierFormOpen ? `<article class="panel"><div class="panel-head"><div><h3>${editingSupplier ? 'Editar proveedor' : 'Nuevo proveedor'}</h3><p>Contacto, direccion y datos fiscales</p></div><div class="settings-actions"><button type="button" class="ghost-action" data-action="close-supplier-form">Cerrar</button></div></div>
        <form class="form-grid" data-form="supplier">
          <input type="hidden" name="supplierId" value="${editingSupplier?.id || ''}" />
          <label>Empresa<input type="text" name="name" value="${escapeHtml(editingSupplier?.name || '')}" required /></label>
          <label>Contacto<input type="text" name="contact" value="${escapeHtml(editingSupplier?.contact || '')}" /></label>
          <label>Telefono<input type="text" name="phone" value="${escapeHtml(editingSupplier?.phone || '')}" /></label>
          <label>Email<input type="email" name="email" value="${escapeHtml(editingSupplier?.email || '')}" /></label>
          <label>CUIT<input type="text" name="cuit" value="${escapeHtml(editingSupplier?.cuit || '')}" /></label>
          <label class="full-span">Direccion<input type="text" name="address" data-address-map-input value="${escapeHtml(editingSupplier?.address || '')}" placeholder="Calle, numero, localidad" /></label>
          <div class="address-map full-span"><div><strong>Ubicacion en Google Maps</strong><a class="inline-action" data-address-map-link target="_blank" rel="noreferrer" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(editingSupplier?.address || '')}">Abrir en Maps</a></div><iframe data-address-map title="Mapa de la direccion del proveedor" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${editingSupplier?.address ? `https://www.google.com/maps?q=${encodeURIComponent(editingSupplier.address)}&output=embed` : 'about:blank'}"></iframe><p data-address-map-empty ${editingSupplier?.address ? 'hidden' : ''}>Escribí una dirección para visualizarla en el mapa.</p></div>
          <label>Saldo pendiente<input type="number" name="balance" min="0" value="${editingSupplier?.balance || 0}" /></label>
          <label>Ultima entrega<input type="date" name="lastDelivery" value="${editingSupplier?.lastDelivery || today}" /></label>
          <label>Categoria<input type="text" name="category" value="${escapeHtml(editingSupplier?.category || '')}" placeholder="Opcional" /></label>
          <button type="submit">${editingSupplier ? 'Guardar cambios' : 'Guardar proveedor'}</button>
        </form>
      </article>` : ''}
      <article class="panel">
        <div class="panel-head"><div><h3>Base de compras</h3><p>Ves proveedores y recepciones, y agregas solo cuando hace falta</p></div></div>
        <div class="purchase-actions">
          ${editingReceipt ? '' : createToggleButton('purchase', showPurchaseForm, 'Agregar compra')}
          ${createToggleButton('supplier', supplierFormOpen, 'Agregar proveedor')}
          <button type="button" class="add-action${supplierPaymentPanelOpen ? ' is-open' : ''}" data-action="open-supplier-payment-panel"><span class="add-action-icon" aria-hidden="true">${supplierPaymentPanelOpen ? '&times;' : '+'}</span><span>Pagos a proveedores</span></button>
        </div>
        <div class="purchase-list-grid">
          <article class="panel purchase-summary-card">
            <div class="panel-head"><div><h3>Recepciones recientes</h3><p>${purchaseReceiptsExpanded ? `Mostrando ${ui.enrichedReceipts.length}` : 'Últimas 3 recepciones'}</p></div>${ui.enrichedReceipts.length > 3 ? `<button type="button" class="ghost-action" data-action="toggle-purchase-receipts">${purchaseReceiptsExpanded ? 'Ver menos' : 'Ver más'}</button>` : ''}</div>
            <div class="timeline-list purchase-receipt-list">${receiptPreview.map((receipt) => `<div class="timeline-item purchase-receipt-card"><div><strong>${escapeHtml(receipt.supplierName)}</strong><p>${escapeHtml(receipt.productName)}</p><span>${receipt.documentNumber || 'Sin comprobante'} · Cant. ${receipt.quantity} · ${money(receipt.totalCost)}</span></div><span class="purchase-receipt-actions">${purchaseActionButtons(receipt)}</span></div>`).join('') || '<p class="empty-state">Todavía no hay recepciones.</p>'}</div>
          </article>
          <article class="panel purchase-summary-card">
            <div class="panel-head"><div><h3>${supplierQuery ? 'Resultados' : 'Proveedores recientes'}</h3><p>${supplierQuery ? `${visibleSuppliers.length} coincidencia${visibleSuppliers.length === 1 ? '' : 's'} sugerida${visibleSuppliers.length === 1 ? '' : 's'}` : (purchaseSuppliersExpanded ? `Mostrando ${ui.snapshot.suppliers.length}` : 'Últimos 3 proveedores')}</p></div>${!supplierQuery && ui.snapshot.suppliers.length > 3 ? `<button type="button" class="ghost-action" data-action="toggle-purchase-suppliers">${purchaseSuppliersExpanded ? 'Ver menos' : 'Ver más'}</button>` : ''}</div>
            <div class="stock-adjustment-search"><span class="pos-search-icon" aria-hidden="true">${icon('<circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/>')}</span><input type="search" data-supplier-search value="${escapeHtml(supplierSearchQuery)}" placeholder="Buscar por proveedor, contacto o dirección" aria-label="Buscar proveedor" /></div>
            <div class="timeline-list">${supplierPreview.map((supplier) => `<div class="timeline-item contact-result"><button type="button" class="contact-result-main" data-action="view-supplier-map" data-id="${supplier.id}"><strong>${escapeHtml(supplier.name)}</strong><p>${escapeHtml(supplier.contact || supplier.phone || supplier.cuit || 'Sin datos de contacto')}</p><span>${escapeHtml(supplier.address || 'Sin dirección')} · ${balanceText(supplier.balance)} ${money(supplier.balance)}</span></button><span class="contact-result-actions">${rowActionsMenu('Acciones de proveedor', `<button type="button" class="inline-action" data-action="edit-supplier" data-id="${supplier.id}">Editar</button>${actionButton('supplier', supplier.id)}`)}</span>${supplierMapPreviewId === supplier.id ? `<div class="supplier-map-preview">${supplier.address ? `<iframe title="Ubicación de ${escapeHtml(supplier.name)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${encodeURIComponent(supplier.address)}&output=embed"></iframe><a class="inline-action" target="_blank" rel="noreferrer" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(supplier.address)}">Abrir en Maps</a>` : '<p>Este proveedor todavía no tiene una dirección cargada.</p>'}</div>` : ''}</div>`).join('') || '<p class="empty-state">No hay proveedores para esta busqueda.</p>'}</div>
          </article>
        </div>
      </article>
    </section>
  </section>
`})()}
`

const invoicesView = (ui) => `
  ${(() => {
    const editingInvoice = ui.snapshot.invoices.find((invoice) => invoice.id === invoiceEditingId)
    const showInvoiceForm = invoiceFormOpen || Boolean(editingInvoice)
    return `
  <section class="view-section"><div class="section-header"><div><p class="kicker">Facturacion</p><h2>Comprobantes</h2></div></div>
    <section class="content-grid single-focus">
      <article class="panel"><div class="panel-head"><div><h3>${editingInvoice ? 'Editar factura' : 'Nueva factura'}</h3><p>Numeracion real por sucursal</p></div></div>
        <form class="form-grid" data-form="invoice">
          <input type="hidden" name="invoiceId" value="${editingInvoice?.id || ''}" />
          <label>Numero de comprobante<input type="text" name="number" value="${editingInvoice?.number || ''}" placeholder="Interno: se genera con el local · ARCA: numero aprobado" /></label>
          <label>Cliente<select name="customerId" required>${ui.snapshot.customers.map((customer) => `<option value="${customer.id}" ${editingInvoice?.customerId === customer.id ? 'selected' : ''}>${customer.fullName}</option>`).join('')}</select></label>
          <label>Clase<select name="kind"><option ${editingInvoice?.kind === 'Factura' || !editingInvoice ? 'selected' : ''}>Factura</option><option ${editingInvoice?.kind === 'Ticket' ? 'selected' : ''}>Ticket</option><option ${editingInvoice?.kind === 'Presupuesto' ? 'selected' : ''}>Presupuesto</option><option ${editingInvoice?.kind === 'Remito' ? 'selected' : ''}>Remito</option><option ${editingInvoice?.kind === 'Nota de credito' ? 'selected' : ''}>Nota de credito</option></select></label>
          <label>Total<input type="number" min="1" name="totalAmount" value="${editingInvoice?.totalAmount || ''}" required /></label>
          <label>Tipo<select name="type"><option ${editingInvoice?.type === 'A' ? 'selected' : ''}>A</option><option ${editingInvoice?.type === 'B' || !editingInvoice ? 'selected' : ''}>B</option><option ${editingInvoice?.type === 'C' ? 'selected' : ''}>C</option></select></label>
          <label>Vencimiento<input type="date" name="dueDate" value="${editingInvoice?.dueDate || today}" required /></label>
          <label>Estado<select name="status"><option ${editingInvoice?.status === 'Emitida' || !editingInvoice ? 'selected' : ''}>Emitida</option><option ${editingInvoice?.status === 'En revision' ? 'selected' : ''}>En revision</option><option ${editingInvoice?.status === 'Cobrada' ? 'selected' : ''}>Cobrada</option></select></label>
          <label>Emision<select name="fiscalStatus"><option value="Interno" ${editingInvoice?.fiscalStatus === 'Interno' || !editingInvoice ? 'selected' : ''}>Interno</option><option value="Pendiente" ${editingInvoice?.fiscalStatus === 'Pendiente' ? 'selected' : ''}>ARCA · Pendiente</option><option value="Listo para enviar" ${editingInvoice?.fiscalStatus === 'Listo para enviar' ? 'selected' : ''}>ARCA · Listo para enviar</option><option value="Aprobado" ${editingInvoice?.fiscalStatus === 'Aprobado' ? 'selected' : ''}>ARCA · Aprobado</option><option value="Rechazado" ${editingInvoice?.fiscalStatus === 'Rechazado' ? 'selected' : ''}>ARCA · Rechazado</option><option value="Anulado" ${editingInvoice?.fiscalStatus === 'Anulado' ? 'selected' : ''}>ARCA · Anulado</option></select></label>
          <p class="form-note full-span">Los comprobantes internos se numeran automaticamente con la sucursal actual. Para ARCA, carga el numero informado por ARCA; no se genera uno interno.</p>
          <button type="submit">${editingInvoice ? 'Guardar cambios' : 'Guardar factura'}</button>
          ${editingInvoice ? '<button type="button" class="danger-action" data-action="cancel-invoice-edit">Cancelar edicion</button>' : ''}
        </form>
      </article>
      <article class="panel"><div class="panel-head"><div><h3>Comprobantes</h3><p>Seguimiento comercial y fiscal</p></div></div>
        ${dataTable(['Comprobante', 'Cliente', 'Sucursal', 'Total', 'Accion'], ui.enrichedInvoices.map((invoice) => `<div class="data-row" data-invoice-id="${invoice.id}"><span><strong>${invoice.number}</strong><br /><small>${invoiceEmissionLabel(invoice)} · ${invoice.branchName}</small></span><span>${invoice.customerName || 'Consumidor final'}<br /><small>${invoice.kind || 'Factura'} / ${invoice.fiscalStatus || 'Pendiente'}</small></span><span>${invoice.branchName}<br /><small>${invoice.status}</small></span><span>${money(invoice.totalAmount)}</span><span>${invoiceActionButtons(invoice)}</span></div>`), 'is-stable invoices-table')}
      </article>
    </section>
  </section>
`})()}
`

const invoicesViewV2 = (ui) => `
  ${(() => {
    const showInvoiceForm = invoiceFormOpen
    const paymentInvoice = ui.snapshot.invoices.find((invoice) => invoice.id === invoicePaymentId)
    const paymentBalance = invoiceBalance(paymentInvoice)
    return `
  <section class="view-section"><div class="section-header"><div><p class="kicker">Facturacion</p><h2>Comprobantes</h2></div><div class="panel-inline-stats section-inline-stats">
      <span class="panel-inline-stat"><strong>${ui.enrichedInvoices.length}</strong><span>Comprobantes</span></span>
      <span class="panel-inline-stat"><strong>${ui.enrichedInvoices.filter((invoice) => invoice.status !== 'Cobrada').length}</strong><span>Abiertas</span></span>
      <span class="panel-inline-stat"><strong>${money(ui.enrichedInvoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0))}</strong><span>Monto total</span></span>
    </div></div>
    ${feedbackMessage ? `<div class="feedback-banner">${feedbackMessage}</div>` : ''}
    <section class="stacked-section">
      ${showInvoiceForm ? `<article class="panel"><div class="panel-head"><div><h3>Nueva factura</h3><p>Numeracion real por sucursal</p></div><div class="settings-actions"><button type="button" class="ghost-action" data-action="close-invoice-form">Cerrar</button></div></div>
        <form class="form-grid" data-form="invoice">
          <label>Numero de comprobante<input type="text" name="number" placeholder="Interno: se genera con el local · ARCA: numero aprobado" /></label>
          <label>Cliente<select name="customerId" required>${ui.snapshot.customers.map((customer) => `<option value="${customer.id}">${customer.fullName}</option>`).join('')}</select></label>
          <label>Clase<select name="kind"><option selected>Factura</option><option>Ticket</option><option>Presupuesto</option><option>Remito</option><option>Nota de credito</option></select></label>
          <label>Total<input type="number" min="1" name="totalAmount" required /></label>
          <label>Tipo<select name="type"><option>A</option><option selected>B</option><option>C</option></select></label>
          <label>Vencimiento<input type="date" name="dueDate" value="${today}" required /></label>
          <label>Estado<select name="status"><option selected>Emitida</option><option>En revision</option><option>Cobrada</option></select></label>
          <label>Emision<select name="fiscalStatus"><option value="Interno" selected>Interno</option><option value="Pendiente">ARCA · Pendiente</option><option value="Listo para enviar">ARCA · Listo para enviar</option><option value="Aprobado">ARCA · Aprobado</option><option value="Rechazado">ARCA · Rechazado</option><option value="Anulado">ARCA · Anulado</option></select></label>
          <p class="form-note full-span">Los comprobantes internos se numeran automaticamente con la sucursal actual. Para ARCA, carga el numero informado por ARCA; no se genera uno interno.</p>
          <button type="submit">Guardar factura</button>
          <button type="button" class="ghost-action" data-action="close-invoice-form">Cancelar</button>
        </form>
      </article>` : ''}
      ${paymentInvoice ? `<article class="panel invoice-payment-panel"><div class="panel-head"><div><h3>Registrar cobro</h3><p>${paymentInvoice.number} · Saldo pendiente ${money(paymentBalance)}</p></div><div class="settings-actions"><button type="button" class="ghost-action" data-action="close-invoice-payment">Cerrar</button></div></div>
        <form class="form-grid compact-form" data-form="invoice-payment">
          <input type="hidden" name="invoiceId" value="${paymentInvoice.id}" />
          <label>Importe del abono<input type="number" name="amount" min="1" max="${paymentBalance}" step="0.01" value="${paymentBalance}" required /></label>
          <label>Medio de pago<select name="method"><option value="cash">Efectivo</option><option value="transfer" selected>Transferencia</option><option value="mercado_pago">Mercado Pago</option><option value="echeq">E-cheq</option></select></label>
          <label class="full-span">Referencia (opcional)<input type="text" name="reference" placeholder="Ej.: comprobante, operación o nota" /></label>
          <div class="form-note full-span">Podés registrar un abono parcial o pagar el saldo completo. El saldo pendiente se actualiza automáticamente.</div>
          <div class="invoice-payment-actions full-span">
            <button type="submit" name="paymentMode" value="partial">Registrar abono</button>
            <button type="submit" class="primary-action" name="paymentMode" value="full">Pagar saldo completo</button>
            <button type="button" class="ghost-action" data-action="close-invoice-payment">Cancelar</button>
          </div>
        </form>
      </article>` : ''}
      <article class="panel">
        <div class="panel-head"><div><h3>Comprobantes</h3><p>Seguimiento comercial y numeracion</p></div><div class="settings-actions">${createToggleButton('invoice', showInvoiceForm, 'Agregar comprobante')}</div></div>
        ${dataTable(['Comprobante', 'Cliente', 'Sucursal', 'Total', 'Acciones'], ui.enrichedInvoices.map((invoice) => `<div class="data-row invoice-open-row" data-invoice-open="${invoice.id}" tabindex="0" role="button" aria-label="Abrir factura ${invoice.number}"><span><strong>${invoice.number}</strong><br /><small>${invoiceEmissionLabel(invoice)} · ${invoice.branchName}</small></span><span>${invoice.customerName || 'Consumidor final'}<br /><small>${invoice.kind || 'Factura'} / ${invoice.fiscalStatus || 'Pendiente'}</small></span><span>${invoice.branchName}<br /><small>${invoice.status}</small></span><span>${money(invoice.totalAmount)}<br /><small>Saldo: ${money(invoiceBalance(invoice))}</small></span><span>${invoiceActionButtons(invoice)}</span></div>`), 'invoices-table invoice-compact-table')}
      </article>
    </section>
  </section>
`})()}
`

const ticketsView = (ui) => `
  ${(() => {
    const editingTicket = ui.snapshot.tickets.find((ticket) => ticket.id === ticketEditingId)
    const showTicketForm = ticketFormOpen || Boolean(editingTicket)
    return `
  <section class="view-section"><div class="section-header"><div><p class="kicker">Tickets</p><h2>Seguimiento operativo</h2></div></div>
    <section class="content-grid single-focus">
      <article class="panel"><div class="panel-head"><div><h3>${editingTicket ? 'Editar ticket' : 'Nuevo ticket'}</h3><p>Numeracion y seguimiento por sucursal</p></div></div>
        <form class="form-grid" data-form="ticket">
          <input type="hidden" name="ticketId" value="${editingTicket?.id || ''}" />
          <label>Numero<input type="text" name="number" value="${editingTicket?.number || ''}" placeholder="Se autogenera si lo dejas vacio" /></label>
          <label>Cliente *<select name="customerId" required>${editingTicket ? '' : '<option value="" selected disabled>Seleccioná un cliente</option>'}${ui.snapshot.customers.map((customer) => `<option value="${customer.id}" ${editingTicket?.customerId === customer.id ? 'selected' : ''}>${customer.fullName}</option>`).join('')}</select></label>
          <label>Equipo *<input type="text" name="device" value="${editingTicket?.device || ''}" required /></label>
          <label>Estado<select name="status"><option ${editingTicket?.status === 'Recibido' || !editingTicket ? 'selected' : ''}>Recibido</option><option ${editingTicket?.status === 'En curso' ? 'selected' : ''}>En curso</option><option ${editingTicket?.status === 'Esperando aprobacion' ? 'selected' : ''}>Esperando aprobacion</option><option ${editingTicket?.status === 'Listo para entregar' ? 'selected' : ''}>Listo para entregar</option></select></label>
          <label class="full-span">Detalle *<input type="text" name="issue" value="${editingTicket?.issue || ''}" required /></label>
          <button type="submit">${editingTicket ? 'Guardar cambios' : 'Guardar ticket'}</button>
          ${editingTicket ? '<button type="button" class="danger-action" data-action="cancel-ticket-edit">Cancelar edicion</button>' : ''}
        </form>
      </article>
      <article class="panel"><div class="panel-head"><div><h3>Tickets activos</h3><p>Historial rapido</p></div></div>
        ${dataTable(['Ticket', 'Cliente', 'Sucursal', 'Actualizado', 'Acciones'], ui.enrichedTickets.map((ticket) => `<div class="data-row"><span class="ticket-cell"><strong class="ticket-number" title="${escapeHtml(ticket.number)}">${escapeHtml(ticket.number)}</strong></span><span>${ticket.customerName}</span><span>${ticket.branchName}</span><span class="ticket-updated">${formatTicketUpdatedAt(ticket.updatedAt)}</span><span>${ticketActionButtons(ticket)}</span></div>`))}
      </article>
    </section>
  </section>
`})()}
`

const ticketsViewV2 = (ui) => `
  ${(() => {
    const editingTicket = ui.snapshot.tickets.find((ticket) => ticket.id === ticketEditingId)
    const showTicketForm = ticketFormOpen || Boolean(editingTicket)
    return `
  <section class="view-section"><div class="section-header"><div><p class="kicker">Tickets</p><h2>Seguimiento operativo</h2></div><div class="panel-inline-stats section-inline-stats">
      <span class="panel-inline-stat"><strong>${ui.enrichedTickets.length}</strong><span>Tickets activos</span></span>
      <span class="panel-inline-stat"><strong>${ui.enrichedTickets.filter((ticket) => ticket.status === 'En curso').length}</strong><span>En curso</span></span>
      <span class="panel-inline-stat"><strong>${ui.enrichedTickets.filter((ticket) => ticket.status === 'Listo para entregar').length}</strong><span>Listos</span></span>
    </div></div>
    ${feedbackMessage ? `<div class="feedback-banner">${feedbackMessage}</div>` : ''}
    <section class="stacked-section">
      ${showTicketForm ? `<article class="panel"><div class="panel-head"><div><h3>${editingTicket ? 'Editar ticket' : 'Nuevo ticket'}</h3><p>Numeracion y seguimiento por sucursal</p></div><div class="settings-actions"><button type="button" class="ghost-action" data-action="close-ticket-form">Cerrar</button></div></div>
        <form class="form-grid" data-form="ticket">
          <input type="hidden" name="ticketId" value="${editingTicket?.id || ''}" />
          <label>Numero<input type="text" name="number" value="${editingTicket?.number || ''}" placeholder="Se autogenera si lo dejas vacio" /></label>
          <label>Cliente<select name="customerId" required>${ui.snapshot.customers.map((customer) => `<option value="${customer.id}" ${editingTicket?.customerId === customer.id ? 'selected' : ''}>${customer.fullName}</option>`).join('')}</select></label>
          <label>Equipo<input type="text" name="device" value="${editingTicket?.device || ''}" required /></label>
          <label>Estado<select name="status"><option ${editingTicket?.status === 'Recibido' || !editingTicket ? 'selected' : ''}>Recibido</option><option ${editingTicket?.status === 'En curso' ? 'selected' : ''}>En curso</option><option ${editingTicket?.status === 'Esperando aprobacion' ? 'selected' : ''}>Esperando aprobacion</option><option ${editingTicket?.status === 'Listo para entregar' ? 'selected' : ''}>Listo para entregar</option></select></label>
          <label class="full-span">Detalle<input type="text" name="issue" value="${editingTicket?.issue || ''}" required /></label>
          <button type="submit">${editingTicket ? 'Guardar cambios' : 'Guardar ticket'}</button>
          ${!editingTicket ? '<button type="button" class="ghost-action" data-action="close-ticket-form">Cancelar</button>' : ''}
          ${editingTicket ? '<button type="button" class="danger-action" data-action="cancel-ticket-edit">Cancelar edicion</button>' : ''}
        </form>
      </article>` : ''}
      <article class="panel">
        <div class="panel-head"><div><h3>Tickets activos</h3><p>Vista rapida del flujo operativo</p></div><div class="settings-actions">${editingTicket ? '' : createToggleButton('ticket', showTicketForm, 'Agregar ticket')}</div></div>
        ${dataTable(['Ticket', 'Cliente', 'Sucursal', 'Actualizado', 'Acciones'], ui.enrichedTickets.map((ticket) => `<div class="data-row"><span class="ticket-cell"><strong class="ticket-number" title="${escapeHtml(ticket.number)}">${escapeHtml(ticket.number)}</strong><br /><small>${ticket.device || 'Equipo sin detalle'}</small></span><span>${ticket.customerName}<br /><small>${ticket.status}</small></span><span>${ticket.branchName}</span><span class="ticket-updated">${formatTicketUpdatedAt(ticket.updatedAt)}</span><span>${ticketActionButtons(ticket)}</span></div>`), 'is-stable tickets-table')}
      </article>
    </section>
  </section>
`})()}
`

const branchesView = (ui) => `
  ${(() => {
    const editingBranch = ui.snapshot.branches.find((branch) => branch.id === branchEditingId)
    return `
  <section class="view-section"><div class="section-header"><div><p class="kicker">Sucursales</p><h2>Locales y numeracion</h2></div></div>
    ${feedbackMessage ? `<div class="feedback-banner">${feedbackMessage}</div>` : ''}
    <section class="content-grid single-focus">
      <article class="panel"><div class="panel-head"><div><h3>${editingBranch ? 'Editar sucursal' : 'Nueva sucursal'}</h3><p>La sucursal actual define la numeracion</p></div></div>
        <form class="form-grid" data-form="branch">
          <input type="hidden" name="branchId" value="${editingBranch?.id || ''}" />
          <label>Nombre<input type="text" name="name" value="${editingBranch?.name || ''}" required /></label>
          <label>Codigo<input type="text" name="code" value="${editingBranch?.code || ''}" required /></label>
          <label class="full-span">Direccion<input type="text" name="address" value="${editingBranch?.address || ''}" required /></label>
          <button type="submit">${editingBranch ? 'Guardar cambios' : 'Guardar sucursal'}</button>
          ${editingBranch ? '<button type="button" class="danger-action" data-action="cancel-branch-edit">Cancelar edicion</button>' : ''}
        </form>
      </article>
      <article class="panel"><div class="panel-head"><div><h3>Sucursales</h3><p>Actual: ${ui.currentBranch?.name || '-'}</p></div></div>
        ${dataTable(['Nombre', 'Codigo', 'Direccion', 'Actual', 'Accion'], ui.snapshot.branches.map((branch) => `<div class="data-row"><span>${branch.name}</span><span>${branch.code}</span><span>${branch.address}</span><span>${ui.currentBranch?.id === branch.id ? 'Si' : 'No'}</span><span>${branchActionButtons(branch)}</span></div>`))}
      </article>
    </section>
  </section>
`})()}
`

const branchesViewLegacy = (ui) => `
  ${(() => {
    const editingBranch = ui.snapshot.branches.find((branch) => branch.id === branchEditingId)
    return `
  <section class="view-section"><div class="section-header"><div><p class="kicker">Sucursales</p><h2>Locales y numeracion</h2></div><div class="panel-inline-stats section-inline-stats">
      <span class="panel-inline-stat"><strong>${ui.snapshot.branches.length}</strong><span>Sucursales</span></span>
      <span class="panel-inline-stat"><strong>${ui.currentRegister?.name || 'Sin caja'}</strong><span>Caja actual</span></span>
      <span class="panel-inline-stat"><strong>${ui.currentBranch?.name || '-'}</strong><span>Activa</span></span>
    </div></div>
    ${feedbackMessage ? `<div class="feedback-banner">${feedbackMessage}</div>` : ''}
    <section class="module-board branches-board ${showBranchForm ? '' : 'board-expanded'}">
      <article class="panel module-side"><div class="panel-head"><div><h3>${editingBranch ? 'Editar sucursal' : 'Nueva sucursal'}</h3><p>La sucursal actual define la numeracion</p></div></div>
        <form class="form-grid" data-form="branch">
          <input type="hidden" name="branchId" value="${editingBranch?.id || ''}" />
          <label>Nombre<input type="text" name="name" value="${editingBranch?.name || ''}" required /></label>
          <label>Codigo<input type="text" name="code" value="${editingBranch?.code || ''}" required /></label>
          <label class="full-span">Direccion<input type="text" name="address" value="${editingBranch?.address || ''}" required /></label>
          <button type="submit">${editingBranch ? 'Guardar cambios' : 'Guardar sucursal'}</button>
          ${editingBranch ? '<button type="button" class="danger-action" data-action="cancel-branch-edit">Cancelar edicion</button>' : ''}
        </form>
      </article>
      <div class="module-main">
        <article class="panel">
          <div class="panel-head"><div><h3>Operacion por sucursal</h3><p>Contexto actual del comercio</p></div></div>
          <div class="summary-mini-row">
            <div class="summary-mini-card"><strong>Actual</strong><span>${ui.currentBranch?.name || '-'}</span></div>
            <div class="summary-mini-card"><strong>Cajas ligadas</strong><span>${ui.branchRegisters.length}</span></div>
            <div class="summary-mini-card"><strong>Direccion</strong><span>${ui.currentBranch?.address || 'Sin direccion'}</span></div>
          </div>
        </article>
        <article class="panel"><div class="panel-head"><div><h3>Sucursales</h3><p>Actual: ${ui.currentBranch?.name || '-'}</p></div></div>
          ${dataTable(['Nombre', 'Codigo', 'Direccion', 'Actual', 'Accion'], ui.snapshot.branches.map((branch) => `<div class="data-row"><span>${branch.name}</span><span>${branch.code}</span><span>${branch.address}</span><span>${ui.currentBranch?.id === branch.id ? 'Si' : 'No'}</span><span>${branchActionButtons(branch)}</span></div>`))}
        </article>
      </div>
    </section>
  </section>
`})()}
`

const branchesViewV2 = (ui) => `
  ${(() => {
    const editingBranch = ui.snapshot.branches.find((branch) => branch.id === branchEditingId)
    const showBranchForm = branchFormOpen || Boolean(editingBranch)
    const normalizedBranchSearch = branchSearchQuery.trim().toLowerCase()
    const visibleBranches = ui.snapshot.branches.filter((branch) => !normalizedBranchSearch || [branch.name, branch.code, branch.address].some((value) => String(value || '').toLowerCase().includes(normalizedBranchSearch)))
    return `
  <section class="view-section"><div class="section-header"><div><p class="kicker">Sucursales</p><h2>Locales y numeracion</h2></div><div class="panel-inline-stats section-inline-stats">
      <span class="panel-inline-stat"><strong>${ui.snapshot.branches.length}</strong><span>Sucursales</span></span>
      <span class="panel-inline-stat"><strong>${ui.currentRegister?.name || 'Sin caja'}</strong><span>Caja actual</span></span>
      <span class="panel-inline-stat"><strong>${ui.currentBranch?.name || '-'}</strong><span>Sucursal activa</span></span>
    </div></div>
    ${feedbackMessage ? `<div class="feedback-banner">${feedbackMessage}</div>` : ''}
    <section class="stacked-section">
      ${showBranchForm ? `<article class="panel">
        <div class="panel-head"><div><h3>${editingBranch ? 'Editar sucursal' : 'Nueva sucursal'}</h3><p>La sucursal actual define la numeracion</p></div></div>
        <form class="form-grid" data-form="branch">
          <input type="hidden" name="branchId" value="${editingBranch?.id || ''}" />
          <label>Nombre<input type="text" name="name" value="${editingBranch?.name || ''}" required /></label>
          <label>Codigo<input type="text" name="code" value="${editingBranch?.code || ''}" required /></label>
          <label class="full-span">Direccion<input type="text" name="address" value="${editingBranch?.address || ''}" required /></label>
          <button type="submit">${editingBranch ? 'Guardar cambios' : 'Guardar sucursal'}</button>
          ${editingBranch ? '<button type="button" class="danger-action" data-action="cancel-branch-edit">Cancelar edicion</button>' : '<button type="button" class="ghost-action" data-action="close-branch-form">Cancelar</button>'}
        </form>
      </article>` : ''}
      <article class="panel">
        <div class="panel-head"><div><h3>Sucursales</h3><p>Contexto actual del comercio</p></div><div class="settings-actions">${editingBranch ? '' : createToggleButton('branch', showBranchForm, 'Agregar sucursal')}</div></div>
        <div class="branch-toolbar"><div class="stock-adjustment-search"><span class="pos-search-icon" aria-hidden="true">${icon('<circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/>')}</span><input type="search" data-branch-search value="${escapeHtml(branchSearchQuery)}" placeholder="Buscar por nombre, código o dirección" aria-label="Buscar sucursal" /></div><span class="branch-results-count">${visibleBranches.length} de ${ui.snapshot.branches.length}</span></div>
        ${dataTable(['Nombre', 'Codigo', 'Direccion', 'Cajas', 'Actual', 'Accion'], visibleBranches.map((branch) => { const branchRegisters = ui.snapshot.registers.filter((register) => register.branchId === branch.id); return `<div class="data-row branch-data-row"><span><strong>${branch.name}</strong></span><span>${branch.code}</span><span>${branch.address}</span><span><span class="branch-register-chips">${branchRegisters.map((register) => `<small>${register.name}</small>`).join('') || '<small>Sin cajas</small>'}</span></span><span>${ui.currentBranch?.id === branch.id ? 'Si' : 'No'}</span><span>${branchActionButtons(branch)}</span></div>` }))}
      </article>
    </section>
  </section>
`})()}
`

const registersView = (ui) => `
  ${(() => {
    const editingRegister = ui.snapshot.registers.find((register) => register.id === registerEditingId)
    return `
  <section class="view-section"><div class="section-header"><div><p class="kicker">Cajas</p><h2>Cajeros y puestos de cobro</h2></div></div>
    ${feedbackMessage ? `<div class="feedback-banner">${feedbackMessage}</div>` : ''}
    <section class="content-grid single-focus">
      <article class="panel"><div class="panel-head"><div><h3>${editingRegister ? 'Editar caja' : 'Nueva caja'}</h3><p>Asignacion por sucursal y cajero</p></div></div>
        <form class="form-grid" data-form="register">
          <input type="hidden" name="registerId" value="${editingRegister?.id || ''}" />
          <label>Sucursal<select name="branchId" required>${ui.snapshot.branches.map((branch) => `<option value="${branch.id}" ${editingRegister?.branchId === branch.id ? 'selected' : ''}>${branch.name}</option>`).join('')}</select></label>
          <label>Nombre<input type="text" name="name" value="${editingRegister?.name || ''}" required /></label>
          <label>Codigo<input type="text" name="code" value="${editingRegister?.code || ''}" required /></label>
          <label>Cajero<select name="cashierUserId">${ui.snapshot.users.map((user) => `<option value="${user.id}" ${editingRegister?.cashierUserId === user.id ? 'selected' : ''}>${user.fullName}</option>`).join('')}</select></label>
          <button type="submit">${editingRegister ? 'Guardar cambios' : 'Guardar caja'}</button>
          ${editingRegister ? '<button type="button" class="danger-action" data-action="cancel-register-edit">Cancelar edicion</button>' : ''}
        </form>
      </article>
      <article class="panel"><div class="panel-head"><div><h3>Cajas</h3><p>Preparado para varias cajas por sucursal</p></div></div>
        ${dataTable(['Caja', 'Codigo', 'Sucursal', 'Cajero', 'Accion'], ui.enrichedRegisters.map((register) => `<div class="data-row"><span>${register.name}</span><span>${register.code}</span><span>${register.branchName}</span><span>${register.cashierName}</span><span class="inline-action-group"><button type="button" class="inline-action" data-register-action="select" data-id="${register.id}">Usar</button>${registerActionButtons(register)}</span></div>`))}
      </article>
    </section>
  </section>
`})()}
`

const registersViewLegacy = (ui) => `
  ${(() => {
    const editingRegister = ui.snapshot.registers.find((register) => register.id === registerEditingId)
    return `
  <section class="view-section"><div class="section-header"><div><p class="kicker">Cajas</p><h2>Cajeros y puestos de cobro</h2></div><div class="panel-inline-stats section-inline-stats">
      <span class="panel-inline-stat"><strong>${ui.enrichedRegisters.length}</strong><span>Cajas</span></span>
      <span class="panel-inline-stat"><strong>${ui.currentRegister?.name || '-'}</strong><span>Activa</span></span>
      <span class="panel-inline-stat"><strong>${new Set(ui.enrichedRegisters.map((register) => register.cashierName)).size}</strong><span>Cajeros</span></span>
    </div></div>
    ${feedbackMessage ? `<div class="feedback-banner">${feedbackMessage}</div>` : ''}
    <section class="module-board registers-board ${showRegisterForm ? '' : 'board-expanded'}">
      <article class="panel module-side"><div class="panel-head"><div><h3>${editingRegister ? 'Editar caja' : 'Nueva caja'}</h3><p>Asignacion por sucursal y cajero</p></div></div>
        <form class="form-grid" data-form="register">
          <input type="hidden" name="registerId" value="${editingRegister?.id || ''}" />
          <label>Sucursal<select name="branchId" required>${ui.snapshot.branches.map((branch) => `<option value="${branch.id}" ${editingRegister?.branchId === branch.id ? 'selected' : ''}>${branch.name}</option>`).join('')}</select></label>
          <label>Nombre<input type="text" name="name" value="${editingRegister?.name || ''}" required /></label>
          <label>Codigo<input type="text" name="code" value="${editingRegister?.code || ''}" required /></label>
          <label>Cajero<select name="cashierUserId">${ui.snapshot.users.map((user) => `<option value="${user.id}" ${editingRegister?.cashierUserId === user.id ? 'selected' : ''}>${user.fullName}</option>`).join('')}</select></label>
          <button type="submit">${editingRegister ? 'Guardar cambios' : 'Guardar caja'}</button>
          ${editingRegister ? '<button type="button" class="danger-action" data-action="cancel-register-edit">Cancelar edicion</button>' : ''}
        </form>
      </article>
      <div class="module-main">
        <article class="panel">
          <div class="panel-head"><div><h3>Uso operativo</h3><p>Control de puestos de cobro</p></div></div>
          <div class="summary-mini-row">
            <div class="summary-mini-card"><strong>Sucursal</strong><span>${ui.currentBranch?.name || '-'}</span></div>
            <div class="summary-mini-card"><strong>Sesion abierta</strong><span>${ui.openCashSession ? 'Si' : 'No'}</span></div>
            <div class="summary-mini-card"><strong>Caja actual</strong><span>${ui.currentRegister?.name || 'Sin asignar'}</span></div>
          </div>
        </article>
        <article class="panel"><div class="panel-head"><div><h3>Cajas</h3><p>Preparado para varias cajas por sucursal</p></div></div>
          ${dataTable(['Caja', 'Codigo', 'Sucursal', 'Cajero', 'Accion'], ui.enrichedRegisters.map((register) => `<div class="data-row"><span>${register.name}</span><span>${register.code}</span><span>${register.branchName}</span><span>${register.cashierName}</span><span class="inline-action-group"><button type="button" class="inline-action" data-register-action="select" data-id="${register.id}">Usar</button>${registerActionButtons(register)}</span></div>`))}
        </article>
      </div>
    </section>
  </section>
`})()}
`

const registersViewV2 = (ui) => `
  ${(() => {
    const editingRegister = ui.snapshot.registers.find((register) => register.id === registerEditingId)
    const showRegisterForm = registerFormOpen || Boolean(editingRegister)
    return `
  <section class="view-section"><div class="section-header"><div><p class="kicker">Cajas</p><h2>Cajeros y puestos de cobro</h2></div><div class="panel-inline-stats section-inline-stats">
      <span class="panel-inline-stat"><strong>${ui.enrichedRegisters.length}</strong><span>Cajas</span></span>
      <span class="panel-inline-stat"><strong>${ui.currentRegister?.name || '-'}</strong><span>Caja activa</span></span>
      <span class="panel-inline-stat"><strong>${new Set(ui.enrichedRegisters.map((register) => register.cashierName)).size}</strong><span>Cajeros</span></span>
    </div></div>
    ${feedbackMessage ? `<div class="feedback-banner">${feedbackMessage}</div>` : ''}
    <section class="stacked-section">
      ${showRegisterForm ? `<article class="panel">
        <div class="panel-head"><div><h3>${editingRegister ? 'Editar caja' : 'Nueva caja'}</h3><p>Asignacion por sucursal y cajero</p></div></div>
        <form class="form-grid" data-form="register">
          <input type="hidden" name="registerId" value="${editingRegister?.id || ''}" />
          <label>Sucursal<select name="branchId" required>${ui.snapshot.branches.map((branch) => `<option value="${branch.id}" ${editingRegister?.branchId === branch.id ? 'selected' : ''}>${branch.name}</option>`).join('')}</select></label>
          <label>Nombre<input type="text" name="name" value="${editingRegister?.name || ''}" required /></label>
          <label>Codigo<input type="text" name="code" value="${editingRegister?.code || ''}" required /></label>
          <label>Cajero<select name="cashierUserId">${ui.snapshot.users.map((user) => `<option value="${user.id}" ${editingRegister?.cashierUserId === user.id ? 'selected' : ''}>${user.fullName}</option>`).join('')}</select></label>
          <button type="submit">${editingRegister ? 'Guardar cambios' : 'Guardar caja'}</button>
          ${editingRegister ? '<button type="button" class="danger-action" data-action="cancel-register-edit">Cancelar edicion</button>' : '<button type="button" class="ghost-action" data-action="close-register-form">Cancelar</button>'}
        </form>
      </article>` : ''}
      <article class="panel">
        <div class="panel-head"><div><h3>Cajas</h3><p>Control de puestos de cobro</p></div><div class="settings-actions">${editingRegister ? '' : createToggleButton('register', showRegisterForm, 'Agregar caja')}</div></div>
        ${dataTable(['Caja', 'Codigo', 'Sucursal', 'Cajero', 'Accion'], ui.enrichedRegisters.map((register) => `<div class="data-row"><span>${register.name}</span><span>${register.code}</span><span>${register.branchName}</span><span>${register.cashierName}</span><span class="inline-action-group"><button type="button" class="inline-action" data-register-action="select" data-id="${register.id}">Usar</button>${registerActionButtons(register)}</span></div>`))}
      </article>
    </section>
  </section>
`})()}
`

const getAuditLinkedContext = (ui, entry) => {
  const data = entry.afterData || entry.beforeData || {}
  const saleId = entry.entityType === 'sale' ? entry.entityId : (data.saleId || data.sale_id || data.referenceId || '')
  const invoiceId = entry.entityType === 'invoice' ? entry.entityId : (data.invoiceId || data.invoice_id || '')
  const invoice = ui.enrichedInvoices?.find((item) => item.id === invoiceId || item.saleId === saleId)
  const sale = ui.enrichedSales?.find((item) => item.id === saleId || (invoice?.saleId && item.id === invoice.saleId))
  const itemNames = (sale?.items || []).map((item) => ui.snapshot.products.find((product) => product.id === item.productId)?.name || item.productName || 'Artículo')
  return { sale, invoice, itemNames, data }
}

const auditOperationSummary = (ui, entry) => {
  const data = entry.afterData || entry.beforeData || {}
  const context = getAuditLinkedContext(ui, entry)
  const line = (label, text) => `<span><b>${label}</b> ${escapeHtml(text)}</span>`
  if (entry.entityType === 'cash_movement') {
    const movement = ui.scopedCashMovements.find((item) => item.id === entry.entityId) || data
    if (!movement.kind && !movement.note && movement.signedAmount == null && movement.signed_amount == null) return ''
    return line('Caja', `${cashMovementKindLabel(movement.kind)} · ${movement.note || 'Sin detalle'} · ${money(Number(movement.signedAmount ?? movement.signed_amount ?? 0))}`)
  }
  if (entry.entityType === 'cash_session') {
    const session = ui.scopedCashSessions.find((item) => item.id === entry.entityId) || data
    if (session.openingAmount == null && session.opening_amount == null && session.countedAmount == null && session.counted_amount == null) return ''
    return line('Cierre de caja', `Apertura ${money(Number(session.openingAmount ?? session.opening_amount ?? 0))} · Contado ${money(Number(session.countedAmount ?? session.counted_amount ?? 0))} · Diferencia ${money(Number(session.differenceAmount ?? session.difference_amount ?? 0))}`)
  }
  if (entry.entityType.includes('stock')) {
    const movement = ui.scopedStockMovements.find((item) => item.id === entry.entityId) || data
    const product = ui.snapshot.products.find((item) => item.id === (movement.productId || movement.product_id))
    const productName = product?.name || movement.productName || context.itemNames[0] || ''
    const quantity = movement.quantity
    if (!productName && quantity == null) return ''
    return line('Stock', `${productName || 'Producto'}${movement.type ? ` · ${stockMovementTypeLabel(movement.type)}` : ''}${quantity != null ? ` · ${Number(quantity) > 0 ? '+' : ''}${quantity} unidades` : ''}`)
  }
  if (entry.entityType === 'product') {
    const product = ui.snapshot.products.find((item) => item.id === entry.entityId) || data
    return line('Producto', `${product.name || 'Sin nombre'} · SKU ${product.sku || '—'} · Venta ${money(Number(product.salePrice ?? product.sale_price ?? 0))}`)
  }
  if (entry.entityType === 'customer') {
    const customer = ui.snapshot.customers.find((item) => item.id === entry.entityId) || data
    return line('Cliente', `${customer.fullName || customer.full_name || 'Sin nombre'} · ${customer.phone || customer.email || 'Sin contacto'}`)
  }
  if (entry.entityType === 'purchase_receipt') {
    const receipt = ui.enrichedReceipts.find((item) => item.id === entry.entityId) || data
    return line('Compra', `${receipt.productName || 'Producto'} · ${receipt.supplierName || 'Proveedor'} · ${receipt.quantity ?? '—'} unidades`)
  }
  if (entry.entityType === 'ticket') {
    const ticket = ui.enrichedTickets.find((item) => item.id === entry.entityId) || data
    return line('Ticket', `${ticket.number || 'Sin número'} · ${ticket.customerName || 'Sin cliente'} · ${ticket.status || 'Sin estado'}`)
  }
  return ''
}

const openAuditEvent = (ui, entry) => {
  const context = getAuditLinkedContext(ui, entry)
  const data = context.data || {}
  const entityId = entry.entityId || ''
  const goTo = (section, selector = '') => {
    activeSection = section
    if (selector) queueScrollToSelector(selector)
    saveSection()
    render()
  }

  if ((context.sale || entry.entityType === 'sale') && entry.entityType !== 'invoice' && !(entry.entityType === 'document' && (data.kind === 'factura' || data.kind === 'invoice'))) {
    const sale = context.sale || ui.snapshot.sales.find((item) => item.id === entityId)
    if (sale) {
      saleEditingId = sale.id
      saleFormOpen = true
      saleDraftQuantities = Object.fromEntries((sale.items || []).map((item) => [item.productId, item.quantity]))
      goTo('ventas', 'form[data-form="sale"]')
      return
    }
  }
  if (context.invoice || entry.entityType === 'invoice' || (entry.entityType === 'document' && (data.kind === 'factura' || data.kind === 'invoice'))) {
    const invoice = context.invoice || ui.enrichedInvoices.find((item) => item.id === entityId)
    if (invoice && openInvoiceDocument(invoice.id)) return
    goTo('facturacion')
    return
  }
  const ticketId = entry.entityType === 'ticket' || (entry.entityType === 'document' && data.kind === 'ticket') ? entityId : (data.ticketId || data.ticket_id || '')
  if (ticketId) { ticketEditingId = ticketId; ticketFormOpen = true; goTo('tickets', 'form[data-form="ticket"]'); return }
  if (['cash_movement', 'cash_session'].includes(entry.entityType)) { goTo('caja'); return }
  if (['stock_movement', 'stock_adjustment', 'stock_transfer'].includes(entry.entityType)) { goTo('productos'); return }
  if (entry.entityType === 'product') { productEditingId = entityId; goTo('productos'); return }
  if (entry.entityType === 'purchase_receipt') { purchaseEditingId = entityId; goTo('compras', 'form[data-form="purchase-receipt"]'); return }
  if (entry.entityType === 'supplier') { supplierEditingId = entityId; supplierFormOpen = true; goTo('compras', 'form[data-form="supplier"]'); return }
  if (entry.entityType === 'customer') { customerEditingId = entityId; customerFormOpen = true; goTo('clientes', 'form[data-form="customer"]'); return }
  if (entry.entityType === 'branch') { branchEditingId = entityId; goTo('sucursales'); return }
  if (entry.entityType === 'register') { registerEditingId = entityId; goTo('cajeros'); return }
  if (['user', 'user_assignment'].includes(entry.entityType)) { userEditingId = entityId; goTo('ajustes'); return }
  goTo({ sales: 'ventas', cash: 'caja', stock: 'productos', products: 'productos', purchases: 'compras', customers: 'clientes', invoices: 'facturacion', tickets: 'tickets' }[entry.modules[0]] || 'ajustes')
}

const showAuditEventDetail = (ui, entry, event) => {
  const context = getAuditLinkedContext(ui, entry)
  const before = entry.beforeData || {}
  const after = entry.afterData || {}
  const content = event.querySelector('.audit-trace-content')
  const currentDetail = content?.querySelector('.audit-expanded-detail')
  if (currentDetail) { currentDetail.remove(); event.classList.remove('is-expanded'); return }
  document.querySelectorAll('.audit-expanded-detail').forEach((detail) => detail.remove())
  document.querySelectorAll('.audit-trace-event.is-expanded').forEach((item) => item.classList.remove('is-expanded'))
  const fieldLabel = (key) => ({ full_name: 'Nombre', product_id: 'Producto', productId: 'Producto', sale_id: 'Venta', saleId: 'Venta', signed_amount: 'Importe', signedAmount: 'Importe', cash_session_id: 'Sesión de caja', cashSessionId: 'Sesión de caja', created_at: 'Fecha', createdAt: 'Fecha', updated_at: 'Actualización', updatedAt: 'Actualización', quantity: 'Cantidad', note: 'Detalle', status: 'Estado' }[key] || String(key).replace(/([A-Z])/g, ' $1').replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase()))
  const formatValue = (value) => {
    if (value === null || value === undefined || value === '') return '—'
    if (typeof value === 'boolean') return value ? 'Sí' : 'No'
    if (typeof value === 'object') return Array.isArray(value) ? `${value.length} registro${value.length === 1 ? '' : 's'}` : 'Datos registrados'
    return String(value)
  }
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => !['id', 'business_id', 'businessId', 'branch_id', 'branchId', 'created_by', 'createdBy'].includes(key))
  const changes = keys.map((key) => {
    const previous = formatValue(before[key])
    const current = formatValue(after[key])
    return `<div><span>${escapeHtml(fieldLabel(key))}</span><strong>${escapeHtml(previous)} → ${escapeHtml(current)}</strong></div>`
  }).join('')
  const product = ui.snapshot.products.find((item) => item.id === (after.productId || after.product_id || before.productId || before.product_id))
  const saleItems = context.sale?.items?.map((item) => `<li>${escapeHtml(item.productName || ui.snapshot.products.find((productEntry) => productEntry.id === item.productId)?.name || 'Artículo')} × ${Number(item.quantity || 0)} · ${money(Number(item.unitPrice || item.salePrice || 0) * Number(item.quantity || 0))}</li>`).join('') || ''
  const cashData = entry.entityType === 'cash_session' || entry.entityType === 'cash_movement'
    ? `<div class="audit-real-summary"><strong>Caja</strong><span>${after.note || after.description || 'Movimiento registrado'}${after.signedAmount != null || after.signed_amount != null ? ` · ${money(Number(after.signedAmount ?? after.signed_amount))}` : ''}${after.openingAmount != null || after.opening_amount != null ? ` · Apertura ${money(Number(after.openingAmount ?? after.opening_amount))}` : ''}${after.countedAmount != null || after.counted_amount != null ? ` · Contado ${money(Number(after.countedAmount ?? after.counted_amount))}` : ''}${after.differenceAmount != null || after.difference_amount != null ? ` · Diferencia ${money(Number(after.differenceAmount ?? after.difference_amount))}` : ''}</span></div>`
    : ''
  const stockData = entry.entityType.includes('stock') ? `<div class="audit-real-summary"><strong>Stock</strong><span>${escapeHtml(product?.name || after.productName || 'Producto')} · ${Number(after.quantity || 0) > 0 ? '+' : ''}${escapeHtml(String(after.quantity ?? '—'))} unidades${after.type ? ` · ${escapeHtml(String(after.type))}` : ''}</span></div>` : ''
  const invoiceAction = context.invoice ? `<button type="button" class="inline-action" data-audit-open-invoice="${escapeHtml(context.invoice.id)}">Ver factura ${escapeHtml(context.invoice.number || '')}</button>` : ''
  const detail = document.createElement('section')
  detail.className = 'audit-expanded-detail'
  detail.innerHTML = `${context.sale ? `<div class="audit-real-summary"><strong>Venta</strong><span>${escapeHtml(context.sale.customerName || 'Consumidor final')} · ${money(context.sale.totalAmount)}</span>${saleItems ? `<ul>${saleItems}</ul>` : ''}</div>` : ''}${cashData}${stockData}<div class="audit-detail-fields">${changes || '<span>Acción registrada correctamente.</span>'}</div>${invoiceAction ? `<div class="audit-detail-actions">${invoiceAction}</div>` : ''}`
  content?.append(detail)
  event.classList.add('is-expanded')
  detail.querySelector('[data-audit-open-invoice]')?.addEventListener('click', (clickEvent) => {
    clickEvent.stopPropagation()
    const opened = openInvoiceDocument(context.invoice.id)
    if (!opened) feedbackMessage = 'No se pudo abrir la factura.'
  })
}

const auditSearchText = (ui, entry) => {
  const context = getAuditLinkedContext(ui, entry)
  return [entry.actorName, entry.entityLabel, entry.action, entry.entityId, entry.moduleLabel, context.sale?.customerName, context.sale?.itemSummary, context.sale?.totalAmount, context.invoice?.number, context.invoice?.customerName, context.invoice?.totalAmount, ...context.itemNames, ...Object.values(context.data || {})].join(' ').toLocaleLowerCase()
}

const auditView = (ui) => {
  const moduleColors = { sales: '#f87171', cash: '#fbbf24', stock: '#60a5fa', products: '#a78bfa', purchases: '#34d399', customers: '#fb7185', invoices: '#22d3ee', tickets: '#c084fc', settings: '#94a3b8' }
  const actionLabels = { created: 'Creó', updated: 'Actualizó', deleted: 'Eliminó', cancelled: 'Anuló', returned: 'Registró una devolución', opened: 'Abrió', closed: 'Cerró', signed_in: 'Inició', signed_out: 'Cerró', assigned: 'Asignó', unassigned: 'Quitó', enabled: 'Habilitó', disabled: 'Deshabilitó', created_from_sale: 'Generó desde una venta', created_from_return: 'Generó desde una devolución', imported: 'Importó', reset: 'Restableció', registered: 'Registró', deactivated: 'Desactivó', seed_initialized: 'Inicializó' }
  const now = new Date(); const beginningOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const periodStart = auditPeriodFilter === 'today' ? beginningOfDay : auditPeriodFilter === 'week' ? new Date(beginningOfDay.getTime() - (6 * 86400000)) : auditPeriodFilter === 'month' ? new Date(now.getFullYear(), now.getMonth(), 1) : null
  const query = auditSearchQuery.trim().toLocaleLowerCase()
  const entries = ui.enrichedAudit.filter((entry) => { const createdAt = new Date(entry.createdAt); if (periodStart && createdAt < periodStart) return false; if (auditPeriodFilter === 'custom' && auditDateFrom && String(entry.createdAt).slice(0, 10) < auditDateFrom) return false; if (auditPeriodFilter === 'custom' && auditDateTo && String(entry.createdAt).slice(0, 10) > auditDateTo) return false; if (auditModuleFilter !== 'all' && !entry.modules.includes(auditModuleFilter)) return false; return !query || auditSearchText(ui, entry).includes(query) })
  const counts = Object.keys(ui.auditModuleLabels).map((key) => ({ key, label: ui.auditModuleLabels[key], count: entries.filter((entry) => entry.modules.includes(key)).length })).filter((item) => item.count)
  const total = Math.max(1, counts.reduce((sum, item) => sum + item.count, 0)); let offset = 0
  const donut = counts.map((item) => { const start = Math.round((offset / total) * 100); offset += item.count; return `${moduleColors[item.key]} ${start}% ${Math.round((offset / total) * 100)}%` }).join(', ') || '#334155 0 100%'
  const sensitiveCount = entries.filter((entry) => ['deleted', 'cancelled', 'returned', 'reset', 'deactivated'].includes(entry.action)).length
  return `<section class="view-section audit-view"><div class="section-header"><div><p class="kicker">Control y trazabilidad</p><h2>Auditoría</h2><p class="section-description">Seguí cada cambio entre módulos, desde la operación que lo originó.</p></div><div class="panel-inline-stats section-inline-stats"><span class="panel-inline-stat"><strong>${entries.length}</strong><span>Eventos</span></span><span class="panel-inline-stat"><strong>${sensitiveCount}</strong><span>Para revisar</span></span></div></div>${feedbackMessage ? `<div class="feedback-banner">${feedbackMessage}</div>` : ''}<section class="panel audit-controls"><div class="audit-periods" aria-label="Período de auditoría">${[['today', 'Hoy'], ['week', '7 días'], ['month', 'Este mes'], ['custom', 'Personalizado']].map(([key, label]) => `<button type="button" class="audit-filter-button ${auditPeriodFilter === key ? 'is-active' : ''}" data-audit-period="${key}">${label}</button>`).join('')}</div><div class="audit-filter-fields"><label class="audit-search"><span>Buscar</span><input type="search" data-audit-search value="${escapeHtml(auditSearchQuery)}" placeholder="Usuario, operación o módulo" /></label>${auditPeriodFilter === 'custom' ? `<label>Desde<input type="date" data-audit-date="from" value="${auditDateFrom}" /></label><label>Hasta<input type="date" data-audit-date="to" value="${auditDateTo}" /></label>` : ''}</div></section><section class="audit-overview"><article class="panel audit-module-panel"><div class="panel-head"><div><h3>Ramas por módulo</h3><p>Elegí un módulo para seguir su recorrido.</p></div></div><div class="audit-module-filters"><button type="button" class="audit-module-chip ${auditModuleFilter === 'all' ? 'is-active' : ''}" data-audit-module="all">Todos <b>${entries.length}</b></button>${counts.map((item) => `<button type="button" class="audit-module-chip module-${item.key} ${auditModuleFilter === item.key ? 'is-active' : ''}" data-audit-module="${item.key}"><i></i>${item.label} <b>${item.count}</b></button>`).join('')}</div></article><article class="panel audit-distribution"><div class="panel-head"><div><h3>Distribución</h3><p>Eventos del período seleccionado</p></div></div><div class="audit-donut-row"><div class="audit-donut" style="--audit-donut: conic-gradient(${donut})"><strong>${entries.length}</strong><span>eventos</span></div><div class="audit-legend">${counts.slice(0, 5).map((item) => `<span class="module-${item.key}"><i></i>${item.label}<b>${item.count}</b></span>`).join('') || '<span>Sin actividad en este período.</span>'}</div></div></article></section><section class="panel audit-trace-panel"><div class="panel-head"><div><h3>Línea de trazabilidad</h3><p>Los puntos de color muestran los módulos relacionados con cada acción.</p></div></div><div class="audit-trace">${entries.length ? entries.map((entry) => `<article class="audit-trace-event module-${entry.modules[0]}"><div class="audit-trace-node"><i></i></div><div class="audit-trace-content"><div class="audit-event-topline"><span class="audit-module-tag module-${entry.modules[0]}">${entry.moduleLabel}</span><time>${String(entry.createdAt || '').slice(0, 16).replace('T', ' · ')}</time></div><strong>${actionLabels[entry.action] || 'Registró'} ${entry.entityLabel}</strong><p>Por ${escapeHtml(entry.actorName)}${entry.entityId ? ` · Ref. ${escapeHtml(String(entry.entityId).slice(0, 8))}` : ''}</p><div class="audit-related-modules">${entry.modules.map((module) => `<span class="module-${module}" title="${ui.auditModuleLabels[module]}"><i></i>${ui.auditModuleLabels[module]}</span>`).join('')}</div></div></article>`).join('') : '<p class="empty-state">No hay eventos que coincidan con estos filtros.</p>'}</div></section></section>`
}

const reportsView = (ui) => `
  <section class="view-section"><div class="section-header"><div><p class="kicker">Reportes</p><h2>Indicadores y movimientos</h2></div><div class="panel-inline-stats section-inline-stats">
      <span class="panel-inline-stat"><strong>${money(ui.reportScopedSales.reduce((sum, sale) => sum + sale.totalAmount, 0))}</strong><span>Ventas filtradas</span></span>
      <span class="panel-inline-stat"><strong>${money(ui.reportScopedInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0))}</strong><span>Facturas filtradas</span></span>
      <span class="panel-inline-stat"><strong>${money(ui.reportScopedCashMovements.reduce((sum, movement) => sum + movement.signedAmount, 0))}</strong><span>Mov. caja</span></span>
    </div></div>
    ${feedbackMessage ? `<div class="feedback-banner">${feedbackMessage}</div>` : ''}
    <section class="content-grid single-focus report-filter-shell">
      <article class="panel"><div class="panel-head"><div><h3>Filtro operativo</h3><p>Separado por sucursal y caja</p></div></div>
        <form class="form-grid compact-form report-filter-form" data-form="report-filter">
          <label>Sucursal actual<input type="text" value="${ui.currentBranch?.name || '-'}" disabled /></label>
          <label>Caja<select name="registerFilter"><option value="all">Todas</option>${ui.branchRegisters.map((register) => `<option value="${register.id}" ${reportRegisterFilter === register.id ? 'selected' : ''}>${register.name}</option>`).join('')}</select></label>
          <label>Desde<input type="date" name="dateFrom" value="${ui.reportDateFrom}" /></label>
          <label>Hasta<input type="date" name="dateTo" value="${ui.reportDateTo}" /></label>
          <button type="submit">Aplicar filtro</button>
        </form>
      </article>
    </section>
    <section class="dashboard-grid reports-layout">
      <article class="panel report-top-products-panel"><div class="panel-head"><div><h3>Top productos</h3><p>Movimiento comercial filtrado</p></div></div><div class="top-list">${[...ui.reportScopedSales.reduce((map, sale) => { for (const item of sale.items) { const current = map.get(item.productId) || { name: ui.snapshot.products.find((product) => product.id === item.productId)?.name || 'Articulo', qty: 0 }; current.qty += item.quantity; map.set(item.productId, current) } return map }, new Map()).values()].sort((a, b) => b.qty - a.qty).slice(0, 5).map((item, index) => `<div class="top-row"><span>${index + 1}</span><div><strong>${item.name}</strong><p>${item.qty} unidades vendidas</p></div></div>`).join('') || '<p class="empty-state">Sin ventas en este rango.</p>'}</div></article>
      <article class="panel report-balance-panel"><div class="panel-head"><div><h3>Resumen del período</h3><p>${ui.currentBranch?.name || 'Sucursal'}${reportRegisterFilter === 'all' ? '' : ` / ${ui.enrichedRegisters.find((register) => register.id === reportRegisterFilter)?.name || 'Caja'}`}</p></div><div class="settings-actions"><button type="button" class="inline-action" data-action="export-report">Exportar CSV</button></div></div><div class="report-summary-grid">
        <div class="summary-mini-card"><strong>Ventas</strong><span>${money(ui.reportScopedSales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0))}</span></div>
        <div class="summary-mini-card"><strong>Facturas</strong><span>${money(ui.reportScopedInvoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0))}</span></div>
        <div class="summary-mini-card"><strong>Por cobrar</strong><span>${money(ui.reportScopedSales.reduce((sum, sale) => sum + Math.max(0, Number(sale.totalAmount || 0) - Number(sale.amountPaid || 0)), 0))}</span></div>
        <div class="summary-mini-card"><strong>Caja neta</strong><span>${money(ui.reportScopedCashMovements.reduce((sum, movement) => sum + Number(movement.signedAmount || 0), 0))}</span></div>
        <div class="summary-mini-card"><strong>Compras</strong><span>${money(ui.reportScopedReceipts.reduce((sum, receipt) => sum + (Number(receipt.quantity || 0) * Number(receipt.unitCost || 0)), 0))}</span></div>
        <div class="summary-mini-card"><strong>Mov. stock</strong><span>${ui.reportScopedStockMovements.length}</span></div>
      </div></article>
      <article class="panel report-movement-panel"><div class="panel-head"><div><h3>Movimientos de stock</h3><p>Ingresos y egresos</p></div></div><div class="timeline-list">${byRecentDate(ui.reportScopedStockMovements, 'createdAt').slice(0, 6).map((movement) => `<div class="timeline-item ${movementDirectionClass(movement.quantity)}"><strong>${stockMovementTypeLabel(movement.type)}</strong><p>${movement.quantity} unidades</p><span>${movement.createdAt.slice(0, 16).replace('T', ' ')}</span></div>`).join('') || '<p class="empty-state">Sin movimientos de stock en este rango.</p>'}</div></article>
      <article class="panel report-movement-panel"><div class="panel-head"><div><h3>Movimientos de caja</h3><p>Ingresos y egresos manuales</p></div></div><div class="timeline-list">${byRecentDate(ui.reportScopedCashMovements, 'createdAt').slice(0, 6).map((movement) => `<div class="timeline-item ${movementDirectionClass(movement.signedAmount)}"><strong>${cashMovementKindLabel(movement.kind)}</strong><p>${movement.note || 'Sin detalle'}</p><span>${money(movement.signedAmount)} / ${movement.createdAt.slice(0, 16).replace('T', ' ')}</span></div>`).join('') || '<p class="empty-state">Sin movimientos de caja en este rango.</p>'}</div></article>
    </section>
  </section>
`

const reportsViewLegacy = (ui) => `
  <section class="view-section"><div class="section-header"><div><p class="kicker">Reportes</p><h2>Indicadores y movimientos</h2></div></div>
    <section class="content-grid single-focus">
      <article class="panel"><div class="panel-head"><div><h3>Filtro operativo</h3><p>Separado por sucursal y caja</p></div></div>
        <form class="form-grid" data-form="report-filter">
          <label>Sucursal actual<input type="text" value="${ui.currentBranch?.name || '-'}" disabled /></label>
          <label>Caja<select name="registerFilter"><option value="all">Todas</option>${ui.branchRegisters.map((register) => `<option value="${register.id}" ${reportRegisterFilter === register.id ? 'selected' : ''}>${register.name}</option>`).join('')}</select></label>
          <label>Desde<input type="date" name="dateFrom" value="${ui.reportDateFrom}" /></label>
          <label>Hasta<input type="date" name="dateTo" value="${ui.reportDateTo}" /></label>
          <button type="submit">Aplicar filtro</button>
        </form>
      </article>
    </section>
    <section class="dashboard-grid reports-layout">
      <article class="panel"><div class="panel-head"><div><h3>Top productos</h3><p>Movimiento comercial filtrado</p></div></div><div class="top-list">${[...ui.reportScopedSales.reduce((map, sale) => { for (const item of sale.items) { const current = map.get(item.productId) || { name: ui.snapshot.products.find((product) => product.id === item.productId)?.name || 'Articulo', qty: 0 }; current.qty += item.quantity; map.set(item.productId, current) } return map }, new Map()).values()].sort((a, b) => b.qty - a.qty).slice(0, 5).map((item, index) => `<div class="top-row"><span>${index + 1}</span><div><strong>${item.name}</strong><p>${item.qty} unidades vendidas</p></div></div>`).join('') || '<p class="empty-state">Sin ventas en este rango.</p>'}</div></article>
      <article class="panel"><div class="panel-head"><div><h3>Balance rapido</h3><p>${ui.currentBranch?.name || 'Sucursal'}${reportRegisterFilter === 'all' ? '' : ` / ${ui.enrichedRegisters.find((register) => register.id === reportRegisterFilter)?.name || 'Caja'}`}</p></div></div><div class="priority-list"><div class="priority-item"><strong>Ventas filtradas</strong><p>${money(ui.reportScopedSales.reduce((sum, sale) => sum + sale.totalAmount, 0))}</p></div><div class="priority-item"><strong>Facturas filtradas</strong><p>${money(ui.reportScopedInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0))}</p></div><div class="priority-item"><strong>Mov. caja</strong><p>${money(ui.reportScopedCashMovements.reduce((sum, movement) => sum + movement.signedAmount, 0))}</p></div></div><div class="settings-actions"><button type="button" class="primary-action" data-action="export-report">Exportar CSV</button></div></article>
      <article class="panel"><div class="panel-head"><div><h3>Movimientos de stock</h3><p>Ingresos y egresos</p></div></div><div class="timeline-list">${byRecentDate(ui.reportScopedStockMovements, 'createdAt').slice(0, 6).map((movement) => `<div class="timeline-item ${movementDirectionClass(movement.quantity)}"><strong>${stockMovementTypeLabel(movement.type)}</strong><p>${movement.quantity} unidades</p><span>${movement.createdAt.slice(0, 16).replace('T', ' ')}</span></div>`).join('') || '<p class="empty-state">Sin movimientos de stock en este rango.</p>'}</div></article>
      <article class="panel"><div class="panel-head"><div><h3>Movimientos de caja</h3><p>Ingresos y egresos manuales</p></div></div><div class="timeline-list">${byRecentDate(ui.reportScopedCashMovements, 'createdAt').slice(0, 6).map((movement) => `<div class="timeline-item ${movementDirectionClass(movement.signedAmount)}"><strong>${cashMovementKindLabel(movement.kind)}</strong><p>${movement.note || 'Sin detalle'}</p><span>${money(movement.signedAmount)} / ${movement.createdAt.slice(0, 16).replace('T', ' ')}</span></div>`).join('') || '<p class="empty-state">Sin movimientos de caja en este rango.</p>'}</div></article>
    </section>
  </section>
`

const ownerAdminView = (ui) => ownerAdminViewV2(ui)

const ownerAdminViewV2 = (ui) => {
  const platform = ui.platformAdmin
  if (!platform) return `<section class="view-section"><div class="section-header"><div><p class="kicker">Control de plataforma</p><h2>Usuarios y trazabilidad</h2></div></div><article class="panel empty-panel"><h3>Consola global no disponible</h3><p>Actualizá para volver a consultar los datos de plataforma.</p><div class="settings-actions"><button type="button" class="primary-action" data-action="refresh-platform-admin">Actualizar</button></div></article></section>`

  const formatDate = (value) => value ? String(value).replace('T', ' · ').slice(0, 16) : 'Sin dato'
  const actionLabels = { created: 'Cuenta creada', updated: 'Actualización', deleted: 'Eliminación', signed_in: 'Inicio de sesión', signed_out: 'Cierre de sesión', assigned: 'Acceso asignado', unassigned: 'Acceso retirado', opened: 'Apertura de caja', closed: 'Cierre de caja' }
  const entityLabels = { user: 'Usuario', user_assignment: 'Acceso', session: 'Sesión', sale: 'Venta', cash_session: 'Caja', cash_movement: 'Movimiento de caja', product: 'Producto', stock_movement: 'Movimiento de stock', purchase_receipt: 'Compra', customer: 'Cliente', supplier: 'Proveedor', document: 'Comprobante', ticket: 'Ticket', branch: 'Sucursal', register: 'Caja', business: 'Comercio' }
  const entityModule = { sale: 'sales', cash_session: 'cash', cash_movement: 'cash', product: 'products', stock_movement: 'stock', purchase_receipt: 'purchases', customer: 'customers', supplier: 'purchases', document: 'invoices', ticket: 'tickets', user: 'settings', user_assignment: 'settings', session: 'settings', branch: 'settings', register: 'settings', business: 'settings' }
  const allUsers = Array.isArray(platform.users) ? platform.users : []
  const search = String(platformUserSearchQuery || '').trim().toLowerCase()
  const users = allUsers.filter((entry) => {
    const matchesState = platformUserFilter === 'all' || entry.status === platformUserFilter
    const haystack = [entry.fullName, entry.email, ...(entry.memberships || []).flatMap((membership) => [membership.commerceName, membership.instanceKey, membership.roleKey])].join(' ').toLowerCase()
    return matchesState && (!search || haystack.includes(search))
  })
  if (!platformUserSelectedId || !users.some((entry) => entry.id === platformUserSelectedId)) platformUserSelectedId = users[0]?.id || allUsers[0]?.id || ''
  const selectedUser = allUsers.find((entry) => entry.id === platformUserSelectedId) || users[0] || allUsers[0] || null
  const activeUsers = allUsers.filter((entry) => entry.status === 'active').length
  const usersWithActivity = allUsers.filter((entry) => entry.activity?.length).length
  const trace = selectedUser?.activity || []
  return `<section class="view-section platform-trace-view"><div class="section-header platform-console-header"><div><p class="kicker">Control de plataforma</p><h2>Usuarios y trazabilidad</h2><p class="section-description">Elegí una persona para seguir su actividad real en todos sus comercios.</p></div><div class="settings-actions"><button type="button" class="primary-action" data-action="refresh-platform-admin">Actualizar</button></div></div>
    ${feedbackMessage ? `<div class="feedback-banner">${feedbackMessage}</div>` : ''}
    <section class="platform-trace-stats"><span><strong>${allUsers.length}</strong> usuarios</span><span><strong>${activeUsers}</strong> activos</span><span><strong>${usersWithActivity}</strong> con actividad registrada</span></section>
    <section class="platform-trace-workspace"><aside class="panel platform-user-directory"><div class="panel-head"><div><p class="kicker">Directorio</p><h3>Usuarios</h3></div><span class="panel-count">${users.length}</span></div><div class="platform-user-filters"><input type="search" value="${escapeHtml(platformUserSearchQuery)}" data-platform-user-search placeholder="Buscar persona o comercio" /><select data-platform-user-filter><option value="all" ${platformUserFilter === 'all' ? 'selected' : ''}>Todos</option><option value="active" ${platformUserFilter === 'active' ? 'selected' : ''}>Activos</option><option value="inactive" ${platformUserFilter === 'inactive' ? 'selected' : ''}>Inactivos</option></select></div><div class="platform-user-list">${users.length ? users.map((entry) => `<button type="button" class="platform-user-row ${entry.id === selectedUser?.id ? 'is-selected' : ''}" data-platform-user-select="${entry.id}"><span class="platform-user-avatar">${escapeHtml((entry.fullName || '?').slice(0, 1).toUpperCase())}</span><span><strong>${escapeHtml(entry.fullName)}</strong><small>${escapeHtml(entry.email || 'Sin email')}</small><em>${entry.memberships?.[0]?.commerceName || 'Sin comercio'}</em></span><time>${entry.lastLoginAt ? formatDate(entry.lastLoginAt) : 'Sin acceso'}</time></button>`).join('') : '<p class="empty-state">No hay usuarios para este filtro.</p>'}</div></aside>
      ${selectedUser ? `<section class="platform-user-detail"><header class="platform-user-header"><span class="platform-user-avatar large">${escapeHtml((selectedUser.fullName || '?').slice(0, 1).toUpperCase())}</span><div><p class="kicker">Perfil seleccionado</p><h3>${escapeHtml(selectedUser.fullName)}</h3><p>${escapeHtml(selectedUser.email || 'Sin email')} · ${selectedUser.status === 'active' ? 'Activo' : 'Inactivo'}</p></div><div class="platform-user-meta"><span>Alta<strong>${formatDate(selectedUser.createdAt)}</strong></span><span>Último acceso<strong>${formatDate(selectedUser.lastLoginAt)}</strong></span></div></header>
        <section class="platform-membership-panel"><p class="kicker">Comercios y permisos</p><div>${(selectedUser.memberships || []).map((membership) => `<article><strong>${escapeHtml(membership.commerceName)}</strong><span>${escapeHtml(membership.instanceKey)} · ${membership.isOwner ? 'Propietario' : escapeHtml(membership.roleKey)}</span><em class="${membership.status === 'active' ? 'is-active' : ''}">${membership.status === 'active' ? 'Activo' : 'Inactivo'}</em></article>`).join('') || '<p class="empty-state">No tiene comercios asignados.</p>'}</div></section>
        <section class="panel platform-user-trace-panel"><div class="panel-head"><div><p class="kicker">Auditoría de usuario</p><h3>Línea de trazabilidad</h3><p>Solo metadatos: acción, hora y comercio.</p></div><span class="panel-count">${trace.length} eventos</span></div><div class="platform-user-trace">${trace.length ? trace.map((event) => { const module = entityModule[event.entityType] || 'settings'; return `<article class="platform-trace-event module-${module}"><span class="platform-trace-node"></span><div><div><span class="audit-module-tag module-${module}">${entityLabels[event.entityType] || 'Sistema'}</span><time>${formatDate(event.createdAt)}</time></div><strong>${actionLabels[event.action] || 'Actividad registrada'}</strong><p>${event.commerceName ? `En ${escapeHtml(event.commerceName)}` : 'Registro de cuenta Operando'}</p></div></article>` }).join('') : '<p class="empty-state">Todavía no hay eventos auditados para esta persona.</p>'}</div></section>
      </section>` : ''}
    </section>
  </section>`
}

const settingsView = (ui) => settingsViewV2(ui)

const settingsViewV2 = (ui) => `
  ${(() => {
    const editingUser = ui.snapshot.users.find((entry) => entry.id === userEditingId)
    const canManageUsers = Boolean(ui.user?.isPlatformAdmin || ui.user?.isOwner || ui.role?.key === 'admin')
    const canViewBranches = store.canAccessModule('branches', 'branches:view')
    const canViewRegisters = store.canAccessModule('registers', 'registers:view')
    const editingBranch = ui.snapshot.branches.find((branch) => branch.id === branchEditingId)
    const editingRegister = ui.snapshot.registers.find((register) => register.id === registerEditingId)
    const showBranchForm = branchFormOpen || Boolean(editingBranch)
    const showRegisterForm = registerFormOpen || Boolean(editingRegister)
    const syncLabel = ui.snapshot.meta.syncStatus === 'online'
      ? 'Base operativa'
      : ui.snapshot.meta.syncStatus === 'syncing'
        ? 'Actualizando'
        : ui.snapshot.meta.syncStatus === 'pending'
          ? 'Pendiente'
          : ui.snapshot.meta.syncStatus || 'Sin conexion'
    const arcaConnected = arcaConnectionStatus === 'connected'
    return `
  <section class="view-section"><div class="section-header"><div><p class="kicker">Ajustes</p><h2>Cuenta y configuracion</h2></div><div class="panel-inline-stats section-inline-stats">
      <span class="panel-inline-stat"><strong>${ui.user.fullName}</strong><span>${ui.role.name}</span></span>
      <span class="panel-inline-stat"><strong>${syncLabel}</strong><span>Base</span></span>
      <span class="panel-inline-stat"><strong>${ui.snapshot.business.enabledModules.length}</strong><span>Modulos</span></span>
    </div></div>
    ${feedbackMessage ? `<div class="feedback-banner">${feedbackMessage}</div>` : ''}
    <section class="stacked-section settings-stack">
      <article class="panel"><div class="panel-head"><div><h3>Cuenta activa</h3><p>Sesion, rol y acceso del negocio</p></div></div>
        <div class="priority-list">
          <div class="priority-item"><strong>Usuario</strong><p>${ui.user.fullName}<br /><small>${maskEmail(ui.user.email) || 'Sin email'}</small></p></div>
          <div class="priority-item"><strong>Perfil</strong><p>${ui.role.name}</p></div>
          <div class="priority-item"><strong>Comercio</strong><p>${ui.commerceContext?.commerce_name || 'Sin comercio activo'}</p></div>
          <div class="priority-item"><strong>Estado</strong><p>${syncLabel}${ui.snapshot.meta.lastSyncedAt ? `<br /><small>${ui.snapshot.meta.lastSyncedAt.slice(0, 16).replace('T', ' ')}</small>` : ''}</p></div>
        </div>
        <div class="settings-actions"><button type="button" class="primary-action" data-action="open-support">Soporte por WhatsApp</button><button type="button" class="danger-action" data-action="sign-out">Cerrar sesion</button></div>
      </article>
      <nav class="settings-section-switcher" aria-label="Secciones de configuracion">
        <button type="button" class="settings-section-trigger ${settingsPanelOpen === 'commerce' ? 'is-active' : ''}" data-settings-panel="commerce" aria-expanded="${settingsPanelOpen === 'commerce' ? 'true' : 'false'}"><strong>Datos del comercio</strong><span>Nombre, razon social y propietario</span></button>
        <button type="button" class="settings-section-trigger ${settingsPanelOpen === 'progressive-profile' ? 'is-active' : ''}" data-settings-panel="progressive-profile" aria-expanded="${settingsPanelOpen === 'progressive-profile' ? 'true' : 'false'}"><strong>Perfil opcional</strong><span>${ui.progressiveProfile.status === 'complete' ? 'Personalización lista' : 'Continuar cuando quieras'}</span></button>
        <button type="button" class="settings-section-trigger ${settingsPanelOpen === 'users' ? 'is-active' : ''}" data-settings-panel="users" aria-expanded="${settingsPanelOpen === 'users' ? 'true' : 'false'}"><strong>Usuarios y permisos</strong><span>${ui.enrichedUsers.length} cuentas del negocio</span></button>
        <button type="button" class="settings-section-trigger ${settingsPanelOpen === 'modules' ? 'is-active' : ''}" data-settings-panel="modules" aria-expanded="${settingsPanelOpen === 'modules' ? 'true' : 'false'}"><strong>Plan y modulos</strong><span>${ui.snapshot.business.enabledModules.length} modulos activos</span></button>
        ${canViewBranches ? `<button type="button" class="settings-section-trigger ${settingsPanelOpen === 'branches' ? 'is-active' : ''}" data-settings-panel="branches" aria-expanded="${settingsPanelOpen === 'branches' ? 'true' : 'false'}"><strong>Sucursales</strong><span>${ui.snapshot.branches.length} locales configurados</span></button>` : ''}
        ${canViewRegisters ? `<button type="button" class="settings-section-trigger ${settingsPanelOpen === 'registers' ? 'is-active' : ''}" data-settings-panel="registers" aria-expanded="${settingsPanelOpen === 'registers' ? 'true' : 'false'}"><strong>Puestos de cobro</strong><span>${ui.enrichedRegisters.length} cajas configuradas</span></button>` : ''}
        <button type="button" class="settings-section-trigger arca-status-trigger ${arcaConnected ? 'is-connected' : 'is-attention'} ${settingsPanelOpen === 'arca' ? 'is-active' : ''}" data-settings-panel="arca" aria-expanded="${settingsPanelOpen === 'arca' ? 'true' : 'false'}"><strong>Facturacion ARCA <i class="arca-status-dot" aria-hidden="true"></i></strong><span>${arcaConnected ? 'Conexion fiscal activa' : 'Requiere configuracion o verificacion'}</span></button>
      </nav>
      ${settingsPanelOpen === 'commerce' ? `<article class="panel settings-expand-panel" data-settings-content="commerce">
        <div class="panel-head"><div><h3>Comercio activo</h3><p>Datos principales del negocio y acceso general</p></div></div>
        <div class="summary-mini-row">
          <div class="summary-mini-card"><strong>Estado</strong><span>${syncLabel}</span></div>
          <div class="summary-mini-card"><strong>Pack</strong><span>${planLabels[ui.commerceContext?.active_plan || ui.snapshot.business.activePlan] || 'Operacion'}</span></div>
          <div class="summary-mini-card"><strong>Correo principal</strong><span>${maskEmail(ui.commerceContext?.owner_email || ui.snapshot.business.ownerEmail) || 'Sin correo principal'}</span></div>
        </div>
        <form class="form-grid compact-form settings-wide-form" data-form="commerce-profile">
          <label>Nombre comercial<input type="text" name="name" value="${ui.commerceContext?.commerce_name || ''}" ${canManageUsers ? 'required' : 'disabled'} /></label>
          <label>Email propietario<input type="email" name="ownerEmail" value="${ui.commerceContext?.owner_email || ''}" ${canManageUsers ? 'required' : 'disabled'} /></label>
          <label class="full-span">Razon social<input type="text" name="legalName" value="${ui.snapshot.business.organization || ''}" ${canManageUsers ? '' : 'disabled'} /></label>
          <button type="submit" ${canManageUsers ? '' : 'disabled'}>Guardar comercio</button>
        </form>
      </article>` : ''}
      ${settingsPanelOpen === 'progressive-profile' ? `<article class="panel settings-expand-panel" data-settings-content="progressive-profile"><div class="panel-head"><div><h3>Perfil progresivo</h3><p>Podés retomarlo o actualizarlo cuando quieras.</p></div></div>${!ui.user?.isOwner ? '<div class="info-strip"><strong>Solo el propietario puede editarlo</strong><span>Estos datos se usan únicamente para personalizar onboarding, soporte y sugerencias.</span></div>' : ''}<form class="form-grid compact-form settings-wide-form" data-form="progressive-profile"><label>Teléfono de contacto<input type="tel" name="phone" value="${escapeHtml(ui.progressiveProfile.phone || '')}" placeholder="Ej.: 11 4567-8901" ${ui.user?.isOwner ? 'required' : 'disabled'} /></label><label>Email de contacto<input type="email" name="email" value="${escapeHtml(ui.progressiveProfile.email || '')}" placeholder="nombre@negocio.com" ${ui.user?.isOwner ? 'required' : 'disabled'} /></label><label>País (opcional)<input type="text" name="country" value="${escapeHtml(ui.progressiveProfile.country || '')}" placeholder="Ej. Argentina" ${ui.user?.isOwner ? '' : 'disabled'} /></label><label>Rubro (opcional)<input type="text" name="industry" value="${escapeHtml(ui.progressiveProfile.industry || '')}" placeholder="Ej. Kiosco, indumentaria, servicios" ${ui.user?.isOwner ? '' : 'disabled'} /></label><label>¿Necesitás facturación ARCA?<select name="needsArca" ${ui.user?.isOwner ? '' : 'disabled'}><option value="">Todavía no lo sé</option><option value="yes" ${ui.progressiveProfile.needsArca === true ? 'selected' : ''}>Sí</option><option value="no" ${ui.progressiveProfile.needsArca === false ? 'selected' : ''}>No por ahora</option></select></label><fieldset class="full-span progressive-goals"><legend>¿Qué querés resolver primero?</legend><span>Elegí hasta 5 opciones.</span><div>${[['vender','Vender más rápido'],['stock','Controlar stock'],['caja','Ordenar caja'],['clientes','Gestionar clientes'],['facturacion','Emitir comprobantes'],['sucursales','Trabajar con sucursales']].map(([value,label]) => `<label class="checkbox-row"><input type="checkbox" name="operationalGoals" value="${value}" ${ui.progressiveProfile.operationalGoals.includes(value) ? 'checked' : ''} ${ui.user?.isOwner ? '' : 'disabled'} /><span>${label}</span></label>`).join('')}</div></fieldset><p class="form-note full-span">Estos datos no activan ARCA ni cambian permisos, módulos o el acceso al POS.</p><button type="submit" ${ui.user?.isOwner ? '' : 'disabled'}>Guardar perfil</button></form></article>` : ''}
      ${settingsPanelOpen === 'users' ? `<article class="panel settings-expand-panel" data-settings-content="users"><div class="panel-head"><div><h3>${editingUser ? 'Editar cuenta' : 'Usuarios del negocio'}</h3><p>Gestiona quienes pueden entrar y que rol tiene cada uno</p></div></div>
          ${!canManageUsers ? '<div class="info-strip"><strong>Solo lectura</strong><span>Necesitas entrar con la cuenta propietaria para editar permisos.</span></div>' : ''}
          <form class="form-grid" data-form="user">
            <input type="hidden" name="userId" value="${editingUser?.id || ''}" />
            <label>Nombre completo<input type="text" name="fullName" value="${editingUser?.fullName || ''}" ${canManageUsers ? 'required' : 'disabled'} /></label>
            <label>Usuario de acceso<input type="text" name="loginName" value="${editingUser?.loginName || ''}" placeholder="ej. caja-centro" autocomplete="username" autocapitalize="off" spellcheck="false" ${canManageUsers ? 'required' : 'disabled'} /><small>Sin correo. Usalo junto con la clave para iniciar sesión.</small></label>
            <label>Clave${editingUser ? ' nueva' : ''}<input type="password" name="pin" placeholder="${editingUser ? 'Solo si queres cambiarla' : 'Minimo 6 caracteres'}" ${editingUser ? (canManageUsers ? '' : 'disabled') : (canManageUsers ? 'required' : 'disabled')} /></label>
            <label>Rol<select name="roleId" ${canManageUsers ? 'required' : 'disabled'}>${ui.snapshot.roles.map((role) => `<option value="${role.id}" ${(editingUser ? editingUser.roleId : (userDraftRoleId || 'role-cashier')) === role.id ? 'selected' : ''}>${role.name}</option>`).join('')}</select></label>
            <label class="field-check full-span"><input type="checkbox" name="isActive" ${editingUser ? (editingUser.isActive ? 'checked' : '') : 'checked'} ${canManageUsers ? '' : 'disabled'} /><span class="field-check-box" aria-hidden="true"></span><span>Cuenta habilitada</span></label>
            ${renderUserScopeSelector(ui, editingUser, canManageUsers)}
            <button type="submit" ${canManageUsers ? '' : 'disabled'}>${editingUser ? 'Guardar permisos' : 'Crear usuario'}</button>
            ${editingUser ? '<button type="button" class="danger-action" data-action="cancel-user-edit">Cancelar edicion</button>' : ''}
          </form>
          ${dataTable(['Usuario', 'Perfil', 'Estado', 'Acceso', 'Gestion'], ui.enrichedUsers.map((entry) => `<div class="data-row"><span>${entry.fullName}${entry.isOwner ? ' <small>/ Propietario</small>' : ''}<br /><small>${entry.loginName ? `Usuario: ${entry.loginName}` : (entry.email || 'Sin usuario')}</small></span><span>${entry.roleName}</span><span>${entry.status === 'active' ? 'Activo' : entry.status === 'pending' ? 'Pendiente' : 'Deshabilitado'}</span><span>${entry.id === ui.user.id ? 'Sesion actual' : entry.isOwner ? 'Control total' : `${entry.moduleScopeCount} modulos / ${entry.blockedPermissionsCount} bloqueos`}</span><span>${userActionButtons(entry)}</span></div>`), 'is-stable settings-users-table')}
      </article>` : ''}
      ${settingsPanelOpen === 'modules' ? `<article class="panel settings-expand-panel" data-settings-content="modules"><div class="panel-head"><div><h3>Plan y modulos</h3><p>Activa solo lo que el cliente necesita</p></div></div>
        <form class="form-grid compact-form" data-form="module-preset">
          <label>Pack<select name="presetKey"><option value="basic" ${ui.snapshot.business.activePlan === 'basic' ? 'selected' : ''}>Gestion base</option><option value="retail" ${ui.snapshot.business.activePlan === 'retail' ? 'selected' : ''}>Mostrador</option><option value="full" ${ui.snapshot.business.activePlan === 'full' ? 'selected' : ''}>Operacion</option><option value="multi" ${ui.snapshot.business.activePlan === 'multi' ? 'selected' : ''}>Multi sucursal</option></select></label>
          <button type="submit">Aplicar preset</button>
        </form>
        <div class="settings-overview-grid">
          <div class="module-settings-grid">
            ${Object.values(ui.moduleCatalog).map((module) => {
              const isFixedModule = module.key === 'dashboard' || module.key === 'settings'
              return `
              <div class="timeline-item">
                <strong>${module.name}</strong>
                <p>${module.description}</p>
                <span>${isFixedModule ? 'Siempre activo para administradores' : (ui.snapshot.business.enabledModules.includes(module.key) ? 'Habilitado' : 'Oculto')}</span>
                ${isFixedModule ? '' : `<div class="settings-actions"><button type="button" class="inline-action" data-module-toggle="${module.key}" data-enabled="${ui.snapshot.business.enabledModules.includes(module.key) ? 'true' : 'false'}">${ui.snapshot.business.enabledModules.includes(module.key) ? 'Deshabilitar' : 'Habilitar'}</button></div>`}
              </div>
            `}).join('')}
          </div>
          <div class="settings-audit-column"><div class="panel-note"><strong>Actividad reciente</strong><span>Ultimos cambios del comercio.</span></div><div class="timeline-list compact-timeline">${ui.enrichedAudit.slice(0, 8).map((log) => `<div class="timeline-item"><strong>${log.action}</strong><p>${log.actorName} - ${log.entityType}${log.entityId ? ` #${String(log.entityId).slice(0, 8)}` : ''}</p><span>${log.createdAt.slice(0, 16).replace('T', ' ')}</span></div>`).join('') || '<p class="empty-state">Todavia no hay actividad registrada.</p>'}</div></div>
        </div>
      </article>` : ''}
      ${settingsPanelOpen === 'branches' && canViewBranches ? `<article class="panel settings-expand-panel" data-settings-content="branches"><div class="panel-head"><div><h3>Sucursales</h3><p>Locales, direccion y numeracion del comercio</p></div><div class="settings-actions">${editingBranch ? '' : createToggleButton('branch', showBranchForm, 'Agregar sucursal')}</div></div>
        ${showBranchForm ? `<form class="form-grid" data-form="branch"><input type="hidden" name="branchId" value="${editingBranch?.id || ''}" /><label>Nombre<input type="text" name="name" value="${editingBranch?.name || ''}" ${canManageUsers ? 'required' : 'disabled'} /></label><label>Codigo<input type="text" name="code" value="${editingBranch?.code || ''}" ${canManageUsers ? 'required' : 'disabled'} /></label><label class="full-span">Direccion<input type="text" name="address" value="${editingBranch?.address || ''}" ${canManageUsers ? 'required' : 'disabled'} /></label><button type="submit" ${canManageUsers ? '' : 'disabled'}>${editingBranch ? 'Guardar cambios' : 'Guardar sucursal'}</button>${editingBranch ? '<button type="button" class="danger-action" data-action="cancel-branch-edit">Cancelar edicion</button>' : '<button type="button" class="ghost-action" data-action="close-branch-form">Cancelar</button>'}</form>` : ''}
        ${dataTable(['Nombre', 'Codigo', 'Direccion', 'Actual', 'Accion'], ui.snapshot.branches.map((branch) => `<div class="data-row"><span>${branch.name}</span><span>${branch.code}</span><span>${branch.address}</span><span>${ui.currentBranch?.id === branch.id ? 'Si' : 'No'}</span><span>${branchActionButtons(branch)}</span></div>`))}
      </article>` : ''}
      ${settingsPanelOpen === 'registers' && canViewRegisters ? `<article class="panel settings-expand-panel" data-settings-content="registers"><div class="panel-head"><div><h3>Puestos de cobro</h3><p>Cajas asignadas a cada sucursal y cajero</p></div><div class="settings-actions">${editingRegister ? '' : createToggleButton('register', showRegisterForm, 'Agregar caja')}</div></div>
        ${showRegisterForm ? `<form class="form-grid" data-form="register"><input type="hidden" name="registerId" value="${editingRegister?.id || ''}" /><label>Sucursal<select name="branchId" ${canManageUsers ? 'required' : 'disabled'}>${ui.snapshot.branches.map((branch) => `<option value="${branch.id}" ${editingRegister?.branchId === branch.id ? 'selected' : ''}>${branch.name}</option>`).join('')}</select></label><label>Nombre<input type="text" name="name" value="${editingRegister?.name || ''}" ${canManageUsers ? 'required' : 'disabled'} /></label><label>Codigo<input type="text" name="code" value="${editingRegister?.code || ''}" ${canManageUsers ? 'required' : 'disabled'} /></label><label>Cajero<select name="cashierUserId" ${canManageUsers ? '' : 'disabled'}>${ui.snapshot.users.map((user) => `<option value="${user.id}" ${editingRegister?.cashierUserId === user.id ? 'selected' : ''}>${user.fullName}</option>`).join('')}</select></label><button type="submit" ${canManageUsers ? '' : 'disabled'}>${editingRegister ? 'Guardar cambios' : 'Guardar caja'}</button>${editingRegister ? '<button type="button" class="danger-action" data-action="cancel-register-edit">Cancelar edicion</button>' : '<button type="button" class="ghost-action" data-action="close-register-form">Cancelar</button>'}</form>` : ''}
        ${dataTable(['Caja', 'Codigo', 'Sucursal', 'Cajero', 'Accion'], ui.enrichedRegisters.map((register) => `<div class="data-row"><span>${register.name}</span><span>${register.code}</span><span>${register.branchName}</span><span>${register.cashierName}</span><span class="inline-action-group"><button type="button" class="inline-action" data-register-action="select" data-id="${register.id}">Usar</button>${registerActionButtons(register)}</span></div>`))}
      </article>` : ''}
      ${settingsPanelOpen === 'arca' ? `<article class="panel settings-expand-panel" data-settings-content="arca"><div class="panel-head"><div><h3>${arcaConnected ? 'Facturacion ARCA activa' : 'Activar facturacion ARCA'}</h3><p>Configuracion guiada y segura para emitir comprobantes electronicos</p></div><span class="badge ${arcaConnected ? 'is-success' : 'is-warning'}">${arcaConnected ? 'Conexion activa' : 'Demo visual'}</span></div>
        <div class="info-strip ${arcaConnected ? 'is-success' : 'is-warning'}"><strong>${arcaConnected ? 'ARCA conectada y lista para facturar' : 'Configuracion fiscal pendiente'}</strong><span>${arcaConnected ? 'Certificado, WSAA y punto de venta validados. Operando puede emitir comprobantes con CAE.' : 'Los datos se envian al servicio fiscal privado de Operando. Tu Clave Fiscal nunca se solicita.'}</span></div>
        <div class="arca-steps" aria-label="Progreso de activacion">${['Datos fiscales', 'Certificado', 'Cuenta ARCA', 'Verificacion'].map((label, index) => `<span class="${arcaSetupStep === index + 1 ? 'is-active' : arcaSetupStep > index + 1 ? 'is-complete' : ''}"><i>${arcaSetupStep > index + 1 ? '✓' : index + 1}</i>${label}</span>`).join('')}</div>
        ${arcaSetupStep === 1 ? `<div class="arca-step-content"><div class="panel-head"><div><h3>Datos fiscales del comercio</h3><p>Se usan para crear el certificado y verificar el punto de venta.</p></div></div><div class="form-grid compact-form settings-wide-form"><label>CUIT<input name="arca-cuit" inputmode="numeric" value="${arcaFiscal.cuit}" placeholder="20-12345678-9" /></label><label class="full-span">Razon social<input name="arca-legal-name" value="${arcaFiscal.legalName || ui.snapshot.business.organization || ui.commerceContext?.legal_name || ui.commerceContext?.commerce_name || ''}" placeholder="Nombre fiscal del comercio" /></label><label>Punto de venta Web Services<input name="arca-point-sale" inputmode="numeric" value="${arcaFiscal.pointOfSale}" placeholder="Ej. 0002" /></label></div><div class="settings-actions"><button type="button" class="primary-action" data-action="arca-save-fiscal">Continuar con certificado</button></div></div>` : ''}
        ${arcaSetupStep === 2 ? `<div class="arca-step-content"><div class="panel-head"><div><h3>Certificado tecnico</h3><p>Operando genera y guarda la clave privada cifrada; solo descargás la solicitud CSR.</p></div></div><div class="timeline-list compact-timeline"><div class="timeline-item"><strong>Solicitud de certificado (CSR)</strong><p>${arcaCsrGenerated ? 'Lista para descargar y presentar en ARCA.' : 'Generala para asociarla al servicio de Facturacion Electronica.'}</p></div></div><div class="settings-actions">${arcaCsrGenerated ? '<button type="button" class="primary-action" data-action="arca-download-csr">Descargar solicitud CSR</button><button type="button" class="ghost-action" data-action="arca-next-step">Continuar a ARCA</button>' : '<button type="button" class="primary-action" data-action="arca-generate-csr">Generar solicitud de certificado</button>'}<button type="button" class="ghost-action" data-action="arca-previous-step">Volver</button></div></div>` : ''}
        ${arcaSetupStep === 3 ? `<div class="arca-step-content"><div class="panel-head"><div><h3>Completa la autorizacion en ARCA</h3><p>Este es el unico paso que debe realizar el titular o contador del comercio.</p></div></div><div class="timeline-list compact-timeline"><div class="timeline-item"><strong>1. Habilita el punto de venta</strong><p>Crea un punto de venta exclusivo para Web Services.</p></div><div class="timeline-item"><strong>2. Autoriza el certificado</strong><p>Asocialo al servicio Facturacion Electronica desde tu cuenta ARCA.</p></div><div class="timeline-item"><strong>3. Volve a Operando</strong><p>Subi el certificado emitido por ARCA. No subas claves ni compartas tu Clave Fiscal.</p></div></div><label class="arca-upload">Certificado de ARCA (.crt/.pem)<input type="file" accept=".crt,.cer,.pem" data-arca-certificate /><span>${arcaCertificateName || 'Seleccionar certificado'}</span></label><div class="settings-actions"><button type="button" class="primary-action" data-action="open-arca-guide">Abrir guia oficial de ARCA</button><button type="button" class="ghost-action" data-action="arca-next-step" ${arcaCertificateName ? '' : 'disabled'}>Continuar a verificacion</button><button type="button" class="ghost-action" data-action="arca-previous-step">Volver</button></div></div>` : ''}
        ${arcaSetupStep === 4 ? `<div class="arca-step-content"><div class="panel-head"><div><h3>Verificar y activar</h3><p>Operando comprueba certificado, WSAA y el punto de venta en homologacion.</p></div></div><div class="arca-verification ${arcaVerificationState}"><strong>${arcaVerificationState === 'verified' ? 'Conexion lista para facturar' : arcaVerificationState === 'checking' ? 'Verificando configuracion…' : 'Listo para verificar'}</strong><span>${arcaVerificationState === 'verified' ? 'La facturacion ARCA de homologacion esta activa.' : 'La verificacion consulta ARCA; no emite ninguna factura.'}</span></div><div class="settings-actions"><button type="button" class="primary-action ${arcaVerificationState === 'verified' ? 'is-success' : ''}" data-action="arca-verify">${arcaVerificationState === 'verified' ? 'Conexion ARCA activa' : 'Verificar y activar'}</button><button type="button" class="ghost-action" data-action="arca-previous-step">Volver</button></div></div>` : ''}
        <div class="panel-note"><strong>Activacion autoservicio</strong><span>Completa los cuatro pasos de esta pantalla. El soporte general de Operando queda disponible por separado en el menu Soporte.</span></div>
      </article>` : ''}
    </section>
  </section>
`})()}
`

const basicSettingsView = (ui) => `
  <section class="view-section"><div class="section-header"><div><p class="kicker">Ajustes</p><h2>Mi sesion</h2></div></div>
    ${feedbackMessage ? `<div class="feedback-banner">${feedbackMessage}</div>` : ''}
    <section class="module-summary-grid">
      <article class="metric-card compact"><span>Sesion</span><strong>${ui.user.fullName}</strong><p>${ui.role.name}</p></article>
      <article class="metric-card compact"><span>Base</span><strong>${ui.snapshot.meta.syncStatus === 'online' ? 'Operativa' : (ui.snapshot.meta.syncStatus || 'Sin conexion')}</strong><p>Datos del negocio</p></article>
      <article class="metric-card compact"><span>Modulos</span><strong>${ui.snapshot.business.enabledModules.length}</strong><p>Disponibles en tu cuenta</p></article>
    </section>
    <section class="content-grid single-focus">
      <article class="panel"><div class="panel-head"><div><h3>Cuenta activa</h3><p>Datos de tu sesion y del negocio actual</p></div></div>
        <div class="priority-list">
          <div class="priority-item"><strong>Usuario</strong><p>${ui.user.fullName}<br /><small>${maskEmail(ui.user.email) || 'Sin email'}</small></p></div>
          <div class="priority-item"><strong>Perfil</strong><p>${ui.role.name}</p></div>
          <div class="priority-item"><strong>Comercio</strong><p>${ui.commerceContext?.commerce_name || 'Sin comercio activo'}</p></div>
          <div class="priority-item"><strong>Sucursal</strong><p>${ui.currentBranch?.name || 'Sin sucursal activa'}</p></div>
          <div class="priority-item"><strong>Estado</strong><p>${ui.snapshot.meta.syncStatus === 'online' ? 'Base operativa' : (ui.snapshot.meta.syncStatus || 'Sin conexion')}</p></div>
          <div class="priority-item"><strong>Pack</strong><p>${planLabels[ui.commerceContext?.active_plan || ui.snapshot.business.activePlan] || 'Operacion'}</p></div>
        </div>
        <div class="settings-actions"><button type="button" class="primary-action" data-action="open-support">Hablar con soporte</button><button type="button" class="danger-action" data-action="sign-out">Cerrar sesion</button></div>
      </article>
    </section>
  </section>
`

const renderCurrentView = (ui) => {
  if (ui.user?.isPlatformAdmin) return ownerAdminViewV2(ui)
  const canManageCommerceSettings = Boolean(ui.user?.isPlatformAdmin || ui.user?.isOwner || ui.role?.key === 'admin')
  switch (activeSection) {
    case 'clientes': return customersViewV2(ui)
    case 'ventas': return salesViewV2(ui)
    case 'caja': return cashViewV2(ui)
    case 'sucursales': return branchesViewV2(ui)
    case 'cajeros': return registersViewV2(ui)
    case 'productos': return productsView(ui)
    case 'compras': return purchasesViewV2(ui)
    case 'facturacion': return invoicesViewV2(ui)
    case 'tickets': return ticketsViewV2(ui)
    case 'reportes': return reportsView(ui)
    case 'auditoria': return auditView(ui)
    case 'mi-admin': return ui.user?.isPlatformAdmin ? ownerAdminViewV2(ui) : settingsViewV2(ui)
    case 'ajustes': return canManageCommerceSettings ? settingsViewV2(ui) : basicSettingsView(ui)
    default: return dashboardViewV2(ui)
  }
}

const progressiveProfileModal = (ui) => {
  if (!progressiveProfilePromptOpen || !ui.user?.isOwner || (ui.progressiveProfile.status === 'complete' && progressiveProfileStep !== 3)) return ''
  const profile = ui.progressiveProfile
  const goals = [['vender','Vender más rápido'],['stock','Controlar stock'],['caja','Ordenar caja'],['clientes','Gestionar clientes'],['facturacion','Emitir comprobantes'],['sucursales','Trabajar con sucursales']]
  const selectedGoals = progressiveProfileGoalsDraft || profile.operationalGoals
  const isGoalsStep = progressiveProfileStep === 1
  const isContactStep = progressiveProfileStep === 2
  const contactReady = /^[+()0-9\s-]{6,30}$/.test(profile.phone || '') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email || '')
  const stepContent = isGoalsStep
    ? `<fieldset class="progressive-goals"><legend>Elegí hasta 5 prioridades</legend><div class="goal-option-grid">${goals.map(([value,label]) => `<label class="goal-option"><input type="checkbox" name="operationalGoals" value="${value}" ${selectedGoals.includes(value) ? 'checked' : ''} /><span class="goal-option-mark">✓</span><span>${label}</span></label>`).join('')}</div><p class="progressive-goal-feedback" aria-live="polite">Elegí las que más impacten hoy. Podés continuar con menos de cinco.</p></fieldset><div class="progressive-profile-actions"><button type="button" class="primary-action" data-action="progressive-profile-next">Continuar</button><button type="button" class="ghost-action" data-action="close-progressive-profile">Ahora no</button></div>`
    : isContactStep
      ? `<div class="progressive-profile-step-intro"><span class="progressive-profile-step-label">Paso 2 de 3</span><h3>¿Cómo te contactamos?</h3><p>Teléfono y email son necesarios para acompañarte. País, rubro y ARCA siguen siendo opcionales.</p></div>${selectedGoals.map((goal) => `<input type="hidden" name="operationalGoals" value="${goal}" />`).join('')}<div class="form-grid compact-form progressive-profile-fields"><label>Teléfono de contacto <b aria-hidden="true">*</b><input type="tel" name="phone" value="${escapeHtml(profile.phone || '')}" placeholder="Ej.: 11 4567-8901" autocomplete="tel" inputmode="tel" pattern="[+()0-9\\s-]{6,30}" required /></label><label>Email de contacto <b aria-hidden="true">*</b><input type="email" name="email" value="${escapeHtml(profile.email || '')}" placeholder="nombre@negocio.com" autocomplete="email" required /></label><label>País (opcional)<input type="text" name="country" value="${escapeHtml(profile.country || '')}" placeholder="Ej. Argentina" /></label><label>Rubro (opcional)<input type="text" name="industry" value="${escapeHtml(profile.industry || '')}" placeholder="Ej. Kiosco, indumentaria" /></label><label>¿Necesitás ARCA?<select name="needsArca"><option value="">Todavía no lo sé</option><option value="yes" ${profile.needsArca === true ? 'selected' : ''}>Sí</option><option value="no" ${profile.needsArca === false ? 'selected' : ''}>No por ahora</option></select></label></div><p class="progressive-contact-status ${progressiveProfileError ? 'is-error' : ''}" aria-live="polite">${escapeHtml(progressiveProfileError || (contactReady ? 'Listo para guardar tus datos.' : 'Completá teléfono y email para continuar.'))}</p><div class="progressive-profile-actions"><button type="button" class="ghost-action" data-action="progressive-profile-previous">Volver</button><button type="submit" class="primary-action" data-progressive-contact-submit ${contactReady ? '' : 'disabled'}>Guardar y continuar</button></div>`
      : `<div class="progressive-profile-success"><span class="progressive-profile-step-label">Paso 3 de 3</span><span class="progressive-profile-success-mark">✓</span><h3>Datos guardados.</h3><p>Ya tenemos la información necesaria para acompañarte. Podés empezar a operar y retomar la configuración cuando quieras.</p><button type="button" class="primary-action" data-action="finish-progressive-profile">Empezar a operar</button></div>`
  return `<div class="progressive-profile-overlay" role="presentation"><section class="progressive-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="progressive-profile-title">${isGoalsStep ? '<button type="button" class="progressive-profile-close" data-action="close-progressive-profile" aria-label="Cerrar y seguir operando">×</button>' : ''}<div class="progressive-profile-layout"><aside class="progressive-profile-route"><span class="progressive-profile-step">0${progressiveProfileStep}</span><p class="kicker">Puesta a punto</p><h2>${isGoalsStep ? 'Tu operación,<br />a tu medida.' : isContactStep ? 'Sumemos<br />contexto.' : 'Todo<br />listo.'}</h2><p>${isGoalsStep ? 'Elegí qué querés resolver primero. El resto es opcional.' : isContactStep ? 'Datos de contacto para acompañarte cuando lo necesites.' : 'Ya podés seguir con tu operación.'}</p><span class="progressive-profile-time">Paso ${progressiveProfileStep} de 3 · Menos de 1 minuto</span></aside><div class="progressive-profile-content"><p class="kicker">Configuración rápida</p><h2 id="progressive-profile-title">${isGoalsStep ? '¿Por dónde empezamos?' : isContactStep ? 'Personalicemos la ayuda' : 'Perfil completo'}</h2><p class="progressive-profile-copy">Usamos estas respuestas solo para ajustar sugerencias y soporte. No cambia tu acceso ni frena el POS.</p><form class="progressive-profile-modal-form" data-form="progressive-profile">${stepContent}</form></div></div></section></div>`
}

const renderApp = (ui) => {
  const onboardingKey = getOnboardingStorageKey()
  if (onboardingLoadedFor !== onboardingKey) {
    onboardingLoadedFor = onboardingKey
    loadOnboarding(ui.user?.productGuideSeenAt)
  }
  if (!ui.user?.productGuideSeenAt && onboarding.visible && onboardingSeenReportedFor !== onboardingKey) {
    onboardingSeenReportedFor = onboardingKey
    store.markProductGuideSeen().then((result) => {
      if (result?.ok) authManager?.updateSessionProfile?.({ product_guide_seen_at: result.productGuideSeenAt })
    }).catch(() => {
      // La guía sigue siendo opcional si la red se corta durante este aviso.
    })
  }
  const allowedNav = getAllowedNav(ui)
  if (!allowedNav.some((item) => item.id === activeSection)) activeSection = allowedNav[0]?.id || 'dashboard'
  saveSection()
  const isPlatformConsole = Boolean(ui.user?.isPlatformAdmin)
  const branchName = ui.currentBranch?.name || ui.snapshot.business.branch || 'Sucursal'
  const registerName = ui.currentRegister?.name || 'Sin caja asignada'
  const isDevEnvironment = ui.cloudConnection.environment === 'development'
  const environmentLabel = ui.cloudConnection.environmentLabel || 'Sandbox'
  const statusTitle = ui.openCashSession ? 'Abierta' : 'Cerrada'
  const statusHint = ui.branchRegisters.length > 1 ? registerName : ''
  const searchOptions = buildQuickSearchTargets(ui).slice(0, 40).map((item) => `<option value="${item.label}"></option>`).join('')
  const userName = ui.user?.fullName || 'Usuario'
  const userInitials = userName.split(/\s+/).filter(Boolean).slice(0, 2).map((chunk) => chunk[0]?.toUpperCase()).join('') || 'PC'
  const allAlertItems = isPlatformConsole ? [] : [
    ...(!ui.openCashSession ? [{ id: 'cash-closed', title: 'Caja cerrada', detail: 'No hay una caja abierta para operar en efectivo.', section: 'caja', target: '[data-cash-operation]' }] : []),
    ...ui.lowStock.slice(0, 4).map((product) => ({
      id: `low-stock-${product.id}`,
      title: 'Stock bajo',
      detail: `${product.name}: ${product.scopedStock} unidades en ${ui.currentBranch?.name || 'la sucursal'} (min. ${product.minStock}).`,
      section: 'productos',
      target: `[data-product-id=${product.id}]`,
    })),
    ...ui.enrichedInvoices.filter((invoice) => invoice.status !== 'Cobrada').slice(0, 4).map((invoice) => ({
      id: `pending-invoice-${invoice.id}`,
      title: 'Factura pendiente',
      detail: `${invoice.number} / ${invoice.customerName} / ${money(invoice.totalAmount)}.`,
      section: 'facturacion',
      target: `[data-invoice-id=${invoice.id}]`,
    })),
  ]
  const alertItems = allAlertItems.filter((item) => !dismissedAccountAlertIds.has(item.id))
  const notificationCount = alertItems.length
  const topbarRightClass = 'topbar-right is-account-only'

  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <img class="brand-logo" src="/operando-logo.png?v=operando-20260831" alt="Operando" />
        </div>
        <nav class="sidebar-nav">${allowedNav.map((item) => `<button class="nav-square ${activeSection === item.id ? 'is-active' : ''}" type="button" data-section="${item.id}" title="${item.label}" aria-label="${item.label}"><span class="nav-icon">${item.icon}</span><span class="nav-label">${item.label}</span></button>`).join('')}</nav>
        <div class="sidebar-support"><div class="support-menu-wrap"><button class="nav-square support-square ${supportMenuOpen ? 'is-active' : ''}" type="button" data-action="toggle-support-menu" title="Soporte" aria-label="Abrir opciones de soporte" aria-expanded="${supportMenuOpen}"><span class="nav-icon">${icon('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8.5 9h7"/><path d="M8.5 13h4"/>')}</span><span class="nav-label">Soporte</span></button>${supportMenuOpen ? `<div class="support-menu" role="menu"><button type="button" data-action="open-arca-setup" role="menuitem"><strong>Facturacion ARCA</strong><span>Configura la conexion fiscal</span></button><button type="button" data-action="open-support" role="menuitem"><strong>Soporte general</strong><span>Habla con Operando por WhatsApp</span></button></div>` : ''}</div></div>
      </aside>
      <div class="workspace">
        <header class="topbar">
          <div class="topbar-left"><p class="kicker">${isPlatformConsole ? 'Administracion de plataforma' : 'Panel de control'}</p><h1>${isPlatformConsole ? productName : (ui.commerceContext?.commerce_name || productName)}</h1><span>${isPlatformConsole ? `Consola interna · ${appVersion}` : `${branchName} · ${appVersion}`}</span></div>
          <div class="topbar-center">
            ${isPlatformConsole ? '' : `<form class="quick-search" data-form="topbar-jump">
              <span class="quick-search-icon" aria-hidden="true">${icon('<circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/>')}</span>
              <input type="search" name="query" value="${topbarSearch}" list="nav-search-options" placeholder="Buscar ventas, clientes, productos, stock, facturas o cajas" />
              <datalist id="nav-search-options">${searchOptions}</datalist>
            </form>`}
          </div>
          <div class="${topbarRightClass}">
            <button type="button" class="topbar-guide-action" data-action="resume-onboarding" aria-label="Abrir guía inicial">Guía inicial</button>
            ${isDevEnvironment ? `<span class="topbar-runtime is-dev">${environmentLabel}</span>` : ''}
            <div class="account-alerts-wrap">
              <button class="account-card compact-meta ${accountAlertsOpen ? 'is-open' : ''}" type="button" data-action="toggle-account-alerts" aria-label="Abrir menu de cuenta" aria-expanded="${accountAlertsOpen ? 'true' : 'false'}">
                <span class="account-avatar">${userInitials}</span>
                <span class="account-copy"><strong>${userName}</strong><span>${isPlatformConsole ? 'Administrador Operando' : (ui.role?.name || 'Usuario')}</span></span>
                ${isPlatformConsole ? '' : `<span class="account-cash-state ${ui.openCashSession ? 'is-open' : 'is-closed'}"><span class="status-led" aria-hidden="true"></span><span>${statusTitle}</span></span>`}
                ${notificationCount ? `<span class="account-alert-count" aria-label="${notificationCount} alertas">${notificationCount}</span>` : ''}
                <span class="account-menu-chevron" aria-hidden="true">⌄</span>
              </button>
              ${accountAlertsOpen ? `<div class="account-alerts-popover">
                <div class="account-alerts-head">
                  <div><strong>${userName}</strong><span>${isPlatformConsole ? 'Administrador Operando' : (ui.role?.name || 'Usuario')}</span></div>
                  <button type="button" class="ghost-action account-alerts-link" data-action="open-account-panel">Mi cuenta</button>
                </div>
                ${isPlatformConsole ? '' : `<button type="button" class="account-cash-action ${ui.openCashSession ? 'is-open' : 'is-closed'}" data-section="caja" data-cash-operation>
                  <span class="status-led" aria-hidden="true"></span>
                  <span><strong>Caja ${statusTitle.toLowerCase()}</strong><small>${statusHint || (ui.openCashSession ? 'Lista para operar' : 'Abrir para cobrar en efectivo')}</small></span>
                  <span aria-hidden="true">›</span>
                </button>`}
                <div class="account-popover-label">${isPlatformConsole ? 'Consola Operando' : 'Alertas'}</div>
                <div class="account-alerts-list">
                  ${alertItems.length ? alertItems.map((item) => `<div class="account-alert-item">
                    <button type="button" class="account-alert-open" data-alert-section="${item.section}" data-alert-target="${item.target}">
                      <strong>${item.title}</strong>
                      <span>${item.detail}</span>
                    </button>
                    <button type="button" class="account-alert-dismiss" data-dismiss-alert="${item.id}" aria-label="Descartar alerta: ${item.title}" title="Descartar alerta">×</button>
                  </div>`).join('') : `<div class="account-alert-item is-empty"><strong>Todo en orden</strong><span>No hay alertas activas en este momento.</span></div>`}
                </div>
                <div class="account-menu-actions">
                  <button class="account-theme-action" type="button" data-action="toggle-theme" aria-label="Cambiar tema"><span>${theme === 'dark' ? 'Modo oscuro' : 'Modo claro'}</span><small>Cambiar apariencia</small></button>
                  <button class="account-signout-action" type="button" data-action="sign-out">Cerrar sesión</button>
                </div>
              </div>` : ''}
            </div>
          </div>
        </header>
        <main class="page">${guideCard()}${renderCurrentView(ui)}</main>
        ${progressiveProfileModal(ui)}
      </div>
    </div>
  `
}

const renderTurnstileWidget = (attempt = 0) => {
  const target = app.querySelector('.turnstile-container')
  if (!target || ['true', 'pending'].includes(target.dataset.rendered)) return
  const showUnavailableMessage = () => {
    target.replaceChildren()
    target.dataset.rendered = 'true'
    const message = document.createElement('p')
    message.className = 'login-error'
    message.setAttribute('role', 'alert')
    message.textContent = 'La verificacion de seguridad no esta disponible en este momento. Actualiza la pagina o intenta nuevamente en unos minutos.'
    target.append(message)
  }
  if (!globalThis.turnstile?.ready || !globalThis.turnstile?.render) {
    if (attempt < 40) window.setTimeout(() => renderTurnstileWidget(attempt + 1), 50)
    else showUnavailableMessage()
    return
  }
  target.dataset.rendered = 'pending'
  globalThis.turnstile.ready(() => {
    if (!target.isConnected || target.dataset.rendered !== 'pending') return
    try {
      target.dataset.rendered = 'true'
      let widgetId = ''
      widgetId = globalThis.turnstile.render(target, {
        sitekey: String(target.dataset.sitekey || ''),
        action: 'turnstile-spin-v2',
        size: 'flexible',
        theme: 'dark',
        'error-callback': () => {
          if (widgetId) globalThis.turnstile?.remove(widgetId)
          showUnavailableMessage()
        },
      })
    } catch {
      showUnavailableMessage()
    }
  })
}

const render = () => {
  const ui = getUiState()
  app.innerHTML = ui.cloudConnection.required && !ui.cloudConnection.enabled
    ? cloudActivationView(ui)
    : (ui.isAuthenticated ? renderApp(ui) : loginView(ui))
  renderTurnstileWidget()
  applyFieldGuidance()
  markBootComplete()
  bindEvents()
  if (pendingOnboardingFocus) {
    pendingOnboardingFocus = false
    window.requestAnimationFrame(() => document.querySelector('[data-action="focus-onboarding-control"]')?.click())
  }
  clearFeedbackSoon()
  flushScrollTop()
  flushPendingScrollTarget()
}

const fieldExamples = {
  identifier: 'Ej.: juan@comercio.com',
  pin: 'Ej.: 123456 (minimo 6 caracteres)',
  password: 'Ej.: 123456 (minimo 6 caracteres)',
  passwordConfirm: 'Ej.: Repite la clave anterior',
  commerceName: 'Ej.: Kiosco El Sol',
  ownerName: 'Ej.: Juan Perez',
  ownerEmail: 'Ej.: juan@kiosco.com',
  fullName: 'Ej.: Juan Perez',
  phone: 'Ej.: 11 4567-8901',
  email: 'Ej.: cliente@correo.com',
  balance: 'Ej.: 25000',
  tag: 'Ej.: Mayorista, taller o mostrador',
  sku: 'Ej.: BEB-500-001',
  barcode: 'Ej.: 7791234567890',
  stock: 'Ej.: 24',
  salePrice: 'Ej.: 1500',
  costPrice: 'Ej.: 900',
  minStock: 'Ej.: 5',
  category: 'Ej.: Bebidas',
  quickAddCode: 'Ej.: Coca-Cola, SKU o codigo de barras',
  discountAmount: 'Ej.: 500',
  amountPaid: 'Ej.: 10000',
  cashAmount: 'Ej.: 5000',
  transferAmount: 'Ej.: 5000',
  mercadoPagoAmount: 'Ej.: 5000',
  accountAmount: 'Ej.: 5000',
  openingAmount: 'Ej.: 20000',
  countedAmount: 'Ej.: 18500',
  amount: 'Ej.: 2500',
  note: 'Ej.: Pago de flete, reposicion o referencia',
  documentNumber: 'Ej.: FAC-000123',
  quantity: 'Ej.: 12',
  unitCost: 'Ej.: 850',
  lastDelivery: 'Ej.: 23/07/2026',
  contact: 'Ej.: Maria Gonzalez',
  device: 'Ej.: Notebook Lenovo IdeaPad 3',
  issue: 'Ej.: No enciende y requiere revisar el cargador',
  number: 'Ej.: FAC-000123 o TCK-000045',
  totalAmount: 'Ej.: 18500',
  dueDate: 'Ej.: 30/07/2026',
  legalName: 'Ej.: Juan Perez Servicios',
  name: 'Ej.: Nombre del registro',
  code: 'Ej.: CASA-01',
  address: 'Ej.: Av. Corrientes 1234, CABA',
  contactEmail: 'Ej.: contacto@proveedor.com',
  supportOwner: 'Ej.: Lucas',
  internalTag: 'Ej.: Kiosco, demo o referido',
  commercialNote: 'Ej.: Llamar el viernes para ofrecer el plan Mostrador',
  billingNote: 'Ej.: Abona del 1 al 5 de cada mes',
  url: 'Ej.: https://xxxxx.supabase.co',
  anonKey: 'Ej.: sb_publishable_xxx',
  instanceKey: 'Ej.: mi-comercio',
}

const getFieldExample = (field, form) => {
  const name = field.name || ''
  if (name === 'name') {
    const formType = form?.dataset.form || ''
    if (formType === 'product') return 'Ej.: Coca-Cola 500 ml'
    if (formType === 'supplier') return 'Ej.: Distribuidora Norte'
    if (formType === 'branch') return 'Ej.: Casa Central'
    if (formType === 'register') return 'Ej.: Caja mostrador 1'
    if (formType === 'commerce-profile') return 'Ej.: Kiosco El Sol'
  }
  if (name === 'code') {
    const formType = form?.dataset.form || ''
    if (formType === 'register') return 'Ej.: CAJA-01'
    if (formType === 'branch') return 'Ej.: CASA-01'
  }
  return fieldExamples[name] || ''
}

const applyFieldGuidance = () => {
  for (const form of document.querySelectorAll('form[data-form]')) {
    for (const field of form.querySelectorAll('input:not([type="hidden"]), textarea')) {
      if (field.disabled) continue
      const example = getFieldExample(field, form)
      if (example && !field.value) field.placeholder = example
      const label = field.closest('label')
      if (!label || field.required || label.textContent.includes('(opcional)')) continue
      const type = field.type || 'text'
      if (['checkbox', 'radio', 'file'].includes(type)) continue
      const textNode = [...label.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim())
      if (textNode) textNode.textContent = `${textNode.textContent.trim()} (opcional) `
    }
  }
}

const readSiteCloudConfig = async () => {
  try {
    const response = await fetch('/cloud-config.json', { cache: 'no-store' })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

const bootstrap = async () => {
  canonicalizeLegacyPanelRoute()
  canonicalizeRecoveryRoute()
  const initialCloudConfig = await readSiteCloudConfig()
  window.__operandoTurnstileSiteKey = String(initialCloudConfig?.turnstileSiteKey || '')
  const entryAuthMode = ({ login: 'login', signup: 'signup', recovery: 'recovery', reset: 'reset' })[operandoEntry] || ''
  authViewMode = authModeFromPath() || entryAuthMode || getRequestedPublicView() || (window.__operandoAppEntry ? 'login' : authViewMode)
  activeSection = sectionFromPath()
  if (!window.operandoDesktop) {
    safeStorage.removeItem(dataStorageKey)
    safeStorage.removeItem(cloudConfigStorageKey)
    safeStorage.removeItem(instanceStorageKey)
    safeStorage.removeItem(themeStorageKey)
    safeStorage.removeItem(sectionStorageKey)
  }
  authInstanceKey = normalizeInstanceKey(
    safeStorage.getItem(instanceStorageKey, '')
    || initialCloudConfig?.instanceKey
    || 'operando-dev'
  )
  const storeOptions = {
    initialCloudConfig,
    requireCloud: !window.operandoDesktop,
  }
  store = createBrowserDataStore(storeOptions)
  authManager = initialCloudConfig?.url && initialCloudConfig?.anonKey
    ? createCloudAuthManager({ url: initialCloudConfig.url, anonKey: initialCloudConfig.anonKey, instanceKey: initialCloudConfig.instanceKey, turnstileSiteKey: initialCloudConfig.turnstileSiteKey })
    : null
  try {
    if (authManager) {
      recoveryState = await authManager.consumeRecoverySession()
      if (recoveryState) {
        authViewMode = 'reset'
        loginMessage = ''
        signupMessage = ''
      }
    }
    if (store.getCloudConnection().enabled && authManager) {
      setupStatus = await authManager.getSetupStatus({ instanceKey: authInstanceKey })
    }
    if (store.getCloudConnection().enabled && authManager && setupStatus?.initialized) {
      const restoredSession = await authManager.restoreSession()
      if (restoredSession?.sessionToken) {
        authInstanceKey = normalizeInstanceKey(restoredSession.commerceContext?.instance_key || authInstanceKey)
        safeStorage.setItem(instanceStorageKey, authInstanceKey)
        store.setCloudAccessToken(restoredSession.sessionToken)
      }
    }
    if (store.getCloudConnection().enabled && authManager?.getSession()?.sessionToken) {
      cloudSyncBusy = true
      await loadCloudAccess()
    }
  } catch (error) {
    loginMessage = mapPublicAuthError(error?.message, 'login')
    feedbackMessage = ''
    commerceContext = null
    store.clearCloudAuthSession()
  } finally {
    cloudSyncBusy = false
    try {
      render()
    } catch (error) {
      resetBrokenBrowserState()
      store = createBrowserDataStore(storeOptions)
      authManager = initialCloudConfig?.url && initialCloudConfig?.anonKey
        ? createCloudAuthManager({ url: initialCloudConfig.url, anonKey: initialCloudConfig.anonKey, instanceKey: initialCloudConfig.instanceKey })
        : null
      loginMessage = 'La aplicacion se recupero y reinicio la sesion.'
      render()
    }
  }
}

const getReceiptDocument = (saleId) => {
  const ui = getUiState()
  const sale = ui.snapshot.sales.find((entry) => entry.id === saleId)
  if (!sale) return null
  const customer = ui.snapshot.customers.find((entry) => entry.id === sale.customerId)
  const branch = ui.snapshot.branches.find((entry) => entry.id === sale.branchId) || ui.currentBranch
  const register = ui.snapshot.registers.find((entry) => entry.id === sale.registerId)
  const lines = sale.items.map((item) => {
    const product = ui.snapshot.products.find((entry) => entry.id === item.productId)
    return `<tr><td>${product?.name || 'Articulo'}</td><td>${item.quantity}</td><td>${money(item.unitPrice)}</td><td>${money(item.lineTotal)}</td></tr>`
  }).join('')

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8" /><title>Comprobante ${sale.id}</title><style>
  body{font-family:'Courier New',monospace;background:#fff;color:#111;margin:0;padding:0}
  .ticket{width:320px;margin:0 auto;padding:18px 18px 28px}
  .brand{text-align:center;border-bottom:1px dashed #333;padding-bottom:12px;margin-bottom:12px}
  .brand h1{font-size:24px;margin:0}
  .brand p,.meta,.footer{font-size:12px;line-height:1.45}
  table{width:100%;border-collapse:collapse;margin-top:10px}
  th,td{font-size:12px;padding:6px 0;text-align:left;border-bottom:1px dashed #bbb}
  .total{font-size:18px;font-weight:700;text-align:right;margin-top:14px}
  .meta strong{display:inline-block;width:72px}
  @media print { body{margin:0} .ticket{width:auto} }
  </style></head><body><div class="ticket"><div class="brand"><h1>Operando</h1><p>${branch?.name || 'Sucursal'}<br />${branch?.address || ''}</p></div><div class="meta"><div><strong>Cliente:</strong> ${customer?.fullName || 'Mostrador'}</div><div><strong>Fecha:</strong> ${sale.soldAt.slice(0, 16).replace('T', ' ')}</div><div><strong>Canal:</strong> ${sale.channel}</div><div><strong>Pago:</strong> ${sale.paymentMethod}</div><div><strong>Caja:</strong> ${register?.name || 'Sin caja'}</div><div><strong>Venta:</strong> ${sale.id.slice(0, 8)}</div></div><table><thead><tr><th>Item</th><th>Cant.</th><th>Total</th></tr></thead><tbody>${sale.items.map((item) => { const product = ui.snapshot.products.find((entry) => entry.id === item.productId); return `<tr><td>${product?.name || 'Articulo'}</td><td>${item.quantity}</td><td>${money(item.lineTotal)}</td></tr>` }).join('')}</tbody></table><p class="total">TOTAL ${money(sale.totalAmount)}</p><p class="footer">Comprobante interno generado por operando.app.</p></div></body></html>`
  return { html, filename: `comprobante-${sale.id}.pdf`, fallbackFilename: `comprobante-${sale.id}.html` }
}

const movementDirectionClass = (value) => Number(value || 0) >= 0 ? 'is-positive' : 'is-negative'

const getInvoiceDocument = (invoiceId) => {
  const ui = getUiState()
  const invoice = ui.snapshot.invoices.find((entry) => entry.id === invoiceId)
  if (!invoice) return null
  const customer = ui.snapshot.customers.find((entry) => entry.id === invoice.customerId)
  const branch = ui.snapshot.branches.find((entry) => entry.id === invoice.branchId) || ui.currentBranch
  const sale = ui.snapshot.sales.find((entry) => entry.id === invoice.saleId)
  const issuedAt = String(invoice.issuedAt || invoice.dueDate || '').slice(0, 10) || today
  const amountPaid = Number(invoice.amountPaid || 0)
  const balanceDue = Math.max(0, Number(invoice.totalAmount || 0) - amountPaid)
  const businessName = ui.commerceContext?.commerce_name || ui.snapshot.business.name || 'operando.app'
  const businessDetails = [ui.snapshot.business.organization, branch?.name, branch?.address].filter(Boolean).join(' · ')
  const items = sale?.items?.length
    ? sale.items.map((item) => {
      const product = ui.snapshot.products.find((entry) => entry.id === item.productId)
      return `<tr><td>${escapeHtml(product?.name || 'Articulo')}</td><td>${escapeHtml(item.quantity)}</td><td>${money(item.unitPrice)}</td><td>${money(item.lineTotal)}</td></tr>`
    }).join('')
    : `<tr><td>${escapeHtml(invoice.kind || 'Factura')} ${escapeHtml(invoice.number)}</td><td>1</td><td>${money(invoice.totalAmount)}</td><td>${money(invoice.totalAmount)}</td></tr>`
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8" /><title>Factura ${escapeHtml(invoice.number)}</title><style>
    /* La jerarquía de cobro prioriza el total; el saldo queda como dato de seguimiento. */
    .invoice{position:relative;overflow:hidden;border:0!important;border-radius:16px!important;box-shadow:0 22px 60px rgba(17,42,67,.16)!important;background:#fff!important}.invoice:before{content:'';position:absolute;top:0;left:0;right:0;height:7px;background:linear-gradient(90deg,#00a896,#49c6b5)}.header{margin:0 -52px!important;padding:25px 52px 22px!important;background:#102a43!important;border:0!important;color:#fff}.brand h1{font-size:24px!important;letter-spacing:-.04em}.brand p,.header .meta{color:#b8c8d8!important;font-size:12px!important}.doc-type{padding:5px 0 5px 24px!important;border-left:1px solid rgba(255,255,255,.25)}.doc-type strong{font-size:21px!important;letter-spacing:.04em}.doc-type span{color:#8fe3d8;font-weight:700}.parties{gap:16px!important;margin:28px 0!important}.party{position:relative;border:1px solid #dce5ee!important;border-radius:10px!important;padding:19px 20px!important;background:#f8fafc!important}.party:first-child{border-top:3px solid #00a896!important}.party:last-child{border-top:3px solid #7c8da1!important}.party h2{font-size:10px!important;letter-spacing:.13em!important;color:#6c7d90!important}.party strong{font-size:17px!important}.muted{color:#6c7d90!important}table{margin-top:30px!important;border:1px solid #e0e7ef;border-radius:10px;overflow:hidden}th{background:#eaf2f5!important;color:#35526b!important;padding:14px 12px!important;font-size:10px!important;letter-spacing:.11em!important}td{padding:15px 12px!important;border-bottom-color:#e8edf3!important}.totals{display:flex!important;flex-direction:column!important;width:350px!important;margin-top:32px!important;border-top:0!important;padding-top:0!important}.totals div{width:100%;align-items:baseline;padding:9px 17px}.totals div:nth-child(1){order:0;background:linear-gradient(135deg,#102a43,#1c4864)!important;color:#fff;border-radius:11px!important;margin:0 0 10px!important;padding:19px 20px!important;font-size:15px!important;box-shadow:0 10px 22px rgba(16,42,67,.16)}.totals div:nth-child(1) strong{font-size:29px!important;letter-spacing:-.04em}.totals div:nth-child(2){order:1;border-bottom:1px solid #dfe7ee!important;color:#597084!important}.totals .grand{order:2;border-top:0!important;margin:0!important;padding:11px 17px!important;color:#7d8b99!important;font-size:13px!important;font-weight:400!important}.totals .grand span:last-child{font-size:15px!important;font-weight:600!important;color:#536b7e!important}.totals .due{color:#7d8b99!important;font-weight:400!important}.footer{margin-top:64px!important;padding-top:20px!important;color:#7d8b99!important}@media print{body{background:#fff!important}.invoice{border-radius:0!important;box-shadow:none!important}.header{margin:0 -16mm!important;padding:15mm 16mm 12mm!important}}
    /* Versión monocromática: nítida, económica y segura para cualquier impresora. */
    body,.invoice,.header,.party,th,.totals div,.totals div:nth-child(1){background:#fff!important;color:#111!important;box-shadow:none!important}.invoice{border:1px solid #111!important;border-radius:0!important}.invoice:before{display:none}.header{border-bottom:2px solid #111!important}.brand p,.header .meta,.muted,.party h2,.totals .grand,.totals .grand span:last-child,.totals div:nth-child(2),.totals .due,.footer{color:#333!important}.doc-type{border-left:1px solid #111!important}.doc-type span{color:#111!important}.party{border:1px solid #111!important}.party:first-child,.party:last-child{border-top:1px solid #111!important}table{border:1px solid #111!important}th{border-bottom:1px solid #111!important}td,.totals div:nth-child(2){border-bottom:1px solid #111!important}.totals div:nth-child(1){border:2px solid #111!important;border-radius:0!important}.footer{font-size:12px!important;line-height:1.7!important;text-align:center!important}.footer strong{display:block;font-size:14px;letter-spacing:.02em;color:#111}@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{background:#fff!important}.header{margin:0 -16mm!important;padding:10mm 16mm 8mm!important}}
    *{box-sizing:border-box} body{font-family:Arial,sans-serif;background:#f5f5f5;color:#172033;margin:0;padding:32px}
    .invoice{max-width:800px;margin:0 auto;background:#fff;border:1px solid #d7dce5;padding:46px 52px;min-height:1000px}
    .header{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #172033;padding-bottom:24px}.brand h1{margin:0;font-size:28px}.brand p,.meta,.muted{color:#536071;font-size:13px;line-height:1.5}.doc-type{text-align:right}.doc-type strong{display:block;font-size:24px}.doc-type span{font-size:14px}
    .parties{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin:30px 0}.party{border:1px solid #d7dce5;padding:16px}.party h2{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#536071;margin:0 0 10px}.party strong{display:block;font-size:16px;margin-bottom:5px}
    table{width:100%;border-collapse:collapse;margin-top:24px}th{background:#172033;color:#fff;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.05em;padding:11px}td{border-bottom:1px solid #d7dce5;padding:12px 11px;font-size:14px}th:nth-child(n+2),td:nth-child(n+2){text-align:right}.totals{margin-left:auto;width:310px;margin-top:26px;border-top:2px solid #172033;padding-top:10px}.totals div{display:flex;justify-content:space-between;padding:5px 0;font-size:15px}.totals .grand{font-size:22px;font-weight:800;border-top:1px solid #d7dce5;margin-top:5px;padding-top:10px}.totals .due{color:#9b2c2c;font-weight:700}.footer{border-top:1px solid #d7dce5;margin-top:48px;padding-top:16px;font-size:12px;color:#536071}@media print{body{background:#fff;padding:0}.invoice{border:0;max-width:none;min-height:0;padding:18mm 16mm}}
  </style></head><body><main class="invoice"><header class="header"><div class="brand"><h1>operando.app</h1><p>${escapeHtml(branch?.name || 'Sucursal')}<br />${escapeHtml(branch?.address || '')}</p></div><div class="doc-type"><strong>${escapeHtml(invoice.kind || 'Factura')}</strong><span>${escapeHtml(invoice.type || 'B')} · N° ${escapeHtml(invoice.number)}</span><div class="meta">Emision: ${escapeHtml(issuedAt)}</div></div></header><section class="parties"><div class="party"><h2>Cliente</h2><strong>${escapeHtml(customer?.fullName || 'Consumidor final')}</strong><span class="muted">Comprobante ${escapeHtml(invoice.status || 'Emitida')}</span></div><div class="party"><h2>Datos fiscales</h2><strong>${escapeHtml(invoice.fiscalStatus || 'Pendiente')}</strong><span class="muted">Vencimiento: ${escapeHtml(String(invoice.dueDate || issuedAt).slice(0, 10))}</span></div></section><table><thead><tr><th>Descripcion</th><th>Cant.</th><th>Precio unit.</th><th>Importe</th></tr></thead><tbody>${items}</tbody></table><div class="totals"><div><span>Total factura</span><strong>${money(invoice.totalAmount)}</strong></div><div><span>Cobrado</span><strong>${money(amountPaid)}</strong></div><div class="grand ${balanceDue ? 'due' : ''}"><span>${balanceDue ? 'Saldo pendiente' : 'Saldo'}</span><span>${money(balanceDue)}</span></div></div><footer class="footer">Comprobante generado por operando.app · ${escapeHtml(invoice.number)}</footer></main></body></html>`
  const brandedHtml = html
    .replace('<h1>operando.app</h1>', `<h1>${escapeHtml(businessName)}</h1>`)
    .replace(`<p>${escapeHtml(branch?.name || 'Sucursal')}<br />${escapeHtml(branch?.address || '')}</p>`, `<p>${escapeHtml(businessDetails || 'Datos del comercio')}</p>`)
  const printableHtml = brandedHtml.replace(/<footer class="footer">[\s\S]*?<\/footer>/, '<footer class="footer"><strong>Hecho con operando.app</strong>Gestioná ventas, cobros y stock en un solo lugar · www.operando.app</footer>')
  return { html: printableHtml, title: `${invoice.kind || 'Factura'} ${invoice.number}` }
}

const openInvoiceDocument = (invoiceId, shouldPrint = false) => {
  const doc = getInvoiceDocument(invoiceId)
  if (!doc) return false
  const win = window.open('', '_blank', 'width=960,height=800')
  if (!win) return false
  win.document.write(doc.html)
  win.document.close()
  win.focus()
  if (shouldPrint) window.setTimeout(() => win.print(), 250)
  return true
}

const printReceipt = (saleId) => {
  const doc = getReceiptDocument(saleId)
  if (!doc) return
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return
  win.document.write(doc.html)
  win.document.close()
  win.focus()
  win.print()
}

const exportReceipt = async (saleId) => {
  const doc = getReceiptDocument(saleId)
  if (!doc) return
  if (window.operandoDesktop?.exportPdf) {
    const result = await window.operandoDesktop.exportPdf({ html: doc.html, filename: doc.filename, pageSize: 'A4' })
    feedbackMessage = result.ok ? `PDF exportado en ${result.path}` : (result.message || 'No se pudo exportar el PDF.')
    render()
    return
  }
  const blob = new Blob([doc.html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = doc.fallbackFilename
  link.click()
  URL.revokeObjectURL(url)
}

const buildThermalReceiptDocument = (saleId, paperWidth = '80') => {
  const ui = getUiState()
  const sale = ui.snapshot.sales.find((entry) => entry.id === saleId)
  if (!sale) return null
  const customer = ui.snapshot.customers.find((entry) => entry.id === sale.customerId)
  const branch = ui.snapshot.branches.find((entry) => entry.id === sale.branchId) || ui.currentBranch
  const register = ui.snapshot.registers.find((entry) => entry.id === sale.registerId)
  const ticketWidth = paperWidth === '58' ? 220 : 300
  const pageSize = paperWidth === '58' ? '58mm' : '80mm'
  const lines = sale.items.map((item) => {
    const product = ui.snapshot.products.find((entry) => entry.id === item.productId)
    return `
      <tr>
        <td class="item-name">${escapeHtml(product?.name || 'Articulo')}</td>
        <td class="item-qty">${item.quantity}</td>
        <td class="item-unit">${money(item.unitPrice)}</td>
        <td class="item-total">${money(item.lineTotal)}</td>
      </tr>
    `
  }).join('')
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8" /><title>Ticket ${sale.id}</title><style>
    *{box-sizing:border-box}
    body{font-family:'Courier New',monospace;background:#fff;color:#111;margin:0;padding:0}
    .ticket{width:${ticketWidth}px;margin:0 auto;padding:10px 12px 16px}
    .brand,.footer{text-align:center}
    .brand{border-bottom:1px dashed #222;padding-bottom:10px;margin-bottom:10px}
    .brand h1{font-size:20px;margin:0 0 4px}
    .brand p,.meta,.footer,.totals,.items th,.items td{font-size:11px;line-height:1.4}
    .meta-row{display:flex;justify-content:space-between;gap:12px;padding:2px 0}
    .items{width:100%;border-collapse:collapse;margin-top:10px}
    .items thead th{border-top:1px dashed #222;border-bottom:1px dashed #222;padding:5px 0;text-align:left}
    .items tbody td{padding:6px 0;border-bottom:1px dashed #d1d5db;vertical-align:top}
    .item-name{width:44%}
    .item-qty,.item-unit,.item-total{text-align:right;white-space:nowrap}
    .totals{margin-top:10px;border-top:1px dashed #222;padding-top:8px}
    .totals-row{display:flex;justify-content:space-between;gap:12px;padding:2px 0}
    .totals-row.grand{font-size:16px;font-weight:700;padding-top:6px}
    .footer{margin-top:10px;border-top:1px dashed #222;padding-top:8px}
    @page{size:${pageSize} auto;margin:4mm}
    @media print{body{margin:0}.ticket{width:auto;padding:0 0 8px}}
  </style></head><body><div class="ticket"><div class="brand"><h1>operando.app</h1><p>${escapeHtml(branch?.name || 'Sucursal')}<br />${escapeHtml(branch?.address || '')}</p></div><div class="meta"><div class="meta-row"><span>Cliente</span><span>${escapeHtml(customer?.fullName || 'Mostrador')}</span></div><div class="meta-row"><span>Fecha</span><span>${escapeHtml(sale.soldAt.slice(0, 16).replace('T', ' '))}</span></div><div class="meta-row"><span>Canal</span><span>${escapeHtml(sale.channel)}</span></div><div class="meta-row"><span>Pago</span><span>${escapeHtml(sale.paymentMethod)}</span></div><div class="meta-row"><span>Caja</span><span>${escapeHtml(register?.name || 'Sin caja')}</span></div><div class="meta-row"><span>Operacion</span><span>${escapeHtml(sale.id.slice(0, 8).toUpperCase())}</span></div></div><table class="items"><thead><tr><th>Item</th><th>Cant</th><th>Unit</th><th>Total</th></tr></thead><tbody>${lines}</tbody></table><div class="totals"><div class="totals-row"><span>Subtotal</span><span>${money(sale.subtotalAmount || sale.totalAmount)}</span></div>${sale.discountAmount ? `<div class="totals-row"><span>Descuento</span><span>- ${money(sale.discountAmount)}</span></div>` : ''}<div class="totals-row"><span>Cobrado</span><span>${money(sale.amountPaid || 0)}</span></div><div class="totals-row grand"><span>TOTAL</span><span>${money(sale.totalAmount)}</span></div></div><div class="footer"><p>Comprobante interno ${pageSize}<br />Generado por operando.app</p></div></div></body></html>`
  return {
    html,
    filename: `ticket-${pageSize}-${sale.id}.pdf`,
    fallbackFilename: `ticket-${pageSize}-${sale.id}.html`,
    pageSize,
  }
}

const printThermalReceipt = (saleId, paperWidth = '80') => {
  const doc = buildThermalReceiptDocument(saleId, paperWidth)
  if (!doc) return
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return
  win.document.write(doc.html)
  win.document.close()
  win.focus()
  window.setTimeout(() => {
    win.print()
  }, 250)
}

const exportThermalReceipt = async (saleId, paperWidth = '80') => {
  const doc = buildThermalReceiptDocument(saleId, paperWidth)
  if (!doc) return
  if (window.operandoDesktop?.exportPdf) {
    const result = await window.operandoDesktop.exportPdf({ html: doc.html, filename: doc.filename, pageSize: 'A4' })
    feedbackMessage = result.ok ? `PDF exportado en ${result.path}` : (result.message || 'No se pudo exportar el PDF.')
    render()
    return
  }
  const blob = new Blob([doc.html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = doc.fallbackFilename
  link.click()
  URL.revokeObjectURL(url)
}

const exportData = () => {
  if (!window.operandoDesktop) {
    feedbackMessage = 'La web publica ya no exporta ni restaura snapshots locales.'
    render()
    return
  }
  const blob = new Blob([JSON.stringify(store.exportData(), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `operando-backup-${today}.json`
  link.click()
  URL.revokeObjectURL(url)
}

const exportReport = () => {
  const ui = getUiState()
  const rows = [
    ['Tipo', 'Fecha', 'Sucursal', 'Caja', 'Detalle', 'Importe'],
    ...ui.reportScopedSales.map((sale) => ['Venta', sale.soldAt.slice(0, 16).replace('T', ' '), sale.branchName, sale.registerName, sale.itemSummary, sale.totalAmount]),
    ...ui.reportScopedInvoices.map((invoice) => ['Factura', invoice.dueDate, invoice.branchName, '-', invoice.number, invoice.totalAmount]),
    ...ui.reportScopedCashMovements.map((movement) => ['Caja', String(movement.createdAt).slice(0, 16).replace('T', ' '), ui.currentBranch?.name || 'Sucursal', ui.enrichedRegisters.find((register) => register.id === movement.registerId)?.name || 'Caja', `${cashMovementKindLabel(movement.kind)}: ${movement.note}`, movement.signedAmount]),
  ]
  const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `reporte-${(ui.currentBranch?.code || 'GEN').toLowerCase()}-${today}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

const importData = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    const result = store.importData(JSON.parse(await file.text()))
    feedbackMessage = result?.message || ''
    render()
  } catch {
    alert('No se pudo importar el archivo.')
  } finally {
    event.target.value = ''
  }
}

const handleSubmit = async (event) => {
  event.preventDefault()
  const form = event.currentTarget
  if (form.dataset.submitting === 'true') return
  form.dataset.submitting = 'true'
  for (const button of form.querySelectorAll('button[type="submit"]')) button.disabled = true
  const formData = new FormData(form, event.submitter)
  const kind = form.dataset.form

  if (kind === 'login') {
    loginMessage = ''
    signupMessage = ''
    feedbackMessage = ''
    try {
      // El ingreso normal no reutiliza nunca una sesión de recuperación, aun si
      // el navegador conserva un fragmento o una URL antigua.
      recoveryState = null
      authViewMode = 'login'
      const requestedInstanceKey = String(formData.get('instanceKey') || '').trim()
      const identifier = String(formData.get('identifier') || '').trim()
      const pin = String(formData.get('pin') || '')
      if (!authManager) throw new Error('La conexion cloud no esta lista.')
      const sessionPayload = await authManager.signIn({ instanceKey: requestedInstanceKey || null, identifier, pin })
      persistInstanceKey(sessionPayload?.commerceContext?.instance_key || requestedInstanceKey || authInstanceKey)
      setupStatus = await authManager.getSetupStatus({ instanceKey: authInstanceKey })
      await loadCloudAccess(sessionPayload)
      activeSection = 'dashboard'
      saveSection()
      window.history.replaceState({ section: activeSection }, '', '/panel/')
      feedbackMessage = 'Sesion iniciada correctamente.'
      requestScrollTop()
    } catch (error) {
      loginMessage = mapPublicAuthError(error.message, 'login')
    }
    render()
    return
  }
  if (kind === 'password-recovery') {
    loginMessage = ''
    feedbackMessage = ''
    try {
      const password = String(formData.get('password') || '')
      const passwordConfirm = String(formData.get('passwordConfirm') || '')
      if (password !== passwordConfirm) throw new Error('password_confirmation_mismatch')
      if (!authManager) throw new Error('La conexion cloud no esta lista.')
      const result = await authManager.completeRecovery({ password })
      await authManager.clearRecoveryState()
      recoveryState = null
      authViewMode = 'login'
      window.history.replaceState({}, '', '/ingresar/')
      feedbackMessage = result.message || 'Clave actualizada correctamente.'
      loginMessage = ''
      requestScrollTop()
    } catch (error) {
      loginMessage = mapPublicAuthError(error.message, 'login')
    }
    render()
    return
  }
  if (kind === 'access-recovery') {
    loginMessage = ''
    feedbackMessage = ''
    try {
      const email = String(formData.get('email') || '').trim().toLowerCase()
      if (!authManager) throw new Error('La conexión cloud no está lista.')
      const result = await authManager.sendRecoveryMagicLink({
        email,
        redirectTo: `${publicSiteUrl}/restablecer-clave/?auth_action=recover`,
      })
      loginMessage = result?.message || 'Te enviamos un enlace para recuperar el acceso.'
    } catch (error) {
      loginMessage = mapPublicAuthError(error.message, 'login')
    }
    render()
    return
  }
  if (kind === 'instance-setup') {
    loginMessage = ''
    signupMessage = ''
    feedbackMessage = ''
    try {
      const commerceName = String(formData.get('commerceName') || '').trim()
      const ownerEmail = String(formData.get('ownerEmail') || '').trim()
      const instanceKey = persistInstanceKey(formData.get('instanceKey') || createCommerceKey(commerceName))
      const ownerLogin = String(formData.get('ownerLogin') || '').trim() || ownerEmail.split('@')[0] || 'admin'
      if (!authManager) throw new Error('La conexion cloud no esta lista.')
      const sessionPayload = await authManager.setupInstance({
        instanceKey,
        commerceName,
        ownerName: String(formData.get('ownerName') || '').trim(),
        ownerLogin,
        ownerEmail,
        ownerPin: String(formData.get('ownerPin') || ''),
        branchName: String(formData.get('branchName') || '').trim(),
        branchCode: String(formData.get('branchCode') || '').trim(),
        registerName: String(formData.get('registerName') || '').trim(),
        registerCode: String(formData.get('registerCode') || '').trim(),
      })
      setupStatus = await authManager.getSetupStatus({ instanceKey })
      await loadCloudAccess(sessionPayload)
      activeSection = sectionFromPath()
      saveSection()
      syncSectionPath()
      feedbackMessage = 'Cuenta creada y lista para operar.'
      requestScrollTop()
    } catch (error) {
      signupMessage = mapPublicAuthError(error.message, 'signup')
    }
    render()
    return
  }

  try {
  if (kind === 'customer') {
    const payload = { fullName: formData.get('fullName'), phone: formData.get('phone'), email: formData.get('email'), cuit: formData.get('cuit'), address: formData.get('address'), balance: formData.get('balance'), tag: formData.get('tag') }
    const result = formData.get('customerId') ? await store.updateCustomer(formData.get('customerId'), payload) : await store.createCustomer(payload)
    feedbackMessage = result.message || ''
    customerFormOpen = false
    customerEditingId = ''
  }
  if (kind === 'branch') {
    const result = formData.get('branchId')
      ? await store.updateBranch(formData.get('branchId'), { name: formData.get('name'), code: formData.get('code'), address: formData.get('address') })
      : await store.createBranch({ name: formData.get('name'), code: formData.get('code'), address: formData.get('address') })
    feedbackMessage = result.message || ''
    branchEditingId = ''
    branchFormOpen = false
  }
  if (kind === 'register') {
    const result = formData.get('registerId')
      ? await store.updateRegister(formData.get('registerId'), { branchId: formData.get('branchId'), name: formData.get('name'), code: formData.get('code'), cashierUserId: formData.get('cashierUserId') })
      : await store.createRegister({ branchId: formData.get('branchId'), name: formData.get('name'), code: formData.get('code'), cashierUserId: formData.get('cashierUserId') })
    feedbackMessage = result.message || ''
    registerEditingId = ''
    registerFormOpen = false
  }
  if (kind === 'user') {
    const result = formData.get('userId')
      ? await store.updateUser(formData.get('userId'), {
        fullName: String(formData.get('fullName') || '').trim(),
        roleId: formData.get('roleId'),
        loginName: String(formData.get('loginName') || '').trim(),
        pin: String(formData.get('pin') || ''),
        isActive: formData.get('isActive') === 'on',
        allowedModules: formData.getAll('allowedModules'),
        blockedPermissions: formData.getAll('blockedPermissions'),
      })
      : await store.createUser({
        fullName: String(formData.get('fullName') || '').trim(),
        roleId: formData.get('roleId'),
        loginName: String(formData.get('loginName') || '').trim(),
        pin: String(formData.get('pin') || ''),
        isActive: formData.get('isActive') === 'on',
        allowedModules: formData.getAll('allowedModules'),
        blockedPermissions: formData.getAll('blockedPermissions'),
      })
    feedbackMessage = result.message || ''
    userEditingId = ''
    userDraftRoleId = 'role-cashier'
  }
  if (kind === 'report-filter') {
    reportRegisterFilter = formData.get('registerFilter') || 'all'
    reportDateFrom = formData.get('dateFrom') || ''
    reportDateTo = formData.get('dateTo') || ''
    feedbackMessage = 'Filtro de reportes actualizado.'
  }
  if (kind === 'topbar-jump') {
    topbarSearch = String(formData.get('query') || '').trim()
    if (!topbarSearch) return
    const normalized = topbarSearch.toLowerCase()
    const ui = getUiState()
    const match = buildQuickSearchTargets(ui).find((item) => item.search.includes(normalized))
    if (match) {
      activeSection = match.section
      topbarSearch = ''
      saveSection()
      feedbackMessage = `Mostrando ${match.label}.`
      requestScrollTop()
      render()
      return
    }
    feedbackMessage = 'No encontre nada con ese termino en esta sesion.'
  }
  if (kind === 'module-preset') {
    const result = await store.applyModulePreset(formData.get('presetKey'))
    commerceContext = {
      ...(commerceContext || {}),
      active_plan: String(formData.get('presetKey') || '').trim() || commerceContext?.active_plan || 'custom',
    }
    feedbackMessage = result.message || ''
  }
  if (kind === 'commerce-profile') {
    const result = await store.updateBusinessProfile({
      name: String(formData.get('name') || '').trim(),
      ownerEmail: String(formData.get('ownerEmail') || '').trim().toLowerCase(),
      legalName: String(formData.get('legalName') || '').trim(),
    })
    commerceContext = {
      ...(commerceContext || {}),
      commerce_name: String(formData.get('name') || commerceContext?.commerce_name || '').trim(),
      owner_email: String(formData.get('ownerEmail') || commerceContext?.owner_email || '').trim().toLowerCase(),
    }
    feedbackMessage = result.message || ''
  }
  if (kind === 'progressive-profile') {
    progressiveProfileError = ''
    const result = await store.updateProgressiveProfile({ country: String(formData.get('country') || '').trim(), industry: String(formData.get('industry') || '').trim(), phone: String(formData.get('phone') || '').trim(), email: String(formData.get('email') || '').trim(), needsArca: formData.get('needsArca') === 'yes' ? true : formData.get('needsArca') === 'no' ? false : null, operationalGoals: formData.getAll('operationalGoals'), status: 'complete' })
    feedbackMessage = result.message || ''
    if (result.ok) progressiveProfileStep = 3
    else progressiveProfileError = result.message || 'No se pudieron guardar los datos. Intentá nuevamente.'
  }
  if (kind === 'cloud-connection') {
    cloudSyncBusy = true
    try {
      const result = await store.setCloudConnection({ url: formData.get('url'), anonKey: formData.get('anonKey'), instanceKey: formData.get('instanceKey') })
      authManager = createCloudAuthManager({ url: formData.get('url'), anonKey: formData.get('anonKey') })
      feedbackMessage = result.message || (result.ok ? 'Conexion cloud actualizada.' : '')
    } catch (error) {
      feedbackMessage = `No se pudo conectar con Supabase. ${error.message || ''}`.trim()
    } finally {
      cloudSyncBusy = false
    }
  }
  if (kind === 'product') {
    const result = await store.createProduct({ name: formData.get('name'), sku: formData.get('sku'), barcode: formData.get('barcode'), stock: formData.get('stock'), salePrice: formData.get('salePrice'), costPrice: formData.get('costPrice'), minStock: formData.get('minStock'), category: formData.get('category'), trackStock: formData.get('trackStock') === 'on' })
    feedbackMessage = result.message || ''
    if (result.ok) { completeOnboardingStep('product'); resumeOnboardingAfterStep('product') }
    productFormOpen = false
  }
  if (kind === 'product-inline') {
    const result = await store.updateProduct(formData.get('productId'), {
      name: formData.get('name'),
      sku: formData.get('sku'),
      barcode: formData.get('barcode'),
      salePrice: formData.get('salePrice'),
      costPrice: formData.get('costPrice'),
      minStock: formData.get('minStock'),
      category: formData.get('category'),
      trackStock: formData.get('trackStock') === 'on',
    })
    feedbackMessage = result.message || ''
    if (result.ok) productEditingId = ''
  }
  if (kind === 'stock-adjustment') {
    const search = String(formData.get('productSearch') || '').trim()
    const normalizedSearch = search.toLowerCase()
    const scopedProducts = getUiState().scopedProducts
    const exactProduct = scopedProducts.find((item) => [item.name, item.sku, item.barcode]
      .some((value) => String(value || '').toLowerCase() === normalizedSearch))
    const matches = scopedProducts.filter((item) => [item.name, item.sku, item.barcode]
      .some((value) => String(value || '').toLowerCase().includes(normalizedSearch)))
    const product = exactProduct || (matches.length === 1 ? matches[0] : null)
    if (!product) {
      feedbackMessage = search ? 'Selecciona un producto de la lista o revisa la busqueda.' : 'Busca el producto que queres ajustar.'
      render()
      return
    }
    const result = store.createStockAdjustment({ productId: product.id, quantity: formData.get('quantity'), note: formData.get('note') })
    feedbackMessage = result.message || ''
  }
  if (kind === 'stock-transfer') {
    const search = String(formData.get('productSearch') || '').trim()
    const normalizedSearch = search.toLowerCase()
    const scopedProducts = getUiState().scopedProducts
    const exactProduct = scopedProducts.find((item) => [item.name, item.sku, item.barcode]
      .some((value) => String(value || '').toLowerCase() === normalizedSearch))
    const matches = scopedProducts.filter((item) => [item.name, item.sku, item.barcode]
      .some((value) => String(value || '').toLowerCase().includes(normalizedSearch)))
    const product = exactProduct || (matches.length === 1 ? matches[0] : null)
    if (!product) {
      feedbackMessage = search ? 'Selecciona un producto de la lista o revisa la busqueda.' : 'Busca el producto que queres transferir.'
      render()
      return
    }
    const result = store.transferStock({ productId: product.id, quantity: formData.get('quantity'), fromBranchId: formData.get('fromBranchId'), toBranchId: formData.get('toBranchId'), note: formData.get('note') })
    feedbackMessage = result.message || ''
  }
  if (kind === 'supplier') {
    const payload = { name: formData.get('name'), contact: formData.get('contact'), phone: formData.get('phone'), email: formData.get('email'), cuit: formData.get('cuit'), address: formData.get('address'), balance: formData.get('balance'), lastDelivery: formData.get('lastDelivery'), category: formData.get('category') }
    const result = formData.get('supplierId') ? await store.updateSupplier(formData.get('supplierId'), payload) : await store.createSupplier(payload)
    feedbackMessage = result.message || ''
    supplierFormOpen = false
    supplierEditingId = ''
  }
  if (kind === 'invoice') {
    const currentBranchId = getUiState().currentBranch?.id
    const fiscalStatus = String(formData.get('fiscalStatus') || 'Interno')
    const number = String(formData.get('number') || '').trim()
    if (fiscalStatus !== 'Interno' && !number) {
      feedbackMessage = 'Para un comprobante ARCA carga el numero informado por ARCA antes de guardarlo.'
      render()
      return
    }
    const result = formData.get('invoiceId')
      ? await store.updateInvoice(formData.get('invoiceId'), { number, customerId: formData.get('customerId'), totalAmount: formData.get('totalAmount'), kind: formData.get('kind'), type: formData.get('type'), dueDate: formData.get('dueDate'), status: formData.get('status'), fiscalStatus, branchId: currentBranchId })
      : await store.createInvoice({ number, customerId: formData.get('customerId'), totalAmount: formData.get('totalAmount'), kind: formData.get('kind'), type: formData.get('type'), dueDate: formData.get('dueDate'), status: formData.get('status'), fiscalStatus, branchId: currentBranchId })
    feedbackMessage = result.message || ''
    invoiceEditingId = ''
    invoiceFormOpen = false
  }
  if (kind === 'invoice-payment') {
    const invoice = store.getSnapshot().invoices.find((entry) => entry.id === formData.get('invoiceId'))
    if (!invoice) {
      feedbackMessage = 'No se encontró la factura a cobrar. Actualizá la pantalla e intentá otra vez.'
      render()
      return
    }
    const amount = formData.get('paymentMode') === 'full' ? invoiceBalance(invoice) : formData.get('amount')
    const method = String(formData.get('method') || 'transfer')
    const reference = String(formData.get('reference') || '').trim()
    try {
      const result = await store.registerInvoicePayment({ invoiceId: formData.get('invoiceId'), amount, method, reference, echeqDetails: method === 'echeq' ? { number: reference } : {} })
      feedbackMessage = result.message || ''
      invoicePaymentId = result.ok ? '' : invoicePaymentId
    } catch (error) {
      feedbackMessage = mapInvoicePaymentError(error?.message)
    }
  }
  if (kind === 'ticket') {
    const currentBranchId = getUiState().currentBranch?.id
    const customerId = String(formData.get('customerId') || '').trim()
    const device = String(formData.get('device') || '').trim()
    const issue = String(formData.get('issue') || '').trim()
    if (!customerId || !device || !issue) {
      feedbackMessage = 'Completá los campos obligatorios: cliente, equipo y detalle.'
      ticketFormOpen = true
      render()
      return
    }
    if (!currentBranchId) {
      feedbackMessage = 'Seleccioná una sucursal antes de guardar el ticket.'
      ticketFormOpen = true
      render()
      return
    }
    const result = formData.get('ticketId')
      ? await store.updateTicket(formData.get('ticketId'), { number: String(formData.get('number') || '').trim(), customerId, device, issue, status: formData.get('status'), branchId: currentBranchId })
      : await store.createTicket({ number: String(formData.get('number') || '').trim(), customerId, device, issue, status: formData.get('status'), branchId: currentBranchId })
    feedbackMessage = result.message || ''
    if (result.ok) {
      ticketEditingId = ''
      ticketFormOpen = false
    } else {
      ticketFormOpen = true
    }
  }
  if (kind === 'platform-commerce') {
    const result = await store.updatePlatformCommerce({
      commerceId: formData.get('commerceId'),
      activePlan: formData.get('activePlan'),
      status: formData.get('status'),
      billingStatus: formData.get('billingStatus'),
      allowPublicSignup: String(formData.get('allowPublicSignup')) === 'true',
      supportOwner: formData.get('supportOwner'),
      supportStatus: formData.get('supportStatus'),
      internalTag: formData.get('internalTag'),
      commercialNote: formData.get('commercialNote'),
      billingNote: formData.get('billingNote'),
    })
    feedbackMessage = result.message || ''
  }
  if (kind === 'open-cash') {
    const result = await store.openCashSession({ registerId: formData.get('registerId'), openingAmount: formData.get('openingAmount') })
    feedbackMessage = result.message || ''
    if (result.ok) { completeOnboardingStep('cash'); resumeOnboardingAfterStep('cash') }
    cashFormOpen = false
  }
  if (kind === 'close-cash') {
    const result = await store.closeCashSession({ cashSessionId: getUiState().openCashSession?.id || null, countedAmount: formData.get('countedAmount') })
    feedbackMessage = result.message || ''
    cashFormOpen = false
  }
  if (kind === 'cash-movement') {
    const result = await store.createCashMovement({ cashSessionId: getUiState().openCashSession?.id || null, kind: formData.get('kind'), amount: formData.get('amount'), note: formData.get('note') })
    feedbackMessage = result.message || ''
  }
  if (kind === 'purchase-receipt') {
    const search = String(formData.get('productSearch') || '').trim()
    const normalizedSearch = search.toLowerCase()
    const products = getUiState().snapshot.products
    const supplierSearch = String(formData.get('supplierSearch') || '').trim()
    const suppliers = getUiState().snapshot.suppliers
    const normalizedSupplierSearch = supplierSearch.toLowerCase()
    const matchedSupplier = supplierSearch
      ? (suppliers.find((supplier) => String(supplier.name || '').toLowerCase() === normalizedSupplierSearch) ||
        (() => { const matches = suppliers.filter((supplier) => [supplier.name, supplier.contact, supplier.phone, supplier.email, supplier.cuit].some((value) => String(value || '').toLowerCase().includes(normalizedSupplierSearch))); return matches.length === 1 ? matches[0] : null })())
      : null
    const supplierId = formData.get('supplierId') || matchedSupplier?.id
    if (!supplierId) {
      feedbackMessage = supplierSearch ? 'Seleccioná un proveedor de las sugerencias o escribí el nombre completo.' : 'Buscá y seleccioná el proveedor de esta compra.'
      render()
      return
    }
    const purchaseItems = (() => { try { return JSON.parse(String(formData.get('purchaseItems') || '[]')) } catch { return [] } })()
    if (purchaseItems.length) {
      const invalidItem = purchaseItems.find((item) => !String(item.name || '').trim() || (!item.isNew && !products.some((product) => product.id === item.productId)) || Number(item.quantity) <= 0 || Number(item.unitCost) < 0 || Number(item.salePrice) < 0 || Number(item.minStock) < 0)
      if (invalidItem) { feedbackMessage = 'Revisá cantidad y costo de cada producto antes de registrar la compra.'; render(); return }
      const common = { supplierId, documentNumber: formData.get('documentNumber'), note: formData.get('note') }
      for (const item of purchaseItems) {
        let productId = item.productId
        if (item.isNew) {
          const created = await store.createProduct({ name: item.name, sku: item.sku, barcode: item.barcode, stock: 0, minStock: item.minStock, category: item.category, costPrice: item.unitCost, salePrice: item.salePrice, trackStock: item.trackStock !== false })
          if (!created.ok) { feedbackMessage = created.message || 'No se pudo crear el producto.'; render(); return }
          const product = store.getSnapshot().products.find((entry) => String(entry.name || '').trim().toLowerCase() === String(item.name || '').trim().toLowerCase() && String(entry.sku || '').trim().toLowerCase() === String(item.sku || '').trim().toLowerCase())
          if (!product) { feedbackMessage = 'El producto se creó, pero no se pudo asociar a la compra.'; render(); return }
          productId = product.id
        } else {
          const updated = await store.updateProductFromPurchase(productId, { name: item.name, sku: item.sku, barcode: item.barcode, minStock: item.minStock, category: item.category, costPrice: item.unitCost, salePrice: item.salePrice, trackStock: item.trackStock !== false })
          if (!updated.ok) { feedbackMessage = updated.message || 'No se pudo actualizar el producto.'; render(); return }
        }
        if (formData.get('receiptId') && purchaseItems.length === 1) await store.updatePurchaseReceipt(formData.get('receiptId'), { ...common, productId, quantity: item.quantity, unitCost: item.unitCost })
        else await store.createPurchaseReceipt({ ...common, productId, quantity: item.quantity, unitCost: item.unitCost })
      }
      const purchaseTotal = purchaseItems.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unitCost || 0)), 0)
      feedbackMessage = `${purchaseItems.length} producto${purchaseItems.length === 1 ? '' : 's'} registrado${purchaseItems.length === 1 ? '' : 's'} en la compra.`
      closePurchaseUtilityForms()
      if (!formData.get('receiptId')) supplierPaymentDraft = { supplierId, amount: purchaseTotal }
      render()
      return
    }
    const exactProduct = products.find((item) => [item.name, item.sku, item.barcode]
      .some((value) => String(value || '').toLowerCase() === normalizedSearch))
    const matches = products.filter((item) => [item.name, item.sku, item.barcode]
      .some((value) => String(value || '').toLowerCase().includes(normalizedSearch)))
    const product = exactProduct || (matches.length === 1 ? matches[0] : null)
    if (!product) {
      feedbackMessage = search ? 'Selecciona un producto de la lista o revisa la busqueda.' : 'Busca el producto que queres ingresar.'
      render()
      return
    }
    const result = formData.get('receiptId')
      ? await store.updatePurchaseReceipt(formData.get('receiptId'), { supplierId, productId: product.id, documentNumber: formData.get('documentNumber'), quantity: formData.get('quantity'), unitCost: formData.get('unitCost'), note: formData.get('note') })
      : await store.createPurchaseReceipt({ supplierId, productId: product.id, documentNumber: formData.get('documentNumber'), quantity: formData.get('quantity'), unitCost: formData.get('unitCost'), note: formData.get('note') })
    feedbackMessage = result.message || (result.ok ? 'Recepcion registrada y stock actualizado.' : '')
    purchaseEditingId = ''
    purchaseFormOpen = false
  }
  if (kind === 'supplier-payment') {
    const supplierSearch = String(formData.get('supplierSearch') || '').trim().toLowerCase()
    const supplierId = formData.get('supplierId') || getUiState().snapshot.suppliers.find((supplier) => String(supplier.name || '').trim().toLowerCase() === supplierSearch && Number(supplier.balance || 0) > 0)?.id
    if (!supplierId) { feedbackMessage = 'Elegí un proveedor con saldo pendiente de las sugerencias.'; render(); return }
    const result = await store.registerSupplierPayment({ supplierId, amount: formData.get('amount'), method: formData.get('method'), reference: formData.get('reference') })
    feedbackMessage = result.message || ''
    if (result.ok) supplierPaymentDraft = null
  }
  if (kind === 'sale') {
    if (!formData.get('saleId') && saleSubmissionInFlight) return
    const items = []
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('qty_') && Number(value) > 0) items.push({ productId: key.replace('qty_', ''), quantity: Number(value) })
    }
    const paymentMethod = formData.get('paymentMethod')
    const selectedProducts = getUiState().scopedProducts
    const saleTotal = Math.max(0, items.reduce((sum, item) => sum + (Number(selectedProducts.find((product) => product.id === item.productId)?.salePrice || 0) * item.quantity), 0) - Number(formData.get('discountAmount') || 0))
    const paymentAmounts = ['amountPaid', 'cashAmount', 'transferAmount', 'mercadoPagoAmount', 'echeqAmount', 'accountAmount'].map((key) => Number(formData.get(key) || 0)).filter((amount) => amount > 0)
    const declaredPayment = Math.max(0, ...paymentAmounts, paymentAmounts.reduce((sum, amount) => sum + amount, 0))
    const paidControl = form.elements.namedItem('isPaid')
    const isPaid = paidControl
      ? paidControl.checked
      : paymentMethod !== 'account' && (!declaredPayment || declaredPayment >= saleTotal)
    if (!formData.get('saleId')) {
      saleOperationId ||= makeSaleOperationId()
      saleSubmissionInFlight = true
      const submitButton = form.querySelector('button[type="submit"]')
      if (submitButton) {
        submitButton.disabled = true
        submitButton.textContent = 'Registrando venta…'
      }
    }
    const payload = { customerId: formData.get('customerId'), channel: formData.get('channel'), paymentMethod, isPaid, autoInvoice: formData.get('autoInvoice') === 'on', discountAmount: formData.get('discountAmount'), amountPaid: formData.get('amountPaid'), cashAmount: formData.get('cashAmount'), transferAmount: formData.get('transferAmount'), mercadoPagoAmount: formData.get('mercadoPagoAmount'), echeqAmount: formData.get('echeqAmount'), echeqDetails: { number: formData.get('echeqNumber') }, accountAmount: formData.get('accountAmount'), note: formData.get('note'), items, operationId: formData.get('saleId') ? null : saleOperationId }
    const result = formData.get('saleId')
      ? await store.updateSale(formData.get('saleId'), payload)
      : await store.createSale(payload)
    feedbackMessage = result.message || ''
    if (result.ok && !formData.get('saleId')) { completeOnboardingStep('cart'); completeOnboardingStep('charge'); resumeOnboardingAfterStep('charge') }
    saleEditingId = ''
    saleDraftQuantities = {}
    saleQuickAddCode = ''
    saleCustomerSearchQuery = ''
    saleOperationId = ''
    saleSubmissionInFlight = false
    saleFormOpen = false
  }

  form.reset()
  } catch (error) {
    if (kind === 'sale') saleSubmissionInFlight = false
    if (kind === 'progressive-profile') progressiveProfileError = 'No se pudieron guardar los datos. Revisá la conexión e intentá nuevamente.'
    feedbackMessage = mapPublicAuthError(error?.message || 'No se pudo completar la accion.', kind === 'instance-setup' ? 'signup' : 'login')
  }
  render()
}

const bindEvents = () => {
  const rerenderSearchKeepingFocus = (input, selector) => {
    const caret = input.selectionStart ?? input.value.length
    render()
    window.requestAnimationFrame(() => {
      const nextInput = document.querySelector(selector)
      if (!nextInput) return
      nextInput.focus({ preventScroll: true })
      nextInput.setSelectionRange(caret, caret)
    })
  }
  const scrollToAuthBlock = (selector) => {
    const element = document.querySelector(selector)
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  bindHardwareScanner()
  for (const menu of document.querySelectorAll('.row-more-menu')) {
    menu.addEventListener('toggle', () => {
      if (!menu.open) return
      for (const otherMenu of document.querySelectorAll('.row-more-menu[open]')) {
        if (otherMenu !== menu) otherMenu.open = false
      }
    })
  }
  for (const form of document.querySelectorAll('form[data-form]')) form.addEventListener('submit', handleSubmit)
  const focusOnboardingControl = () => {
    const step = currentOnboardingStep()
    if (!step) return
    activeSection = step.section
    onboarding.visible = true
    requestScrollTop()
    render()
    window.requestAnimationFrame(() => {
      document.querySelectorAll('.is-onboarding-target').forEach((element) => element.classList.remove('is-onboarding-target'))
      const target = document.querySelector(step.selector)
      const layer = document.querySelector('.onboarding-layer')
      target?.classList.add('is-onboarding-target')
      target?.scrollIntoView?.({ block: 'center' })
      target?.focus?.({ preventScroll: true })
      window.requestAnimationFrame(() => {
        if (!target || !layer) return
        const rect = target.getBoundingClientRect()
        const padding = 14
        const left = Math.max(0, rect.left - padding)
        const top = Math.max(0, rect.top - padding)
        const right = Math.max(0, window.innerWidth - rect.right - padding)
        const bottom = Math.max(0, window.innerHeight - rect.bottom - padding)
        layer.classList.add('has-onboarding-target')
        layer.style.setProperty('--onboarding-target-left', `${left}px`)
        layer.style.setProperty('--onboarding-target-top', `${top}px`)
        layer.style.setProperty('--onboarding-target-right', `${right}px`)
        layer.style.setProperty('--onboarding-target-bottom', `${bottom}px`)
        layer.style.setProperty('--onboarding-target-width', `${Math.max(0, rect.width + padding * 2)}px`)
        layer.style.setProperty('--onboarding-target-height', `${Math.max(0, rect.height + padding * 2)}px`)
      })
    })
  }
  const pauseOnboardingFor = (stepId, removeLayer = false) => {
    if (!onboarding.visible || currentOnboardingStep()?.id !== stepId) return false
    onboarding.visible = false
    onboardingPausedFor = stepId
    saveOnboarding()
    if (removeLayer) document.querySelector('.onboarding-layer')?.remove()
    return true
  }
  for (const form of document.querySelectorAll('form[data-form="sale"]')) {
    form.addEventListener('submit', () => pauseOnboardingFor('charge'))
  }
  for (const summary of document.querySelectorAll('details.row-more-menu--sales > summary')) {
    summary.addEventListener('click', () => pauseOnboardingFor('receipt', true))
  }
  for (const button of document.querySelectorAll('[data-action="resume-onboarding"]')) button.addEventListener('click', () => {
    onboarding.step = onboardingSteps.findIndex((step) => !onboarding.completed.includes(step.id))
    if (onboarding.step < 0) {
      feedbackMessage = 'Ya completaste la guía inicial. Podés seguir operando normalmente.'
      render()
      return
    }
    onboarding.visible = true
    saveOnboarding()
    render()
  })
  for (const button of document.querySelectorAll('[data-action="dismiss-onboarding"]')) button.addEventListener('click', () => {
    onboarding.visible = false
    saveOnboarding()
    render()
  })
  for (const button of document.querySelectorAll('[data-action="next-onboarding-step"]')) button.addEventListener('click', () => {
    onboarding.step = Math.min(onboarding.step + 1, onboardingSteps.length - 1)
    saveOnboarding()
    focusOnboardingControl()
  })
  for (const button of document.querySelectorAll('[data-action="focus-onboarding-control"]')) button.addEventListener('click', focusOnboardingControl)
  if (!onboardingKeyListenerBound) {
    onboardingKeyListenerBound = true
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !onboarding.visible) return
      onboarding.visible = false
      saveOnboarding()
      render()
    })
  }
  const updateSaleTotals = () => {
    let subtotal = 0
    for (const input of document.querySelectorAll('input[name^="qty_"]')) {
      const quantity = Math.max(0, Number(input.value || 0))
      const price = Math.max(0, Number(input.dataset.salePrice || 0))
      subtotal += quantity * price
      const lineTotal = input.closest('.cart-line')?.querySelector('.cart-line-total')
      if (lineTotal) lineTotal.textContent = money(quantity * price)
    }
    const discountValue = Math.max(0, Number(document.querySelector('input[name="discountValue"]')?.value || 0))
    const discountMode = document.querySelector('select[name="discountMode"]')?.value || 'amount'
    const discount = discountMode === 'percent' ? Math.min(subtotal, subtotal * Math.min(100, discountValue) / 100) : Math.min(subtotal, discountValue)
    const discountAmountInput = document.querySelector('input[name="discountAmount"]')
    if (discountAmountInput) discountAmountInput.value = String(discount)
    const discountHelp = document.querySelector('[data-discount-help]')
    if (discountHelp) discountHelp.textContent = discountMode === 'percent' ? `${discountValue}% = ${money(discount)}` : 'Importe en pesos'
    const total = Math.max(0, subtotal - discount)
    const totalOutput = document.querySelector('[data-sale-total]')
    if (totalOutput) totalOutput.textContent = money(total)
    const chargeButton = document.querySelector('.pos-charge-button')
    if (chargeButton) {
      chargeButton.disabled = subtotal <= 0
      if (!saleEditingId) chargeButton.textContent = `Cobrar ${money(total)}`
    }
  }
  for (const input of document.querySelectorAll('input[name^="qty_"]')) {
    input.addEventListener('input', () => {
      const productId = input.name.replace('qty_', '')
      const quantity = Number(input.value || 0)
      if (quantity > 0) saleDraftQuantities[productId] = quantity
      else delete saleDraftQuantities[productId]
      updateSaleTotals()
    })
  }
  const saleDiscountInput = document.querySelector('input[name="discountValue"]')
  if (saleDiscountInput) saleDiscountInput.addEventListener('input', updateSaleTotals)
  const saleDiscountMode = document.querySelector('select[name="discountMode"]')
  if (saleDiscountMode) saleDiscountMode.addEventListener('change', updateSaleTotals)
  const quickAddInput = document.querySelector('input[name="quickAddCode"]')
  const runQuickAdd = () => {
    pauseOnboardingFor('cart')
    const currentCode = String(quickAddInput?.value || '').trim()
    const normalizedCode = currentCode.toLowerCase()
    const scopedMatches = getUiState().scopedProducts.filter((item) => [item.name, item.sku, item.barcode]
      .some((value) => String(value || '').toLowerCase().includes(normalizedCode)))
    const product = store.findProductByCode(currentCode) || (scopedMatches.length === 1 ? scopedMatches[0] : null)
    if (!product) {
      feedbackMessage = currentCode ? 'Selecciona un articulo de la lista o revisa el codigo.' : 'Escribe o escanea un articulo.'
      render()
      return
    }
    saleDraftQuantities = { ...readCurrentSaleQuantities(), [product.id]: Number(readCurrentSaleQuantities()[product.id] || 0) + 1 }
    saleQuickAddCode = ''
    completeOnboardingStep('cart')
    resumeOnboardingAfterStep('cart')
    feedbackMessage = ''
    render()
  }
  if (quickAddInput) {
    quickAddInput.addEventListener('input', () => { saleQuickAddCode = quickAddInput.value })
    quickAddInput.addEventListener('change', () => {
      if (String(quickAddInput.value || '').trim()) runQuickAdd()
    })
    quickAddInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        runQuickAdd()
      }
    })
    if (activeSection === 'ventas') window.requestAnimationFrame(() => quickAddInput.focus({ preventScroll: true }))
  }
  for (const input of document.querySelectorAll('[data-sale-customer-search]')) {
    const form = input.closest('form')
    const hiddenCustomer = form?.querySelector('input[name="customerId"]')
    const findCustomer = () => getUiState().snapshot.customers.find((customer) => customer.fullName.trim().toLowerCase() === input.value.trim().toLowerCase())
    input.addEventListener('input', () => {
      saleCustomerSearchQuery = input.value
      const customer = findCustomer()
      if (hiddenCustomer) hiddenCustomer.value = customer?.id || ''
    })
    input.addEventListener('change', () => {
      const customer = findCustomer()
      if (hiddenCustomer) hiddenCustomer.value = customer?.id || ''
      if (!customer && input.value.trim()) feedbackMessage = 'Selecciona un cliente de la lista o deja Mostrador.'
    })
  }
  for (const button of document.querySelectorAll('[data-action="set-counter-customer"]')) button.addEventListener('click', () => {
    const form = button.closest('form')
    const input = form?.querySelector('[data-sale-customer-search]')
    const hiddenCustomer = form?.querySelector('input[name="customerId"]')
    if (input) input.value = ''
    if (hiddenCustomer) hiddenCustomer.value = ''
    saleCustomerSearchQuery = ''
  })
  for (const select of document.querySelectorAll('select[name="paymentMethod"]')) {
    const form = select.closest('form')
    const echeqField = form?.querySelector('[data-echeq-field]')
    const syncEcheqField = () => {
      const isEcheq = select.value === 'echeq'
      if (!echeqField) return
      echeqField.hidden = !isEcheq
      const input = echeqField.querySelector('input')
      if (input) input.required = isEcheq
    }
    select.addEventListener('change', syncEcheqField)
    syncEcheqField()
  }
  const quickSearchInput = document.querySelector('.quick-search input[name="query"]')
  const jumpToSearchMatch = (value) => {
    const normalized = String(value || '').trim().toLowerCase()
    if (!normalized) return
    const ui = getUiState()
    const match = buildQuickSearchTargets(ui).find((item) => item.label.toLowerCase() === normalized)
      || buildQuickSearchTargets(ui).find((item) => item.search.includes(normalized))
    if (!match) return
    activeSection = match.section
    topbarSearch = ''
    saveSection()
    syncSectionPath()
    requestScrollTop()
    render()
  }
  if (quickSearchInput) {
    quickSearchInput.addEventListener('input', () => {
      topbarSearch = quickSearchInput.value
      const ui = getUiState()
      const normalized = String(quickSearchInput.value || '').trim().toLowerCase()
      if (!normalized) return
      const targets = buildQuickSearchTargets(ui)
      const exactMatch = targets.find((item) => item.label.toLowerCase() === normalized)
      if (exactMatch) {
        jumpToSearchMatch(quickSearchInput.value)
        return
      }
      const partialMatches = targets.filter((item) => item.search.includes(normalized))
      if (partialMatches.length === 1) jumpToSearchMatch(partialMatches[0].label)
    })
    quickSearchInput.addEventListener('change', () => jumpToSearchMatch(quickSearchInput.value))
  }
  for (const button of document.querySelectorAll('[data-section]')) button.addEventListener('click', () => {
    const nextSection = button.dataset.section
    if (nextSection === 'ajustes' && activeSection !== 'ajustes') settingsPanelOpen = ''
    activeSection = nextSection
    saveSection()
    syncSectionPath()
    // En PC conservamos la posicion para que cambiar de modulo no obligue
    // a volver a recorrer toda la pantalla. En mobile mantenemos el salto
    // arriba, que facilita empezar cada vista desde su encabezado.
    if (nextSection === 'auditoria' || window.matchMedia('(max-width: 880px)').matches) requestScrollTop()
    render()
    void syncLiveData()
  })
  for (const button of document.querySelectorAll('[data-dashboard-section]')) button.addEventListener('click', () => {
    const nextSection = button.dataset.dashboardSection
    if (!nextSection || !getAllowedNav(getUiState()).some((item) => item.id === nextSection)) return
    activeSection = nextSection
    saveSection()
    syncSectionPath()
    requestScrollTop()
    render()
    void syncLiveData()
  })
  for (const button of document.querySelectorAll('[data-settings-panel]')) {
    button.addEventListener('click', () => {
      const nextPanel = button.dataset.settingsPanel
      settingsPanelOpen = settingsPanelOpen === nextPanel ? '' : nextPanel
      render()
      if (!settingsPanelOpen) return
      requestAnimationFrame(() => document.querySelector(`[data-settings-content="${settingsPanelOpen}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    })
  }
  for (const select of document.querySelectorAll('[data-page-size]')) select.addEventListener('change', () => {
    const pagination = listPagination[select.dataset.pageSize]
    const pageSize = Number(select.value)
    if (!pagination || !pageSizeOptions.includes(pageSize)) return
    pagination.pageSize = pageSize
    pagination.page = 1
    render()
  })
  for (const button of document.querySelectorAll('[data-page-action]')) button.addEventListener('click', () => {
    const pagination = listPagination[button.dataset.pageList]
    if (!pagination || button.disabled) return
    pagination.page += button.dataset.pageAction === 'next' ? 1 : -1
    render()
  })
  for (const button of document.querySelectorAll('[data-action="toggle-dashboard-stock"]')) button.addEventListener('click', () => {
    dashboardStockExpanded = !dashboardStockExpanded
    render()
  })
  for (const button of document.querySelectorAll('[data-action="toggle-dashboard-audit"]')) button.addEventListener('click', () => {
    dashboardAuditExpanded = !dashboardAuditExpanded
    render()
  })
  const firstAuditPeriod = document.querySelector('[data-audit-period]')
  if (firstAuditPeriod && !document.querySelector('[data-audit-period="all"]')) {
    const allPeriodsButton = document.createElement('button')
    allPeriodsButton.type = 'button'
    allPeriodsButton.className = `audit-filter-button ${auditPeriodFilter === 'all' ? 'is-active' : ''}`
    allPeriodsButton.dataset.auditPeriod = 'all'
    allPeriodsButton.textContent = 'Todo'
    firstAuditPeriod.before(allPeriodsButton)
  }
  for (const button of document.querySelectorAll('[data-audit-period]')) button.addEventListener('click', () => { auditPeriodFilter = button.dataset.auditPeriod || 'all'; render() })
  for (const button of document.querySelectorAll('[data-audit-module]')) button.addEventListener('click', () => { auditModuleFilter = button.dataset.auditModule || 'all'; render() })
  for (const input of document.querySelectorAll('[data-audit-search]')) {
    input.placeholder = 'Buscar venta, factura, cliente, producto o usuario'
    input.addEventListener('input', () => { auditSearchQuery = input.value; rerenderSearchKeepingFocus(input, '[data-audit-search]') })
    input.addEventListener('change', () => { auditSearchQuery = input.value; render() })
    input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); auditSearchQuery = input.value; render() } })
  }
  for (const input of document.querySelectorAll('[data-audit-date]')) input.addEventListener('change', () => { if (input.dataset.auditDate === 'from') auditDateFrom = input.value; if (input.dataset.auditDate === 'to') auditDateTo = input.value; render() })
  const auditTracePanel = document.querySelector('.audit-trace-panel')
  const auditTraceElement = auditTracePanel?.querySelector('.audit-trace')
  const auditTrace = auditTraceElement
  if (auditTrace) {
    auditTrace.classList.add('audit-timeline-drawer')
    const auditUi = getUiState()
    const auditNow = new Date()
    const auditStart = auditPeriodFilter === 'today' ? new Date(auditNow.getFullYear(), auditNow.getMonth(), auditNow.getDate()) : auditPeriodFilter === 'week' ? new Date(auditNow.getFullYear(), auditNow.getMonth(), auditNow.getDate() - 6) : auditPeriodFilter === 'month' ? new Date(auditNow.getFullYear(), auditNow.getMonth(), 1) : null
    const auditTerm = auditSearchQuery.trim().toLocaleLowerCase()
    const visibleEntries = auditUi.enrichedAudit.filter((entry) => {
      if (auditStart && new Date(entry.createdAt) < auditStart) return false
      if (auditPeriodFilter === 'custom' && auditDateFrom && String(entry.createdAt).slice(0, 10) < auditDateFrom) return false
      if (auditPeriodFilter === 'custom' && auditDateTo && String(entry.createdAt).slice(0, 10) > auditDateTo) return false
      if (auditModuleFilter !== 'all' && !entry.modules.includes(auditModuleFilter)) return false
      return !auditTerm || auditSearchText(auditUi, entry).includes(auditTerm)
    })
    for (const [index, event] of [...auditTrace.querySelectorAll('.audit-trace-event')].entries()) {
      const entry = visibleEntries[index]
      if (!entry) continue
      const context = getAuditLinkedContext(auditUi, entry)
      const content = event.querySelector('.audit-trace-content')
      const actorLine = content?.querySelector(':scope > p')
      if (actorLine) actorLine.textContent = `Por ${entry.actorName || 'Sistema'}`
      const detail = document.createElement('div')
      detail.className = 'audit-event-detail'
      const before = entry.beforeData || {}
      const after = entry.afterData || {}
      const labels = { name: 'Nombre', full_name: 'Cliente', fullName: 'Cliente', phone: 'Telefono', email: 'Email', address: 'Direccion', sale_price: 'Precio venta', salePrice: 'Precio venta', cost_price: 'Costo', costPrice: 'Costo', quantity: 'Cantidad', signed_amount: 'Importe', signedAmount: 'Importe', note: 'Detalle', status: 'Estado', opening_amount: 'Apertura', openingAmount: 'Apertura', counted_amount: 'Contado', countedAmount: 'Contado', difference_amount: 'Diferencia', differenceAmount: 'Diferencia' }
      const valueText = (value) => value === null || value === undefined || value === '' ? '-' : (typeof value === 'boolean' ? (value ? 'Si' : 'No') : String(value))
      const changedValues = Object.keys(labels).filter((key) => after[key] !== undefined || before[key] !== undefined).filter((key) => after[key] !== before[key]).slice(0, 4).map((key) => `<span><b>${labels[key]}</b> ${escapeHtml(valueText(before[key]))} -> ${escapeHtml(valueText(after[key]))}</span>`).join('')
      const cashSummary = ['cash_movement', 'cash_session'].includes(entry.entityType) ? `<span><b>Caja</b> ${escapeHtml(String(after.note || after.description || 'Movimiento registrado'))}${after.signedAmount != null || after.signed_amount != null ? ` · ${money(Number(after.signedAmount ?? after.signed_amount))}` : ''}${after.countedAmount != null || after.counted_amount != null ? ` · Contado ${money(Number(after.countedAmount ?? after.counted_amount))}` : ''}${after.differenceAmount != null || after.difference_amount != null ? ` · Diferencia ${money(Number(after.differenceAmount ?? after.difference_amount))}` : ''}</span>` : ''
      const stockProduct = auditUi.snapshot.products.find((product) => product.id === (after.productId || after.product_id || before.productId || before.product_id))
      const stockSummary = entry.entityType.includes('stock') ? `<span><b>Stock</b> ${escapeHtml(stockProduct?.name || after.productName || 'Producto')} · ${Number(after.quantity || 0) > 0 ? '+' : ''}${escapeHtml(String(after.quantity ?? '-'))} unidades</span>` : ''
      const saleDetail = context.sale ? `<span><b>Venta</b> ${escapeHtml(context.itemNames.slice(0, 3).join(', ') || context.sale.itemSummary || 'Sin detalle')} · ${money(context.sale.totalAmount)}</span>` : ''
      const invoiceDetail = context.invoice ? `<span><b>Factura</b> ${escapeHtml(context.invoice.number || 'sin número')} · ${money(context.invoice.totalAmount)}</span>` : ''
      const productDetail = !context.sale && !context.invoice && entry.entityType !== 'product' && context.data?.name ? `<span><b>Detalle</b> ${escapeHtml(String(context.data.name))}</span>` : ''
      const operationSummary = auditOperationSummary(auditUi, entry)
      detail.innerHTML = `${saleDetail}${invoiceDetail}${productDetail}${operationSummary}${changedValues}`
      if (detail.textContent?.trim()) content?.append(detail)
      event.tabIndex = 0
      event.setAttribute('role', 'button')
      event.setAttribute('aria-label', `Abrir ${entry.entityLabel} relacionado`)
      const openEvent = () => openAuditEvent(auditUi, entry)
      event.addEventListener('click', openEvent)
      event.addEventListener('keydown', (keyboardEvent) => {
        if (keyboardEvent.key !== 'Enter' && keyboardEvent.key !== ' ') return
        keyboardEvent.preventDefault()
        openEvent()
      })
      if (false) {
      const actions = document.createElement('div')
      actions.className = 'audit-event-actions'
      if (context.sale) {
        const button = document.createElement('button')
        button.type = 'button'; button.className = 'inline-action'; button.textContent = 'Abrir venta'
        button.addEventListener('click', () => { activeSection = 'ventas'; saleEditingId = context.sale.id; saleFormOpen = true; saleDraftQuantities = Object.fromEntries((context.sale.items || []).map((item) => [item.productId, item.quantity])); queueScrollToSelector('form[data-form="sale"]'); saveSection(); render() })
        actions.append(button)
      }
      if (context.invoice) {
        const button = document.createElement('button')
        button.type = 'button'; button.className = 'inline-action'; button.textContent = 'Abrir factura'
        button.addEventListener('click', () => { const opened = openInvoiceDocument(context.invoice.id); feedbackMessage = opened ? 'Factura abierta en una nueva pestaña.' : 'No se pudo abrir la factura.'; if (!opened) render() })
        actions.append(button)
      }
      if (actions.childElementCount) content?.append(actions)
      }
    }
    let previousDate = ''
    for (const event of auditTrace.querySelectorAll('.audit-trace-event')) {
      const date = String(event.querySelector('time')?.textContent || '').slice(0, 10)
      if (!date || date === previousDate) continue
      previousDate = date
      const [year, month, day] = date.split('-').map(Number)
      const label = new Date(year, month - 1, day, 12).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
      const heading = document.createElement('h4')
      heading.className = 'audit-trace-date'
      heading.textContent = date === new Date().toISOString().slice(0, 10) ? `Hoy · ${label}` : label
      event.before(heading)
    }
    let dragStartY = 0; let dragStartScroll = 0
    auditTrace.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.target.closest('button, input, a')) return
      dragStartY = event.clientY; dragStartScroll = auditTrace.scrollTop
      auditTrace.classList.add('is-dragging'); auditTrace.setPointerCapture(event.pointerId)
    })
    auditTrace.addEventListener('pointermove', (event) => { if (auditTrace.classList.contains('is-dragging')) auditTrace.scrollTop = dragStartScroll - (event.clientY - dragStartY) })
    const stopTraceDrag = () => auditTrace.classList.remove('is-dragging')
    auditTrace.addEventListener('pointerup', stopTraceDrag)
    auditTrace.addEventListener('pointercancel', stopTraceDrag)
    window.requestAnimationFrame(() => { auditTrace.scrollTop = 0 })
  }
  if (false && auditTrace) {
    const ui = getUiState()
    const auditNow = new Date()
    const auditStart = auditPeriodFilter === 'today' ? new Date(auditNow.getFullYear(), auditNow.getMonth(), auditNow.getDate()) : auditPeriodFilter === 'week' ? new Date(auditNow.getFullYear(), auditNow.getMonth(), auditNow.getDate() - 6) : auditPeriodFilter === 'month' ? new Date(auditNow.getFullYear(), auditNow.getMonth(), 1) : null
    const term = auditSearchQuery.trim().toLowerCase()
    const entries = ui.enrichedAudit.filter((entry) => {
      if (auditStart && new Date(entry.createdAt) < auditStart) return false
      if (auditPeriodFilter === 'custom' && auditDateFrom && String(entry.createdAt).slice(0, 10) < auditDateFrom) return false
      if (auditPeriodFilter === 'custom' && auditDateTo && String(entry.createdAt).slice(0, 10) > auditDateTo) return false
      if (auditModuleFilter !== 'all' && !entry.modules.includes(auditModuleFilter)) return false
      return !term || [entry.actorName, entry.entityLabel, entry.action, entry.entityId, entry.moduleLabel].join(' ').toLowerCase().includes(term)
    })
    const traceKey = (entry) => {
      const data = entry.afterData || entry.beforeData || {}
      if (entry.entityType === 'sale') return `sale:${entry.entityId}`
      if (entry.entityType === 'stock_movement' && data.referenceId) return `${data.referenceType || 'stock'}:${data.referenceId}`
      if (entry.entityType === 'document' && data.sale_id) return `sale:${data.sale_id}`
      if (entry.entityType === 'cash_movement' && data.cash_session_id) return `cash:${data.cash_session_id}`
      if (entry.entityType === 'cash_session') return `cash:${entry.entityId}`
      if (entry.entityType === 'purchase_receipt') return `purchase:${entry.entityId}`
      return `${entry.entityType}:${entry.entityId}`
    }
    const groups = new Map()
    for (const entry of entries) { const key = traceKey(entry); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(entry) }
    const actionLabel = (entry) => ({ opened: 'Abrió', closed: 'Cerró', created: 'Creó', updated: 'Actualizó', deleted: 'Eliminó', cancelled: 'Anuló' }[entry.action] || 'Registró')
    auditTrace.classList.add('audit-causal-graph')
    const causalGroups = [...groups.values()]
    const baseGroupWidth = Math.max(76, 148 - causalGroups.length * 7)
    auditTrace.innerHTML = causalGroups.map((group) => {
      const root = group.find((entry) => ['sale', 'purchase_receipt', 'cash_session'].includes(entry.entityType)) || group[0]
      const children = group.filter((entry) => entry !== root)
      const detail = (entry) => encodeURIComponent(JSON.stringify({ title: `${actionLabel(entry)} ${entry.entityLabel}`, actor: entry.actorName, time: String(entry.createdAt).slice(0, 16).replace('T', ' · '), before: entry.beforeData, after: entry.afterData }))
      const groupWidth = Math.max(baseGroupWidth, children.length * 72 + 18)
      const branchNodes = children.map((entry, index) => {
        const left = ((index + 1) / (children.length + 1)) * 100
        const title = `${actionLabel(entry)} ${entry.entityLabel}`
        return `<div class="audit-effect" style="--effect-left:${left}%"><span class="audit-node-label">${escapeHtml(entry.moduleLabel)}</span><button type="button" class="audit-effect-node module-${entry.modules[0]}" data-audit-detail="${detail(entry)}" aria-label="${escapeHtml(title)}" title="${escapeHtml(title)}"></button></div>`
      }).join('')
      const curves = children.map((_, index) => {
        const x = ((index + 1) / (children.length + 1)) * 100
        return `<path class="module-${children[index].modules[0]}" d="M 50 63 C 50 101 ${x} 101 ${x} 133" />`
      }).join('')
      const rootTitle = `${actionLabel(root)} ${root.entityLabel}`
      return `<article class="audit-causal-group module-${root.modules[0]}" style="--group-width:${groupWidth}px"><span class="audit-node-label audit-main-label">${escapeHtml(root.moduleLabel)}</span><button type="button" class="audit-main-node module-${root.modules[0]}" data-audit-detail="${detail(root)}" aria-label="${escapeHtml(rootTitle)}" title="${escapeHtml(rootTitle)}"></button>${children.length ? `<svg class="audit-causal-curves" viewBox="0 0 100 190" preserveAspectRatio="none" aria-hidden="true">${curves}</svg>${branchNodes}` : ''}</article>`
    }).join('') || '<p class="empty-state">No hay eventos que coincidan con estos filtros.</p>'
  }
  if (false && auditTrace?.querySelector('.audit-trace-event') && !auditTrace.querySelector('.audit-branch-label')) {
    const lanes = [
      ['main', 'MAIN'], ['operation', 'OPERACIÓN'], ['inventory', 'INVENTARIO'], ['relation', 'RELACIÓN'],
    ]
    for (const [lane, label] of lanes) {
      const branch = document.createElement('span')
      branch.className = `audit-branch-label audit-branch-${lane}`
      branch.textContent = label
      auditTrace.append(branch)
    }
    for (const event of auditTrace.querySelectorAll('.audit-trace-event')) {
      const classNames = event.classList
      event.dataset.auditLane = classNames.contains('module-settings') ? 'main'
        : (classNames.contains('module-sales') || classNames.contains('module-cash') || classNames.contains('module-invoices')) ? 'operation'
          : (classNames.contains('module-stock') || classNames.contains('module-products') || classNames.contains('module-purchases')) ? 'inventory'
            : 'relation'
    }
  }
  for (const node of document.querySelectorAll('[data-audit-detail]')) node.addEventListener('click', () => {
    const detail = JSON.parse(decodeURIComponent(node.dataset.auditDetail || ''))
    const panel = document.querySelector('.audit-detail-panel') || document.createElement('aside')
    panel.className = 'audit-detail-panel panel'
    const data = detail.after || detail.before || {}
    const labels = { name: 'Producto', full_name: 'Cliente', sku: 'Código', category: 'Categoría', sale_price: 'Precio de venta', cost_price: 'Costo', quantity: 'Cantidad', amount: 'Importe', signed_amount: 'Movimiento de caja', opening_amount: 'Monto inicial', counted_amount: 'Monto contado', difference_amount: 'Diferencia', note: 'Detalle', status: 'Estado' }
    const rows = Object.entries(data).filter(([key, value]) => labels[key] && value !== '' && value != null).map(([key, value]) => `<div><span>${labels[key]}</span><strong>${typeof value === 'boolean' ? (value ? 'Sí' : 'No') : escapeHtml(String(value))}</strong></div>`).join('')
    panel.innerHTML = `<button type="button" aria-label="Cerrar detalle">×</button><p class="audit-detail-kicker">${escapeHtml(detail.actor || 'Sistema')} · ${escapeHtml(detail.time)}</p><strong>${escapeHtml(detail.title)}</strong><div class="audit-detail-fields">${rows || '<span>Acción registrada correctamente.</span>'}</div>`
    auditTrace?.closest('.panel')?.after(panel)
    panel.querySelector('button')?.addEventListener('click', () => panel.remove())
  })
  for (const input of document.querySelectorAll('.permission-option input')) input.addEventListener('change', () => {
    const option = input.closest('.permission-option')
    const status = option?.querySelector('small')
    if (!option || !status) return
    const isBlockedPermission = input.name === 'blockedPermissions'
    const isActive = isBlockedPermission ? !input.checked : input.checked
    option.classList.toggle('is-active', isActive)
    option.classList.toggle('is-blocked', isBlockedPermission && input.checked)
    status.textContent = isBlockedPermission ? (input.checked ? 'Bloqueada' : 'Permitida') : (input.checked ? 'Visible' : 'Oculto')
  })
  for (const toggleAlertsButton of document.querySelectorAll('[data-action="toggle-account-alerts"]')) {
    toggleAlertsButton.addEventListener('click', (event) => {
      event.stopPropagation()
      accountAlertsOpen = !accountAlertsOpen
      render()
    })
  }
  for (const openAccountPanelButton of document.querySelectorAll('[data-action="open-account-panel"]')) {
    openAccountPanelButton.addEventListener('click', (event) => {
      event.stopPropagation()
      accountAlertsOpen = false
      activeSection = getUiState().user?.isPlatformAdmin ? 'mi-admin' : 'ajustes'
      saveSection()
      requestScrollTop()
      render()
    })
  }
  for (const alertSectionButton of document.querySelectorAll('[data-alert-section]')) {
    alertSectionButton.addEventListener('click', (event) => {
      event.stopPropagation()
      accountAlertsOpen = false
      activeSection = alertSectionButton.dataset.alertSection || 'dashboard'
      saveSection()
      requestScrollTop()
      queueScrollToSelector(alertSectionButton.dataset.alertTarget)
      render()
    })
  }
  for (const dismissAlertButton of document.querySelectorAll('[data-dismiss-alert]')) {
    dismissAlertButton.addEventListener('click', (event) => {
      event.stopPropagation()
      dismissedAccountAlertIds.add(dismissAlertButton.dataset.dismissAlert)
      render()
    })
  }
  for (const button of document.querySelectorAll('[data-action="show-login"]')) button.addEventListener('click', () => {
    authViewMode = 'login'
    loginMessage = ''
    signupMessage = ''
    requestScrollTop()
    render()
    scrollToAuthBlock('#acceso-login')
  })
  for (const button of document.querySelectorAll('[data-action="show-signup"]')) button.addEventListener('click', () => {
    authViewMode = 'signup'
    loginMessage = ''
    signupMessage = ''
    requestScrollTop()
    render()
    scrollToAuthBlock('#acceso-signup')
  })
  for (const button of document.querySelectorAll('[data-action="back-landing"]')) button.addEventListener('click', () => {
    if (window.__operandoAppEntry) {
      window.location.href = '/'
      return
    }
    authViewMode = 'landing'
    loginMessage = ''
    signupMessage = ''
    requestScrollTop()
    render()
  })
  for (const button of document.querySelectorAll('[data-platform-user-select]')) button.addEventListener('click', () => {
    platformUserSelectedId = button.dataset.platformUserSelect || ''
    requestScrollTop()
    render()
  })
  for (const button of document.querySelectorAll('[data-action="refresh-platform-admin"]')) button.addEventListener('click', async () => {
    try {
      await store.refreshPlatformAdminData()
      feedbackMessage = 'Panel Operando actualizado.'
    } catch (error) {
      feedbackMessage = humanizeError(error)
    }
    render()
  })
  for (const input of document.querySelectorAll('[data-platform-user-search]')) input.addEventListener('input', () => {
    platformUserSearchQuery = input.value || ''
    rerenderSearchKeepingFocus(input, '[data-platform-user-search]')
  })
  for (const select of document.querySelectorAll('[data-platform-user-filter]')) select.addEventListener('change', () => {
    platformUserFilter = select.value || 'all'
    render()
  })
  for (const button of document.querySelectorAll('[data-action="open-customer-form"]')) button.addEventListener('click', () => {
    customerEditingId = ''
    customerFormOpen = true
    queueScrollToSelector('form[data-form="customer"]')
    render()
  })
  for (const button of document.querySelectorAll('[data-action="close-customer-form"]')) button.addEventListener('click', () => {
    customerFormOpen = false
    customerEditingId = ''
    render()
  })
  for (const input of document.querySelectorAll('[data-customer-search]')) input.addEventListener('input', () => {
    customerSearchQuery = input.value
    rerenderSearchKeepingFocus(input, '[data-customer-search]')
  })
  for (const input of document.querySelectorAll('[data-address-map-input]')) input.addEventListener('input', () => {
    const address = input.value.trim()
    const form = input.closest('form')
    const frame = form?.querySelector('[data-address-map]')
    const link = form?.querySelector('[data-address-map-link]')
    const empty = form?.querySelector('[data-address-map-empty]')
    if (frame) frame.src = address ? `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed` : 'about:blank'
    if (link) link.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    if (empty) empty.hidden = Boolean(address)
  })
  for (const button of document.querySelectorAll('[data-action="edit-customer"]')) button.addEventListener('click', () => { customerEditingId = button.dataset.id || ''; customerFormOpen = true; queueScrollToSelector('form[data-form="customer"]'); render() })
  for (const button of document.querySelectorAll('[data-action="view-customer-map"]')) button.addEventListener('click', () => { customerMapPreviewId = customerMapPreviewId === button.dataset.id ? '' : button.dataset.id; render() })
  for (const button of document.querySelectorAll('[data-action="open-sale-form"]')) button.addEventListener('click', () => {
    saleFormOpen = true
    queueScrollToSelector('form[data-form="sale"]')
    render()
  })
  for (const button of document.querySelectorAll('[data-action="close-sale-form"]')) button.addEventListener('click', () => {
    saleFormOpen = false
    saleEditingId = ''
    saleDraftQuantities = {}
    saleQuickAddCode = ''
    saleCustomerSearchQuery = ''
    render()
  })
  for (const button of document.querySelectorAll('[data-action="open-cash-form"]')) button.addEventListener('click', () => {
    pauseOnboardingFor('cash')
    cashFormOpen = true
    render()
  })
  for (const button of document.querySelectorAll('[data-action="close-cash-form"]')) button.addEventListener('click', () => {
    cashFormOpen = false
    render()
  })
  for (const button of document.querySelectorAll('[data-action="open-product-form"]')) button.addEventListener('click', () => {
    pauseOnboardingFor('product')
    closeProductUtilityForms()
    productFormOpen = true
    queueScrollToSelector('form[data-form="product"]')
    render()
  })
  for (const button of document.querySelectorAll('[data-action="close-product-form"]')) button.addEventListener('click', () => {
    productFormOpen = false
    render()
  })
  for (const input of document.querySelectorAll('[data-product-search]')) input.addEventListener('input', () => { productSearchQuery = input.value || ''; productEditingId = ''; rerenderSearchKeepingFocus(input, '[data-product-search]') })
  for (const button of document.querySelectorAll('[data-action="clear-product-search"]')) button.addEventListener('click', () => { productSearchQuery = ''; productEditingId = ''; render() })
  for (const button of document.querySelectorAll('[data-action="edit-product-inline"]')) button.addEventListener('click', () => { productEditingId = button.dataset.id || ''; render() })
  for (const button of document.querySelectorAll('[data-action="cancel-product-inline-edit"]')) button.addEventListener('click', () => { productEditingId = ''; render() })
  for (const button of document.querySelectorAll('[data-action="open-supplier-form"]')) button.addEventListener('click', () => {
    closePurchaseUtilityForms()
    supplierEditingId = ''
    supplierFormOpen = true
    queueScrollToSelector('form[data-form="supplier"]')
    render()
  })
  for (const button of document.querySelectorAll('[data-action="close-supplier-form"]')) button.addEventListener('click', () => {
    supplierFormOpen = false
    supplierEditingId = ''
    render()
  })
  for (const input of document.querySelectorAll('[data-supplier-search]')) input.addEventListener('input', () => {
    supplierSearchQuery = input.value
    rerenderSearchKeepingFocus(input, '[data-supplier-search]')
  })
  for (const input of document.querySelectorAll('input[name="supplierSearch"]')) input.addEventListener('input', () => { purchaseSupplierSearch = input.value })
  const addPurchaseProduct = () => {
    const input = document.querySelector('[data-purchase-product-search]')
    const search = String(input?.value || purchaseQuickAddCode || '').trim().toLowerCase()
    const product = getUiState().snapshot.products.find((item) => [item.name, item.sku, item.barcode].some((value) => String(value || '').toLowerCase() === search))
    if (!product) { feedbackMessage = search ? 'Elegí un producto de las sugerencias.' : 'Buscá un producto para agregarlo a la compra.'; render(); return }
    purchaseDraftItems = { ...purchaseDraftItems, [product.id]: purchaseDraftItems[product.id] || { productId: product.id, quantity: 1, unitCost: Number(product.costPrice || 0), salePrice: Number(product.salePrice || 0), name: product.name, sku: product.sku || '', barcode: product.barcode || '', category: product.category || 'General', minStock: Number(product.minStock || 0), trackStock: product.trackStock !== false } }
    purchaseQuickAddCode = ''
    render()
  }
  for (const input of document.querySelectorAll('[data-purchase-product-search]')) {
    input.addEventListener('input', () => { purchaseQuickAddCode = input.value })
    input.addEventListener('change', addPurchaseProduct)
  }
  for (const button of document.querySelectorAll('[data-action="add-purchase-product"]')) button.addEventListener('click', addPurchaseProduct)
  for (const button of document.querySelectorAll('[data-action="add-new-purchase-product"]')) button.addEventListener('click', () => {
    const key = `new-${Date.now()}`
    purchaseDraftItems = { ...purchaseDraftItems, [key]: { isNew: true, productId: '', name: '', sku: '', barcode: '', category: 'General', minStock: 0, quantity: 1, unitCost: 0, salePrice: 0, trackStock: true } }
    render()
  })
  for (const button of document.querySelectorAll('[data-action="leave-supplier-payment"]')) button.addEventListener('click', () => { supplierPaymentDraft = null; feedbackMessage = 'Compra registrada a cuenta corriente.'; render() })
  for (const button of document.querySelectorAll('[data-action="open-supplier-payment-panel"]')) button.addEventListener('click', () => { supplierPaymentPanelOpen = !supplierPaymentPanelOpen; render() })
  for (const button of document.querySelectorAll('[data-action="close-supplier-payment-panel"]')) button.addEventListener('click', () => { supplierPaymentPanelOpen = false; render() })
  for (const button of document.querySelectorAll('[data-action="toggle-purchase-receipts"]')) button.addEventListener('click', () => { purchaseReceiptsExpanded = !purchaseReceiptsExpanded; render() })
  for (const button of document.querySelectorAll('[data-action="toggle-purchase-suppliers"]')) button.addEventListener('click', () => { purchaseSuppliersExpanded = !purchaseSuppliersExpanded; render() })
  const syncPurchaseDraftField = (input) => {
    const item = purchaseDraftItems[input.dataset.purchaseField]
    if (!item) return
    const field = input.dataset.field
    const numeric = ['quantity', 'unitCost', 'salePrice', 'minStock', 'margin'].includes(field)
    item[field] = input.type === 'checkbox' ? input.checked : (numeric ? Math.max(field === 'quantity' ? 1 : 0, Number(input.value || 0)) : input.value)
    if (field === 'margin') item.salePrice = Number(item.unitCost || 0) * (1 + (Number(item.margin || 0) / 100))
    const calculatedMargin = Number(item.unitCost) > 0 ? ((Number(item.salePrice) - Number(item.unitCost)) / Number(item.unitCost)) * 100 : 0
    if (field === 'salePrice' || field === 'unitCost') item.margin = calculatedMargin
    const hiddenItems = document.querySelector('input[name="purchaseItems"]')
    if (hiddenItems) hiddenItems.value = JSON.stringify(Object.entries(purchaseDraftItems).map(([key, detail]) => ({ key, productId: detail.productId || '', isNew: Boolean(detail.isNew), name: detail.name || '', sku: detail.sku || '', barcode: detail.barcode || '', category: detail.category || 'General', minStock: Number(detail.minStock || 0), trackStock: detail.trackStock !== false, quantity: Number(detail.quantity || 0), unitCost: Number(detail.unitCost || 0), salePrice: Number(detail.salePrice || 0) })))
    const row = input.closest('.purchase-line')
    if (row) {
      const priceInput = row.querySelector('[data-field="salePrice"]')
      const marginInput = row.querySelector('[data-field="margin"]')
      if (priceInput && field === 'margin') priceInput.value = Number(item.salePrice || 0).toFixed(2)
      if (marginInput && field !== 'margin') marginInput.value = calculatedMargin.toFixed(1)
    }
  }
  for (const input of document.querySelectorAll('[data-purchase-field]')) {
    input.addEventListener('input', () => syncPurchaseDraftField(input))
    input.addEventListener('change', () => syncPurchaseDraftField(input))
  }
  for (const button of document.querySelectorAll('[data-action="remove-purchase-product"]')) button.addEventListener('click', () => { delete purchaseDraftItems[button.dataset.id]; render() })
  for (const button of document.querySelectorAll('[data-action="edit-supplier"]')) button.addEventListener('click', () => { supplierEditingId = button.dataset.id || ''; supplierFormOpen = true; queueScrollToSelector('form[data-form="supplier"]'); render() })
  for (const button of document.querySelectorAll('[data-action="view-supplier-map"]')) button.addEventListener('click', () => { supplierMapPreviewId = supplierMapPreviewId === button.dataset.id ? '' : button.dataset.id; render() })
  for (const button of document.querySelectorAll('[data-action="open-purchase-form"]')) button.addEventListener('click', () => {
    closePurchaseUtilityForms()
    purchaseFormOpen = true
    queueScrollToSelector('form[data-form="purchase-receipt"]')
    render()
  })
  for (const button of document.querySelectorAll('[data-action="close-purchase-form"]')) button.addEventListener('click', () => {
    closePurchaseUtilityForms()
    render()
  })
  for (const button of document.querySelectorAll('[data-action="open-stock-adjustment-form"]')) button.addEventListener('click', () => {
    closeProductUtilityForms()
    stockAdjustmentFormOpen = true
    queueScrollToSelector('form[data-form="stock-adjustment"]')
    render()
  })
  for (const button of document.querySelectorAll('[data-action="close-stock-adjustment-form"]')) button.addEventListener('click', () => {
    stockAdjustmentFormOpen = false
    render()
  })
  for (const button of document.querySelectorAll('[data-action="adjust-product-stock"]')) button.addEventListener('click', () => {
    closeProductUtilityForms()
    stockAdjustmentFormOpen = true
    render()
    const product = getUiState().scopedProducts.find((item) => item.id === button.dataset.id)
    const input = document.querySelector('form[data-form="stock-adjustment"] [name="productSearch"]')
    if (input && product) input.value = product.name
    queueScrollToSelector('form[data-form="stock-adjustment"]')
  })
  for (const button of document.querySelectorAll('[data-action="open-stock-transfer-form"]')) button.addEventListener('click', () => {
    closeProductUtilityForms()
    stockTransferFormOpen = true
    queueScrollToSelector('form[data-form="stock-transfer"]')
    render()
  })
  for (const button of document.querySelectorAll('[data-action="close-stock-transfer-form"]')) button.addEventListener('click', () => {
    stockTransferFormOpen = false
    render()
  })
  for (const button of document.querySelectorAll('[data-action="open-invoice-form"]')) button.addEventListener('click', () => {
    closeDocumentUtilityForms()
    invoiceFormOpen = true
    queueScrollToSelector('form[data-form="invoice"]')
    render()
  })
  for (const button of document.querySelectorAll('[data-action="close-invoice-form"]')) button.addEventListener('click', () => {
    closeDocumentUtilityForms()
    render()
  })
  for (const button of document.querySelectorAll('[data-action="transfer-product-stock"]')) button.addEventListener('click', () => {
    closeProductUtilityForms()
    stockTransferFormOpen = true
    render()
    const product = getUiState().scopedProducts.find((item) => item.id === button.dataset.id)
    const input = document.querySelector('form[data-form="stock-transfer"] [name="productSearch"]')
    if (input && product) input.value = product.name
    queueScrollToSelector('form[data-form="stock-transfer"]')
  })
  for (const button of document.querySelectorAll('[data-action="close-invoice-payment"]')) button.addEventListener('click', () => {
    invoicePaymentId = ''
    render()
  })
  for (const button of document.querySelectorAll('[data-action="open-ticket-form"]')) button.addEventListener('click', () => {
    closeDocumentUtilityForms()
    ticketFormOpen = true
    queueScrollToSelector('form[data-form="ticket"]')
    render()
  })
  for (const button of document.querySelectorAll('[data-action="close-ticket-form"]')) button.addEventListener('click', () => {
    closeDocumentUtilityForms()
    render()
  })
  for (const button of document.querySelectorAll('[data-action="open-branch-form"]')) button.addEventListener('click', () => {
    closeStructureUtilityForms()
    branchFormOpen = true
    queueScrollToSelector('form[data-form="branch"]')
    render()
  })
  for (const button of document.querySelectorAll('[data-action="close-branch-form"]')) button.addEventListener('click', () => {
    closeStructureUtilityForms()
    render()
  })
  for (const button of document.querySelectorAll('[data-action="open-register-form"]')) button.addEventListener('click', () => {
    closeStructureUtilityForms()
    registerFormOpen = true
    queueScrollToSelector('form[data-form="register"]')
    render()
  })
  for (const button of document.querySelectorAll('[data-action="close-register-form"]')) button.addEventListener('click', () => {
    closeStructureUtilityForms()
    render()
  })
  for (const button of document.querySelectorAll('[data-delete]')) button.addEventListener('click', async () => {
    try {
      const result = await store.removeEntity(button.dataset.delete, button.dataset.id)
      feedbackMessage = result?.message || 'Registro eliminado y movimientos revertidos cuando correspondia.'
    } catch (error) {
      feedbackMessage = error?.message || 'No se pudo eliminar el registro.'
    }
    render()
  })
  const quickAddButton = document.querySelector('[data-action="quick-add-sale"]')
  if (quickAddButton) quickAddButton.addEventListener('click', runQuickAdd)
  const focusSaleScannerButton = document.querySelector('[data-action="focus-sale-scanner"]')
  if (focusSaleScannerButton) focusSaleScannerButton.addEventListener('click', () => {
    focusScannerInput('sales')
  })
  const focusProductBarcodeButton = document.querySelector('[data-action="focus-product-barcode"]')
  if (focusProductBarcodeButton) focusProductBarcodeButton.addEventListener('click', () => {
    focusScannerInput('products')
  })
  for (const button of document.querySelectorAll('[data-module-toggle]')) {
    button.addEventListener('click', async () => {
      const result = await store.setModuleEnabled(button.dataset.moduleToggle, button.dataset.enabled !== 'true')
      feedbackMessage = result.message || ''
      render()
    })
  }
  for (const button of document.querySelectorAll('[data-plan-apply]')) {
    button.addEventListener('click', async () => {
      const result = await store.applyModulePreset(button.dataset.planApply)
      commerceContext = {
        ...(commerceContext || {}),
        active_plan: String(button.dataset.planApply || '').trim() || commerceContext?.active_plan || 'custom',
      }
      feedbackMessage = result.message || ''
      render()
    })
  }
  const syncCloudButton = document.querySelector('[data-action="sync-cloud"]')
  if (syncCloudButton) {
    syncCloudButton.addEventListener('click', async () => {
      cloudSyncBusy = true
      render()
      try {
        const result = await store.syncToCloud()
        feedbackMessage = result.message || ''
      } catch (error) {
        feedbackMessage = `No se pudo sincronizar. ${error.message || ''}`.trim()
      } finally {
        cloudSyncBusy = false
        render()
      }
    })
  }
  const importCoreButton = document.querySelector('[data-action="import-core"]')
  if (importCoreButton) {
    importCoreButton.addEventListener('click', () => {
      feedbackMessage = 'La app ya esta operando sobre tablas core de Supabase.'
      render()
    })
  }
  const disconnectCloudButton = document.querySelector('[data-action="disconnect-cloud"]')
  if (disconnectCloudButton) {
    disconnectCloudButton.addEventListener('click', async () => {
      if (authManager) await authManager.signOut()
      stopOperationalRealtime()
      const result = await store.clearCloudConnection()
      feedbackMessage = result.message || ''
      render()
    })
  }
  for (const button of document.querySelectorAll('[data-sale-action]')) {
    button.addEventListener('click', async () => {
      if (button.dataset.saleAction === 'edit') {
        saleEditingId = button.dataset.id
        saleFormOpen = true
        queueScrollToSelector('form[data-form="sale"]')
        const sale = store.getSnapshot().sales.find((entry) => entry.id === button.dataset.id)
        saleDraftQuantities = Object.fromEntries((sale?.items || []).map((item) => [item.productId, item.quantity]))
        saleQuickAddCode = ''
        feedbackMessage = 'Venta cargada para edicion.'
        render()
        return
      }
      if (button.dataset.saleAction === 'receipt') {
        printReceipt(button.dataset.id)
        completeOnboardingStep('receipt')
        resumeOnboardingAfterStep('receipt')
        feedbackMessage = 'Comprobante listo para imprimir.'
        render()
        return
      }
      if (button.dataset.saleAction === 'receipt-80') {
        printThermalReceipt(button.dataset.id, '80')
        completeOnboardingStep('receipt')
        resumeOnboardingAfterStep('receipt')
        feedbackMessage = 'Ticket 80 mm listo para imprimir.'
        render()
        return
      }
      if (button.dataset.saleAction === 'receipt-58') {
        printThermalReceipt(button.dataset.id, '58')
        completeOnboardingStep('receipt')
        resumeOnboardingAfterStep('receipt')
        feedbackMessage = 'Ticket 58 mm listo para imprimir.'
        render()
        return
      }
      if (button.dataset.saleAction === 'export') {
        exportThermalReceipt(button.dataset.id, '80')
        return
      }
      const result = button.dataset.saleAction === 'invoice'
        ? await store.createInvoiceFromSale(button.dataset.id)
        : button.dataset.saleAction === 'ticket'
          ? await store.createTicketFromSale(button.dataset.id)
          : button.dataset.saleAction === 'cancel'
            ? store.cancelSale(button.dataset.id)
            : store.createReturnFromSale(button.dataset.id)
      feedbackMessage = result.message || ''
      if (result.ok && button.dataset.saleAction === 'invoice') { completeOnboardingStep('receipt'); resumeOnboardingAfterStep('receipt') }
      render()
    })
  }
  for (const button of document.querySelectorAll('[data-purchase-action]')) {
    button.addEventListener('click', () => {
      if (button.dataset.purchaseAction === 'edit') {
        purchaseEditingId = button.dataset.id
        supplierFormOpen = false
        purchaseFormOpen = true
        queueScrollToSelector('form[data-form="purchase-receipt"]')
        feedbackMessage = 'Recepcion cargada para edicion.'
        render()
      }
    })
  }
  for (const row of document.querySelectorAll('[data-invoice-open]')) {
    const openInvoice = () => {
      const completed = openInvoiceDocument(row.dataset.invoiceOpen)
      feedbackMessage = completed ? 'Factura abierta en una nueva pestaña.' : 'No se pudo abrir la factura. Revisa que el navegador permita ventanas emergentes.'
      render()
    }
    row.addEventListener('click', (event) => {
      if (!event.target.closest('button, a, input, select, textarea, label, summary, details')) openInvoice()
    })
    row.addEventListener('keydown', (event) => {
      if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('button, a, input, select, textarea, label, summary, details')) { event.preventDefault(); openInvoice() }
    })
  }
  for (const button of document.querySelectorAll('[data-invoice-action]')) {
    button.addEventListener('click', async () => {
      const action = button.dataset.invoiceAction
      if (action === 'pay') {
        invoicePaymentId = button.dataset.id
        invoiceFormOpen = false
        queueScrollToSelector('form[data-form="invoice-payment"]')
        render()
        return
      }
      const completed = action === 'print'
        ? openInvoiceDocument(button.dataset.id, true)
        : action === 'view' && openInvoiceDocument(button.dataset.id)
      if (completed) feedbackMessage = action === 'print' ? 'Factura lista para imprimir.' : 'Factura abierta en una nueva pestaña.'
      if (!completed) feedbackMessage = 'No se pudo abrir la factura. Revisa que el navegador permita ventanas emergentes.'
      render()
    })
  }
  for (const button of document.querySelectorAll('[data-ticket-action]')) {
    button.addEventListener('click', () => {
      if (button.dataset.ticketAction === 'edit') {
        closeDocumentUtilityForms()
        ticketEditingId = button.dataset.id
        ticketFormOpen = true
        queueScrollToSelector('form[data-form="ticket"]')
        feedbackMessage = 'Ticket cargado para edicion.'
        render()
      }
    })
  }
  for (const input of document.querySelectorAll('[data-branch-search]')) input.addEventListener('input', () => {
    branchSearchQuery = input.value || ''
    rerenderSearchKeepingFocus(input, '[data-branch-search]')
  })
  for (const button of document.querySelectorAll('[data-branch-action]')) {
    button.addEventListener('click', async () => {
      if (button.dataset.branchAction === 'delete') {
        const branch = store.getSnapshot().branches.find((entry) => entry.id === button.dataset.id)
        if (!branch) return
        if (!window.confirm(`¿Eliminar la sucursal "${branch.name}"? También se quitarán sus cajas de la operación.`)) return
        const result = await store.removeEntity('branch', button.dataset.id)
        feedbackMessage = result.message || ''
        branchEditingId = ''
        render()
        return
      }
      if (button.dataset.branchAction === 'edit') {
        closeStructureUtilityForms()
        branchEditingId = button.dataset.id
        branchFormOpen = true
        queueScrollToSelector('form[data-form="branch"]')
        feedbackMessage = 'Sucursal cargada para edicion.'
        render()
        return
      }
      const result = store.selectBranch(button.dataset.id)
      feedbackMessage = result.ok ? 'Sucursal actual cambiada.' : (result.message || '')
      render()
    })
  }
  for (const button of document.querySelectorAll('[data-register-action]')) {
    button.addEventListener('click', () => {
      if (button.dataset.registerAction === 'select') {
        const result = store.selectRegister(button.dataset.id)
        feedbackMessage = result.message || ''
        render()
        return
      }
      if (button.dataset.registerAction === 'edit') {
        closeStructureUtilityForms()
        registerEditingId = button.dataset.id
        registerFormOpen = true
        queueScrollToSelector('form[data-form="register"]')
        feedbackMessage = 'Caja cargada para edicion.'
        render()
      }
    })
  }
  for (const button of document.querySelectorAll('[data-user-action]')) {
    button.addEventListener('click', async () => {
      if (button.dataset.userAction === 'edit') {
        userEditingId = button.dataset.id
        userDraftRoleId = getUiState().snapshot.users.find((entry) => entry.id === button.dataset.id)?.roleId || 'role-cashier'
        settingsPanelOpen = 'users'
        queueScrollToSelector('form[data-form="user"]')
        feedbackMessage = 'Usuario cargado para edicion.'
        render()
        return
      }
      const nextActive = button.dataset.active !== 'true'
      const result = await store.toggleUserActive(button.dataset.id, nextActive)
      feedbackMessage = result.message || ''
      render()
    })
  }
  const userRoleSelect = document.querySelector('form[data-form="user"] select[name="roleId"]')
  if (userRoleSelect) {
    userRoleSelect.addEventListener('change', () => {
      userDraftRoleId = String(userRoleSelect.value || 'role-cashier')
      render()
    })
  }

  const themeToggle = document.querySelector('[data-action="toggle-theme"]')
  if (themeToggle) themeToggle.addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; safeStorage.setItem(themeStorageKey, theme); applyTheme(); render() })
  const exportButton = document.querySelector('[data-action="export-data"]')
  if (exportButton) exportButton.addEventListener('click', exportData)
  const exportReportButton = document.querySelector('[data-action="export-report"]')
  if (exportReportButton) exportReportButton.addEventListener('click', exportReport)
  const importInput = document.querySelector('[data-action="import-data"]')
  if (importInput) importInput.addEventListener('change', importData)
  const resetButton = document.querySelector('[data-action="reset-data"]')
  if (resetButton) resetButton.addEventListener('click', () => { const result = store.resetData(); feedbackMessage = result?.message || ''; render() })
  const signOutButton = document.querySelector('[data-action="sign-out"]')
  if (signOutButton) signOutButton.addEventListener('click', async () => {
    if (authManager) await authManager.signOut()
    stopOperationalRealtime()
    store.signOut()
    store.clearCloudAuthSession()
    commerceContext = null
    authViewMode = (window.__operandoAppEntry || isStandaloneAppRoute()) ? 'login' : 'landing'
    if (isPanelRoute()) window.history.replaceState({}, '', '/ingresar/')
    loginMessage = ''
    signupMessage = ''
    feedbackMessage = ''
    requestScrollTop()
    render()
  })
  for (const recoveryButton of document.querySelectorAll('[data-action="recover-password"]')) {
    recoveryButton.addEventListener('click', async () => {
      const loginForm = document.querySelector('form[data-form="login"]')
      const emailInput = loginForm?.querySelector('input[name="identifier"]')
      const email = String(emailInput?.value || '').trim().toLowerCase()
      if (!email) {
        loginMessage = 'Escribe tu correo y luego toca "Recuperar clave".'
        render()
        return
      }
      try {
        if (!authManager) throw new Error('La conexion cloud no esta lista.')
        const result = await authManager.sendRecoveryMagicLink({
          email,
          redirectTo: `${publicSiteUrl}/restablecer-clave/?auth_action=recover`,
        })
        loginMessage = result?.message || 'Te enviamos un enlace para recuperar el acceso.'
      } catch (error) {
        loginMessage = mapPublicAuthError(error.message, 'login')
      }
      render()
    })
  }
  for (const cancelRecoveryButton of document.querySelectorAll('[data-action="cancel-recovery"]')) {
    cancelRecoveryButton.addEventListener('click', async () => {
      recoveryState = null
      loginMessage = ''
      if (authManager) await authManager.clearRecoveryState()
      requestScrollTop()
      render()
    })
  }
  for (const supportButton of document.querySelectorAll('[data-action="open-support"]')) {
    supportButton.addEventListener('click', () => {
      supportMenuOpen = false
      window.open(supportUrl, '_blank', 'noopener,noreferrer')
    })
  }
  for (const supportMenuButton of document.querySelectorAll('[data-action="toggle-support-menu"]')) {
    supportMenuButton.addEventListener('click', () => { supportMenuOpen = !supportMenuOpen; render() })
  }
  for (const arcaSetupButton of document.querySelectorAll('[data-action="open-arca-setup"]')) {
    arcaSetupButton.addEventListener('click', () => {
      supportMenuOpen = false
      activeSection = 'ajustes'
      settingsPanelOpen = 'arca'
      requestScrollTop()
      render()
    })
  }
  for (const button of document.querySelectorAll('[data-action="open-progressive-profile"]')) button.addEventListener('click', () => { progressiveProfilePromptOpen = true; progressiveProfileStep = 1; progressiveProfileGoalsDraft = null; progressiveProfileError = ''; activeSection = 'dashboard'; requestScrollTop(); render() })
  for (const button of document.querySelectorAll('[data-action="close-progressive-profile"]')) button.addEventListener('click', () => { progressiveProfilePromptOpen = false; progressiveProfileStep = 1; progressiveProfileGoalsDraft = null; progressiveProfileError = ''; render() })
  for (const button of document.querySelectorAll('[data-action="finish-progressive-profile"]')) button.addEventListener('click', () => { progressiveProfilePromptOpen = false; progressiveProfileStep = 1; progressiveProfileGoalsDraft = null; progressiveProfileError = ''; feedbackMessage = 'Perfil listo. Ya podés operar normalmente.'; render() })
  for (const button of document.querySelectorAll('[data-action="progressive-profile-next"]')) button.addEventListener('click', () => { progressiveProfileGoalsDraft = [...document.querySelectorAll('.progressive-profile-modal-form input[name="operationalGoals"]:checked')].map((input) => input.value); progressiveProfileError = ''; progressiveProfileStep = 2; render() })
  for (const button of document.querySelectorAll('[data-action="progressive-profile-previous"]')) button.addEventListener('click', () => { progressiveProfileError = ''; progressiveProfileStep = 1; render() })
  const updateProgressiveContactState = () => {
    const phone = document.querySelector('.progressive-profile-modal-form input[name="phone"]')
    const email = document.querySelector('.progressive-profile-modal-form input[name="email"]')
    const submit = document.querySelector('[data-progressive-contact-submit]')
    const status = document.querySelector('.progressive-contact-status')
    if (!phone || !email || !submit || !status) return
    const ready = /^[+()0-9\s-]{6,30}$/.test(phone.value.trim()) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())
    submit.disabled = !ready
    status.textContent = ready ? 'Listo para guardar tus datos.' : 'Completá teléfono y email para continuar.'
  }
  for (const input of document.querySelectorAll('.progressive-profile-modal-form input[name="phone"], .progressive-profile-modal-form input[name="email"]')) input.addEventListener('input', updateProgressiveContactState)
  updateProgressiveContactState()
  for (const input of document.querySelectorAll('.progressive-profile-modal-form input[name="operationalGoals"]')) input.addEventListener('change', () => {
    let selected = [...document.querySelectorAll('.progressive-profile-modal-form input[name="operationalGoals"]:checked')]
    if (selected.length > 5) { input.checked = false; selected = selected.filter((entry) => entry !== input) }
    const count = selected.length
    progressiveProfileGoalsDraft = selected.map((entry) => entry.value)
    const feedback = document.querySelector('.progressive-goal-feedback')
    if (count === 5) {
      progressiveProfileStep = 2
      render()
      return
    }
    if (input.checked === false && count === 5) {
      if (feedback) feedback.textContent = 'Podés elegir hasta 5 prioridades.'
      return
    }
    if (feedback) feedback.textContent = count ? `${count} de 5 prioridades elegidas. Podés seguir con menos de cinco.` : 'Elegí las que más impacten hoy. Podés continuar con menos de cinco.'
  })
  for (const arcaGuideButton of document.querySelectorAll('[data-action="open-arca-guide"]')) {
    arcaGuideButton.addEventListener('click', () => {
      window.open('https://www.arca.gob.ar/fe/ayuda/documentos/AccionesarealizarparaconsumirunWebservicedeFacturaElectr.pdf', '_blank', 'noopener,noreferrer')
    })
  }
  for (const button of document.querySelectorAll('[data-action="arca-previous-step"]')) button.addEventListener('click', () => { arcaSetupStep = Math.max(1, arcaSetupStep - 1); render() })
  for (const button of document.querySelectorAll('[data-action="arca-save-fiscal"]')) button.addEventListener('click', () => {
    arcaFiscal.cuit = String(document.querySelector('[name="arca-cuit"]')?.value || '').replace(/\D/g, '')
    arcaFiscal.legalName = String(document.querySelector('[name="arca-legal-name"]')?.value || '').trim()
    arcaFiscal.pointOfSale = String(document.querySelector('[name="arca-point-sale"]')?.value || '').trim()
    if (!/^\d{11}$/.test(arcaFiscal.cuit) || !arcaFiscal.legalName || !/^\d{1,5}$/.test(arcaFiscal.pointOfSale)) { feedbackMessage = 'Completa CUIT, razon social y punto de venta validos.'; render(); return }
    arcaSetupStep = 2; render()
  })
  for (const button of document.querySelectorAll('[data-action="arca-generate-csr"]')) button.addEventListener('click', async () => {
    try { const legal = arcaFiscal.legalName.replace(/[\/\r\n]/g, ' ').slice(0, 100); const result = await callArca('certificate-request', { subject: `/C=AR/O=${legal}/CN=${legal}/serialNumber=${arcaFiscal.cuit}` }); arcaFiscal.csrPem = result.csrPem; arcaCsrGenerated = true; feedbackMessage = 'Solicitud CSR generada.' } catch (error) { feedbackMessage = error.message } render()
  })
  for (const button of document.querySelectorAll('[data-action="arca-download-csr"]')) button.addEventListener('click', () => {
    const blob = new Blob([arcaFiscal.csrPem], { type: 'application/pkcs10' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'operando-arca-solicitud.csr'
    anchor.click()
    URL.revokeObjectURL(url)
  })
  for (const input of document.querySelectorAll('[data-arca-certificate]')) input.addEventListener('change', async () => { const file = input.files?.[0]; arcaCertificateName = file?.name || ''; if (file) arcaFiscal.certificatePem = await file.text(); render() })
  for (const button of document.querySelectorAll('[data-action="arca-next-step"]')) button.addEventListener('click', async () => { if (arcaSetupStep === 3 && arcaFiscal.certificatePem) { try { await callArca('certificate', { certificatePem: arcaFiscal.certificatePem }); feedbackMessage = 'Certificado cargado.' } catch (error) { feedbackMessage = error.message; render(); return } } arcaSetupStep = Math.min(4, arcaSetupStep + 1); render() })
  for (const button of document.querySelectorAll('[data-action="arca-verify"]')) button.addEventListener('click', async () => {
    if (arcaVerificationState === 'verified') return
    arcaVerificationState = 'checking'
    render()
    try { await callArca('verify', { cuit: arcaFiscal.cuit, pointOfSale: Number(arcaFiscal.pointOfSale) }); arcaVerificationState = 'verified'; arcaConnectionStatus = 'connected'; feedbackMessage = 'Conexion ARCA de homologacion activa.' } catch (error) { arcaVerificationState = 'idle'; feedbackMessage = error.message } render()
  })
  for (const importSupportButton of document.querySelectorAll('[data-action="request-bulk-import"]')) {
    importSupportButton.addEventListener('click', () => {
      window.open(bulkImportSupportUrl, '_blank', 'noopener,noreferrer')
    })
  }
  for (const templateButton of document.querySelectorAll('[data-action="download-product-template"]')) templateButton.addEventListener('click', downloadBulkProductTemplate)
  for (const bulkImportInput of document.querySelectorAll('[data-input="bulk-product-import"]')) bulkImportInput.addEventListener('change', importBulkProductsFile)
  document.addEventListener('click', (event) => {
    if (!accountAlertsOpen) return
    const target = event.target
    if (target instanceof Element && target.closest('.account-alerts-wrap')) return
    accountAlertsOpen = false
    render()
  }, { once: true })
  const cancelSaleEdit = document.querySelector('[data-action="cancel-sale-edit"]')
  if (cancelSaleEdit) cancelSaleEdit.addEventListener('click', () => { saleEditingId = ''; saleDraftQuantities = {}; saleQuickAddCode = ''; saleFormOpen = false; feedbackMessage = 'Edicion de venta cancelada.'; render() })
  const cancelPurchaseEdit = document.querySelector('[data-action="cancel-purchase-edit"]')
  if (cancelPurchaseEdit) cancelPurchaseEdit.addEventListener('click', () => { closePurchaseUtilityForms(); feedbackMessage = 'Edicion de compra cancelada.'; render() })
  const cancelInvoiceEdit = document.querySelector('[data-action="cancel-invoice-edit"]')
  if (cancelInvoiceEdit) cancelInvoiceEdit.addEventListener('click', () => { closeDocumentUtilityForms(); feedbackMessage = 'Edicion de factura cancelada.'; render() })
  const cancelTicketEdit = document.querySelector('[data-action="cancel-ticket-edit"]')
  if (cancelTicketEdit) cancelTicketEdit.addEventListener('click', () => { closeDocumentUtilityForms(); feedbackMessage = 'Edicion de ticket cancelada.'; render() })
  const cancelBranchEdit = document.querySelector('[data-action="cancel-branch-edit"]')
  if (cancelBranchEdit) cancelBranchEdit.addEventListener('click', () => { closeStructureUtilityForms(); feedbackMessage = 'Edicion de sucursal cancelada.'; render() })
  const cancelRegisterEdit = document.querySelector('[data-action="cancel-register-edit"]')
  if (cancelRegisterEdit) cancelRegisterEdit.addEventListener('click', () => { closeStructureUtilityForms(); feedbackMessage = 'Edicion de caja cancelada.'; render() })
  const cancelUserEdit = document.querySelector('[data-action="cancel-user-edit"]')
  if (cancelUserEdit) cancelUserEdit.addEventListener('click', () => { userEditingId = ''; userDraftRoleId = 'role-cashier'; feedbackMessage = 'Edicion de usuario cancelada.'; render() })
}

applyTheme()
window.addEventListener('popstate', () => {
  if (!store?.isAuthenticated?.()) return
  activeSection = sectionFromPath()
  render()
  void syncLiveData()
})
bootstrap()


