import { loadNotifications, missingVariables, printMissingVariables } from './notification-runtime.mjs'

const status = String(process.argv[2] || '').toLowerCase()
if (!['started', 'success', 'failed', 'rollback'].includes(status)) {
  throw new Error('Uso: npm run notify:deploy -- started|success|failed|rollback')
}

const input = Object.fromEntries(process.argv.slice(3).map((arg) => {
  const [key, ...parts] = arg.replace(/^--/, '').split('=')
  return [key, parts.join('=')]
}))
const destination = ['deploys', 'gcp-run'].includes(input.destination) ? input.destination : 'deploys'
const required = process.env.PCLAF_CONTROL_DISCORD_ENABLED === 'true'
  ? missingVariables([destination === 'gcp-run' ? 'PCLAF_CONTROL_DISCORD_GCP_RUN_WEBHOOK_URL' : 'PCLAF_CONTROL_DISCORD_DEPLOYS_WEBHOOK_URL'])
  : []

if (required.length) {
  printMissingVariables(required)
  process.exitCode = 1
} else {
  const { notifyDiscord, notifyTelegram } = await loadNotifications()
  const title = { started: 'Actualizacion de infraestructura iniciada', success: 'Actualizacion de infraestructura exitosa', failed: 'Actualizacion de infraestructura fallida', rollback: 'Rollback de infraestructura iniciado' }[status]
  const message = {
    started: 'Se inicio una actualizacion de infraestructura de PCLAF Control. Este flujo despliega el backend privado de facturacion y ARCA; no representa una operacion realizada por un usuario.',
    success: 'La actualizacion de infraestructura del backend privado de facturacion y ARCA quedo disponible correctamente.',
    failed: 'La actualizacion de infraestructura no se completo. Abri el enlace del pipeline para identificar el paso que fallo.',
    rollback: 'Se inicio un rollback de infraestructura. Revisa el pipeline para confirmar el resultado.',
  }[status]
  const event = {
    type: `DEPLOY_${status.toUpperCase()}`,
    severity: status === 'failed' ? 'critical' : status === 'rollback' ? 'warning' : 'info',
    title,
    message,
    source: 'Infraestructura',
    environment: input.environment || process.env.NODE_ENV || 'production',
    metadata: { version: input.version, commit: input.commit, rama: input.branch, autor: input.author, pipeline: input.pipeline, detalle: input.detail },
  }
  const sent = await notifyDiscord(destination, event)
  const telegramSent = input.telegram === 'false' ? true : await notifyTelegram(event)
  if (input.telegram !== 'false' && process.env.PCLAF_CONTROL_TELEGRAM_ENABLED === 'true' && !telegramSent) {
    process.stdout.write('{"service":"fiscal","event":"telegram_deploy_notification_not_delivered"}\n')
  }
  process.stdout.write(sent ? `Notificacion de deploy ${status} encolada en ${destination}.\n` : 'Discord deshabilitado o sin destino configurado; el deploy continua.\n')
}
