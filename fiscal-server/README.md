# Servicio fiscal privado

Servicio Node aislado para la integracion ARCA de operando.app. No se importa desde el frontend, Electron ni las RPC publicas.

## Alcance actual

- Genera una clave RSA por comercio y una solicitud CSR.
- Guarda clave privada y certificado cifrados con AES-256-GCM.
- Obtiene Ticket de Acceso mediante WSAA y firma el TRA como CMS/PKCS#7 usando OpenSSL.
- Consulta `FEDummy`, puntos de venta y ultimo comprobante de WSFEv1.
- Expone un contrato privado para emitir `FECAESolicitar` cuando el modelo fiscal este conectado.
- Registra auditoria sin guardar claves, tokens ni XML completos.

## Desarrollo

1. Copiar `.env.example` como `.env` y completar un token y una clave maestra reales.
2. Instalar OpenSSL en el host o contenedor. En produccion debe estar versionado en la imagen y no depender de una instalacion de escritorio.
3. Ejecutar `npm run dev` desde esta carpeta.

Tambien se puede levantar con Docker:

```powershell
docker compose up --build
```

El servicio queda en `http://127.0.0.1:8787` y su salud se consulta en `GET /health`.

El almacenamiento de archivos cifrados sirve solo para desarrollo local. En Cloud Run se configura `FISCAL_STORE=supabase`: las claves y certificados quedan cifrados por la aplicacion en PostgreSQL privado de Supabase y la clave maestra se inyecta desde Secret Manager. La guia de despliegue, IAM, limites, presupuesto y freno de emergencia esta en [`docs/deployment.md`](docs/deployment.md).

## Seguridad y despliegue

- Desplegarlo sin CORS publico y sin acceso anónimo. Cloud Run debe usar IAM y un gateway servidor a servidor.
- Usar un token de servicio rotado y no exponerlo en Vite/Supabase anon/Electron.
- Configurar `FISCAL_MASTER_KEY_BASE64` desde un gestor de secretos, nunca desde Git.
- Cada comercio tiene una clave distinta. El certificado se asocia al comercio y no se reutiliza entre CUITs.
- No loguear XML, Token, Sign, certificados, CSR ni claves privadas.
- Antes de produccion, usar PostgreSQL privado de Supabase para el estado fiscal cifrado y Secret Manager para las claves de servicio; no usar un volumen local como custodia productiva.

## Endpoints privados

- `POST /v1/tenants/:tenantId/certificate-request`
- `POST /v1/tenants/:tenantId/certificate`
- `POST /v1/tenants/:tenantId/verify`
- `GET /v1/tenants/:tenantId/status`
- `POST /v1/tenants/:tenantId/invoices`

Todos, excepto `/health`, requieren `Authorization: Bearer <FISCAL_SERVICE_TOKEN>`.
