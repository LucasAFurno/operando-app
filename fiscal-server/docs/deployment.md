# Diseño fiscal persistente antes de despliegue

Cloud Run no conserva estado fiscal. La unica fuente operativa es PostgreSQL de Supabase: `private.fiscal_tenants` guarda clave/certificado cifrados por la aplicacion, `private.fiscal_invoices` guarda idempotencia y estados, y `private.fiscal_controls` contiene el freno de emergencia. No se crea Cloud Storage.

## Restricciones Cloud Run

```text
Region: us-central1
Facturacion: request-based / CPU throttling
Min instances: 0     Max instances: 1
CPU: 1               RAM: 512 MiB
Concurrency: 4       Cloud Run timeout: 45 s
IAM: privado; sin allUsers
```

No se usan VM, Serverless VPC Connector, Load Balancer, dominio personalizado, cron, polling ni workers internos.

```bash
gcloud run deploy operando-fiscal \
  --project="$PROJECT_ID" --region=us-central1 --image="$IMAGE" --service-account="$RUNTIME_SA" \
  --no-allow-unauthenticated --ingress=all --port=8080 \
  --cpu=1 --memory=512Mi --cpu-throttling --min-instances=0 --max-instances=1 \
  --concurrency=4 --timeout=45s \
  --set-env-vars="FISCAL_STORE=supabase,SUPABASE_URL=${SUPABASE_URL},ARCA_TIMEOUT_MS=15000,ARCA_ATTEMPT_TIMEOUT_MS=4500,ARCA_MAX_ATTEMPTS=2,FISCAL_EMERGENCY_STOP_CACHE_MS=5000" \
  --set-secrets="FISCAL_MASTER_KEY_BASE64=operando-fiscal-master-key:latest,FISCAL_SERVICE_TOKEN=operando-fiscal-service-token:latest,SUPABASE_SERVICE_ROLE_KEY=operando-supabase-service-role:latest"
```

`--ingress=all` es necesario para una Edge Function de Supabase externa a Google Cloud. No habilita acceso publico: Cloud Run exige IAM y no se concede `allUsers`.

## IAM y secretos

La unica cuenta con `roles/run.invoker` es `operando-supabase-invoker`. La Edge Function envia el ID token Google en `X-Serverless-Authorization`; Cloud Run lo valida y lo remueve. El Bearer interno se mantiene en `Authorization` y el contenedor lo valida como segunda barrera.

La clave JSON de `operando-supabase-invoker` es una credencial de alto riesgo. Tiene exclusivamente `roles/run.invoker`; se guarda solo en Supabase Edge Function Secrets, se rota periodicamente, y se revoca eliminando su key de cuenta de servicio y retirando el binding IAM. Nunca va a tablas, logs, archivos versionados ni frontend. La cuenta de despliegue de GitHub no usa JSON: el workflow usa Workload Identity Federation.

El servicio recibe `SUPABASE_SERVICE_ROLE_KEY` desde Secret Manager. Se usa solo para RPCs privadas; nunca se expone al navegador ni se loguea.

## Flujo de factura e idempotencia

1. La Edge Function valida que el usuario pertenece al comercio y pasa `commerceId`, `saleId`, tipo, punto de venta, numero e idempotency key.
2. `fiscal_claim_invoice` toma un advisory transaction lock, valida que la venta sea de ese comercio y crea `draft -> pending` en la misma transaccion.
3. Dos restricciones unicas bloquean tanto el reuso de idempotency key como un segundo comprobante para `(commerce_id, sale_id, receipt_type, point_of_sale)`.
4. Antes de enviar a ARCA se registra `arca_sent_at` en PostgreSQL. `pending` solo puede ir a `authorized`, `uncertain` o `rejected` mediante `fiscal_transition_invoice`.
5. Un timeout o falla de transporte posterior a enviar nunca reintenta `FECAESolicitar`. Consulta primero el ultimo comprobante autorizado y luego `FECompConsultar`; si no puede probar el resultado queda `uncertain`.

Los datos fiscales sensibles y XML de respuesta se cifran AES-256-GCM antes de llegar a Supabase. XML, Token, Sign, certificados y claves no van a logs.

## Tiempo maximo

Cada intento HTTP a ARCA se limita a 4,5 s y hay como maximo dos intentos (9,4 s con backoff). WSAA + WSFEv1 de emision: 18,8 s; firma: presupuesto maximo 3 s; reconciliacion con ticket cacheado (ultimo comprobante + consulta): 18,8 s. Total teorico: 40,6 s, menor que Cloud Run 45 s. Si se reinicia el contenedor, una solicitud `pending` se reconcilia en una invocacion posterior, no se reemite automaticamente.

## Freno de emergencia

`private.fiscal_controls.accepting_new_invoices` se lee con service role y se cachea cinco segundos. Desactivarlo bloquea nuevas facturas antes de llamar ARCA; no interrumpe una que ya esta en proceso. Se administra por SQL administrativo, no por una tabla ni RPC publica.

## Recursos y costo

Inicialmente solo se mantienen Cloud Run, Artifact Registry, Secret Manager, Logging y Cloud Build durante builds. El presupuesto de USD 2 alerta al 25/50/75/90/100%, pero no corta gasto; el freno anterior es manual y protege nuevas solicitudes.
