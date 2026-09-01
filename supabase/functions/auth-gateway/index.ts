const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } })
const configuredOrigins = () => (Deno.env.get('AUTH_ALLOWED_ORIGINS') || 'https://operando.app')
  .split(',').map((value) => value.trim().replace(/\/$/, '')).filter(Boolean)
const requestOrigin = (request: Request) => String(request.headers.get('origin') || '').trim().replace(/\/$/, '')
const cors = (request: Request) => {
  const origin = requestOrigin(request)
  return configuredOrigins().includes(origin)
    ? { 'access-control-allow-origin': origin, vary: 'Origin', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type, apikey, authorization' }
    : {}
}
const allowedRequestOrigin = (request: Request) => configuredOrigins().includes(requestOrigin(request))
const allowedTurnstileHostnames = () => configuredOrigins().map((origin) => {
  try {
    return new URL(origin).hostname
  } catch {
    return ''
  }
}).filter(Boolean)
const allowedRedirect = (value: unknown) => {
  try {
    const redirect = new URL(String(value || ''))
    return configuredOrigins().includes(redirect.origin) && redirect.pathname.startsWith('/app/') ? redirect.toString() : ''
  } catch {
    return ''
  }
}
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map((byte) => byte.toString(16).padStart(2, '0')).join('')

Deno.serve(async (request) => {
  const headers = cors(request)
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, headers)
  if (!allowedRequestOrigin(request)) return json({ error: 'origin_not_allowed' }, 403)
  try {
    const body = await request.json()
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const secret = Deno.env.get('TURNSTILE_SECRET') || ''
    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!supabaseUrl || !serviceKey || !secret) return json({ error: 'security_not_configured' }, 503, headers)
    const turnstileToken = String(body.turnstileToken || '').trim()
    if (!turnstileToken) return json({ error: 'access_denied' }, 403, headers)
    const verificationResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: turnstileToken, remoteip: ip }),
    })
    if (!verificationResponse.ok) return json({ error: 'turnstile_unavailable' }, 503, headers)
    const verify = await verificationResponse.json()
    if (!verify.success || verify.action !== 'turnstile-spin-v2' || !allowedTurnstileHostnames().includes(String(verify.hostname || '').toLowerCase())) return json({ error: 'turnstile_failed' }, 403, headers)
    const key = await digest(`${Deno.env.get('AUTH_RATE_LIMIT_PEPPER') || ''}:${ip}`)
    const rpc = async (name: string, payload: object) => fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' }, body: JSON.stringify(payload) })
    const mode = body.mode === 'recovery' ? 'recovery' : 'login'
    const limited = await rpc('app_auth_rate_limit', { p_key: key, p_action: mode }).then((response) => response.json())
    if (!limited?.allowed) {
      const retryAfterSeconds = Math.max(1, Number(limited?.retry_after_seconds || 60))
      return json({ error: 'login_rate_limited', retry_after_seconds: retryAfterSeconds }, 429, { ...headers, 'retry-after': String(retryAfterSeconds) })
    }
    if (mode === 'recovery') {
      const email = String(body.email || '').trim().toLowerCase()
      const redirectTo = allowedRedirect(body.redirectTo)
      if (!redirectTo) return json({ error: 'invalid_redirect' }, 422, headers)
      if (email) await fetch(`${supabaseUrl}/auth/v1/otp`, { method: 'POST', headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' }, body: JSON.stringify({ email, create_user: false, options: { email_redirect_to: redirectTo } }) })
      return json({ ok: true, message: 'Si existe una cuenta con ese correo, te enviamos un enlace para recuperar el acceso.' }, 200, headers)
    }
    const deviceHash = await digest(String(body.deviceId || 'unknown-device'))
    const login = await rpc('app_public_sign_in', { p_instance_key: body.instanceKey || '', p_identifier: body.identifier || '', p_pin: body.pin || '', p_device_hash: deviceHash }).then((response) => response.json())
    if (!login?.session_token) return json({ error: 'invalid_credentials' }, 401, headers)
    if (login.new_device && Deno.env.get('RESEND_API_KEY')) {
      await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'content-type': 'application/json' }, body: JSON.stringify({ from: Deno.env.get('SECURITY_EMAIL_FROM') || 'operando.app <security@pclaf.com>', to: [login.profile?.email], subject: 'Nuevo inicio de sesión en operando.app', text: `Detectamos un nuevo dispositivo iniciando sesión en tu cuenta el ${new Date().toLocaleString('es-AR')}. Si no fuiste vos, recuperá tu clave inmediatamente.` }) })
    }
    return json(login, 200, headers)
  } catch { return json({ error: 'access_denied' }, 403, headers) }
})
