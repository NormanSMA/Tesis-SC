-- Rendimiento (2026-10-11): paginacion por (creado_en, id) en cotizaciones y ordenes, y filtro por fecha de respuesta del panel comercial.
CREATE INDEX "cotizacion_creado_en_id_idx" ON "cotizacion"("creado_en", "id");
CREATE INDEX "cotizacion_fecha_respuesta_idx" ON "cotizacion"("fecha_respuesta");
CREATE INDEX "orden_trabajo_creado_en_id_idx" ON "orden_trabajo"("creado_en", "id");
