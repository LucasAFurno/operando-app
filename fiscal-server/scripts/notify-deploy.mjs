import { loadNotifications, missingVariables, printMissingVariables } from './notification-runtime.mjs'

const status = String(process.argv[2] || '').toLowerCase()
if (!['started', 'success', 'failed', 'rollback'].includes(status)) {
  throw new Error('Uso: npm run notify:deploy -- started|success|failed|rollback')
}

const required = process.env.PCLAF_CONTROL_DISCORD_ENABLED === 'true'
  ? missingVariables(['PCLAF_CONTROL_DISCORD_DEPLOYS_WEBHOOK_URL'])
  : []

if (required.length) {
  printMissingVariables(required)
  process.exitCode = 1
} else {
  const { notifyDiscord, notifyTelegram } = await loadNotifications()
  const input = Object.fromEntries(process.argv.slice(3).map((arg) => {
    const [key, ...parts] = arg.replace(/^--/, '').split('=')
    return [key, parts.join('=')]
  }))
  const title = { started: 'Deploy iniciado', success: 'Deploy exitoso', failed: 'Deploy fallido', rollback: 'Rollback iniciado' }[status]
  const message = {
    started: 'Se inició una actualización técnica de PCLAF Control. Se actualizará el backend fiscal y sus integraciones; se avisará el resultado final.',
    success: 'La actualización técnica del backend fiscal de PCLAF Control quedó disponible correctamente.',
    failed: 'La actualización técnica no se completó. Abrí el enlace del pipeline para ver el paso que falló.',
    rollback: 'Se inició un rollback de la actualización técnica. Revisá el pipeline para confirmar el resultado.',
  }[status]
  const sent = await notifyDiscord('deploys', {
    type: `DEPLOY_${status.toUpperCase()}`,
    severity: status === 'failed' ? 'critical' : status === 'rollback' ? 'warning' : 'info',
    title,
    message,
    source: 'ci-cd',
    environment: input.environment || process.env.NODE_ENV || 'production',
    metadata: { version: input.version, commit: input.commit, rama: input.branch, autor: input.author, pipeline: input.pipeline, detalle: input.detail },
  })
  const telegramSent = await notifyTelegram({
    type: `DEPLOY_${status.toUpperCase()}`,
    severity: status === 'failed' ? 'critical' : status === 'rollback' ? 'warning' : 'info',
    title,
    message,
    source: 'ci-cd',
    environment: input.environment || process.env.NODE_ENV || 'production',
    metadata: { version: input.version, commit: input.commit, rama: input.branch, autor: input.author, pipeline: input.pipeline, detalle: input.detail },
  })
  if (process.env.PCLAF_CONTROL_TELEGRAM_ENABLED === 'true' && !telegramSent) {
    process.stdout.write('{"service":"fiscal","event":"telegram_deploy_notification_not_delivered"}\n')
  }
  process.stdout.write(sent ? `Notificacion de deploy ${status} encolada.\n` : 'Discord deshabilitado o sin destino configurado; el deploy continua.\n')
}
