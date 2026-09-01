import { spawn } from 'node:child_process'
import { mkdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { Storage } from '@google-cloud/storage'
import { loadNotifications, missingVariables, printMissingVariables } from './notification-runtime.mjs'

const databaseUrl = String(process.env.BACKUP_DATABASE_URL || process.env.SUPABASE_DB_URL || '').trim()
const bucketName = String(process.env.BACKUP_GCS_BUCKET || '').trim()
const missing = [
  ...(databaseUrl ? [] : ['BACKUP_DATABASE_URL']),
  ...missingVariables(['BACKUP_GCS_BUCKET']),
]
if (missing.length) {
  printMissingVariables(missing)
  process.exitCode = 1
} else {
  const outputDir = path.resolve(process.env.BACKUP_OUTPUT_DIR || 'backups')
  const prefix = String(process.env.BACKUP_GCS_PREFIX || 'operando-control/backups').trim().replace(/^\/+|\/+$/g, '')
  const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS || 0)
  if (!Number.isInteger(retentionDays) || retentionDays < 0 || retentionDays > 3650) throw new Error('BACKUP_RETENTION_DAYS debe ser un entero entre 0 y 3650')

  const name = `operando-control-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`
  const destination = path.join(outputDir, name)
  const objectName = `${prefix}/${name}`
  const metadataName = `${prefix}/last-success.json`
  const startedAt = Date.now()
  const storage = new Storage()
  const bucket = storage.bucket(bucketName)
  const notificationEnvironment = String(process.env.NOTIFICATIONS_ENVIRONMENT || '').trim() || undefined
  let notifyDiscord

  const runDump = (env) => new Promise((resolve) => {
    const child = spawn('pg_dump', ['--format=custom', '--no-owner', '--file', destination], { stdio: 'ignore', shell: false, env })
    child.once('error', (error) => resolve({ error }))
    child.once('close', (code) => resolve({ code }))
  })

  try {
    const connection = new URL(databaseUrl)
    const pgEnv = {
      ...process.env,
      PGHOST: connection.hostname,
      PGPORT: connection.port || '5432',
      PGUSER: decodeURIComponent(connection.username),
      PGPASSWORD: decodeURIComponent(connection.password),
      PGDATABASE: decodeURIComponent(connection.pathname.replace(/^\//, '')),
      PGSSLMODE: connection.searchParams.get('sslmode') || process.env.PGSSLMODE || 'require',
    }
    ;({ notifyDiscord } = await loadNotifications())
    // Validate credentials and the target bucket before creating a temporary dump.
    await bucket.getMetadata()
    await mkdir(outputDir, { recursive: true })
    await notifyDiscord('backups', { type: 'BACKUP_STARTED', severity: 'info', title: 'Backup PostgreSQL iniciado', source: 'backup-script', environment: notificationEnvironment })
    const run = await runDump(pgEnv)
    if (run.error || run.code !== 0) throw run.error || new Error(`pg_dump termino con codigo ${run.code}`)
    const file = await stat(destination)
    if (file.size <= 0) throw new Error('El dump generado esta vacio')
    await bucket.upload(destination, { destination: objectName, resumable: false, metadata: { contentType: 'application/octet-stream' } })
    const [uploaded] = await bucket.file(objectName).exists()
    if (!uploaded) throw new Error('No se pudo verificar la subida del backup')
    const metadata = { completedAt: new Date().toISOString(), bytes: file.size, destination: `gs://${bucketName}/${objectName}`, result: 'success' }
    await bucket.file(metadataName).save(JSON.stringify(metadata), { resumable: false, contentType: 'application/json' })
    if (retentionDays > 0) {
      const cutoff = Date.now() - retentionDays * 86_400_000
      const [files] = await bucket.getFiles({ prefix: `${prefix}/` })
      await Promise.all(files
        .filter((item) => item.name !== metadataName && item.metadata.updated && Date.parse(item.metadata.updated) < cutoff)
        .map((item) => item.delete()))
    }
    await notifyDiscord('backups', { type: 'BACKUP_COMPLETED', severity: 'info', title: 'Backup PostgreSQL persistido', source: 'backup-script', environment: notificationEnvironment, metadata: { duracionSegundos: Math.round((Date.now() - startedAt) / 1000), bytes: file.size, destino: `gs://${bucketName}/${objectName}` } })
    process.stdout.write(`Backup persistido en GCS (${file.size} bytes).\n`)
  } catch (error) {
    if (notifyDiscord) {
      await notifyDiscord('backups', { type: 'BACKUP_FAILED', severity: 'critical', title: 'Backup PostgreSQL fallido', source: 'backup-script', environment: notificationEnvironment, metadata: { duracionSegundos: Math.round((Date.now() - startedAt) / 1000), detalle: error instanceof Error ? error.message : 'error_desconocido' } })
    }
    throw error
  } finally {
    await rm(destination, { force: true }).catch(() => {})
  }
}
