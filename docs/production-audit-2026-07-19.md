# Auditoria tecnica final operando.app

Fecha: 2026-07-19

## Estado real hoy

La web productiva hoy ya opera con:

- Supabase Postgres
- core real para clientes, ventas, caja, stock, compras, comprobantes, sucursales y cajas
- login cloud con `pin_hash`
- sesiones propias por `control_user_sessions`
- dominio productivo y mail transaccional funcionando
- importacion de productos por Excel/CSV con preview y validacion

En la web publica ya no queda persistencia funcional del negocio en `localStorage`.
Si se cierra esta PC, la web sigue existiendo porque opera contra Supabase.

## Lo que ya quedo endurecido

- Snapshot web desactivado para la operacion normal.
- `app_public_save_snapshot`, `app_public_export_snapshot` y `app_public_session_context` ya no quedan expuestas a `anon` ni `authenticated`.
- La sesion web propia se guarda en `sessionStorage`, no en `localStorage`.
- Las tablas sensibles de snapshot, sesiones y resets quedaron cerradas con RLS/deny-all donde correspondia.
- El frontend publica CSP, `Permissions-Policy`, `referrer-policy` y bloqueo de `frame-ancestors`.
- Varias helpers internas de Supabase dejaron de quedar ejecutables por roles publicos.
- El login cloud valida contra `pin_hash` en Supabase.

## Riesgos que siguen abiertos

### 1. RPC publicas operativas con `security definer`

Hoy la app usa varias RPC publicas ejecutables por `anon`:

- `app_setup_instance`
- `app_public_sign_in`
- `app_public_restore_session`
- `app_public_load_core_state`
- `app_public_upsert_user`
- `app_public_upsert_customer`
- varias de ventas, caja, compras y documentos

Esto funciona porque la web entra con publishable key + token de sesion propio.

No es un agujero automatico, pero sigue siendo el riesgo principal de arquitectura.
Si una de esas RPC tiene una validacion floja, el impacto puede ser alto.

### 2. Falta endurecer permisos finos por accion real

Hoy hay roles y modulos, pero todavia conviene cerrar mejor permisos como:

- crear
- editar
- eliminar
- exportar
- abrir/cerrar caja
- emitir comprobantes
- administrar usuarios y modulos

### 3. Falta cerrar seguridad de Auth

Supabase sigue marcando:

- leaked password protection desactivado
- varias RPC publicas `security definer` como advertencia

Esto hay que cerrarlo antes de venderlo masivamente.

### 4. Falta cobertura automatizada seria

Hoy no hay una suite fuerte de pruebas end-to-end ni de regresion para:

- login
- crear comercio
- ventas
- caja
- comprobantes
- permisos

## Veredicto

### Se puede mostrar a clientes?

Si.

### Se puede probar con clientes reales?

Si, con pilotos reales chicos y controlados.

### Lo largaria como producto abierto y escalable ya mismo?

Todavia no.

## Para dejarlo listo de verdad

1. Migrar la capa publica critica a Supabase Auth real o a Edge Functions para que no dependan tantas RPC `security definer` abiertas a `anon`.
2. Revisar una por una las RPC publicas operativas y dejar solo las indispensables.
3. Activar leaked password protection y revisar politicas finales de Auth.
4. Agregar permisos finos por accion para empleados.
5. Agregar pruebas end-to-end minimas de acceso, alta, venta, caja, compras y comprobantes.
6. Cerrar trial, suscripcion, vencimiento y bloqueo comercial.
