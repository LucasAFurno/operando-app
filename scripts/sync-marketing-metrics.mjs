import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const metricsPath = path.join(root, 'site', 'marketing-metrics.json')
const supabaseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '')
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Definí SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para sincronizar métricas de marketing.')
}

const headers = {
  apikey: serviceRoleKey,
  authorization: `Bearer ${serviceRoleKey}`,
  prefer: 'count=exact',
}

const count = async (table) => {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=id&limit=1`, {
    headers,
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`Supabase no pudo contar ${table} (${response.status}).`)
  const total = Number((response.headers.get('content-range') || '').split('/')[1])
  if (!Number.isFinite(total)) throw new Error(`Supabase no devolvió un conteo para ${table}.`)
  return total
}

const [commerces, operations] = await Promise.all([
  count('commerce_accounts'),
  count('sales'),
])

const source = JSON.parse(await readFile(metricsPath, 'utf8'))
const averageSaleAmount = Number(source.averageSaleAmount || 0)
const supportAvailability = Number(source.supportAvailability || 24)
source.metrics = [
  { value: commerces, prefix: '+', suffix: '', label: 'comercios registrados' },
  { value: operations, prefix: '+', suffix: '', label: 'ventas procesadas' },
  { value: operations * averageSaleAmount, prefix: '+$', suffix: 'M', format: 'millions', label: 'ARS procesados' },
  { value: supportAvailability, prefix: '', suffix: '/7', label: 'soporte operativo' },
]
await writeFile(metricsPath, `${JSON.stringify(source, null, 2)}\n`)
process.stdout.write(`Métricas sincronizadas: ${commerces} comercios, ${operations} ventas y $${operations * averageSaleAmount} ARS.\n`)
