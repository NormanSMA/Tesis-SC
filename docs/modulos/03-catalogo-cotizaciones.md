# Módulo 2: Catálogo y cotizaciones

Estado: diseño auditado por Codex y Gemini Pro. Fecha: 2026-10-06.
Criterio de aceptación: CF-10. Requerimientos: R-02, R-03. Apoya CF-09 y CF-06.
Fuentes: tesis V6 secciones 1.1, 2.6 y 1.7; Anexo C (P2, P3, P11, Tablas C2 y C3); Anexo D (A10).
Supuestos: S-04, S-06, S-08, S-11, S-12, S-15, S-17, S-23, SD-14, SD-15, SD-17, SD-25.
Motor de costeo: src/core/costeo.ts (docs/modulos/02-costeo.md). El módulo no reescribe fórmulas.

## Alcance
Catálogo: productos y recetas, con categorías.
Cotizaciones: crear, editar, enviar, aprobar, rechazar, vencer, duplicar e imprimir la proforma.
Cotiza productos de catálogo y trabajos personalizados con costos variables en la misma cotización.
Fuera de alcance: áreas y plantillas de etapas (módulo 5), consumo de materiales (módulo 4), conversión en orden (módulo 3), envío por correo y firma electrónica.

## Permisos (matriz aprobada)
| Permiso | Gerencia | Ventas | Producción |
|---|---|---|---|
| catalogo:ver | sí | sí | sí |
| catalogo:gestionar | sí | no | no |
| cotizacion:ver | sí | sí | no |
| cotizacion:gestionar (crear, editar borrador, duplicar, archivar) | no | sí | no |
| cotizacion:enviar | no | sí | no |
| cotizacion:responder (aprobar, rechazar, vencer) | sí | sí | no |

Administración no ve ninguno de los dos módulos.

## Catálogo
Productos (`producto`): código único, nombre, descripción, categoría, unidad de cobro (UNIDAD o M2), precio base, activo.
Recetas (`receta_producto`): materiales por unidad de cobro. Opcionales.
Categorías (`categoria`): nombre único, descripción, activo.
Reglas:
1. Un producto archivado no se puede agregar a una cotización nueva ni editada. Las cotizaciones existentes lo conservan.
2. Cambiar el precio base no altera cotizaciones existentes: las cotizaciones guardan su propio precio (instantánea).
3. Un material no puede repetirse en la receta de un producto.
4. Cada cambio escribe su evento de bitácora en la misma transacción: entidad PRODUCTO para productos y recetas, entidad CATEGORIA para categorías (valor agregado al enum por la migración 20261006180000). Archivar usa ARCHIVAR y reactivar usa REACTIVAR. EDITAR guarda en `detalle` los campos cambiados con valor anterior y nuevo; el cambio de receta guarda los materiales antes y después.
5. Cada producto muestra una imagen por categoría tomada de public/seed/productos (tabla fija en código).
API: GET y POST /api/v1/productos, GET y PATCH /api/v1/productos/[id], POST .../archivar y .../reactivar, PUT /api/v1/productos/[id]/receta, GET y POST /api/v1/categorias, PATCH /api/v1/categorias/[id].
Pantallas: /catalogo (tarjetas con imagen, filtros por categoría y estado, búsqueda), /catalogo/[id] (ficha con receta), /catalogo/nuevo, /catalogo/[id]/editar. Solo catalogo:gestionar ve los botones de gestión.
Versión optimista igual que clientes: UPDATE condicionado a id, activo y versión (`actualizadoEn`). Categoría ahora tiene `actualizadoEn`. Cambiar la receta avanza `actualizadoEn` del producto dentro de la misma transacción, y exige la versión del producto.

Consulta de materiales para recetas y para el editor de cotizaciones: GET /api/v1/catalogo/materiales (permiso inventario:ver) con `q` y `activo`. Devuelve id, código, nombre, unidad, costoPromedio y activo. Es de solo lectura y mínima. El módulo de inventario (módulo 4) tendrá su propia API completa en otra ruta. Un material archivado no se ofrece en recetas ni en líneas nuevas, pero las existentes lo conservan.

## Cotizaciones
Estados y transiciones (docs/analisis/05-modelo-datos.md, sección c; la base las valida):
BORRADOR a ENVIADA; ENVIADA a APROBADA, RECHAZADA o VENCIDA. APROBADA, RECHAZADA y VENCIDA son terminales.
Fuera de BORRADOR la base bloquea montos, ítems y líneas (SD-25). Se corrige con un duplicado.

