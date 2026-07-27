# Notificaciones de PCLAF Control

Los webhooks, tokens y credenciales se configuran exclusivamente en procesos server-side o GitHub Actions. No se exponen al navegador ni se escriben en logs.

## Eventos y procesos activos

- **Producto y operaciones:** resumenes de comercios, usuarios, clientes y ventas en Discord Resumen y Telegram.
- **Fiscal / ARCA:** certificados, CAE, comprobantes y errores de facturacion en Discord ARCA. Los incidentes criticos se replican en Alertas; el reemplazo de certificado tambien se registra en Seguridad.
- **Infraestructura:** deploys, conectividad con Supabase, Google APIs, dominio y hosting en Discord Deploys/General y Telegram.
- **Cloud Run:** el canal Discord GCP Run recibe inicio, exito y fallo de deploy del servicio `pclaf-fiscal`, mas estados diario, semanal y mensual basados en la revision activa de Cloud Run, metricas reales de solicitudes/5xx, Cloud Logging y denegaciones IAM de Cloud Run.
- **Deploys:** inicio, exito, fallo y rollback de actualizaciones tecnicas del backend fiscal mediante `npm run notify:deploy` y el workflow de Cloud Run. No representan una operacion de ARCA de un usuario. El fallo se notifica desde un job independiente para que llegue aun cuando falle el job de despliegue.
- **Resumenes:** actividad diaria, semanal y mensual de comercios, usuarios, clientes nuevos, ventas registradas y metricas fiscales mediante `npm run notify:summary` y **Notify Operational Summaries**. Se envian a las 09:00 Argentina: diario de lunes a jueves, semanal los viernes y mensual el ultimo dia del mes. Discord y Telegram reciben el mismo resumen cuando estan habilitados.
- **Estado operativo:** a las 09:01 Argentina, todos los dias, verifica la conectividad autenticada con Supabase, Google APIs y el dominio/hosting de PCLAF Control; informa el resultado en Discord General y Telegram.
- **Seguridad:** reemplazo de certificado fiscal sin certificado, clave, token ni CUIT completo.

El inicio normal de una instancia fiscal queda solo en Cloud Logging: ocurre en deploys y cold starts de Cloud Run, por lo que no es una alerta accionable.

## Backups

**Backups externos pendientes hasta contratar Supabase Pro.**

No hay cron, workflow ni almacenamiento externo de backups habilitados. No se deben configurar `BACKUP_DATABASE_URL`, `BACKUP_GCS_BUCKET`, `BACKUP_GCS_PREFIX` ni `BACKUP_RETENTION_DAYS` por ahora. `fiscal-server/scripts/backup-postgres.mjs` y `tools/setup-backup-gcs.ps1` se conservan unicamente como herramientas futuras y no se ejecutan automaticamente.

El resumen omite el estado del ultimo backup mientras no haya uno configurado.

## Ejecucion manual

```powershell
npm run notify:deploy -- success --environment=production --version=v1.2.3 --commit=abc123
npm run notify:summary -- --period=daily
npm run notify:status
```

Los workflows se pueden lanzar desde **Actions**: **Deploy fiscal service to Cloud Run**, **Notify Operational Summaries** y **Notify System Status**.
