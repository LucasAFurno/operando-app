import { createSupabaseCoreAdapter } from './cloud-core.js?v=__PCLAF_ASSET_VERSION__'

const dataStorageKey = 'pclaf-control-data'
const cloudConfigStorageKey = 'pclaf-control-cloud-config'
const defaultCloudUrl = 'https://rfwsnqmjkclxhbmidbkm.supabase.co'
const canPersistInBrowser = Boolean(globalThis.window?.pclafDesktop?.isDesktop)

const fallbackId = () => `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
const makeId = () => {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  } catch {
    // Fallback for browsers or webviews without crypto.randomUUID
  }
  return fallbackId()
}
const makeOperationId = () => {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  } catch {
    // The fallback below keeps the UUID shape required by the cloud RPC.
  }
  const randomHex = () => Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0')
  return `${randomHex()}-${randomHex().slice(0, 4)}-4${randomHex().slice(0, 3)}-8${randomHex().slice(0, 3)}-${randomHex()}${randomHex().slice(0, 4)}`
}
const todayIso = () => new Date().toISOString()
const todayDate = () => todayIso().slice(0, 10)
const contactDetailsFromNotes = (value) => {
  try {
    const parsed = JSON.parse(String(value || ''))
    if (parsed?.pclafContact) return { address: String(parsed.pclafContact.address || ''), cuit: String(parsed.pclafContact.cuit || ''), notes: String(parsed.notes || '') }
  } catch {}
  return { address: '', cuit: '', notes: String(value || '') }
}
const contactDetailsNotes = ({ address, cuit, notes }) => JSON.stringify({ pclafContact: { address: String(address || '').trim(), cuit: String(cuit || '').trim() }, notes: String(notes || '').trim() })
const customerDetailsFromTag = (value) => {
  try {
    const parsed = JSON.parse(String(value || ''))
    if (parsed?.pclafCustomer) return { tag: String(parsed.pclafCustomer.tag || ''), address: String(parsed.pclafCustomer.address || ''), cuit: String(parsed.pclafCustomer.cuit || '') }
  } catch {}
  return { tag: String(value || 'Cliente'), address: '', cuit: '' }
}
const customerDetailsTag = ({ tag, address, cuit }) => JSON.stringify({ pclafCustomer: { tag: String(tag || '').trim(), address: String(address || '').trim(), cuit: String(cuit || '').trim() } })
const pinHashVersion = 'sha256-v1'
const clone = (value) => {
  if (typeof globalThis.structuredClone === 'function') return globalThis.structuredClone(value)
  return JSON.parse(JSON.stringify(value))
}
const encoder = typeof globalThis.TextEncoder === 'function' ? new globalThis.TextEncoder() : null
const toHex = (buffer) => Array.from(new Uint8Array(buffer)).map((value) => value.toString(16).padStart(2, '0')).join('')
const createPinSalt = () => {
  try {
    const bytes = new Uint8Array(16)
    globalThis.crypto?.getRandomValues?.(bytes)
    return Array.from(bytes).map((value) => value.toString(16).padStart(2, '0')).join('')
  } catch {
    return fallbackId().replace(/[^a-z0-9]/gi, '').slice(0, 32)
  }
}
const hashPin = async (pin, salt) => {
  if (!encoder || !globalThis.crypto?.subtle) throw new Error('crypto_not_available')
  const value = encoder.encode(`${String(pin || '')}:${String(salt || '')}`)
  return toHex(await globalThis.crypto.subtle.digest('SHA-256', value))
}
const verifyHashedPin = async (user, pin) => {
  if (!user?.pinHash || !user?.pinSalt) return false
  return user.pinHash === await hashPin(pin, user.pinSalt)
}
const migrateUserPinSecurity = async (user) => {
  if (!user) return false
  if (user.pinHash && user.pinSalt) return false
  if (!user.pin) return false
  const salt = createPinSalt()
  user.pinHash = await hashPin(user.pin, salt)
  user.pinSalt = salt
  user.pinHashVersion = pinHashVersion
  user.pin = ''
  return true
}
const buildSecuredPinFields = async (pin) => {
  const salt = createPinSalt()
  return {
    pin: '',
    pinHash: await hashPin(pin, salt),
    pinSalt: salt,
    pinHashVersion,
  }
}
const safeStorage = {
  getItem(key) {
    if (!canPersistInBrowser) return null
    try {
      return globalThis.localStorage?.getItem(key) ?? null
    } catch {
      return null
    }
  },
  setItem(key, value) {
    if (!canPersistInBrowser) return false
    try {
      globalThis.localStorage?.setItem(key, value)
      return true
    } catch {
      return false
    }
  },
  removeItem(key) {
    if (!canPersistInBrowser) return false
    try {
      globalThis.localStorage?.removeItem(key)
      return true
    } catch {
      return false
    }
  },
}

const permissionCatalog = {
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

const actionPermissions = {
  customersWrite: 'customers:write',
  salesWrite: 'sales:write',
  cashOperate: 'cash:operate',
  branchesManage: 'branches:manage',
  registersManage: 'registers:manage',
  productsWrite: 'products:write',
  productsAdjust: 'products:adjust',
  productsTransfer: 'products:transfer',
  purchasesWrite: 'purchases:write',
  invoicesWrite: 'invoices:write',
  ticketsWrite: 'tickets:write',
  reportsExport: 'reports:export',
  settingsManage: 'settings:manage',
}

const moduleCatalog = {
  dashboard: { key: 'dashboard', name: 'Inicio', description: 'Resumen operativo principal' },
  customers: { key: 'customers', name: 'Clientes', description: 'Base de clientes y cuentas corrientes' },
  sales: { key: 'sales', name: 'Ventas', description: 'Ventas y cobros comerciales' },
  cash: { key: 'cash', name: 'Caja', description: 'Apertura, cierre y arqueo' },
  branches: { key: 'branches', name: 'Sucursales', description: 'Locales y numeracion' },
  registers: { key: 'registers', name: 'Cajas', description: 'Puestos de cobro y cajeros' },
  products: { key: 'products', name: 'Productos', description: 'Catalogo y stock' },
  purchases: { key: 'purchases', name: 'Compras', description: 'Proveedores y reposicion' },
  invoices: { key: 'invoices', name: 'Facturacion', description: 'Comprobantes y numeracion' },
  tickets: { key: 'tickets', name: 'Tickets', description: 'Seguimiento postventa o tecnico' },
  reports: { key: 'reports', name: 'Reportes', description: 'Reportes y exportes' },
  audit: { key: 'audit', name: 'Auditoría', description: 'Trazabilidad de operaciones y cambios' },
  settings: { key: 'settings', name: 'Ajustes', description: 'Configuracion del sistema' },
}

const modulePresets = {
  basic: ['dashboard', 'products', 'purchases', 'invoices', 'audit', 'settings'],
  retail: ['dashboard', 'customers', 'sales', 'cash', 'products', 'invoices', 'audit', 'settings'],
  full: ['dashboard', 'customers', 'sales', 'cash', 'products', 'purchases', 'invoices', 'reports', 'audit', 'settings'],
  multi: Object.keys(moduleCatalog),
}

const roles = [
  { id: 'role-admin', key: 'admin', name: 'Administrador', permissions: [...Object.values(permissionCatalog), ...Object.values(actionPermissions)] },
  {
    id: 'role-cashier',
    key: 'cashier',
    name: 'Caja',
    permissions: [
      permissionCatalog.dashboard,
      permissionCatalog.customers,
      permissionCatalog.sales,
      permissionCatalog.cash,
      permissionCatalog.invoices,
      permissionCatalog.reports,
      actionPermissions.customersWrite,
      actionPermissions.salesWrite,
      actionPermissions.cashOperate,
      actionPermissions.invoicesWrite,
    ],
  },
  {
    id: 'role-warehouse',
    key: 'warehouse',
    name: 'Deposito',
    permissions: [
      permissionCatalog.dashboard,
      permissionCatalog.customers,
      permissionCatalog.products,
      permissionCatalog.purchases,
      permissionCatalog.tickets,
      permissionCatalog.reports,
      actionPermissions.customersWrite,
      actionPermissions.productsWrite,
      actionPermissions.productsAdjust,
      actionPermissions.productsTransfer,
      actionPermissions.purchasesWrite,
      actionPermissions.ticketsWrite,
    ],
  },
]

const roleIds = Object.fromEntries(roles.map((role) => [role.key, role.id]))
const roleKeysById = Object.fromEntries(roles.map((role) => [role.id, role.key]))
const validModuleKeys = new Set(Object.keys(moduleCatalog))
const validPermissionKeys = new Set([...Object.values(permissionCatalog), ...Object.values(actionPermissions)])
const normalizeStringList = (value, allowedSet) => {
  if (!Array.isArray(value)) return []
  return [...new Set(value
    .map((entry) => String(entry || '').trim())
    .filter((entry) => entry && (!allowedSet || allowedSet.has(entry))))]
}
const inferRolePermissions = (roleId) => roles.find((role) => role.id === roleId)?.permissions || []
const inferUserPermissionSet = (entry) => {
  const basePermissions = inferRolePermissions(entry?.roleId)
  const blocked = new Set(normalizeStringList(entry?.blockedPermissions, validPermissionKeys))
  const permissions = basePermissions.filter((permission) => !blocked.has(permission))
  const roleKey = roleKeysById[entry?.roleId]
  if (!permissions.includes(permissionCatalog.audit)) permissions.push(permissionCatalog.audit)
  if (entry?.isPlatformAdmin || entry?.isOwner || roleKey === 'admin') {
    if (!permissions.includes(permissionCatalog.dashboard)) permissions.push(permissionCatalog.dashboard)
    if (!permissions.includes(permissionCatalog.audit)) permissions.push(permissionCatalog.audit)
    if (!permissions.includes(permissionCatalog.settings)) permissions.push(permissionCatalog.settings)
  }
  return permissions
}
const inferUserModules = (entry, enabledModules = []) => {
  const availableModules = Array.isArray(enabledModules) ? enabledModules.filter((moduleKey) => validModuleKeys.has(moduleKey)) : []
  const overrides = normalizeStringList(entry?.allowedModules, validModuleKeys)
  const roleKey = roleKeysById[entry?.roleId]
  const isAdministrator = Boolean(entry?.isPlatformAdmin || entry?.isOwner || roleKey === 'admin')
  const scopedModules = overrides.length
    ? availableModules.filter((moduleKey) => overrides.includes(moduleKey))
    : [...availableModules]
  if (!scopedModules.includes('audit')) scopedModules.push('audit')
  if (!isAdministrator) return scopedModules.filter((moduleKey) => moduleKey !== 'settings')
  if (!scopedModules.includes('dashboard')) scopedModules.unshift('dashboard')
  if (!scopedModules.includes('audit')) scopedModules.push('audit')
  if (!scopedModules.includes('settings')) scopedModules.push('settings')
  return scopedModules
}

const seedData = {
  meta: {
    schemaVersion: 4,
    edition: 'desktop-local',
    adapter: 'desktop-local',
    syncStatus: 'offline',
    lastSyncedAt: '',
    instanceKey: 'desktop-local',
  },
  business: {
    name: 'Panel comercial',
    organization: 'Demo local',
    currentBranchId: '',
    currentRegisterId: '',
    enabledModules: modulePresets.full,
    activePlan: 'full',
    documentCounters: {
      invoiceA: 1,
      invoiceB: 184,
      invoiceC: 1,
      quote: 28,
      remito: 14,
      creditNoteA: 1,
      creditNoteB: 7,
      creditNoteC: 1,
      receipt: 354,
      ticket: 1002,
    },
  },
  branches: [
    { id: makeId(), name: 'Sucursal demo', code: 'SUC', address: 'Configuracion local', isActive: true },
    { id: makeId(), name: 'Deposito demo', code: 'DEP', address: 'Configuracion local', isActive: true },
  ],
  registers: [],
  roles,
  users: [
    { id: makeId(), fullName: 'Administrador demo', roleId: roleIds.admin, email: 'admin@demo.local', pin: 'demo1234', isActive: true, allowedModules: [], blockedPermissions: [] },
    { id: makeId(), fullName: 'Caja demo', roleId: roleIds.cashier, email: 'caja@demo.local', pin: 'demo1111', isActive: true, allowedModules: [], blockedPermissions: [] },
    { id: makeId(), fullName: 'Deposito demo', roleId: roleIds.warehouse, email: 'deposito@demo.local', pin: 'demo2222', isActive: true, allowedModules: [], blockedPermissions: [] },
  ],
  session: {
    userId: '',
    authenticated: false,
  },
  customers: [
    { id: makeId(), fullName: 'Juan Lopez', phone: '11 4012 2231', email: 'juan@mail.com', balance: 47000, tag: 'Frecuente' },
    { id: makeId(), fullName: 'Empresa Delta', phone: '11 5555 3300', email: 'compras@delta.com', balance: 128000, tag: 'Cuenta corriente' },
    { id: makeId(), fullName: 'Marina Diaz', phone: '11 4120 8899', email: 'marina@mail.com', balance: 0, tag: 'Mostrador' },
  ],
  products: [
    { id: makeId(), name: 'SSD Kingston 480GB', sku: 'SSD-480', barcode: '7790010010011', stock: 12, salePrice: 64000, costPrice: 47000, minStock: 4, category: 'Hardware', trackStock: true },
    { id: makeId(), name: 'Pasta termica MX-4', sku: 'PT-MX4', barcode: '7790010010012', stock: 18, salePrice: 12500, costPrice: 7800, minStock: 6, category: 'Insumos', trackStock: true },
    { id: makeId(), name: 'Fuente 500W generica', sku: 'FU-500', barcode: '7790010010013', stock: 3, salePrice: 47000, costPrice: 32100, minStock: 5, category: 'Hardware', trackStock: true },
    { id: makeId(), name: 'Limpieza completa notebook', sku: 'SERV-LIM', barcode: '7790010010014', stock: 99, salePrice: 38000, costPrice: 0, minStock: 0, category: 'Servicio', trackStock: false },
  ],
  suppliers: [
    { id: makeId(), name: 'Mayorista Microglobal', contact: 'Daniel Perez', phone: '11 5011 4010', balance: 218000, lastDelivery: '2026-07-10', category: 'Hardware' },
    { id: makeId(), name: 'Tecnoinsumos BA', contact: 'Marina Lopez', phone: '11 4321 9988', balance: 46000, lastDelivery: '2026-07-11', category: 'Insumos' },
  ],
  cashSessions: [],
  purchaseReceipts: [],
  sales: [],
  invoices: [],
  tickets: [],
  cashMovements: [],
  stockMovements: [],
  auditLogs: [],
}

seedData.business.currentBranchId = seedData.branches[0].id
seedData.registers = [
  { id: makeId(), branchId: seedData.branches[0].id, name: 'Caja 1', code: 'CAJA-01', cashierUserId: seedData.users[1].id, isActive: true },
  { id: makeId(), branchId: seedData.branches[0].id, name: 'Caja 2', code: 'CAJA-02', cashierUserId: seedData.users[0].id, isActive: true },
]
seedData.business.currentRegisterId = seedData.registers[0].id

// A new local demo starts with enough master data to exercise filters and pagination.
for (let index = seedData.customers.length; index < 100; index += 1) {
  const number = index + 1
  seedData.customers.push({ id: makeId(), fullName: `Cliente simulacro ${String(number).padStart(3, '0')}`, phone: `11 6000 ${String(number).padStart(4, '0')}`, email: `cliente.${number}@demo.local`, balance: 0, tag: ['Mostrador', 'Frecuente', 'Mayorista', 'Cuenta corriente'][index % 4] })
}
for (let index = seedData.suppliers.length; index < 100; index += 1) {
  const number = index + 1
  seedData.suppliers.push({ id: makeId(), name: `Proveedor simulacro ${String(number).padStart(3, '0')}`, contact: `Contacto demo ${number}`, phone: `11 7000 ${String(number).padStart(4, '0')}`, email: `proveedor.${number}@demo.local`, balance: 0, lastDelivery: '2026-07-12', category: ['Hardware', 'Insumos', 'Perifericos', 'Servicios'][index % 4] })
}
for (let index = seedData.products.length; index < 100; index += 1) {
  const number = index + 1
  const isService = index % 5 === 0
  seedData.products.push({ id: makeId(), name: isService ? `Servicio tecnico simulacro ${String(number).padStart(3, '0')}` : `Producto simulacro ${String(number).padStart(3, '0')}`, sku: `DEMO-${String(number).padStart(4, '0')}`, barcode: `779900${String(number).padStart(7, '0')}`, stock: isService ? 0 : 150, salePrice: 8000 + (index % 12) * 3500, costPrice: isService ? 0 : 4500 + (index % 12) * 1800, minStock: isService ? 0 : 8, category: isService ? 'Servicio' : ['Hardware', 'Perifericos', 'Insumos', 'Accesorios'][index % 4], trackStock: !isService })
}

const pushAudit = (state, actorUserId, entityType, entityId, action, afterData, beforeData = null) => {
  state.auditLogs.unshift({
    id: makeId(),
    actorUserId,
    entityType,
    entityId,
    action,
    beforeData,
    afterData,
    createdAt: todayIso(),
  })
}

const currentUserFromState = (state) => state.users.find((user) => user.id === state.session.userId) || state.users[0]
const getCustomer = (state, customerId) => state.customers.find((customer) => customer.id === customerId)
const getProduct = (state, productId) => state.products.find((product) => product.id === productId)
const findProductByCode = (state, code) => {
  const normalized = String(code || '').trim().toLowerCase()
  if (!normalized) return null
  return state.products.find((product) => (
    String(product.barcode || '').trim().toLowerCase() === normalized
    || String(product.sku || '').trim().toLowerCase() === normalized
    || String(product.name || '').trim().toLowerCase() === normalized
  )) || null
}
const getOpenCashSession = (state) => state.cashSessions.find((session) => session.status === 'open') || null
const getInvoiceBySaleId = (state, saleId) => state.invoices.find((invoice) => invoice.saleId === saleId) || null
const getBranch = (state, branchId) => state.branches.find((branch) => branch.id === branchId)
const getRegister = (state, registerId) => state.registers.find((register) => register.id === registerId)
const getCurrentBranch = (state) => getBranch(state, state.business.currentBranchId) || state.branches[0]
const getCurrentRegister = (state) => {
  const register = getRegister(state, state.business.currentRegisterId)
  if (register?.branchId === getCurrentBranch(state)?.id) return register
  return state.registers.find((entry) => entry.branchId === getCurrentBranch(state)?.id) || null
}
const isModuleEnabled = (state, moduleKey) => {
  const enabled = Array.isArray(state.business.enabledModules) ? state.business.enabledModules : modulePresets.full
  return enabled.includes(moduleKey)
}
const nextNumber = (state, key) => {
  state.business.documentCounters[key] = Number(state.business.documentCounters[key] || 0) + 1
  return state.business.documentCounters[key]
}
const documentCounterKey = (kind, letter = 'B') => {
  if (kind === 'Factura') return `invoice${letter}`
  if (kind === 'Nota de credito') return `creditNote${letter}`
  if (kind === 'Presupuesto') return 'quote'
  if (kind === 'Remito') return 'remito'
  if (kind === 'Ticket') return 'receipt'
  return `invoice${letter}`
}
const generateDocumentNumber = (state, kind = 'Factura', letter = 'B', branchId = state.business.currentBranchId) => {
  const branch = getBranch(state, branchId) || getCurrentBranch(state)
  const seq = nextNumber(state, documentCounterKey(kind, letter))
  if (kind === 'Factura') return `${letter}-${branch?.code || 'GEN'}-0001-${String(seq).padStart(8, '0')}`
  if (kind === 'Nota de credito') return `NC-${letter}-${branch?.code || 'GEN'}-${String(seq).padStart(6, '0')}`
  if (kind === 'Presupuesto') return `PRES-${branch?.code || 'GEN'}-${String(seq).padStart(6, '0')}`
  if (kind === 'Remito') return `REM-${branch?.code || 'GEN'}-${String(seq).padStart(6, '0')}`
  if (kind === 'Ticket') return `TCK-${branch?.code || 'GEN'}-${String(seq).padStart(6, '0')}`
  return `${letter}-${branch?.code || 'GEN'}-0001-${String(seq).padStart(6, '0')}`
}
const generateInternalInvoiceNumber = (state, branchId = state.business.currentBranchId) => {
  const seq = nextNumber(state, `internalInvoice:${branchId || 'default'}`)
  return `INT-0001-${String(seq).padStart(8, '0')}`
}
const generateInvoiceNumber = (state, type = 'B', branchId = state.business.currentBranchId) => {
  return generateDocumentNumber(state, 'Factura', type, branchId)
}
const generateTicketNumber = (state, prefix = 'POST', branchId = state.business.currentBranchId) => {
  const branch = getBranch(state, branchId) || getCurrentBranch(state)
  // Los documentos se crean directamente en cloud y el contador local puede
  // quedar desactualizado entre equipos. Usamos fecha/hora y un sufijo aleatorio
  // para que dejar el número vacío siempre genere uno sin colisionar.
  const now = new Date()
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
    String(now.getMilliseconds()).padStart(3, '0'),
  ].join('')
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${prefix}-${branch?.code || 'GEN'}-${stamp}-${suffix}`
}
const documentKindMap = {
  Factura: 'factura',
  'Nota de credito': 'nota_credito',
  Presupuesto: 'presupuesto',
  Remito: 'remito',
  Ticket: 'ticket',
  postventa: 'postventa',
}
const normalizeDocumentKind = (value, fallback = 'factura') => documentKindMap[String(value || '').trim()] || String(value || fallback || 'factura').trim().toLowerCase() || fallback
const getScopedRegister = (state, registerId, branchId) => {
  const register = getRegister(state, registerId)
  if (register?.branchId === branchId) return register
  return state.registers.find((entry) => entry.branchId === branchId) || null
}
const normalizeStockByBranch = (product, fallbackBranchId = '') => {
  const normalized = {}
  const branchStock = product?.stockByBranch && typeof product.stockByBranch === 'object' ? product.stockByBranch : {}
  for (const [branchId, quantity] of Object.entries(branchStock)) normalized[branchId] = Number(quantity || 0)
  if (!Object.keys(normalized).length && fallbackBranchId) normalized[fallbackBranchId] = Number(product?.stock || 0)
  return normalized
}
const syncProductStock = (product) => {
  product.stockByBranch = normalizeStockByBranch(product)
  product.stock = Object.values(product.stockByBranch).reduce((sum, quantity) => sum + Number(quantity || 0), 0)
  return product.stock
}
const ensureProductInventory = (product, branchId, fallbackBranchId = '') => {
  product.stockByBranch = normalizeStockByBranch(product, fallbackBranchId)
  if (branchId && !(branchId in product.stockByBranch)) product.stockByBranch[branchId] = 0
  syncProductStock(product)
  return product.stockByBranch
}
const getBranchStock = (product, branchId, fallbackBranchId = '') => {
  if (!branchId) return Number(product?.stock || 0)
  ensureProductInventory(product, branchId, fallbackBranchId)
  return Number(product?.stockByBranch?.[branchId] || 0)
}
const changeBranchStock = (product, branchId, delta, fallbackBranchId = '') => {
  ensureProductInventory(product, branchId, fallbackBranchId)
  product.stockByBranch[branchId] = Math.max(0, Number(product.stockByBranch[branchId] || 0) + Number(delta || 0))
  syncProductStock(product)
  return Number(product.stockByBranch[branchId] || 0)
}
const getCashMovementDelta = (state, sessionId) => state.cashMovements
  .filter((movement) => movement.cashSessionId === sessionId)
  .reduce((sum, movement) => sum + Number(movement.signedAmount || 0), 0)
