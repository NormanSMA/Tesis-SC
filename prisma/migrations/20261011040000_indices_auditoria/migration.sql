-- Auditoria de datos (2026-10-11): claves foraneas sin indice y filtro por fecha de movimientos.
CREATE INDEX "usuario_perfil_asignado_por_id_idx" ON "usuario_perfil"("asignado_por_id");
CREATE INDEX "perfil_permiso_otorgado_por_id_idx" ON "perfil_permiso"("otorgado_por_id");
CREATE INDEX "historial_etapa_responsable_id_idx" ON "historial_etapa"("responsable_id");
CREATE INDEX "movimiento_inventario_creado_en_id_idx" ON "movimiento_inventario"("creado_en", "id");
