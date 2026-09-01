import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const normalizeUrl = (url) => String(url || '').trim().replace(/\/+$/, '')

const buildHeaders = (anonKey, extra = {}) => ({
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
  'Content-Type': 'application/json',
  ...extra,
})

const safeJson = async (response) => {
  try {
    return await response.json()
  } catch {
    return null
  }
}

const normalizeSessionPayload = (payload) => {
  if (!payload?.session_token || !payload?.profile) return null
  return {
    sessionToken: payload.session_token,
    profile: payload.profile,
    commerceContext: payload.commerce_context || null,
  }
}

const readTurnstileToken = () => String(globalThis.document?.querySelector('input[name="cf-turnstile-response"]')?.value || '')
const resetTurnstile = () => {
  try {
    globalThis.turnstile?.reset()
  } catch {
    // A retry will render a fresh widget if the Turnstile API is unavailable.
  }
}

const apiError = (payload, fallback) => {
  const code = String(payload?.error || fallback)
  const retryAfterSeconds = Number(payload?.retry_after_seconds || 0)
  return retryAfterSeconds > 0 ? `${code}:${Math.ceil(retryAfterSeconds)}` : code
}

export const createCloudAuthManager = ({ url, anonKey, instanceKey = 'pclaf-dev', turnstileSiteKey = '' }) => {
  const baseUrl = normalizeUrl(url)
  const publishableKey = String(anonKey || '').trim()
  const currentInstanceKey = String(instanceKey || 'pclaf-dev').trim().toLowerCase()
  const turnstileEnabled = Boolean(String(turnstileSiteKey || '').trim())
  if (!baseUrl || !publishableKey) {
    return null
  }
  // Custom Operando sessions are memory-only; no bearer credential is persisted.
  let session = null
  const supabase = createClient(baseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: true,
    },
  })

  let recoveryState = null
  const readSession = () => session
  const persistRecovery = (payload) => {
    recoveryState = payload || null
  }
  const readRecovery = () => recoveryState

  const rpc = async (fnName, body = {}) => {
    const response = await fetch(`${baseUrl}/rest/v1/rpc/${fnName}`, {
      method: 'POST',
      headers: buildHeaders(publishableKey),
      body: JSON.stringify(body),
    })
    const payload = await safeJson(response)
    if (!response.ok) {
      throw new Error(payload?.message || payload?.hint || payload?.details || `RPC failed (${response.status})`)
    }
    return payload
  }

  const rpcWithToken = async (fnName, body = {}, accessToken = '') => {
    const response = await fetch(`${baseUrl}/rest/v1/rpc/${fnName}`, {
      method: 'POST',
      headers: buildHeaders(publishableKey, accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      body: JSON.stringify(body),
    })
    const payload = await safeJson(response)
    if (!response.ok) {
      throw new Error(payload?.message || payload?.hint || payload?.details || `RPC failed (${response.status})`)
    }
    return payload
  }

  const setSession = (payload) => {
    session = normalizeSessionPayload(payload)
    return session
  }

  const normalizeInstanceKey = (value) => String(value || currentInstanceKey || 'pclaf-dev').trim().toLowerCase() || 'pclaf-dev'
  const normalizeOptionalInstanceKey = (value) => {
    if (value == null) return ''
    const normalized = String(value).trim().toLowerCase()
    return normalized || ''
  }

  const getSetupStatus = async ({ instanceKey: requestedInstanceKey } = {}) => rpc('app_get_setup_status', {
    p_instance_key: normalizeInstanceKey(requestedInstanceKey),
  })

  const setupInstance = async ({ instanceKey: requestedInstanceKey, commerceName, ownerName, ownerLogin, ownerEmail, ownerPin, branchName, branchCode, registerName, registerCode }) => {
    const payload = await rpc('app_setup_instance', {
      p_instance_key: normalizeInstanceKey(requestedInstanceKey),
      p_commerce_name: commerceName,
      p_owner_name: ownerName,
      p_owner_login: ownerLogin,
      p_owner_email: ownerEmail,
      p_owner_pin: ownerPin,
      p_branch_name: branchName,
      p_branch_code: branchCode,
      p_register_name: registerName,
      p_register_code: registerCode,
    })
    return setSession(payload)
  }

  const signIn = async ({ instanceKey: requestedInstanceKey, identifier, pin }) => {
    if (!turnstileEnabled) throw new Error('security_not_configured')
    const deviceId = crypto.randomUUID()
    const turnstileToken = readTurnstileToken()
    if (!turnstileToken) throw new Error('turnstile_required')
    const response = await fetch(`${baseUrl}/functions/v1/auth-gateway`, { method: 'POST', headers: buildHeaders(publishableKey), body: JSON.stringify({ instanceKey: normalizeOptionalInstanceKey(requestedInstanceKey), identifier, pin, deviceId, turnstileToken }) })
    const payload = await safeJson(response)
    if (!response.ok) {
      resetTurnstile()
      throw new Error(apiError(payload, 'invalid_credentials'))
    }
    if (payload?.error) {
      resetTurnstile()
      throw new Error(apiError(payload, 'invalid_credentials'))
    }
    const nextSession = setSession(payload)
    if (!nextSession) throw new Error('signin_failed')
    return nextSession
  }

  const restoreSession = async () => null

  const signOut = async () => {
    const token = session?.sessionToken || ''
    if (token) {
      try {
        await rpc('app_public_sign_out', { p_session_token: token })
      } catch {
        // best effort
      }
    }
    session = null
  }

  const sendRecoveryMagicLink = async ({ email, redirectTo }) => {
    const normalizedEmail = String(email || '').trim().toLowerCase()
    if (!turnstileEnabled) throw new Error('security_not_configured')
    const token = readTurnstileToken()
    if (!token) throw new Error('turnstile_required')
    const response = await fetch(`${baseUrl}/functions/v1/auth-gateway`, { method: 'POST', headers: buildHeaders(publishableKey), body: JSON.stringify({ mode: 'recovery', email: normalizedEmail, redirectTo, turnstileToken: token }) })
    if (!response.ok) {
      resetTurnstile()
      throw new Error(apiError(payload, 'access_denied'))
    }
    persistRecovery({ email: normalizedEmail, requestedAt: new Date().toISOString() })
    return {
      ok: true,
      message: 'Te enviamos un enlace para recuperar el acceso. Revisa tu correo y luego define una clave nueva.',
    }
  }

  const consumeRecoverySession = async () => {
    const url = new URL(window.location.href)
    const isRecoveryRoute = url.searchParams.get('auth_action') === 'recover'
    const { data } = await supabase.auth.getSession()
    const sessionData = data?.session || null
    if (!isRecoveryRoute || !sessionData?.access_token) return null
    const payload = {
      email: sessionData.user?.email || readRecovery()?.email || '',
      accessToken: sessionData.access_token,
    }
    persistRecovery(payload)
    return payload
  }

  const completeRecovery = async ({ password }) => {
    const recovery = readRecovery()
    const { data } = await supabase.auth.getSession()
    const authSession = data?.session || null
    const accessToken = authSession?.access_token || recovery?.accessToken || ''
    if (!accessToken) throw new Error('recovery_session_missing')
    const normalizedPassword = String(password || '')
    if (normalizedPassword.trim().length < 6) throw new Error('owner_pin_too_short')
    const { error } = await supabase.auth.updateUser({ password: normalizedPassword })
    if (error) throw error
    await rpcWithToken('app_sync_password_from_auth', {
      p_new_pin: normalizedPassword,
    }, accessToken)
    await supabase.auth.signOut()
    persistRecovery(null)
    return {
      ok: true,
      message: 'Clave actualizada. Ya puedes entrar con la nueva clave.',
    }
  }

  const clearRecoveryState = async () => {
    persistRecovery(null)
    try {
      await supabase.auth.signOut()
    } catch {
      // ignore cleanup issues
    }
    const url = new URL(window.location.href)
    if (url.searchParams.get('auth_action') === 'recover' || url.hash) {
      url.searchParams.delete('auth_action')
      window.history.replaceState({}, '', `${url.pathname}${url.search}`)
    }
  }

  return {
    getSession: () => session,
    getSetupStatus,
    setupInstance,
    signIn,
    sendRecoveryMagicLink,
    consumeRecoverySession,
    completeRecovery,
    clearRecoveryState,
    restoreSession,
    updateSessionProfile: (patch = {}) => {
      if (!session?.profile || !patch || typeof patch !== 'object') return session
      session = { ...session, profile: { ...session.profile, ...patch } }
      persistSession()
      return session
    },
    signOut,
  }
}
