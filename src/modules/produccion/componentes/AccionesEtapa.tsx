"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { EtapaOrdenDto, ReferenciaOrden } from "@/modules/ordenes/tipos";
import type { EstadoOrden } from "@/generated/prisma/enums";
import { useSolicitudProduccion } from "../useSolicitudProduccion";
import { AvisoProduccion } from "./CamposProduccion";
import { EditarEtapa } from "./EditarEtapa";
import { OmitirEtapa } from "./OmitirEtapa";
import { accionesDisponibles, type PermisosEtapas } from "./accionesDisponibles";

export type { PermisosEtapas } from "./accionesDisponibles";
type Propiedades = { etapa: EtapaOrdenDto; estadoOrden: EstadoOrden; permisos: PermisosEtapas;
  responsables?: ReferenciaOrden[]; soloEjecucion?: boolean };
type Dialogo = "responsable" | "fechas" | "omitir" | null;

function DialogosEtapa({ dialogo, etapa, responsables, cerrar }: {
  dialogo: Dialogo; etapa: EtapaOrdenDto; responsables: ReferenciaOrden[]; cerrar: () => void;
}) {
  if (dialogo === "omitir") return <OmitirEtapa etapa={etapa} cerrar={cerrar} />;
  if (dialogo === "responsable" || dialogo === "fechas") {
    return <EditarEtapa etapa={etapa} responsables={responsables} tipo={dialogo} cerrar={cerrar} />;
  }
  return null;
}

export function AccionesEtapa({ etapa, estadoOrden, permisos, responsables = [], soloEjecucion = false }: Propiedades) {
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const solicitud = useSolicitudProduccion();
  const acciones = accionesDisponibles({ estadoEtapa: etapa.estado, estadoOrden, permisos, soloEjecucion });
  if (!acciones) return null;
  async function ejecutar(accion: "iniciar" | "completar" | "restaurar") {
    await solicitud.enviar({ url: `/api/v1/etapas/${etapa.id}/${accion}`, metodo: "POST", cuerpo: { version: etapa.actualizadoEn } });
  }
  return <div className="min-w-0 space-y-2 text-left"><AvisoProduccion {...solicitud} />
    <div className="flex flex-wrap gap-2">
      {acciones.asignar ? <Button size="sm" className="h-10" variant="outline" disabled={solicitud.enviando}
        aria-label={`Asignar responsable: ${etapa.nombre}`} onClick={() => setDialogo("responsable")}>Asignar</Button> : null}
      {acciones.fechas ? <Button size="sm" className="h-10" variant="outline" disabled={solicitud.enviando}
        aria-label={`Planificar fechas: ${etapa.nombre}`} onClick={() => setDialogo("fechas")}>Fechas</Button> : null}
      {acciones.iniciar ? <Button size="sm" className="h-10" disabled={solicitud.enviando} aria-label={`Iniciar: ${etapa.nombre}`}
        onClick={() => ejecutar("iniciar")}>Iniciar</Button> : null}
      {acciones.completar ? <Button size="sm" className="h-10" disabled={solicitud.enviando}
        aria-label={`Completar: ${etapa.nombre}`} onClick={() => ejecutar("completar")}>Completar</Button> : null}
      {acciones.omitir ? <Button size="sm" className="h-10" variant="outline" disabled={solicitud.enviando}
        aria-label={`Omitir: ${etapa.nombre}`} onClick={() => setDialogo("omitir")}>Omitir</Button> : null}
      {acciones.restaurar ? <Button size="sm" className="h-10" variant="outline" disabled={solicitud.enviando}
        aria-label={`Restaurar: ${etapa.nombre}`} onClick={() => ejecutar("restaurar")}>Restaurar</Button> : null}
    </div>
    <DialogosEtapa dialogo={dialogo} etapa={etapa} responsables={responsables} cerrar={() => setDialogo(null)} />
  </div>;
}
