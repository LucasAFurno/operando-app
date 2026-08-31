# PCLAF Control

Base web real de PCLAF Control orientada a GitHub como origen unico y Supabase como backend.

## Objetivo

Construir un sistema comercial web que despues se pueda vender por modulos:

- ventas y caja
- productos y stock
- clientes y proveedores
- comprobantes
- sucursales, cajas y usuarios

## Alcance comercial actual

La comunicación pública de PCLAF Control se apoya en funciones ya presentes en la operación: sucursales, cajas asociadas a puestos, transferencias y movimientos con historial, compras y proveedores, y usuarios con roles, módulos y permisos configurables.

La configuración de ARCA se encuentra orientada a homologación. No debe comunicarse como emisión fiscal productiva hasta completar esa salida con cada comercio.

### Métricas de la web pública

`site/marketing-metrics.json` es la fuente de los indicadores y de los rubros rotativos de la portada. Actualizar únicamente valores agregados y autorizados; nunca datos de un comercio, usuario o transacción identificable.

Para actualizar los dos indicadores comerciales desde Supabase, ejecutar `npm run sync:marketing-metrics` en un entorno server-side que tenga `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. El script sólo escribe los conteos agregados de comercios y operaciones; la credencial nunca llega al sitio público.

## Stack recomendado

- frontend: Vite + JavaScript
- backend: Supabase
- deploy demo: GitHub Pages
- dominio final: `www.pclafcontrol.com.ar`

## Ambientes

Conviene separar desde el arranque:

- `pclaf-dev`: desarrollo y pruebas
- `pclaf-prod`: produccion real

No mezclar datos de clientes reales con desarrollo.

## Flujo recomendado

1. Trabajar siempre en local.
2. Probar contra `pclaf-dev`.
3. Subir cambios a GitHub.
4. Validar demo web.
5. Recién después promover a `pclaf-prod`.

## Variables

Copiar `.env.example` a `.env` y completar:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_INSTANCE_ENV`
- `VITE_INSTANCE_KEY`
- `PCLAF_GA4_ID` (opcional; ID público de medición GA4 para la web pública)

Para GitHub Pages, configurá `PCLAF_GA4_ID` como una variable del repositorio en
**Settings → Secrets and variables → Actions → Variables**. El workflow la pasa al
build; GA4 se carga únicamente cuando el visitante acepta las cookies analíticas.

## Primeros pasos

```bash
npm install
npm run dev
```

## Siguiente etapa

Lo siguiente más importante para construir sin rehacer después es:

1. modelar Supabase real para comercios, usuarios, sucursales, cajas y permisos
2. hacer login, alta de cuenta y recupero de clave amigable
3. armar dashboard operativo y modulos por pack

