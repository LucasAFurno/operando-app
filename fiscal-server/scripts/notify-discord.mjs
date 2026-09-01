import { loadNotifications, missingVariables, printMissingVariables } from './notification-runtime.mjs'

const destinations = ['general', 'logs', 'alertas', 'arca', 'seguridad', 'gcp-run', 'backups', 'deploys', 'resumen']
const target = String(process.argv[2] || '').trim().toLowerCase()
const destination = target.replace(/^control-/, '')
if (!target || (destination !== 'telegram' && !destinations.includes(destination))) {
  process.stderr.write(`Uso: npm run test:notifications -- control-${destinations.join('|control-')}|control-telegram\n`)
  process.exit(1)
}

const enabledVariable = destination === 'telegram' ? 'OPERANDO_CONTROL_TELEGRAM_ENABLED' : 'OPERANDO_CONTROL_DISCORD_ENABLED'
const webhookNames = {
  seguridad: 'OPERANDO_CONTROL_DISCORD_SEGURIDAD_WEBHOOK_URL',
  'gcp-run': 'OPERANDO_CONTROL_DISCORD_GCP_RUN_WEBHOOK_URL',
  deploys: 'OPERANDO_CONTROL_DISCORD_DEPLOYS_WEBHOOK_URL',
}
const webhookName = webhookNames[destination] || `OPERANDO_CONTROL_DISCORD_${destination.toUpperCase()}_WEBHOOK_URL`
const required = process.env[enabledVariable] === 'true'
  ? missingVariables(destination === 'telegram' ? ['OPERANDO_CONTROL_TELEGRAM_BOT_TOKEN', 'OPERANDO_CONTROL_TELEGRAM_CHAT_ID'] : [webhookName])
  : []

if (required.length) {
  printMissingVariables(required)
  process.exitCode = 1
} else {
  const { notifyDiscord, notifyTelegram } = await loadNotifications()
  const event = { type: 'NOTIFICATION_TEST', severity: destination === 'alertas' ? 'critical' : 'info', title: 'PRUEBA DE NOTIFICACION', message: 'Mensaje de prueba enviado manualmente.', source: 'operando-control', environment: process.env.NODE_ENV || 'development' }
  const sent = destination === 'telegram' ? await notifyTelegram(event) : await notifyDiscord(destination, event)
  process.stdout.write(sent ? `Notificacion enviada a control-${destination}.\n` : `Proveedor deshabilitado o destino no configurado para control-${destination}.\n`)
  process.exitCode = sent ? 0 : 1
}
