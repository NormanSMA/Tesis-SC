# Registro de alineación entre la tesis y TRACORE

La rama corresponde al desarrollo de la versión definitiva de TRACORE para Soluciones Creativas. La referencia académica es `PCE_Soluciones_Creativas_Cap_I-IV_APA7_v9.5_Validacion_Gerencial.docx`. El apartado 4.15 y el Anexo J documentan la valoración preliminar de Gerencia General sobre TRACORE 1.2, realizada el 29 de octubre de 2026 con un informante. La tesis y la encuesta respondida se conservan en la carpeta local `revision-tesis` del proyecto. Las pruebas técnicas y las validaciones de la versión definitiva tendrán su propia evidencia.

El punto de partida del código es `9f6152c` en la rama `feat/inventario-soluciones-creativas`. El [registro de decisiones](decisiones.md) explica las decisiones técnicas y la [matriz de trazabilidad](trazabilidad.md) vincula requisitos, implementación y pruebas. Este archivo registra qué cambios requieren reconciliar el código y la tesis, y en qué estado está cada lado.

## Cómo registrar un cambio

Para cada cambio se registra la fecha, el motivo y su fuente, la versión o commit del código, las secciones o figuras afectadas, la prueba o evidencia disponible y los estados de implementación y actualización de la tesis. Las propuestas se identifican como tales hasta acordar el alcance. Una entrada se cierra cuando la implementación se verifica y el documento refleja el resultado, o cuando se acuerda conservarla como trabajo futuro.

## Primeras entradas

