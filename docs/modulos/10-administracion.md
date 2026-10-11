# Módulo 8: Administración (usuarios, permisos y configuración)

Criterio: RF-10 y RB-10 (permisos por área, Tabla 14), RNF-03 y RNF-04. Perfil responsable: ADMIN (Administración técnica).
Permisos: usuario:gestionar, permiso:gestionar, configuracion:gestionar. Matriz de perfiles: [09-perfiles-v9.md](09-perfiles-v9.md).
Modelo de datos: tablas `usuario`, `usuario_perfil`, `perfil_permiso` y `configuracion`. Sin migración nueva salvo el índice de abajo.

## Alcance
1. Usuarios: listar, crear, editar nombre y correo, asignar uno o varios perfiles, bloquear, desbloquear, desactivar, reactivar y reiniciar la contraseña.
2. Permisos: ver y editar la matriz perfil por permiso.
3. Configuración: editar IVA, vigencia de cotización, condiciones de cotización, moneda, nombre de empresa y zona horaria.
No incluye: recuperación de contraseña por correo, borrado de usuarios, cambio de la zona horaria con datos existentes.

## Reglas
1. Nunca se borra un usuario. Se desactiva. Un usuario inactivo no inicia sesión y su historial se conserva.
2. Todo usuario activo tiene al menos un perfil.
3. ADMIN no puede quitarse su propio perfil ADMIN ni desactivarse. El sistema conserva al menos un usuario activo con perfil ADMIN (verificación bajo bloqueo de las filas ADMIN).
4. ADMIN no hereda operaciones de negocio. Asignar perfiles de negocio a un ADMIN es posible y queda en bitácora.
5. Los permisos usuario:gestionar, permiso:gestionar y configuracion:gestionar del perfil ADMIN no se pueden revocar (evita bloqueo total).
6. Los cambios de la matriz rigen de inmediato en la siguiente petición (ya se leen en cada petición).
7. Contraseña: mínimo 14 caracteres (igual que la siembra). El reinicio genera una clave temporal que se muestra una sola vez. Se guarda con argon2id. Las sesiones del usuario se revocan al reiniciar o desactivar.
8. Correo único, en minúsculas. Edición con `version` (actualizado_en) y 409 CONFLICTO_EDICION, como en Clientes.
9. Cada cambio escribe bitácora en la misma transacción: USUARIO con CREAR, EDITAR, CAMBIAR_ESTADO o ARCHIVAR/REACTIVAR; PERFIL_PERMISO con OTORGAR_PERMISO o REVOCAR_PERMISO; CONFIGURACION con EDITAR (valor anterior y nuevo). Las claves y los hashes nunca van a la bitácora ni a las respuestas.
10. Configuración: valor tipado según `tipo` (DECIMAL, ENTERO, TEXTO). IVA entre 0 y 100. Vigencia entre 1 y 365. Los cambios no alteran cotizaciones existentes (snapshot).

## API
| Método y ruta | Permiso | Resultado |
|---|---|---|
| GET /api/v1/usuarios | usuario:gestionar | Lista paginada, filtros q, perfil, activo |
| POST /api/v1/usuarios | usuario:gestionar | 201 con usuario y clave temporal (una vez) |
| GET /api/v1/usuarios/[id] | usuario:gestionar | Usuario con perfiles |
| PATCH /api/v1/usuarios/[id] | usuario:gestionar | Nombre, correo, perfiles (lista completa), version |
| POST /api/v1/usuarios/[id]/desbloquear | usuario:gestionar | Limpia intentos y bloqueo |
| POST /api/v1/usuarios/[id]/desactivar y /reactivar | usuario:gestionar | Cambia activo |
| POST /api/v1/usuarios/[id]/reiniciar-clave | usuario:gestionar | Clave temporal una vez |
| GET /api/v1/permisos | permiso:gestionar | Perfiles, permisos y matriz |
| PUT /api/v1/permisos/[perfil] | permiso:gestionar | Lista completa de permisos del perfil |
| GET y PATCH /api/v1/configuracion | configuracion:gestionar | Parámetros; PATCH por clave con version |

## Pantallas (bajo (app)/admin)
- /admin/usuarios: lista (nombre, correo, perfiles, estado) y ficha con editar, bloquear y reiniciar clave. Título del panel: "N usuarios activos, M bloqueados".
- /admin/permisos: matriz con perfiles en columnas y permisos agrupados por recurso en filas. Un interruptor por celda con texto accesible. Los permisos protegidos se muestran fijos.
- /admin/configuracion: formulario por parámetro con valor actual y última edición.
Accesibilidad WCAG 2.2 AA y cuatro viewports, igual que los otros módulos.

## Partes (secuencia)
1. Datos: índice sobre bitácora si hace falta; sin migración de esquema.
2. Lógica: `src/modules/admin/{service,repo,schema}.ts` con reglas 1 a 10.
3. API: rutas bajo `src/app/api/v1/{usuarios,permisos,configuracion}`.
4. UI: tres páginas y componentes en `src/modules/admin/componentes`.
5. Pruebas: unitarias de reglas, integración por perfil (solo ADMIN accede), concurrencia del último ADMIN, E2E de las tres pantallas.
