# Cambios de interfaz de la versión 9 que afectan a los E2E

Fecha: 2026-10-11. Fuente: informes de los rediseños y `docs/modulos/09-perfiles-v9.md`.

## Perfiles y accesos
- Seis perfiles: GERENCIA, ADMINISTRACION, OPERACIONES, ATENCION_CLIENTE, PRODUCCION, ADMIN (administración técnica). Matriz en `09-perfiles-v9.md`.
- Gerencia solo consulta. Operaciones crea y cierra órdenes. Administración consume, ajusta y entra inventario. Atención al cliente cotiza y registra la aprobación. Producción ejecuta etapas. ADMIN solo usuarios, permisos, configuración y bitácora.
- Claves de siembra: `SEED_PASSWORD_GERENCIA`, `_ATENCION_CLIENTE`, `_ADMINISTRACION`, `_OPERACIONES`, `_PRODUCCION`, `_ADMIN`. Usuarios nuevos de la siembra: Karla Reyes (Operaciones) y Luis Mendoza (Administración).
- Menú: el grupo de administración se llama "Administración técnica" (miga de pan incluida).
- Un usuario puede tener varios perfiles; el menú muestra la unión de permisos.

## Login
Pantalla dividida: formulario a la izquierda y panel informativo a la derecha (solo desde 1024 px). Un solo logo visible. El formulario conserva etiquetas, botón "Ingresar" y mensajes.

## Panel
Un panel distinto por perfil (pregunta, título con la conclusión, 4 indicadores, 1 gráfico de barras, lista "Requiere atención"). ADMIN no tiene panel. Un usuario con varios perfiles ve un selector de perfil (botones con aria-pressed). Ya no existen los bloques anteriores (Resumen, Cotizaciones, Materiales, Carga).

## Clientes y catálogo
- Lista de clientes: se quitaron las columnas "Contacto" y "Teléfono". Orden: Nombre, Código, Tipo, Estado, Cotizaciones. Fila completa enlazada.
- Ficha de cliente: encabezado con código CLI-xxxx y estado; pestañas Resumen, Cotizaciones, Trabajos y Actividad (solo la activa está en el DOM); botón principal "Nueva cotización" o "Editar"; "Reactivar" si está archivado.
- Catálogo: la tarjeta ya no muestra "Costo de referencia" (queda en la ficha, con cotizacion:ver). Ficha de producto con pestañas Resumen y Receta.

## Cotizaciones
- Lista sin columnas "Asunto" ni "Emisión"; el vencimiento en móvil lleva el prefijo "Vence: ".
- Ficha: línea "Siguiente paso:" y botón principal según estado y permisos. Secciones plegables cerradas por defecto: "Condiciones y fechas" y "Costos internos" (abrirlas antes de leer "Condiciones comerciales", "Emisión", "Vigencia" y "Costos del ítem N").
- Aprobar exige "Referencia de aprobación" (3 a 200 caracteres) y registra al usuario. Acciones nuevas: "Solicitar ajustes" (motivo de 3 a 500 caracteres; estado "Ajustes solicitados") y "Crear versión corregida" ("Versión N").
- Aprueban Operaciones y Atención al cliente, no Gerencia.

## Órdenes
- Lista sin columna "Categoría"; chip y enlace "Sin responsable"; fila completa enlazada.
- Ficha: encabezado con entrega, responsable o "Sin responsable" con botón "Asignar", y "siguiente paso". Pestañas: Especificaciones, Cliente y cotización, Consumo estimado, Materiales consumidos, Historial (abrir la pestaña antes de buscar "Línea de tiempo", "Materiales" o "Registrar consumo"). "Iniciar producción" es un ancla a las etapas. "Marcar lista" está en el encabezado en EN_PRODUCCION.
- Crea la orden Operaciones; la orden puede nacer sin responsable.

## Producción e inventario
- Tablero: ya no existe la columna "Fechas planificadas"; "Atrasada" es una etiqueta; "Mis etapas" va primero; botones de 40 px.
- Lista de materiales: columnas Código, Material, Existencia, Stock mínimo, Estado. Estados "Normal" (antes "Activo"), "Bajo mínimo" (antes "Stock bajo"), "Sin existencia", "Archivado". Sin columna "Costo promedio (C$)" (queda en la ficha).
- Ficha del material: libro de movimientos en una sección `details` abierta con "Movimientos (N registros)".
- Consumo: lo registra Administración desde la orden.

## Administración técnica
Tres pantallas nuevas: `/admin/usuarios` (lista, nuevo, ficha con desbloquear, desactivar, reactivar y reiniciar clave con clave temporal que se muestra una vez), `/admin/permisos` (matriz perfil por permiso, permisos protegidos de ADMIN deshabilitados) y `/admin/configuracion` (IVA, vigencia, moneda, nombre de empresa; zona horaria solo lectura).

## Anchos de prueba (RNF-08)
768, 1024, 1366 y 1920 px. Los E2E y las capturas usaban 820 px: cambiar a 768.
