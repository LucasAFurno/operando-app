import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const metricsPath = path.join(root, 'site', 'marketing-metrics.json')
const supabaseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '')
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

// Never required by GitHub Pages CI. If env is missing, keep committed metrics and exit cleanly.
if (!supabaseUrl || !serviceRoleKey) {
  process.stdout.write(
    'Skip sync:marketing-metrics: faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY; se usa site/marketing-metrics.json commiteado.\n'
  )
  process.exit(0)
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

const salesTotals = async () => {
  const response = await fetch(`${supabaseUrl}/rest/v1/sales?select=total_amount,status&limit=100000`, { headers, signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`Supabase no pudo leer el total de ventas (${response.status}).`)
  const rows = await response.json()
  return rows.filter((sale) => !['cancelled', 'returned'].includes(String(sale.status || '').toLowerCase())).reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0)
}

const [commerces, operations, salesAmount] = await Promise.all([
  count('commerce_accounts'),
  count('sales'),
  salesTotals(),
])

const source = JSON.parse(await readFile(metricsPath, 'utf8'))
const supportAvailability = Number(source.supportAvailability || 24)
source.metrics = [
  { value: commerces, prefix: '+', suffix: '', label: 'comercios registrados' },
  { value: operations, prefix: '+', suffix: '', label: 'ventas procesadas' },
  { value: salesAmount, prefix: '+$', suffix: 'M', format: 'millions', label: 'ARS procesados' },
  { value: supportAvailability, prefix: '', suffix: '/7', label: 'soporte operativo' },
]
await writeFile(metricsPath, `${JSON.stringify(source, null, 2)}\n`)
process.stdout.write(`Métricas sincronizadas: ${commerces} comercios, ${operations} ventas y $${salesAmount} ARS.\n`)
