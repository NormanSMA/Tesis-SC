# Pulido visual y de rendimiento (revisión del 2026-10-11)

Fuente: dos revisiones visuales de `docs/capturas/recorrido/` (60 capturas, escritorio y móvil) y una auditoría de rendimiento de consultas. Estado: lista de trabajo. Marcar cada ítem al cerrarlo.

## Corregido por el orquestador
- Filas de listas superpuestas en móvil (clientes, órdenes, producción): faltaba `h-auto` en móvil (`TablaClientes`, `TablaOrdenes`, `TableroProduccion`).
- `DataTable` con apilado móvil opt-in (`apilarEnMovil`) activado en inventario, bitácora y reportes.
- Paleta azul marino, etiquetas de barras, "▼ 31 pts", barras de estados del panel de Operaciones, dato duplicado "Categoría" en la ficha de la orden, flecha en plegables.

## Pendiente de interfaz
### Formatos y datos
1. Reportes: importes sin formato ("262932.59") y porcentajes sin símbolo ("88.24"). Usar `src/lib/formato.ts` ("C$ 262,932.59", "88.2 %") y rotular el periodo.
2. Existencias con tres decimales en unidades discretas ("64.000"); mostrar enteros cuando la unidad es UNIDAD o PLIEGO. En el panel: "Existencia 0 de 5" y dinero sin decimales (C$ 1,174,042).
3. Fechas con dos formatos ("11/10/26, 4:01:41 a. m." y "11 oct 2026"): unificar a "11 oct 2026" y hora 24 h con zona solo donde importe.
4. Reportes: campos de fecha "dd/mm/yyyy" en inglés; valores por defecto del periodo.
5. Trazabilidad: columna Detalle con texto técnico, "Aprobada → Aprobada" y "Archivada: false → true"; resumir en una frase, ocultar cambios sin diferencia y plegar los filtros avanzados (hoy 8 filtros más buscador duplicado).
### Paneles
6. Gráfico mensual: abreviar meses ("sep", "oct") y no dibujar meses vacíos al inicio, o añadir nota "sin datos".
7. Pie del gráfico de Gerencia: dos enlaces iguales a Reportes; dejar uno.
8. Tarjeta "Monto aprobado" repite el título; mostrar otro dato (número de cotizaciones aprobadas).
9. Igualar alturas de tarjetas KPI y de gráfico y lista de atención.
10. Panel de Operaciones sin pendientes: un solo mensaje con enlace a Órdenes.
11. Panel de Producción: etiquetas de día cortas ("lun 5").
### Administración técnica
12. Matriz de permisos: un botón fijo "Guardar cambios" con "N cambios sin guardar"; en móvil, selector de perfil con una columna por vez.
13. Lista de usuarios: insignia de estado como el resto de la app, tarjetas en móvil y por defecto solo activos.
14. Configuración: lista compacta, un solo "valor", campo corto, ocultar claves técnicas (`siembra_version`), zona horaria visualmente deshabilitada.
### Fichas
15. Ficha de cotización: "Siguiente paso" sin acción cuando el actor no puede; plegables con aspecto de acordeón (flecha ya agregada) y totales alineados bajo la tabla.
16. Ficha de orden: ítems en rejilla con alineación superior (sin vacíos), no repetir cliente, entrega y responsable en la pestaña "Datos de la orden", pestañas con desplazamiento horizontal en móvil y etapas como tarjetas en móvil.
17. Ficha de cliente: confirmar que no queda en esqueleto de carga (captura tomada antes de cargar; verificar en navegador).
### Listas y filtros
18. Un solo componente de filtros (alturas, radios, etiquetas de 14 px, selects con el mismo estilo); "Todas las fechas" cortado en Órdenes; botones agrupados.
19. Clientes: chip "Activo" solo si el estado no es Activo; Cotizaciones: etiqueta "Archivo" clara.
20. Catálogo: tarjetas con miniatura más baja, código en una línea y un solo enlace por tarjeta.
21. Inventario: pestaña inactiva con más contraste.
22. Barra superior: el título repite el h1 en listas; mostrar solo migas en fichas.
### Datos de demostración
23. Las E2E dejan usuarios "E2E Admin..." y registros "E2E-..." en la base de demostración; reiniciar la base al terminar (`docker volume rm sc-plataforma_sc_pgdata`) y revisar la limpieza de las E2E.

## Pendiente de rendimiento (Codex)
P1. `src/modules/panel/consultas.ts` consultarMovimientos: filtrar `creado_en >= (semana - 35 días)` además de la expresión de fecha.
P2. `src/modules/trazabilidad/repo.ts`: ventana por defecto de 30 días, índice trigram para `texto`.
P3. `src/modules/inventario/repo.ts` consultarOpcionesLibro y `src/modules/cotizaciones/repo.ts` clientes activos: `take` o selector asíncrono.
P4. `src/modules/produccion/consulta.ts`: tablero con `take` y lista enviada una sola vez.
P5. `src/modules/panel/consultas.ts` consultarComercial: limitar la CTE a 12 meses más estados abiertos y agregar índice sobre fecha_respuesta.
P6. Cotización: la ficha usa `consultarSelectores()` (todos los productos y materiales) y solo necesita categorías.
P7. `src/lib/auth/guardia.ts` y layout: sesión resuelta dos veces por petición; envolver con `cache()` de React.
P8. `src/modules/admin/paginas.ts`: conteos con `count()` y filtros en la base.
P9. Índices `(creado_en, id)` en cotizacion y orden_trabajo; `equals` insensible a mayúsculas en buscarTrabajo no usa el índice único.

