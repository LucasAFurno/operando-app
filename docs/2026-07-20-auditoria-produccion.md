# Auditoria final de salida a produccion

Fecha: 2026-07-20
Proyecto: operando.app

## 1. Estado actual real

### Frontend

- La web publica funciona con HTML, CSS y JavaScript vanilla.
- El frontend operativo ya apunta a Supabase como base real.
- En web publica no se guarda operacion comercial en `localStorage`.
- Las vistas activas de `Mi Admin` y `Ajustes` quedaron unificadas para no arrastrar paneles tecnicos viejos.

### Base de datos

- La base productiva usa tablas core reales para:
  - comercios
  - usuarios
  - membresias
  - clientes
  - productos
  - stock
  - caja
  - ventas
  - compras
  - comprobantes
  - tickets
  - auditoria
- Se agrego alcance por usuario en `commerce_memberships`:
  - `allowed_modules`
  - `blocked_permissions`

### Auth

- El login y la recuperacion de acceso ya trabajan con Supabase Auth y sesiones reales.
- Los correos ya salen con identidad de operando.app.
- La sesion web depende de Supabase, no de datos locales del navegador.

### Consola Operando

- `Mi Admin` ya esta planteado como consola global de plataforma.
- Muestra comercios, estado, pack, soporte, ultimo acceso, sucursales, cajas y usuarios sin mezclar la operacion diaria del cliente.

## 2. Cambios cerrados hoy

- Se aplico migracion remota en Supabase para permisos finos por usuario.
- `app_build_public_session_payload` ahora devuelve:
  - `allowed_modules`
  - `blocked_permissions`
- `app_public_export_snapshot` ahora devuelve esos datos en cada usuario para que el frontend aplique alcance real por cuenta.
- `app_public_upsert_user` ahora permite que un admin del comercio cree y edite usuarios sin depender siempre del owner.
- `app_public_toggle_user_active` ahora respeta owner/admin y evita desactivar al propietario desde una cuenta que no corresponda.
- El rol `warehouse` quedo alineado para poder ver y cargar clientes, como pediste para operacion real.
- Las vistas viejas de `Mi Admin` y `Ajustes` quedaron delegadas a las vistas nuevas para evitar que reaparezcan bloques tecnicos.

## 3. Seguridad

### Lo que hoy esta bien

- La web publica no guarda datos operativos del comercio en el navegador.
- La base esta separada del frontend publico.
- Las funciones sensibles trabajan con contexto de sesion y comercio.
- Los usuarios de comercio ya pueden tener modulos visibles y acciones recortadas por cuenta.
- La consola global Operando no depende de snapshots del navegador.

### Lo que sigue siendo delicado

- La arquitectura todavia depende bastante de RPC `SECURITY DEFINER` expuestas a `anon`.
- Eso puede funcionar bien si cada RPC valida perfecto el contexto, pero sigue siendo una superficie sensible.
- El recorte fino por usuario ya existe para el frontend y para gestion de cuentas, pero todavia no esta aplicado uno por uno en cada operacion sensible del backend.

### Recomendacion de endurecimiento inmediata

1. Revisar RPC por RPC y marcar:
   - cuales deben seguir publicas
   - cuales conviene mover a una capa privada
   - cuales necesitan mas chequeos por accion
2. Activar proteccion contra passwords filtradas en Supabase Auth.
3. Agregar logs visibles para acciones sensibles:
   - crear usuario
   - cambiar permisos
   - cambiar pack
   - bloquear comercio
   - editar comprobantes

## 4. Dev y prod

### Como conviene manejarlo

- `operando-prod`: proyecto productivo con clientes reales.
- `operando-dev`: proyecto separado para pruebas, cambios de schema y UI inestable.

### Regla importante

- Nunca probar migraciones nuevas directo en prod.
- Primero:
  - aplicar en dev
  - probar login
  - probar alta de cuenta
  - probar ventas
  - probar caja
  - probar comprobantes
  - probar permisos
- Recién despues pasar a prod.

### Para no romper prod

- Mantener variables de entorno separadas.
- Mantener dominio productivo apuntando solo a prod.
- Tener migraciones versionadas en repo.
- Probar cada cambio fuerte con una cuenta de prueba en dev antes de publicarlo.

## 5. Viabilidad para venderlo

### Si es viable hoy para

- demos reales con clientes
- pruebas guiadas
- pilotos controlados
- primeras implementaciones con soporte cercano

### Todavia no lo venderia como

- sistema enterprise cerrado
- producto blindado sin supervision
- plataforma “autoservicio masivo” sin una ronda mas de endurecimiento

## 6. Lo que falta para venderlo mas solido

### Prioridad alta

1. Terminar permisos finos backend por accion real, no solo por pantalla.
2. Hacer auditoria de todas las RPC publicas.
3. Cerrar cualquier modulo roto restante de layout.
4. Crear importacion masiva de productos con preview y validacion.
5. Armar ambiente dev completo separado de prod.

### Prioridad media

1. Indexar foreign keys y revisar performance.
2. Agregar onboarding por rubro.
3. Mejorar la portada/index para venta comercial.
4. Sumar monitoreo de errores productivos.

## 7. Carga masiva desde Excel o CSV

La forma profesional de hacerlo es:

1. Boton `Importar productos`.
2. Aceptar `.xlsx` y `.csv`.
3. Dar plantilla con columnas:
   - `nombre`
   - `sku`
   - `codigo_barras`
   - `categoria`
   - `precio_venta`
   - `costo`
   - `stock`
   - `stock_minimo`
   - `controla_stock`
4. Mostrar preview antes de guardar.
5. Validar fila por fila:
   - faltantes
   - SKU repetido
   - codigo de barras repetido
   - precios invalidos
6. Dar dos modos:
   - crear nuevos
   - actualizar existentes por `sku` o `codigo_barras`
7. Mostrar resumen final:
   - importados
   - actualizados
   - rechazados

## 8. Conclusion honesta

operando.app ya no esta en maqueta. Ya tiene una base productiva real, auth real, consola global y operacion comercial real.

Lo que le falta no es “hacerlo andar”, sino endurecerlo para venderlo sin miedo:

- revisar RPC publicas
- cerrar permisos backend finos
- terminar layout de modulos que quedaron desparejos
- separar dev/prod con disciplina estricta

Hoy esta bien para seguir mostrando, probar y vender implementaciones cuidadas.
Para escalarlo con muchos clientes y dormir tranquilo, falta una ronda mas de seguridad y hardening.
