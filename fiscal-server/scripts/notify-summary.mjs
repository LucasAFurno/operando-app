import { Storage } from '@google-cloud/storage'
import { loadNotifications, missingVariables, printMissingVariables } from './notification-runtime.mjs'

const period = String(process.argv.find((argument) => argument.startsWith('--period=')) || '--period=daily').slice('--period='.length).toLowerCase()
if (!['daily', 'weekly', 'monthly'].includes(period)) throw new Error('Periodo invalido. Usar --period=daily|weekly|monthly')

const required = missingVariables(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])
if (required.length) {
  printMissingVariables(required)
  process.exitCode = 1
} else {
  // The summary itself needs no fiscal credentials.
  const { notifyDiscord, notifyTelegram } = await loadNotifications()
  const { config } = await import('../src/config.mjs')
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).reduce((parts, part) => ({ ...parts, [part.type]: part.value }), {})
  const today = `${dateParts.year}-${dateParts.month}-${dateParts.day}`
  const addCalendarDays = (date, days) => {
    const value = new Date(`${date}T12:00:00.000Z`)
    value.setUTCDate(value.getUTCDate() + days)
    return value.toISOString().slice(0, 10)
  }
  const weekOffset = (new Date(`${today}T12:00:00.000Z`).getUTCDay() + 6) % 7
  const periodStartDate = period === 'daily'
    ? today
    : period === 'weekly'
      ? addCalendarDays(today, -weekOffset)
      : `${today.slice(0, 8)}01`
  const isLastDayOfMonth = addCalendarDays(today, 1).slice(0, 7) !== today.slice(0, 7)
  if (period === 'monthly' && process.env.SUMMARY_REQUIRE_MONTH_END === 'true' && !isLastDayOfMonth) {
    process.stdout.write('Resumen mensual omitido: hoy no es el ultimo dia del mes.\n')
    process.exit(0)
  }
  // Argentina is UTC-3; use its local midnight so daily activity is not mixed with
  // the previous local evening when the workflow runs in UTC.
  const periodStart = `${periodStartDate}T03:00:00.000Z`
  const headers = { apikey: config.supabaseServiceRoleKey, authorization: `Bearer ${config.supabaseServiceRoleKey}`, prefer: 'count=exact' }
  const count = async (table, filter = '', schema = 'public', optional = false) => {
    try {
      const response = await fetch(`${config.supabaseUrl}/rest/v1/${table}?select=id${filter}&limit=1`, { headers: { ...headers, 'accept-profile': schema }, signal: AbortSignal.timeout(10_000) })
      if (!response.ok) throw new Error(`Supabase no respondio correctamente para ${table} (${response.status})`)
      const total = Number((response.headers.get('content-range') || '').split('/')[1])
      if (!Number.isFinite(total)) throw new Error(`Supabase no devolvio conteo para ${table}`)
      return total
    } catch (error) {
      if (optional) return null
      throw new Error(`No se pudo consultar Supabase para ${table}`)
    }
  }

  const entries = await Promise.all([
    ['Comercios totales', count('commerce_accounts')],
    ['Comercios activos', count('commerce_accounts', '&status=eq.active')],
    ['Comercios nuevos', count('commerce_accounts', `&created_at=gte.${periodStart}`)],
    ['Usuarios totales', count('control_users')],
    ['Usuarios nuevos', count('control_users', `&created_at=gte.${periodStart}`)],
    ['Clientes nuevos', count('customers', `&created_at=gte.${periodStart}`)],
    ['Ventas registradas', count('sales', `&sold_at=gte.${periodStart}`)],
    ['Facturas emitidas', count('documents', `&kind=eq.factura&issued_at=gte.${periodStart}`)],
    ['CAE aprobados', count('fiscal_invoices', `&state=eq.authorized&updated_at=gte.${periodStart}`, 'private', true)],
    ['CAE rechazados', count('fiscal_invoices', `&state=eq.rejected&updated_at=gte.${periodStart}`, 'private', true)],
  ].map(async ([label, value]) => [label, await value]))
  const metrics = Object.fromEntries(entries.filter(([, value]) => value !== null))
  const backupBucket = String(process.env.BACKUP_GCS_BUCKET || '').trim()
  const backupPrefix = String(process.env.BACKUP_GCS_PREFIX || 'operando-control/backups').trim().replace(/^\/+|\/+$/g, '')
  if (backupBucket) {
    try {
      const [content] = await new Storage().bucket(backupBucket).file(`${backupPrefix}/last-success.json`).download()
      const backup = JSON.parse(content.toString('utf8'))
      if (backup?.completedAt && backup?.bytes && backup?.destination) metrics['Ultimo backup'] = `${backup.completedAt} · ${backup.bytes} bytes · ${backup.destination}`
    } catch {
      process.stdout.write('{"service":"fiscal","event":"backup_metadata_unavailable"}\n')
    }
  }
  const periodLabel = { daily: 'diario', weekly: 'semanal', monthly: 'mensual' }[period]
  const periodDescription = period === 'daily' ? `Fecha: ${today}` : period === 'weekly' ? `Período: ${periodStartDate} a ${today}` : `Período: ${today.slice(0, 7)}`
  const message = [periodDescription, ...Object.entries(metrics).map(([label, value]) => `${label}: ${value}`)].join('\n')
  const event = { destination: 'resumen', type: `${period.toUpperCase()}_SUMMARY`, severity: 'info', title: `Resumen de operaciones ${periodLabel}`, source: 'Producto y operaciones', environment: String(process.env.NOTIFICATIONS_ENVIRONMENT || '').trim() || undefined, message }
  const discordSent = await notifyDiscord('resumen', event)
  if (!discordSent) process.stdout.write('{"service":"fiscal","event":"discord_summary_not_delivered"}\n')
  if (config.telegram.enabled) {
    const telegramSent = await notifyTelegram(event)
    if (!telegramSent) process.stdout.write('{"service":"fiscal","event":"telegram_summary_not_delivered"}\n')
  }
  process.stdout.write(`Resumen ${periodLabel} encolado.\n`)
}