const getSaleBalanceDue = (sale) => Math.max(0, Number(sale.totalAmount || 0) - Number(sale.amountPaid || 0))
const getPaymentBreakdown = (payload, totalAmount) => {
  const normalizedTotal = Number(totalAmount || 0)
  if (payload.paymentMethod === 'mixed') {
    return {
      cash: Number(payload.cashAmount || 0),
      transfer: Number(payload.transferAmount || 0),
      mercadoPago: Number(payload.mercadoPagoAmount || 0),
      echeq: Number(payload.echeqAmount || 0),
      account: Number(payload.accountAmount || 0),
    }
  }
  const isPaid = Boolean(payload.isPaid)
  return {
    cash: payload.paymentMethod === 'cash' ? (isPaid ? normalizedTotal : Number(payload.amountPaid || 0)) : 0,
    transfer: payload.paymentMethod === 'transfer' ? (isPaid ? normalizedTotal : Number(payload.amountPaid || 0)) : 0,
    mercadoPago: payload.paymentMethod === 'mercado_pago' ? (isPaid ? normalizedTotal : Number(payload.amountPaid || 0)) : 0,
    echeq: payload.paymentMethod === 'echeq' ? (isPaid ? normalizedTotal : Number(payload.amountPaid || 0)) : 0,
    account: payload.paymentMethod === 'account' ? (normalizedTotal - Number(payload.amountPaid || 0)) : 0,
  }
}
const getCashPortion = (breakdown = {}) => Number(breakdown.cash || 0)
const getSaleStatus = (totalAmount, amountPaid) => {
  const total = Number(totalAmount || 0)
  const paid = Number(amountPaid || 0)
  if (total <= 0) return 'completed'
  if (paid <= 0) return 'pending'
  if (paid >= total) return 'completed'
  return 'partial'
}

const buildSaleItem = (productId, quantity, state, unitPriceOverride) => {
  const product = getProduct(state, productId)
  if (!product) return null
  const qty = Number(quantity)
  if (!qty) return null
  const unitPrice = Number(unitPriceOverride ?? product.salePrice)
  return {
    id: makeId(),
    productId: product.id,
    quantity: qty,
    unitPrice,
    lineTotal: qty * unitPrice,
  }
}

const ensureSaleStock = (state, items, branchId, ignoreSaleId = null) => {
  const fallbackBranchId = branchId || state.business.currentBranchId || state.branches[0]?.id || ''
  const available = new Map(state.products.map((product) => [product.id, getBranchStock(product, branchId, fallbackBranchId)]))

  if (ignoreSaleId) {
    const previousSale = state.sales.find((sale) => sale.id === ignoreSaleId)
    for (const item of previousSale?.items || []) {
      const product = getProduct(state, item.productId)
      if (product?.trackStock && previousSale?.branchId === branchId) {
        available.set(item.productId, (available.get(item.productId) || 0) + Number(item.quantity || 0))
      }
    }
  }

  for (const item of items) {
    const product = getProduct(state, item.productId)
    if (!product?.trackStock) continue
    const current = available.get(item.productId) || 0
    if (current < Number(item.quantity || 0)) {
      return { ok: false, message: `Stock insuficiente para ${product.name}. Disponible: ${current}.` }
    }
    available.set(item.productId, current - Number(item.quantity || 0))
  }

  return { ok: true }
}

const applySaleEffects = (state, sale) => {
  for (const item of sale.items || []) {
    const product = getProduct(state, item.productId)
    if (product?.trackStock) {
      changeBranchStock(product, sale.branchId, Number(item.quantity || 0) * -1, state.business.currentBranchId || state.branches[0]?.id || '')
      state.stockMovements.unshift({
        id: makeId(),
        productId: item.productId,
        type: 'sale',
        quantity: Number(item.quantity || 0) * -1,
        referenceId: sale.id,
        notes: `Venta ${sale.channel}`,
        createdAt: sale.soldAt,
        createdBy: sale.sellerUserId,
        branchId: sale.branchId || null,
        registerId: sale.registerId || null,
      })
    }
  }

  if (sale.customerId) {
    const customer = getCustomer(state, sale.customerId)
    if (customer) customer.balance += getSaleBalanceDue(sale)
  }
}

const revertSaleEffects = (state, sale) => {
  for (const item of sale.items || []) {
    const product = getProduct(state, item.productId)
    if (product?.trackStock) changeBranchStock(product, sale.branchId, Number(item.quantity || 0), state.business.currentBranchId || state.branches[0]?.id || '')
  }

  if (sale.customerId) {
    const customer = getCustomer(state, sale.customerId)
    if (customer) customer.balance = Math.max(0, Number(customer.balance || 0) - getSaleBalanceDue(sale))
  }

  state.stockMovements = state.stockMovements.filter((movement) => movement.referenceId !== sale.id)
}

const applyPurchaseEffects = (state, receipt) => {
  const product = getProduct(state, receipt.productId)
  const supplier = state.suppliers.find((entry) => entry.id === receipt.supplierId)
  if (product) {
    changeBranchStock(product, receipt.branchId, Number(receipt.quantity || 0), state.business.currentBranchId || state.branches[0]?.id || '')
    product.costPrice = Number(receipt.unitCost || 0)
  }
  if (supplier) {
    supplier.balance += Number(receipt.totalCost || 0)
    supplier.lastDelivery = todayDate()
  }
  state.stockMovements.unshift({
    id: makeId(),
    productId: receipt.productId,
    type: 'purchase',
    quantity: Number(receipt.quantity || 0),
    referenceId: receipt.id,
    notes: `Recepcion de compra de ${supplier?.name || 'Proveedor'}`,
    createdAt: receipt.receivedAt,
    createdBy: receipt.receivedBy,
    branchId: receipt.branchId || null,
    registerId: null,
  })
}

