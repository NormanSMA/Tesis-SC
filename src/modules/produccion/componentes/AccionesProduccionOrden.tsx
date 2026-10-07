"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/comunes/ConfirmDialog";
import type { OrdenDto, ReferenciaOrden } from "@/modules/ordenes/tipos";
import { useSolicitudProduccion } from "../useSolicitudProduccion";
import type { PermisosEtapas } from "./AccionesEtapa";
import { AgregarEtapa } from "./AgregarEtapa";
import { AvisoProduccion } from "./CamposProduccion";

export function AccionesProduccionOrden({ orden, areas, permisos }: {
  orden: Pick<OrdenDto, "id" | "actualizadoEn" | "estado" | "etapas">; areas: ReferenciaOrden[]; permisos: PermisosEtapas;
}) {
  const [confirmarLista, setConfirmarLista] = useState(false);
  const solicitud = useSolicitudProduccion();
  const todasCerradas = orden.etapas.every((etapa) => ["COMPLETADA", "OMITIDA"].includes(etapa.estado));
  const tieneTrabajo = orden.etapas.some((etapa) => etapa.estado === "COMPLETADA");
  const puedeMarcar = orden.estado === "EN_PRODUCCION" && todasCerradas && tieneTrabajo;
  async function marcarLista() {
    await solicitud.enviar({ url: `/api/v1/ordenes/${orden.id}/lista`, metodo: "POST", cuerpo: { version: orden.actualizadoEn } });
    setConfirmarLista(false);
  }
  return <div className="space-y-3"><AvisoProduccion {...solicitud} />
    {permisos.avanzar && puedeMarcar ? <p className="text-sm">Todas las etapas están cerradas. Puede marcar la orden lista.</p> : null}
    <div className="flex flex-wrap gap-3">
      {permisos.planificar && ["PENDIENTE", "EN_PRODUCCION"].includes(orden.estado)
        ? <AgregarEtapa orden={orden} areas={areas} /> : null}
      {permisos.avanzar && orden.estado === "EN_PRODUCCION" ? <Button type="button"
        disabled={solicitud.enviando || !puedeMarcar} onClick={() => setConfirmarLista(true)}>Marcar lista</Button> : null}
      {permisos.avanzar && orden.estado === "LISTA" ? <AgregarEtapa orden={orden} areas={areas} retrabajo /> : null}
    </div>
    {permisos.avanzar && orden.estado === "EN_PRODUCCION" && !puedeMarcar ? <p className="text-sm text-muted-foreground">
      Cierre todas las etapas y complete al menos una para marcar la orden lista.</p> : null}
    {confirmarLista ? <ConfirmDialog abierto alCambiarAbierto={setConfirmarLista} titulo="Marcar orden lista"
      descripcion="Confirme que la orden está lista para entregar." etiquetaConfirmar="Marcar lista"
      cargando={solicitud.enviando} alConfirmar={marcarLista} /> : null}
  </div>;
}
