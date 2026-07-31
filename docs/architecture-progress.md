# Progreso de arquitectura

Última revisión: 2026-07-31. Este documento refleja el código y las migraciones presentes en el repositorio; no implica que una migración haya sido aplicada a `pclaf-dev` o a producción.

## Arquitectura actual

```text
Frontend ES modules (app.js, data-store.js, cloud-core.js)
  -> RPC de Supabase con token de sesión propio
  -> PostgreSQL / RLS / RPC SECURITY DEFINER

Frontend
  -> Edge Function fiscal-gateway
  -> fiscal-server privado
  -> ARCA

Electron
  -> SQLite local (desktop/local-db.mjs)
```

## Estado por área

| Área | Estado | Evidencia / límite actual |
| --- | --- | --- |
| Contratos RPC y contexto de comercio | Parcial | Las RPC operativas consultan `app_public_session_context`; queda una auditoría de todas las RPC y políticas RLS con una base de pruebas contra dos comercios. |
| Venta, transacción e idempotencia | Parcial | `20260728023000_sale_operation_idempotency.sql` persiste `(commerce_id, operation_id)` y bloquea filas de stock antes de delegar a la venta existente. Falta ejecutarlo y probarlo contra PostgreSQL concurrente en `pclaf-dev`. |
| Stock concurrente | Parcial | La venta cloud usa `FOR UPDATE OF stock` en orden estable. La versión Electron conserva validaciones locales; no sustituye el bloqueo de PostgreSQL. |
| Carga modular | Parcial | `app_public_load_runtime_state` acepta módulos y conserva el contrato JSON. Aún no hay paginación SQL por listado ni cancelación de solicitudes en frontend. |
| Realtime | Parcial | `cloud-core.js` comunica dominios afectados al store. Falta consolidar suscripciones, descarte de solicitudes obsoletas y protección de formularios editados. |
| Observabilidad | Parcial | `fiscal-server/src/audit.mjs` emite JSON y filtra campos sensibles. Falta centralizar el mismo formato en frontend y Edge Functions. |
| Flujo ARCA | Parcial | El servicio persistente fiscal protege idempotencia y reconcilia estados ambiguos. Faltan los estados solicitados normalizados y pruebas end-to-end del gateway. |
| Modularización de `app.js` | Pendiente | `app.js` sigue coordinando interfaz, rutas, estado y eventos. Se debe extraer primero una unidad aislada sin modificar los contratos actuales. |
| Pruebas automáticas operativas | Parcial | Se agregaron regresiones ejecutables para el flujo local y un contrato estático de la migración crítica. Faltan pruebas de integración de Supabase y de interfaz. |

## Riesgos identificados

1. El árbol de trabajo contiene modificaciones locales extensas en interfaz, autenticación, cloud y Electron. No se deben mezclar con una refactorización de `app.js` hasta revisarlas o aislarlas en un commit/branch propio.
2. La protección de concurrencia e idempotencia está definida en una migración, pero este repositorio no contiene un ejecutor de pruebas PostgreSQL ni evidencia de aplicación en `pclaf-dev`.
3. La compatibilidad temporal de `cloud-core.js` puede reintentar la firma antigua de `app_public_create_sale` si la RPC con `operation_id` aún no existe. Esa ruta debe retirarse solamente después de confirmar que la migración está aplicada en todos los ambientes soportados.
4. La carga por módulos conserva colecciones completas dentro de cada dominio; para historiales grandes se requiere paginación SQL respaldada por consultas reales e índices verificados con `EXPLAIN` en desarrollo.

## Verificación local

```bash
npm test
npm --prefix fiscal-server test
npm run build:dev
```

## Próximo bloque recomendado

Preparar una base de pruebas de integración para `pclaf-dev` que cree dos comercios y usuarios separados, ejecute las RPC de venta con la última unidad en paralelo y valide lectura/escritura cruzada. Antes de crear o aplicar migraciones, inventariar tabla, RLS, RPC, consumidor frontend y datos existentes para cada contrato afectado.
