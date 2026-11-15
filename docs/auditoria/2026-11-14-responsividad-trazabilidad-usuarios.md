# Análisis de responsividad: Trazabilidad y Usuarios

Fecha: 2026-11-14 · Codex · Estado: análisis terminado; recomendaciones sin implementar.

Seguimiento posterior: el usuario autorizó las correcciones conservando todo el contenido. Implementadas como GEN-08; ver [auditoría de la entrega](2026-11-14-responsividad-gen08.md). Este documento conserva el diagnóstico previo. La alternativa de detalles plegables no se aplicó: todos los textos e historial permanecen visibles.

## Alcance y método

Revisión solicitada con prioridad de uso en PC. Lectura de componentes y navegación en la instancia real de TRACORE en 3000 con Gerencia, usando Edge/Playwright. Sin editar la aplicación, cambiar reglas, confirmar acciones de cuentas ni guardar datos de negocio. El inicio de sesión genera su registro normal de seguridad.

- 119 mediciones de distribución: 60 en las cinco pantallas de foco, 50 de revisión general y nueve en variantes de tamaño para interacciones.
- Foco: lista de Usuarios, edición de usuario, alta de usuario, bitácora global y trazabilidad completa de una ODT real.
- Anchos del foco: 320, 360, 390, 640, 767, 768, 1024, 1279, 1280, 1366, 1536 y 1920 píxeles CSS. Interacciones adicionales en 390 × 844, 844 × 390 y 1366 × 768.
- Revisión geométrica general de Panel, Clientes, Catálogo, Cotizaciones, alta de cotización, Órdenes, Producción, Inventario, Reportes y Perfiles y permisos en cinco anchos. No equivale a probar cada formulario o flujo de estos módulos.
- Capturas revisadas de Usuarios móvil y PC; ficha de usuario a 1024/1280; Trazabilidad móvil/tableta; detalle de ODT a 1280; filtros en horizontal. Diálogos de reinicio de clave abiertos y cerrados sin confirmar.
- Ningún desbordamiento horizontal de la página en las 119 mediciones; ningún error JavaScript de página observado. Esto no certifica todas las combinaciones de datos, navegadores ni accesibilidad.
- Axe repetido con animaciones terminadas: sin infracciones en las vistas base de Usuarios, su ficha y Trazabilidad a 390 px. El panel abierto de filtros sí presenta `aria-dialog-name`: falta un nombre accesible. Los avisos iniciales de contraste durante el cierre animado no se reprodujeron con la interfaz estable.
- Confirmación adicional de altura del panel, independiente de las 119 mediciones: 320 × 844, 390 × 844, 844 × 390, 1366 × 600 y 1366 × 768. A 1366 × 600 llega hasta y = 730, por debajo del borde visible de la ventana.

Evidencias y scripts locales: `%TEMP%/tracore-responsividad/` (`mediciones.json`, `confirmacion.json`, capturas y scripts). No contienen contraseñas copiadas. El script de navegación impidió escrituras de negocio por API; solo se permitió la autenticación.

## Diagnóstico

La base responde correctamente: menú móvil, barra lateral compacta en tableta, formularios apilados y tablas convertidas a fichas. No se justifica rediseñar todo el sistema. Hay un fallo concreto de altura en filtros y varios puntos donde la adaptación conserva los datos pero dificulta leerlos o compararlos.

