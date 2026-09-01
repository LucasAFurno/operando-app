import { createServer } from 'node:http'
import { createHash, timingSafeEqual } from 'node:crypto'
import { config } from './config.mjs'
import { audit } from './audit.mjs'
import { notifyEvent } from './notifications.mjs'
import { EncryptedFiscalStore } from './encrypted-store.mjs'
import { SupabaseEncryptedFiscalStore } from './supabase-encrypted-store.mjs'
import { createCsr } from './openssl.mjs'
import { ArcaClient } from './arca-client.mjs'
import { FixedWindowRateLimiter } from './resilience.mjs'
import { readXmlTag } from './xml.mjs'

const store = config.storeType === 'supabase'
  ? new SupabaseEncryptedFiscalStore({ url: config.supabaseUrl, serviceRoleKey: config.supabaseServiceRoleKey, masterKey: config.masterKey })
  : new EncryptedFiscalStore({ dataDir: config.dataDir, masterKey: config.masterKey })
const arca = new ArcaClient({ store })
const rateLimiter = new FixedWindowRateLimiter({ windowMs: config.rateWindowMs })
let emergencyCache = { checkedAt: 0, stopped: false }

const json = (response, status, body) => {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })
  response.end(JSON.stringify(body))
}

const tooManyRequests = (response, retryAfterSeconds) => {
  response.writeHead(429, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'retry-after': String(retryAfterSeconds), 'x-content-type-options': 'nosniff' })
  response.end(JSON.stringify({ error: 'rate_limited', retryAfterSeconds }))
}

const readBody = async (request) => {
  const chunks = []
  let length = 0
  for await (const chunk of request) {
    length += chunk.length
    if (length > 512 * 1024) throw new Error('Request body too large')
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new Error('Invalid JSON body') }
}

const authorized = (request) => {
  const received = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const expected = config.serviceToken
  if (!received || received.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected))
}

const cuit = (value) => {
  const normalized = String(value || '').replace(/\D/g, '')
  if (!/^\d{11}$/.test(normalized)) throw new Error('A valid 11 digit CUIT is required')
  return normalized
}

const pointOfSale = (value) => {
  const numeric = Number(value)
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 99998) throw new Error('A valid ARCA point of sale is required')
  return numeric
}

const uuid = (value, field = 'id') => {
  const normalized = String(value || '').trim().toLowerCase()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)) throw new Error(`A valid ${field} is required`)
  return normalized
}

const receiptNumber = (value) => {
  const numeric = Number(value)
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 99_999_999) throw new Error('A valid receipt number is required')
  return numeric
}

const idempotencyKey = (value) => {
  const normalized = String(value || '').trim()
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(normalized)) throw new Error('A valid idempotency key is required')
  return normalized
}

const requestHash = (value) => createHash('sha256').update(String(value || ''), 'utf8').digest('hex')
const fiscalEvent = (destination, type, severity, title, details = {}) => notifyEvent({ destination, type, severity, title, source: 'Fiscal / ARCA', ...details })

const fiscalRequestXml = (value) => {
  if (typeof value !== 'string' || value.length < 20 || value.length > 256 * 1024 || !value.includes('<FeCAEReq>')) {
    throw new Error('A valid FeCAEReq XML payload is required')
  }
  return value
}

const emergencyStopActive = async () => {
  const now = Date.now()
  if (now - emergencyCache.checkedAt <= config.emergencyStopCacheMs) return emergencyCache.stopped
  emergencyCache = { checkedAt: now, stopped: await store.emergencyStop() }
  return emergencyCache.stopped
}

const tenantIdFrom = (pathname) => {
  const match = pathname.match(/^\/v1\/tenants\/([a-zA-Z0-9_-]{3,80})\/(certificate-request|certificate|verify|status|invoices)$/)
  if (!match) return null
  return { tenantId: match[1].toLowerCase(), action: match[2] }
}

const publicTenant = (record) => record ? {
  status: record.status,
  subject: record.subject,
  hasCertificate: Boolean(record.certificatePem),
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
  lastVerification: record.lastVerification || null,
} : { status: 'not_started', hasCertificate: false }

