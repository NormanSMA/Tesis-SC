# Módulo 2: Catálogo y cotizaciones

Estado: diseño auditado por Codex y Gemini Pro. Fecha: 2026-10-06.

Actualización documental v9: 2026-10-11.
Aplique los permisos actuales; conserve las auditorías y cifras de cierre como antecedentes.
Use anchos E2E de 768, 1024, 1366 y 1920 px.
Esta actualización no registra una nueva ejecución de pruebas.
Criterio de aceptación: CF-10. Requerimientos: R-02, R-03. Apoya CF-09 y CF-06.
Fuentes: tesis V6 secciones 1.1, 2.6 y 1.7; Anexo C (P2, P3, P11, Tablas C2 y C3); Anexo D (A10).
Supuestos: S-04, S-06, S-08, S-11, S-12, S-15, S-17, S-23, SD-14, SD-15, SD-17, SD-25.
Motor de costeo: src/core/costeo.ts (docs/modulos/02-costeo.md). El módulo no reescribe fórmulas.

## Alcance
Catálogo: productos y recetas, con categorías.
Cotizaciones: crear, editar, enviar, aprobar, rechazar, vencer, solicitar ajuste, corregir, duplicar e imprimir.
Cotiza productos de catálogo y trabajos personalizados con costos variables en la misma cotización.
Fuera de alcance: áreas y plantillas de etapas (módulo 5), consumo de materiales (módulo 4), conversión en orden (módulo 3), envío por correo y firma electrónica.

## Permisos vigentes (v9)

Consulte [la matriz v9](09-perfiles-v9.md) y `src/core/permisos.ts`.
Combine los permisos cuando el usuario tenga varios perfiles.

| Permiso | Gerencia | Administración | Operaciones | Atención al cliente | Producción | Administración técnica |
|---|---|---|---|---|---|---|
| catalogo:ver | sí | sí | sí | sí | sí | no |
| catalogo:gestionar | no | no | sí | no | no | no |
| cotizacion:ver | sí | sí | sí | sí | no | no |
| cotizacion:gestionar | no | no | no | sí | no | no |
| cotizacion:enviar | no | no | no | sí | no | no |
| cotizacion:responder | no | no | sí | sí | no | no |

Reserve gestión de catálogo para Operaciones y gestión de cotizaciones para Atención al cliente.

## Catálogo
Productos (`producto`): código único, nombre, descripción, categoría, unidad de cobro (UNIDAD o M2), precio base, activo.
Materiales del producto (`receta_producto`; en la interfaz, "Materiales del producto" desde el 2026-11-11): materiales por unidad de cobro. Opcionales.
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
BORRADOR a ENVIADA; ENVIADA a APROBADA, RECHAZADA, VENCIDA o AJUSTE_SOLICITADO.
Conserve congelados montos, ítems y líneas fuera de BORRADOR (SD-25).
Cree una versión corregida desde AJUSTE_SOLICITADO; conserve intacta la cotización de origen.

### Reglas de negocio
1. Crear exige un cliente activo y asunto. Las condiciones comerciales se precargan con el texto de la clave de configuración `cotizacion_condiciones` si existe, o con una constante del módulo (S-12). Numeración con `siguiente_numero('COTIZACION')`. Copia la tasa de IVA y la vigencia de la configuración. Crear y duplicar no llevan `version`: no modifican un registro existente.
2. Un ítem es de catálogo (producto, cantidad, y ancho y alto si el cobro es M2) o personalizado (categoría, descripción, cantidad, margen sobre precio y líneas de costo).
3. Líneas de costo: MATERIAL (material opcional, cantidad, costo unitario, merma %), MANO_OBRA (horas y tarifa) y TERCERO (costo). El costo unitario de un material se precarga con su costo promedio vigente y se puede cambiar.
   Las cantidades de las líneas son consumos totales del ítem completo, no por unidad. La `cantidad` del ítem personalizado solo divide el importe para obtener el precio unitario. Las etiquetas de la interfaz y las pruebas lo reflejan.
