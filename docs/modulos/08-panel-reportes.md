# Módulo 7: Panel y reportes

Estado: diseño aprobado por el orquestador. Fecha: 2026-10-07.

Actualización documental v9: 2026-10-11.
Aplique los permisos actuales; conserve las auditorías y cifras de cierre como antecedentes.
Use anchos E2E de 768, 1024, 1366 y 1920 px.
Esta actualización no registra una nueva ejecución de pruebas.
Criterios de aceptación: CF-06 (desde el panel se consultan cotizaciones pendientes, materiales disponibles y carga de trabajo). Requerimientos: R-08, R-11. Supuesto S-18 (cuatro reportes y exportación CSV). Apoya CF-08 (diseño adaptable) y CF-09.
Fuentes: tesis V6 secciones 1.7 y 2.6; Anexo C (P6, P7, Tabla C3); Anexo D (A6).
Este módulo solo lee: no agrega migraciones ni escribe datos de negocio. Reutiliza las consultas de los módulos 2 a 5 (cotizaciones, inventario, órdenes, producción).

## Permisos

Consulte [la matriz v9](09-perfiles-v9.md) y `src/core/permisos.ts`.
Combine los permisos cuando el usuario tenga varios perfiles.

| Permiso | Gerencia | Administración | Operaciones | Atención al cliente | Producción | Administración técnica |
|---|---|---|---|---|---|---|
| panel:ver | sí | sí | sí | sí | sí | no |
| reporte:ver | sí | no | no | no | no | no |
| reporte:exportar | sí | no | no | no | no | no |
| cotizacion:ver | sí | sí | sí | sí | no | no |
| inventario:ver | sí | sí | sí | no | no | no |
Cada bloque del panel aparece solo si el perfil tiene el permiso del dato que muestra: cotizaciones con `cotizacion:ver`, materiales con `inventario:ver`, órdenes y carga con `orden:ver` y `produccion:ver`. Sin `cotizacion:ver` no viaja ningún importe en ninguna respuesta del módulo.

## Panel (CF-06, R-08)
GET /api/v1/panel (panel:ver). Pantalla /panel con el mismo diseño de tarjetas KPI y listas. Bloques:
1. Cotizaciones pendientes (con `cotizacion:ver`): cuántas están ENVIADA con vigencia vigente, cuántas vencen en los próximos 3 días, y una lista de las 10 más próximas a vencer (número, cliente, vencimiento, total, enlace). Las ENVIADA ya vencidas se cuentan aparte como "por marcar vencidas".
2. Materiales disponibles (con `inventario:ver`): conteo de materiales activos en alerta y sin existencia, y los 10 en alerta más críticos (existencia contra mínimo, enlace al material). Alerta como en el módulo 4: activo, stock mínimo mayor a 0 y existencia menor o igual al mínimo.
3. Carga de trabajo (con `orden:ver` y `produccion:ver`): órdenes por estado no terminal, etapas abiertas por responsable y por área con las atrasadas (fecha fin planificada pasada), y entregas próximas (fecha de entrega en los siguientes 7 días, ordenadas), con enlaces a la orden. Usa las mismas reglas del tablero del módulo 5 (excluye órdenes terminales).
4. Resumen de la operación: órdenes en producción, órdenes atrasadas (fecha de entrega pasada y no terminal) y entregas próximas.
Fechas con América/Managua. "Hoy" sale del mismo helper que usan órdenes y cotizaciones. El panel se calcula al abrir y tiene un botón "Actualizar" (sin tiempo real).
Estado vacío, error y carga con texto. Cumple WCAG 2.2 AA y 4 viewports. Los KPI muestran un texto, no solo color.

