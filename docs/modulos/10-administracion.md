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

## Actualización del 2026-11-11 (ACC-05)
Perfiles y permisos se divide en dos pestañas: "Permisos por perfil" (matriz) y "Permisos por usuario" (funciones adicionales, ACC-03).
El selector de usuarios activos filtra por nombre o correo sin distinguir tildes. Al elegir un usuario, muestra sus perfiles y sus permisos.

## COT-19 Tipos de cotización personalizada

Configuración tiene un submenú General, Tarifas y Cotizaciones personalizadas. La última sección requiere tarifa:gestionar en página, servicio y PUT /api/v1/personalizadas. GET requiere cotizacion:gestionar. El registro JSON se valida y versiona; no puede alterarse mediante el editor genérico de parámetros. El tipo contiene sugerencias comerciales y materiales, no cambia permisos ni etapas de Producción.

## Formulario por producto — COT-20 y COT-21

Desde 2026-11-12, Cotizaciones personalizadas organiza categoría, producto y materiales en pasos numerados; tarifas opcionales dentro del producto, con moneda explícita. Se guarda un producto a la vez mediante el registro versionado existente. El cambio de selección advierte si hay modificaciones sin guardar. Permisos de COT-19 sin cambios. Tarifas de material siguen en Tarifas; tarifas específicas sugeridas se administran con el producto que las usa. No se incorporaron nuevos parámetros genéricos editables ni permisos.

## COT-22 y COT-23 — 2026-11-13

Las secciones plegables de Configuración muestran una flecha con tamaño y ubicación definidos. La tarifa por km queda solo en Configuración → Tarifas como valor base y en Instalación como tarifa excepcional de la cotización. Se retira de las tarifas sugeridas de cada producto; los valores históricos de km en el registro JSON son compatibles, pero ya no se copian al aplicar un tipo.

## COT-24 Significado de materiales del producto — 2026-11-13

Los materiales marcados en la configuración se cargan automáticamente al elegir el producto en la cotización. El formulario lo explica y permite revisarlos, quitar opciones y ajustar cantidades antes de guardar. Sustituye la aplicación manual de sugerencias de COT-19. La configuración no fija consumos reales ni requiere inventar tarifas pendientes. Solo se copian las tarifas de gastos cuando coincide la moneda y el trabajo no tiene gastos capturados; si no coincide, se muestra aviso. Permiso tarifa:gestionar sin cambios.

## GEN-08 Responsividad de Usuarios — 2026-11-14

Presentación vigente: filtros alineados por su base; tabla de PC con mayor espacio para correo, perfiles contenidos y desplazamiento local en tableta. Bajo 768 px cada ficha muestra nombre y estado arriba, correo y perfiles a todo el ancho. Conserva etiquetas, correo completo, todos los perfiles, enlaces y paginación.

La ficha de edición distribuye formulario y Acceso por el ancho disponible del bloque, en lugar de forzar dos tercios/un tercio desde 1024 px. Nombre/correo, tarjetas de perfiles, datos y acciones de acceso se adaptan por mínimos de lectura. Sustituye solo la distribución anterior. No cambia altas, validaciones, confirmaciones, contraseñas, permisos ni llamadas a la API.
