# GEN-08 — Responsividad de Usuarios y Trazabilidad

Fecha: 2026-11-14 · Codex · Estado: Completado y desplegado en la instancia local.

## Alcance autorizado y conservación del contenido

El usuario autorizó aplicar el análisis previo y precisó que se corrija solamente responsividad, sin eliminar contenido. Se modifican estilos y distribución de los componentes de Usuarios y Trazabilidad; se agrega un nombre accesible al panel de filtros.

Se conservan todas las columnas, etiquetas, correos, perfiles, campos de edición, fechas, cantidades, importes, responsables, detalles, enlaces, filtros, paginación y eventos. La línea de tiempo completa permanece visible. No se implementó la alternativa de detalles plegables propuesta en el análisis: el contenido permanece abierto. Los estilos están confinados a dos módulos CSS, sin alterar DataTable, Timeline ni el sistema de estilos del resto de los módulos.

No se cambian servicios, API, esquema, cálculos, datos de negocio ni permisos. Los cambios de estado y confirmaciones de cuentas mantienen sus controladores existentes.

## Implementación

- Usuarios: filtros alineados por su base; columnas de tabla con ancho de lectura y mayor espacio para correo; desplazamiento local en tableta. En móvil se mantienen nombre y estado arriba y correo/perfiles a todo el ancho, con todas sus etiquetas.
- Edición y alta de usuarios: campos y perfiles ajustados por ancho útil. La ficha coloca Acceso debajo cuando no caben cómodamente los bloques. Datos y botones de acceso se distribuyen según su propio espacio.
- Trazabilidad: Desde/Hasta juntos, etiquetas superiores y acciones alineadas. Más filtros usa el alto disponible de Radix y de la ventana, margen de 16 px y desplazamiento interno. Conserva todos sus campos y tiene nombre accesible.
- Bitácora: tabla con anchos por contenido en PC y desplazamiento local en tableta. En móvil, fecha/usuario y acción/estado comparten fila; entidad/registro y detalle usan todo el ancho. No se acorta ningún texto.
- Trazabilidad completa: tarjetas y datos según ancho disponible, mayor espacio para nombre de material y celdas reorganizadas en móvil. Todas las fechas, cantidades y costos previamente autorizados permanecen disponibles.

## Verificaciones

| Comprobación | Resultado |
|---|---|
| TypeScript | Aprobado; repetido tras el ajuste final. |
| ESLint | Aprobado; repetido tras el ajuste final. |
| Interfaz | 97 pruebas existentes en cinco archivos aprobadas; repetidas tras el ajuste final. |
| Compilación de producción | Imagen construida correctamente con Next.js 16.4.1; compilación y comprobación de tipos aprobadas. |
| Contenido renderizado | Texto de `main` capturado antes y comparado después en cinco pantallas y ocho anchos: idéntico. La bitácora se filtró por una ODT estable para que los nuevos inicios de sesión no alteraran la comparación. La comparación de texto no incluye valores de inputs; se conservaron sus registros y bindings existentes sin modificaciones. |
| Redistribución | 320, 390, 640, 768, 1024, 1280, 1366 y 1920 px: 40 casos, sin desbordamiento horizontal de página. El desplazamiento local de tablas es intencional. |
| Filtros por altura | 320 × 844, 390 × 844, 844 × 390, 1366 × 600 y 1366 × 768: panel dentro de la pantalla con margen, último campo accesible mediante foco, Escape y retorno del foco al botón. |
| Teclado y tablas | A 768 px, regiones desplazables enfocables, flecha derecha desplaza la tabla y la última columna resulta accesible. Confirmación de reinicio de clave abierta y cerrada sin confirmar. |
| Axe | Sin infracciones serious/critical observadas: cinco vistas base en móvil y PC, panel de filtros en cinco tamaños y cuatro vistas en oscuro. El aviso `aria-dialog-name` del panel quedó resuelto. |
| Temas | Claro y oscuro comprobados; capturas revisadas de lista/edición de usuario, filtros, bitácora y detalle de trabajo. |
| Consola y red | Cero errores JavaScript/de consola y cero respuestas HTTP >=400 observadas durante la verificación final automatizada. Cero escrituras de negocio intentadas desde el navegador. |

La comprobación de retorno de foco cubre Más filtros. La confirmación de cuentas conserva su gestión del foco anterior, fuera de esta modificación de responsividad; no se cambió su funcionamiento. La verificación se realizó con Edge y datos actuales, no constituye una certificación de todos los navegadores o combinaciones de información.

`pnpm test:seccion interfaz` encontró el problema local ya conocido del gestor pnpm solicitado pero no instalado. Se ejecutó directamente el alias existente `pnpm check:interfaz`, que cubre los mismos cinco archivos y sus 97 pruebas. Tipos y lint usaron sus aliases existentes. No se modificaron versiones ni configuración de herramientas.

## Despliegue y recursos

Imagen reconstruida y app actualizada mediante `docker compose up -d --no-deps app`. Salud HTTP 200. La comprobación final completa se ejecutó sobre 127.0.0.1:3000. App, db, db_test y respaldo saludables al cierre. No se ejecutaron migraciones, semillas o limpieza de datos. Las autenticaciones de verificación generan las sesiones y eventos de seguridad habituales.

El contenedor temporal sc-responsividad-qa en 3007 se usó en la primera revisión y fue retirado. No se creó otra base de datos. Se conservaron contenedores ajenos, volúmenes y trabajo previo sin commit. Sin commit/push.

## Documentación y evidencias

Actualizados diseño, módulos 07/10, decisiones, trazabilidad, alineación de tesis y estado compartido. GEN-08 Completado en el Word, página 26. Respaldo previo: `../respaldos-locales/word/Registro de cambios antes de GEN-08 2026-11-14-023422.docx`.

Se intentó render_docx.py; el entorno carece de LibreOffice. Se exportó desde una instancia oculta propia de Word, se cerró y se renderizaron las 26 páginas con Poppler. Página 26 revisada visualmente; las 25 páginas anteriores son idénticas píxel por píxel a su render previo y conservan el mismo texto. El registro anterior se preservó íntegro. Texto y capturas finales de la tesis siguen pendientes.

Evidencias locales: `%TEMP%/tracore-responsividad/` (scripts, logs, contenido previo, `verificacion-gen08.json`, `teclado-gen08.json`, render y comparación del Word). Capturas de entrega con prefijo `gen08-` en `docs/capturas/`.