const revertPurchaseEffects = (state, receipt) => {
  const product = getProduct(state, receipt.productId)
  const supplier = state.suppliers.find((entry) => entry.id === receipt.supplierId)
  if (product) changeBranchStock(product, receipt.branchId, Number(receipt.quantity || 0) * -1, state.business.currentBranchId || state.branches[0]?.id || '')
  if (supplier) supplier.balance = Math.max(0, Number(supplier.balance || 0) - Number(receipt.totalCost || 0))
  state.stockMovements = state.stockMovements.filter((movement) => movement.referenceId !== receipt.id)
}

  const buildInvoiceForSale = (state, saleId) => {
  const sale = state.sales.find((entry) => entry.id === saleId)
  if (!sale) return { ok: false, message: 'Venta no encontrada.' }
  if (getInvoiceBySaleId(state, saleId)) return { ok: false, message: 'Esa venta ya tiene una factura.' }

  const invoice = {
    id: makeId(),
    number: generateInternalInvoiceNumber(state, sale.branchId),
    customerId: sale.customerId,
    totalAmount: sale.totalAmount,
    status: sale.status === 'completed' ? 'Cobrada' : 'Emitida',
    dueDate: todayDate(),
    type: 'X',
    kind: 'Factura',
    fiscalStatus: 'Interno',
    saleId,
    branchId: sale.branchId || getCurrentBranch(state)?.id || null,
  }
  state.invoices.unshift(invoice)
  pushAudit(state, currentUserFromState(state).id, 'invoice', invoice.id, 'created_from_sale', invoice)
  return { ok: true, message: 'Factura creada desde la venta.' }
}

  const buildSeedTransactions = () => {
  const state = clone(seedData)
  const adminId = state.users[0].id
  const cashSessionId = makeId()
  state.cashSessions.push({
    id: cashSessionId,
    openedBy: adminId,
    openingAmount: 50000,
    status: 'open',
    openedAt: '2026-07-12T09:00:00.000Z',
    closedAt: null,
    countedAmount: null,
    differenceAmount: null,
    branchId: state.branches[0].id,
    registerId: state.registers[0].id,
  })

  const customerByName = Object.fromEntries(state.customers.map((customer) => [customer.fullName, customer.id]))
  const productByName = Object.fromEntries(state.products.map((product) => [product.name, product.id]))

  const seedSales = [
    {
      customerId: customerByName['Juan Lopez'],
      items: [buildSaleItem(productByName['Limpieza completa notebook'], 1, state)],
      channel: 'Mostrador',
      paymentMethod: 'cash',
      isPaid: true,
      soldAt: '2026-07-12T10:30:00.000Z',
    },
    {
      customerId: customerByName['Empresa Delta'],
      items: [buildSaleItem(productByName['SSD Kingston 480GB'], 2, state)],
      channel: 'WhatsApp',
      paymentMethod: 'transfer',
      isPaid: true,
      soldAt: '2026-07-12T12:15:00.000Z',
    },
    {
      customerId: customerByName['Marina Diaz'],
      items: [buildSaleItem(productByName['Fuente 500W generica'], 1, state)],
      channel: 'Mostrador',
      paymentMethod: 'account',
      isPaid: false,
      soldAt: '2026-07-11T16:45:00.000Z',
    },
  ]

  for (const saleSeed of seedSales) {
    const totalAmount = saleSeed.items.reduce((sum, item) => sum + item.lineTotal, 0)
    const saleId = makeId()
    state.sales.unshift({
      id: saleId,
      items: saleSeed.items,
      customerId: saleSeed.customerId,
      sellerUserId: adminId,
      totalQuantity: saleSeed.items.reduce((sum, item) => sum + item.quantity, 0),
      totalAmount,
      amountPaid: saleSeed.isPaid ? totalAmount : 0,
      channel: saleSeed.channel,
      paymentMethod: saleSeed.paymentMethod,
      status: saleSeed.isPaid ? 'completed' : 'pending',
      soldAt: saleSeed.soldAt,
      cashSessionId,
      branchId: state.branches[0].id,
      registerId: state.registers[0].id,
    })

    for (const item of saleSeed.items) {
      const product = getProduct(state, item.productId)
      if (product?.trackStock) {
        changeBranchStock(product, state.branches[0].id, item.quantity * -1, state.branches[0].id)
        state.stockMovements.unshift({
          id: makeId(),
          productId: item.productId,
          type: 'sale',
          quantity: item.quantity * -1,
          referenceId: saleId,
          notes: `Venta por ${saleSeed.channel}`,
          createdAt: saleSeed.soldAt,
          createdBy: adminId,
          branchId: state.branches[0].id,
          registerId: state.registers[0].id,
        })
      }
    }
  }

  state.cashMovements = [
    {
      id: makeId(),
      cashSessionId,
      branchId: state.branches[0].id,
      registerId: state.registers[0].id,
      createdBy: adminId,
      kind: 'expense',
      signedAmount: -8500,
      note: 'Pago de mensajeria',
      createdAt: '2026-07-12T13:20:00.000Z',
    },
  ]

  state.invoices = [
    { id: makeId(), number: 'B-FLO-0001-000185', customerId: customerByName['Juan Lopez'], totalAmount: 38000, status: 'Cobrada', dueDate: '2026-07-12', type: 'B', saleId: state.sales[2].id, branchId: state.branches[0].id },
    { id: makeId(), number: 'A-FLO-0001-000001', customerId: customerByName['Empresa Delta'], totalAmount: 128000, status: 'Emitida', dueDate: '2026-07-20', type: 'A', saleId: state.sales[1].id, branchId: state.branches[0].id },
  ]

  state.tickets = [
    { id: makeId(), number: 'TEC-FLO-001001', customerId: customerByName['Juan Lopez'], device: 'Notebook Lenovo', issue: 'Cambio de SSD', status: 'En curso', updatedAt: '2026-07-12', branchId: state.branches[0].id },
    { id: makeId(), number: 'TEC-FLO-001002', customerId: customerByName['Marina Diaz'], device: 'PC Gamer', issue: 'No da video', status: 'Esperando aprobacion', updatedAt: '2026-07-11', branchId: state.branches[0].id },
  ]

  state.purchaseReceipts = [
    {
      id: makeId(),
      supplierId: state.suppliers[0].id,
      productId: productByName['Pasta termica MX-4'],
      quantity: 12,
      unitCost: 7500,
      totalCost: 90000,
      receivedAt: '2026-07-10T11:00:00.000Z',
      receivedBy: adminId,
    },
  ]

  const demoCustomers = state.customers.filter((customer) => customer.email?.endsWith('@demo.local'))
  const demoSuppliers = state.suppliers.filter((supplier) => supplier.email?.endsWith('@demo.local'))
  const demoProducts = state.products.filter((product) => product.sku?.startsWith('DEMO-'))
  const demoServices = demoProducts.filter((product) => !product.trackStock)
  const demoBaseDate = Date.UTC(2026, 6, 1, 12, 0, 0)
  const demoDate = (index, hour = 12) => new Date(demoBaseDate + index * 86400000 + hour * 3600000).toISOString()

  // One hundred related records for each operational module. Sales use services,
  // so the test fixture does not consume the physical stock.
  for (let index = 0; index < 100; index += 1) {
    const customer = demoCustomers[index % demoCustomers.length]
    const supplier = demoSuppliers[index % demoSuppliers.length]
    const product = demoProducts[index % demoProducts.length]
    const service = demoServices[index % demoServices.length]
    const soldAt = demoDate(index, 9 + (index % 8))
    const saleId = makeId()
    const quantity = 1 + (index % 3)
    const unitPrice = Number(service.salePrice || 0)
    const totalAmount = quantity * unitPrice
    const paymentMethod = ['cash', 'transfer', 'mercado_pago', 'account'][index % 4]
    const amountPaid = paymentMethod === 'account' ? 0 : totalAmount
    const branchId = state.branches[index % state.branches.length].id
    const registerId = state.registers[index % state.registers.length].id

    state.sales.unshift({ id: saleId, items: [{ id: makeId(), productId: service.id, quantity, unitPrice, lineTotal: totalAmount }], customerId: customer.id, sellerUserId: adminId, totalQuantity: quantity, subtotalAmount: totalAmount, discountAmount: 0, totalAmount, amountPaid, paymentBreakdown: getPaymentBreakdown({ paymentMethod, isPaid: amountPaid === totalAmount }, totalAmount), channel: ['Mostrador', 'WhatsApp', 'Instagram', 'Web'][index % 4], paymentMethod, status: amountPaid ? 'completed' : 'pending', note: `SIMULACRO-2026 venta ${String(index + 1).padStart(3, '0')}`, soldAt, cashSessionId: paymentMethod === 'cash' ? cashSessionId : null, branchId, registerId })
    state.invoices.unshift({ id: makeId(), number: `B-SIM-0001-${String(index + 1).padStart(6, '0')}`, customerId: customer.id, totalAmount, status: amountPaid ? 'Cobrada' : 'Emitida', dueDate: soldAt.slice(0, 10), type: index % 5 === 0 ? 'A' : 'B', kind: 'Factura', fiscalStatus: index % 10 === 0 ? 'Pendiente' : 'Autorizado', saleId, branchId })
    state.tickets.unshift({ id: makeId(), number: `TEC-SIM-${String(index + 1).padStart(6, '0')}`, customerId: customer.id, device: ['Notebook', 'PC escritorio', 'Impresora', 'Monitor'][index % 4], issue: `SIMULACRO-2026 diagnostico ${String(index + 1).padStart(3, '0')}`, status: ['Recibido', 'En curso', 'Esperando aprobacion', 'Listo para retirar'][index % 4], updatedAt: soldAt.slice(0, 10), branchId })

    const purchaseId = makeId()
    const purchaseQuantity = 10 + (index % 15)
    const unitCost = Number(product.costPrice || 0)
    state.purchaseReceipts.unshift({ id: purchaseId, supplierId: supplier.id, productId: product.id, quantity: purchaseQuantity, unitCost, totalCost: purchaseQuantity * unitCost, documentNumber: `OC-SIM-${String(index + 1).padStart(6, '0')}`, note: `SIMULACRO-2026 compra ${String(index + 1).padStart(3, '0')}`, receivedAt: soldAt, receivedBy: adminId, branchId })
    state.stockMovements.unshift({ id: makeId(), productId: product.id, type: 'purchase', quantity: purchaseQuantity, referenceId: purchaseId, notes: 'SIMULACRO-2026 recepcion de compra', createdAt: soldAt, createdBy: adminId, branchId, registerId: null })
    state.cashMovements.unshift({ id: makeId(), cashSessionId, branchId: state.branches[0].id, registerId: state.registers[0].id, createdBy: adminId, kind: index % 2 === 0 ? 'income' : 'expense', signedAmount: (index % 2 === 0 ? 1 : -1) * (1000 + index * 125), note: `SIMULACRO-2026 movimiento de caja ${String(index + 1).padStart(3, '0')}`, createdAt: soldAt })
  }

  for (let index = 0; index < 100; index += 1) {
    const openingAmount = 30000 + index * 1000
    const differenceAmount = (index % 3 - 1) * 250
    state.cashSessions.unshift({ id: makeId(), openedBy: adminId, closedBy: adminId, openingAmount, countedAmount: openingAmount + differenceAmount, differenceAmount, status: 'closed', openedAt: demoDate(index, 8), closedAt: demoDate(index, 20), branchId: state.branches[index % state.branches.length].id, registerId: state.registers[index % state.registers.length].id })
  }

  pushAudit(state, adminId, 'system', null, 'seed_initialized', { message: 'Demo inicial cargada' })
  return state
}

const defaultState = buildSeedTransactions()

const migrateState = (source) => {
  const migrated = clone(defaultState)
  if (!source || typeof source !== 'object') return migrated

  // Upgrade the built-in local demo once. Real businesses and cloud data are
  // never replaced: this only recognizes the old, small "Demo local" fixture.
  if (
    source.meta?.edition === 'desktop-local'
    && Number(source.meta?.schemaVersion || 0) < 4
    && source.business?.organization === 'Demo local'
    && Array.isArray(source.customers)
    && source.customers.length < 100
  ) return migrated

  migrated.meta = { ...migrated.meta, ...(source.meta || {}) }
  migrated.business = { ...migrated.business, ...(source.business || {}) }
  migrated.business.enabledModules = Array.isArray(source.business?.enabledModules) && source.business.enabledModules.length
    ? source.business.enabledModules.filter((key) => moduleCatalog[key])
    : [...modulePresets.full]
  migrated.business.activePlan = source.business?.activePlan || 'full'
  migrated.branches = Array.isArray(source.branches) && source.branches.length ? source.branches : migrated.branches
  migrated.registers = Array.isArray(source.registers) && source.registers.length ? source.registers : migrated.registers
  if (!migrated.business.currentBranchId) migrated.business.currentBranchId = migrated.branches[0]?.id || ''
  if (!migrated.business.currentRegisterId) migrated.business.currentRegisterId = migrated.registers.find((entry) => entry.branchId === migrated.business.currentBranchId)?.id || migrated.registers[0]?.id || ''
  migrated.roles = Array.isArray(source.roles) && source.roles.length ? source.roles : migrated.roles
  migrated.users = Array.isArray(source.users) && source.users.length ? source.users : migrated.users
  migrated.session = {
    userId: source.session?.userId || '',
    authenticated: Boolean(source.session?.authenticated),
  }

  if (Array.isArray(source.customers)) migrated.customers = source.customers.map((customer) => ({
    id: customer.id || makeId(),
    fullName: customer.fullName || customer.name || 'Cliente sin nombre',
    phone: customer.phone || '',
    email: customer.email || '',
    balance: Number(customer.balance || 0),
    ...contactDetailsFromNotes(customer.notes),
    ...customerDetailsFromTag(customer.tag),
  }))

  if (Array.isArray(source.products)) migrated.products = source.products.map((product) => {
    const migratedProduct = {
      id: product.id || makeId(),
      name: product.name,
      sku: product.sku,
      barcode: product.barcode || '',
      stock: Number(product.stock || 0),
      salePrice: Number(product.salePrice || product.price || 0),
      costPrice: Number(product.costPrice || 0),
      minStock: Number(product.minStock || 0),
      category: product.category || 'General',
      trackStock: product.trackStock ?? product.category !== 'Servicio',
      stockByBranch: normalizeStockByBranch(product, migrated.business.currentBranchId || migrated.branches[0]?.id || ''),
    }
    syncProductStock(migratedProduct)
    return migratedProduct
  })

  const rawSuppliers = source.suppliers || source.providers
  if (Array.isArray(rawSuppliers)) migrated.suppliers = rawSuppliers.map((supplier) => ({
    id: supplier.id || makeId(),
    name: supplier.name,
    contact: supplier.contact || '',
    phone: supplier.phone || '',
    balance: Number(supplier.balance || 0),
    lastDelivery: supplier.lastDelivery || todayDate(),
    category: supplier.category || 'General',
    email: supplier.email || '',
    ...contactDetailsFromNotes(supplier.notes),
  }))

  if (Array.isArray(source.cashSessions)) migrated.cashSessions = source.cashSessions.map((session) => ({
    ...session,
    branchId: session.branchId || migrated.business.currentBranchId || migrated.branches[0]?.id || null,
    registerId: session.registerId || migrated.business.currentRegisterId || migrated.registers.find((entry) => entry.branchId === (session.branchId || migrated.business.currentBranchId))?.id || null,
  }))
  if (Array.isArray(source.purchaseReceipts)) migrated.purchaseReceipts = source.purchaseReceipts.map((receipt) => ({
    ...receipt,
    documentNumber: receipt.documentNumber || '',
    note: receipt.note || '',
    branchId: receipt.branchId || migrated.business.currentBranchId || migrated.branches[0]?.id || null,
  }))

  if (Array.isArray(source.sales)) migrated.sales = source.sales.map((sale) => {
    const items = Array.isArray(sale.items) && sale.items.length
      ? sale.items.map((item) => ({
          id: item.id || makeId(),
          productId: item.productId,
          quantity: Number(item.quantity || 0),
          unitPrice: Number(item.unitPrice || 0),
          lineTotal: Number(item.lineTotal || Number(item.quantity || 0) * Number(item.unitPrice || 0)),
        }))
      : [buildSaleItem(sale.productId, sale.quantity || 1, migrated, (sale.totalAmount || sale.amount || 0) / Number(sale.quantity || 1))].filter(Boolean)

    return {
      id: sale.id || makeId(),
      items,
      customerId: sale.customerId || null,
      sellerUserId: sale.sellerUserId || migrated.users[0]?.id || '',
      totalQuantity: Number(sale.totalQuantity || items.reduce((sum, item) => sum + item.quantity, 0)),
      subtotalAmount: Number(sale.subtotalAmount || items.reduce((sum, item) => sum + item.lineTotal, 0)),
      discountAmount: Number(sale.discountAmount || 0),
      totalAmount: Number(sale.totalAmount || sale.amount || items.reduce((sum, item) => sum + item.lineTotal, 0) - Number(sale.discountAmount || 0)),
      amountPaid: Number(sale.amountPaid ?? (sale.paid ? Number(sale.totalAmount || sale.amount || 0) : 0)),
      channel: sale.channel || 'Mostrador',
      paymentMethod: sale.paymentMethod || 'cash',
      paymentBreakdown: sale.paymentBreakdown || getPaymentBreakdown({ paymentMethod: sale.paymentMethod || 'cash', isPaid: sale.paid, amountPaid: sale.amountPaid }, Number(sale.totalAmount || sale.amount || items.reduce((sum, item) => sum + item.lineTotal, 0))),
      status: sale.status || getSaleStatus(Number(sale.totalAmount || sale.amount || items.reduce((sum, item) => sum + item.lineTotal, 0)), Number(sale.amountPaid ?? (sale.paid ? Number(sale.totalAmount || sale.amount || 0) : 0))),
      note: sale.note || '',
      soldAt: sale.soldAt || `${sale.date || todayDate()}T12:00:00.000Z`,
      cashSessionId: sale.cashSessionId || null,
      branchId: sale.branchId || migrated.business.currentBranchId || migrated.branches[0]?.id || null,
      registerId: sale.registerId || migrated.business.currentRegisterId || null,
    }
  })

  if (Array.isArray(source.invoices)) migrated.invoices = source.invoices.map((invoice) => ({
    id: invoice.id || makeId(),
    number: invoice.number,
    customerId: invoice.customerId || null,
    totalAmount: Number(invoice.totalAmount || invoice.total || 0),
    status: invoice.status || 'Emitida',
    dueDate: invoice.dueDate || todayDate(),
    type: invoice.type || 'B',
    kind: invoice.kind || 'Factura',
    fiscalStatus: invoice.fiscalStatus || 'Pendiente',
    relatedDocumentId: invoice.relatedDocumentId || null,
    saleId: invoice.saleId || null,
    branchId: invoice.branchId || migrated.business.currentBranchId || migrated.branches[0]?.id || null,
  }))

  if (Array.isArray(source.tickets)) migrated.tickets = source.tickets.map((ticket) => ({
    id: ticket.id || makeId(),
    number: ticket.number,
    customerId: ticket.customerId || null,
    device: ticket.device || '',
    issue: ticket.issue || '',
    status: ticket.status || 'Recibido',
    updatedAt: ticket.updatedAt || todayDate(),
    branchId: ticket.branchId || migrated.business.currentBranchId || migrated.branches[0]?.id || null,
  }))

  if (Array.isArray(source.cashMovements)) migrated.cashMovements = source.cashMovements.map((movement) => ({
    ...movement,
    branchId: movement.branchId || migrated.business.currentBranchId || migrated.branches[0]?.id || null,
    registerId: movement.registerId || migrated.business.currentRegisterId || null,
    signedAmount: Number(movement.signedAmount || 0),
  }))

  migrated.stockMovements = Array.isArray(source.stockMovements) ? source.stockMovements.map((movement) => ({
    ...movement,
    branchId: movement.branchId || migrated.business.currentBranchId || migrated.branches[0]?.id || null,
    registerId: movement.registerId || null,
  })) : migrated.stockMovements
  migrated.auditLogs = Array.isArray(source.auditLogs) ? source.auditLogs : migrated.auditLogs
  return migrated
}

