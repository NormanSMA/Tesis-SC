"use client";

import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "@/components/comunes/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { EDITABLES } from "../reglas";
import type { OrdenDto } from "../tipos";
import { useSolicitudOrden } from "../useSolicitudOrden";
import { AvisoGuardado } from "./AvisoGuardado";
import { CancelarOrden } from "./CancelarOrden";

type Permisos = { gestionar: boolean; entregar: boolean; cerrar: boolean; cancelar: boolean };
export type PermisosProduccionOrden = { planificar: boolean; ejecutar: boolean; avanzar: boolean };
type Accion = "entregar" | "cerrar" | "lista";
const CONFIRMACION = {
  entregar: { titulo: "Entregar orden", descripcion: "Registre la entrega de la orden al cliente.", etiquetaConfirmar: "Entregar" },
  cerrar: { titulo: "Cerrar orden", descripcion: "Registre el cierre de la orden entregada.", etiquetaConfirmar: "Cerrar" },
  lista: { titulo: "Marcar orden lista", descripcion: "Confirme que la orden está lista para entregar.", etiquetaConfirmar: "Marcar lista" },
};

export function AccionesOrden({ orden, permisos, permisosEtapas }: {
  orden: OrdenDto; permisos: Permisos; permisosEtapas: PermisosProduccionOrden;
}) {
  const [accion, setAccion] = useState<Accion | null>(null);
  const solicitud = useSolicitudOrden();
  const etapasCerradas = orden.etapas.every((etapa) => ["COMPLETADA", "OMITIDA"].includes(etapa.estado));
  const puedeMarcar = etapasCerradas && orden.etapas.some((etapa) => etapa.estado === "COMPLETADA");
  async function confirmar() {
    if (!accion) return;
    await solicitud.enviar({ url: `/api/v1/ordenes/${orden.id}/${accion}`, metodo: "POST", cuerpo: { version: orden.actualizadoEn } });
    setAccion(null);
  }
  const puedeProducir = permisosEtapas.planificar || permisosEtapas.ejecutar || permisosEtapas.avanzar;
  const pedirLista = permisosEtapas.avanzar && orden.estado === "EN_PRODUCCION";
  return <div className="space-y-3">
    <AvisoGuardado {...solicitud} />
    <div className="flex flex-wrap items-center gap-3">
      {puedeProducir && orden.estado === "PENDIENTE" ? <Button asChild><a href="#titulo-etapas">Iniciar producción</a></Button> : null}
      {pedirLista ? <Button type="button" disabled={solicitud.enviando || !puedeMarcar}
        onClick={() => setAccion("lista")}>Marcar lista</Button> : null}
      {permisos.entregar && orden.estado === "LISTA" ? <Button type="button" disabled={solicitud.enviando}
        onClick={() => setAccion("entregar")}>Entregar</Button> : null}
      {permisos.cerrar && orden.estado === "ENTREGADA" ? <Button type="button" disabled={solicitud.enviando}
        onClick={() => setAccion("cerrar")}>Cerrar</Button> : null}
      {permisos.gestionar && EDITABLES.includes(orden.estado) ? <Button asChild variant="outline">
        <Link href={`/ordenes/${orden.id}/editar`}>Editar</Link></Button> : null}
      <Button asChild variant="outline"><Link href={`/trazabilidad/ordenes/${orden.id}`}>Trazabilidad completa</Link></Button>
      {permisos.cancelar && EDITABLES.includes(orden.estado) ? <CancelarOrden orden={orden} /> : null}
    </div>
    {pedirLista && !puedeMarcar ? <p className="text-sm text-muted-foreground">
      Cierre todas las etapas y complete al menos una para marcar la orden lista.</p> : null}
    {pedirLista && puedeMarcar ? <p className="text-sm">Todas las etapas están cerradas. Puede marcar la orden lista.</p> : null}
    {accion ? <ConfirmDialog abierto alCambiarAbierto={(valor) => !valor && setAccion(null)} {...CONFIRMACION[accion]}
      cargando={solicitud.enviando} alConfirmar={confirmar} /> : null}
  </div>;
}
