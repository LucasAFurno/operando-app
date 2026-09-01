# operando.app: dev y produccion

## Separacion actual

- `operando-prod` es la instancia productiva.
- `operando-dev` es la instancia sandbox para desarrollo y pruebas.
- El sitio publico debe apuntar siempre a `operando-prod`.
- Las pruebas internas, cambios de schema y cuentas de test deben vivir en `operando-dev`.

## Builds

- `npm run build:prod`
  Genera la version publica y actualiza los archivos raiz para deploy.

- `npm run build:dev`
  Genera una version sandbox en `dist/` sin pisar los archivos raiz productivos.

## Regla de trabajo

1. Probar cambios nuevos en `operando-dev`.
2. Validar login, alta, ventas, caja y stock en sandbox.
3. Recién después aplicar el cambio a producción.
4. Nunca cargar clientes reales, ventas reales ni usuarios finales en `operando-dev`.

## Login publico

- En produccion el acceso visible no muestra campos tecnicos.
- El login intenta resolver la cuenta por usuario o email.
- La instancia `operando-dev` queda reservada para desarrollo y no debe usarse desde la portada publica.

## Recomendacion operativa

- Mantener un usuario admin solo para pruebas en `operando-dev`.
- Crear cuentas reales siempre en `operando-prod`.
- Si vas a tocar permisos, RLS o funciones publicas, probar primero en sandbox y luego replicar en prod.