| ID y origen | Qué se está alineando | Tesis y evidencia afectadas | Estado |
|---|---|---|---|
| AT-01 · 2026-11-05 · Conversación de Inventario y revisión del sistema actual | Impresión Digital trabaja con m² y rollos. Grabado y Corte Láser, con m² y láminas. El usuario confirmó los dos niveles de control: saldo total en m² y conteo de presentaciones completas, con seguimiento del saldo por rollo abierto y de retazos reutilizables. Taller, Acabado y Montaje suelen contar piezas por variante. Diseño Gráfico trabaja sin inventario propio. El módulo se llama Inventario. | 4.6 Diseño de datos, Anexo G, Figura H5 de consumo e inventario, RF-05, RF-06, RB-06, RB-07 y 4.11 Plan de pruebas y calidad. | Alcance inicial acordado. Control físico en desarrollo. |
| AT-02 · Valoración preliminar de Gerencia General | Revisar la reorganización de campos, el seguimiento de proformas enviadas y la posible referencia a la orden de compra del cliente. La tesis ubica el seguimiento de pagos como posible evolución. | 4.15 y Anexo J como evidencia histórica. Vincular cada mejora con su requisito y verificación una vez acordado el alcance. | Observaciones registradas. Alcance y prioridad por definir. |
| AT-03 · 2026-11-05 · Primera entrega de Inventario | La ficha de un material en m² admite una presentación nominal opcional de rollo o lámina, con ancho y largo en metros. La API devuelve el área exacta por presentación completa. El alta y la edición se registran en bitácora. El conteo físico requiere asociar movimientos a presentaciones reales en una entrega posterior. | [Modelo y diccionario técnico](analisis/05-modelo-datos.md#material-material), [migración](../prisma/migrations/20261105210000_material_presentacion/migration.sql) y [pruebas de API](../tests/integration/inventario-api-perfiles.test.ts). Reflejar campos y restricciones en 4.6 y Anexo G. | Implementación y verificación local completadas. Actualización de la tesis pendiente. |

La verificación de AT-03 incluyó compilación de producción, pruebas de API y una prueba de navegador con una base aislada. Se comprobó el alta y la edición, el cálculo de área, el foco de validación y la accesibilidad del formulario. Una migración sobre una copia de la base existente conservó los 33 materiales, 65 movimientos y 16 usuarios activos. Las presentaciones de esos materiales quedaron sin configurar.

El siguiente cambio de AT-01 es registrar las presentaciones físicas, sus saldos y su relación con el libro de movimientos. El saldo agregado y el conteo de rollos o láminas completas deberán conciliarse con los registros de rollos abiertos y retazos reutilizables.

El 6 de noviembre de 2026 se desplegó AT-03 en la instancia local. Se respaldó la base antes de migrar y se verificaron la respuesta de salud y los recuentos de 33 materiales, 65 movimientos y 16 usuarios activos. Las presentaciones quedaron disponibles para configurar desde Inventario.

## Cambios del módulo Clientes

El registro del 6 de noviembre de 2026 documenta CLI-01 a CLI-04. CLI-01 reserva a Gerencia el listado completo, exige buscar por nombre a los demás perfiles con permiso y elimina la precarga de clientes en Cotizaciones. En Órdenes, el cliente se hereda de la cotización aprobada. Revisar la matriz de acceso, el flujo del módulo Clientes y sus pruebas en la tesis.

CLI-02 a CLI-04 limitan el campo RUC de los formularios a empresas y permiten guardarlo en blanco. Correo y dirección son opcionales. Para que el correo también se pueda dejar vacío si se desconoce el teléfono, se retiró la obligación de informar un medio de contacto. Revisar SD-12, el apartado 4.6, el Anexo G y las evidencias de alta y edición. La actualización de la tesis queda pendiente.

El 6 de noviembre de 2026 se desplegaron los cuatro cambios en la instancia local. Pasaron las secciones de pruebas de Clientes y Cotizaciones y se verificaron en Edge el alta de particulares, los permisos de consulta y la selección de clientes al cotizar. La migración conservó los 29 clientes, 19 cotizaciones, 11 órdenes y 16 usuarios activos.

## Cotizaciones Inventario e interfaz

| Cambios | Implementación del 7 de noviembre de 2026 | Revisión pendiente en la tesis |
|---|---|---|
| COT-01 y COT-05 | La creación abre un formulario único con cliente, partidas y materiales, tarifa y totales, y condiciones. El servidor guarda el borrador y sus partidas en la misma transacción. | Flujo de cotización y capturas de la interfaz. |
| COT-02 | Los borradores y las cotizaciones nuevas se calculan sin IVA por la regla operativa comunicada por Soluciones Creativas. Los documentos emitidos conservan sus montos. | Modelo de datos 4.6, Anexo G, cálculo del total y ejemplos de proforma. |
| COT-03 | Tarifa ocasional a precio base. Descuentos iniciales editables de 5 % y 10 %. La cotización conserva el porcentaje seleccionado y el descuento manual lo sustituye cuando se aplica. | Modelo de datos 4.6, Anexo G, reglas de cálculo y pruebas de cotización. |
| COT-04 | La casilla de condiciones comerciales controla la impresión y el PDF de la proforma. | Modelo de datos 4.6, Anexo G y evidencias de proforma. |
| INV-01 | Catálogo del sistema de órdenes compartido por Inventario y Cotizaciones. Las existencias y costos de los 43 materiales se inicializan en cero por falta de saldos y costos verificados. | Catálogo de materiales, RF-05, RF-06 y pruebas de selección al cotizar. |
| GEN-01 a GEN-03 | Tokens de la paleta corporativa, temas claro y oscuro con preferencia guardada y pantalla de acceso con el logo oficial. | Evidencia de interfaz, adaptabilidad y accesibilidad en el apartado 4.11 y las capturas. |

La migración se probó en una copia de la base y luego se desplegó en la instancia local. Pasaron 358 pruebas de Cotizaciones, seis pruebas de navegador y la revisión de contraste del acceso y de las pantallas principales en modo oscuro. Se verificaron las 43 altas auditadas en el catálogo compartido y se conservaron los 65 movimientos de inventario.

## Costeo de instalaciones y planificación por áreas

| Cambios | Implementación | Revisión pendiente en la tesis |
|---|---|---|
| COT-06 | Mano de obra y traslado internos. El kilometraje de ida usa el Parque Central de Estelí como origen y se habilita para trabajos declarados fuera de la ciudad. Tarifa inicial de C$20 por km. La proforma incorpora el importe al precio total. | Reglas de cálculo, modelo de datos 4.6, Anexo G y evidencias de cotización. |
| COT-07 | Gerencia y Administración editan las tarifas comerciales, el kilometraje y el precio de cotización de cada material en Configuración. El precio comercial se guarda por separado del promedio de Inventario. Si queda vacío, se usa el promedio equivalente. | Matriz de perfiles y permisos, configuración y pruebas de acceso. |
| COT-08 | Los ítems personalizados ofrecen los trece servicios publicados por [Soluciones Creativas](https://s-creativas.net/servicios/). Las categorías previas se conservan para el historial y los productos. | Catálogo y flujo de creación de cotizaciones. |
| COT-09 | Para materiales en m², la cantidad sale de ancho × alto × número de piezas. Si el inventario está en pliegos o rollos, el área de la presentación completa permite convertir el consumo estimado a la unidad física. | Modelo 4.6, Anexo G, costeo y consumo estimado de la orden. |
| COT-10 | La proforma usa el membrete, el pie y la tabla de la proforma de CLIMASA compartida por el usuario. Se imprime con los datos comerciales mínimos y sin el desglose de instalación. | Ejemplo de proforma y evidencias de impresión. |
| ORD-01 | En la conversión, el usuario define la secuencia de áreas y asigna responsable e instrucciones por etapa. Las instrucciones se conservan aparte de las observaciones de ejecución. | CF-01, CF-02, diagrama de conversión, modelo 4.6, Anexo G y pruebas de Producción. |

En la primera entrega del 9 de noviembre de 2026 se aplicó la migración local después de probarla en una copia de la base. Se conservaron los totales de 23 cotizaciones, el stock y costo promedio de 76 materiales y las 11 órdenes registradas. Pasaron 359 pruebas de Cotizaciones y 239 de Órdenes. En Edge se verificaron los permisos, la ruta por carretera, el cálculo de dos materiales para la misma partida, la impresión en tamaño carta con el costo de instalación incluido en el total y la conversión con dos etapas asignadas.

## Correcciones de la revisión del 9 de noviembre

| Cambio | Implementación | Revisión pendiente en la tesis |
|---|---|---|
| COT-11 | La cantidad de material en una partida medida se toma del área. Para cotizar una lámina, pliego o rollo por m² se registra el área de su presentación completa. Una partida medida muestra el consumo y avisa si falta esa equivalencia antes de permitir el guardado. | SD-14, SD-15, modelo 4.6, Anexo G y evidencia de costeo con fracción de lámina. |
| COT-12 | Al marcar una instalación fuera de Estelí, el mapa permite seleccionar el destino y dibuja la ruta de ida calculada. El costo de traslado se aplica con la tarifa configurada. | Apartado 4.4, Figura 1, Tabla 20 y flujo de cotización. Registrar Leaflet, el mapa de OpenStreetMap y OSRM de FOSSGIS. |
| COT-13 | La proforma muestra las etiquetas «Cliente:» y «Referencia:». | Actualizar el ejemplo exportado. |
| CFG-01 | Configuración tiene un submenú Tarifas para los descuentos comerciales, el traslado y los precios de materiales. | Matriz de acceso y capturas de Configuración. |
| ORD-02 | La conversión asigna responsables por área. La relación usuario-área se guarda en la base y el servidor valida la pertenencia del responsable. | Diagrama de conversión, CF-01, CF-02, modelo 4.6 y Anexo G. |
| ORD-03 | La ficha de orden abre una vista imprimible en tamaño carta con partidas, materiales estimados e instrucciones por área. | CF-02 y evidencia de la orden en papel para Producción. |
| DAT-01 | Depuración de los datos locales de demostración a 15 clientes, 10 cotizaciones, 5 órdenes y 43 materiales activos del catálogo original. Se archivan seis referencias históricas de material. | Actualizar el inventario de datos y las evidencias de validación local. |

## Materiales por área y controles de auditoría

| Cambio | Implementación | Revisión pendiente en la tesis |
|---|---|---|
| INV-02 | Inventario guarda y filtra por el área principal del material. El catálogo original permitió clasificar 22 materiales de Impresión Digital y 10 de Grabado y Corte Láser. Los 11 casos ambiguos quedan por clasificar. | Actualizar RF-05, RF-06, el modelo 4.6, el Anexo G y las capturas de Inventario. |
| ORD-04 | Al convertir, la orden guarda el área de cada material estimado, tanto de partidas personalizadas como de recetas. La ficha y la impresión agrupan los consumos por esa clasificación. | Actualizar CF-01, CF-02, el diagrama de conversión, el modelo 4.6 y la evidencia impresa. |
| AUD-01 | La fecha de entrega queda fija desde que la orden está Lista. El servidor y PostgreSQL bloquean modificaciones. | Actualizar la máquina de estados, las reglas de edición y las pruebas de integridad. |
| AUD-02 | El personal sin permiso de Cotizaciones recibe los datos operativos de la orden. La ficha, API, búsquedas y vista imprimible restringen los datos comerciales. | Actualizar la matriz de permisos y las evidencias por perfil. |
| AUD-03 | La conversión exige seleccionar al responsable general y lo registra en bitácora. Los responsables de cada área siguen siendo independientes. | Actualizar CF-01, CF-02 y el formulario de conversión. |

Diseño Gráfico prepara los artes solicitados. Impresión Digital maneja la impresión en gran formato. Acabado monta los impresos sobre su soporte y prepara la entrega. Taller fabrica las estructuras que exige el trabajo. Por ejemplo, en un vinil montado sobre PVC, el vinil puede quedar en Impresión Digital y el PVC en Acabado.

Verificación del 9 de noviembre de 2026. Pasaron 241 pruebas de Órdenes, 440 de Producción y 234 de Inventario. En Edge se verificaron el filtro de Inventario, el responsable general obligatorio, el vinil y el PVC agrupados en áreas distintas, la impresión de Producción sin datos de cotización y el bloqueo de la fecha de entrega. Una prueba de integración confirmó que reclasificar el material no altera su área guardada en una orden anterior. También pasaron las 23 pruebas de interfaz de Órdenes después de corregir el contraste de la cabecera y las descripciones de formulario.

## Tarifas de materiales y órdenes de trabajo

| Cambio | Implementación | Revisión pendiente en la tesis |
|---|---|---|
| COT-14 | Los 43 materiales activos del catálogo original reciben un precio de cotización provisional en C$ por unidad de cotización. La lona banner de 13 oz queda en C$150/m². Gerencia y Administración pueden editar los valores desde Configuración → Tarifas. El envío exige que los materiales registrados de la partida tengan un precio positivo. Las cotizaciones emitidas conservan sus importes. | RF-03, RF-05, diccionario de datos 4.6 y flujo de actualización de precios. |
| ORD-05 | La ficha interna distingue las cantidades estimadas de Inventario y las cantidades cotizadas de líneas sin estimación. La OT-2026-0014 muestra la lona y los cuatro tubos metálicos capturados manualmente. El permiso de consulta de Inventario protege las cantidades en la ficha, en Trazabilidad y en sus API. | CF-01, CF-02, CF-05, diagrama de conversión y matriz de permisos. |
| ORD-06 | La orden imprimible incorpora el logo oficial. La lista de materiales para el trabajo incluye sus nombres y sus áreas cuando están clasificadas. Las cantidades de consumo se consultan en la ficha interna. Esta regla sustituye la salida impresa descrita en ORD-04. | Evidencia de la orden de trabajo en papel. |
| PROD-01 | Conversión, etapas, plantillas y tablero usan Diseño Gráfico, Grabado y Corte Láser, Impresión Digital, Bordado y Serigrafía, Acabado y Taller. Las etapas heredadas de Despacho e Instalación pasaron a Acabado y las de Electricidad y LED pasaron a Taller. Las etapas conservan sus tareas, responsables e instrucciones. | Diagramas y capturas de Producción, catálogo de áreas en el modelo 4.6. |
| COT-15 | Los títulos y descripciones de Cotizaciones se muestran encima de los campos al crear y editar. Cada formulario usa el ancho de su sección. | Capturas y anexo de interfaz de Cotizaciones. |

## Carga oficial de materiales y precios de venta

| Cambio | Implementación | Revisión pendiente en la tesis |
|---|---|---|
| INV-03 | La carga oficial incorpora 192 materiales y actualiza 17 fichas. Distingue el costo de referencia de adquisición, el valor del insumo que usa una partida personalizada y el precio de venta del producto terminado. Registra la hoja y la fila de origen en bitácora. Los materiales nuevos empiezan con existencia cero. | RF-03, RF-05, RF-06, diccionario 4.6 y evidencia de carga del catálogo. |
| CAT-01 | El catálogo incorpora 112 precios de venta, 24 de Impresión Digital y 88 de Sublimación. Las recetas de 109 productos vinculan los insumos identificados en el archivo. Diez precios de sublimación quedan pendientes por referencias a otras filas. | RF-03, CF-01, CF-02, modelo de receta, diagrama de cotización y conversión. |
| CAT-02 | El catálogo activo queda con los 112 productos oficiales del Excel. Se eliminaron 31 productos anteriores sin referencias y se archivaron los tres vinculados a cotizaciones para conservar el historial. Cada retirada quedó en bitácora. | Evidencia de RF-03 y flujo de selección de catálogo en Cotizaciones. |
| CAT-03 | Se normalizó la capitalización de 88 nombres del catálogo activo. Los nombres usan mayúscula inicial, mantienen las siglas y muestran las medidas con un formato uniforme. Cada edición quedó en bitácora. | Capturas de Catálogo y del selector de productos de Cotizaciones. |

Las variantes de rollos y láminas se distinguen por presentación. El costo físico por m² divide el costo de adquisición con traslado entre el área total. El valor de la línea de material en cotizaciones toma el área útil del Excel cuando existe. Los precios de venta toman las hojas de precios y usan la conversión a córdobas indicada en el archivo. La hoja de costeo de impresión aporta tres precios de servicios que no tenían un importe en el resumen. El catálogo usa los precios nuevos al cotizar. La carga conserva el historial comercial y el libro de Inventario.

## Acceso para la validación local

| Cambio | Implementación | Revisión pendiente en la tesis |
|---|---|---|
| ACC-01 | Las 15 cuentas del personal usan una clave fija común en la instalación local para validar sus perfiles. La cuenta técnica conserva su acceso y el flujo de contraseña temporal sigue disponible para el despliegue en producción. | Distinguir el acceso de validación del procedimiento de alta en producción en el plan de pruebas. |
| ACC-02 | Gerencia recibe todos los permisos. Administración conserva sus permisos previos y gestiona Clientes, Cotizaciones y ODT. Operaciones da de alta clientes, gestiona Cotizaciones y ODT y consulta Inventario. Atención al Cliente gestiona Clientes y Cotizaciones, convierte las aprobadas a ODT y desde ahí consulta la orden y Producción. Producción conserva su matriz. | Actualizar la Tabla 14 del apartado 4.5, el caso CF-07, los diagramas de conversión y Producción y las pruebas de acceso por perfil. |

ACC-02 reemplaza la regla de listado de CLI-01 para los perfiles con gestión completa de Clientes. Operaciones sigue buscando por nombre y tiene un permiso independiente para crear clientes. Las cuentas y los permisos se administran desde Gerencia o la cuenta técnica.

Cuando cambien tecnologías o componentes, revisar el apartado 4.4, la Figura 1 de arquitectura y la Tabla 20. Cuando cambien los procesos, revisar también sus diagramas, requisitos y evidencias de interfaz. Registrar la sección exacta en cada entrada y conservar la referencia a la versión que evaluó Gerencia.

## Privacidad comercial y asignaciones personales

Actualización del 11 de noviembre de 2026.

| Cambio | Implementación | Revisión pendiente en la tesis |
|---|---|---|
| ACC-03 | Perfiles y Permisos incorpora una selección de usuario para conceder funciones adicionales. El acceso efectivo suma los permisos de sus perfiles y los individuales; la bitácora registra cada alta y retirada. Las sesiones consultan el permiso vigente en cada petición. | Tabla 14 del apartado 4.5, CF-07, modelo 4.6 y Anexo G: agregar UsuarioPermiso y distinguir herencia de concesión individual. |
| COT-16 | Cada persona consulta y modifica sus cotizaciones. Gerencia y Arely Rodríguez tienen acceso compartido mediante cotizacion:ver_todas; Dalila conserva Administración con acceso a sus propias cotizaciones. La restricción cubre API, proforma, historial del cliente, indicadores, reportes y datos comerciales en ODT y Trazabilidad. | RF-03, CF-01, CF-07, reglas de acceso y casos de prueba entre personas del mismo perfil. |
| ACC-04 | Flor Moreno y Brandi Castillo se incorporan al perfil Producción y al área Bordado y Serigrafía. Ambas usan el acceso fijo de validación local acordado. La lista del script de usuarios reales incorpora las dos altas para instalaciones futuras. | Actores, relación UsuarioArea y datos de validación. La plantilla local pasa a 17 personas más la cuenta técnica. |
| PROD-02 | Producción consulta y ejecuta únicamente sus etapas asignadas. Una etapa posterior se habilita cuando todas las anteriores están completadas u omitidas. El servidor rechaza la ejecución ajena y los saltos de secuencia, incluso con solicitudes concurrentes. Los permisos de planificación permiten supervisión general. | CF-02, reglas y diagrama de secuencia de Producción, estados y casos de concurrencia. |
| PROD-03 | Las nuevas asignaciones disponibles producen un aviso emergente con enlace a la orden. El navegador consulta cada diez segundos mientras la sesión está abierta. El usuario activa el sonido mediante un botón; puede silenciarlo. Los avisos vistos se recuerdan por usuario en ese navegador. | Apartado 4.4, flujo de asignaciones, diagrama de interacción y evidencias de interfaz. Registrar el sondeo y Web Audio API; no se implementó notificación push fuera de la aplicación. |

La concesión individual amplía permisos; no niega funciones heredadas del perfil. Solo las personas con permiso:gestionar pueden administrar estas concesiones. Ver cotizaciones ajenas no sustituye los permisos de edición, aprobación o conversión. ACC-03 y COT-16 precisan el alcance de la matriz ACC-02. PROD-02 sustituye la visibilidad general de etapas del perfil Producción.

Verificación del 11 de noviembre de 2026: 2.872 pruebas aprobadas en Acceso, Cotizaciones, Producción, Órdenes, Clientes, Analítica, Núcleo e Interfaz. Compilación Docker, TypeScript y ESLint aprobados. En Edge se verificaron concesión y revocación desde la pantalla individual con una sesión ya abierta, privacidad de proforma, secuencia entre Nathaly y Gabriel, aviso emergente, emisión de sonido, teclado y ausencia de infracciones graves de axe en Perfiles y Permisos. Evidencias: docs/capturas/permisos-individuales.png y docs/capturas/avisos-asignacion.png.

## Producción, notificaciones y permisos

Actualización del 11 de noviembre de 2026. Mismos códigos y estado que el Word (Completado).

| Cambio | Implementación | Revisión pendiente en la tesis |
|---|---|---|
| ORD-07 | La orden imprimible ya no muestra la tabla de partidas del trabajo. | Captura y descripción de la orden imprimible. |
| CAT-04 | La interfaz usa "materiales del producto" en lugar de receta; el modelo conserva su nombre. | RF de catálogo, diccionario de datos y capturas. |
| PROD-04 | Botón Hecho con confirmación; la etapa pasa por en curso y completada en una operación. | CF-02, flujo de Producción y diagrama de estados de la etapa. |
| PROD-05 | Producción solo ve las órdenes en las que participa y, en ellas, todas las etapas; ejecuta solo las propias habilitadas. Sustituye la vista de PROD-02. | Tabla 14, CF-07, CF-09 y pruebas de acceso de Producción. |
| GEN-04 | Campana de notificaciones con lectura por usuario y sonido persistente. Sustituye la barra de avisos de PROD-03. | Apartado 4.4, diagrama de interacción y modelo 4.6 (`notificacion_lectura`). |
| ACC-05 | Perfiles y permisos en dos pestañas: por perfil y por usuario. | Captura de Perfiles y permisos. |
| ACC-06 | Danny Gahona pertenece a Grabado y Corte Láser y a Diseño Gráfico; cada área genera su etapa y su aviso. | Actores y datos del plan de validación. |
| DAT-02 | El respaldo programado mide el intervalo con la hora real. | RNF-06 y evidencia de respaldo. |

Personal con acceso de validación: 17 cuentas desde ACC-04 (las 15 de ACC-01 más Flor Moreno y Brandi Castillo).

## Interfaz, medidas y alcance de Producción

Actualización del 12 de noviembre de 2026. Mismos códigos y estado que el Word.

| Cambio | Implementación | Revisión pendiente en la tesis |
|---|---|---|
| COT-17 | Profundidad opcional en las partidas; con ella, el m² se calcula como caja abierta y ajusta precio y material. | RF de cotización, fórmula de costeo, modelo 4.6 y diccionario de datos. |
| COT-18 | La lista de cotizaciones omite Vencimiento y Creada; se consultan en la ficha. | Captura de la lista de cotizaciones. |
| ORD-08 | Materiales por etapa en la tabla de responsables e instrucciones, en ficha e imprimible. | Captura y descripción de la ODT. |
| ORD-09 | Lista de ODT sin código de cliente y con avance en anillo. | Captura de la lista de órdenes. |
| PROD-06 | Producción no ve la trazabilidad ni el historial de la orden. Sustituye la trazabilidad por participación de PROD-05. | Tabla 14, CF-07, CF-09 y pruebas de acceso. |
| PROD-07 | Tablero de Producción en columnas compactas con tarjetas. | Captura del tablero de Producción. |
| GEN-05 | Paleta neutra en modo oscuro y con menos blanco en modo claro. | Capturas de interfaz y apartado de diseño. |

## COT-19 Cotizaciones personalizadas configurables

Configuración incorpora categorías, tipos, unidad, margen sugerido y materiales habituales. El cotizador permite elegir el tipo y marcar los insumos que usará. La revisión en la tesis debe actualizar RF de cotización, CF-10, Configuración, modelo 4.6 (contenido de Configuracion), matriz de permisos y capturas del editor. Es la primera entrega del plan; gastos, conversión de presentaciones y alertas de faltantes no están implementados en COT-19.

Validación COT-19 del 12 de noviembre de 2026: 366 pruebas de Cotizaciones y 344 de Acceso aprobadas; TypeScript, ESLint y compilación Docker correctos. En Edge, sobre copia QA: configuración de ocho categorías, alta de tipo, selección de material, guardado de partida y conservación de importes al retirar el tipo. Axe sin infracciones graves en la nueva pantalla y sin errores JavaScript observados. Instancia real comprobada con Administración, Operaciones y Producción sin escrituras de negocio. Word COT-19: Completado. Evidencias en docs/capturas/personalizadas-configuracion.png y personalizadas-cotizador.png.

## COT-20 y COT-21 — 2026-11-12

Actualizar descripción y diagrama de actividad de cotización personalizada: categoría comercial → producto → selección de materiales → cantidades y gastos del trabajo → revisión de precio. Documentar tarifas sugeridas por producto y moneda, renta fija o porcentual, ida y vuelta, horas por persona, viáticos, hospedaje y porcentajes sobre venta. Actualizar diccionario y modelo con gastos_personalizados y es_gasto_personalizado. Explicar validación de tasas, instantáneas y límite de descuento cero para porcentajes. No presentar reservas, alertas de compras, geometría por componente o equivalencias comerciales como implementadas. Registro Word con los mismos códigos; corrección del texto final de la tesis pendiente.

## COT-22, COT-23 e INV-11 — 2026-11-13

Actualizar capturas del cotizador y Configuración, diagrama de actividad de instalación (coordenadas, consulta de ruta y tarifa excepcional), fórmula de ida y vuelta y diccionario de instalacionIdaVuelta. Sustituir la captura de traslado por partida por la sección única de Instalación. Documentar la diferencia entre valores históricos de costeo, tarifas vigentes y costo promedio contable; incluir el catálogo normalizado y la carga inicial de existencias no verificadas en cero. No afirmar que se han implementado reservas o alertas nuevas de abastecimiento. Registro Word con los mismos códigos; la redacción de la tesis queda pendiente.

## COT-24 — 2026-11-13

Actualizar el flujo de cotización: seleccionar producto configurado carga materiales y sugerencias automáticamente, revisar consumos y completar horas/gastos, obtener precio y guardar. Describir captura manual como alternativa, eliminar el paso obligatorio Aplicar y las capturas antiguas de líneas de costo. Actualizar el diccionario con producto_personalizado como instantánea sin FK y los casos de servicio sin materiales. Usar lenguaje claro para el usuario y conservar ItemCotizacion/LineaCosto como nombres técnicos internos. Registro Word COT-24 con el mismo estado; redacción final de tesis pendiente.


## GEN-06, COT-25, INV-12, CAT-05 y BI-01 — 2026-11-13

Actualizar capturas y lineamientos de interfaz: títulos superiores, superficies diferenciadas, filtros desplegables y materiales/costos en tabla. Ajustar los flujos de alta de inventario y catálogo para códigos automáticos estables, secuencias, prefijos y búsqueda por referencias anteriores. Incluir MaterialFoto, fotoVersion, codigosAnteriores, Categoria.prefijoCodigo y SecuenciaCodigo en modelo entidad relación y diccionario de datos. Explicar almacenamiento privado, validación, auditoría y respaldo de fotos.

Actualizar capturas de los cuatro reportes y describir cada KPI, denominador, moneda, alcance de permisos y fecha de referencia. Especificar gráficos 2D y tabla de detalle, saldos actuales frente a completadas del período, monto cotizado frente a cobros y saldo cero pendiente de conteo. No atribuir al sistema indicadores de facturación, utilidad realizada, productividad individual o historia de inventario que no implementa. Mismos códigos y estado en el Word; redacción final de tesis pendiente.

## GEN-07, COT-26 y ORD-10 — 2026-11-14

Actualizar capturas de barras de filtros, cotizador y formularios con marcos definidos, columnas numéricas alineadas y acción Quitar en columna separada. Registrar ayudas accesibles de íconos en acciones de etapas de ODT/Producción, navegación por teclado y conservación de confirmaciones. Esta entrega afecta presentación y accesibilidad; no modifica el modelo de datos, diagramas de estados, fórmulas ni matriz de permisos. Mismos códigos y estado en el Word; la edición final de la tesis permanece pendiente.

## GEN-08 Responsividad de Usuarios y Trazabilidad — 2026-11-14

Actualizar capturas de Usuarios (lista, alta y edición) y Trazabilidad (filtros, bitácora y detalle) en PC, tableta y móvil. Describir distribución por ancho disponible, tablas con desplazamiento localizado y panel de filtros con altura limitada y nombre accesible. Conservar la descripción íntegra de campos, historial y permisos: no cambia el modelo de datos, las fórmulas ni los diagramas de estados. La redacción final y las capturas en la tesis permanecen pendientes; registrar GEN-08 y el mismo estado en el Word.
