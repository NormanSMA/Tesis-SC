# Fichas y formularios (estilo Mise)

Patrón para las subrutas: detalle (`[id]`), edición (`[id]/editar`), alta (`nuevo`/`nueva`) y acciones (entrada, ajuste, consumo, devolución).
Las listas raíz ya siguen el patrón de `docs/diseno.md`.

## Piezas comunes (`src/components/comunes/`)
- `CabeceraFicha`: h1, `marca` (AvatarIniciales `size-12`, `MarcaIcono` o ilustración), `meta` (código, EstadoBadge, uno o dos datos) y `acciones`.
- `TarjetaSeccion`: tarjeta blanca con cabecera fina (título, descripción, acción secundaria). `sinRelleno` para tablas.
- `ListaDatos`: rejilla etiqueta/valor (`dt` slate-500 text-xs, `dd` text-sm font-medium). Vacío = "—".
- `SeccionFormulario` + `CuerpoFormulario`: bloques de dos columnas desde lg (texto a la izquierda, campos en tarjeta a la derecha).
- `PieFormulario`: barra fija al pie con "Cancelar" y la acción principal a la derecha.
- Ya existentes: `TarjetaMetrica` + `BandejaMetricas`, `EstadoBadge`, `DataTable`, `BarraProgresoAnimada`, `AnilloProgreso`, `FormField`, `EmptyState`.

## Ficha de detalle
1. `CabeceraFicha` con `volver` a la lista. En la barra superior ya está la sección: no repetir migas en el cuerpo.
2. Una acción principal (botón relleno navy). Las demás en `variant="outline"`. Acciones peligrosas (archivar, cancelar) al final, en outline con texto rose, o en un menú "Más" (`DropdownMenu`) si son más de tres.
3. Bento debajo: `grid gap-4 lg:grid-cols-3`. Columna ancha (`lg:col-span-2`) con datos y tablas; columna angosta con resumen numérico, estado y siguiente paso.
4. Si hay cifras clave (total, avance, existencia), `BandejaMetricas` arriba del bento, máximo 4 tarjetas.
5. Pestañas solo si ya existen. Estilo subrayado navy como en Inventario.
6. Secciones plegables (`details`) para información secundaria (costos internos, historial largo).

## Formulario de alta o edición
1. `CabeceraFicha` con `volver` a la ficha o a la lista; título "Nuevo cliente" o "Editar <código>".
2. `CuerpoFormulario` con 1 a 4 `SeccionFormulario` (Identificación, Contacto, Condiciones…). Campos en `grid gap-4 sm:grid-cols-2`.
3. `PieFormulario` con Cancelar (outline) y Guardar (relleno). Quitar los botones sueltos del final.
4. Conservar etiquetas, `name`, `id`, validaciones, mensajes y nombres accesibles: las pruebas E2E los usan.
5. Formularios cortos (1 sección, menos de 5 campos): sin columna izquierda; tarjeta `max-w-2xl` centrada.

## Reglas
- Canvas slate-50, tarjetas `rounded-xl border-border/80 shadow-sm`, títulos de tarjeta `text-base font-semibold`.
- Animaciones solo `opacity`/`transform`, 100–200 ms. Nada de colores nuevos: usar los tokens.
- Validar en 1366, 768 y 390: sin desborde horizontal, botones a todo el ancho en móvil.
- Sin cambios de lógica, rutas, permisos ni API. Solo presentación.