### Reglas de negocio
1. Crear exige un cliente activo y asunto. Las condiciones comerciales se precargan con el texto de la clave de configuración `cotizacion_condiciones` si existe, o con una constante del módulo (S-12). Numeración con `siguiente_numero('COTIZACION')`. Copia la tasa de IVA y la vigencia de la configuración. Crear y duplicar no llevan `version`: no modifican un registro existente.
2. Un ítem es de catálogo (producto, cantidad, y ancho y alto si el cobro es M2) o personalizado (categoría, descripción, cantidad, margen sobre precio y líneas de costo).
3. Líneas de costo: MATERIAL (material opcional, cantidad, costo unitario, merma %), MANO_OBRA (horas y tarifa) y TERCERO (costo). El costo unitario de un material se precarga con su costo promedio vigente y se puede cambiar.
   Las cantidades de las líneas son consumos totales del ítem completo, no por unidad. La `cantidad` del ítem personalizado solo divide el importe para obtener el precio unitario. Las etiquetas de la interfaz y las pruebas lo reflejan.
4. Todo monto lo calcula `src/core/costeo.ts`: línea, ítem, totales. El servidor recalcula siempre y no confía en montos del cliente. La interfaz usa las mismas funciones puras para mostrar totales en vivo.
5. El descuento es un monto global menor o igual al subtotal.
6. Enviar exige al menos un ítem. Fija fechaEmision (hoy, hora de Managua) y fechaVencimiento (hoy más vigencia). La base verifica las sumas.
7. Aprobar exige hoy menor o igual a fechaVencimiento. Rechazar exige motivo. Marcar vencida exige hoy mayor que fechaVencimiento. Las tres fijan fechaRespuesta.
8. Duplicar crea un BORRADOR nuevo. Copia ítems, líneas, asunto, descuento, condiciones y `cotizacionOrigenId`. Toma la tasa de IVA y la vigencia de la configuración vigente, no del origen. Reinicia fechas y respuesta. Exige cliente activo y producto activo para los ítems de catálogo; los ítems con producto archivado pasan como ítems existentes sin actualizar su precio y se avisa. Los precios se copian como instantánea del origen.
9. Archivar una cotización la oculta de la lista por defecto. No borra nada.
10. Versión optimista atómica en toda escritura sobre un registro existente, como en clientes.
    La edición de ítems envía el conjunto completo dentro de una transacción. Cada ítem trae su `itemId` si ya existe. Un ítem existente conserva su instantánea (producto, precio unitario, costo y margen guardados) mientras el cliente no pida `actualizarPrecio` para ese ítem; solo entonces se relee el precio vigente. El servidor verifica que cada `itemId` pertenece a la cotización. Un producto archivado ya incluido se conserva. Un ítem nuevo sí exige producto activo y relee su precio vigente. Todo se recalcula con el motor.
11. Cada cambio escribe su evento de bitácora (entidad COTIZACION) en la misma transacción: CREAR, EDITAR, CAMBIAR_ESTADO con estado anterior y nuevo, y ARCHIVAR. EDITAR guarda en `detalle` los campos de cabecera cambiados (antes y después) y, si cambian ítems, una lista por ítem (agregado, modificado o quitado, secuencia, descripción, importe antes y después) más los totales antes y después. Con ese detalle se puede reconstruir qué cambió sin una copia de la cotización.
12. La proforma imprimible (S-23) usa los datos vigentes del cliente (ADR-011) y los valores guardados de la cotización.

### API bajo /api/v1/cotizaciones
| Método y ruta | Permiso | Resultado |
|---|---|---|
| GET /cotizaciones | cotizacion:ver | Lista paginada. Filtros: estado, cliente, texto, archivadas |
| POST /cotizaciones | cotizacion:gestionar | 201, cotización en BORRADOR |
| GET /cotizaciones/[id] | cotizacion:ver | Cotización con ítems y líneas |
| PATCH /cotizaciones/[id] | cotizacion:gestionar | Asunto, condiciones, descuento, vigencia |
| PUT /cotizaciones/[id]/items | cotizacion:gestionar | Reemplaza ítems y líneas. Devuelve totales recalculados |
| POST /cotizaciones/[id]/enviar | cotizacion:enviar | Estado ENVIADA |
| POST /cotizaciones/[id]/responder | cotizacion:responder | Cuerpo con resultado APROBADA, RECHAZADA o VENCIDA y motivo |
| POST /cotizaciones/[id]/duplicar | cotizacion:gestionar | 201, borrador nuevo |
| POST /cotizaciones/[id]/archivar | cotizacion:gestionar | Cotización archivada |

Toda ruta que modifica un registro existente exige `version`. Crear y duplicar no la llevan. Sin versión: 422. Con versión vieja: 409 CONFLICTO_EDICION.
Errores de la base (SC001 a SC007) se traducen a 409 con su mensaje.

### Pantallas
| Ruta | Contenido |
|---|---|
| /cotizaciones | Tabla con número, cliente, asunto, estado, total, emisión y vencimiento. Filtros y paginación |
| /cotizaciones/nueva | Cliente, asunto, condiciones |
| /cotizaciones/[id] | Detalle con ítems, líneas, totales, margen y acciones según estado y permiso |
| /cotizaciones/[id]/editar | Editor de ítems con totales en vivo, solo en BORRADOR |
| /cotizaciones/[id]/imprimir | Proforma imprimible con estilos de impresión |

