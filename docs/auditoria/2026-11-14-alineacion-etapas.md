# Verificación de alineación marcos y acciones de etapas

Entrega GEN-07, COT-26 y ORD-10 del 14 de noviembre de 2026, completada y desplegada en la instancia local. Se conservaron los cambios anteriores del repositorio.

## Resultado

- Filtros alineados por la base de sus controles. La etiqueta de Categoría deja de desalinear búsqueda, Más filtros y ordenación. Se aplica el mismo criterio en las barras de los módulos.
- Tablas del cotizador con columnas estables, controles de 40 px, cifras a la derecha y Quitar en columna propia. FormField.compacto conserva las etiquetas accesibles sin reservar espacio visual. Los selectores con nombres largos quedan dentro de su celda; la información y los errores secundarios aparecen debajo de los controles.
- Acciones de etapas como íconos de 40 × 40 px en cuadrícula uniforme, con ayuda al pasar el cursor o recibir foco y nombres accesibles que identifican la etapa. Se conservan las condiciones de accionesDisponibles, los diálogos y las confirmaciones. La presentación se comparte entre ODT y Producción.
- Bordes de formulario específicos más definidos, con jerarquía entre panel principal y grupos internos en claro y oscuro. Se conserva la intensidad de los separadores de tablas de consulta.

## Comprobaciones

| Comprobación | Resultado |
|---|---|
| TypeScript | Aprobado |
| ESLint | Aprobado |
| Compilación de producción | Aprobada |
| Sección Interfaz | 97 pruebas aprobadas; repetida tras ajustar el confinamiento de selectores |
| Pruebas unitarias existentes de acciones, editor y producto configurado | 140 aprobadas |
| Total de pruebas existentes ejecutadas | 237 aprobadas |
| Diff de espacios | Sin errores |

En navegador Edge se compararon las coordenadas de base de búsqueda, categoría, Más filtros y ordenación; los controles coincidieron con tolerancia de 1.5 px. En ambas tablas se comprobaron altura de 40 px y posición superior de los controles por fila. Se comprobó también que permanecen dentro de su celda. Se usaron materiales reales con nombres largos y se confirmó la superficie automática 0.800 m² para 1 × 0.8 m.

Se revisaron las ayudas de íconos por hover y por foco, con cierre mediante Escape. Se abrieron y cerraron los diálogos de asignación, fechas, Hecho y Omitir, sin confirmar cambios. Los botones conservan sus nombres accesibles previos. Las pruebas unitarias mantienen la cobertura de roles, estados y acciones habilitadas.

Se revisaron anchos de 390, 768, 1024, 1366 y 1920 px, desplazamiento local de tablas en móvil, controles mediante teclado, los formularios de Clientes/Inventario/Catálogo/Configuración y los temas claro y oscuro. Axe no reportó infracciones serious/critical y no se observaron errores JavaScript o de consola en la comprobación final.

## Despliegue y datos

Imagen reconstruida; app actualizada con `docker compose up -d --no-deps app`. Salud HTTP 200. Se repitió la verificación sobre 127.0.0.1:3000. No se modificaron esquema, fórmulas, servicios, permisos ni datos de negocio. No hubo migración, siembra ni limpieza de la base. Las interacciones de cotización se realizaron sin guardar y las de etapas sin confirmar; la automatización bloqueó cualquier escritura de negocio desde el navegador. La autenticación creó las sesiones habituales de prueba.

La vista temporal sc-alineacion-qa se ejecutó en 3007 contra los mismos datos, con esa misma restricción de escrituras, y se retiró al desplegar. App, db, db_test y respaldo quedaron activos y saludables. No se tocaron contenedores ajenos. No se hizo commit ni push.

## Documentación

Actualizados diseño, módulos 03/04/06, decisiones, trazabilidad, alineación de tesis y estado compartido. Word con GEN-07, COT-26 y ORD-10 Completado en página 25, revisada visualmente. Copia previa en `../respaldos-locales/word/Registro de cambios antes de GEN-07 COT-26 ORD-10 2026-11-14.docx`. Al no estar disponible LibreOffice para render_docx.py, se exportó desde una instancia oculta propia de Word y se revisó la página con Poppler. La edición final de capturas y texto en la tesis permanece pendiente.

Evidencias: `%TEMP%/tracore-alineacion` (logs, scripts, PDF y PNG); capturas en `docs/capturas/gen07-filtros-alineados.png`, `cot26-tabla-configurada.png`, `cot26-tabla-manual.png`, `cot26-tabla-movil.png`, `ord10-iconos-etapas.png`, `gen07-marcos-claro.png` y `gen07-marcos-oscuro.png`.
