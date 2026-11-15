# Sistema de diseño

Describe los tokens, los componentes y las reglas de uso de la interfaz.
Cubre el criterio CF-08 (adaptabilidad) y la accesibilidad WCAG 2.2 AA.

## Decisiones

- Usa shadcn/ui (estilo new-york, base neutral, Tailwind 4) como única base de primitivas.
- Personaliza las primitivas solo con tokens CSS. No hay un segundo sistema.
- Empaqueta Inter con `@fontsource-variable/inter`. El build no depende de internet.
- Usa lucide-react para íconos. No hay emojis.
- Usa temas claro y oscuro mediante tokens CSS. El navegador conserva la selección y la primera visita toma la preferencia del sistema.
- La línea gráfica usa índigo (#2d264f), dorado (#f3a320), carbón (#2d2022) y gris (#a4a3a3). Los estados usan color, ícono y texto.
- Reemplaza el paquete `cn` que instaló la CLI por `clsx` y `tailwind-merge` en `src/lib/utils.ts`.
- Omite `ui/form.tsx`. `FormField` de `comunes` cubre ese papel con react-hook-form y zod.
- Omite `next-themes`. El control de tema está disponible en el acceso y en la barra superior.

## Tokens

Los tokens viven en `src/app/globals.css`. Tailwind los expone con `@theme inline`.

### Color

| Token | Valor | Uso |
|---|---|---|
| `--primary` | #2d264f en claro, #f3a320 en oscuro | Acción primaria, enlace activo |
| `--primary-hover` | #403563 en claro, #ffb847 en oscuro | Hover de la acción primaria |
| `--primary-soft` | #eeebf5 en claro, #382e4f en oscuro | Fondo tenue del primario |
| `--primary-soft-border` | #d7d0e5 en claro, #675780 en oscuro | Borde tenue del primario |
| `--brand-gold` | #f3a320 | Acento de marca |
| `--ring` | #2d264f en claro, #ffb847 en oscuro | Anillo de foco |
| `--background` | #eeedf1 en claro, #141316 en oscuro (GEN-05, 2026-11-12) | Fondo de página |
| `--card` | #fbfbfc en claro, #1d1c21 en oscuro | Superficie |
| `--border` | #d9d7e0 en claro, #35343c en oscuro | Contorno decorativo |
| `--input` | #64748B | Contorno de controles |
| `--foreground` | #2d2022 en claro, #f5f2fb en oscuro | Texto |
| `--muted-foreground` | #4b4757 en claro, #aaa8b2 en oscuro | Texto secundario |
| `--success` | #15803D | Éxito |
| `--warning` | #B45309 | Advertencia |
| `--danger` | #B91C1C | Peligro y errores |
| `--info` | #1D4ED8 | Información |

Conserve #aab6ec como antecedente de `--primary-soft-border` en la lectura inicial de esta auditoría.
Use #cbd5e1: `globals.css` cambió durante la actualización documental y contiene ese valor.

Cada estado tiene fondo tenue y borde tenue: `--success-soft`, `--warning-soft`, `--danger-soft`, `--info-soft`, `--primary-soft`.
`--neutral-strong` (#334155) pinta el estado Cerrada.

### Contraste vigente (GEN-05, medido el 2026-11-12)

| Par | Razón |
|---|---|
| Claro: texto sobre fondo / tarjeta | 13.43:1 / 15.14:1 |
| Claro: texto secundario sobre fondo / muted | 7.71:1 / 7.37:1 |
| Claro: primario sobre tarjeta | 13.52:1 |
| Claro: borde de control sobre tarjeta | 4.60:1 |
| Oscuro: texto sobre fondo / tarjeta | 15.60:1 / 14.27:1 |
| Oscuro: texto secundario sobre tarjeta / muted | 7.22:1 / 6.40:1 |
| Oscuro: dorado sobre tarjeta y texto sobre dorado | 8.12:1 |
| Oscuro: borde de control sobre tarjeta | 3.90:1 |

El modo oscuro deja de usar grises con tinte violeta: grafito con leve calidez del carbón de la marca y dorado como acción.

### Contraste histórico: por recalcular

Conserve estas mediciones como antecedentes de la paleta anterior.
Recalcule los pares con primario, hover, fondo tenue, borde tenue, dorado y foco actuales.
No interprete los valores antiguos como verificación de los tokens vigentes.

| Par | Razón |
|---|---|
| Texto sobre fondo de página | 17.06:1 |
| Texto secundario sobre fondo de página | 7.24:1 |
| Blanco sobre acento | 5.47:1 |
| Blanco sobre acento hover | 7.58:1 |
| Éxito sobre su fondo tenue | 4.79:1 |
| Advertencia sobre su fondo tenue | 4.84:1 |
| Peligro sobre su fondo tenue | 5.91:1 |
| Información sobre su fondo tenue | 6.16:1 |
| Acento sobre su fondo tenue | 5.25:1 |
| Borde de control sobre blanco | 4.76:1 |
| Anillo de foco sobre blanco | 5.47:1 |

El borde decorativo (#E2E8F0) mide 1.23:1. Solo separa superficies. Ningún control depende de él.

### Forma y espacio

- Radio: 6 px (`rounded-md` y `rounded-lg`). 4 px en detalles pequeños.
- Base de espaciado: 4 px (escala por defecto de Tailwind).
- Padding de página: 24 px desde 1280 px. 16 px por debajo.
- Alto de control: 40 px. Alto de fila de tabla: 48 px.

### Tipografía

Escala: 12, 14, 16, 20, 24 y 30 px (`text-xs` a `text-3xl`). No uses `text-lg`.

| Uso | Tamaño |
|---|---|
| Tablas, menús, badges | 14 y 12 px |
| Formularios | 16 px |
| Título de página | 24 px |
| Valor de indicador | 30 px |

Los números usan `tabular-nums`. `table` lo aplica por defecto.

## Componentes

### Primitivas (`src/components/ui`)

button, input, label, textarea, select, checkbox, radio-group, switch, badge, card, table, dialog, sheet, dropdown-menu, tooltip, tabs, separator, skeleton, sonner, popover, alert, avatar, scroll-area, breadcrumb, pagination.

Cambios sobre shadcn:
- Foco de 2 px con anillo y separación.
- Controles de 40 px con texto de 16 px.
- Casilla y radio de 20 px. Interruptor de 24 por 44 px.
- `Badge` con variantes `neutro`, `neutroFuerte`, `acento`, `info`, `exito`, `advertencia`, `peligro`.
- `Table` con encabezado fijo y contenedor configurable.
- `Pagination` con textos en español y enlaces de Next.

### Layout (`src/components/layout`)

| Pieza | Función |
|---|---|
| `AppShell({ usuario, children })` | Menú lateral, barra superior y contenido |
| `navegacion.ts` | Ítems, grupos y permiso de cada ítem |
| `filtrarNavegacion(grupos, permisos)` | Oculta ítems sin permiso |
| `Migas` | Migas de pan derivadas de la ruta |
| `MenuUsuario` | Nombre, perfil y "Cerrar sesión" |
| `Marca` e `Isotipo` | Isotipo oficial de Soluciones Creativas (public/brand/isotipo.png) y nombre. El logo con texto queda guardado en public/brand/logo-completo.png |

Cierre de sesión: hace `POST /api/v1/auth/logout` y luego `router.replace("/login")`.
Ese endpoint es un supuesto. El agente de autenticación debe crearlo.

### Comunes (`src/components/comunes`)

| Pieza | Uso |
|---|---|
| `PageHeader` | Título, descripción y acciones de cada página |
| `EstadoBadge({ tipo, estado })` | Estado de cotización, orden, etapa o existencia |
| `TarjetaMetrica` | Indicador con guion si no hay dato; agrupar con `BandejaMetricas` |
| `EmptyState` | Lista o sección sin datos |
| `ErrorState` | Error de carga con acción de reintento |
| `Esqueletos` | Esqueletos de carga: `EsqueletoTarjetas`, `EsqueletoFilas`, `EsqueletoTabla` |
| `FormField` | Etiqueta, ayuda y error asociados al control |
| `DataTable` | Tabla con encabezado fijo, acciones y paginación |
| `Paginacion` | Pie de tabla con enlaces a páginas |
| `Timeline` | Bitácora: fecha, actor, acción, detalle |
| `ConfirmDialog` | Confirmación de acciones, con tono de peligro |
| `Money` y `Fecha` | Componentes de monto y fecha |
| `ModuloEnConstruccion` | Marcador temporal de los módulos |

### Formato (`src/lib/formato.ts`)

| Función | Resultado |
|---|---|
| `formatearMoneda("1234.5")` | `C$ 1,234.50` |
| `formatearCantidad("14.5", 3)` | `14.500` |
| `formatearFecha("2026-10-05")` | `05 oct 2026` |
| `formatearFechaHora(instante)` | `05 oct 2026, 14:42` (hora de Managua) |

- Las fechas AAAA-MM-DD no pasan por `Date`. No hay corrimiento de un día.
- Los montos usan aritmética entera. No pasan por coma flotante.

## Reglas de uso

1. Importa componentes solo desde `ui`, `layout` y `comunes`. No crees variantes locales.
2. Usa `PageHeader` en toda página. Una página tiene un solo `h1`.
3. Usa `EstadoBadge` para todo estado. No pintes estados a mano.
4. Envuelve cada control de formulario en `FormField`. Pasa los atributos que recibe al control.
5. Muestra errores con ícono y texto. No uses solo el color rojo.
6. Pasa a `DataTable` un `titulo` único. Es el nombre accesible de la tabla.
7. Usa `Money` o `formatearMoneda` para dinero. Usa `Fecha` o `formatearFecha` para fechas.
8. No muestres funciones que no existan. No agregues buscadores ni botones de relleno.
9. Oculta navegación con `permisos`. El servidor decide el acceso real.
10. No agregues color de acento nuevo. Reutiliza los estados.

## Imágenes del catálogo

Cada categoría tiene una imagen en `public/seed/productos/` (mapeo en `src/modules/catalogo/imagenes.ts`).
Las 8 se redibujaron el 2026-11-04 con el generador de imágenes de Codex. Norman validó cada una.

- Formato: WebP de 640x640 px.
- Estilo: ilustración de producto semirrealista y limpia. Contorno fino `#1e293b`, sombreado suave y acabados mate.
- Fondo liso `#f8fafc`. Sin texto, letras legibles ni logotipos.
- Color: azul marino `#1f2a6b` y sus tonos, blanco y grises fríos (`#eef1fb`, `#cbd5e1`, `#94a3b8`, `#475569`).
- Prohibido: verde, verde azulado, dorado, café, rojo y naranja.
- Encuadre: la tarjeta (`aspect-[5/2]`, `object-cover`) muestra solo la franja y=192 a y=448. El sujeto completo va entre y=180 y y=460.
- La ficha muestra la imagen cuadrada a 80 px. Prefiera sujetos que se lean a ese tamaño.
- `tests/unit/catalogo-imagenes.test.ts` falla si una imagen tiene píxeles verdes (tono 140° a 190°).
- Las imágenes verdes anteriores quedan en `_archivo/catalogo-verde/`.

## Adaptabilidad (CF-08)

| Ancho | Menú | Contenido |
|---|---|---|
| 1280 px o más | Lateral expandido de 256 px | Padding de 24 px |
| 768 a 1279 px | Riel de 64 px con tooltip. Se expande sobre el contenido | Ancho completo, padding de 16 px |
| Menos de 768 px | Panel lateral desde botón de hamburguesa | Una columna |

- El riel expandido se cierra con Escape, con el botón de contraer, con el fondo o al navegar.
- Las tablas anchas se desplazan en horizontal dentro de su contenedor. La primera columna queda fija.
- Móvil (390 px) funciona como esfuerzo. No es criterio de aceptación.

## Mapa WCAG 2.2 AA

| Criterio | Cómo se cumple | Pieza |
|---|---|---|
| 1.1.1 Contenido no textual | Íconos decorativos con `aria-hidden`. Botones de ícono con `aria-label` | Todas |
| 1.3.1 Información y relaciones | Landmarks `header`, `nav`, `main`. `th scope="col"`. `caption` por tabla | `AppShell`, `DataTable` |
| 1.4.1 Uso del color | Estados con ícono y texto. Enlace activo con barra y `aria-current` | `EstadoBadge`, `ListaNavegacion` |
| 1.4.3 Contraste mínimo | Exija 4.5:1 para texto normal; recalcule los pares de la paleta actual | Tokens |
| 1.4.11 Contraste no textual | Exija 3:1; conserve medición histórica del borde y recalcule el foco actual | `Input`, `Select`, foco |
| 1.4.13 Contenido en hover o foco | Tooltip persistente, descartable con Escape | `ListaNavegacion` |
| 2.1.1 Teclado | Todo es operable con teclado. Escape cierra riel, menús y diálogos | `AppShell` |
| 2.1.2 Sin trampas | Diálogos y paneles de Radix devuelven el foco al cerrar | `ConfirmDialog`, `MenuMovil` |
| 2.4.1 Saltar bloques | Enlace "Saltar al contenido" al inicio del documento | `layout.tsx` |
| 2.4.2 Título de página | Cada página define `metadata.title` | Páginas |
| 2.4.3 Orden del foco | Orden del DOM igual al visual | `AppShell` |
| 2.4.7 Foco visible | Anillo de 2 px en todo control | `globals.css`, `ui` |
| 2.4.11 Foco no oculto | `scroll-padding-top` por la barra fija. El riel expandido mueve el foco a su botón | `globals.css`, `BarraLateral` |
| 2.5.8 Tamaño del objetivo | Controles de 40 px. Casilla y radio de 20 px con separación. Mínimo de 24 px | `ui` |
| 3.2.3 Navegación coherente | El menú conserva el orden en todas las páginas | `navegacion.ts` |
| 3.3.1 Identificación de errores | Texto de error con ícono junto al campo | `FormField` |
| 3.3.2 Etiquetas o instrucciones | Etiqueta visible, ayuda y marca de obligatorio | `FormField` |
| 3.3.3 Sugerencia ante errores | Mensajes dicen qué corregir | Login |
| 3.3.7 Entrada redundante | Sin reingreso de datos | Login |
| 3.3.8 Autenticación accesible | `autocomplete` correcto. Pegado permitido. Botón para ver la contraseña | Login |
| 4.1.2 Nombre, función, valor | `aria-invalid`, `aria-describedby`, `aria-current`, `aria-expanded`, `aria-pressed` | `FormField`, `BarraSuperior` |
| 4.1.3 Mensajes de estado | Error del servidor con `role="alert"`. Errores de campo en región `aria-live`. Avisos con Sonner | Login, `FormField` |
| Movimiento reducido | `prefers-reduced-motion` anula animaciones y transiciones | `globals.css` |

## Verificación

- Use anchos E2E de 768, 1024, 1366 y 1920 px, según RNF-08 v9.
- Mantenga pendiente la medición automatizada de superposición.
- `e2e/diseno.spec.ts` ejecuta axe con etiquetas `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` y `wcag22aa`.
- La prueba falla ante una violación crítica o seria.
- Cubre `/login` sin sesión. Cubre `/panel` y `/diseno` con `E2E_DEMO=1`.
- `E2E_BASE_URL` fija la URL. Por defecto usa `http://127.0.0.1:3000`.
- Para las pantallas con sesión, levanta `SC_DEMO_SESION=1 pnpm dev -p 3100`.
- Ejecuta: `E2E_BASE_URL=http://127.0.0.1:3100 E2E_DEMO=1 pnpm exec playwright test e2e/diseno.spec.ts`.

## Galería

`/diseno` muestra tokens, tipografía, botones, formularios, estados, tabla, indicadores, línea de tiempo y componentes interactivos.
Responde 404 en producción.


## GEN-06 Formularios y filtros uniformes — 2026-11-13

Regla vigente: todo bloque de formulario presenta título y descripción encima de los campos en todos los anchos. SeccionFormulario sustituye su antigua columna lateral por un encabezado superior y superficie gris violeta suave. Las entradas mantienen fondo claro y borde visible; los campos calculados usan fondo secundario y resultados diferenciados, también con texto. Se conserva la paleta semántica y el tema oscuro. Las filas editables de tarifas presentan nombre y explicación arriba del control.

Los filtros de opciones se presentan en listas desplegables, con búsqueda para colecciones largas. FiltroSegmentado conserva su contrato interno pero ahora representa un desplegable con etiqueta y conteos. Catálogo usa una única selección de categoría visible en la barra. Búsqueda y fechas siguen siendo controles propios; se mantienen URL, paginación, limpieza y ordenación. Los tabs de navegación no se convierten en filtros.

COT-25 organiza costos en tablas con encabezados, entradas accesibles y desplazamiento local en móvil. BI-01 usa barras 2D, valores visibles y tablas de respaldo; no depende solo del color, del puntero o de animaciones.

## GEN-07 Alineación de controles y marcos — 2026-11-14

Las barras de filtros alinean los controles por su base, de modo que una etiqueta superior no desplace los botones de búsqueda, filtros u orden. Los controles conservan su altura de 40 px y pueden pasar a la siguiente fila en pantallas estrechas. Se aplica a Catálogo, Clientes, Inventario, Cotizaciones, Órdenes, Producción, Reportes y Bitácora.

Los paneles de formulario usan un borde específico más definido, separado del borde de las tablas de consulta: --form-border #a6a0b3 en claro y #68616f en oscuro. Los bloques principales usan 1.5 px; los grupos internos mantienen 1 px con menor intensidad. Se conservan las superficies suaves y se evita dibujar marcos adicionales alrededor de todos los fieldsets. El token border-formulario también se aplica a costos, configuración y productos personalizables.

FormField.compacto conserva la etiqueta accesible y el mensaje de error sin reservar una línea visual para la etiqueta en tablas. Los mensajes quedan debajo del control. COT-26 sustituye la ocultación global por CSS de las etiquetas de tabla por esta presentación explícita; las casillas de materiales conservan su texto visible.

## GEN-08 Responsividad de Usuarios y Trazabilidad — 2026-11-14

Sustituye para estas pantallas la distribución previa basada solo en el ancho del viewport. La ficha de usuario usa el ancho disponible: Acceso pasa debajo cuando no caben cómodamente ambos bloques. Campos, perfiles y acciones se distribuyen mediante mínimos de lectura; los filtros se alinean por la base. Usuarios mantiene tabla en PC y una ficha móvil con correo y perfiles a todo el ancho; conserva nombre, estado, etiquetas y acciones.

Trazabilidad agrupa Desde/Hasta con etiquetas superiores. Más filtros limita su altura al espacio visible, admite desplazamiento interno, tiene nombre accesible y conserva todos los filtros. Las tablas mantienen comparación en PC y desplazamiento horizontal localizado en tableta; en móvil reorganizan las celdas sin quitar información. Cliente/Cotización/ODT y sus datos se distribuyen por el ancho real; material tiene más ancho que las cantidades. El historial y todos sus detalles permanecen visibles: no se aplican recortes, resúmenes sustitutivos ni secciones plegadas. CSS limitado a estos módulos, sin alterar el componente DataTable para el resto del sistema.
