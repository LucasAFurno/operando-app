# Cloudflare delante de GitHub Pages (headers)

## Estado actual (2026-09-06)

- **DNS NS**: GoDaddy (`ns33/ns34.domaincontrol.com`) — **no** Cloudflare.
- **A records** `operando.app` → IPs GitHub Pages (`185.199.108–111.153`).
- **www** → `lucasafurno.github.io`.
- Respuesta live: `server: GitHub.com`, `access-control-allow-origin: *`, **sin** HSTS/CSP HTTP/`X-Content-Type-Options`.
- El panel ya lleva **CSP en meta** vía `scripts/build.mjs` (no alcanza para HSTS ni para sacar ACAO `*`).

GitHub Pages **no** permite `_headers` custom. Hace falta un edge (Cloudflare) delante.

## Cutover recomendado

1. Crear zona `operando.app` en Cloudflare (plan Free alcanza para Transform Rules básicas).
2. Cambiar NS en GoDaddy a los que Cloudflare indique **o** (menos ideal) mantener GoDaddy NS y apuntar A/CNAME a Cloudflare solo si usan setup parcial — preferir **NS en Cloudflare**.
3. Registros:
   - `operando.app` A → mismas IPs de GitHub Pages **proxied** (nube naranja), o CNAME flattening a `lucasafurno.github.io` si Cloudflare lo ofrece en el plan.
   - `www` CNAME → `lucasafurno.github.io` proxied.
4. SSL/TLS: **Full** (GitHub Pages ya sirve HTTPS).
5. Aplicar reglas de `response-headers.json` (Transform Rules → Modify Response Header).
6. Verificar:
   ```bash
   curl -sI https://operando.app/ | rg -i 'strict-transport|content-security|x-content-type|x-frame|access-control|cf-ray'
   ```
7. Smoke: `/ingresar/`, `/crear-cuenta/` (Turnstile), login, alta.

## Archivos

- `response-headers.json` — valores exactos a set/remove.
- No commitear API tokens. Aplicación manual en dashboard o `CLOUDFLARE_API_TOKEN` fuera del repo.
