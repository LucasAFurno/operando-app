# Supabase rapido

Proyecto objetivo:

- `project_ref`: `rfwsnqmjkclxhbmidbkm`
- `url`: `https://rfwsnqmjkclxhbmidbkm.supabase.co`

## 1. Crear la tabla de sincronizacion

Ejecuta el archivo local [app_snapshots.sql](C:\Users\bandido\Documents\operando-control\supabase\app_snapshots.sql) en el SQL Editor de Supabase.

## 2. Buscar la clave publica

En Supabase:

1. `Project Settings`
2. `Data API`
3. copiar `Publishable key` o `anon key`

## 3. Conectar la app

Entrar a `Ajustes > Conexion cloud` y completar:

- `URL Supabase`: `https://rfwsnqmjkclxhbmidbkm.supabase.co`
- `Clave publica`: la publishable key del proyecto
- `Instancia`: `operando-dev`

Luego usar `Conectar Supabase` y despues `Sincronizar ahora`.

## 4. Nota

Esta conexion actual sincroniza el snapshot completo de la app para pruebas entre navegadores. El siguiente paso profesional es migrar a tablas reales de `usuarios`, `ventas`, `stock`, `caja`, `comprobantes` y `auditoria`.