4. Todo monto lo calcula `src/core/costeo.ts`: línea, ítem, totales. El servidor recalcula siempre y no confía en montos del cliente. La interfaz usa las mismas funciones puras para mostrar totales en vivo.
5. El descuento es un monto global menor o igual al subtotal.
6. Enviar exige al menos un ítem. Fija fechaEmision (hoy, hora de Managua) y fechaVencimiento (hoy más vigencia). La base verifica las sumas.
7. Aprobar exige vigencia y `referenciaAprobacion` obligatoria de 3 a 200 caracteres.
   Registre el usuario aprobador y la referencia del consentimiento del cliente.
   Rechazar exige motivo; vencer exige fecha posterior al vencimiento.
   Solicitar ajuste exige `motivoAjuste` de 3 a 500 caracteres y establece AJUSTE_SOLICITADO.
8. Duplicar crea un BORRADOR nuevo. Copia ítems, líneas, asunto, descuento, condiciones y `cotizacionOrigenId`. Toma la tasa de IVA y la vigencia de la configuración vigente, no del origen. Reinicia fechas y respuesta. Exige cliente activo y producto activo para los ítems de catálogo; los ítems con producto archivado pasan como ítems existentes sin actualizar su precio y se avisa. Los precios se copian como instantánea del origen.
9. Archivar una cotización la oculta de la lista por defecto. No borra nada.
10. Versión optimista atómica en toda escritura sobre un registro existente, como en clientes.
    La edición de ítems envía el conjunto completo dentro de una transacción. Cada ítem trae su `itemId` si ya existe. Un ítem existente conserva su instantánea (producto, precio unitario, costo y margen guardados) mientras el cliente no pida `actualizarPrecio` para ese ítem; solo entonces se relee el precio vigente. El servidor verifica que cada `itemId` pertenece a la cotización. Un producto archivado ya incluido se conserva. Un ítem nuevo sí exige producto activo y relee su precio vigente. Todo se recalcula con el motor.
11. Cada cambio escribe su evento de bitácora (entidad COTIZACION) en la misma transacción: CREAR, EDITAR, CAMBIAR_ESTADO con estado anterior y nuevo, y ARCHIVAR. EDITAR guarda en `detalle` los campos de cabecera cambiados (antes y después) y, si cambian ítems, una lista por ítem (agregado, modificado o quitado, secuencia, descripción, importe antes y después) más los totales antes y después. Con ese detalle se puede reconstruir qué cambió sin una copia de la cotización.
12. La proforma imprimible (S-23) usa los datos vigentes del cliente (ADR-011) y los valores guardados de la cotización.
13. Cree la versión corregida mediante la lógica de duplicación, con `cotizacionOrigenId` y versión incrementada.
    Exija origen AJUSTE_SOLICITADO no archivado; cree un BORRADOR para editar, enviar y aprobar nuevamente.
    Distinga la versión comercial numérica del campo `version` ISO usado para concurrencia.
14. Reserve conversión para Operaciones; permita crear la orden sin responsable, según el módulo de órdenes.

### API bajo /api/v1/cotizaciones
| Método y ruta | Permiso | Resultado |
|---|---|---|
| GET /cotizaciones | cotizacion:ver | Lista paginada. Filtros: estado, cliente, texto, archivadas |
| POST /cotizaciones | cotizacion:gestionar | 201, cotización en BORRADOR |
| GET /cotizaciones/[id] | cotizacion:ver | Cotización con ítems y líneas |
| PATCH /cotizaciones/[id] | cotizacion:gestionar | Asunto, condiciones, descuento, vigencia |
| PUT /cotizaciones/[id]/items | cotizacion:gestionar | Reemplaza ítems y líneas. Devuelve totales recalculados |
| POST /cotizaciones/[id]/enviar | cotizacion:enviar | Estado ENVIADA |
| POST /cotizaciones/[id]/responder | cotizacion:responder | Resultado APROBADA, RECHAZADA, VENCIDA o AJUSTE_SOLICITADO; referencia o motivo según resultado |
| POST /cotizaciones/[id]/duplicar | cotizacion:gestionar | 201, borrador nuevo |
| POST /cotizaciones/[id]/version-corregida | cotizacion:gestionar | 201, BORRADOR corregido desde AJUSTE_SOLICITADO |
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

Use componentes comunes para estados vacío, carga y error; mantenga formularios accesibles.
Verifique número, cliente, estado y total sin desborde en 768 px.

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
| API por perfil | Gerencia y Administración consultan. Operaciones gestiona catálogo y responde cotizaciones. Atención al cliente gestiona, envía y responde cotizaciones. Producción consulta catálogo. Administración técnica sin acceso. Sin sesión 401 |
| CF-10 | Una cotización mixta (catálogo por M2, catálogo por unidad y un personalizado con las tres clases de línea) con totales exactos |
| E2E | Atención al cliente crea y envía; Operaciones aprueba con referencia. Consulte impresión y axe según los casos del archivo E2E |
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