const handle = async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`)
  if (request.method === 'GET' && url.pathname === '/health') return json(response, 200, { ok: true, service: 'operando-fiscal-service', environment: config.environment })
  const route = tenantIdFrom(url.pathname)
  if (!route) return json(response, 404, { error: 'not_found' })
  if (!authorized(request)) return json(response, 401, { error: 'unauthorized' })
  const globalLimit = rateLimiter.take('global', config.globalRatePerWindow)
  if (!globalLimit.allowed) return tooManyRequests(response, globalLimit.retryAfterSeconds)
  const tenantLimit = rateLimiter.take(`tenant:${route.tenantId}`, config.tenantRatePerWindow)
  if (!tenantLimit.allowed) return tooManyRequests(response, tenantLimit.retryAfterSeconds)
  try {
    if (request.method === 'GET' && route.action === 'status') return json(response, 200, publicTenant(await store.read(route.tenantId)))
    if (request.method !== 'POST') return json(response, 405, { error: 'method_not_allowed' })
    const body = await readBody(request)
    if (config.storeType === 'supabase' && route.action !== 'certificate-request') {
      const record = await store.read(route.tenantId)
      if (!record || record.commerceId !== uuid(body.commerceId, 'commerce id')) throw new Error('Commerce does not match fiscal tenant')
    }
    if (route.action === 'certificate-request') {
      const subject = String(body.subject || '').trim()
      if (!/^\/[^\n\r]{4,240}$/.test(subject)) throw new Error('A valid X.509 subject is required')
      const record = await store.createKeyPair(route.tenantId, subject, config.storeType === 'supabase' ? uuid(body.commerceId, 'commerce id') : null)
      const csrPem = await createCsr({ openSslBin: config.openSslBin, privateKeyPem: record.privateKeyPem, subject })
      await store.update(route.tenantId, (current) => ({ ...current, csrCreatedAt: new Date().toISOString() }))
      audit('certificate_request_created', { tenantId: route.tenantId })
      fiscalEvent('arca', 'CERTIFICATE_REQUEST_CREATED', 'info', 'Solicitud de certificado creada', { entityId: route.tenantId })
      return json(response, 201, { tenantId: route.tenantId, csrPem, status: 'certificate_requested' })
    }
    if (route.action === 'certificate') {
      const certificatePem = String(body.certificatePem || '')
      if (!certificatePem.includes('BEGIN CERTIFICATE') || certificatePem.length > 32_000) throw new Error('A PEM certificate is required')
      const record = await store.update(route.tenantId, (current) => ({ ...current, certificatePem, status: 'certificate_uploaded' }))
      audit('certificate_uploaded', { tenantId: route.tenantId })
      fiscalEvent('arca', 'CERTIFICATE_UPLOADED', 'info', 'Certificado cargado', { entityId: route.tenantId })
      fiscalEvent('seguridad', 'FISCAL_CERTIFICATE_REPLACED', 'warning', 'Certificado fiscal reemplazado', { entityId: route.tenantId })
      return json(response, 200, publicTenant(record))
    }
    if (route.action === 'verify') {
      const result = await arca.verify({ tenantId: route.tenantId, cuit: cuit(body.cuit), pointOfSale: pointOfSale(body.pointOfSale) })
      const record = await store.update(route.tenantId, (current) => ({ ...current, status: 'active', fiscal: { cuit: cuit(body.cuit), pointOfSale: pointOfSale(body.pointOfSale) }, lastVerification: { status: 'connected', checkedAt: new Date().toISOString(), ...result } }))
      audit('arca_connection_verified', { tenantId: route.tenantId, pointOfSale: result.pointOfSale })
      fiscalEvent('arca', 'ARCA_CONNECTION_VERIFIED', 'info', 'Autenticación WSAA y conexión WSFEv1 exitosa', { entityId: route.tenantId, metadata: { puntoDeVenta: result.pointOfSale } })
      return json(response, 200, publicTenant(record))
    }
    if (route.action === 'invoices') {
      const record = await store.read(route.tenantId)
      if (record?.status !== 'active') throw new Error('ARCA connection is not active')
      const invoiceLimit = rateLimiter.take(`invoice:${route.tenantId}`, config.invoiceRatePerWindow)
      if (!invoiceLimit.allowed) return tooManyRequests(response, invoiceLimit.retryAfterSeconds)
      if (config.storeType !== 'supabase') throw new Error('Fiscal invoices require the persistent Supabase store')
      const context = {
        commerceId: uuid(body.commerceId, 'commerce id'), saleId: uuid(body.saleId, 'sale id'),
        receiptType: Number(body.receiptType), pointOfSale: pointOfSale(body.pointOfSale), receiptNumber: receiptNumber(body.receiptNumber),
      }
      if (record.commerceId !== context.commerceId) throw new Error('Commerce does not match fiscal tenant')
      if (!Number.isInteger(context.receiptType) || context.receiptType < 1 || context.receiptType > 999) throw new Error('A valid receipt type is required')
      const key = idempotencyKey(body.idempotencyKey)
      const xml = fiscalRequestXml(body.requestXml)
      const hash = requestHash(xml)
      const claim = await store.claimInvoice({ ...context, idempotencyKey: key, requestHash: hash, encryptedRequest: store.encrypt({ requestXml: xml, context }), processingLeaseSeconds: config.processingLeaseSeconds })
      if (claim.state === 'authorized') {
        if (claim.requestHash !== hash) throw new Error('Idempotency key was already used with a different invoice')
        return json(response, 200, { responseXml: store.decrypt(claim.encryptedResponse).responseXml, replayed: true })
      }
      if (!claim.created && !claim.processingAcquired) {
        const leaseActive = claim.processingLeaseUntil && Date.parse(claim.processingLeaseUntil) > Date.now()
        if (claim.state === 'pending' && (!claim.arcaSentAt || leaseActive)) return json(response, 409, { error: 'fiscal_invoice_pending', invoiceId: claim.id })
        const reconciled = await arca.reconcileAuthorization({ tenantId: route.tenantId, cuit: record.fiscal.cuit, pointOfSale: context.pointOfSale, receiptType: context.receiptType, receiptNumber: context.receiptNumber }).catch(() => ({ status: 'unknown' }))
        if (reconciled.status === 'authorized') {
          await store.transitionInvoice({ invoiceId: claim.id, targetState: 'authorized', encryptedResponse: store.encrypt({ responseXml: reconciled.responseXml }) })
          return json(response, 200, { responseXml: reconciled.responseXml, replayed: true, reconciled: true })
        }
        if (reconciled.status === 'rejected') {
          await store.transitionInvoice({ invoiceId: claim.id, targetState: 'rejected', encryptedResponse: store.encrypt({ responseXml: reconciled.responseXml }), errorCode: 'arca_rejected_reconciled', arcaLastNumber: reconciled.lastNumber || null })
          fiscalEvent('arca', 'CAE_REJECTED', 'warning', 'CAE rechazado', { entityId: claim.id, metadata: { comercio: route.tenantId.slice(0, 8), tipoComprobante: context.receiptType, puntoDeVenta: context.pointOfSale, numeroComprobante: context.receiptNumber, motivo: 'Rechazado durante conciliación' } })
          return json(response, 422, { error: 'arca_rejected', invoiceId: claim.id, reconciled: true })
        }
        if (claim.state === 'pending') await store.transitionInvoice({ invoiceId: claim.id, targetState: 'uncertain', errorCode: 'pending_reconciliation', arcaLastNumber: reconciled.lastNumber || null })
        return json(response, 409, { error: 'fiscal_invoice_uncertain', invoiceId: claim.id })
      }
      if (await emergencyStopActive()) return json(response, 503, { error: 'fiscal_emergency_stop' })
      await store.markInvoiceSent(claim.id)
      try {
        const responseXml = await arca.requestCae({ tenantId: route.tenantId, cuit: record.fiscal.cuit, requestXml: xml })
        if (String(readXmlTag(responseXml, 'Resultado') || '').toUpperCase() !== 'A') {
          await store.transitionInvoice({ invoiceId: claim.id, targetState: 'rejected', encryptedResponse: store.encrypt({ responseXml }), errorCode: 'arca_rejected' })
          fiscalEvent('arca', 'CAE_REJECTED', 'warning', 'CAE rechazado', { entityId: claim.id, metadata: { comercio: route.tenantId.slice(0, 8), tipoComprobante: context.receiptType, puntoDeVenta: context.pointOfSale, numeroComprobante: context.receiptNumber } })
          return json(response, 422, { error: 'arca_rejected', invoiceId: claim.id })
        }
        await store.transitionInvoice({ invoiceId: claim.id, targetState: 'authorized', encryptedResponse: store.encrypt({ responseXml }) })
        audit('invoice_authorization_requested', { tenantId: route.tenantId })
        fiscalEvent('arca', 'CAE_APPROVED', 'info', 'CAE aprobado', { entityId: claim.id, metadata: { comercio: route.tenantId.slice(0, 8), tipoComprobante: context.receiptType, puntoDeVenta: context.pointOfSale, numeroComprobante: context.receiptNumber } })
        return json(response, 200, { responseXml, replayed: false })
      } catch (error) {
        fiscalEvent('arca', 'ARCA_TRANSPORT_FAILED', 'critical', 'ARCA no respondió al solicitar CAE', { entityId: claim.id, metadata: { comercio: route.tenantId.slice(0, 8), detalle: error.message } })
        fiscalEvent('alertas', 'FISCAL_BACKEND_UNAVAILABLE', 'critical', 'Backend fiscal requiere intervención', { entityId: claim.id, metadata: { detalle: 'No se pudo confirmar la autorización ARCA' } })
        const reconciled = await arca.reconcileAuthorization({ tenantId: route.tenantId, cuit: record.fiscal.cuit, pointOfSale: context.pointOfSale, receiptType: context.receiptType, receiptNumber: context.receiptNumber }).catch(() => ({ status: 'unknown' }))
        if (reconciled.status === 'authorized') {
          await store.transitionInvoice({ invoiceId: claim.id, targetState: 'authorized', encryptedResponse: store.encrypt({ responseXml: reconciled.responseXml }) })
          return json(response, 200, { responseXml: reconciled.responseXml, reconciled: true })
        }
        await store.transitionInvoice({ invoiceId: claim.id, targetState: 'uncertain', errorCode: 'arca_timeout_or_transport', arcaLastNumber: reconciled.lastNumber || null })
        return json(response, 409, { error: 'fiscal_invoice_uncertain', invoiceId: claim.id })
      }
    }
    return json(response, 404, { error: 'not_found' })
  } catch (error) {
    audit('fiscal_request_failed', { tenantId: route.tenantId, action: route.action, message: error.message })
    fiscalEvent('arca', 'FISCAL_REQUEST_FAILED', 'warning', 'Error fiscal controlado', { entityId: route.tenantId, metadata: { accion: route.action, detalle: error.message } })
    return json(response, 422, { error: 'fiscal_request_failed', message: error.message })
  }
}

const server = createServer((request, response) => { handle(request, response).catch((error) => { audit('unhandled_request_error', { message: error.message }); fiscalEvent('alertas', 'UNHANDLED_REQUEST_ERROR', 'critical', 'Error interno no controlado', { metadata: { detalle: error.message } }); json(response, 500, { error: 'internal_error' }) }) })
server.listen(config.port, config.host, () => {
  // Kept in Cloud Logging for diagnosis, but not sent to operators: Cloud Run starts
  // instances for normal deploys and cold starts, so an alert here is not actionable.
  audit('server_started', { port: config.port, host: config.host, environment: config.environment })
})

const shutdown = (signal) => server.close(() => {
  audit('server_stopped', { signal })
  process.exit(0)
})
process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))
