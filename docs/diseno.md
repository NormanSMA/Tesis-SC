# Sistema de diseño

Describe los tokens, los componentes y las reglas de uso de la interfaz.
Cubre el criterio CF-08 (adaptabilidad) y la accesibilidad WCAG 2.2 AA.

## Decisiones

- Usa shadcn/ui (estilo new-york, base neutral, Tailwind 4) como única base de primitivas.
- Personaliza las primitivas solo con tokens CSS. No hay un segundo sistema.
- Empaqueta Inter con `@fontsource-variable/inter`. El build no depende de internet.
- Usa lucide-react para íconos. No hay emojis.
- Usa solo tema claro. Se eliminaron las variantes `dark:` de las primitivas.
- Usa un color principal azul marino (#1f2a6b) y el dorado de la marca (#c9962f) solo como acento puntual. Los estados usan color más ícono más texto.
- Reemplaza el paquete `cn` que instaló la CLI por `clsx` y `tailwind-merge` en `src/lib/utils.ts`.
- Omite `ui/form.tsx`. `FormField` de `comunes` cubre ese papel con react-hook-form y zod.
- Omite `next-themes`. El tema es fijo.

## Tokens

Los tokens viven en `src/app/globals.css`. Tailwind los expone con `@theme inline`.

### Color

| Token | Valor | Uso |
|---|---|---|
| `--primary` | #1f2a6b | Acción primaria, enlace activo |
| `--primary-hover` | #161f52 | Hover de la acción primaria |
| `--primary-soft` | #eef1fb | Fondo tenue del primario |
| `--primary-soft-border` | #cbd5e1 | Borde tenue del primario |
| `--brand-gold` | #c9962f | Indicador puntual de marca en el menú |
| `--ring` | #1f2a6b | Anillo de foco |
| `--background` | #F8FAFC | Fondo de página |
| `--card` | #FFFFFF | Superficie |
| `--border` | #E2E8F0 | Contorno decorativo |
| `--input` | #64748B | Contorno de controles |
| `--foreground` | #0F172A | Texto |
| `--muted-foreground` | #475569 | Texto secundario |
| `--success` | #15803D | Éxito |
| `--warning` | #B45309 | Advertencia |
| `--danger` | #B91C1C | Peligro y errores |
| `--info` | #1D4ED8 | Información |

Conserve #aab6ec como antecedente de `--primary-soft-border` en la lectura inicial de esta auditoría.
Use #cbd5e1: `globals.css` cambió durante la actualización documental y contiene ese valor.

Cada estado tiene fondo tenue y borde tenue: `--success-soft`, `--warning-soft`, `--danger-soft`, `--info-soft`, `--primary-soft`.
`--neutral-strong` (#334155) pinta el estado Cerrada.

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
| `KpiCard` | Indicador con guion si no hay dato |
| `EmptyState` | Lista o sección sin datos |
| `ErrorState` | Error de carga con acción de reintento |
| `LoadingState` | Esqueleto de carga con `role="status"` |
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
