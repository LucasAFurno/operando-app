import { execFileSync } from 'node:child_process'
import { loadNotifications, missingVariables, printMissingVariables } from './notification-runtime.mjs'

const period = String(process.argv.find((argument) => argument.startsWith('--period=')) || '--period=daily').slice('--period='.length).toLowerCase()
if (!['daily', 'weekly', 'monthly'].includes(period)) throw new Error('Periodo invalido. Usar --period=daily|weekly|monthly')
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
const todayArgentina = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const tomorrowArgentina = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(tomorrow)
if (period === 'monthly' && process.env.SUMMARY_REQUIRE_MONTH_END === 'true' && todayArgentina.slice(0, 7) === tomorrowArgentina.slice(0, 7)) {
  process.stdout.write('Resumen mensual Cloud Run omitido: hoy no es el ultimo día del mes.\n')
  process.exit(0)
}

const required = missingVariables(['GCP_PROJECT_ID', 'PCLAF_CONTROL_DISCORD_GCP_RUN_WEBHOOK_URL'])
if (required.length) {
  printMissingVariables(required)
  process.exitCode = 1
} else {
  const service = String(process.env.CLOUD_RUN_SERVICE || 'pclaf-fiscal').trim()
  const region = String(process.env.CLOUD_RUN_REGION || 'us-central1').trim()
  const project = String(process.env.GCP_PROJECT_ID).trim()
  const gcloudBin = String(process.env.GCLOUD_BIN || 'gcloud').trim()
  const now = new Date()
  const startedAt = new Date(now)
  startedAt.setUTCDate(startedAt.getUTCDate() - ({ daily: 1, weekly: 7, monthly: 30 }[period]))
  const gcloud = (args) => {
    if (process.platform === 'win32') {
      return execFileSync('gcloud.cmd', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
    }
    return execFileSync(gcloudBin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  }
  const token = gcloud(['auth', 'print-access-token'])
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
  const api = async (url, body) => {
    const response = await fetch(url, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20_000) })
    if (!response.ok) throw new Error(`Google API ${response.status}`)
    return response.json()
  }
  const listEntries = async (filter) => {
    let pageToken
    let count = 0
    do {
      const result = await api(`https://logging.googleapis.com/v2/entries:list`, {
        resourceNames: [`projects/${project}`], filter, orderBy: 'timestamp desc', pageSize: 1000, pageToken,
      })
      count += (result.entries || []).length
      pageToken = result.nextPageToken
    } while (pageToken)
    return count
  }
  const countMetric = async (filter) => {
    const parameters = new URLSearchParams({
      filter,
      'interval.startTime': startedAt.toISOString(),
      'interval.endTime': now.toISOString(),
      'aggregation.alignmentPeriod': '86400s',
      'aggregation.perSeriesAligner': 'ALIGN_SUM',
    })
    const result = await api(`https://monitoring.googleapis.com/v3/projects/${project}/timeSeries?${parameters}`)
    return (result.timeSeries || []).flatMap((series) => series.points || []).reduce((total, point) => total + Number(point.value?.int64Value || point.value?.doubleValue || 0), 0)
  }

  try {
    const serviceJson = JSON.parse(gcloud(['run', 'services', 'describe', service, '--project', project, '--region', region, '--format=json']))
    const ready = (serviceJson.status?.conditions || []).find((condition) => condition.type === 'Ready')
    const revision = serviceJson.status?.latestReadyRevisionName || 'sin revisión lista'
    const resourceFilter = `resource.type="cloud_run_revision" AND resource.labels.service_name="${service}" AND timestamp>="${startedAt.toISOString()}" AND timestamp<="${now.toISOString()}"`
    const [warnings, errors, auditDenied, requests, serverErrors] = await Promise.all([
      listEntries(`${resourceFilter} AND severity=WARNING`),
      listEntries(`${resourceFilter} AND severity>=ERROR`),
      listEntries(`logName="projects/${project}/logs/cloudaudit.googleapis.com%2Factivity" AND timestamp>="${startedAt.toISOString()}" AND timestamp<="${now.toISOString()}" AND protoPayload.serviceName="run.googleapis.com" AND protoPayload.status.code!=0`),
      countMetric(`metric.type="run.googleapis.com/request_count" AND resource.type="cloud_run_revision" AND resource.labels.service_name="${service}"`),
      countMetric(`metric.type="run.googleapis.com/request_count" AND metric.labels.response_code_class="5xx" AND resource.type="cloud_run_revision" AND resource.labels.service_name="${service}"`),
    ])
    const healthy = ready?.status === 'True'
    const severity = !healthy || serverErrors > 0 ? 'critical' : warnings > 0 || errors > 0 || auditDenied > 0 ? 'warning' : 'info'
    const label = { daily: 'diario', weekly: 'semanal', monthly: 'mensual' }[period]
    const event = {
      destination: 'gcp-run', type: `CLOUD_RUN_${period.toUpperCase()}_STATUS`, severity,
      title: `Estado Cloud Run ${label}${healthy ? '' : ' requiere atención'}`,
      source: 'Infraestructura / Cloud Run', environment: 'production',
      message: `Datos reales del período ${startedAt.toISOString().slice(0, 10)} a ${now.toISOString().slice(0, 10)}.`,
      metadata: { servicio: service, región: region, revisiónActiva: revision, condiciónReady: ready?.status || 'desconocida', solicitudes: requests, respuestas5xx: serverErrors, warningsCloudRun: warnings, erroresCloudRun: errors, denegacionesIAMCloudRun: auditDenied },
    }
    const { notifyDiscord } = await loadNotifications()
    const sent = await notifyDiscord('gcp-run', event)
    if (!sent) process.exitCode = 1
    process.stdout.write(`Estado Cloud Run ${label} notificado.\n`)
  } catch (error) {
    process.stderr.write(`No se pudo obtener el estado real de Cloud Run: ${error instanceof Error ? error.message : 'error desconocido'}\n`)
    process.exitCode = 1
  }
}
