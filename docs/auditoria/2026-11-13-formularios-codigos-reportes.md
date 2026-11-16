# Verificación de formularios códigos fotos y reportes

Entrega GEN-06, COT-25, INV-12, CAT-05 y BI-01. Fecha: 2026-11-13. Implementación, pruebas y despliegue local completados; sin commit ni push. Se conservaron los cambios que ya estaban en la carpeta.

## Resultado

- Formularios con encabezado superior, superficies diferenciadas y contraste corregido también en las ayudas del logo del cliente.
- Materiales y servicios en tablas editables, con superficie automática y desplazamiento local en móvil.
- Códigos cortos generados en el servidor, secuencias atómicas, estabilidad al reclasificar y búsqueda/importación por códigos anteriores.
- Foto opcional de inventario privada, validada y recodificada, guardada con versión y auditoría dentro de la misma transacción.
- Filtros desplegables y cuatro reportes con barras 2D, tablas y definición del alcance temporal y monetario de los indicadores.

## Datos y despliegue

Migración `20261113160000_codigos_fotos` ensayada en una copia y aplicada a la base real. Respaldo inmediato previo: `../respaldos-locales/bd/tracore-antes-codigos-fotos-20261113-1641.dump`, 303474 bytes. También se conservó la copia inicial `tracore-antes-erp-ui-20261113.dump`.

304 materiales y 115 productos renumerados; 419 eventos de correspondencia en bitácora. Se compararon antes/después las huellas de todas las filas de material y producto excluyendo únicamente códigos, alias y versión, y las filas completas de cotización, item_cotizacion, linea_costo, orden_trabajo y movimiento_inventario. Los siete conjuntos coincidieron: se conservaron costos, cantidades, UUID, relaciones y documentos existentes. Las pruebas con datos nuevos se hicieron en la copia QA, sin poblar la base real con esas pruebas.

App de producción reconstruida y comprobada en 127.0.0.1:3000; salud HTTP 200. App, db, db_test y respaldo healthy. Contenedor sc-erp-ui-qa y base sc_erp_ui_qa retirados; otros contenedores y volúmenes conservados.

## Comprobaciones

| Sección | Pruebas aprobadas |
|---|---:|
| Inventario | 239 |
| Catálogo | 179 |
| Cotizaciones | 394 |
| Analítica | 473 |
| Clientes e importación | 297 |
| Interfaz | 97 |
| Total | 1679 |

TypeScript, ESLint y compilación de producción aprobados. Las pruebas nuevas verifican códigos simultáneos, código estable al cambiar de área, alias, procesamiento y eliminación de fotos, versión vieja, reversión ante fallo de bitácora, permisos y agrupaciones de gráficos sin mezclar cantidades incompatibles. Se actualizaron las expectativas de importación/exportación y del filtro de vista conforme al nuevo comportamiento.

Durante el desarrollo se corrigió la devolución SQL de un bloqueo advisory que Prisma no deserializaba como void. Una primera corrida de Cotizaciones abortó su preparación por timeout de conexión; la sección completa se repitió y aprobó las 394 pruebas, sin omitir casos. Se corrigió el desborde de etiquetas accesibles de tabla al fijar su bloque contenedor y el contraste de dos ayudas de Clientes sobre el nuevo fondo. La sección Interfaz volvió a aprobar tras el ajuste de contraste.

Navegador Edge sobre copia: alta de material con foto desde el formulario, miniatura y ficha, códigos automáticos y cinco altas simultáneas de catálogo, reclasificación estable, producto configurado con dos materiales en m², cantidades automáticas 0.800, captura manual adicional, costo C$185 y guardado/recarga, filtros y cuatro reportes. Revisión de 390/768/1440 px, teclado, modo oscuro y axe sin infracciones serious/critical ni errores JavaScript o respuestas 5xx observadas.

Instancia real: códigos y búsqueda por alias; formularios de Inventario, Catálogo, Clientes y Cotizaciones; cuatro reportes y opción Sin responsable del desplegable de Órdenes. Revisión de 390/768/1024/1366/1920 px, axe sin infracciones serious/critical y sin errores JavaScript observados. Solo lecturas de negocio; la autenticación creó su sesión habitual.

## Revisión de dependencias

`pnpm audit:security` finaliza con código 0 al umbral crítico: 0 CRITICAL, 3 HIGH, 4 MODERATE y 2 LOW. No se cambiaron dependencias en esta entrega. Los hallazgos no críticos requieren revisión aparte antes del despliegue definitivo.

Trivy 0.76 escaneó sin `--ignore-unfixed` la imagen `sha256:d8a5598d70bc4422fb2214516eb57f270881c52bcc9efdab780edbb91d9a4ab8`, anterior al último ajuste de edición de descripciones y con las mismas dependencias de la entrega: el reporte bruto contiene una alerta CRITICAL, CVE-2023-45853 en zlib1g 1:1.2.13.dfsg-1, ya registrada históricamente en ADR-015. No se silenció ni se presenta el reporte bruto como libre de alertas. Se verificó que el código afectado no está presente en los binarios instalados: Debian indica que esa versión de zlib no compila contrib/minizip y que sus paquetes binarios no están afectados. La imagen contiene libz.so y no contiene archivos de minizip en /usr o /app. Fuente primaria: [seguimiento de Debian para CVE-2023-45853](https://security-tracker.debian.org/tracker/CVE-2023-45853). Esta evaluación corresponde a esa imagen y paquete concretos; debe revisarse si cambia la base o se incorpora minizip.

El análisis de importaciones informa 0 violaciones de capa y dos ciclos de tipos preexistentes en Cotizaciones/Personalizadas e Instalación. Esta entrega no incorpora aristas a esos ciclos.

## Documentación y evidencias

Word: cinco entradas Completado, páginas 23 y 24 revisadas visualmente, conservando el formato anterior. Copia previa en `../respaldos-locales/word/Registro de cambios antes de GEN-06 COT-25 INV-12 CAT-05 BI-01 2026-11-13.docx`. `render_docx.py` no encontró LibreOffice; se utilizó Word COM en instancia oculta para exportar PDF y Poppler para revisar ambas páginas, sin modificar las sesiones del usuario.

Capturas: `docs/capturas/cotizaciones-costos-tabla.png`, `cotizaciones-costos-movil.png`, `inventario-foto-opcional.png`, `reportes-graficos-2d.png` y `reportes-graficos-oscuro.png`. Las de cotizaciones y foto usan datos explícitos de QA. Evidencias detalladas, logs, PDF y reportes de integridad/Trivy en `%TEMP%/tracore-erp-ui`.

La tesis conserva pendientes los ajustes señalados en cada entrada. Continúan fuera de esta entrega la geometría por componente, equivalencias de materiales, reservas y avisos de abastecimiento.
