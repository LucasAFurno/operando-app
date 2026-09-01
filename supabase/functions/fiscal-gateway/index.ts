type ServiceAccount = { client_email: string; private_key: string }

const json = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extraHeaders },
})

const base64Url = (value: string | Uint8Array) => {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

const pemBytes = (pem: string) => {
  const source = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '')
  const binary = atob(source)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

const mintGoogleIdToken = async (audience: string, encodedCredentials: string) => {
  let account: ServiceAccount
  try { account = JSON.parse(encodedCredentials) } catch { throw new Error('OPERANDO_GCP_INVOKER_SERVICE_ACCOUNT_JSON is invalid') }
  if (!account.client_email || !account.private_key) throw new Error('OPERANDO_GCP_INVOKER_SERVICE_ACCOUNT_JSON is incomplete')
  const now = Math.floor(Date.now() / 1000)
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64Url(JSON.stringify({
    iss: account.client_email,
    sub: account.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 300,
    target_audience: audience,
  }))
  const key = await crypto.subtle.importKey('pkcs8', pemBytes(account.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`))
  const assertion = `${header}.${claims}.${base64Url(new Uint8Array(signature))}`
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  const token = await tokenResponse.json()
  if (!tokenResponse.ok || typeof token.id_token !== 'string') throw new Error('Unable to mint the Cloud Run ID token')
  return token.id_token as string
}

const sessionContext = async (sessionToken: string) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
  if (!supabaseUrl || !anonKey) throw new Error('Supabase runtime variables are unavailable')
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/app_public_session_context`, {
    method: 'POST',
    headers: { apikey: anonKey, authorization: `Bearer ${anonKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_session_token: sessionToken }),
  })
  if (!response.ok) throw new Error('Invalid Operando session')
  const rows = await response.json()
  const context = Array.isArray(rows) ? rows[0] : rows
  if (!context?.session_commerce_id) throw new Error('Invalid Operando session')
  return context
}

const corsHeaders = (request: Request) => {
  const origin = request.headers.get('origin') || ''
  const allowedOrigins = (Deno.env.get('FISCAL_ALLOWED_ORIGIN') || '').split(',').map((value) => value.trim()).filter(Boolean)
  return allowedOrigins.includes(origin)
    ? { 'access-control-allow-origin': origin, vary: 'Origin' }
    : {}
}

Deno.serve(async (request) => {
  const cors = corsHeaders(request)
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type, x-operando-session' } })
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors)

  try {
    const sessionToken = request.headers.get('x-operando-session') || ''
    if (!sessionToken) return json({ error: 'unauthorized' }, 401, cors)
    const body = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'invalid_request' }, 422, cors)
    const tenantId = String(body.tenantId || '').trim().toLowerCase()
    if (!/^[a-z0-9][a-z0-9_-]{2,80}$/.test(tenantId)) return json({ error: 'invalid_tenant' }, 422, cors)
    const action = String(body.action || 'invoices').trim().toLowerCase()
    if (!['certificate-request', 'certificate', 'verify', 'invoices'].includes(action)) return json({ error: 'invalid_fiscal_action' }, 422, cors)
    const context = await sessionContext(sessionToken)
    if (!context.session_is_owner && context.session_role_key !== 'admin') return json({ error: 'fiscal_permission_denied' }, 403, cors)
    if (body.commerceId && String(body.commerceId).toLowerCase() !== String(context.session_commerce_id).toLowerCase()) return json({ error: 'commerce_mismatch' }, 403, cors)

    const runUrl = (Deno.env.get('FISCAL_RUN_URL') || '').replace(/\/$/, '')
    const audience = Deno.env.get('FISCAL_RUN_AUDIENCE') || runUrl
    const serviceToken = Deno.env.get('FISCAL_SERVICE_TOKEN') || ''
    const serviceAccount = Deno.env.get('OPERANDO_GCP_INVOKER_SERVICE_ACCOUNT_JSON') || ''
    if (!runUrl || !audience || !serviceToken || !serviceAccount) throw new Error('Fiscal gateway is not configured')
    const idToken = await mintGoogleIdToken(audience, serviceAccount)
    const fiscalResponse = await fetch(`${runUrl}/v1/tenants/${encodeURIComponent(tenantId)}/${action}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${serviceToken}`,
        'x-serverless-authorization': `Bearer ${idToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ...body, commerceId: context.session_commerce_id }),
      signal: AbortSignal.timeout(42_000),
    })
    const responseBody = await fiscalResponse.text()
    return new Response(responseBody, { status: fiscalResponse.status, headers: { ...cors, 'content-type': fiscalResponse.headers.get('content-type') || 'application/json; charset=utf-8', 'cache-control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error'
    console.error(JSON.stringify({ event: 'fiscal_gateway_failed', message }))
    return json({ error: 'fiscal_gateway_failed', message }, 502, cors)
  }
})
