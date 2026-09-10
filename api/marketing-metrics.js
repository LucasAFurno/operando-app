const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
  },
})

export default async function handler(request) {
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405)
  const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '')
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!url || !key) return json({ error: 'metrics_unavailable' }, 503)
  const headers = { apikey: key, authorization: `Bearer ${key}`, prefer: 'count=exact' }
  const count = async (table) => {
    const response = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, { headers })
    if (!response.ok) throw new Error(`count_${table}`)
    const total = Number((response.headers.get('content-range') || '').split('/')[1])
    if (!Number.isFinite(total)) throw new Error(`count_${table}`)
    return total
  }
  try {
    const [commerces, sales] = await Promise.all([count('commerce_accounts'), fetch(`${url}/rest/v1/sales?select=total_amount&limit=10000`, { headers }).then(async (response) => {
      if (!response.ok) throw new Error('sales')
      const rows = await response.json()
      return {
        count: Number((response.headers.get('content-range') || '').split('/')[1]),
        total: rows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0),
      }
    })])
    if (!Number.isFinite(sales.count) || !Number.isFinite(sales.total)) throw new Error('sales')
    return json({ metrics: [
      { value: commerces, prefix: '+', suffix: '', label: 'comercios registrados' },
      { value: sales.count, prefix: '+', suffix: '', label: 'ventas procesadas' },
      { value: sales.total, prefix: '+$', suffix: 'M', format: 'millions', label: 'ARS procesados' },
      { value: Number(process.env.MARKETING_SUPPORT_AVAILABILITY || 24), prefix: '', suffix: '/7', label: 'soporte operativo' },
    ] })
  } catch {
    return json({ error: 'metrics_unavailable' }, 503)
  }
}