## Auditoría de accesibilidad (pendiente, WCAG 2.2 AA)
A1. Diálogos y sheets abiertos por un botón con estado no devuelven el foco al disparador (Radix enfoca un trigger nulo): guardar document.activeElement al abrir y enfocarlo en onCloseAutoFocus (ui/dialog.tsx, ui/sheet.tsx). [Hecho por el orquestador]
A2. Tras una acción asíncrona se destruye el botón enfocado (AccionesEtapa con key=actualizadoEn, AdministracionAreas, quitar fila en EditorItem, EditorLinea, EditorReceta, LineaMovimientoOrden): enfocar el siguiente elemento o un contenedor tabIndex=-1 y anunciar en role=status.
A3. Panel: cambiar de perfil remonta y pierde el foco; "Actualizar" usa disabled y pierde el foco: usar aria-disabled y reenfocar.
A4. Crear usuario: el formulario se sustituye y se pierde el foco; ClaveTemporal es region sin aria-live: mover el foco a la región de la clave (tabIndex=-1).
A5. Bordes de select y textarea con contraste 1.18:1 (CamposMaterial, CamposLibro select, FiltrosInventario, SelectorMaterial): border-input.
A6. DataTable max-h-[calc(100dvh-16rem)] con zoom 200 % deja una fila visible: aplicar solo desde md; tablas table-fixed sin versión móvil (TablasInventario, ResultadoReporte, TablaBitacora, EtapasOrden) con min-w y scroll interno.
A7. Anuncios ruidosos: output de EditorLinea anuncia cada tecla (aria-live off), totales de EditorItems con aria-live polite por tecla, wrapper assertive sobre role=alert en CamposProduccion.
A8. Errores de archivar cliente y catálogo solo por toast de 4 s: usar alerta persistente.
A9. TabsContent con outline-none (ui/tabs.tsx): focus-visible visible; PestanasInventario con router.push por flecha.
A10. Menú: página activa distinguida solo por tono; añadir font-semibold. [Hecho]
A11. "Alerta" del panel solo en rojo y barra destacada solo en color: añadir texto o icono.
A12. Label htmlFor apunta a un div en EditorItems y EditorItem: usar fieldset/legend o role=group.
A13. Primera columna con td en vez de th scope=row (DataTable, TablaClientes).
A14. CardTitle es div; tarjetas sin encabezado en CadenaTrabajo, inventario/[id] y MaterialesOrden; el h1 de usuarios cambia con los conteos.
A15. Títulos de ficha estáticos: generateMetadata con el nombre o número (clientes, órdenes, cotizaciones).
A16. Textos en inglés: sonner "Notifications", breadcrumb aria-label, falta app/not-found.tsx. [Hecho]
A17. Objetivos de 32 px: size sm en AdministracionPlantillas y FormularioCliente, ojo de contraseña del login, colapsar riel, cierre X de dialog y sheet, Checkbox de EditorItem (20 px), pestañas de inventario (36 px).
A18. Botón ojo del login cambia de etiqueta y usa aria-pressed: etiqueta fija.
A19. Campos obligatorios de CamposUsuario sin indicador.
A20. aria-label del logo no contiene el texto visible "Plataforma de gestión".
A21. Cerrar el riel con clic en el overlay no devuelve el foco: usar cerrarRielConFoco.

## Concurrencia (auditoría Claude, integridad sin hallazgos graves)
C1. [Hecho] Login: FOR NO KEY UPDATE en lugar de FOR SHARE (interbloqueo posible); validarResponsable de órdenes con FOR SHARE.
C2. Conversión desde cotización archivada no se rechaza (ordenes/conversion.ts).
C3. exigirClienteActivo sin FOR SHARE; crearCotizacion sin Idempotency-Key; huella de libro sin normalizar; consumo en orden cancelada solo en la aplicación (agregar al trigger fn_consumo_validar).

## Estado al 2026-10-11 08:40
- Cerrados en código (pendiente verificación visual en el recorrido): ítems 1-22. Salvedades: ítem 2 en listado y ficha de inventario (3 decimales), ítem 4 (formato de fecha según el navegador), ítem 5 en `textoEvento` de clientes y órdenes, ítem 19 etiqueta "Archivo" de Cotizaciones (las E2E dependen de ella).
- Ítem 17: la ficha de cliente es de servidor; el esqueleto era `clientes/loading.tsx`. Falta un `loading.tsx` propio en `clientes/[id]/`.
- Accesibilidad: A1, A10, A16 hechos.