## Reportes (R-11, S-18)
Pantalla /reportes y API GET /api/v1/reportes/<nombre> (reporte:ver). Filtros por periodo (desde y hasta, fecha de Managua) donde aplica. Cuatro reportes:
| Nombre | Contenido | Filtros |
|---|---|---|
| cotizaciones-por-estado | Cantidad e importe por estado, incluido AJUSTE_SOLICITADO. Tasa: aprobadas entre aprobadas más rechazadas | desde, hasta |
| existencias | Cada material con existencia, stock mínimo, costo promedio, valor del inventario (existencia por costo promedio) y estado de alerta, más totales | texto, solo alertas |
| carga-por-operario | Por responsable: etapas pendientes, en curso, completadas en el periodo, atrasadas y órdenes a su cargo | desde, hasta |
| ordenes-por-etapa | Órdenes no terminales agrupadas por la etapa actual (la primera etapa abierta por secuencia), con cantidad y atraso; más órdenes sin etapa abierta (listas para marcar lista o entregar) | área |
Todos devuelven JSON con filas y totales y `generadoEn` (instante ISO). Los importes son cadenas decimales con 2 decimales y el valor de inventario se calcula con la aritmética decimal exacta de src/core/decimal.ts, en una consulta SQL.
Exportación CSV: parámetro `formato=csv` o botón "Exportar CSV" (reporte:exportar). Reglas del CSV: UTF-8 con BOM, separador coma, saltos CRLF, comillas dobles escapadas, encabezados en español con tildes, fechas AAAA-MM-DD y decimales con punto, y protección contra inyección de fórmulas: una celda de texto que empieza con =, +, -, @, tabulador o retorno se antepone con una comilla simple. Nombre de archivo `<reporte>-<AAAAMMDD>.csv`. La exportación no escribe bitácora de negocio pero se registra en el registro de la aplicación (usuario, reporte, filtros).

## API
| Método y ruta | Permiso | Resultado |
|---|---|---|
| GET /api/v1/panel | panel:ver | Bloques permitidos al perfil |
| GET /api/v1/reportes/cotizaciones-por-estado, /existencias, /carga-por-operario, /ordenes-por-etapa | reporte:ver (csv: reporte:exportar) | JSON o CSV |
Errores del formato de AGENTS.md: 401, 403, 404 (reporte desconocido), 422 (fechas inválidas, desde posterior a hasta, periodo mayor a 5 años).

## Pruebas
- Unitarias: serializador CSV (BOM, comillas, saltos, inyección de fórmulas con las cinco cabeceras peligrosas, tildes, decimales), reglas de alerta, cálculo de tasa de aprobación, esquemas zod de periodo.
- Integración: compruebe reportes contra registros con totales conocidos y paneles según permisos.
  Permita panel a cinco perfiles de negocio; restrinja Administración técnica.
  Reserve reportes para Gerencia; oculte cotizaciones e importes a Producción.
  Permita inventario a Gerencia, Administración y Operaciones.
  Compruebe límites de fecha, CSV, valor de inventario y fechas de Managua.
- API por perfil: 401, 403, 404, 422.
- E2E: consulte panel por perfil y enlaces permitidos según la matriz v9.
  Gerencia consulta reportes y descarga CSV; los otros perfiles carecen de reportes.
  Administración técnica carece de panel; Administración tiene acceso al panel.
  Consulte axe, desbordes y capturas CF-06 en cuatro tamaños.

## Cierre del módulo (2026-10-07)
Implementación y E2E: Codex (programar), que agotó su cuota al redactar el informe final; el trabajo estaba completo (typecheck y lint limpios, 98 pruebas del módulo verdes). Verificación: orquestador (un solo verificador).
Medido al cierre de la Fase 3: typecheck y lint limpios; 1417 pruebas unitarias e integración en 79 archivos; E2E completo 544 verdes, 0 fallos, 316 omitidas por diseño.
Correcciones del orquestador a la E2E de Codex (que no pudo ejecutarla): el primer argumento de `beforeEach` debía desestructurarse (Playwright rechazaba el archivo y detenía toda la corrida) y el selector `getByRole('alert')` chocaba con el anunciador de rutas de Next (se acotó).
Cobertura: CF-06, R-08 y R-11 implementados. Jev 0.73 (bajo 0.8): a confirmar con el usuario.
