# Seguridad de acceso

1. Creá un widget Turnstile de producción para `operando.app` y `www.operando.app`. Poné su **site key** (clave pública) en `site/cloud-config.prod.json` (`turnstileSiteKey`). La clave secreta nunca va al navegador.
2. Configurá los secretos de la Edge Function: `TURNSTILE_SECRET_KEY`, `AUTH_RATE_LIMIT_PEPPER`, `RESEND_API_KEY` y `SECURITY_EMAIL_FROM`. `TURNSTILE_SECRET_KEY` debe ser la secret key del mismo widget que la site key pública.
3. Ejecutá `supabase/2026-07-23-login-attempt-limit.sql` y luego `supabase/2026-07-23-auth-gateway-security.sql` en el SQL Editor.
4. Desplegá `supabase/functions/auth-gateway` con JWT verification desactivada, ya que recibe visitantes sin sesión y valida Turnstile internamente.

La función limita a 10 solicitudes de login por IP cada 15 minutos, exige un token Turnstile de un solo uso y envía una alerta mediante Resend cuando una cuenta inicia desde un dispositivo no visto previamente.
