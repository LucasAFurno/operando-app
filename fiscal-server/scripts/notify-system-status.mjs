import { loadNotifications, missingVariables, printMissingVariables } from './notification-runtime.mjs'

const required = missingVariables(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])
if (required.length) {
  printMissingVariables(required)
  process.exitCode = 1
} else {
  const { notifyDiscord, notifyTelegram } = await loadNotifications()
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '')
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const check = async (name, url, options = {}) => {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10_000) })
      return { name, ok: response.ok, status: response.status }
    } catch {
      return { name, ok: false, status: null }
    }
  }

  const checks = await Promise.all([
    check('Base de datos (Supabase)', `${supabaseUrl}/rest/v1/commerce_accounts?select=id&limit=1`, {
      headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` },
    }),
    check('Google APIs', 'https://www.googleapis.com/oauth2/v3/certs'),
    check('Dominio y hosting web', 'https://www.pclafcontrol.com.ar/'),
  ])
  const allHealthy = checks.every((item) => item.ok)
  const message = checks.map((item) => `${item.ok ? 'OK' : 'ATENCION'} · ${item.name}${item.status ? ` (HTTP ${item.status})` : ''}`).join('\n')
  const event = {
    destination: 'general',
    type: 'DAILY_CONNECTIVITY_STATUS',
    severity: allHealthy ? 'info' : 'warning',
    title: allHealthy ? 'Estado de infraestructura OK' : 'Estado de infraestructura requiere atencion',
    source: 'Infraestructura',
    environment: String(process.env.NOTIFICATIONS_ENVIRONMENT || '').trim() || undefined,
    message: `Chequeo de las 09:01 (Argentina)\n${message}`,
  }
  const [discordSent, telegramSent] = await Promise.all([notifyDiscord('general', event), notifyTelegram(event)])
  if (!discordSent) process.stdout.write('{"service":"fiscal","event":"discord_status_not_delivered"}\n')
  if (process.env.PCLAF_CONTROL_TELEGRAM_ENABLED === 'true' && !telegramSent) process.stdout.write('{"service":"fiscal","event":"telegram_status_not_delivered"}\n')
  if (!allHealthy) process.exitCode = 1
  process.stdout.write('Estado operativo notificado.\n')
}
