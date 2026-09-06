# Headers de seguridad — operando.app

## Prioridad Lucas (#1)

HSTS, CSP, `X-Content-Type-Options: nosniff`, `frame-ancestors` / clickjacking, y sacar `Access-Control-Allow-Origin: *` de Pages.

## Hallazgos

| Pieza | Hoy |
| --- | --- |
| Hosting | GitHub Pages (`server: GitHub.com` + Fastly) |
| DNS | GoDaddy NS → A a IPs Pages |
| Cloudflare | **No** está delante (sin `cf-ray`) |
| ACAO | `*` en HTML de Pages |
| HSTS / nosniff / CSP HTTP | Ausentes en respuesta |
| CSP meta (panel SPA) | Sí, en `scripts/build.mjs` → `appHtml` |

## Qué versionamos en este repo

1. CSP del SPA endurecida en `scripts/build.mjs` (meta + alineada al edge).
2. Spec Cloudflare en [`ops/cloudflare/`](../ops/cloudflare/) para cuando se ponga proxy naranja.
3. Este doc con el procedimiento de cutover.

## Qué bloquea el 100% sin cambio de DNS

Sin Cloudflare (u otro edge), **no** se pueden fijar HSTS ni quitar el ACAO `*` de Pages. El PR deja todo listo; el cutover DNS es el paso operativo.

## CSP (objetivos)

Orígenes necesarios para no romper login/alta:

- `self` — assets Pages
- `https://esm.sh` — supabase-js en client
- `https://challenges.cloudflare.com` — Turnstile
- `https://rfwsnqmjkclxhbmidbkm.supabase.co` — REST + `functions/v1/auth-gateway`
- GTM `GTM-WFW5KTHS` / Analytics (sigue permitido; XSS/GTM es ítem aparte)

`frame-ancestors 'none'` + header `X-Frame-Options: DENY` en edge.