## Cierre del módulo (2026-10-06)

Revisión cruzada del código de Codex por Sonnet (solo lectura). Ningún hallazgo alto ni medio. Hallazgos verificados en el código:

| Hallazgo | Decisión |
|---|---|
| `lineas` de un ítem personalizado y `materiales` de la receta sin máximo | Corregido: máximo 100 en cada lista |
| Enviar una cotización fuera de BORRADOR respondía COTIZACION_CONGELADA con mensaje de edición | Corregido: responde TRANSICION_INVALIDA con mensaje de envío |
| Tabla de líneas de costo cortada a 820 px (hallada en las capturas E2E) | Corregido: columna Descripción más angosta y encabezado Consumo |
| Guardar la cabecera lleva al detalle y descarta ediciones de ítems sin guardar | Aceptado: guardar equivale a salir. Queda como mejora futura (baja) |
| PATCH sin cambios y receta idéntica avanzan la versión y escriben bitácora | Aceptado (baja) |
| Ítem personalizado existente sin `actualizarPrecio` ignora `lineas` y `margenPct` enviados por API | Aceptado: cumple la regla 10 de la especificación |
| Costo promedio de materiales visible con solo `catalogo:ver` y datos de cliente con solo `cotizacion:ver` | Aceptado: sin fuga con la matriz por defecto; coherente con ADR-011 |
| Ítem de catálogo por unidad guarda `ancho` y `alto` si llegan | Aceptado (baja) |

Cobertura contra la tesis (Gemini Pro): CF-10, R-03 y Tabla C2 cubiertos; R-02 cubierto mediante el supuesto S-12 (duplicar como plantilla), pendiente de confirmación del cliente. Jev clasifica CF-10 como parcial (0.79) por la conversión a orden del módulo 3 y la proforma sin PDF de servidor.

## Ajustes del 2026-11-12
- COT-17: las partidas por m² muestran Ancho, Alto y Profundidad (opcional). La fórmula está en `docs/modulos/02-costeo.md`.
- COT-18: la lista de cotizaciones deja de mostrar Vencimiento y Creada. Ambos datos siguen en la ficha.

## Tipos configurables para cotizaciones personalizadas — COT-19

Entrega inicial del 12 de noviembre de 2026. Configuración → Cotizaciones personalizadas permite agregar categorías comerciales, tipos de producto, unidad de cobro, margen sugerido y materiales habituales. Puede prepararse el listado de ocho categorías de SC y guardarlo. Las categorías son referencias comerciales; no cambian las áreas productivas. Gerencia y Administración acceden mediante tarifa:gestionar, también concedible individualmente.

**Regla histórica sustituida por COT-24 el 2026-11-13:** en el editor se seleccionaba categoría y tipo, se marcaban materiales y luego se pulsaba Aplicar. Se agregan solo materiales seleccionados que aún no estén en la partida. Las líneas conservan cantidades editables o el cálculo por área vigente. El margen sugerido se aplica explícitamente; una descripción ya escrita se conserva. Las partidas guardadas mantienen sus instantáneas; para aplicar nuevas sugerencias a una existente se requiere actualizar su precio. La retirada de un tipo afecta futuras selecciones y no borra cotizaciones.

Los tipos pueden configurarse sin precios ni cantidades. Los datos faltantes se revisan al cotizar con las validaciones existentes. Esta entrega no cambia el cálculo de profundidad, instalación, renta ni rentabilidad, no incorpora reservas o compras y no carga nuevos materiales. Esos puntos siguen pendientes en el plan.

## Configuración guiada y gastos personalizados — COT-20 y COT-21

Regla vigente del 12 de noviembre de 2026. COT-20 sustituye el formulario de configuración COT-19: primero se elige una categoría comercial de SC, luego un producto, su nombre, unidad y margen sugeridos y, por último, sus materiales habituales. Guardar producto persiste la selección. Agregar una categoría distinta es opcional. Al cambiar de producto o categoría se advierte sobre cambios sin guardar. No se cargan productos de ejemplo en la base real.

COT-21 permite definir tarifas sugeridas opcionales por producto (moneda, km, hora por persona, viático por día, hospedaje por noche y renta fija). Se copian al aplicar el tipo solo si coincide la moneda y la partida aún no tiene gastos; una edición del registro no actualiza cotizaciones existentes. Los materiales conservan su tarifa de cotización independiente de estas tarifas.