Estados vacío, carga y error con los componentes comunes. Formularios accesibles. En 820 px se ven número, cliente, estado y total sin desplazamiento horizontal.

## Pruebas
| Nivel | Casos |
|---|---|
| Unitaria | Esquemas zod; mapeo del editor al motor; imagen por categoría |
| Integración | Crear con cliente activo y rechazar cliente archivado; reemplazar ítems y comprobar que totales guardados igualan el motor y la base los acepta; enviar, aprobar, rechazar, vencer y transiciones inválidas con 409; aprobar vencida rechazado; duplicar; bitácora de cada cambio y reversión si falla; congelación fuera de BORRADOR |
| Instantáneas | Cambiar el precio base de un producto no altera un ítem existente al editar otro ítem. `actualizarPrecio` sí lo relee. Producto archivado ya incluido se conserva. Un `itemId` ajeno se rechaza |
| Bitácora | Un EDITAR de ítems permite reconstruir qué cambió: la prueba compara el detalle con el estado anterior y el nuevo. Reversión si falla la bitácora |
| Concurrencia | Dos reemplazos de ítems con la misma versión: uno gana. Enviar frente a editar. Dos cambios de receta con la misma versión del producto: uno gana |
| Reutilización | Duplicar con IVA y vigencia modificados en configuración toma los vigentes. Las condiciones por defecto se precargan |
| Fechas | Aprobar el último día de vigencia en Managua funciona; el día siguiente se rechaza |
| Permisos | Revocar cotizacion:ver o catalogo:ver oculta lo correspondiente. Gerencia no crea ni edita |
| API por perfil | Gerencia: ver y responder sí, crear y editar 403. Ventas: todo menos catalogo:gestionar. Producción: catálogo ver, cotizaciones 403. Sin sesión 401 |
| CF-10 | Una cotización mixta (catálogo por M2, catálogo por unidad y un personalizado con las tres clases de línea) con totales exactos |
| E2E | Ventas crea una cotización mixta, la envía; Gerencia la aprueba; vista de impresión; axe en lista, editor y detalle |
| Visual CF-10 | Captura de la cotización mixta en 4 tamaños |

## Archivos del módulo
Catálogo: src/modules/catalogo/**, src/app/api/v1/productos/**, src/app/api/v1/categorias/**, src/app/(app)/catalogo/**.
Cotizaciones: src/modules/cotizaciones/**, src/app/api/v1/cotizaciones/**, src/app/(app)/cotizaciones/**.
Pruebas con prefijo catalogo- y cotizaciones-.
No cambia el schema, los permisos ni el layout. Las fórmulas viven en src/core/costeo.ts.

## Criterios de cierre
Pruebas en verde, lint y typecheck limpios, revisión cruzada, captura de CF-10 y fila actualizada en docs/trazabilidad.md.

## Auditoría
Auditores de proveedores distintos: Codex arquitecto y Gemini Pro. Cada hallazgo se verificó en el código.

| Hallazgo | Origen | Decisión |
|---|---|---|
| El reemplazo de ítems puede cambiar precios de ítems no tocados | Codex, alta | Adoptado. Identidad de ítem e instantánea (regla 10) |
| La bitácora de EDITAR no permite reconstruir cambios; enum sin CATEGORIA | Codex, alta | Adoptado. Detalle por ítem (regla 11) y migración que agrega CATEGORIA |
| Categoría sin versión; receta no avanza la versión del producto | Codex, media | Adoptado. Columna actualizado_en en categoria y avance al cambiar la receta |
| Consulta de materiales sin contrato | Codex, media | Adoptado. GET /api/v1/catalogo/materiales |
| Cantidad del ítem personalizado ambigua | Codex, media | Adoptado. Líneas son consumos totales del ítem |
| Condiciones por defecto y campos que copia duplicar sin definir | Codex, media | Adoptado. Reglas 1 y 8 |
| Excepción de version en crear y duplicar | Codex, baja | Adoptado. Regla 1 y sección API |
| Producto archivado no se valida en la base | Gemini, media | Adoptado en el servicio y con prueba. La base no tiene regla y no se agrega |
| Crear entidad PlantillaCotizacion | Gemini | Rechazado. Contradice S-12 aprobado: plantilla es duplicar más condiciones por defecto. Evita cambio de schema y alcance |
| Flag de tipo de registro para plantillas | Gemini, baja | Rechazado por la misma razón |

Cobertura de la tesis según Gemini: CF-10 y R-03 cubiertos; R-02 parcial. Codex: dictamen "reconsiderar antes de programar" por dos altos, resueltos en este diseño.
