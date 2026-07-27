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

const eventText = (event) => {
  const safe = sanitize(event.metadata || {})
  const lines = [
    `**Ambiente:** ${event.environment || config.environment}`,
    `**Area:** ${event.source || 'PCLAF Control'}`,
    event.entityId ? `**ID:** ${event.entityId}` : null,
    event.correlationId ? `**Correlation ID:** ${event.correlationId}` : null,
    ...Object.entries(safe).map(([key, value]) => `**${key}:** ${typeof value === 'object' ? JSON.stringify(value) : value}`),
    `**Fecha:** ${argentinaTime(event.timestamp || new Date().toISOString())}`,
  ].filter(Boolean)
  return [event.message, ...lines].filter(Boolean).join('\n')
}

export const notifyDiscord = async (destination, event) => {
  const url = config.discord[DISCORD_DESTINATIONS[destination]]
  if (!config.discord.enabled || !url) return false
  try {
    const response = await fetch(url, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ embeds: [{
        title: `PCLAF Control | ${sanitize(event.title || event.type || 'Notificación')}`,
        description: eventText(event), color: event.severity === 'critical' ? 0xCC0000 : event.severity === 'warning' ? 0xF59E0B : 0x2563EB,
      }] }), signal: AbortSignal.timeout(8_000),
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
      body: JSON.stringify({ chat_id: config.telegram.chatId, text: `PCLAF Control | ${sanitize(event.title || event.type)}\n${eventText(event)}` }),
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