**Regla histórica de COT-21 sustituida el 2026-11-13 por COT-23:** Cada partida personalizada admitía gastos estructurados con distancia de ida y viajes, además de renta, personas y horas, viáticos y hospedaje. Las cantidades corresponden al total de la partida, no se multiplican otra vez por la cantidad de productos. La distancia se duplica para ida y vuelta; C$16/km es el valor inicial editable. No se presume una tarifa de hora, viático u hospedaje desconocida. Al activar su cantidad se exige una tarifa positiva.

Imprevistos (0/5/6/10 %) e impuestos internos (0/2/3 %) se calculan sobre el precio de venta final de la partida. La renta porcentual usa la misma base, indicada expresamente. Se mantiene el margen sobre venta; las tasas acumuladas deben ser menores que 100 %. Los cargos se conservan como líneas internas generadas y se regeneran al recalcular; no se editan como terceros manuales. El usuario debe evitar duplicar gastos compartidos entre partidas, mano de obra ya capturada o instalación general.

Límite de COT-21: las partidas con cargos porcentuales requieren descuento cero, validado tanto en vista previa como en servidor. Se puede negociar ajustando el margen; el reparto de descuentos entre partidas queda pendiente. Los gastos fijos permiten descuentos normales. No hay asignación automática de gastos compartidos, reservas ni nuevas alertas de abastecimiento en esta entrega. La proforma conserva el precio integrado sin desglosar gastos internos.

## COT-22 Controles y distribución — 2026-11-13

Las secciones plegables muestran una flecha de apertura clara, separada del texto. El editor de partidas deja de reservar una columna lateral para totales: los campos ocupan el ancho disponible y los totales se presentan debajo. Se conservan encabezados por encima de los campos y grupos de dos o tres columnas según el ancho.

## COT-23 Traslado único en Instalación — 2026-11-13

Regla vigente: los kilómetros y la tarifa de traslado se registran únicamente en Instalación. Se retiran de la captura de gastos por partida y de las tarifas sugeridas por producto. Los parámetros antiguos se conservan para interpretar cotizaciones guardadas: un traslado histórico en la partida se muestra como aviso de solo lectura y puede retirarse al actualizar costos. No se traslada ni suma automáticamente al mapa.

Al marcar instalación fuera de Estelí, el mapa permite elegir un punto o pegar latitud, longitud de cualquier mapa. También se reconocen enlaces con coordenadas explícitas: query/q/destination/ll/center/cp, coordenadas de Google Maps en el enlace y fragmentos de OpenStreetMap. No se resuelven enlaces cortos ni direcciones escritas sin coordenadas; la interfaz explica cómo copiar las coordenadas. El destino se centra y se dibuja la ruta desde el centro de Estelí. Se muestran distancia de ida, ida y vuelta y costo de traslado. La ruta de ida redondeada a tres decimales se multiplica por dos para estimar ambos trayectos.

La tarifa visible se toma de Configuración y se conserva al guardar. Puede modificarse para la cotización con permiso cotizacion:gestionar, incluido cero; no modifica la tarifa general. Al cambiar moneda en una cotización nueva se vuelve al valor configurado convertido a esa moneda. La mano de obra de instalación se suma al traslado, integrada en el total sin desglose al cliente. Si el proveedor falla, se ofrece distancia de ida comprobada manualmente; no se sustituye por distancia en línea recta.

La migración distingue el cálculo histórico de solo ida del nuevo de ida y vuelta. Los borradores antiguos conservan sus importes hasta seleccionar de nuevo el destino. Cambiar otro campo o duplicar la cotización no duplica sus kilómetros. Distancia, tarifa, modo e importe quedan auditados con la cabecera. Los datos recibidos del servidor gobiernan el importe, no el total enviado por el cliente.

## COT-24 Producto configurado y lenguaje claro — 2026-11-13

Regla vigente: elegir un producto personalizable desde Configuración carga inmediatamente sus materiales disponibles, unidad y margen sugeridos. Se elimina el paso separado de marcar sugerencias y pulsar Aplicar. Los materiales configurados quedan marcados e incluidos inicialmente; el usuario puede desmarcar los que no utilizará y ajustar cantidades. Las cantidades iniciales de materiales por unidad son 1 para el trabajo completo, pendientes de revisión; los consumos por m² siguen calculándose con medidas y cantidad a realizar. No se inventa una receta geométrica completa ni se prometen consumos verificados.

