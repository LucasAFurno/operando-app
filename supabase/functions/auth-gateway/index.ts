const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } })
const escapeHtml = (value: string) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character))
const recoveryEmailHtml = (actionUrl: string) => {
  const safeUrl = escapeHtml(actionUrl)
  return `<!doctype html><html lang="es"><body style="margin:0;padding:0;background:#090a0b;font-family:Arial,Helvetica,sans-serif;color:#f8fafc"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#090a0b"><tr><td align="center" style="padding:40px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#17191d;border:1px solid #30343a;border-radius:24px;overflow:hidden"><tr><td style="padding:34px 34px 18px"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="padding-right:12px"><img src="https://operando.app/operando-logo.png" width="42" height="42" alt="Operando" style="display:block;border-radius:50%;background:#050505" /></td><td><strong style="font-size:20px;line-height:24px;color:#f8fafc">Operando</strong><br /><span style="font-size:13px;line-height:18px;color:#aeb5c0">Gestión comercial online</span></td></tr></table></td></tr><tr><td style="padding:16px 34px 38px"><p style="margin:0 0 12px;color:#ff4b55;font-size:12px;font-weight:bold;letter-spacing:1.6px">RECUPERAR ACCESO</p><h1 style="margin:0 0 16px;font-size:32px;line-height:38px;color:#ffffff">Creá una nueva clave</h1><p style="margin:0 0 28px;font-size:16px;line-height:25px;color:#d2d7df">Recibimos una solicitud para recuperar el acceso a tu cuenta. Usá el botón para elegir una clave nueva y volver a entrar a Operando.</p><a href="${safeUrl}" style="display:inline-block;background:#ff3340;border-radius:12px;color:#ffffff;font-size:16px;font-weight:bold;line-height:20px;padding:15px 22px;text-decoration:none">Crear nueva clave</a><p style="margin:28px 0 0;font-size:14px;line-height:22px;color:#aeb5c0">Este enlace vence pronto y sólo puede usarse una vez. Si no pediste recuperar el acceso, podés ignorar este correo.</p></td></tr><tr><td style="padding:20px 34px;border-top:1px solid #30343a;font-size:12px;line-height:18px;color:#88909c">Operando · operando.app</td></tr></table></td></tr></table></body></html>`
}
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
    // TURNSTILE_SECRET_KEY is the canonical deployment secret. Keep the prior
    // name as a temporary fallback so an in-flight deployment is not disabled.
    const secret = Deno.env.get('TURNSTILE_SECRET_KEY') || Deno.env.get('TURNSTILE_SECRET') || ''
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
      if (email) {
        const resendApiKey = Deno.env.get('RESEND_API_KEY') || ''
        if (resendApiKey) {
          const linkResponse = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, { method: 'POST', headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' }, body: JSON.stringify({ type: 'recovery', email, redirect_to: redirectTo }) })
          const linkPayload = await linkResponse.json()
          const actionUrl = String(linkPayload?.action_link || '')
          if (!linkResponse.ok || !actionUrl) throw new Error('recovery_link_unavailable')
          const emailResponse = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${resendApiKey}`, 'content-type': 'application/json' }, body: JSON.stringify({ from: Deno.env.get('SECURITY_EMAIL_FROM') || 'Operando <notificaciones@operando.app>', to: [email], subject: 'Recuperá tu acceso a Operando', html: recoveryEmailHtml(actionUrl), text: `Recuperá tu acceso a Operando: ${actionUrl}\n\nEste enlace vence pronto y sólo puede usarse una vez.` }) })
          if (!emailResponse.ok) throw new Error('recovery_email_unavailable')
        } else {
          await fetch(`${supabaseUrl}/auth/v1/otp`, { method: 'POST', headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' }, body: JSON.stringify({ email, create_user: false, options: { email_redirect_to: redirectTo } }) })
        }
      }
      return json({ ok: true, message: 'Si existe una cuenta con ese correo, te enviamos un enlace para recuperar el acceso.' }, 200, headers)
    }
    const deviceHash = await digest(String(body.deviceId || 'unknown-device'))
    const login = await rpc('app_public_sign_in', { p_instance_key: body.instanceKey || '', p_identifier: body.identifier || '', p_pin: body.pin || '', p_device_hash: deviceHash }).then((response) => response.json())
    if (!login?.session_token) return json({ error: 'invalid_credentials' }, 401, headers)
    if (login.new_device && Deno.env.get('RESEND_API_KEY')) {
      await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'content-type': 'application/json' }, body: JSON.stringify({ from: Deno.env.get('SECURITY_EMAIL_FROM') || 'Operando <notificaciones@operando.app>', to: [login.profile?.email], subject: 'Nuevo inicio de sesión en Operando', text: `Detectamos un nuevo dispositivo iniciando sesión en tu cuenta el ${new Date().toLocaleString('es-AR')}. Si no fuiste vos, recuperá tu clave inmediatamente.` }) })
    }
    return json(login, 200, headers)
  } catch { return json({ error: 'access_denied' }, 403, headers) }
})
