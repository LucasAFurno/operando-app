import path from 'node:path'

const required = (name) => {
  const value = String(process.env[name] || '').trim()
  if (!value || value.startsWith('reemplazar-')) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

const storeType = String(process.env.FISCAL_STORE || 'filesystem').trim().toLowerCase()
if (!['filesystem', 'supabase'].includes(storeType)) throw new Error('FISCAL_STORE must be filesystem or supabase')

const boundedInt = (name, fallback, min, max) => {
  const value = Number(process.env[name] || fallback)
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer between ${min} and ${max}`)
  return value
}

export const config = {
  port: Number(process.env.PORT || 8787),
  // Cloud Run only routes traffic to a process bound to every interface.
  host: process.env.FISCAL_HOST || '0.0.0.0',
  environment: process.env.ARCA_ENVIRONMENT === 'production' ? 'production' : 'homologacion',
  serviceToken: required('FISCAL_SERVICE_TOKEN'),
  masterKey: Buffer.from(required('FISCAL_MASTER_KEY_BASE64'), 'base64'),
  storeType,
  dataDir: path.resolve(process.cwd(), process.env.FISCAL_DATA_DIR || '.fiscal-data'),
  supabaseUrl: String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, ''),
  supabaseServiceRoleKey: String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
  openSslBin: process.env.FISCAL_OPENSSL_BIN || 'openssl',
  discord: {
    enabled: process.env.PCLAF_CONTROL_DISCORD_ENABLED === 'true',
    generalWebhookUrl: String(process.env.PCLAF_CONTROL_DISCORD_GENERAL_WEBHOOK_URL || '').trim(),
    logsWebhookUrl: String(process.env.PCLAF_CONTROL_DISCORD_LOGS_WEBHOOK_URL || '').trim(),
    alertasWebhookUrl: String(process.env.PCLAF_CONTROL_DISCORD_ALERTAS_WEBHOOK_URL || '').trim(),
    arcaWebhookUrl: String(process.env.PCLAF_CONTROL_DISCORD_ARCA_WEBHOOK_URL || '').trim(),
    securityWebhookUrl: String(process.env.PCLAF_CONTROL_DISCORD_SEGURIDAD_WEBHOOK_URL || '').trim(),
    gcpRunWebhookUrl: String(process.env.PCLAF_CONTROL_DISCORD_GCP_RUN_WEBHOOK_URL || '').trim(),
    backupsWebhookUrl: String(process.env.PCLAF_CONTROL_DISCORD_BACKUPS_WEBHOOK_URL || '').trim(),
    deploysWebhookUrl: String(process.env.PCLAF_CONTROL_DISCORD_DEPLOYS_WEBHOOK_URL || '').trim(),
    summaryWebhookUrl: String(process.env.PCLAF_CONTROL_DISCORD_RESUMEN_WEBHOOK_URL || '').trim(),
  },
  telegram: {
    enabled: process.env.PCLAF_CONTROL_TELEGRAM_ENABLED === 'true',
    botToken: String(process.env.PCLAF_CONTROL_TELEGRAM_BOT_TOKEN || '').trim(),
    chatId: String(process.env.PCLAF_CONTROL_TELEGRAM_CHAT_ID || '').trim(),
  },
  arcaTimeoutMs: boundedInt('ARCA_TIMEOUT_MS', 15_000, 1_000, 15_000),
  arcaAttemptTimeoutMs: boundedInt('ARCA_ATTEMPT_TIMEOUT_MS', 4_500, 1_000, 15_000),
  arcaMaxAttempts: boundedInt('ARCA_MAX_ATTEMPTS', 2, 1, 2),
  circuitFailureThreshold: boundedInt('ARCA_CIRCUIT_FAILURE_THRESHOLD', 3, 1, 10),
  circuitCooldownMs: boundedInt('ARCA_CIRCUIT_COOLDOWN_MS', 60_000, 1_000, 300_000),
  rateWindowMs: boundedInt('FISCAL_RATE_WINDOW_MS', 60_000, 1_000, 3_600_000),
  globalRatePerWindow: boundedInt('FISCAL_GLOBAL_RATE_PER_WINDOW', 60, 1, 10_000),
  tenantRatePerWindow: boundedInt('FISCAL_TENANT_RATE_PER_WINDOW', 15, 1, 1_000),
  invoiceRatePerWindow: boundedInt('FISCAL_INVOICE_RATE_PER_WINDOW', 6, 1, 1_000),
  emergencyStopCacheMs: boundedInt('FISCAL_EMERGENCY_STOP_CACHE_MS', 5_000, 0, 60_000),
  processingLeaseSeconds: boundedInt('FISCAL_PROCESSING_LEASE_SECONDS', 50, 46, 300),
}

if (config.masterKey.length !== 32) throw new Error('FISCAL_MASTER_KEY_BASE64 must decode to exactly 32 bytes')
if (config.arcaAttemptTimeoutMs > config.arcaTimeoutMs) throw new Error('ARCA_ATTEMPT_TIMEOUT_MS cannot exceed ARCA_TIMEOUT_MS')
if (config.storeType === 'supabase' && (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.supabaseUrl) || !config.supabaseServiceRoleKey)) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required when FISCAL_STORE=supabase')

export const arcaUrls = config.environment === 'production'
  ? {
      wsaa: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
      wsfe: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx',
    }
  : {
      wsaa: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
      wsfe: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
    }