El producto configurado presenta una sección Materiales de [producto] con selección, cantidades, desperdicio y precios leídos del material. No exige crear manualmente registros de costo. La alternativa Usar captura manual conserva lo capturado y permite agregar materiales, mano de obra o servicios externos. Si había otros costos antes de elegir un producto, se conservan y se advierte que se revisan en captura manual. Cambiar de producto pide confirmación antes de sustituir los materiales sugeridos; otros costos y gastos capturados se conservan.

La selección se conserva como instantánea con el nombre del producto y sus materiales sugeridos. Una recarga o duplicación no depende del registro actual de Configuración. Las cotizaciones anteriores mantienen su forma de captura hasta que se elija explícitamente un producto y se apliquen cambios de costos. Cambiar Configuración no recalcula una oferta emitida.

Los servicios sin materiales pueden calcularse con horas u otros gastos fijos registrados, sin obligar a agregar un costo manual vacío. El servidor genera los registros internos y mantiene la suma que exige la base de datos. Si solo hay porcentajes de renta o ganancia sin materiales, horas ni gastos fijos, se pide completar esa base: el nombre del producto no determina por sí solo un precio. Las tarifas pendientes siguen impidiendo el envío como material gratuito.

Los textos visibles sustituyen partidas por trabajos/productos, ítems por productos y terceros por servicios externos; se usan materiales y otros costos, desperdicio y ganancia sobre el precio de venta. Los nombres técnicos del modelo, API y fórmulas permanecen. Permisos, privacidad por autor, precios autorizados por servidor y auditoría se conservan.


## CAT-05 Códigos automáticos del catálogo — 2026-11-13

El código del producto se genera al guardar: P-prefijo de categoría-consecutivo, por ejemplo P-ROT-001. La categoría recibe un prefijo único y estable al usarla; categorías con nombre parecido usan un sufijo para evitar colisiones. Cambiar el nombre de la categoría o reclasificar un producto no altera códigos ya asignados. Se elimina la edición manual de códigos. La migración renumera por fecha de alta con desempate por código anterior e ID, conserva todos los identificadores y costos y registra la correspondencia en la bitácora. Los códigos anteriores permanecen disponibles para búsqueda. La numeración es transaccional y no reutiliza números de productos archivados.

## COT-25 Materiales y servicios en tablas editables — 2026-11-13

La presentación por tarjetas repetidas de cada costo queda sustituida por tablas. Los productos configurados muestran uso, material, cantidad total, precio por unidad, desperdicio y costo total. La alternativa manual usa material o servicio, cantidad, unidad, costo unitario, desperdicio y costo total con acción para quitar la fila. Los encabezados de columnas sustituyen las etiquetas visuales repetidas; cada campo conserva su etiqueta accesible y mensaje de error. En pantallas estrechas se desplaza la tabla dentro de una región identificada y accesible con teclado, sin ensanchar la página.

La superficie de materiales en m² sigue calculándose con las medidas y la cantidad del trabajo; las otras cantidades son editables. No se modifican las fórmulas, instantáneas, permisos, auditoría ni reglas de tarifas pendientes y porcentajes. COT-24 sigue vigente: elegir un producto carga sus materiales y la captura manual es alternativa.

La tabla manual conserva la descripción particular de cada material registrado: se edita en Descripción para este trabajo, dentro de su celda. Para materiales sin registrar y servicios el campo sigue visible directamente.

## COT-26 Alineación de tablas de costos — 2026-11-14

Ajusta la presentación de COT-25: columnas con ancho estable, controles de 40 px alineados por arriba y cantidades/precios/importes alineados a la derecha. La tabla manual incorpora una columna Acciones para Quitar; esta acción deja de compartir celda con el costo total. La información del tipo de costo y la descripción particular se muestran debajo del control principal sin desplazar la cantidad o la tarifa de esa fila. Los nombres largos se truncan en el selector dentro de su celda; las opciones desplegadas y los campos de descripción siguen disponibles.

La tabla de productos configurados alinea casilla, cantidad calculada o editable, tarifa, desperdicio y total. Se conservan la superficie automática, las cantidades, los costos y los errores. Las tablas desplazan su contenido dentro de su región en móvil y no ensanchan toda la página. No se cambian fórmulas, validaciones de negocio, instantáneas ni permisos.