export const createBrowserDataStore = (options = {}) => {
  const desktopBridge = globalThis.window?.pclafDesktop
  const isDesktop = Boolean(desktopBridge?.isDesktop)
  const requireCloud = Boolean(options.requireCloud) && !isDesktop
  const useBrowserBusinessCache = !requireCloud && !isDesktop
  const initialCloudConfig = options.initialCloudConfig && options.initialCloudConfig.url && options.initialCloudConfig.anonKey
    ? {
        url: String(options.initialCloudConfig.url || '').trim(),
        anonKey: String(options.initialCloudConfig.anonKey || '').trim(),
        instanceKey: String(options.initialCloudConfig.instanceKey || 'pclaf-dev').trim().toLowerCase(),
        environment: String(options.initialCloudConfig.environment || 'production').trim().toLowerCase(),
        environmentLabel: String(options.initialCloudConfig.environmentLabel || '').trim(),
      }
    : null
  const readCloudConfig = () => {
    if (isDesktop) return null
    try {
      const saved = safeStorage.getItem(cloudConfigStorageKey)
      if (!saved) return initialCloudConfig
      const parsed = JSON.parse(saved)
      if (!parsed?.url || !parsed?.anonKey) return null
      return {
        url: String(parsed.url || '').trim(),
        anonKey: String(parsed.anonKey || '').trim(),
        instanceKey: String(parsed.instanceKey || 'pclaf-dev').trim().toLowerCase(),
        environment: String(parsed.environment || initialCloudConfig?.environment || 'production').trim().toLowerCase(),
        environmentLabel: String(parsed.environmentLabel || initialCloudConfig?.environmentLabel || '').trim(),
      }
    } catch {
      return null
    }
  }
  const writeCloudConfig = (config) => {
    if (isDesktop) return null
    if (!config?.url || !config?.anonKey) {
      safeStorage.removeItem(cloudConfigStorageKey)
      return null
    }
    const normalized = {
      url: String(config.url || '').trim().replace(/\/+$/, ''),
      anonKey: String(config.anonKey || '').trim(),
      instanceKey: String(config.instanceKey || 'pclaf-dev').trim().toLowerCase(),
      environment: String(config.environment || cloudConfig?.environment || initialCloudConfig?.environment || 'production').trim().toLowerCase(),
      environmentLabel: String(config.environmentLabel || cloudConfig?.environmentLabel || initialCloudConfig?.environmentLabel || '').trim(),
    }
    safeStorage.setItem(cloudConfigStorageKey, JSON.stringify(normalized))
    return normalized
  }
  let cloudConfig = readCloudConfig()
  let cloudAccessToken = ''
  let platformAdminData = null
  const operationalChangeListeners = new Set()
  const notifyOperationalChange = (operation) => {
    for (const listener of operationalChangeListeners) listener(operation)
  }
  const createCloudCoreAdapter = () => createSupabaseCoreAdapter({
    ...cloudConfig,
    getAccessToken: () => cloudAccessToken,
    onMutation: notifyOperationalChange,
  })
  let cloudCoreAdapter = createCloudCoreAdapter()
  let cloudAuthProfile = null

  const normalizeCloudUser = (entry) => {
    if (!entry) return null
    const roleKey = entry.role_key || roleKeysById[entry.roleId] || 'cashier'
    return {
      id: entry.id,
      fullName: entry.full_name || entry.fullName || 'Usuario',
      email: String(entry.email || '').trim().toLowerCase(),
      loginName: String(entry.login_name || entry.loginName || '').trim().toLowerCase(),
      roleKey,
      roleId: roleIds[roleKey] || roleIds.cashier,
      pin: '',
      pinHash: '',
      pinSalt: '',
      pinHashVersion: '',
      isActive: entry.status ? entry.status === 'active' : entry.isActive !== false,
      status: entry.status || (entry.isActive === false ? 'disabled' : 'active'),
      isOwner: Boolean(entry.is_owner || entry.isOwner),
      isPlatformAdmin: Boolean(entry.is_platform_admin || entry.isPlatformAdmin),
      allowedModules: normalizeStringList(entry.allowed_modules || entry.allowedModules, validModuleKeys),
      blockedPermissions: normalizeStringList(entry.blocked_permissions || entry.blockedPermissions, validPermissionKeys),
      createdAt: entry.created_at || entry.createdAt || todayIso(),
      updatedAt: entry.updated_at || entry.updatedAt || todayIso(),
    }
  }

  const normalizePlatformAdminData = (payload) => {
    if (!payload || typeof payload !== 'object') return null
    const summary = payload.summary && typeof payload.summary === 'object' ? payload.summary : {}
    return {
      summary: {
        totalCommerces: Number(summary.total_commerces || summary.totalCommerces || 0),
        trialCommerces: Number(summary.trial_commerces || summary.trialCommerces || 0),
        activeCommerces: Number(summary.active_commerces || summary.activeCommerces || 0),
        pausedCommerces: Number(summary.paused_commerces || summary.pausedCommerces || 0),
        expiredCommerces: Number(summary.expired_commerces || summary.expiredCommerces || 0),
        totalUsers: Number(summary.total_users || summary.totalUsers || 0),
        totalBranches: Number(summary.total_branches || summary.totalBranches || 0),
        totalRegisters: Number(summary.total_registers || summary.totalRegisters || 0),
      },
      commerces: Array.isArray(payload.commerces) ? payload.commerces.map((entry) => ({
        id: entry.id,
        name: entry.name || 'Comercio',
        instanceKey: entry.instance_key || entry.instanceKey || '',
        ownerEmail: String(entry.owner_email || entry.ownerEmail || '').trim().toLowerCase(),
        activePlan: entry.active_plan || entry.activePlan || 'full',
        status: entry.status || 'active',
        billingStatus: entry.billing_status || entry.billingStatus || 'trial',
        onboardingStatus: entry.onboarding_status || entry.onboardingStatus || 'ready',
        allowPublicSignup: Boolean(entry.allow_public_signup ?? entry.allowPublicSignup),
        trialStartedAt: entry.trial_started_at || entry.trialStartedAt || '',
        trialEndsAt: entry.trial_ends_at || entry.trialEndsAt || '',
        createdAt: entry.created_at || entry.createdAt || '',
        updatedAt: entry.updated_at || entry.updatedAt || '',
        lastAccessAt: entry.last_access_at || entry.lastAccessAt || '',
        branchesCount: Number(entry.branches_count || entry.branchesCount || 0),
        registersCount: Number(entry.registers_count || entry.registersCount || 0),
        usersCount: Number(entry.users_count || entry.usersCount || 0),
        supportOwner: entry.support_owner || entry.supportOwner || '',
        supportStatus: entry.support_status || entry.supportStatus || 'pendiente',
        billingNote: entry.billing_note || entry.billingNote || '',
        commercialNote: entry.commercial_note || entry.commercialNote || '',
        internalTag: entry.internal_tag || entry.internalTag || '',
        enabledModules: Array.isArray(entry.enabled_modules) ? entry.enabled_modules : (Array.isArray(entry.enabledModules) ? entry.enabledModules : []),
        branches: Array.isArray(entry.branches) ? entry.branches : [],
        registers: Array.isArray(entry.registers) ? entry.registers : [],
        users: Array.isArray(entry.users) ? entry.users : [],
      })) : [],
    }
  }

  const readState = () => {
    if (isDesktop) return migrateState(desktopBridge.initialize(defaultState))
    if (requireCloud && !cloudCoreAdapter) return clone(defaultState)
    if (!useBrowserBusinessCache) return clone(defaultState)
    const saved = safeStorage.getItem(dataStorageKey)
    if (!saved) return clone(defaultState)
    try {
      return migrateState(JSON.parse(saved))
    } catch {
      return clone(defaultState)
    }
  }

  let state = readState()
  let cloudStateLoaded = false
  const applyCloudMeta = (mode = 'offline', syncedAt = '') => {
    state.meta = {
      ...state.meta,
      edition: cloudCoreAdapter ? 'cloud-core' : (isDesktop ? 'local-desktop' : (requireCloud ? 'cloud-required' : 'offline-blocked')),
      adapter: cloudCoreAdapter ? 'supabase-core' : (isDesktop ? 'desktop-sqlite' : (requireCloud ? 'cloud-required' : 'web-disabled')),
      syncStatus: requireCloud && !cloudCoreAdapter ? 'required' : mode,
      lastSyncedAt: syncedAt || state.meta?.lastSyncedAt || '',
      instanceKey: cloudConfig?.instanceKey || state.meta?.instanceKey || (requireCloud ? 'pclaf-dev' : 'desktop-local'),
      environment: cloudConfig?.environment || state.meta?.environment || 'production',
      environmentLabel: cloudConfig?.environmentLabel || state.meta?.environmentLabel || '',
    }
  }
  applyCloudMeta()

  let pinSecurityMigration = null
  const migrateLegacyPinsIfNeeded = async () => {
    if (pinSecurityMigration) return pinSecurityMigration
    pinSecurityMigration = (async () => {
      let changed = false
      for (const user of state.users) {
        // Remote users never expose a local PIN and do not need local hashing.
        if (user?.pin && !user?.pinHash) {
          changed = await migrateUserPinSecurity(user) || changed
        }
      }
      if (changed) save({ skipCloud: true })
    })()
    try {
      await pinSecurityMigration
    } finally {
      pinSecurityMigration = null
    }
  }

  const persistLocalState = () => {
    if (!useBrowserBusinessCache) return
    safeStorage.setItem(dataStorageKey, JSON.stringify(state))
  }

  const save = ({ skipCloud = false } = {}) => {
    if (isDesktop) {
      applyCloudMeta()
      state = migrateState(desktopBridge.saveSnapshot(state))
      return
    }
    if (requireCloud && !cloudCoreAdapter) {
      applyCloudMeta('required')
      return
    }
    applyCloudMeta(cloudCoreAdapter ? 'online' : 'offline')
    persistLocalState()
    void skipCloud
  }

  const syncToCloud = async () => {
    if (!cloudCoreAdapter) return { ok: false, message: 'Sin conexion cloud configurada.' }
    applyCloudMeta('online', state.meta?.lastSyncedAt || todayIso())
    persistLocalState()
    return { ok: true, message: 'La web ya opera directo sobre la base real.' }
  }

  const mergeCloudState = (payload) => {
    const emptyCollections = { customers: [], products: [], suppliers: [], cashSessions: [], cashMovements: [], sales: [], purchaseReceipts: [], invoices: [], tickets: [], stockMovements: [], auditLogs: [] }
    const next = cloudStateLoaded ? { ...state, ...payload } : { ...state, ...emptyCollections, ...payload }
    for (const [key, value] of Object.entries(payload || {})) {
      if (value && typeof value === 'object' && !Array.isArray(value) && state[key] && typeof state[key] === 'object' && !Array.isArray(state[key])) next[key] = { ...state[key], ...value }
    }
    cloudStateLoaded = true
    return migrateState(next)
  }
  const syncFromCloud = async (modules = null) => {
    if (!cloudCoreAdapter) return { ok: false, message: 'Sin conexion cloud configurada.' }
    applyCloudMeta('syncing')
    const payload = await cloudCoreAdapter.loadState({ modules: modules || cloudCoreAdapter.consumePendingModules?.() || ['dashboard'] })
    if (payload) {
      state = mergeCloudState(payload)
      platformAdminData = null
      const platformUser = cloudAuthProfile || currentUserFromState(state)
      if (platformUser?.isPlatformAdmin && cloudCoreAdapter?.loadPlatformOverview) {
        try {
          platformAdminData = normalizePlatformAdminData(await cloudCoreAdapter.loadPlatformOverview())
        } catch {
          platformAdminData = null
        }
      }
      applyCloudMeta('online', todayIso())
      persistLocalState()
      return { ok: true, message: 'Base remota cargada.' }
    }
    return { ok: false, message: 'No se pudo leer la base real.' }
  }

  const getRole = (roleId) => state.roles.find((role) => role.id === roleId) || state.roles[0]
  const getUser = (userId) => state.users.find((user) => user.id === userId) || state.users[0]
  const currentUser = () => cloudAuthProfile || currentUserFromState(state)
  const currentRole = () => cloudAuthProfile
    ? (state.roles.find((role) => role.key === cloudAuthProfile.roleKey) || state.roles[0])
    : getRole(currentUser().roleId)
  const currentPermissionSet = () => inferUserPermissionSet(currentUser())
  const currentEnabledModules = () => inferUserModules(currentUser(), state.business.enabledModules || modulePresets.full)
  const hasPermission = (permission) => currentPermissionSet().includes(permission)
  const canAccessModule = (moduleKey, permission) => currentEnabledModules().includes(moduleKey) && hasPermission(permission)
  const isAuthenticated = () => Boolean(state.session.authenticated && state.session.userId)
  const ensurePermission = (permission, message = 'No tienes permiso para hacer esta accion.') => {
    if (!hasPermission(permission)) return { ok: false, message }
    return null
  }

  const replaceCloudUsers = (users = []) => {
    const normalized = users.map(normalizeCloudUser).filter(Boolean)
    if (normalized.length) state.users = normalized
    return normalized
  }

  const setCloudAccessToken = (token = '') => {
    cloudAccessToken = String(token || '').trim()
    cloudCoreAdapter = createCloudCoreAdapter()
    applyCloudMeta(cloudCoreAdapter ? 'pending' : 'required')
  }

  const setCloudAuthSession = (profile, users = []) => {
    const normalizedProfile = normalizeCloudUser(profile)
    cloudAuthProfile = normalizedProfile
    if (!normalizedProfile) {
      platformAdminData = null
      state.session.userId = ''
      state.session.authenticated = false
      return null
    }
    const normalizedUsers = users.length ? replaceCloudUsers(users) : state.users
    const existingUser = normalizedUsers.find((entry) => entry.id === normalizedProfile.id)
    state.users = existingUser
      ? state.users.map((entry) => entry.id === normalizedProfile.id ? { ...entry, ...normalizedProfile } : entry)
      : [normalizedProfile, ...state.users.filter((entry) => entry.id !== normalizedProfile.id)]
    state.session.userId = normalizedProfile.id
    state.session.authenticated = normalizedProfile.status === 'active'
    return normalizedProfile
  }

  const clearCloudAuthSession = () => {
    cloudAuthProfile = null
    platformAdminData = null
    state.session.userId = ''
    state.session.authenticated = false
  }

  const getPlatformAdminData = () => platformAdminData

  const refreshPlatformAdminData = async () => {
    if (!cloudCoreAdapter?.loadPlatformOverview || !currentUser()?.isPlatformAdmin) {
      platformAdminData = null
      return null
    }
    platformAdminData = normalizePlatformAdminData(await cloudCoreAdapter.loadPlatformOverview())
    return platformAdminData
  }

  const authenticateUser = async (identifier, pin) => {
    await migrateLegacyPinsIfNeeded()
    const normalized = String(identifier || '').trim().toLowerCase()
    const user = state.users.find((entry) => (
      entry.isActive
      && (
        entry.id === identifier
        || String(entry.loginName || '').trim().toLowerCase() === normalized
        || String(entry.email || '').trim().toLowerCase() === normalized
        || String(entry.email || '').trim().toLowerCase().split('@')[0] === normalized
        || String(entry.fullName || '').trim().toLowerCase() === normalized
      )
    ))
    if (!user) return { ok: false, message: 'Usuario no encontrado' }
    const pinMatches = user.pinHash
      ? await verifyHashedPin(user, pin)
      : user.pin === String(pin)
    if (!pinMatches) return { ok: false, message: 'PIN incorrecto' }
    if (!user.pinHash && user.pin) {
      await migrateUserPinSecurity(user)
    }
    state.session.userId = user.id
    state.session.authenticated = true
    pushAudit(state, user.id, 'session', user.id, 'sign_in', { userId: user.id })
    save()
    return { ok: true }
  }

  const signOut = () => {
    const user = currentUser()
    cloudAuthProfile = null
    cloudAccessToken = ''
    state.session.authenticated = false
    state.session.userId = ''
    pushAudit(state, user.id, 'session', user.id, 'sign_out', { userId: user.id })
    save()
  }

  const createCustomer = async (payload) => {
    const denied = ensurePermission(actionPermissions.customersWrite)
    if (denied) return denied
    const normalizedName = String(payload.fullName || '').trim()
    if (!normalizedName) return { ok: false, message: 'El cliente necesita un nombre.' }
    const customerDraft = {
      id: makeId(),
      fullName: normalizedName,
      phone: String(payload.phone || '').trim(),
      email: String(payload.email || '').trim().toLowerCase(),
      balance: Number(payload.balance || 0),
      tag: customerDetailsTag(payload),
      address: String(payload.address || '').trim(),
      cuit: String(payload.cuit || '').trim(),
      notes: contactDetailsNotes(payload),
    }
    const customer = cloudCoreAdapter
      ? await cloudCoreAdapter.upsertCustomer(customerDraft)
      : customerDraft
    state.customers.unshift({
      id: customer.id || customerDraft.id,
      fullName: customer.full_name || customer.fullName || customerDraft.fullName,
      phone: customer.phone || customerDraft.phone,
      email: String(customer.email || customerDraft.email || '').trim().toLowerCase(),
      balance: Number(customer.balance ?? customerDraft.balance ?? 0),
      ...customerDetailsFromTag(customer.tag || customerDraft.tag),
      ...contactDetailsFromNotes(customer.notes || customerDraft.notes),
      isActive: customer.is_active ?? true,
    })
    pushAudit(state, currentUser().id, 'customer', customer.id || customerDraft.id, 'created', customerDraft)
    save({ skipCloud: Boolean(cloudCoreAdapter) })
    return { ok: true, message: 'Cliente creado.' }
  }

  const updateCustomer = async (customerId, payload) => {
    const customer = state.customers.find((item) => item.id === customerId)
    if (!customer) return { ok: false, message: 'Cliente no encontrado.' }
    const draft = { ...customer, ...payload, id: customerId, fullName: String(payload.fullName || '').trim(), tag: customerDetailsTag(payload), notes: contactDetailsNotes(payload) }
    if (!draft.fullName) return { ok: false, message: 'El cliente necesita un nombre.' }
    if (cloudCoreAdapter) {
      await cloudCoreAdapter.upsertCustomer(draft)
      await syncFromCloud()
    } else {
      Object.assign(customer, draft, contactDetailsFromNotes(draft.notes), customerDetailsFromTag(draft.tag))
      save()
    }
    return { ok: true, message: 'Cliente actualizado.' }
  }

  const createBranch = async (payload) => {
    const denied = ensurePermission(actionPermissions.branchesManage)
    if (denied) return denied
    if (cloudCoreAdapter) {
      await cloudCoreAdapter.upsertBranch({
        id: null,
        name: payload.name,
        code: String(payload.code || '').toUpperCase(),
        address: payload.address,
        isActive: true,
      })
      await syncFromCloud()
      return { ok: true, message: 'Sucursal creada.' }
    }
    const branch = {
      id: makeId(),
      name: payload.name,
      code: String(payload.code || '').toUpperCase(),
      address: payload.address,
      isActive: true,
    }
    state.branches.unshift(branch)
    if (!state.business.currentBranchId) state.business.currentBranchId = branch.id
    pushAudit(state, currentUser().id, 'branch', branch.id, 'created', branch)
    save()
    return { ok: true, message: 'Sucursal creada.' }
  }

  const updateBranch = async (branchId, payload) => {
    const denied = ensurePermission(actionPermissions.branchesManage)
    if (denied) return denied
    if (cloudCoreAdapter) {
      await cloudCoreAdapter.upsertBranch({
        id: branchId,
        name: payload.name,
        code: String(payload.code || '').toUpperCase(),
        address: payload.address,
        isActive: true,
      })
      await syncFromCloud()
      return { ok: true, message: 'Sucursal actualizada.' }
    }
    const branch = state.branches.find((entry) => entry.id === branchId)
    if (!branch) return { ok: false, message: 'Sucursal no encontrada.' }
    const before = clone(branch)
    branch.name = payload.name
    branch.code = String(payload.code || '').toUpperCase()
    branch.address = payload.address
    pushAudit(state, currentUser().id, 'branch', branch.id, 'updated', branch, before)
    save()
    return { ok: true, message: 'Sucursal actualizada.' }
  }

  const selectBranch = (branchId) => {
    if (!state.branches.some((branch) => branch.id === branchId)) return { ok: false, message: 'Sucursal no encontrada.' }
    state.business.currentBranchId = branchId
    const currentRegister = getRegister(state, state.business.currentRegisterId)
    if (!currentRegister || currentRegister.branchId !== branchId) {
      state.business.currentRegisterId = state.registers.find((register) => register.branchId === branchId)?.id || ''
    }
    save()
    return { ok: true }
  }

  const selectRegister = (registerId) => {
    const register = getRegister(state, registerId)
    if (!register) return { ok: false, message: 'Caja no encontrada.' }
    state.business.currentBranchId = register.branchId
    state.business.currentRegisterId = register.id
    save()
    return { ok: true, message: 'Caja actual cambiada.' }
  }

  const createRegister = async (payload) => {
    const denied = ensurePermission(actionPermissions.registersManage)
    if (denied) return denied
    if (cloudCoreAdapter) {
      await cloudCoreAdapter.upsertRegister({
        id: null,
        branchId: payload.branchId,
        name: payload.name,
        code: String(payload.code || '').toUpperCase(),
        cashierUserId: payload.cashierUserId || null,
        isActive: true,
      })
      await syncFromCloud()
      return { ok: true, message: 'Caja creada.' }
    }
    const register = {
      id: makeId(),
      branchId: payload.branchId,
      name: payload.name,
      code: String(payload.code || '').toUpperCase(),
      cashierUserId: payload.cashierUserId || null,
      isActive: true,
    }
    state.registers.unshift(register)
    if (!state.business.currentRegisterId) state.business.currentRegisterId = register.id
    pushAudit(state, currentUser().id, 'register', register.id, 'created', register)
    save()
    return { ok: true, message: 'Caja creada.' }
  }

  const updateRegister = async (registerId, payload) => {
    const denied = ensurePermission(actionPermissions.registersManage)
    if (denied) return denied
    if (cloudCoreAdapter) {
      await cloudCoreAdapter.upsertRegister({
        id: registerId,
        branchId: payload.branchId,
        name: payload.name,
        code: String(payload.code || '').toUpperCase(),
        cashierUserId: payload.cashierUserId || null,
        isActive: true,
      })
      await syncFromCloud()
      return { ok: true, message: 'Caja actualizada.' }
    }
    const register = state.registers.find((entry) => entry.id === registerId)
    if (!register) return { ok: false, message: 'Caja no encontrada.' }
    const before = clone(register)
    register.branchId = payload.branchId
    register.name = payload.name
    register.code = String(payload.code || '').toUpperCase()
    register.cashierUserId = payload.cashierUserId || null
    if (state.business.currentRegisterId === register.id) state.business.currentBranchId = register.branchId
    pushAudit(state, currentUser().id, 'register', register.id, 'updated', register, before)
    save()
    return { ok: true, message: 'Caja actualizada.' }
  }

  const setModuleEnabled = async (moduleKey, enabled) => {
    const denied = ensurePermission(actionPermissions.settingsManage)
    if (denied) return denied
    if (!moduleCatalog[moduleKey]) return { ok: false, message: 'Modulo no encontrado.' }
    if (moduleKey === 'dashboard' || moduleKey === 'settings') return { ok: false, message: 'Inicio y Ajustes son accesos fijos para administradores.' }
    const current = new Set(state.business.enabledModules || modulePresets.full)
    if (enabled) current.add(moduleKey)
    else current.delete(moduleKey)
    current.add('dashboard')
    current.add('settings')
    const nextEnabledModules = [...current]
    if (cloudCoreAdapter) {
      const remoteRuntime = await cloudCoreAdapter.updateCommerceRuntime({
        activePlan: 'custom',
        enabledModules: nextEnabledModules,
      })
      state.business.enabledModules = Array.isArray(remoteRuntime?.enabled_modules) ? remoteRuntime.enabled_modules : nextEnabledModules
      state.business.activePlan = remoteRuntime?.active_plan || 'custom'
      save({ skipCloud: true })
    } else {
      state.business.enabledModules = nextEnabledModules
      state.business.activePlan = 'custom'
      save()
    }
    pushAudit(state, currentUser().id, 'business_module', moduleKey, enabled ? 'enabled' : 'disabled', { enabled })
    return { ok: true, message: `Modulo ${enabled ? 'habilitado' : 'deshabilitado'}.` }
  }

  const applyModulePreset = async (presetKey) => {
    const denied = ensurePermission(actionPermissions.settingsManage)
    if (denied) return denied
    const preset = modulePresets[presetKey]
    if (!preset) return { ok: false, message: 'Preset no encontrado.' }
    if (cloudCoreAdapter) {
      const remoteRuntime = await cloudCoreAdapter.updateCommerceRuntime({
        activePlan: presetKey,
        enabledModules: preset,
      })
      state.business.enabledModules = Array.isArray(remoteRuntime?.enabled_modules) ? remoteRuntime.enabled_modules : [...preset]
      state.business.activePlan = remoteRuntime?.active_plan || presetKey
      save({ skipCloud: true })
    } else {
      state.business.enabledModules = [...preset]
      state.business.activePlan = presetKey
      save()
    }
    pushAudit(state, currentUser().id, 'business_plan', presetKey, 'preset_applied', { presetKey, modules: preset })
    return { ok: true, message: `Plan ${presetKey} aplicado.` }
  }

  const updateBusinessProfile = async (payload) => {
    const denied = ensurePermission(actionPermissions.settingsManage)
    if (denied) return denied
    const before = clone(state.business)
    const normalizedPayload = {
      name: String(payload.name || state.business.name || '').trim() || state.business.name,
      legalName: String(payload.legalName || state.business.legalName || '').trim(),
      ownerEmail: String(payload.ownerEmail || state.business.ownerEmail || '').trim().toLowerCase(),
    }
    const remoteProfile = cloudCoreAdapter
      ? await cloudCoreAdapter.updateCommerceProfile(normalizedPayload)
      : null
    state.business.name = remoteProfile?.commerce_name || normalizedPayload.name
    state.business.legalName = remoteProfile?.legal_name || normalizedPayload.legalName
    state.business.ownerEmail = remoteProfile?.owner_email || normalizedPayload.ownerEmail
    pushAudit(state, currentUser().id, 'business', null, 'updated', clone(state.business), before)
    save({ skipCloud: Boolean(cloudCoreAdapter) })
    return { ok: true, message: 'Perfil del comercio actualizado.' }
  }

  const createProduct = async (payload) => {
    const denied = ensurePermission(actionPermissions.productsWrite)
    if (denied) return denied
    const branchId = getCurrentBranch(state)?.id || state.branches[0]?.id || ''
    if (!String(payload.name || '').trim()) return { ok: false, message: 'El producto necesita un nombre.' }
    if (cloudCoreAdapter) {
      await cloudCoreAdapter.upsertProduct({
        id: payload.id || null,
        name: String(payload.name || '').trim(),
        sku: String(payload.sku || '').trim(),
        barcode: String(payload.barcode || '').trim(),
        stock: Number(payload.stock || 0),
        salePrice: Number(payload.salePrice || 0),
        costPrice: Number(payload.costPrice || 0),
        minStock: Number(payload.minStock || 0),
        category: String(payload.category || '').trim(),
        trackStock: payload.trackStock !== false,
        branchId,
      })
      await syncFromCloud()
      return { ok: true, message: 'Producto guardado en la base real.' }
    }
    const product = {
      id: makeId(),
      name: payload.name,
      sku: payload.sku,
      barcode: String(payload.barcode || '').trim(),
      stock: Number(payload.stock),
      salePrice: Number(payload.salePrice),
      costPrice: Number(payload.costPrice),
      minStock: Number(payload.minStock),
      category: payload.category,
      trackStock: payload.trackStock,
      stockByBranch: branchId ? { [branchId]: Number(payload.stock) } : {},
    }
    syncProductStock(product)
    state.products.unshift(product)
    if (product.trackStock && product.stock > 0) {
      state.stockMovements.unshift({
        id: makeId(),
        productId: product.id,
        type: 'opening',
        quantity: product.stock,
        referenceId: product.id,
        notes: 'Stock inicial',
        createdAt: todayIso(),
        createdBy: currentUser().id,
        branchId: branchId || null,
      })
    }
    pushAudit(state, currentUser().id, 'product', product.id, 'created', product)
    save()
    return { ok: true, message: 'Producto creado.' }
  }

  const updateProduct = async (productId, payload) => {
    const denied = ensurePermission(actionPermissions.productsWrite)
    if (denied) return denied
    const product = state.products.find((item) => item.id === productId)
    if (!product) return { ok: false, message: 'No encontramos el producto a actualizar.' }
    if (!String(payload.name || '').trim()) return { ok: false, message: 'El producto necesita un nombre.' }

    const branchId = getCurrentBranch(state)?.id || state.branches[0]?.id || ''
    const before = clone(product)
    const normalized = {
      name: String(payload.name || '').trim(),
      sku: String(payload.sku || '').trim(),
      barcode: String(payload.barcode || '').trim(),
      salePrice: Number(payload.salePrice || 0),
      costPrice: Number(payload.costPrice || 0),
      minStock: Number(payload.minStock || 0),
      category: String(payload.category || '').trim(),
      trackStock: payload.trackStock !== false,
    }

    if (cloudCoreAdapter) {
      await cloudCoreAdapter.upsertProduct({
        id: product.id,
        ...normalized,
        stock: Number(product.stockByBranch?.[branchId] ?? product.stock ?? 0),
        branchId,
      })
      await syncFromCloud()
      return { ok: true, message: 'Producto actualizado.' }
    }

    Object.assign(product, normalized)
    syncProductStock(product)
    pushAudit(state, currentUser().id, 'product', product.id, 'updated', clone(product), before)
    save()
    return { ok: true, message: 'Producto actualizado.' }
  }

  const updateProductFromPurchase = async (productId, payload) => {
    const denied = ensurePermission(actionPermissions.purchasesWrite)
    if (denied) return denied
    const product = state.products.find((item) => item.id === productId)
    if (!product) return { ok: false, message: 'No encontramos el producto a actualizar.' }
    if (!String(payload.name || '').trim()) return { ok: false, message: 'El producto necesita un nombre.' }

    const branchId = getCurrentBranch(state)?.id || state.branches[0]?.id || ''
    const before = clone(product)
    const normalized = {
      name: String(payload.name || '').trim(),
      sku: String(payload.sku || '').trim(),
      barcode: String(payload.barcode || '').trim(),
      salePrice: Number(payload.salePrice || 0),
      costPrice: Number(payload.costPrice || 0),
      minStock: Number(payload.minStock || 0),
      category: String(payload.category || '').trim(),
      trackStock: payload.trackStock !== false,
    }

    if (cloudCoreAdapter) {
      await cloudCoreAdapter.upsertProduct({
        id: product.id,
        ...normalized,
        stock: Number(product.stockByBranch?.[branchId] ?? product.stock ?? 0),
        branchId,
      })
      await syncFromCloud()
      return { ok: true, message: 'Producto actualizado desde la compra.' }
    }

    Object.assign(product, normalized)
    syncProductStock(product)
    pushAudit(state, currentUser().id, 'product', product.id, 'updated_from_purchase', clone(product), before)
    save()
    return { ok: true, message: 'Producto actualizado desde la compra.' }
  }

  const importProducts = async (rows = [], mode = 'create-only') => {
    const denied = ensurePermission(actionPermissions.productsWrite)
    if (denied) return denied
    const branchId = getCurrentBranch(state)?.id || state.branches[0]?.id || ''
    let created = 0
    let updated = 0
    let skipped = 0

    const findExistingProduct = (row) => state.products.find((product) => (
      (row.sku && String(product.sku || '').trim().toLowerCase() === String(row.sku || '').trim().toLowerCase())
      || (row.barcode && String(product.barcode || '').trim().toLowerCase() === String(row.barcode || '').trim().toLowerCase())
    )) || null

    for (const row of rows) {
      const existing = findExistingProduct(row)
      if (existing && mode === 'create-only') {
        skipped += 1
        continue
      }

      if (cloudCoreAdapter) {
        await cloudCoreAdapter.upsertProduct({
          id: existing?.id || null,
          name: row.name,
          sku: row.sku,
          barcode: row.barcode,
          stock: Number(row.stock || 0),
          salePrice: Number(row.salePrice || 0),
          costPrice: Number(row.costPrice || 0),
          minStock: Number(row.minStock || 0),
          category: row.category || 'General',
          trackStock: row.trackStock !== false,
          branchId,
        })
      } else if (existing) {
        existing.name = row.name
        existing.sku = row.sku
        existing.barcode = row.barcode
        existing.salePrice = Number(row.salePrice || 0)
        existing.costPrice = Number(row.costPrice || 0)
        existing.minStock = Number(row.minStock || 0)
        existing.category = row.category || 'General'
        existing.trackStock = row.trackStock !== false
        existing.stockByBranch = existing.stockByBranch || {}
        existing.stockByBranch[branchId] = Number(row.stock || 0)
        syncProductStock(existing)
      } else {
        const product = {
          id: makeId(),
          name: row.name,
          sku: row.sku,
          barcode: row.barcode,
          stock: Number(row.stock || 0),
          salePrice: Number(row.salePrice || 0),
          costPrice: Number(row.costPrice || 0),
          minStock: Number(row.minStock || 0),
          category: row.category || 'General',
          trackStock: row.trackStock !== false,
          stockByBranch: branchId ? { [branchId]: Number(row.stock || 0) } : {},
        }
        syncProductStock(product)
        state.products.unshift(product)
      }

      if (existing) updated += 1
      else created += 1
    }

    if (cloudCoreAdapter) {
      await syncFromCloud()
    } else {
      pushAudit(state, currentUser().id, 'product_import', null, 'imported', { created, updated, skipped, total: rows.length })
      save()
    }

    return {
      ok: true,
      message: `Importacion lista. Nuevos: ${created}. Actualizados: ${updated}. Omitidos: ${skipped}.`,
    }
  }

  const createSupplier = async (payload) => {
    const denied = ensurePermission(actionPermissions.purchasesWrite)
    if (denied) return denied
    if (cloudCoreAdapter) {
      await cloudCoreAdapter.upsertSupplier({
        id: null,
        name: payload.name,
        contact: payload.contact,
        phone: payload.phone,
        email: payload.email || '',
        category: payload.category,
        balance: Number(payload.balance || 0),
        lastDelivery: payload.lastDelivery || null,
        notes: contactDetailsNotes(payload),
        isActive: true,
      })
      await syncFromCloud()
      return { ok: true, message: 'Proveedor creado.' }
    }
    const supplier = {
      id: makeId(),
      name: payload.name,
      contact: payload.contact,
      phone: payload.phone,
      email: payload.email || '',
      balance: Number(payload.balance),
      lastDelivery: payload.lastDelivery,
      category: payload.category,
      address: String(payload.address || '').trim(),
      cuit: String(payload.cuit || '').trim(),
      notes: String(payload.notes || '').trim(),
    }
    state.suppliers.unshift(supplier)
    pushAudit(state, currentUser().id, 'supplier', supplier.id, 'created', supplier)
    save()
    return { ok: true, message: 'Proveedor creado.' }
  }

  const updateSupplier = async (supplierId, payload) => {
    const supplier = state.suppliers.find((item) => item.id === supplierId)
    if (!supplier) return { ok: false, message: 'Proveedor no encontrado.' }
    const draft = { ...supplier, ...payload, id: supplierId, name: String(payload.name || '').trim(), notes: contactDetailsNotes(payload), isActive: true }
    if (!draft.name) return { ok: false, message: 'El proveedor necesita un nombre.' }
    if (cloudCoreAdapter) {
      await cloudCoreAdapter.upsertSupplier(draft)
      await syncFromCloud()
    } else {
      Object.assign(supplier, draft, contactDetailsFromNotes(draft.notes))
      save()
    }
    return { ok: true, message: 'Proveedor actualizado.' }
  }

  const createUser = async (payload) => {
    const denied = ensurePermission(actionPermissions.settingsManage)
    if (denied) return denied
    await migrateLegacyPinsIfNeeded()
    const normalizedLoginName = String(payload.loginName || '').trim().toLowerCase()
    const rawPin = String(payload.pin || '')
    if (!payload.fullName) return { ok: false, message: 'El usuario necesita un nombre.' }
    if (!normalizedLoginName) return { ok: false, message: 'El usuario necesita un nombre de acceso.' }
    if (!rawPin || rawPin.length < 6) return { ok: false, message: 'La clave debe tener al menos 6 caracteres.' }
    if (state.users.some((user) => String(user.loginName || '').trim().toLowerCase() === normalizedLoginName)) {
      return { ok: false, message: 'Ya existe un usuario con ese nombre de acceso.' }
    }
    if (!state.roles.some((role) => role.id === payload.roleId)) return { ok: false, message: 'Rol invalido.' }
    const userDraft = {
      id: makeId(),
      fullName: String(payload.fullName || '').trim(),
      roleId: payload.roleId,
      email: '',
      loginName: normalizedLoginName,
      allowedModules: normalizeStringList(payload.allowedModules, validModuleKeys),
      blockedPermissions: normalizeStringList(payload.blockedPermissions, validPermissionKeys),
      ...(await buildSecuredPinFields(String(payload.pin))),
      isActive: payload.isActive !== false,
    }
    const roleKey = roleKeysById[userDraft.roleId] || 'cashier'
    const remoteUser = cloudCoreAdapter
      ? await cloudCoreAdapter.upsertUser({
        id: null,
        fullName: userDraft.fullName,
        roleKey,
        loginName: userDraft.loginName,
        pin: rawPin,
        isActive: userDraft.isActive,
        allowedModules: userDraft.allowedModules,
        blockedPermissions: userDraft.blockedPermissions,
      })
      : userDraft
    state.users.unshift(normalizeCloudUser({
      ...remoteUser,
      id: remoteUser.id || userDraft.id,
      full_name: remoteUser.full_name || userDraft.fullName,
      email: remoteUser.email || userDraft.email,
      login_name: remoteUser.login_name || userDraft.loginName,
      role_key: remoteUser.role_key || roleKey,
      status: remoteUser.status || (userDraft.isActive ? 'active' : 'disabled'),
      is_owner: remoteUser.is_owner || false,
      allowed_modules: remoteUser.allowed_modules || userDraft.allowedModules,
      blocked_permissions: remoteUser.blocked_permissions || userDraft.blockedPermissions,
    }))
    pushAudit(state, currentUser().id, 'user', remoteUser.id || userDraft.id, 'created', { ...userDraft, pin: '****' })
    save({ skipCloud: Boolean(cloudCoreAdapter) })
    return { ok: true, message: 'Usuario creado.' }
  }

  const registerPublicUser = async (payload) => {
    await migrateLegacyPinsIfNeeded()
    const normalizedEmail = String(payload.email || '').trim().toLowerCase()
    const normalizedName = String(payload.fullName || '').trim()
    const normalizedLogin = normalizedEmail || normalizedName.toLowerCase().replace(/\s+/g, '.')
    if (!normalizedName) return { ok: false, message: 'La cuenta necesita un nombre.' }
    if (!payload.pin || String(payload.pin).length < 6) return { ok: false, message: 'La clave debe tener al menos 6 caracteres.' }
    if (state.users.some((user) => (
      String(user.email || '').trim().toLowerCase() === normalizedEmail
      || String(user.fullName || '').trim().toLowerCase() === normalizedName.toLowerCase()
      || String(user.email || '').trim().toLowerCase().split('@')[0] === normalizedLogin
    ))) {
      return { ok: false, message: 'Ya existe una cuenta con ese usuario, email o nombre.' }
    }
    const cashierRoleId = state.roles.find((role) => role.key === 'cashier')?.id || state.roles[0]?.id
    const user = {
      id: makeId(),
      fullName: normalizedName,
      roleId: cashierRoleId,
      email: normalizedEmail,
      ...(await buildSecuredPinFields(String(payload.pin))),
      isActive: true,
    }
    state.users.unshift(user)
    pushAudit(state, currentUser().id, 'user', user.id, 'registered', { ...user, pin: '****' })
    save()
    return { ok: true, message: 'Cuenta creada. Ya podes ingresar.' }
  }

  const updateUser = async (userId, payload) => {
    const denied = ensurePermission(actionPermissions.settingsManage)
    if (denied) return denied
    await migrateLegacyPinsIfNeeded()
    const user = state.users.find((entry) => entry.id === userId)
    if (!user) return { ok: false, message: 'Usuario no encontrado.' }
    const normalizedLoginName = String(payload.loginName || '').trim().toLowerCase()
    if (!payload.fullName) return { ok: false, message: 'El usuario necesita un nombre.' }
    if (!normalizedLoginName) return { ok: false, message: 'El usuario necesita un nombre de acceso.' }
    if (state.users.some((entry) => entry.id !== userId && String(entry.loginName || '').trim().toLowerCase() === normalizedLoginName)) {
      return { ok: false, message: 'Ya existe otro usuario con ese nombre de acceso.' }
    }
    if (!state.roles.some((role) => role.id === payload.roleId)) return { ok: false, message: 'Rol invalido.' }
    if (state.session.userId === user.id && payload.isActive === false) return { ok: false, message: 'No podes desactivar la sesion actual.' }
    const adminRoleId = state.roles.find((role) => role.key === 'admin')?.id
    const wouldRemainAdmin = state.users.filter((entry) => entry.id !== userId && entry.isActive && entry.roleId === adminRoleId).length
    if ((payload.roleId !== adminRoleId || payload.isActive === false) && user.roleId === adminRoleId && wouldRemainAdmin < 1) {
      return { ok: false, message: 'Necesitas al menos un administrador activo.' }
    }
    const before = { ...clone(user), pin: '****' }
    user.fullName = payload.fullName
    user.roleId = payload.roleId
    user.loginName = normalizedLoginName
    user.isActive = payload.isActive !== false
    user.allowedModules = normalizeStringList(payload.allowedModules, validModuleKeys)
    user.blockedPermissions = normalizeStringList(payload.blockedPermissions, validPermissionKeys)
    if (payload.pin) {
      if (String(payload.pin).length < 6) return { ok: false, message: 'La clave debe tener al menos 6 caracteres.' }
      Object.assign(user, await buildSecuredPinFields(String(payload.pin)))
    }
    if (cloudCoreAdapter) {
      const remoteUser = await cloudCoreAdapter.upsertUser({
        id: userId,
        fullName: user.fullName,
        roleKey: roleKeysById[user.roleId] || 'cashier',
        loginName: user.loginName,
        pin: payload.pin ? String(payload.pin) : null,
        isActive: user.isActive,
        allowedModules: user.allowedModules,
        blockedPermissions: user.blockedPermissions,
      })
      const normalizedRemote = normalizeCloudUser(remoteUser)
      if (normalizedRemote) {
        Object.assign(user, normalizedRemote)
      }
    }
    pushAudit(state, currentUser().id, 'user', user.id, 'updated', { ...clone(user), pin: '****' }, before)
    save({ skipCloud: Boolean(cloudCoreAdapter) })
    return { ok: true, message: 'Usuario actualizado.' }
  }

  const toggleUserActive = async (userId, isActive) => {
    const denied = ensurePermission(actionPermissions.settingsManage)
    if (denied) return denied
    const user = state.users.find((entry) => entry.id === userId)
    if (!user) return { ok: false, message: 'Usuario no encontrado.' }
    if (state.session.userId === user.id && !isActive) return { ok: false, message: 'No podes desactivar la sesion actual.' }
    const adminRoleId = state.roles.find((role) => role.key === 'admin')?.id
    const activeAdmins = state.users.filter((entry) => entry.isActive && entry.roleId === adminRoleId)
    if (!isActive && user.roleId === adminRoleId && activeAdmins.length <= 1) return { ok: false, message: 'Necesitas al menos un administrador activo.' }
    const before = clone(user)
    user.isActive = Boolean(isActive)
    if (cloudCoreAdapter) {
      const remoteUser = await cloudCoreAdapter.toggleUserActive({ id: userId, isActive: user.isActive })
      const normalizedRemote = normalizeCloudUser(remoteUser)
      if (normalizedRemote) {
        Object.assign(user, normalizedRemote)
      }
    }
    pushAudit(state, currentUser().id, 'user', user.id, user.isActive ? 'enabled' : 'disabled', { ...clone(user), pin: '****' }, { ...before, pin: '****' })
    save({ skipCloud: Boolean(cloudCoreAdapter) })
    return { ok: true, message: `Usuario ${user.isActive ? 'habilitado' : 'deshabilitado'}.` }
  }

  const openCashSession = async ({ openingAmount, registerId }) => {
    const denied = ensurePermission(actionPermissions.cashOperate)
    if (denied) return denied
    const branch = getCurrentBranch(state)
    const targetRegisterId = registerId
      || state.business.currentRegisterId
      || state.registers.find((entry) => entry.branchId === branch?.id)?.id
      || state.registers[0]?.id
      || ''
    if (!targetRegisterId) return { ok: false, message: 'No hay una caja disponible para abrir.' }
    state.business.currentRegisterId = targetRegisterId
    if (cloudCoreAdapter) {
      await cloudCoreAdapter.openCashSession({
        registerId: targetRegisterId,
        openingAmount,
      })
      await syncFromCloud()
      return { ok: true, message: 'Caja abierta correctamente.' }
    }
    if (getOpenCashSession(state)) return { ok: false, message: 'Ya hay una caja abierta.' }
    const register = getScopedRegister(state, targetRegisterId, branch?.id)
    if (!register) return { ok: false, message: 'Elegi una caja activa para abrir la caja.' }
    const session = {
      id: makeId(),
      openedBy: currentUser().id,
      openingAmount: Number(openingAmount || 0),
      status: 'open',
      openedAt: todayIso(),
      closedAt: null,
      countedAmount: null,
      differenceAmount: null,
      branchId: branch?.id || null,
      registerId: register.id,
    }
    state.cashSessions.unshift(session)
    pushAudit(state, currentUser().id, 'cash_session', session.id, 'opened', session)
    save()
    return { ok: true, message: 'Caja abierta correctamente.' }
  }

  const closeCashSession = async ({ countedAmount, cashSessionId }) => {
    const denied = ensurePermission(actionPermissions.cashOperate)
    if (denied) return denied
    if (cloudCoreAdapter) {
      await cloudCoreAdapter.closeCashSession({
        cashSessionId: cashSessionId || getOpenCashSession(state)?.id || null,
        countedAmount,
      })
      await syncFromCloud()
      return { ok: true, message: 'Caja cerrada correctamente.' }
    }
    const session = getOpenCashSession(state)
    if (!session) return { ok: false, message: 'No hay caja abierta.' }
    const cashSales = state.sales
      .filter((sale) => sale.cashSessionId === session.id)
      .reduce((sum, sale) => sum + getCashPortion(sale.paymentBreakdown), 0)
    const manualDelta = getCashMovementDelta(state, session.id)
    session.countedAmount = Number(countedAmount || 0)
    session.closedAt = todayIso()
    session.status = 'closed'
    session.differenceAmount = session.countedAmount - (Number(session.openingAmount) + cashSales + manualDelta)
    pushAudit(state, currentUser().id, 'cash_session', session.id, 'closed', session)
    save()
    return { ok: true, message: 'Caja cerrada correctamente.' }
  }

  const createCashMovement = async (payload) => {
    const denied = ensurePermission(actionPermissions.cashOperate)
    if (denied) return denied
    if (cloudCoreAdapter) {
      await cloudCoreAdapter.createCashMovement({
        cashSessionId: payload.cashSessionId || getOpenCashSession(state)?.id || null,
        kind: payload.kind,
        amount: payload.amount,
        note: payload.note,
      })
      await syncFromCloud()
      return { ok: true, message: 'Movimiento de caja registrado.' }
    }
    const session = getOpenCashSession(state)
    if (!session) return { ok: false, message: 'No hay caja abierta para registrar movimientos.' }
    const amount = Number(payload.amount || 0)
    if (amount <= 0) return { ok: false, message: 'El importe debe ser mayor a cero.' }
    const negativeKinds = new Set(['expense', 'withdrawal'])
    const movement = {
      id: makeId(),
      cashSessionId: session.id,
      branchId: session.branchId || getCurrentBranch(state)?.id || null,
      registerId: session.registerId || getCurrentRegister(state)?.id || null,
      createdBy: currentUser().id,
      kind: payload.kind || 'income',
      signedAmount: negativeKinds.has(payload.kind) ? amount * -1 : amount,
      note: payload.note || '',
      createdAt: todayIso(),
    }
    state.cashMovements.unshift(movement)
    pushAudit(state, currentUser().id, 'cash_movement', movement.id, 'created', movement)
    save()
    return { ok: true, message: 'Movimiento de caja registrado.' }
  }

  const createSale = async (payload) => {
    const denied = ensurePermission(actionPermissions.salesWrite)
    if (denied) return denied
    if (cloudCoreAdapter) {
      const currentBranch = getCurrentBranch(state)
      const currentRegister = getCurrentRegister(state)
      const result = await cloudCoreAdapter.createSale({
        ...payload,
        operationId: payload.operationId || makeOperationId(),
        branchId: payload.branchId || currentBranch?.id || null,
        registerId: payload.registerId || currentRegister?.id || null,
      })
      await syncFromCloud()
      return { ok: true, message: result?.invoice_id ? 'Venta registrada y comprobante generado.' : 'Venta registrada.' }
    }
    const items = payload.items
      .map((item) => buildSaleItem(item.productId, item.quantity, state))
      .filter(Boolean)
    if (!items.length) return { ok: false, message: 'Cargá al menos un articulo.' }
    const currentBranch = getCurrentBranch(state)
    const stockCheck = ensureSaleStock(state, items, currentBranch?.id || null)
    if (!stockCheck.ok) return stockCheck
    const subtotalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0)
    const discountAmount = Math.max(0, Math.min(Number(payload.discountAmount || 0), subtotalAmount))
    const totalAmount = subtotalAmount - discountAmount
    const effectiveBreakdown = getPaymentBreakdown(payload, totalAmount)
    const openSession = getOpenCashSession(state)
    if (getCashPortion(effectiveBreakdown) > 0 && !openSession) {
      return { ok: false, message: 'No podes cobrar en efectivo sin una caja abierta.' }
    }
    const branchId = getCashPortion(effectiveBreakdown) > 0 ? (openSession.branchId || currentBranch?.id || null) : (currentBranch?.id || null)
    const rawPaid = payload.isPaid ? totalAmount : Object.values(effectiveBreakdown).reduce((sum, value) => sum + Number(value || 0), 0)
    const amountPaid = Math.max(0, Math.min(rawPaid, totalAmount))
    if (rawPaid > totalAmount) return { ok: false, message: 'El monto cobrado no puede superar el total.' }
    const register = getCashPortion(effectiveBreakdown) > 0
      ? getRegister(state, openSession?.registerId)
      : getScopedRegister(state, state.business.currentRegisterId, currentBranch?.id)
    const sale = {
      id: makeId(),
      items,
      customerId: payload.customerId || null,
      sellerUserId: currentUser().id,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotalAmount,
      discountAmount,
      totalAmount,
      amountPaid,
      channel: payload.channel,
      paymentMethod: payload.paymentMethod,
      paymentBreakdown: effectiveBreakdown,
      status: getSaleStatus(totalAmount, amountPaid),
      note: payload.note || '',
      soldAt: todayIso(),
      cashSessionId: getCashPortion(effectiveBreakdown) > 0 ? openSession?.id || null : null,
      branchId,
      registerId: register?.id || null,
    }

    state.sales.unshift(sale)
    applySaleEffects(state, sale)
    const invoiceResult = payload.autoInvoice && amountPaid > 0 ? buildInvoiceForSale(state, sale.id) : null
    pushAudit(state, currentUser().id, 'sale', sale.id, 'created', sale)
    save()
    return { ok: true, message: invoiceResult?.ok ? 'Venta registrada y comprobante generado.' : 'Venta registrada.' }
  }

  const updateSale = (saleId, payload) => {
    const denied = ensurePermission(actionPermissions.salesWrite)
    if (denied) return denied
    const sale = state.sales.find((entry) => entry.id === saleId)
    if (!sale) return { ok: false, message: 'Venta no encontrada.' }

    const items = payload.items
      .map((item) => buildSaleItem(item.productId, item.quantity, state))
      .filter(Boolean)
    if (!items.length) return { ok: false, message: 'Cargá al menos un articulo.' }
    const paymentBreakdown = getPaymentBreakdown(payload, 0)
    if (getCashPortion(paymentBreakdown) > 0 && !getOpenCashSession(state)) return { ok: false, message: 'No podes cobrar en efectivo sin una caja abierta.' }

    const before = clone(sale)
    const openSession = getOpenCashSession(state)
    const currentBranch = getCurrentBranch(state)
    const branchId = getCashPortion(paymentBreakdown) > 0 ? (openSession?.branchId || currentBranch?.id || null) : (currentBranch?.id || null)
    const stockCheck = ensureSaleStock(state, items, branchId, saleId)
    if (!stockCheck.ok) return stockCheck
    const subtotalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0)
    const discountAmount = Math.max(0, Math.min(Number(payload.discountAmount || 0), subtotalAmount))
    const totalAmount = subtotalAmount - discountAmount
    const effectiveBreakdown = getPaymentBreakdown(payload, totalAmount)
    const rawPaid = payload.isPaid ? totalAmount : Object.values(effectiveBreakdown).reduce((sum, value) => sum + Number(value || 0), 0)
    const amountPaid = Math.max(0, Math.min(rawPaid, totalAmount))
    if (rawPaid > totalAmount) return { ok: false, message: 'El monto cobrado no puede superar el total.' }
    const register = getCashPortion(effectiveBreakdown) > 0
      ? getRegister(state, openSession?.registerId)
      : getScopedRegister(state, state.business.currentRegisterId, currentBranch?.id)
    revertSaleEffects(state, sale)
    sale.items = items
    sale.customerId = payload.customerId || null
    sale.totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
    sale.subtotalAmount = subtotalAmount
    sale.discountAmount = discountAmount
    sale.totalAmount = totalAmount
    sale.amountPaid = amountPaid
    sale.channel = payload.channel
    sale.paymentMethod = payload.paymentMethod
    sale.paymentBreakdown = effectiveBreakdown
    sale.status = getSaleStatus(totalAmount, amountPaid)
    sale.note = payload.note || ''
    sale.cashSessionId = getCashPortion(effectiveBreakdown) > 0 ? openSession?.id || null : null
    sale.branchId = branchId
    sale.registerId = register?.id || null
    applySaleEffects(state, sale)

    if (payload.autoInvoice && amountPaid > 0 && !getInvoiceBySaleId(state, saleId)) {
      buildInvoiceForSale(state, saleId)
    }

    pushAudit(state, currentUser().id, 'sale', sale.id, 'updated', sale, before)
    save()
    return { ok: true, message: 'Venta actualizada.' }
  }

  const createInvoiceFromSale = async (saleId) => {
    const denied = ensurePermission(actionPermissions.invoicesWrite)
    if (denied) return denied
    if (cloudCoreAdapter) {
      const sale = state.sales.find((entry) => entry.id === saleId)
      if (!sale) return { ok: false, message: 'Venta no encontrada.' }
      await cloudCoreAdapter.upsertDocument({
        id: null,
        branchId: sale.branchId || getCurrentBranch(state)?.id || null,
        saleId: sale.id,
        customerId: sale.customerId,
        relatedDocumentId: null,
        number: generateInternalInvoiceNumber(state, sale.branchId),
        kind: 'factura',
        type: 'X',
        status: sale.status === 'completed' ? 'Cobrada' : 'Emitida',
        fiscalStatus: 'Interno',
        totalAmount: Number(sale.totalAmount || 0),
        payloadJson: {
          source: 'sale',
          saleId: sale.id,
        },
      })
      await syncFromCloud()
      return { ok: true, message: 'Factura creada desde la venta.' }
    }
    const sale = state.sales.find((entry) => entry.id === saleId)
    if (!sale) return { ok: false, message: 'Venta no encontrada.' }
    const existing = state.invoices.find((invoice) => invoice.saleId === saleId)
    if (existing) return { ok: false, message: 'Esa venta ya tiene una factura.' }

    const result = buildInvoiceForSale(state, saleId)
    if (result.ok) save()
    return result
  }

  const cancelSale = (saleId, reason = 'Anulacion manual') => {
    const denied = ensurePermission(actionPermissions.salesWrite)
    if (denied) return denied
    const sale = state.sales.find((entry) => entry.id === saleId)
    if (!sale) return { ok: false, message: 'Venta no encontrada.' }
    if (sale.status === 'cancelled') return { ok: false, message: 'La venta ya esta anulada.' }
    const before = clone(sale)
    revertSaleEffects(state, sale)
    sale.status = 'cancelled'
    sale.amountPaid = 0
    sale.paymentBreakdown = { cash: 0, transfer: 0, mercadoPago: 0, account: 0 }
    sale.note = [sale.note, `Anulada: ${reason}`].filter(Boolean).join(' | ')
    state.invoices = state.invoices.map((invoice) => invoice.saleId === sale.id ? { ...invoice, status: 'Anulada', fiscalStatus: 'Anulado' } : invoice)
    pushAudit(state, currentUser().id, 'sale', sale.id, 'cancelled', sale, before)
    save()
    return { ok: true, message: 'Venta anulada y movimientos revertidos.' }
  }

  const createReturnFromSale = (saleId, reason = 'Devolucion total') => {
    const denied = ensurePermission(actionPermissions.salesWrite)
    if (denied) return denied
    const sale = state.sales.find((entry) => entry.id === saleId)
    if (!sale) return { ok: false, message: 'Venta no encontrada.' }
    if (sale.status === 'returned') return { ok: false, message: 'La venta ya fue devuelta.' }
    for (const item of sale.items || []) {
      const product = getProduct(state, item.productId)
      if (product?.trackStock) {
        changeBranchStock(product, sale.branchId, Number(item.quantity || 0), state.business.currentBranchId || state.branches[0]?.id || '')
        state.stockMovements.unshift({
          id: makeId(),
          productId: item.productId,
          type: 'return',
          quantity: Number(item.quantity || 0),
          referenceId: sale.id,
          notes: `Devolucion de venta: ${reason}`,
          createdAt: todayIso(),
          createdBy: currentUser().id,
          branchId: sale.branchId || null,
          registerId: sale.registerId || null,
        })
      }
    }
    if (sale.customerId) {
      const customer = getCustomer(state, sale.customerId)
      if (customer) customer.balance = Math.max(0, Number(customer.balance || 0) - Number(sale.totalAmount || 0))
    }
    const note = {
      id: makeId(),
      number: generateDocumentNumber(state, 'Nota de credito', 'B', sale.branchId),
      branchId: sale.branchId || getCurrentBranch(state)?.id || null,
      customerId: sale.customerId || null,
      totalAmount: Number(sale.totalAmount || 0),
      status: 'Emitida',
      dueDate: todayDate(),
      type: 'B',
      kind: 'Nota de credito',
      fiscalStatus: 'Pendiente',
      relatedDocumentId: getInvoiceBySaleId(state, sale.id)?.id || null,
      saleId: sale.id,
    }
    state.invoices.unshift(note)
    const before = clone(sale)
    sale.status = 'returned'
    sale.note = [sale.note, `Devuelta: ${reason}`].filter(Boolean).join(' | ')
    pushAudit(state, currentUser().id, 'sale', sale.id, 'returned', sale, before)
    pushAudit(state, currentUser().id, 'invoice', note.id, 'created_from_return', note)
    save()
    return { ok: true, message: 'Devolucion registrada y nota de credito generada.' }
  }

  const createTicketFromSale = async (saleId) => {
    const denied = ensurePermission(actionPermissions.ticketsWrite)
    if (denied) return denied
    if (cloudCoreAdapter) {
      const sale = state.sales.find((entry) => entry.id === saleId)
      if (!sale) return { ok: false, message: 'Venta no encontrada.' }
      if (!sale.customerId) return { ok: false, message: 'La venta necesita cliente para generar ticket.' }
      const summary = (sale.items || [])
        .map((item) => {
          const product = getProduct(state, item.productId)
          return `${product?.name || 'Articulo'} x${item.quantity}`
        })
        .join(', ')
      await cloudCoreAdapter.upsertDocument({
        id: null,
        branchId: sale.branchId || getCurrentBranch(state)?.id || null,
        saleId: sale.id,
        customerId: sale.customerId,
        relatedDocumentId: null,
        number: generateTicketNumber(state, 'POST', sale.branchId),
        kind: 'ticket',
        type: 'B',
        status: 'Recibido',
        fiscalStatus: 'Interno',
        totalAmount: 0,
        payloadJson: {
          source: 'sale',
          saleId: sale.id,
          device: 'Seguimiento postventa',
          issue: summary,
        },
      })
      await syncFromCloud()
      return { ok: true, message: 'Ticket generado desde la venta.' }
    }
    const sale = state.sales.find((entry) => entry.id === saleId)
    if (!sale) return { ok: false, message: 'Venta no encontrada.' }
    if (!sale.customerId) return { ok: false, message: 'La venta necesita cliente para generar ticket.' }

    const summary = sale.items
      .map((item) => {
        const product = getProduct(state, item.productId)
        return `${product?.name || 'Articulo'} x${item.quantity}`
      })
      .join(', ')

    const ticket = {
      id: makeId(),
      number: generateTicketNumber(state, 'POST', sale.branchId),
      customerId: sale.customerId,
      device: 'Seguimiento postventa',
      issue: summary,
      status: 'Recibido',
      updatedAt: todayDate(),
      saleId,
      branchId: sale.branchId || getCurrentBranch(state)?.id || null,
    }
    state.tickets.unshift(ticket)
    pushAudit(state, currentUser().id, 'ticket', ticket.id, 'created_from_sale', ticket)
    save()
    return { ok: true, message: 'Ticket generado desde la venta.' }
  }

  const createPurchaseReceipt = async (payload) => {
    const denied = ensurePermission(actionPermissions.purchasesWrite)
    if (denied) return denied
    if (cloudCoreAdapter) {
      await cloudCoreAdapter.upsertPurchaseReceipt({
        id: null,
        supplierId: payload.supplierId,
        productId: payload.productId,
        documentNumber: payload.documentNumber || '',
        quantity: Number(payload.quantity || 0),
        unitCost: Number(payload.unitCost || 0),
        note: payload.note || '',
        branchId: getCurrentBranch(state)?.id || null,
      })
      await syncFromCloud()
      return { ok: true, message: 'Recepcion registrada.' }
    }
    const product = getProduct(state, payload.productId)
    const supplier = state.suppliers.find((entry) => entry.id === payload.supplierId)
    if (!product || !supplier) return { ok: false, message: 'Proveedor o producto invalido.' }
    const quantity = Number(payload.quantity)
    const unitCost = Number(payload.unitCost)
    const receipt = {
      id: makeId(),
      supplierId: supplier.id,
      productId: product.id,
      documentNumber: payload.documentNumber || '',
      quantity,
      unitCost,
      totalCost: quantity * unitCost,
      note: payload.note || '',
      receivedAt: todayIso(),
      receivedBy: currentUser().id,
      branchId: getCurrentBranch(state)?.id || null,
    }
    state.purchaseReceipts.unshift(receipt)
    applyPurchaseEffects(state, receipt)
    pushAudit(state, currentUser().id, 'purchase_receipt', receipt.id, 'created', receipt)
    save()
    return { ok: true, message: 'Recepcion registrada.' }
  }

  const createStockAdjustment = (payload) => {
    const denied = ensurePermission(actionPermissions.productsAdjust)
    if (denied) return denied
    const product = getProduct(state, payload.productId)
    if (!product) return { ok: false, message: 'Producto no encontrado.' }
    const quantity = Number(payload.quantity || 0)
    if (!quantity) return { ok: false, message: 'La cantidad debe ser distinta de cero.' }
    const branchId = getCurrentBranch(state)?.id || state.branches[0]?.id || ''
    if (quantity < 0 && getBranchStock(product, branchId, branchId) < Math.abs(quantity)) return { ok: false, message: 'No hay stock suficiente en esta sucursal para descontar esa cantidad.' }
    changeBranchStock(product, branchId, quantity, branchId)
    const movement = {
      id: makeId(),
      productId: product.id,
      type: quantity > 0 ? 'adjustment_in' : 'adjustment_out',
      quantity,
      referenceId: product.id,
      notes: payload.note || 'Ajuste manual de stock',
      createdAt: todayIso(),
      createdBy: currentUser().id,
      branchId: branchId || null,
      registerId: null,
    }
    state.stockMovements.unshift(movement)
    pushAudit(state, currentUser().id, 'stock_adjustment', movement.id, 'created', movement)
    save()
    return { ok: true, message: 'Ajuste de stock aplicado.' }
  }

  const transferStock = (payload) => {
    const denied = ensurePermission(actionPermissions.productsTransfer)
    if (denied) return denied
    const product = getProduct(state, payload.productId)
    if (!product) return { ok: false, message: 'Producto no encontrado.' }
    const quantity = Number(payload.quantity || 0)
    if (quantity <= 0) return { ok: false, message: 'La cantidad debe ser mayor a cero.' }
    if (payload.fromBranchId === payload.toBranchId) return { ok: false, message: 'La sucursal origen y destino no pueden ser la misma.' }
    const fromBranch = getBranch(state, payload.fromBranchId)
    const toBranch = getBranch(state, payload.toBranchId)
    if (!fromBranch || !toBranch) return { ok: false, message: 'Sucursal invalida.' }
    if (getBranchStock(product, fromBranch.id, state.business.currentBranchId || state.branches[0]?.id || '') < quantity) {
      return { ok: false, message: `No hay stock suficiente en ${fromBranch.name} para transferir.` }
    }
    changeBranchStock(product, fromBranch.id, quantity * -1, state.business.currentBranchId || state.branches[0]?.id || '')
    changeBranchStock(product, toBranch.id, quantity, state.business.currentBranchId || state.branches[0]?.id || '')
    const transferId = makeId()
    state.stockMovements.unshift({
      id: makeId(),
      productId: product.id,
      type: 'transfer_out',
      quantity: quantity * -1,
      referenceId: transferId,
      notes: payload.note || `Transferencia a ${toBranch.name}`,
      createdAt: todayIso(),
      createdBy: currentUser().id,
      branchId: fromBranch.id,
      registerId: null,
    })
    state.stockMovements.unshift({
      id: makeId(),
      productId: product.id,
      type: 'transfer_in',
      quantity,
      referenceId: transferId,
      notes: payload.note || `Transferencia desde ${fromBranch.name}`,
      createdAt: todayIso(),
      createdBy: currentUser().id,
      branchId: toBranch.id,
      registerId: null,
    })
    pushAudit(state, currentUser().id, 'stock_transfer', transferId, 'created', { productId: product.id, quantity, fromBranchId: fromBranch.id, toBranchId: toBranch.id, note: payload.note || '' })
    save()
    return { ok: true, message: 'Transferencia registrada entre sucursales.' }
  }

  const updatePurchaseReceipt = async (receiptId, payload) => {
    const denied = ensurePermission(actionPermissions.purchasesWrite)
    if (denied) return denied
    if (cloudCoreAdapter) {
      await cloudCoreAdapter.upsertPurchaseReceipt({
        id: receiptId,
        supplierId: payload.supplierId,
        productId: payload.productId,
        documentNumber: payload.documentNumber || '',
        quantity: Number(payload.quantity || 0),
        unitCost: Number(payload.unitCost || 0),
        note: payload.note || '',
        branchId: payload.branchId || getCurrentBranch(state)?.id || null,
      })
      await syncFromCloud()
      return { ok: true, message: 'Recepcion actualizada.' }
    }
    const receipt = state.purchaseReceipts.find((entry) => entry.id === receiptId)
    if (!receipt) return { ok: false, message: 'Recepcion no encontrada.' }
    const before = clone(receipt)
    revertPurchaseEffects(state, receipt)
    receipt.supplierId = payload.supplierId
    receipt.productId = payload.productId
    receipt.documentNumber = payload.documentNumber || ''
    receipt.quantity = Number(payload.quantity)
    receipt.unitCost = Number(payload.unitCost)
    receipt.totalCost = receipt.quantity * receipt.unitCost
    receipt.note = payload.note || ''
    receipt.branchId = payload.branchId || receipt.branchId || getCurrentBranch(state)?.id || null
    applyPurchaseEffects(state, receipt)
    pushAudit(state, currentUser().id, 'purchase_receipt', receipt.id, 'updated', receipt, before)
    save()
    return { ok: true, message: 'Recepcion actualizada.' }
  }

  const createInvoice = async (payload) => {
    const denied = ensurePermission(actionPermissions.invoicesWrite)
    if (denied) return denied
    if (cloudCoreAdapter) {
      await cloudCoreAdapter.upsertDocument({
        id: null,
        branchId: payload.branchId || getCurrentBranch(state)?.id || null,
        saleId: payload.saleId || null,
        customerId: payload.customerId || null,
        relatedDocumentId: payload.relatedDocumentId || null,
        number: payload.number || generateDocumentNumber(state, payload.kind || 'Factura', payload.type || 'B', payload.branchId || getCurrentBranch(state)?.id),
        kind: normalizeDocumentKind(payload.kind || 'Factura'),
        type: payload.type || 'B',
        status: payload.status || 'Emitida',
        fiscalStatus: payload.fiscalStatus || 'Pendiente',
        totalAmount: Number(payload.totalAmount || 0),
        payloadJson: {
          dueDate: payload.dueDate || '',
        },
      })
      await syncFromCloud()
      return { ok: true, message: 'Comprobante guardado.' }
    }
    const invoice = {
      id: makeId(),
      number: payload.number || generateDocumentNumber(state, payload.kind || 'Factura', payload.type || 'B', payload.branchId || getCurrentBranch(state)?.id),
      branchId: payload.branchId || getCurrentBranch(state)?.id || null,
      customerId: payload.customerId || null,
      totalAmount: Number(payload.totalAmount),
      status: payload.status,
      dueDate: payload.dueDate,
      type: payload.type,
      kind: payload.kind || 'Factura',
      fiscalStatus: payload.fiscalStatus || 'Pendiente',
      relatedDocumentId: payload.relatedDocumentId || null,
      saleId: payload.saleId || null,
    }
    state.invoices.unshift(invoice)
    pushAudit(state, currentUser().id, 'invoice', invoice.id, 'created', invoice)
    save()
    return { ok: true, message: 'Comprobante guardado.' }
  }

  const updateInvoice = async (invoiceId, payload) => {
    const denied = ensurePermission(actionPermissions.invoicesWrite)
    if (denied) return denied
    if (cloudCoreAdapter) {
      await cloudCoreAdapter.upsertDocument({
        id: invoiceId,
        branchId: payload.branchId || getCurrentBranch(state)?.id || null,
        saleId: payload.saleId || null,
        customerId: payload.customerId || null,
        relatedDocumentId: payload.relatedDocumentId || null,
        number: payload.number || '',
        kind: normalizeDocumentKind(payload.kind || 'Factura'),
        type: payload.type || 'B',
        status: payload.status || 'Emitida',
        fiscalStatus: payload.fiscalStatus || 'Pendiente',
        totalAmount: Number(payload.totalAmount || 0),
        payloadJson: {
          dueDate: payload.dueDate || '',
        },
      })
      await syncFromCloud()
      return { ok: true, message: 'Factura actualizada.' }
    }
    const invoice = state.invoices.find((entry) => entry.id === invoiceId)
    if (!invoice) return { ok: false, message: 'Factura no encontrada.' }
    const before = clone(invoice)
    invoice.number = payload.number || invoice.number
    invoice.branchId = payload.branchId || invoice.branchId || getCurrentBranch(state)?.id || null
    invoice.customerId = payload.customerId || null
    invoice.totalAmount = Number(payload.totalAmount)
    invoice.status = payload.status
    invoice.dueDate = payload.dueDate
    invoice.type = payload.type
    invoice.kind = payload.kind || invoice.kind || 'Factura'
    invoice.fiscalStatus = payload.fiscalStatus || invoice.fiscalStatus || 'Pendiente'
    invoice.relatedDocumentId = payload.relatedDocumentId || invoice.relatedDocumentId || null
    pushAudit(state, currentUser().id, 'invoice', invoice.id, 'updated', invoice, before)
    save()
    return { ok: true, message: 'Factura actualizada.' }
  }

  const createTicket = async (payload) => {
    const denied = ensurePermission(actionPermissions.ticketsWrite)
    if (denied) return denied
    const customerId = String(payload?.customerId || '').trim()
    const device = String(payload?.device || '').trim()
    const issue = String(payload?.issue || '').trim()
    const branchId = payload?.branchId || getCurrentBranch(state)?.id || null
    if (!customerId || !device || !issue) return { ok: false, message: 'Completá cliente, equipo y detalle para guardar el ticket.' }
    if (!branchId) return { ok: false, message: 'Seleccioná una sucursal antes de guardar el ticket.' }
    if (!getCustomer(state, customerId)) return { ok: false, message: 'El cliente seleccionado ya no está disponible. Actualizá la pantalla e intentá otra vez.' }
    if (cloudCoreAdapter) {
      const number = payload.number || generateTicketNumber(state, 'TEC', branchId)
      const saved = await cloudCoreAdapter.upsertDocument({
        id: null,
        branchId,
        saleId: payload.saleId || null,
        customerId,
        relatedDocumentId: null,
        number,
        kind: 'ticket',
        type: 'B',
        status: payload.status || 'Recibido',
        fiscalStatus: 'Interno',
        totalAmount: 0,
        payloadJson: {
          device,
          issue,
        },
      })
      await syncFromCloud()
      // Algunas instalaciones todavía devuelven un snapshot anterior al
      // documento recién creado. No ocultamos una operación confirmada por eso.
      if (!state.tickets.some((ticket) => ticket.id === saved?.id)) {
        state.tickets.unshift({
          id: saved?.id || makeId(),
          number: saved?.document_number || number,
          branchId,
          customerId,
          device,
          issue,
          status: payload.status || 'Recibido',
          updatedAt: todayIso(),
        })
        persistLocalState()
      }
      return { ok: true, message: 'Ticket guardado.' }
    }
    const ticket = {
      id: makeId(),
      number: payload.number || generateTicketNumber(state, 'TEC', payload.branchId || getCurrentBranch(state)?.id),
      branchId,
      customerId,
      device,
      issue,
      status: payload.status,
      updatedAt: todayDate(),
    }
    state.tickets.unshift(ticket)
    pushAudit(state, currentUser().id, 'ticket', ticket.id, 'created', ticket)
    save()
    return { ok: true, message: 'Ticket guardado.' }
  }

  const updateTicket = async (ticketId, payload) => {
    const denied = ensurePermission(actionPermissions.ticketsWrite)
    if (denied) return denied
    const customerId = String(payload?.customerId || '').trim()
    const device = String(payload?.device || '').trim()
    const issue = String(payload?.issue || '').trim()
    const branchId = payload?.branchId || getCurrentBranch(state)?.id || null
    if (!customerId || !device || !issue) return { ok: false, message: 'Completá cliente, equipo y detalle para guardar el ticket.' }
    if (!branchId) return { ok: false, message: 'Seleccioná una sucursal antes de guardar el ticket.' }
    if (!getCustomer(state, customerId)) return { ok: false, message: 'El cliente seleccionado ya no está disponible. Actualizá la pantalla e intentá otra vez.' }
    if (cloudCoreAdapter) {
      const number = payload.number || generateTicketNumber(state, 'TEC', branchId)
      const saved = await cloudCoreAdapter.upsertDocument({
        id: ticketId,
        branchId,
        saleId: payload.saleId || null,
        customerId,
        relatedDocumentId: null,
        number,
        kind: 'ticket',
        type: 'B',
        status: payload.status || 'Recibido',
        fiscalStatus: 'Interno',
        totalAmount: 0,
        payloadJson: {
          device,
          issue,
        },
      })
      await syncFromCloud()
      const savedTicket = state.tickets.find((ticket) => ticket.id === saved?.id)
      if (!savedTicket) {
        state.tickets.unshift({ id: saved?.id || ticketId, number: saved?.document_number || number, branchId, customerId, device, issue, status: payload.status || 'Recibido', updatedAt: todayIso() })
      }
      persistLocalState()
      return { ok: true, message: 'Ticket actualizado.' }
    }
    const ticket = state.tickets.find((entry) => entry.id === ticketId)
    if (!ticket) return { ok: false, message: 'Ticket no encontrado.' }
    const before = clone(ticket)
    ticket.number = payload.number || ticket.number
    ticket.branchId = branchId
    ticket.customerId = customerId
    ticket.device = device
    ticket.issue = issue
    ticket.status = payload.status
    ticket.updatedAt = todayDate()
    pushAudit(state, currentUser().id, 'ticket', ticket.id, 'updated', ticket, before)
    save()
    return { ok: true, message: 'Ticket actualizado.' }
  }

  const removeEntity = async (entity, id) => {
    const permissionByEntity = {
      customer: actionPermissions.customersWrite,
      sale: actionPermissions.salesWrite,
      product: actionPermissions.productsWrite,
      supplier: actionPermissions.purchasesWrite,
      invoice: actionPermissions.invoicesWrite,
      ticket: actionPermissions.ticketsWrite,
      cash_movement: actionPermissions.cashOperate,
      branch: actionPermissions.branchesManage,
      register: actionPermissions.registersManage,
      purchase_receipt: actionPermissions.purchasesWrite,
    }
    const denied = permissionByEntity[entity] ? ensurePermission(permissionByEntity[entity]) : null
    if (denied) return denied
    const map = {
      customer: 'customers',
      sale: 'sales',
      product: 'products',
      supplier: 'suppliers',
      invoice: 'invoices',
      ticket: 'tickets',
      cash_movement: 'cashMovements',
      branch: 'branches',
      register: 'registers',
      purchase_receipt: 'purchaseReceipts',
    }
    const key = map[entity]
    if (!key) return { ok: false, message: 'Tipo de registro no valido.' }
    const before = state[key].find((item) => item.id === id) || null
    if (!before) return { ok: false, message: 'Registro no encontrado.' }

    if (entity === 'register') {
      const hasOpenCashSession = state.cashSessions.some((session) => session.registerId === id && session.status === 'open')
      if (hasOpenCashSession) return { ok: false, message: 'No podes eliminar una caja con una sesion abierta. Cerra la caja primero.' }
      const inactiveRegister = { ...before, isActive: false }
      if (cloudCoreAdapter) {
        await cloudCoreAdapter.upsertRegister(inactiveRegister)
        await syncFromCloud()
      } else {
        const register = state.registers.find((item) => item.id === id)
        Object.assign(register, inactiveRegister)
        pushAudit(state, currentUser().id, entity, id, 'deactivated', inactiveRegister, before)
        save()
      }
      return { ok: true, message: 'Caja eliminada de la operacion.' }
    }

    if (entity === 'sale') {
      revertSaleEffects(state, before)
      state.invoices = state.invoices.filter((invoice) => invoice.saleId !== before.id)
      state.tickets = state.tickets.filter((ticket) => ticket.saleId !== before.id)
    }

    if (entity === 'purchase_receipt') {
      revertPurchaseEffects(state, before)
    }

    state[key] = state[key].filter((item) => item.id !== id)
    pushAudit(state, currentUser().id, entity, id, 'deleted', null, before)
    save()
    return { ok: true, message: 'Registro eliminado y movimientos revertidos cuando correspondia.' }
  }

  const registerInvoicePayment = async (payload) => {
    const denied = ensurePermission(actionPermissions.invoicesWrite)
    if (denied) return denied
    const invoice = state.invoices.find((entry) => entry.id === payload.invoiceId)
    if (!invoice) return { ok: false, message: 'Factura no encontrada.' }
    const amount = Number(payload.amount || 0)
    const due = Math.max(0, Number(invoice.totalAmount || 0) - Number(invoice.amountPaid || 0))
    if (amount <= 0 || amount > due) return { ok: false, message: 'El abono debe ser mayor a cero y no superar el saldo pendiente.' }
    if (payload.method === 'cash' && !getOpenCashSession(state)) return { ok: false, message: 'No podes registrar efectivo sin una caja abierta.' }
    if (payload.method === 'echeq' && !String(payload.echeqDetails?.number || '').trim()) return { ok: false, message: 'Indicá el número de e-cheq.' }
    if (cloudCoreAdapter) { await cloudCoreAdapter.registerInvoicePayment(payload); await syncFromCloud(); return { ok: true, message: 'Abono registrado.' } }
    invoice.amountPaid = Number(invoice.amountPaid || 0) + amount
    invoice.status = invoice.amountPaid >= Number(invoice.totalAmount || 0) ? 'Cobrada' : 'Emitida'
    const sale = state.sales.find((entry) => entry.id === invoice.saleId)
    if (sale) { sale.amountPaid = Math.min(Number(sale.totalAmount || 0), Number(sale.amountPaid || 0) + amount); sale.status = getSaleStatus(sale.totalAmount, sale.amountPaid) }
    const customer = state.customers.find((entry) => entry.id === invoice.customerId)
    if (customer) customer.balance = Math.max(0, Number(customer.balance || 0) - amount)
    save()
    return { ok: true, message: invoice.status === 'Cobrada' ? 'Abono registrado. Factura cobrada.' : 'Abono registrado.' }
  }

  const exportData = () => clone(state)
  const importData = (payload) => {
    if (!isDesktop) return { ok: false, message: 'La web publica no admite importar datos locales.' }
    state = migrateState(payload)
    pushAudit(state, currentUser().id, 'system', null, 'imported', { importedAt: todayIso() })
    save()
    return { ok: true, message: 'Backup importado.' }
  }
  const resetData = () => {
    if (!isDesktop) return { ok: false, message: 'La web publica no admite restaurar demos locales.' }
    state = clone(defaultState)
    applyCloudMeta(cloudCoreAdapter ? 'pending' : 'offline')
    pushAudit(state, currentUser().id, 'system', null, 'reset', { resetAt: todayIso() })
    save()
    return { ok: true, message: 'Demo restaurada.' }
  }

  const getCloudConnection = () => ({
    enabled: Boolean(cloudCoreAdapter),
    url: cloudConfig?.url || defaultCloudUrl,
    anonKey: cloudConfig?.anonKey || '',
    instanceKey: cloudConfig?.instanceKey || 'pclaf-dev',
    environment: cloudConfig?.environment || 'production',
    environmentLabel: cloudConfig?.environmentLabel || '',
    required: requireCloud,
  })

  const setCloudConnection = async (config) => {
    cloudConfig = writeCloudConfig(config)
    cloudCoreAdapter = createCloudCoreAdapter()
    applyCloudMeta(cloudCoreAdapter ? 'pending' : 'offline')
    save()
    return { ok: true, message: cloudCoreAdapter ? 'Conexion cloud guardada.' : 'Conexion cloud desactivada.' }
  }

  const clearCloudConnection = async () => {
    writeCloudConfig(null)
    cloudConfig = null
    cloudCoreAdapter = null
    cloudAuthProfile = null
    cloudAccessToken = ''
    platformAdminData = null
    applyCloudMeta('offline', '')
    save()
    return { ok: true, message: 'Conexion cloud desactivada.' }
  }

  const updatePlatformCommerce = async (payload = {}) => {
    if (!cloudCoreAdapter?.updatePlatformCommerce) return { ok: false, message: 'La consola PCLAF no esta disponible.' }
    const result = await cloudCoreAdapter.updatePlatformCommerce(payload)
    await refreshPlatformAdminData()
    return { ok: true, message: result?.message || 'Comercio actualizado.' }
  }

  return {
    permissionCatalog,
    moduleCatalog,
    modulePresets,
    getSnapshot: () => clone(state),
    currentUser,
    currentRole,
    currentPermissionSet,
    hasPermission,
    canAccessModule,
    isAuthenticated,
    isCloudRequired: () => requireCloud,
    isCloudReady: () => isDesktop || !requireCloud || Boolean(cloudCoreAdapter),
    subscribeToOperationalChanges: (listener) => {
      if (typeof listener !== 'function') return () => {}
      operationalChangeListeners.add(listener)
      return () => operationalChangeListeners.delete(listener)
    },
    authenticateUser,
    signOut,
    openCashSession,
    closeCashSession,
    createCashMovement,
    createCustomer,
    updateCustomer,
    createBranch,
    updateBranch,
    selectBranch,
    selectRegister,
    createRegister,
    updateRegister,
    setModuleEnabled,
    applyModulePreset,
    updateBusinessProfile,
    createProduct,
    updateProduct,
    updateProductFromPurchase,
    importProducts,
    findProductByCode: (code) => findProductByCode(state, code),
    createSupplier,
    updateSupplier,
    createUser,
    registerPublicUser,
    updateUser,
    toggleUserActive,
    getCloudConnection,
    setCloudConnection,
    clearCloudConnection,
    setCloudAccessToken,
    setCloudAuthSession,
    clearCloudAuthSession,
    replaceCloudUsers,
    getPlatformAdminData,
    refreshPlatformAdminData,
    updatePlatformCommerce,
    syncFromCloud,
    syncToCloud,
    createStockAdjustment,
    transferStock,
    createSale,
    registerInvoicePayment,
    updateSale,
    cancelSale,
    createReturnFromSale,
    createInvoiceFromSale,
    createTicketFromSale,
    createPurchaseReceipt,
    updatePurchaseReceipt,
    createInvoice,
    updateInvoice,
    createTicket,
    updateTicket,
    removeEntity,
    exportData,
    importData,
    resetData,
  }
}


