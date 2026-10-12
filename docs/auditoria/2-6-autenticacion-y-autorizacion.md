# Fase 2.6: autenticación y autorización (2026-10-11)

Auditor: Codex `revisar` (solo lectura, 71 rutas y 89 handlers). El orquestador verificó cada hallazgo en el código.
Ya existen pruebas por perfil por módulo (`tests/integration/*-api-perfiles.test.ts`) y `auth-*.test.ts`. No se escribe una matriz global duplicada.

## Hallazgos confirmados
- P2 `src/modules/catalogo/dto.ts:16,32`: `aFichaProducto` pasa cada material de la receta por `aMaterialDto`, que siempre incluye `costoPromedio`. Producción solo tiene `catalogo:ver` (`src/core/permisos.ts:148`) y la decisión de diseño es que no ve dinero. Escenario: `GET /api/v1/productos/[id]` como Producción devuelve `receta[].material.costoPromedio`.
  Arreglo: omitir `costoPromedio` si el actor no tiene `cotizacion:ver` ni `inventario:ver`.
  Regresión: ficha con receta como Producción sin costos; como Gerencia con costos.
- P3 `src/modules/cotizaciones/estados.ts:67` y `service.ts:61`: `responder` devuelve el DTO completo sin comprobar `cotizacion:ver`. Con la matriz por defecto no es alcanzable (todo perfil con `cotizacion:responder` tiene `cotizacion:ver`: `permisos.ts:118-121,137-141`). Solo aparece si Administración edita la matriz.
  Arreglo: filtrar el DTO con `can(actor, "cotizacion:ver")`.
  Regresión: revocar `cotizacion:ver`, conservar `responder`, POST: sin dinero en la respuesta.
- P2 `src/modules/admin/service.ts:110` (`cambiarActivo`, rutas `usuarios/[id]/reactivar` y `desactivar`): sin versión. Una reactivación con página vieja deshace una desactivación hecha por otro administrador y devuelve el acceso. El código bloquea el usuario, pero no compara versión.
  Arreglo: exigir `version` en el cuerpo y responder 409 si cambió.
  Regresión: reactivar, desactivar y repetir la reactivación con la versión inicial: 409.

## Sin hallazgos
- IDOR por id: el sistema autoriza por perfil, no por propiedad de fila; sin datos por usuario salvo sesión y clave.
- Mass assignment: zod rechaza o elimina campos desconocidos.
- Reportes, Excel, panel y trazabilidad: sin fuga de dinero.
- Cookies y sesión: sin hallazgos en lógica (no se verificó TLS real).

## Candidatos del inventario (verificados)
- `ordenes/opciones` (solo sesión) y `ordenes/[id]` PATCH (permiso dentro del handler): correctos; el filtro final está en el servicio.

## Mejora preventiva
- P3: nada impide que una ruta nueva olvide `permiso`. Arreglo: prueba unitaria estática `tests/unit/api-rutas-permiso.test.ts` que recorre `src/app/api/v1/**/route.ts` y exige `permiso:` en `manejar` salvo lista de excepciones explícita (salud, login, logout, yo, cambiar-clave, ordenes/opciones, ordenes/[id] PATCH).
