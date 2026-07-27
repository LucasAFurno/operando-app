import { createBrowserDataStore } from './data-store.js?v=20260720l'
import { createCloudAuthManager } from './cloud-auth.js?v=20260720l'

const currency = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const today = new Date().toISOString().slice(0, 10)
const productName = 'PCLAF Control'
const appVersion = 'v2026.07.22-o'
const supportUrl = 'https://wa.me/5491135708345?text=Hola%20PCLAF%2C%20necesito%20soporte%20de%20PCLAF%20Control.'
const bulkImportSupportUrl = 'https://wa.me/5491135708345?text=Hola%20PCLAF%2C%20necesito%20cargar%20productos%20desde%20una%20planilla%20en%20PCLAF%20Control.'
const publicSiteUrl = 'https://www.pclafcontrol.com.ar'
const themeStorageKey = 'pclaf-control-theme'
const sectionStorageKey = 'pclaf-control-section'
const instanceStorageKey = 'pclaf-control-instance'
const dataStorageKey = 'pclaf-control-data'
const cloudConfigStorageKey = 'pclaf-control-cloud-config'
const defaultSupabaseUrl = 'https://rfwsnqmjkclxhbmidbkm.supabase.co'
const canPersistInBrowser = Boolean(globalThis.window?.pclafDesktop?.isDesktop)

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
  { id: 'dashboard', moduleKey: 'dashboard', label: 'Inicio', permission: 'dashboard:view', icon: icon('<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V20h14v-9.5"/>') },
  { id: 'clientes', moduleKey: 'customers', label: 'Clientes', permission: 'customers:view', icon: icon('<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="3"/><path d="M20 8v6"/><path d="M17 11h6"/>') },
  { id: 'ventas', moduleKey: 'sales', label: 'Ventas', permission: 'sales:view', icon: icon('<path d="M4 17h16"/><path d="M7 17V9"/><path d="M12 17V5"/><path d="M17 17v-6"/>') },
  { id: 'caja', moduleKey: 'cash', label: 'Caja', permission: 'cash:view', icon: icon('<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16"/><path d="M16 14h2"/>') },
  { id: 'sucursales', moduleKey: 'branches', label: 'Sucursales', permission: 'branches:view', icon: icon('<path d="M4 20V8l8-4 8 4v12"/><path d="M9 20v-6h6v6"/><path d="M4 10h16"/>') },
  { id: 'cajeros', moduleKey: 'registers', label: 'Cajas', permission: 'registers:view', icon: icon('<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M8 8h8"/><path d="M9 12h1"/><path d="M12 12h1"/><path d="M15 12h1"/><path d="M9 15h1"/><path d="M12 15h4"/>') },
  { id: 'productos', moduleKey: 'products', label: 'Productos', permission: 'products:view', icon: icon('<path d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z"/><path d="M3 7.5V16.5L12 21l9-4.5V7.5"/>') },
  { id: 'compras', moduleKey: 'purchases', label: 'Compras', permission: 'purchases:view', icon: icon('<circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/><path d="M3 4h2l2.4 10.5h10.8L21 8H8"/>') },
  { id: 'facturacion', moduleKey: 'invoices', label: 'Facturas', permission: 'invoices:view', icon: icon('<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4"/><path d="M10 12h6"/><path d="M10 16h6"/>') },
  { id: 'tickets', moduleKey: 'tickets', label: 'Tickets', permission: 'tickets:view', icon: icon('<rect x="4" y="5" width="16" height="10" rx="2"/><path d="M8 19h8"/><path d="M10 15v4"/><path d="M14 15v4"/>') },
  { id: 'reportes', moduleKey: 'reports', label: 'Reportes', permission: 'reports:view', icon: icon('<path d="M5 19V9"/><path d="M12 19V5"/><path d="M19 19v-8"/><path d="M3 19h18"/>') },
  { id: 'mi-admin', moduleKey: 'settings', label: 'Mi admin', permission: 'settings:view', platformOnly: true, icon: icon('<path d="M4 19.5v-9l8-5 8 5v9"/><path d="M9 19.5v-4h6v4"/><path d="M8 9h8"/><path d="M12 3v3"/>') },
  { id: 'ajustes', moduleKey: 'settings', label: 'Ajustes', permission: 'settings:view', icon: icon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.33 1V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-.33-1A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1-.33H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1-.33A1.65 1.65 0 0 0 4.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8 4.6a1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .33-1V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 .33 1 1.65 1.65 0 0 0 1 .6 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 8a1.65 1.65 0 0 0 .6 1 1.65 1.65 0 0 0 1 .33H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1 .33 1.65 1.65 0 0 0-.51 1.34Z"/>') },
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
let topbarSearch = ''
let cloudSyncBusy = false
let customerFormOpen = false
let customerEditingId = ''
let customerSearchQuery = ''
let saleFormOpen = false
let cashFormOpen = false
let productFormOpen = false
let stockAdjustmentFormOpen = false
let stockTransferFormOpen = false
let supplierFormOpen = false
let supplierEditingId = ''
let supplierSearchQuery = ''
let purchaseFormOpen = false
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
let feedbackTimer = null
let pendingScrollTop = false
let accountAlertsOpen = false
let dismissedAccountAlertIds = new Set()
let supportMenuOpen = false
let settingsPanelOpen = ''
let arcaSetupStep = 1
let arcaCsrGenerated = false
let arcaCertificateName = ''
let arcaVerificationState = 'idle'
let arcaConnectionStatus = 'attention'
let arcaFiscal = { cuit: '', legalName: '', pointOfSale: '', csrPem: '', certificatePem: '' }
let platformCommerceSelectedId = ''
let platformCommerceFilter = 'all'
let platformSupportFilter = 'all'
let platformSearchQuery = ''
let pendingScrollSelector = ''
let userDraftRoleId = 'role-cashier'
const pageSizeOptions = [10, 20, 50, 100, 1000]

const arcaTenantId = () => `arca-${String(commerceContext?.commerce_id || '').toLowerCase()}`
const callArca = async (action, payload = {}) => {
  const session = authManager?.getSession()
  const cloud = store?.getCloudConnection()
  if (!session?.sessionToken || !cloud?.url || !commerceContext?.commerce_id) throw new Error('Inicia sesion como propietario para configurar ARCA.')
  const response = await fetch(`${String(cloud.url).replace(/\/$/, '')}/functions/v1/fiscal-gateway`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-pclaf-session': session.sessionToken },
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

const normalizeInstanceKey = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-') || 'pclaf-dev'
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
  await store.syncFromCloud()
  const activeProfile = store.setCloudAuthSession(currentSession.profile, [])
  if (!activeProfile) {
    commerceContext = null
    store.clearCloudAuthSession()
    throw new Error('No se pudo activar la sesion del usuario.')
  }
  return activeProfile
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

const isStandaloneAppRoute = () => /^\/app(?:\/|$)/i.test(window.location.pathname || '')
const mapPublicAuthError = (message, context = 'login') => {
  const normalized = String(message || '').trim().toLowerCase()
  if (!normalized) return context === 'signup' ? 'No se pudo crear la cuenta.' : 'No se pudo iniciar sesion.'
  const messages = {
    user_not_found: 'No pudimos iniciar sesion. Revisa tus datos o recupera el acceso.',
    invalid_credentials: 'No pudimos iniciar sesion. Revisa tus datos o recupera el acceso.',
    access_denied: 'No pudimos iniciar sesion. Revisa tus datos o recupera el acceso.',
    turnstile_required: 'Completa la verificacion de seguridad antes de continuar.',
    invalid_pin: 'La clave no coincide. Pruebala de nuevo o recupera el acceso.',
    login_locked: 'Por seguridad bloqueamos el acceso durante 15 minutos después de 3 claves incorrectas. Puedes esperar y volver a intentarlo, o recuperar tu clave ahora.',
    owner_email_already_exists: 'Ya existe una cuenta con ese correo. Puedes entrar o recuperar la clave.',
    login_name_already_exists: 'Ese acceso ya existe. Prueba con otro correo o inicia sesion.',
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
  return messages[normalized] || message
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
  window.__pclafBooted = true
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
const downloadBulkProductTemplate = () => { const csv = `\ufeff${[bulkProductColumns, Array(bulkProductColumns.length).fill('')].map((row) => row.map(csvEscape).join(';')).join('\r\n')}`; const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'plantilla-productos-pclaf.csv'; link.click(); URL.revokeObjectURL(url) }
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
    if (!businessModules.includes('settings')) businessModules.push('settings')
  }
  const overrides = Array.isArray(entry.allowedModules) ? entry.allowedModules.filter(Boolean) : []
  if (overrides.length) {
    const scopedModules = businessModules.filter((moduleKey) => overrides.includes(moduleKey))
    if (isAdministrator) {
      if (!scopedModules.includes('dashboard')) scopedModules.unshift('dashboard')
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
const saleActionButtons = (sale) => `
  <div class="inline-action-group sale-actions-compact">
    <button type="button" class="inline-action is-strong" data-sale-action="edit" data-id="${sale.id}">Editar</button>
    <button type="button" class="inline-action" data-sale-action="invoice" data-id="${sale.id}">Factura</button>
    <details class="sale-more-menu">
      <summary>Mas</summary>
      <div class="sale-more-popover">
        <button type="button" class="inline-action" data-sale-action="ticket" data-id="${sale.id}">Ticket</button>
        <button type="button" class="inline-action" data-sale-action="receipt-80" data-id="${sale.id}">Ticket 80 mm</button>
        <button type="button" class="inline-action" data-sale-action="receipt-58" data-id="${sale.id}">Ticket 58 mm</button>
        <button type="button" class="inline-action" data-sale-action="export" data-id="${sale.id}">Exportar</button>
        <button type="button" class="inline-action" data-sale-action="return" data-id="${sale.id}">Devolver</button>
        <button type="button" class="inline-action" data-sale-action="cancel" data-id="${sale.id}">Anular</button>
        <button type="button" class="inline-action danger sale-delete-action" data-delete="sale" data-id="${sale.id}">Eliminar venta</button>
      </div>
    </details>
  </div>
`
const purchaseActionButtons = (receipt) => `
  <div class="inline-action-group">
    <button type="button" class="inline-action" data-purchase-action="edit" data-id="${receipt.id}">Editar</button>
    <button type="button" class="inline-action danger" data-delete="purchase_receipt" data-id="${receipt.id}">Eliminar</button>
  </div>
`
const invoiceActionButtons = (invoice) => `
  <div class="inline-action-group invoice-actions">
    <button type="button" class="inline-action is-strong" data-invoice-action="pay" data-id="${invoice.id}" ${invoiceBalance(invoice) <= 0 ? 'disabled' : ''}>Abonar</button>
    <button type="button" class="inline-action" data-invoice-action="view" data-id="${invoice.id}">Ver</button>
    <button type="button" class="inline-action" data-invoice-action="print" data-id="${invoice.id}">Imprimir</button>
    <button type="button" class="inline-action danger" data-delete="invoice" data-id="${invoice.id}">Eliminar</button>
  </div>
`

const invoiceEmissionLabel = (invoice) => invoice.fiscalStatus === 'Interno' ? 'Interno' : 'ARCA'
const invoiceBalance = (invoice) => Math.max(0, Number(invoice?.totalAmount || 0) - Number(invoice?.amountPaid || 0))
const ticketActionButtons = (ticket) => `
  <div class="inline-action-group">
    <button type="button" class="inline-action" data-ticket-action="edit" data-id="${ticket.id}">Editar</button>
    <button type="button" class="inline-action danger" data-delete="ticket" data-id="${ticket.id}">Eliminar</button>
  </div>
`
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
    feedbackMessage = `${product.name} agregado a la venta.`
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
  for (const branch of ui.snapshot.branches) pushTarget('sucursales', branch.name, [branch.code, branch.address])
  for (const register of ui.snapshot.registers) pushTarget('cajeros', register.name, [register.code])
  return normalizedEntries
}
const clearFeedbackSoon = () => {
  if (feedbackTimer) window.clearTimeout(feedbackTimer)
  if (!feedbackMessage) return
  const currentMessage = feedbackMessage
  feedbackTimer = window.setTimeout(() => {
    if (feedbackMessage !== currentMessage) return
    feedbackMessage = ''
    render()
  }, 2800)
}
const getAllowedNav = (ui) => navItems.filter((item) => (
  store.canAccessModule(item.moduleKey, item.permission)
  && (!item.ownerOnly || ui.user?.isOwner)
  && (!item.platformOnly || ui.user?.isPlatformAdmin)
))

const getUiState = () => {
  const snapshot = store.getSnapshot()
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
  const enrichedInvoices = byRecentDate(scopedInvoices, 'dueDate').map((invoice) => ({ ...invoice, customerName: customerMap.get(invoice.customerId)?.fullName || 'Sin cliente', branchName: branchMap.get(invoice.branchId)?.name || 'Sucursal' }))
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

  return {
    snapshot,
    moduleCatalog: store.moduleCatalog,
    modulePresets: store.modulePresets,
    user,
    role,
    commerceContext,
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
    enrichedAudit: byRecentDate(snapshot.auditLogs, 'createdAt').slice(0, 8).map((log) => ({ ...log, actorName: userMap.get(log.actorUserId)?.fullName || 'Sistema' })),
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

const standaloneAuthView = (ui) => `
  <div class="login-shell auth-standalone-shell">
    <main class="auth-standalone" aria-labelledby="auth-title">
      <a class="auth-back-link" href="/" aria-label="Volver a la portada">&larr; Volver al sitio</a>
      <section class="login-card auth-standalone-card">
        <div class="auth-brand">
          <img src="/pclaf-logo.png" alt="PCLAF Control" />
          <div>
            <strong>${productName}</strong>
            <span>Gestion comercial online</span>
          </div>
        </div>
        ${authViewMode === 'login' ? `
          <div class="auth-heading">
            <p class="kicker">Ingreso al sistema</p>
            <h1 id="auth-title">Iniciar sesion</h1>
            <p>Ingresa con tu correo y tu clave para abrir tu comercio.</p>
          </div>
          <form class="login-form" data-form="login" autocomplete="on">
            <label>Email<input type="email" name="identifier" value="" placeholder="tu@email.com" autocomplete="username" autocapitalize="off" spellcheck="false" required /></label>
            <label>Clave<input type="password" name="pin" value="" placeholder="Tu clave" autocomplete="current-password" required /></label>
            ${window.__pclafTurnstileSiteKey ? `<div class="cf-turnstile" data-sitekey="${window.__pclafTurnstileSiteKey}" data-action="login" data-size="flexible"></div>` : ''}
            ${loginMessage ? `<p class="login-error" role="alert">${loginMessage}</p>` : ''}
            ${loginMessage?.includes('15 minutos') ? '<button type="button" class="auth-text-action" data-action="recover-password">Recuperar mi clave ahora</button>' : ''}
            <button type="submit">Ingresar</button>
          </form>
          <div class="auth-secondary-actions">
            <button type="button" class="auth-text-action" data-action="recover-password">No recuerdo mi clave</button>
            <span>No tienes cuenta? <button type="button" class="auth-text-action" data-action="show-signup">Crear cuenta</button></span>
          </div>
        ` : `
          <div class="auth-heading">
            <p class="kicker">Empieza ahora</p>
            <h1 id="auth-title">Crear cuenta</h1>
            <p>Carga tus datos y empieza a usar PCLAF Control en minutos.</p>
          </div>
          <form class="login-form compact-signup-form" data-form="instance-setup" autocomplete="on">
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
            ${signupMessage ? `<p class="login-error" role="alert">${signupMessage}</p>` : ''}
            <button type="submit">Crear cuenta y empezar</button>
          </form>
          <div class="auth-secondary-actions auth-secondary-centered">
            <span>Ya tienes cuenta? <button type="button" class="auth-text-action" data-action="show-login">Iniciar sesion</button></span>
          </div>
        `}
      </section>
      <p class="auth-support">Necesitas ayuda? <button type="button" class="auth-text-action" data-action="open-support">Hablar con soporte</button></p>
    </main>
  </div>
`

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
  if ((window.__pclafAppEntry || isStandaloneAppRoute()) && authViewMode === 'landing') authViewMode = 'login'
  if (recoveryState) {
    return `
  <div class="login-shell login-shell-home">
    <div class="recovery-shell">
      <header class="public-topbar">
        <div class="public-topbar-brand">
          <img class="public-topbar-logo" src="/pclaf-logo.png" alt="PCLAF" />
          <div class="public-topbar-copy">
            <strong>${productName}</strong>
            <span>Recuperacion de acceso</span>
          </div>
        </div>
      </header>
      <section class="recovery-panel">
        <div class="login-card recovery-card" id="acceso-recovery">
          <p class="kicker">Recuperar acceso</p>
          <h2>Nueva clave</h2>
          <p class="login-copy">Define una clave nueva para ${maskEmail(recoveryState.email) || 'tu cuenta'} y vuelve a entrar normalmente.</p>
          <form class="login-form" data-form="password-recovery" autocomplete="off">
            <label>Nueva clave<input type="password" name="password" value="" placeholder="Minimo 6 caracteres" autocomplete="new-password" required /></label>
            <label>Repetir clave<input type="password" name="passwordConfirm" value="" placeholder="Repite la clave" autocomplete="new-password" required /></label>
            ${loginMessage ? `<p class="login-error">${loginMessage}</p>` : ''}
            <button type="submit">Guardar nueva clave</button>
          </form>
          <div class="login-actions">
            <button type="button" class="ghost-action" data-action="cancel-recovery">Cancelar</button>
            <button type="button" class="ghost-action" data-action="open-support">Necesito ayuda</button>
          </div>
        </div>
      </section>
    </div>
  </div>
`
  }

  if (authViewMode === 'login' || authViewMode === 'signup') return standaloneAuthView(ui)

  return `
  <div class="login-shell login-shell-home">
    <div class="public-home">
      <header class="public-topbar">
        <div class="public-topbar-brand">
          <img class="public-topbar-logo" src="/pclaf-logo.png" alt="PCLAF" />
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
              <label>Email de acceso<input type="email" name="identifier" value="" placeholder="tu@email.com" autocomplete="username" autocapitalize="off" spellcheck="false" required /></label>
              <label>Clave<input type="password" name="pin" value="" placeholder="Tu clave" autocomplete="current-password" required /></label>
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
            <p>PCLAF Control funciona como punto de venta web con control de caja, productos, inventario, clientes, proveedores, tickets y facturacion para comercios que quieren operar desde PC o celular sin instalar programas complejos.</p>
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
            <img class="login-logo login-logo-large" src="/pclaf-logo.png" alt="PCLAF" />
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
            <p>PCLAF Control es un software de gestion comercial para kioscos, locales, tiendas y negocios que necesitan vender, cobrar, ordenar stock y emitir comprobantes desde la web.</p>
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
              <strong>Contacto PCLAF</strong>
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
            <label>Email de acceso<input type="email" name="identifier" value="" placeholder="tu@email.com" autocomplete="off" autocapitalize="off" spellcheck="false" data-lpignore="true" required /></label>
            <label>Clave<input type="password" name="pin" placeholder="Tu clave" autocomplete="current-password" required /></label>
            <input type="hidden" name="instanceKey" value="${ui.cloudConnection.environment === 'development' ? (ui.cloudConnection.instanceKey || 'pclaf-dev') : ''}" />
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
      <img class="login-logo" src="/pclaf-logo.png" alt="PCLAF" />
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
      <img class="login-logo" src="/pclaf-logo.png" alt="PCLAF" />
      <p class="kicker">Activacion requerida</p>
      <h1>${productName}</h1>
      <p class="login-copy">Esta instalacion necesita la base cloud conectada antes de permitir ingresos o pruebas con clientes.</p>
      <div class="info-strip"><strong>Base obligatoria</strong><span>Sin conexion activa la app queda bloqueada para evitar pruebas falsas o datos perdidos.</span></div>
      <form class="login-form" data-form="cloud-connection">
        <div class="login-form-grid-2">
          <label>URL Supabase<input type="url" name="url" value="${ui.cloudConnection.url || defaultSupabaseUrl}" placeholder="https://xxxx.supabase.co" required /></label>
          <label>Clave publica<input type="text" name="anonKey" value="${ui.cloudConnection.anonKey || ''}" placeholder="sb_publishable_xxx o anon key" required /></label>
          <label class="full-span">Instancia<input type="text" name="instanceKey" value="${ui.cloudConnection.instanceKey || 'pclaf-dev'}" placeholder="pclaf-dev" required /></label>
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

const dashboardView = (ui) => `
  <section class="view-section">
    <div class="section-header"><div><p class="kicker">Resumen diario</p><h2>Operacion del local</h2></div><div class="panel-inline-stats section-inline-stats dashboard-inline-stats">
      <span class="panel-inline-stat"><strong>${money(ui.totalSales)}</strong><span>Ventas</span></span>
      <span class="panel-inline-stat"><strong>${money(ui.unpaidSales)}</strong><span>Por cobrar</span></span>
      <span class="panel-inline-stat"><strong>${ui.openCashSession ? money(ui.expectedCash) : 'Cerrada'}</strong><span>Caja</span></span>
      <span class="panel-inline-stat"><strong>${money(ui.pendingInvoices)}</strong><span>Facturas</span></span>
    </div></div>
    ${feedbackMessage ? `<div class="feedback-banner">${feedbackMessage}</div>` : ''}
    <section class="dashboard-grid dashboard-operation-grid">
      <article class="panel"><div class="panel-head"><div><h3>Ventas recientes</h3><p>Con multiples articulos</p></div></div><div class="list">
        ${ui.enrichedSales.slice(0, 5).map((sale) => `<div class="list-row"><div><strong>${sale.customerName}</strong><p>${sale.itemSummary}</p></div><div class="right"><strong>${money(sale.totalAmount)}</strong><p>${sale.channel} - ${sale.paymentMethod}</p></div></div>`).join('')}
      </div></article>
      <article class="panel"><div class="panel-head"><div><h3>Top productos</h3><p>Ranking de movimiento</p></div></div><div class="top-list">
        ${ui.topProducts.length ? ui.topProducts.map(([name, qty], index) => `<div class="top-row"><span>${index + 1}</span><div><strong>${name}</strong><p>${qty} unidades vendidas</p></div></div>`).join('') : '<p class="empty-state">Todavia no hay ventas cargadas.</p>'}
      </div></article>
      <article class="panel dashboard-stock-panel"><div class="panel-head"><div><h3>Stock critico</h3><p>${ui.lowStock.length ? `${ui.lowStock.length} articulos para revisar` : 'Inventario estable'}</p></div></div><div class="alert-list">
        ${ui.lowStock.length ? paginatedCardList(ui.lowStock, 'stock-critico', (product) => `<div class="alert-card"><strong>${product.name}</strong><p>Stock ${product.scopedStock} en ${ui.currentBranch?.name || 'sucursal'} / minimo ${product.minStock}</p></div>`) : '<div class="alert-card ok"><strong>Sin alertas</strong><p>No hay productos con stock bajo.</p></div>'}
      </div></article>
      <article class="panel dashboard-audit-panel"><div class="panel-head"><div><h3>Auditoria</h3><p>Ultimas acciones</p></div></div><div class="timeline-list">
        ${ui.enrichedAudit.map((log) => `<div class="timeline-item"><strong>${log.action}</strong><p>${log.actorName} - ${log.entityType}</p><span>${log.createdAt.slice(0, 16).replace('T', ' ')}</span></div>`).join('')}
      </div></article>
    </section>
  </section>
`

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
        <article class="panel"><div class="panel-head"><div><h3>${query ? 'Resultados' : 'Ultimos 10 clientes'}</h3><p>Busca por nombre, telefono, email o CUIT; hace click para editar.</p></div><div class="settings-actions">${createToggleButton('customer', customerFormOpen, 'Agregar cliente')}</div></div>
          <div class="stock-adjustment-search"><span class="pos-search-icon" aria-hidden="true">${icon('<circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/>')}</span><input type="search" data-customer-search value="${escapeHtml(customerSearchQuery)}" placeholder="Buscar cliente" aria-label="Buscar cliente" /></div>
          <div class="timeline-list">${customers.map((customer) => `<div class="timeline-item contact-result"><button type="button" class="contact-result-main" data-action="edit-customer" data-id="${customer.id}"><strong>${escapeHtml(customer.fullName)}</strong><p>${escapeHtml(customer.phone || customer.email || customer.cuit || 'Sin datos de contacto')}</p><span>${escapeHtml(customer.address || 'Sin direccion')} · ${balanceText(customer.balance)} ${money(customer.balance)}</span></button><span class="contact-result-actions">${actionButton('customer', customer.id)}</span></div>`).join('') || '<p class="empty-state">No hay clientes para esta busqueda.</p>'}</div>
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
              <div class="pos-cart-head"><div><strong>Articulos</strong><span>${cartUnits} unidades</span></div><output class="pos-total" data-sale-total>${money(Math.max(0, cartSubtotal - Number(editingSale?.discountAmount || 0)))}</output></div>
              <div class="cart-builder">
                ${selectedProducts.length ? selectedProducts.map((product) => `
                  <div class="cart-line ${product.trackStock && product.scopedStock <= product.minStock ? 'is-low' : ''}">
                    <div><strong>${product.name}</strong><p>${money(product.salePrice)} c/u · stock ${product.scopedStock}</p></div>
                    <label class="cart-quantity"><span>Cantidad</span><input type="number" min="0" max="${product.trackStock ? product.scopedStock : 999999}" value="${quantities.get(product.id) || 0}" name="qty_${product.id}" data-sale-price="${Number(product.salePrice || 0)}" /></label>
                    <strong class="cart-line-total">${money(Number(quantities.get(product.id) || 0) * Number(product.salePrice || 0))}</strong>
                  </div>`).join('') : '<div class="pos-cart-empty"><strong>Venta vacia</strong><span>Busca o escanea el primer articulo.</span></div>'}
              </div>
            </section>
            <aside class="pos-payment-panel">
              <label class="pos-customer-field">Cliente<div class="pos-customer-search"><div class="stock-adjustment-search"><span class="pos-search-icon" aria-hidden="true">${icon('<circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/>')}</span><input type="search" data-sale-customer-search value="${escapeHtml(selectedSaleCustomer?.fullName || saleCustomerSearchQuery)}" placeholder="Buscar cliente o dejar Mostrador" autocomplete="off" list="sale-customer-options" aria-label="Buscar cliente" /><datalist id="sale-customer-options">${ui.snapshot.customers.map((customer) => `<option value="${escapeHtml(customer.fullName)}">${escapeHtml([customer.phone, customer.email].filter(Boolean).join(' · '))}</option>`).join('')}</datalist></div><input type="hidden" name="customerId" value="${editingSale?.customerId || ''}" /><button type="button" class="pos-customer-counter" data-action="set-counter-customer">Mostrador</button></div></label>
              <label class="pos-payment-field">Medio de pago<select name="paymentMethod"><option value="cash" ${editingSale?.paymentMethod === 'cash' ? 'selected' : ''}>Efectivo</option><option value="transfer" ${editingSale?.paymentMethod === 'transfer' ? 'selected' : ''}>Transferencia</option><option value="mercado_pago" ${editingSale?.paymentMethod === 'mercado_pago' ? 'selected' : ''}>Mercado Pago</option><option value="echeq" ${editingSale?.paymentMethod === 'echeq' ? 'selected' : ''}>E-cheq</option><option value="account" ${editingSale?.paymentMethod === 'account' ? 'selected' : ''}>Cuenta corriente</option><option value="mixed" ${editingSale?.paymentMethod === 'mixed' ? 'selected' : ''}>Pago mixto</option></select></label>
              <label class="pos-echeq-field" data-echeq-field hidden>Número de e-cheq<input type="text" name="echeqNumber" placeholder="Ej.: 00123456" autocomplete="off" /></label>
              <details class="sales-payment-detail"><summary>Mas opciones</summary>
                <div class="pos-payment-advanced">
                  <label class="checkbox-row compact-toggle"><input type="checkbox" name="autoInvoice" /><span>Facturar</span></label>
                  <label class="pos-discount-field">Descuento<input type="number" min="0" name="discountAmount" value="${editingSale?.discountAmount || 0}" /></label>
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
      <article class="panel"><div class="panel-head"><div><h3>Ultimos cierres</h3><p>Diferencias y arqueo</p></div></div><div class="timeline-list">
          ${byRecentDate(ui.scopedCashSessions.filter((session) => session.status === 'closed'), 'closedAt').slice(0, 5).map((session) => `<div class="timeline-item"><strong>Cierre ${session.closedAt?.slice(0, 10) || '-'}</strong><p>Contado ${money(session.countedAmount || 0)} / diferencia ${money(session.differenceAmount || 0)}</p><span>${ui.enrichedRegisters.find((register) => register.id === session.registerId)?.name || 'Caja'} / fondo ${money(session.openingAmount || 0)}</span></div>`).join('') || '<p class="empty-state">Todavia no hay cierres para este filtro.</p>'}
        </div></article>
      <article class="panel"><div class="panel-head"><div><h3>Bitacora de caja</h3><p>Impacta en el arqueo esperado</p></div></div><div class="timeline-list">
          ${ui.enrichedCashMovements.slice(0, 6).map((movement) => `<div class="timeline-item"><strong>${cashMovementKindLabel(movement.kind)}</strong><p>${movement.note}</p><span>${movement.registerName} / ${money(movement.signedAmount)} / ${movement.createdAt.slice(0, 16).replace('T', ' ')}</span></div>`).join('') || '<p class="empty-state">Todavia no hay movimientos manuales.</p>'}
        </div></article>
    </section>
  </section>
`})()}
`

const productsView = (ui) => `
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
            <label>Categoria<input type="text" name="category" required /></label>
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
            <div><h3>Inventario</h3><p>Stock actual y precio de venta</p></div>
          </div>
          <div class="inventory-action-bar">
            ${createToggleButton('product', productFormOpen, 'Agregar producto')}
            ${createToggleButton('stock-adjustment', stockAdjustmentFormOpen, 'Ajuste de stock')}
            ${createToggleButton('stock-transfer', stockTransferFormOpen, 'Transferencia')}
          </div>
          <div class="bulk-import-card"><div class="bulk-import-copy"><strong>Carga masiva de productos</strong><span>Descarga la plantilla, completala en Excel y subila. Las columnas ya estan ordenadas para importar sin duplicar productos.</span><small>Campos obligatorios: Nombre, SKU y Precio de venta.</small></div><div class="bulk-import-actions"><button type="button" class="inline-action" data-action="download-product-template">Descargar plantilla Excel</button><label class="primary-action bulk-upload-action">Subir planilla<input type="file" data-input="bulk-product-import" accept=".csv,text/csv,.txt,text/plain" hidden /></label><button type="button" class="text-action" data-action="request-bulk-import">Prefiero que lo hagan por mi</button></div></div>
          ${paginatedInventoryTable(ui.scopedProducts, 'productos', (product) => `
            <div class="inventory-row ${product.trackStock && product.scopedStock <= product.minStock ? 'is-low' : ''}" data-product-id="${product.id}">
              <span class="inventory-product">${product.name}<small>${product.sku}</small></span>
              <span>${product.barcode || '-'}</span>
              <span><span class="stock-pill">${product.scopedStock}</span></span>
              <span>${product.totalStock}</span>
              <span>${money(product.salePrice)}</span>
              <span class="inventory-actions">${actionButton('product', product.id)}</span>
            </div>
          `)}
        </article>
      </div>
    </section>
  </section>
`

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
    const visibleSuppliers = (supplierQuery ? ui.snapshot.suppliers.filter((supplier) => [supplier.name, supplier.contact, supplier.phone, supplier.email, supplier.cuit].some((value) => String(value || '').toLowerCase().includes(supplierQuery))) : ui.snapshot.suppliers.slice(0, 10))
    const showPurchaseForm = purchaseFormOpen || Boolean(editingReceipt)
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
          <label>Proveedor<select name="supplierId" required>${ui.snapshot.suppliers.map((supplier) => `<option value="${supplier.id}" ${editingReceipt?.supplierId === supplier.id ? 'selected' : ''}>${supplier.name}</option>`).join('')}</select></label>
          <label class="stock-adjustment-product">Producto<div class="stock-adjustment-search"><span class="pos-search-icon" aria-hidden="true">${icon('<circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/>')}</span><input type="search" name="productSearch" value="${escapeHtml(ui.snapshot.products.find((product) => product.id === editingReceipt?.productId)?.name || '')}" list="purchase-product-options" autocomplete="off" placeholder="Buscar producto, SKU o codigo de barras" aria-label="Buscar producto" required /><datalist id="purchase-product-options">${ui.snapshot.products.map((product) => `<option value="${escapeHtml(product.name)}">${escapeHtml(product.sku || product.barcode || '')}</option>`).join('')}</datalist></div></label>
          <label>Comprobante<input type="text" name="documentNumber" value="${editingReceipt?.documentNumber || ''}" placeholder="FAC-000123" /></label>
          <label>Cantidad<input type="number" min="1" name="quantity" value="${editingReceipt?.quantity || ''}" required /></label>
          <label>Costo unitario<input type="number" min="0" name="unitCost" value="${editingReceipt?.unitCost || ''}" required /></label>
          <label class="full-span">Observaciones<input type="text" name="note" value="${editingReceipt?.note || ''}" placeholder="Pedido, lote o condicion" /></label>
          <button type="submit">${editingReceipt ? 'Guardar cambios' : 'Registrar compra'}</button>
          ${editingReceipt ? '<button type="button" class="danger-action" data-action="cancel-purchase-edit">Cancelar edicion</button>' : '<button type="button" class="ghost-action" data-action="close-purchase-form">Cancelar</button>'}
        </form>
      </article>` : ''}
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
        <div class="dual-actions">
          ${editingReceipt ? '' : createToggleButton('purchase', showPurchaseForm, 'Agregar compra')}
          ${createToggleButton('supplier', supplierFormOpen, 'Agregar proveedor')}
        </div>
        <div class="purchase-list-grid">
          <article class="panel">
            <div class="panel-head"><div><h3>Recepciones recientes</h3><p>Lo ultimo ingresado a stock</p></div></div>
            ${paginatedDataTable(['Proveedor', 'Producto', 'Cantidad', 'Costo', 'Accion'], ui.enrichedReceipts, 'recepciones', (receipt) => `<div class="data-row"><span>${receipt.supplierName}<br /><small>${receipt.documentNumber || 'Sin comprobante'}</small></span><span>${receipt.productName}${receipt.note ? `<br /><small>${receipt.note}</small>` : ''}</span><span>${receipt.quantity}</span><span>${money(receipt.totalCost)}</span><span>${purchaseActionButtons(receipt)}</span></div>`, 'is-stable purchases-receipts-table')}
          </article>
          <article class="panel">
            <div class="panel-head"><div><h3>${supplierQuery ? 'Resultados' : 'Ultimos 10 proveedores'}</h3><p>Busca y hace click para editar.</p></div></div>
            <div class="stock-adjustment-search"><span class="pos-search-icon" aria-hidden="true">${icon('<circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/>')}</span><input type="search" data-supplier-search value="${escapeHtml(supplierSearchQuery)}" placeholder="Buscar proveedor" aria-label="Buscar proveedor" /></div>
            <div class="timeline-list">${visibleSuppliers.map((supplier) => `<div class="timeline-item contact-result"><button type="button" class="contact-result-main" data-action="edit-supplier" data-id="${supplier.id}"><strong>${escapeHtml(supplier.name)}</strong><p>${escapeHtml(supplier.contact || supplier.phone || supplier.cuit || 'Sin datos de contacto')}</p><span>${escapeHtml(supplier.address || 'Sin direccion')} · ${balanceText(supplier.balance)} ${money(supplier.balance)}</span></button><span class="contact-result-actions">${actionButton('supplier', supplier.id)}</span></div>`).join('') || '<p class="empty-state">No hay proveedores para esta busqueda.</p>'}</div>
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
        ${dataTable(['Comprobante', 'Cliente', 'Sucursal', 'Total', 'Accion'], ui.enrichedInvoices.map((invoice) => `<div class="data-row" data-invoice-id="${invoice.id}"><span><strong>${invoice.number}</strong><br /><small>${invoiceEmissionLabel(invoice)} · ${invoice.branchName}</small></span><span>${invoice.customerName}<br /><small>${invoice.kind || 'Factura'} / ${invoice.fiscalStatus || 'Pendiente'}</small></span><span>${invoice.branchName}<br /><small>${invoice.status}</small></span><span>${money(invoice.totalAmount)}</span><span>${invoiceActionButtons(invoice)}</span></div>`), 'is-stable invoices-table')}
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
        ${dataTable(['Comprobante', 'Cliente', 'Sucursal', 'Total', 'Acciones'], ui.enrichedInvoices.map((invoice) => `<div class="data-row invoice-open-row" data-invoice-open="${invoice.id}" tabindex="0" role="button" aria-label="Abrir factura ${invoice.number}"><span><strong>${invoice.number}</strong><br /><small>${invoiceEmissionLabel(invoice)} · ${invoice.branchName}</small></span><span>${invoice.customerName}<br /><small>${invoice.kind || 'Factura'} / ${invoice.fiscalStatus || 'Pendiente'}</small></span><span>${invoice.branchName}<br /><small>${invoice.status}</small></span><span>${money(invoice.totalAmount)}<br /><small>Saldo: ${money(invoiceBalance(invoice))}</small></span><span>${invoiceActionButtons(invoice)}</span></div>`), 'invoices-table invoice-compact-table')}
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
          <label>Cliente<select name="customerId" required>${ui.snapshot.customers.map((customer) => `<option value="${customer.id}" ${editingTicket?.customerId === customer.id ? 'selected' : ''}>${customer.fullName}</option>`).join('')}</select></label>
          <label>Equipo<input type="text" name="device" value="${editingTicket?.device || ''}" required /></label>
          <label>Estado<select name="status"><option ${editingTicket?.status === 'Recibido' || !editingTicket ? 'selected' : ''}>Recibido</option><option ${editingTicket?.status === 'En curso' ? 'selected' : ''}>En curso</option><option ${editingTicket?.status === 'Esperando aprobacion' ? 'selected' : ''}>Esperando aprobacion</option><option ${editingTicket?.status === 'Listo para entregar' ? 'selected' : ''}>Listo para entregar</option></select></label>
          <label class="full-span">Detalle<input type="text" name="issue" value="${editingTicket?.issue || ''}" required /></label>
          <button type="submit">${editingTicket ? 'Guardar cambios' : 'Guardar ticket'}</button>
          ${editingTicket ? '<button type="button" class="danger-action" data-action="cancel-ticket-edit">Cancelar edicion</button>' : ''}
        </form>
      </article>
      <article class="panel"><div class="panel-head"><div><h3>Tickets activos</h3><p>Historial rapido</p></div></div>
        ${dataTable(['Ticket', 'Cliente', 'Sucursal', 'Actualizado', 'Accion'], ui.enrichedTickets.map((ticket) => `<div class="data-row"><span>${ticket.number}</span><span>${ticket.customerName}</span><span>${ticket.branchName}</span><span>${ticket.updatedAt}</span><span>${ticketActionButtons(ticket)}</span></div>`))}
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
        ${dataTable(['Ticket', 'Cliente', 'Sucursal', 'Actualizado', 'Accion'], ui.enrichedTickets.map((ticket) => `<div class="data-row"><span>${ticket.number}<br /><small>${ticket.device || 'Equipo sin detalle'}</small></span><span>${ticket.customerName}<br /><small>${ticket.status}</small></span><span>${ticket.branchName}</span><span>${ticket.updatedAt}</span><span>${ticketActionButtons(ticket)}</span></div>`), 'is-stable tickets-table')}
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
      <article class="panel"><div class="panel-head"><div><h3>Top productos</h3><p>Movimiento comercial filtrado</p></div></div><div class="top-list">${[...ui.reportScopedSales.reduce((map, sale) => { for (const item of sale.items) { const current = map.get(item.productId) || { name: ui.snapshot.products.find((product) => product.id === item.productId)?.name || 'Articulo', qty: 0 }; current.qty += item.quantity; map.set(item.productId, current) } return map }, new Map()).values()].sort((a, b) => b.qty - a.qty).slice(0, 5).map((item, index) => `<div class="top-row"><span>${index + 1}</span><div><strong>${item.name}</strong><p>${item.qty} unidades vendidas</p></div></div>`).join('') || '<p class="empty-state">Sin ventas en este rango.</p>'}</div></article>
      <article class="panel"><div class="panel-head"><div><h3>Balance rapido</h3><p>${ui.currentBranch?.name || 'Sucursal'}${reportRegisterFilter === 'all' ? '' : ` / ${ui.enrichedRegisters.find((register) => register.id === reportRegisterFilter)?.name || 'Caja'}`}</p></div><div class="settings-actions"><button type="button" class="primary-action" data-action="export-report">Exportar CSV</button></div></div><div class="priority-list">
        <div class="priority-item"><strong>Tickets</strong><p>${ui.reportScopedTickets.length}</p></div>
        <div class="priority-item"><strong>Compras</strong><p>${ui.reportScopedReceipts.length}</p></div>
        <div class="priority-item"><strong>Stock</strong><p>${ui.reportScopedStockMovements.length}</p></div>
      </div></article>
      <article class="panel"><div class="panel-head"><div><h3>Movimientos de stock</h3><p>Ingresos y egresos</p></div></div><div class="timeline-list">${byRecentDate(ui.reportScopedStockMovements, 'createdAt').slice(0, 6).map((movement) => `<div class="timeline-item ${movementDirectionClass(movement.quantity)}"><strong>${stockMovementTypeLabel(movement.type)}</strong><p>${movement.quantity} unidades</p><span>${movement.createdAt.slice(0, 16).replace('T', ' ')}</span></div>`).join('') || '<p class="empty-state">Sin movimientos de stock en este rango.</p>'}</div></article>
      <article class="panel"><div class="panel-head"><div><h3>Movimientos de caja</h3><p>Ingresos y egresos manuales</p></div></div><div class="timeline-list">${byRecentDate(ui.reportScopedCashMovements, 'createdAt').slice(0, 6).map((movement) => `<div class="timeline-item ${movementDirectionClass(movement.signedAmount)}"><strong>${cashMovementKindLabel(movement.kind)}</strong><p>${movement.note || 'Sin detalle'}</p><span>${money(movement.signedAmount)} / ${movement.createdAt.slice(0, 16).replace('T', ' ')}</span></div>`).join('') || '<p class="empty-state">Sin movimientos de caja en este rango.</p>'}</div></article>
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
  if (!platform) {
    return `
    <section class="view-section"><div class="section-header"><div><p class="kicker">Mi admin</p><h2>Panel PCLAF</h2></div></div>
      <article class="panel empty-panel">
        <h3>Consola global no disponible</h3>
        <p>No pude cargar el resumen de comercios todavia. Reintenta y vuelvo a consultar la base real.</p>
        <div class="settings-actions"><button type="button" class="primary-action" data-action="refresh-platform-admin">Actualizar</button></div>
      </article>
    </section>
    `
  }
  const summary = platform.summary || {}
  const allCommerces = Array.isArray(platform.commerces) ? platform.commerces : []
  const normalizedSearch = String(platformSearchQuery || '').trim().toLowerCase()
  const commerces = allCommerces.filter((entry) => {
    const matchesStatus = platformCommerceFilter === 'all'
      || (platformCommerceFilter === 'trial' ? entry.billingStatus === 'trial' : entry.status === platformCommerceFilter || entry.billingStatus === platformCommerceFilter)
    const matchesSupport = platformSupportFilter === 'all'
      || (platformSupportFilter === 'attention'
        ? ['pendiente', 'esperando'].includes(entry.supportStatus)
        : entry.supportStatus === platformSupportFilter)
    const matchesSearch = !normalizedSearch
      || entry.name.toLowerCase().includes(normalizedSearch)
      || entry.instanceKey.toLowerCase().includes(normalizedSearch)
      || entry.ownerEmail.toLowerCase().includes(normalizedSearch)
      || (entry.internalTag || '').toLowerCase().includes(normalizedSearch)
    return matchesStatus && matchesSupport && matchesSearch
  })
  const pendingSupport = allCommerces.filter((entry) => ['pendiente', 'esperando'].includes(entry.supportStatus)).length
  const blockedCommerces = allCommerces.filter((entry) => entry.status === 'blocked').length
  const publicOpenCommerces = allCommerces.filter((entry) => entry.allowPublicSignup).length
  if (!platformCommerceSelectedId || !commerces.some((entry) => entry.id === platformCommerceSelectedId)) {
    platformCommerceSelectedId = commerces[0]?.id || allCommerces[0]?.id || ''
  }
  const selectedCommerce = commerces.find((entry) => entry.id === platformCommerceSelectedId) || allCommerces.find((entry) => entry.id === platformCommerceSelectedId) || commerces[0] || allCommerces[0] || null
  const selectedUsers = Array.isArray(selectedCommerce?.users) ? selectedCommerce.users : []
  const selectedBranches = Array.isArray(selectedCommerce?.branches) ? selectedCommerce.branches : []
  const selectedRegisters = Array.isArray(selectedCommerce?.registers) ? selectedCommerce.registers : []
  const formatDate = (value) => value ? String(value).replace('T', ' ').slice(0, 16) : 'Sin dato'
  const supportStatusLabel = (value) => {
    if (value === 'activo') return 'Activo'
    if (value === 'seguimiento') return 'Seguimiento'
    if (value === 'esperando') return 'Esperando cliente'
    if (value === 'resuelto') return 'Resuelto'
    return 'Pendiente'
  }
  const billingLabel = (value) => {
    if (value === 'trial') return 'Prueba'
    if (value === 'active') return 'Activo'
    if (value === 'past_due') return 'Vencido'
    if (value === 'paused') return 'Pausado'
    if (value === 'cancelled') return 'Cancelado'
    return value || 'Sin dato'
  }
  const commerceLabel = (value) => {
    if (value === 'active') return 'Activo'
    if (value === 'paused') return 'Pausado'
    if (value === 'blocked') return 'Bloqueado'
    return value || 'Sin dato'
  }
  const trialLabel = (entry) => {
    if (!entry?.trialEndsAt) return 'Sin fecha'
    return String(entry.trialEndsAt).slice(0, 10)
  }
  return `
  <section class="view-section"><div class="section-header"><div><p class="kicker">Mi admin</p><h2>Panel PCLAF</h2></div></div>
    ${feedbackMessage ? `<div class="feedback-banner">${feedbackMessage}</div>` : ''}
    <section class="module-summary-grid">
      <article class="metric-card compact"><span>Comercios</span><strong>${summary.totalCommerces || 0}</strong><p>${summary.activeCommerces || 0} activos</p></article>
      <article class="metric-card compact"><span>Pruebas</span><strong>${summary.trialCommerces || 0}</strong><p>${summary.expiredCommerces || 0} vencidos</p></article>
      <article class="metric-card compact"><span>Estructura</span><strong>${summary.totalBranches || 0}</strong><p>${summary.totalRegisters || 0} cajas / ${summary.totalUsers || 0} usuarios</p></article>
      <article class="metric-card compact"><span>Soporte</span><strong>${pendingSupport}</strong><p>${blockedCommerces} bloqueados / ${publicOpenCommerces} altas abiertas</p></article>
    </section>
    <section class="module-board admin-board">
      <article class="panel module-side"><div class="panel-head"><div><h3>Estado general</h3><p>Resumen corto de la cuenta actual</p></div></div>
        <div class="priority-list">
          <div class="priority-item"><strong>Cuenta PCLAF</strong><p>${ui.user.fullName}<br /><small>${maskEmail(ui.user.email) || 'Sin email'}</small></p></div>
          <div class="priority-item"><strong>Activos</strong><p>${summary.activeCommerces || 0}<br /><small>${summary.pausedCommerces || 0} pausados</small></p></div>
          <div class="priority-item"><strong>Pruebas</strong><p>${summary.trialCommerces || 0}<br /><small>${summary.expiredCommerces || 0} para revisar</small></p></div>
          <div class="priority-item"><strong>Vista</strong><p>Global PCLAF<br /><small>Sin mezclar operacion diaria</small></p></div>
        </div>
        <div class="settings-actions"><button type="button" class="primary-action" data-action="refresh-platform-admin">Actualizar</button><button type="button" class="ghost-action" data-action="open-support">Soporte</button><button type="button" class="danger-action" data-action="sign-out">Cerrar sesion</button></div>
      </article>
      <div class="module-main">
        <article class="panel"><div class="panel-head"><div><h3>Seguimiento rapido</h3><p>Busca y filtra cuentas para operar mas rapido</p></div></div>
          <div class="form-grid compact-form">
            <label>Buscar comercio<input type="search" value="${platformSearchQuery}" data-platform-search placeholder="Nombre, codigo, email o etiqueta" /></label>
            <label>Estado<select data-platform-filter="status"><option value="all" ${platformCommerceFilter === 'all' ? 'selected' : ''}>Todos</option><option value="active" ${platformCommerceFilter === 'active' ? 'selected' : ''}>Activos</option><option value="trial" ${platformCommerceFilter === 'trial' ? 'selected' : ''}>Prueba</option><option value="paused" ${platformCommerceFilter === 'paused' ? 'selected' : ''}>Pausados</option><option value="blocked" ${platformCommerceFilter === 'blocked' ? 'selected' : ''}>Bloqueados</option><option value="past_due" ${platformCommerceFilter === 'past_due' ? 'selected' : ''}>Vencidos</option></select></label>
            <label>Soporte<select data-platform-filter="support"><option value="all" ${platformSupportFilter === 'all' ? 'selected' : ''}>Todos</option><option value="attention" ${platformSupportFilter === 'attention' ? 'selected' : ''}>Requiere atencion</option><option value="activo" ${platformSupportFilter === 'activo' ? 'selected' : ''}>Activo</option><option value="seguimiento" ${platformSupportFilter === 'seguimiento' ? 'selected' : ''}>Seguimiento</option><option value="esperando" ${platformSupportFilter === 'esperando' ? 'selected' : ''}>Esperando cliente</option><option value="resuelto" ${platformSupportFilter === 'resuelto' ? 'selected' : ''}>Resuelto</option></select></label>
          </div>
          <div class="chip-grid">
            <span class="module-chip ${platformCommerceFilter === 'all' ? 'is-active' : ''}" data-platform-chip="all">Todas ${allCommerces.length}</span>
            <span class="module-chip ${platformCommerceFilter === 'trial' ? 'is-active' : ''}" data-platform-chip="trial">Prueba ${summary.trialCommerces || 0}</span>
            <span class="module-chip ${platformCommerceFilter === 'blocked' ? 'is-active' : ''}" data-platform-chip="blocked">Bloqueadas ${blockedCommerces}</span>
            <span class="module-chip ${platformSupportFilter === 'attention' ? 'is-active' : ''}" data-platform-support-chip="attention">Pendientes ${pendingSupport}</span>
          </div>
        </article>
        <article class="panel"><div class="panel-head"><div><h3>Comercios creados</h3><p>Estado comercial y operativo sin entrar al negocio</p></div></div>
          ${dataTable(['Comercio', 'Pack', 'Soporte', 'Cobro', 'Prueba', 'Ultimo acceso', 'Gestion'], commerces.length ? commerces.map((entry) => `<div class="data-row ${entry.id === platformCommerceSelectedId ? 'is-selected' : ''}"><span><strong>${entry.name}</strong><br /><small>${entry.instanceKey}</small></span><span>${planLabels[entry.activePlan] || entry.activePlan}</span><span>${supportStatusLabel(entry.supportStatus)}<br /><small>${entry.supportOwner || 'Sin asignar'}</small></span><span>${billingLabel(entry.billingStatus)}</span><span>${trialLabel(entry)}</span><span>${entry.lastAccessAt ? formatDate(entry.lastAccessAt) : 'Nunca'}</span><span><button type="button" class="inline-action" data-platform-select="${entry.id}">Ver detalle</button></span></div>`) : [`<div class="data-row"><span>No hay comercios para este filtro.</span><span>-</span><span>-</span><span>-</span><span>-</span><span>-</span><span>-</span></div>`])}
        </article>
        ${selectedCommerce ? `<div class="compact-form-grid">
          <article class="panel"><div class="panel-head"><div><h3>Detalle del comercio</h3><p>Pack, estado, soporte y acceso publico</p></div></div>
            <form class="form-grid compact-form" data-form="platform-commerce">
              <input type="hidden" name="commerceId" value="${selectedCommerce.id}" />
              <label>Comercio<input type="text" value="${selectedCommerce.name}" disabled /></label>
              <label>Dueño<input type="email" value="${selectedCommerce.ownerEmail}" disabled /></label>
              <label>Pack<select name="activePlan"><option value="basic" ${selectedCommerce.activePlan === 'basic' ? 'selected' : ''}>Gestion base</option><option value="retail" ${selectedCommerce.activePlan === 'retail' ? 'selected' : ''}>Mostrador</option><option value="full" ${selectedCommerce.activePlan === 'full' ? 'selected' : ''}>Operacion</option><option value="multi" ${selectedCommerce.activePlan === 'multi' ? 'selected' : ''}>Multi sucursal</option><option value="custom" ${selectedCommerce.activePlan === 'custom' ? 'selected' : ''}>Personalizado</option></select></label>
              <label>Estado<select name="status"><option value="active" ${selectedCommerce.status === 'active' ? 'selected' : ''}>Activo</option><option value="paused" ${selectedCommerce.status === 'paused' ? 'selected' : ''}>Pausado</option><option value="blocked" ${selectedCommerce.status === 'blocked' ? 'selected' : ''}>Bloqueado</option></select></label>
              <label>Cobro<select name="billingStatus"><option value="trial" ${selectedCommerce.billingStatus === 'trial' ? 'selected' : ''}>Prueba</option><option value="active" ${selectedCommerce.billingStatus === 'active' ? 'selected' : ''}>Activo</option><option value="past_due" ${selectedCommerce.billingStatus === 'past_due' ? 'selected' : ''}>Vencido</option><option value="paused" ${selectedCommerce.billingStatus === 'paused' ? 'selected' : ''}>Pausado</option><option value="cancelled" ${selectedCommerce.billingStatus === 'cancelled' ? 'selected' : ''}>Cancelado</option></select></label>
              <label>Alta publica<select name="allowPublicSignup"><option value="true" ${selectedCommerce.allowPublicSignup ? 'selected' : ''}>Permitida</option><option value="false" ${!selectedCommerce.allowPublicSignup ? 'selected' : ''}>Cerrada</option></select></label>
              <label>Responsable PCLAF<input type="text" name="supportOwner" value="${selectedCommerce.supportOwner || ''}" placeholder="Quien sigue esta cuenta" /></label>
              <label>Seguimiento<select name="supportStatus"><option value="pendiente" ${selectedCommerce.supportStatus === 'pendiente' ? 'selected' : ''}>Pendiente</option><option value="activo" ${selectedCommerce.supportStatus === 'activo' ? 'selected' : ''}>Activo</option><option value="seguimiento" ${selectedCommerce.supportStatus === 'seguimiento' ? 'selected' : ''}>Seguimiento</option><option value="esperando" ${selectedCommerce.supportStatus === 'esperando' ? 'selected' : ''}>Esperando cliente</option><option value="resuelto" ${selectedCommerce.supportStatus === 'resuelto' ? 'selected' : ''}>Resuelto</option></select></label>
              <label>Etiqueta interna<input type="text" name="internalTag" value="${selectedCommerce.internalTag || ''}" placeholder="Kiosco, taller, demo, referido" /></label>
              <label class="full-span">Nota comercial<textarea name="commercialNote" rows="3" placeholder="Seguimiento, interes, propuesta o proximo paso">${selectedCommerce.commercialNote || ''}</textarea></label>
              <label class="full-span">Nota de cobro<textarea name="billingNote" rows="3" placeholder="Situacion de facturacion o cobro">${selectedCommerce.billingNote || ''}</textarea></label>
              <button type="submit">Guardar cambios</button>
            </form>
            <div class="panel-note"><span>Alta: ${formatDate(selectedCommerce.createdAt)}</span><span>Prueba hasta: ${selectedCommerce.trialEndsAt ? selectedCommerce.trialEndsAt.slice(0, 10) : 'Sin fecha'}</span></div>
          </article>
          <article class="panel"><div class="panel-head"><div><h3>Lectura ejecutiva</h3><p>Seguimiento comercial y tecnico</p></div></div>
            <div class="priority-list">
              <div class="priority-item"><strong>Instancia</strong><p>${selectedCommerce.instanceKey}</p></div>
              <div class="priority-item"><strong>Estado</strong><p>${commerceLabel(selectedCommerce.status)}<br /><small>${billingLabel(selectedCommerce.billingStatus)}</small></p></div>
              <div class="priority-item"><strong>Ultimo acceso</strong><p>${selectedCommerce.lastAccessAt ? formatDate(selectedCommerce.lastAccessAt) : 'Nunca'}</p></div>
              <div class="priority-item"><strong>Estructura</strong><p>${selectedCommerce.branchesCount} sucursales<br /><small>${selectedCommerce.registersCount} cajas / ${selectedCommerce.usersCount} usuarios</small></p></div>
              <div class="priority-item"><strong>Soporte</strong><p>${supportStatusLabel(selectedCommerce.supportStatus)}<br /><small>${selectedCommerce.supportOwner || 'Sin asignar'}</small></p></div>
              <div class="priority-item"><strong>Etiqueta</strong><p>${selectedCommerce.internalTag || 'Sin etiqueta'}</p></div>
            </div>
            <div class="chip-grid">${(selectedCommerce.enabledModules || []).map((moduleKey) => `<span class="module-chip is-active">${ui.moduleCatalog[moduleKey]?.name || moduleKey}</span>`).join('') || '<span class="module-chip">Sin modulos</span>'}</div>
            <div class="timeline-list compact-timeline">
              <div class="timeline-item"><strong>Nota comercial</strong><p>${selectedCommerce.commercialNote || 'Sin seguimiento comercial cargado.'}</p></div>
              <div class="timeline-item"><strong>Facturacion</strong><p>${selectedCommerce.billingNote || 'Sin nota de cobro cargada.'}</p></div>
            </div>
          </article>
        </div>` : ''}
        ${selectedCommerce ? `<div class="compact-form-grid">
          <article class="panel"><div class="panel-head"><div><h3>Usuarios del cliente</h3><p>Accesos y ultimo uso</p></div></div>
            ${dataTable(['Usuario', 'Perfil', 'Estado', 'Ultimo acceso'], selectedUsers.map((entry) => `<div class="data-row"><span>${entry.full_name || entry.fullName || 'Usuario'}<br /><small>${maskEmail(entry.email) || 'Sin email'}</small></span><span>${entry.is_owner ? 'Propietario' : (entry.role_key || entry.roleKey || 'Usuario')}</span><span>${entry.status === 'active' ? 'Activo' : 'Inactivo'}</span><span>${entry.last_login_at ? formatDate(entry.last_login_at) : 'Nunca'}</span></div>`))}
          </article>
          <article class="panel"><div class="panel-head"><div><h3>Sucursales y cajas</h3><p>Estructura ligada al comercio</p></div></div>
            ${dataTable(['Sucursal', 'Codigo', 'Cajas'], selectedBranches.map((entry) => `<div class="data-row"><span>${entry.name || 'Sucursal'}</span><span>${entry.code || '-'}</span><span>${selectedRegisters.filter((register) => register.branch_id === entry.id || register.branchId === entry.id).length}</span></div>`))}
          </article>
        </div>` : ''}
        <article class="panel"><div class="panel-head"><div><h3>Que controlas desde aca</h3><p>Tu consola de plataforma, no la operacion diaria del cliente</p></div></div>
          <div class="timeline-list">
            <div class="timeline-item"><strong>Prueba, activo o bloqueado</strong><p>Ves el estado comercial real de cada cuenta.</p><span>Puedes pausar altas publicas o cambiar pack sin entrar al negocio.</span></div>
            <div class="timeline-item"><strong>Detalle por cliente</strong><p>Dueño, fecha de alta, ultimo acceso, sucursales, cajas y usuarios.</p><span>Esto te sirve para soporte y seguimiento comercial.</span></div>
            <div class="timeline-item"><strong>Separado del admin del cliente</strong><p>La operacion diaria sigue dentro del comercio.</p><span>Mi admin queda reservado para el control general de PCLAF Control.</span></div>
          </div>
        </article>
      </div>
    </section>
  </section>
`
}

const settingsView = (ui) => settingsViewV2(ui)

const settingsViewV2 = (ui) => `
  ${(() => {
    const editingUser = ui.snapshot.users.find((entry) => entry.id === userEditingId)
    const canManageUsers = Boolean(ui.user?.isPlatformAdmin || ui.user?.isOwner || ui.role?.key === 'admin')
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
        <button type="button" class="settings-section-trigger ${settingsPanelOpen === 'users' ? 'is-active' : ''}" data-settings-panel="users" aria-expanded="${settingsPanelOpen === 'users' ? 'true' : 'false'}"><strong>Usuarios y permisos</strong><span>${ui.enrichedUsers.length} cuentas del negocio</span></button>
        <button type="button" class="settings-section-trigger ${settingsPanelOpen === 'modules' ? 'is-active' : ''}" data-settings-panel="modules" aria-expanded="${settingsPanelOpen === 'modules' ? 'true' : 'false'}"><strong>Plan y modulos</strong><span>${ui.snapshot.business.enabledModules.length} modulos activos</span></button>
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
      ${settingsPanelOpen === 'users' ? `<article class="panel settings-expand-panel" data-settings-content="users"><div class="panel-head"><div><h3>${editingUser ? 'Editar cuenta' : 'Usuarios del negocio'}</h3><p>Gestiona quienes pueden entrar y que rol tiene cada uno</p></div></div>
          ${!canManageUsers ? '<div class="info-strip"><strong>Solo lectura</strong><span>Necesitas entrar con la cuenta propietaria para editar permisos.</span></div>' : ''}
          <form class="form-grid" data-form="user">
            <input type="hidden" name="userId" value="${editingUser?.id || ''}" />
            <label>Nombre completo<input type="text" name="fullName" value="${editingUser?.fullName || ''}" ${canManageUsers ? 'required' : 'disabled'} /></label>
            <label>Email<input type="email" name="email" value="${editingUser?.email || ''}" placeholder="usuario@negocio.com" ${canManageUsers ? 'required' : 'disabled'} /></label>
            <label>Clave${editingUser ? ' nueva' : ''}<input type="password" name="pin" placeholder="${editingUser ? 'Solo si queres cambiarla' : 'Minimo 6 caracteres'}" ${editingUser ? (canManageUsers ? '' : 'disabled') : (canManageUsers ? 'required' : 'disabled')} /></label>
            <label>Rol<select name="roleId" ${canManageUsers ? 'required' : 'disabled'}>${ui.snapshot.roles.map((role) => `<option value="${role.id}" ${(editingUser ? editingUser.roleId : (userDraftRoleId || 'role-cashier')) === role.id ? 'selected' : ''}>${role.name}</option>`).join('')}</select></label>
            <label class="field-check full-span"><input type="checkbox" name="isActive" ${editingUser ? (editingUser.isActive ? 'checked' : '') : 'checked'} ${canManageUsers ? '' : 'disabled'} /><span class="field-check-box" aria-hidden="true"></span><span>Cuenta habilitada</span></label>
            ${renderUserScopeSelector(ui, editingUser, canManageUsers)}
            <button type="submit" ${canManageUsers ? '' : 'disabled'}>${editingUser ? 'Guardar permisos' : 'Crear usuario'}</button>
            ${editingUser ? '<button type="button" class="danger-action" data-action="cancel-user-edit">Cancelar edicion</button>' : ''}
          </form>
          ${dataTable(['Usuario', 'Perfil', 'Estado', 'Acceso', 'Gestion'], ui.enrichedUsers.map((entry) => `<div class="data-row"><span>${entry.fullName}${entry.isOwner ? ' <small>/ Propietario</small>' : ''}<br /><small>${entry.email || 'Sin email'}</small></span><span>${entry.roleName}</span><span>${entry.status === 'active' ? 'Activo' : entry.status === 'pending' ? 'Pendiente' : 'Deshabilitado'}</span><span>${entry.id === ui.user.id ? 'Sesion actual' : entry.isOwner ? 'Control total' : `${entry.moduleScopeCount} modulos / ${entry.blockedPermissionsCount} bloqueos`}</span><span>${userActionButtons(entry)}</span></div>`), 'is-stable settings-users-table')}
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
      ${settingsPanelOpen === 'arca' ? `<article class="panel settings-expand-panel" data-settings-content="arca"><div class="panel-head"><div><h3>${arcaConnected ? 'Facturacion ARCA activa' : 'Activar facturacion ARCA'}</h3><p>Configuracion guiada y segura para emitir comprobantes electronicos</p></div><span class="badge ${arcaConnected ? 'is-success' : 'is-warning'}">${arcaConnected ? 'Conexion activa' : 'Demo visual'}</span></div>
        <div class="info-strip ${arcaConnected ? 'is-success' : 'is-warning'}"><strong>${arcaConnected ? 'ARCA conectada y lista para facturar' : 'Configuracion fiscal pendiente'}</strong><span>${arcaConnected ? 'Certificado, WSAA y punto de venta validados. PCLAF puede emitir comprobantes con CAE.' : 'Los datos se envian al servicio fiscal privado de PCLAF. Tu Clave Fiscal nunca se solicita.'}</span></div>
        <div class="arca-steps" aria-label="Progreso de activacion">${['Datos fiscales', 'Certificado', 'Cuenta ARCA', 'Verificacion'].map((label, index) => `<span class="${arcaSetupStep === index + 1 ? 'is-active' : arcaSetupStep > index + 1 ? 'is-complete' : ''}"><i>${arcaSetupStep > index + 1 ? '✓' : index + 1}</i>${label}</span>`).join('')}</div>
        ${arcaSetupStep === 1 ? `<div class="arca-step-content"><div class="panel-head"><div><h3>Datos fiscales del comercio</h3><p>Se usan para crear el certificado y verificar el punto de venta.</p></div></div><div class="form-grid compact-form settings-wide-form"><label>CUIT<input name="arca-cuit" inputmode="numeric" value="${arcaFiscal.cuit}" placeholder="20-12345678-9" /></label><label class="full-span">Razon social<input name="arca-legal-name" value="${arcaFiscal.legalName || ui.snapshot.business.organization || ui.commerceContext?.legal_name || ui.commerceContext?.commerce_name || ''}" placeholder="Nombre fiscal del comercio" /></label><label>Punto de venta Web Services<input name="arca-point-sale" inputmode="numeric" value="${arcaFiscal.pointOfSale}" placeholder="Ej. 0002" /></label></div><div class="settings-actions"><button type="button" class="primary-action" data-action="arca-save-fiscal">Continuar con certificado</button></div></div>` : ''}
        ${arcaSetupStep === 2 ? `<div class="arca-step-content"><div class="panel-head"><div><h3>Certificado tecnico</h3><p>PCLAF genera y guarda la clave privada cifrada; solo descargás la solicitud CSR.</p></div></div><div class="timeline-list compact-timeline"><div class="timeline-item"><strong>Solicitud de certificado (CSR)</strong><p>${arcaCsrGenerated ? 'Lista para descargar y presentar en ARCA.' : 'Generala para asociarla al servicio de Facturacion Electronica.'}</p></div></div><div class="settings-actions">${arcaCsrGenerated ? '<button type="button" class="primary-action" data-action="arca-download-csr">Descargar solicitud CSR</button><button type="button" class="ghost-action" data-action="arca-next-step">Continuar a ARCA</button>' : '<button type="button" class="primary-action" data-action="arca-generate-csr">Generar solicitud de certificado</button>'}<button type="button" class="ghost-action" data-action="arca-previous-step">Volver</button></div></div>` : ''}
        ${arcaSetupStep === 3 ? `<div class="arca-step-content"><div class="panel-head"><div><h3>Completa la autorizacion en ARCA</h3><p>Este es el unico paso que debe realizar el titular o contador del comercio.</p></div></div><div class="timeline-list compact-timeline"><div class="timeline-item"><strong>1. Habilita el punto de venta</strong><p>Crea un punto de venta exclusivo para Web Services.</p></div><div class="timeline-item"><strong>2. Autoriza el certificado</strong><p>Asocialo al servicio Facturacion Electronica desde tu cuenta ARCA.</p></div><div class="timeline-item"><strong>3. Volve a PCLAF</strong><p>Subi el certificado emitido por ARCA. No subas claves ni compartas tu Clave Fiscal.</p></div></div><label class="arca-upload">Certificado de ARCA (.crt/.pem)<input type="file" accept=".crt,.cer,.pem" data-arca-certificate /><span>${arcaCertificateName || 'Seleccionar certificado'}</span></label><div class="settings-actions"><button type="button" class="primary-action" data-action="open-arca-guide">Abrir guia oficial de ARCA</button><button type="button" class="ghost-action" data-action="arca-next-step" ${arcaCertificateName ? '' : 'disabled'}>Continuar a verificacion</button><button type="button" class="ghost-action" data-action="arca-previous-step">Volver</button></div></div>` : ''}
        ${arcaSetupStep === 4 ? `<div class="arca-step-content"><div class="panel-head"><div><h3>Verificar y activar</h3><p>PCLAF comprueba certificado, WSAA y el punto de venta en homologacion.</p></div></div><div class="arca-verification ${arcaVerificationState}"><strong>${arcaVerificationState === 'verified' ? 'Conexion lista para facturar' : arcaVerificationState === 'checking' ? 'Verificando configuracion…' : 'Listo para verificar'}</strong><span>${arcaVerificationState === 'verified' ? 'La facturacion ARCA de homologacion esta activa.' : 'La verificacion consulta ARCA; no emite ninguna factura.'}</span></div><div class="settings-actions"><button type="button" class="primary-action ${arcaVerificationState === 'verified' ? 'is-success' : ''}" data-action="arca-verify">${arcaVerificationState === 'verified' ? 'Conexion ARCA activa' : 'Verificar y activar'}</button><button type="button" class="ghost-action" data-action="arca-previous-step">Volver</button></div></div>` : ''}
        <div class="panel-note"><strong>Activacion autoservicio</strong><span>Completa los cuatro pasos de esta pantalla. El soporte general de PCLAF queda disponible por separado en el menu Soporte.</span></div>
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
    case 'mi-admin': return ui.user?.isPlatformAdmin ? ownerAdminViewV2(ui) : settingsViewV2(ui)
    case 'ajustes': return canManageCommerceSettings ? settingsViewV2(ui) : basicSettingsView(ui)
    default: return dashboardView(ui)
  }
}

const renderApp = (ui) => {
  const allowedNav = getAllowedNav(ui)
  if (!allowedNav.some((item) => item.id === activeSection)) activeSection = allowedNav[0]?.id || 'dashboard'
  saveSection()
  const branchName = ui.currentBranch?.name || ui.snapshot.business.branch || 'Sucursal'
  const registerName = ui.currentRegister?.name || 'Sin caja asignada'
  const isDevEnvironment = ui.cloudConnection.environment === 'development'
  const environmentLabel = ui.cloudConnection.environmentLabel || 'Sandbox'
  const statusTitle = ui.openCashSession ? 'Abierta' : 'Cerrada'
  const statusHint = ui.branchRegisters.length > 1 ? registerName : ''
  const searchOptions = buildQuickSearchTargets(ui).slice(0, 40).map((item) => `<option value="${item.label}"></option>`).join('')
  const userName = ui.user?.fullName || 'Usuario'
  const userInitials = userName.split(/\s+/).filter(Boolean).slice(0, 2).map((chunk) => chunk[0]?.toUpperCase()).join('') || 'PC'
  const allAlertItems = [
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
          <img class="brand-logo" src="/pclaf-logo.png" alt="PCLAF" />
        </div>
        <nav class="sidebar-nav">${allowedNav.map((item) => `<button class="nav-square ${activeSection === item.id ? 'is-active' : ''}" type="button" data-section="${item.id}" title="${item.label}" aria-label="${item.label}"><span class="nav-icon">${item.icon}</span><span class="nav-label">${item.label}</span></button>`).join('')}</nav>
        <div class="sidebar-support"><div class="support-menu-wrap"><button class="nav-square support-square ${supportMenuOpen ? 'is-active' : ''}" type="button" data-action="toggle-support-menu" title="Soporte" aria-label="Abrir opciones de soporte" aria-expanded="${supportMenuOpen}"><span class="nav-icon">${icon('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8.5 9h7"/><path d="M8.5 13h4"/>')}</span><span class="nav-label">Soporte</span></button>${supportMenuOpen ? `<div class="support-menu" role="menu"><button type="button" data-action="open-arca-setup" role="menuitem"><strong>Facturacion ARCA</strong><span>Configura la conexion fiscal</span></button><button type="button" data-action="open-support" role="menuitem"><strong>Soporte general</strong><span>Habla con PCLAF por WhatsApp</span></button></div>` : ''}</div></div>
      </aside>
      <div class="workspace">
        <header class="topbar">
          <div class="topbar-left"><p class="kicker">Panel de control</p><h1>${ui.commerceContext?.commerce_name || productName}</h1><span>${branchName} · ${appVersion}</span></div>
          <div class="topbar-center">
            <form class="quick-search" data-form="topbar-jump">
              <span class="quick-search-icon" aria-hidden="true">${icon('<circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/>')}</span>
              <input type="search" name="query" value="${topbarSearch}" list="nav-search-options" placeholder="Buscar ventas, clientes, productos, stock, facturas o cajas" />
              <datalist id="nav-search-options">${searchOptions}</datalist>
            </form>
          </div>
          <div class="${topbarRightClass}">
            ${isDevEnvironment ? `<span class="topbar-runtime is-dev">${environmentLabel}</span>` : ''}
            <div class="account-alerts-wrap">
              <button class="account-card compact-meta ${accountAlertsOpen ? 'is-open' : ''}" type="button" data-action="toggle-account-alerts" aria-label="Abrir menu de cuenta" aria-expanded="${accountAlertsOpen ? 'true' : 'false'}">
                <span class="account-avatar">${userInitials}</span>
                <span class="account-copy"><strong>${userName}</strong><span>${ui.role?.name || 'Usuario'}</span></span>
                <span class="account-cash-state ${ui.openCashSession ? 'is-open' : 'is-closed'}"><span class="status-led" aria-hidden="true"></span><span>${statusTitle}</span></span>
                ${notificationCount ? `<span class="account-alert-count" aria-label="${notificationCount} alertas">${notificationCount}</span>` : ''}
                <span class="account-menu-chevron" aria-hidden="true">⌄</span>
              </button>
              ${accountAlertsOpen ? `<div class="account-alerts-popover">
                <div class="account-alerts-head">
                  <div><strong>${userName}</strong><span>${ui.role?.name || 'Usuario'}</span></div>
                  <button type="button" class="ghost-action account-alerts-link" data-action="open-account-panel">Mi cuenta</button>
                </div>
                <button type="button" class="account-cash-action ${ui.openCashSession ? 'is-open' : 'is-closed'}" data-section="caja" data-cash-operation>
                  <span class="status-led" aria-hidden="true"></span>
                  <span><strong>Caja ${statusTitle.toLowerCase()}</strong><small>${statusHint || (ui.openCashSession ? 'Lista para operar' : 'Abrir para cobrar en efectivo')}</small></span>
                  <span aria-hidden="true">›</span>
                </button>
                <div class="account-popover-label">Alertas</div>
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
        <main class="page">${renderCurrentView(ui)}</main>
      </div>
    </div>
  `
}

const render = () => {
  const ui = getUiState()
  app.innerHTML = ui.cloudConnection.required && !ui.cloudConnection.enabled
    ? cloudActivationView(ui)
    : (ui.isAuthenticated ? renderApp(ui) : loginView(ui))
  applyFieldGuidance()
  markBootComplete()
  bindEvents()
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
  const initialCloudConfig = await readSiteCloudConfig()
  window.__pclafTurnstileSiteKey = String(initialCloudConfig?.turnstileSiteKey || '')
  authViewMode = getRequestedPublicView() || (window.__pclafAppEntry ? 'login' : authViewMode)
  if (!window.pclafDesktop) {
    safeStorage.removeItem(dataStorageKey)
    safeStorage.removeItem(cloudConfigStorageKey)
    safeStorage.removeItem(instanceStorageKey)
    safeStorage.removeItem(themeStorageKey)
    safeStorage.removeItem(sectionStorageKey)
  }
  authInstanceKey = normalizeInstanceKey(
    safeStorage.getItem(instanceStorageKey, '')
    || initialCloudConfig?.instanceKey
    || 'pclaf-dev'
  )
  const storeOptions = {
    initialCloudConfig,
    requireCloud: !window.pclafDesktop,
  }
  store = createBrowserDataStore(storeOptions)
  authManager = initialCloudConfig?.url && initialCloudConfig?.anonKey
    ? createCloudAuthManager({ url: initialCloudConfig.url, anonKey: initialCloudConfig.anonKey, instanceKey: initialCloudConfig.instanceKey, turnstileSiteKey: initialCloudConfig.turnstileSiteKey })
    : null
  try {
    if (authManager) {
      recoveryState = await authManager.consumeRecoverySession()
      if (recoveryState) {
        authViewMode = 'login'
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
    loginMessage = error.message || 'No se pudo iniciar la sesion cloud.'
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
  </style></head><body><div class="ticket"><div class="brand"><h1>PCLAF</h1><p>${branch?.name || 'Sucursal'}<br />${branch?.address || ''}</p></div><div class="meta"><div><strong>Cliente:</strong> ${customer?.fullName || 'Mostrador'}</div><div><strong>Fecha:</strong> ${sale.soldAt.slice(0, 16).replace('T', ' ')}</div><div><strong>Canal:</strong> ${sale.channel}</div><div><strong>Pago:</strong> ${sale.paymentMethod}</div><div><strong>Caja:</strong> ${register?.name || 'Sin caja'}</div><div><strong>Venta:</strong> ${sale.id.slice(0, 8)}</div></div><table><thead><tr><th>Item</th><th>Cant.</th><th>Total</th></tr></thead><tbody>${sale.items.map((item) => { const product = ui.snapshot.products.find((entry) => entry.id === item.productId); return `<tr><td>${product?.name || 'Articulo'}</td><td>${item.quantity}</td><td>${money(item.lineTotal)}</td></tr>` }).join('')}</tbody></table><p class="total">TOTAL ${money(sale.totalAmount)}</p><p class="footer">Comprobante interno generado por PCLAF Control.</p></div></body></html>`
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
  const items = sale?.items?.length
    ? sale.items.map((item) => {
      const product = ui.snapshot.products.find((entry) => entry.id === item.productId)
      return `<tr><td>${escapeHtml(product?.name || 'Articulo')}</td><td>${escapeHtml(item.quantity)}</td><td>${money(item.unitPrice)}</td><td>${money(item.lineTotal)}</td></tr>`
    }).join('')
    : `<tr><td>${escapeHtml(invoice.kind || 'Factura')} ${escapeHtml(invoice.number)}</td><td>1</td><td>${money(invoice.totalAmount)}</td><td>${money(invoice.totalAmount)}</td></tr>`
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8" /><title>Factura ${escapeHtml(invoice.number)}</title><style>
    *{box-sizing:border-box} body{font-family:Arial,sans-serif;background:#f5f5f5;color:#172033;margin:0;padding:32px}
    .invoice{max-width:800px;margin:0 auto;background:#fff;border:1px solid #d7dce5;padding:46px 52px;min-height:1000px}
    .header{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #172033;padding-bottom:24px}.brand h1{margin:0;font-size:28px}.brand p,.meta,.muted{color:#536071;font-size:13px;line-height:1.5}.doc-type{text-align:right}.doc-type strong{display:block;font-size:24px}.doc-type span{font-size:14px}
    .parties{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin:30px 0}.party{border:1px solid #d7dce5;padding:16px}.party h2{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#536071;margin:0 0 10px}.party strong{display:block;font-size:16px;margin-bottom:5px}
    table{width:100%;border-collapse:collapse;margin-top:24px}th{background:#172033;color:#fff;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.05em;padding:11px}td{border-bottom:1px solid #d7dce5;padding:12px 11px;font-size:14px}th:nth-child(n+2),td:nth-child(n+2){text-align:right}.totals{margin-left:auto;width:310px;margin-top:26px;border-top:2px solid #172033;padding-top:10px}.totals div{display:flex;justify-content:space-between;padding:5px 0;font-size:15px}.totals .grand{font-size:22px;font-weight:800;border-top:1px solid #d7dce5;margin-top:5px;padding-top:10px}.totals .due{color:#9b2c2c;font-weight:700}.footer{border-top:1px solid #d7dce5;margin-top:48px;padding-top:16px;font-size:12px;color:#536071}@media print{body{background:#fff;padding:0}.invoice{border:0;max-width:none;min-height:0;padding:18mm 16mm}}
  </style></head><body><main class="invoice"><header class="header"><div class="brand"><h1>PCLAF Control</h1><p>${escapeHtml(branch?.name || 'Sucursal')}<br />${escapeHtml(branch?.address || '')}</p></div><div class="doc-type"><strong>${escapeHtml(invoice.kind || 'Factura')}</strong><span>${escapeHtml(invoice.type || 'B')} · N° ${escapeHtml(invoice.number)}</span><div class="meta">Emision: ${escapeHtml(issuedAt)}</div></div></header><section class="parties"><div class="party"><h2>Cliente</h2><strong>${escapeHtml(customer?.fullName || 'Consumidor final')}</strong><span class="muted">Comprobante ${escapeHtml(invoice.status || 'Emitida')}</span></div><div class="party"><h2>Datos fiscales</h2><strong>${escapeHtml(invoice.fiscalStatus || 'Pendiente')}</strong><span class="muted">Vencimiento: ${escapeHtml(String(invoice.dueDate || issuedAt).slice(0, 10))}</span></div></section><table><thead><tr><th>Descripcion</th><th>Cant.</th><th>Precio unit.</th><th>Importe</th></tr></thead><tbody>${items}</tbody></table><div class="totals"><div><span>Total factura</span><strong>${money(invoice.totalAmount)}</strong></div><div><span>Cobrado</span><strong>${money(amountPaid)}</strong></div><div class="grand ${balanceDue ? 'due' : ''}"><span>${balanceDue ? 'Saldo pendiente' : 'Saldo'}</span><span>${money(balanceDue)}</span></div></div><footer class="footer">Comprobante generado por PCLAF Control · ${escapeHtml(invoice.number)}</footer></main></body></html>`
  return { html, title: `${invoice.kind || 'Factura'} ${invoice.number}` }
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
  if (window.pclafDesktop?.exportPdf) {
    const result = await window.pclafDesktop.exportPdf({ html: doc.html, filename: doc.filename, pageSize: 'A4' })
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
  </style></head><body><div class="ticket"><div class="brand"><h1>PCLAF Control</h1><p>${escapeHtml(branch?.name || 'Sucursal')}<br />${escapeHtml(branch?.address || '')}</p></div><div class="meta"><div class="meta-row"><span>Cliente</span><span>${escapeHtml(customer?.fullName || 'Mostrador')}</span></div><div class="meta-row"><span>Fecha</span><span>${escapeHtml(sale.soldAt.slice(0, 16).replace('T', ' '))}</span></div><div class="meta-row"><span>Canal</span><span>${escapeHtml(sale.channel)}</span></div><div class="meta-row"><span>Pago</span><span>${escapeHtml(sale.paymentMethod)}</span></div><div class="meta-row"><span>Caja</span><span>${escapeHtml(register?.name || 'Sin caja')}</span></div><div class="meta-row"><span>Operacion</span><span>${escapeHtml(sale.id.slice(0, 8).toUpperCase())}</span></div></div><table class="items"><thead><tr><th>Item</th><th>Cant</th><th>Unit</th><th>Total</th></tr></thead><tbody>${lines}</tbody></table><div class="totals"><div class="totals-row"><span>Subtotal</span><span>${money(sale.subtotalAmount || sale.totalAmount)}</span></div>${sale.discountAmount ? `<div class="totals-row"><span>Descuento</span><span>- ${money(sale.discountAmount)}</span></div>` : ''}<div class="totals-row"><span>Cobrado</span><span>${money(sale.amountPaid || 0)}</span></div><div class="totals-row grand"><span>TOTAL</span><span>${money(sale.totalAmount)}</span></div></div><div class="footer"><p>Comprobante interno ${pageSize}<br />Generado por PCLAF Control</p></div></div></body></html>`
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
  if (window.pclafDesktop?.exportPdf) {
    const result = await window.pclafDesktop.exportPdf({ html: doc.html, filename: doc.filename, pageSize: 'A4' })
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
  if (!window.pclafDesktop) {
    feedbackMessage = 'La web publica ya no exporta ni restaura snapshots locales.'
    render()
    return
  }
  const blob = new Blob([JSON.stringify(store.exportData(), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `pclaf-control-backup-${today}.json`
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
  const formData = new FormData(form, event.submitter)
  const kind = form.dataset.form

  if (kind === 'login') {
    loginMessage = ''
    signupMessage = ''
    feedbackMessage = ''
    try {
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
      feedbackMessage = result.message || 'Clave actualizada correctamente.'
      loginMessage = ''
      requestScrollTop()
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
      activeSection = 'dashboard'
      saveSection()
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
        email: String(formData.get('email') || '').trim(),
        pin: String(formData.get('pin') || ''),
        isActive: formData.get('isActive') === 'on',
        allowedModules: formData.getAll('allowedModules'),
        blockedPermissions: formData.getAll('blockedPermissions'),
      })
      : await store.createUser({
        fullName: String(formData.get('fullName') || '').trim(),
        roleId: formData.get('roleId'),
        email: String(formData.get('email') || '').trim(),
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
    productFormOpen = false
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
    const result = formData.get('ticketId')
      ? await store.updateTicket(formData.get('ticketId'), { number: formData.get('number'), customerId: formData.get('customerId'), device: formData.get('device'), issue: formData.get('issue'), status: formData.get('status'), branchId: currentBranchId })
      : await store.createTicket({ number: formData.get('number'), customerId: formData.get('customerId'), device: formData.get('device'), issue: formData.get('issue'), status: formData.get('status'), branchId: currentBranchId })
    feedbackMessage = result.message || ''
    ticketEditingId = ''
    ticketFormOpen = false
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
      ? await store.updatePurchaseReceipt(formData.get('receiptId'), { supplierId: formData.get('supplierId'), productId: product.id, documentNumber: formData.get('documentNumber'), quantity: formData.get('quantity'), unitCost: formData.get('unitCost'), note: formData.get('note') })
      : await store.createPurchaseReceipt({ supplierId: formData.get('supplierId'), productId: product.id, documentNumber: formData.get('documentNumber'), quantity: formData.get('quantity'), unitCost: formData.get('unitCost'), note: formData.get('note') })
    feedbackMessage = result.message || (result.ok ? 'Recepcion registrada y stock actualizado.' : '')
    purchaseEditingId = ''
    purchaseFormOpen = false
  }
  if (kind === 'sale') {
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
    const payload = { customerId: formData.get('customerId'), channel: formData.get('channel'), paymentMethod, isPaid, autoInvoice: formData.get('autoInvoice') === 'on', discountAmount: formData.get('discountAmount'), amountPaid: formData.get('amountPaid'), cashAmount: formData.get('cashAmount'), transferAmount: formData.get('transferAmount'), mercadoPagoAmount: formData.get('mercadoPagoAmount'), echeqAmount: formData.get('echeqAmount'), echeqDetails: { number: formData.get('echeqNumber') }, accountAmount: formData.get('accountAmount'), note: formData.get('note'), items }
    const result = formData.get('saleId')
      ? await store.updateSale(formData.get('saleId'), payload)
      : await store.createSale(payload)
    feedbackMessage = result.message || ''
    saleEditingId = ''
    saleDraftQuantities = {}
    saleQuickAddCode = ''
    saleCustomerSearchQuery = ''
    saleFormOpen = false
  }

  form.reset()
  } catch (error) {
    feedbackMessage = mapPublicAuthError(error?.message || 'No se pudo completar la accion.', kind === 'instance-setup' ? 'signup' : 'login')
  }
  render()
}

const bindEvents = () => {
  const scrollToAuthBlock = (selector) => {
    const element = document.querySelector(selector)
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  bindHardwareScanner()
  for (const form of document.querySelectorAll('form[data-form]')) form.addEventListener('submit', handleSubmit)
  const updateSaleTotals = () => {
    let subtotal = 0
    for (const input of document.querySelectorAll('input[name^="qty_"]')) {
      const quantity = Math.max(0, Number(input.value || 0))
      const price = Math.max(0, Number(input.dataset.salePrice || 0))
      subtotal += quantity * price
      const lineTotal = input.closest('.cart-line')?.querySelector('.cart-line-total')
      if (lineTotal) lineTotal.textContent = money(quantity * price)
    }
    const discount = Math.max(0, Number(document.querySelector('input[name="discountAmount"]')?.value || 0))
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
  const saleDiscountInput = document.querySelector('input[name="discountAmount"]')
  if (saleDiscountInput) saleDiscountInput.addEventListener('input', updateSaleTotals)
  const quickAddInput = document.querySelector('input[name="quickAddCode"]')
  const runQuickAdd = () => {
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
    feedbackMessage = `${product.name} agregado a la venta.`
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
    // En PC conservamos la posicion para que cambiar de modulo no obligue
    // a volver a recorrer toda la pantalla. En mobile mantenemos el salto
    // arriba, que facilita empezar cada vista desde su encabezado.
    if (window.matchMedia('(max-width: 880px)').matches) requestScrollTop()
    render()
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
    if (window.__pclafAppEntry) {
      window.location.href = '/'
      return
    }
    authViewMode = 'landing'
    loginMessage = ''
    signupMessage = ''
    requestScrollTop()
    render()
  })
  for (const button of document.querySelectorAll('[data-platform-select]')) button.addEventListener('click', () => {
    platformCommerceSelectedId = button.dataset.platformSelect || ''
    requestScrollTop()
    render()
  })
  for (const button of document.querySelectorAll('[data-action="refresh-platform-admin"]')) button.addEventListener('click', async () => {
    try {
      await store.refreshPlatformAdminData()
      feedbackMessage = 'Panel PCLAF actualizado.'
    } catch (error) {
      feedbackMessage = humanizeError(error)
    }
    render()
  })
  for (const input of document.querySelectorAll('[data-platform-search]')) input.addEventListener('input', () => {
    platformSearchQuery = input.value || ''
    render()
  })
  for (const select of document.querySelectorAll('[data-platform-filter]')) select.addEventListener('change', () => {
    if (select.dataset.platformFilter === 'status') platformCommerceFilter = select.value || 'all'
    if (select.dataset.platformFilter === 'support') platformSupportFilter = select.value || 'all'
    render()
  })
  for (const chip of document.querySelectorAll('[data-platform-chip]')) chip.addEventListener('click', () => {
    platformCommerceFilter = chip.dataset.platformChip || 'all'
    render()
  })
  for (const chip of document.querySelectorAll('[data-platform-support-chip]')) chip.addEventListener('click', () => {
    platformSupportFilter = chip.dataset.platformSupportChip || 'all'
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
  for (const input of document.querySelectorAll('[data-customer-search]')) input.addEventListener('input', () => { customerSearchQuery = input.value; render() })
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
    cashFormOpen = true
    render()
  })
  for (const button of document.querySelectorAll('[data-action="close-cash-form"]')) button.addEventListener('click', () => {
    cashFormOpen = false
    render()
  })
  for (const button of document.querySelectorAll('[data-action="open-product-form"]')) button.addEventListener('click', () => {
    closeProductUtilityForms()
    productFormOpen = true
    queueScrollToSelector('form[data-form="product"]')
    render()
  })
  for (const button of document.querySelectorAll('[data-action="close-product-form"]')) button.addEventListener('click', () => {
    productFormOpen = false
    render()
  })
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
  for (const input of document.querySelectorAll('[data-supplier-search]')) input.addEventListener('input', () => { supplierSearchQuery = input.value; render() })
  for (const button of document.querySelectorAll('[data-action="edit-supplier"]')) button.addEventListener('click', () => { supplierEditingId = button.dataset.id || ''; supplierFormOpen = true; queueScrollToSelector('form[data-form="supplier"]'); render() })
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
        feedbackMessage = 'Comprobante listo para imprimir.'
        render()
        return
      }
      if (button.dataset.saleAction === 'receipt-80') {
        printThermalReceipt(button.dataset.id, '80')
        feedbackMessage = 'Ticket 80 mm listo para imprimir.'
        render()
        return
      }
      if (button.dataset.saleAction === 'receipt-58') {
        printThermalReceipt(button.dataset.id, '58')
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
      if (!event.target.closest('button, a, input, select, textarea, label')) openInvoice()
    })
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openInvoice() }
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
    render()
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
    store.signOut()
    store.clearCloudAuthSession()
    commerceContext = null
    authViewMode = (window.__pclafAppEntry || isStandaloneAppRoute()) ? 'login' : 'landing'
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
          redirectTo: `${getPublicAppBaseUrl()}${window.location.pathname}?auth_action=recover`,
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
    anchor.download = 'pclaf-arca-solicitud.csr'
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
bootstrap()