| Prioridad | Pantalla | Evidencia e impacto | Recomendación |
|---|---|---|---|
| Alta | Trazabilidad: Más filtros | Con 844 × 390, el panel estable mide 320 × 432 px y comienza en y = −134: parte de los filtros queda fuera de pantalla. También supera el borde inferior con una ventana de PC de 1366 × 600. Tiene `max-height: none` y `overflow-y: visible`. El límite de ancho existente no resuelve la altura. | Limitar el alto según el espacio visible, habilitar desplazamiento interno y asegurar acceso a todos los controles con ratón, tacto y teclado. Agregar título/nombre accesible. En móvil puede usarse un panel lateral o inferior con el mismo contenido. |
| Media | Usuarios: filtros | En PC la búsqueda queda más alta que Estado y Perfil; su contenedor usa alineación central aunque los selectores tienen etiqueta encima. | Alinear los controles por su base; usar una distribución que mantenga juntos los filtros y permita saltos de fila previsibles. |
| Media | Usuarios: tabla y fichas móviles | A 1366 px la columna de perfiles ocupa bastante espacio y el correo se divide incluso con espacio global disponible. A 390 px, la etiqueta a la izquierda y el valor a la derecha hacen que algunos correos terminen con una sola letra en la línea siguiente. | En PC dar más ancho útil al correo y limitar la expansión de perfiles. En móvil mostrar nombre y estado como cabecera; debajo, correo y perfiles a todo el ancho, alineados a la izquierda. Mantener acceso al texto completo. |
| Media | Usuarios: ficha de edición | Desde 1024 px se combinan formulario de dos tercios y Acceso de un tercio; dentro, nombre/correo y tarjetas de perfiles vuelven a dividirse en dos columnas. Los campos rondan 276 px a 1024; se lee solo parte del correo sin desplazarlo. Es una limitación de comodidad, no pérdida del valor guardado. | Decidir las columnas por el ancho disponible del bloque. Priorizar el formulario y colocar Acceso debajo cuando se comprima; permitir nombre y correo a todo el ancho en ese intervalo. Evitar que las tarjetas de perfiles se estrechen por cuadrículas anidadas. |
| Media | Trazabilidad: filtros principales | A 768 px Desde queda junto al buscador y Hasta pasa a otra fila. En móvil las fechas, Más filtros y ordenamiento quedan repartidos sin una agrupación clara. | Etiquetas sobre los campos, Desde/Hasta agrupados, búsqueda a todo el ancho cuando corresponda y acciones en una fila coherente. Conservar filtros en la URL. |
| Media | Trazabilidad: bitácora | A 768 px las cuatro columnas se conservan pero obligan a partir nombres y textos. A 390 px cada evento muestra cuatro bloques completos: la página medida con 20 eventos alcanza unos 5778 px. | Mantener tabla legible en PC; distribuir columnas según contenido. En móvil, resumen de evento con fecha, actor y acción, seguido de registro; detalle ampliable mediante una acción explícita. Conservar toda la información y la paginación. La longitud por sí sola no es un fallo funcional. |
| Media | Trazabilidad completa | Bajo 1280 px las tarjetas Cliente/Cotización/ODT se apilan; desde 1280 pasan de golpe a tres columnas. A 1280 la cabecera ocupa unos 580 px de alto. La tabla de seis columnas da al nombre del material un ancho parecido al de una cantidad. | Resumen inicial con datos esenciales y bloques secundarios ampliables; columnas por ancho real del contenido. Reservar más espacio al material y menos a números. Adaptar tablas y cronología sin ocultar datos por defecto de forma irrecuperable. |

## Criterio para una mejora profesional

1. Mantener PC como vista principal: tablas comparables, campos cómodos y acciones claras. No reducir letras ni controles para hacer caber la versión de escritorio en móvil.
2. Usar el ancho disponible del componente para decidir columnas; los saltos actuales de barra lateral (64 a 256 px en 1280) también cambian ese espacio.
3. En móvil, simplificar la presentación y permitir ampliar detalles; conservar permisos, enlaces y datos. No alterar la información de auditoría para abreviar la pantalla.
4. Para tablas complejas, aceptar desplazamiento horizontal dentro del propio bloque cuando mejore la comparación. El criterio de redistribución de [W3C](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) contempla excepciones para contenido que requiere disposición bidimensional; esto no justifica desbordar toda la página.
5. Resolver la altura de paneles además del ancho: móviles horizontales y ventanas de PC bajas son casos reales.

## Orden propuesto de implementación y aceptación

Primero corregir el panel de filtros y su nombre accesible; después Usuarios (barra, columnas, ficha móvil y edición); finalmente Trazabilidad (filtros, resumen de eventos y detalle de trabajo). Mantener los estilos actuales de marcos y botones.

Aceptar la entrega solo al comprobar: sin desbordamiento de página a 320/390/768/1024/1280/1366/1920; filtros completamente accesibles también con poca altura; correos y perfiles completos consultables; controles alineados; recorrido de teclado y retorno de foco; mismos permisos y datos; temas claro/oscuro; tipos, lint, pruebas de Interfaz y compilación correspondientes al cambio. No guardar pruebas de negocio en la base real.

No se asignaron códigos de cambio funcional ni se marcaron mejoras como Completado en el Word: esta entrega documenta un análisis, no una implementación.
