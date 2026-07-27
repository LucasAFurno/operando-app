import { config } from './config.mjs'

const SENSITIVE_KEY = /password|passwordhash|token|authorization|cookie|session|secret|apikey|privatekey|certificate|bottoken|webhookurl|creditcard|cardnumber|cvv|sign|xml/i
const DISCORD_DESTINATIONS = {
  general: 'generalWebhookUrl', logs: 'logsWebhookUrl', alertas: 'alertasWebhookUrl', arca: 'arcaWebhookUrl',
  seguridad: 'securityWebhookUrl', backups: 'backupsWebhookUrl', deploys: 'deploysWebhookUrl', resumen: 'summaryWebhookUrl',
}

const sanitize = (value, key = '') => {
  if (SENSITIVE_KEY.test(key)) return '[redacted]'
  if (Array.isArray(value)) return value.map((item) => sanitize(item))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, sanitize(item, name)]))
  if (typeof value === 'string') return value.replace(/<[^>]+>/g, '[redacted]').slice(0, 500)
  return value
}

const argentinaTime = (timestamp) => new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/Argentina/Buenos_Aires',
}).format(new Date(timestamp))

const htmlEscape = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

const asText = (value) => typeof value === 'object' ? JSON.stringify(value) : String(value)

const area = (event) => event.source || 'PCLAF Control'

const areaIcon = (event) => {
  if (/arca|fiscal/i.test(area(event))) return '🧾'
  if (/producto|operaciones/i.test(area(event))) return '📊'
  if (/infraestructura|deploy|hosting|supabase/i.test(area(event))) return '🛠️'
  return '🔔'
}

const statusIcon = (event) => {
  if (event.severity === 'critical') return '🚨'
  if (event.severity === 'warning') return '⚠️'
  if (/iniciado|started/i.test(event.title || '')) return '🚀'
  return '✅'
}

const embedColor = (event) => {
  if (event.severity === 'critical') return 0xDC2626
  if (event.severity === 'warning') return 0xF59E0B
  if (/arca|fiscal/i.test(area(event))) return 0x7C3AED
  if (/producto|operaciones/i.test(area(event))) return 0x0F766E
  return 0x2563EB
}

const eventDetails = (event) => {
  const safe = sanitize(event.metadata || {})
  return [
    ['Ambiente', event.environment || config.environment],
    ['Área', area(event)],
    event.entityId ? ['ID', event.entityId] : null,
    event.correlationId ? ['Correlación', event.correlationId] : null,
    ...Object.entries(safe).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ].filter(Boolean).map(([label, value]) => [label, asText(value)])
}

const discordEmbed = (event) => {
  const timestamp = event.timestamp || new Date().toISOString()
  return {
    author: { name: `${areaIcon(event)} PCLAF Control · ${area(event)}` },
    title: `${statusIcon(event)} ${sanitize(event.title || event.type || 'Notificación')}`,
    description: sanitize(event.message || 'Sin detalle adicional.'),
    color: embedColor(event),
    fields: eventDetails(event).slice(0, 25).map(([name, value]) => ({ name, value: value.slice(0, 1024), inline: name === 'Ambiente' || name === 'Área' })),
    footer: { text: `PCLAF Control · ${argentinaTime(timestamp)}` },
    timestamp,
  }
}

const telegramText = (event) => {
  const timestamp = event.timestamp || new Date().toISOString()
  const details = eventDetails(event)
    .map(([label, value]) => `<b>${htmlEscape(label)}:</b> ${htmlEscape(value)}`)
    .join('\n')
  return [
    `<b>${areaIcon(event)} PCLAF Control · ${htmlEscape(area(event))}</b>`,
    `<b>${statusIcon(event)} ${htmlEscape(sanitize(event.title || event.type || 'Notificación'))}</b>`,
    '──────────────────',
    htmlEscape(sanitize(event.message || 'Sin detalle adicional.')),
    '──────────────────',
    details,
    `<i>Fecha: ${htmlEscape(argentinaTime(timestamp))}</i>`,
  ].filter(Boolean).join('\n')
}

export const notifyDiscord = async (destination, event) => {
  const url = config.discord[DISCORD_DESTINATIONS[destination]]
  if (!config.discord.enabled || !url) return false
  try {
    const response = await fetch(url, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ embeds: [discordEmbed(event)] }), signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return true
  } catch (error) {
    // Do not include URL, payload, or any secret in service logs.
    process.stdout.write(`${JSON.stringify({ timestamp: new Date().toISOString(), service: 'fiscal', event: 'discord_delivery_failed', destination, status: error.message })}\n`)
    return false
  }
}

export const notifyTelegram = async (event) => {
  if (!config.telegram.enabled || !config.telegram.botToken || !config.telegram.chatId) return false
  try {
    const response = await fetch(`https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: config.telegram.chatId, text: telegramText(event), parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) {
      process.stdout.write(`${JSON.stringify({ timestamp: new Date().toISOString(), service: 'fiscal', event: 'telegram_delivery_failed', status: response.status })}\n`)
      return false
    }
    return true
  } catch {
    process.stdout.write(`${JSON.stringify({ timestamp: new Date().toISOString(), service: 'fiscal', event: 'telegram_delivery_failed' })}\n`)
    return false
  }
}

export const notifyEvent = (event) => {
  const safeEvent = { ...event, title: sanitize(event.title || ''), message: sanitize(event.message || ''), timestamp: event.timestamp || new Date().toISOString(), metadata: sanitize(event.metadata || {}) }
  const destination = event.destination || (event.severity === 'critical' ? 'alertas' : 'logs')
  void notifyDiscord(destination, safeEvent)
  if (safeEvent.severity === 'critical' || safeEvent.severity === 'warning') void notifyTelegram(safeEvent)
}

export const controlDestinations = Object.keys(DISCORD_DESTINATIONS)
