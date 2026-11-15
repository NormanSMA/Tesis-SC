"use client";

import { useState } from "react";
import { CalendarDays, Check, RotateCcw, SkipForward, UserRoundPlus, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { EtapaOrdenDto, ReferenciaOrden } from "@/modules/ordenes/tipos";
import type { EstadoOrden } from "@/generated/prisma/enums";
import { useSolicitudProduccion } from "../useSolicitudProduccion";
import { AvisoProduccion } from "./CamposProduccion";
import { ConfirmarHecho } from "./ConfirmarHecho";
import { EditarEtapa } from "./EditarEtapa";
import { OmitirEtapa } from "./OmitirEtapa";
import { accionesDisponibles, type PermisosEtapas } from "./accionesDisponibles";

export type { PermisosEtapas } from "./accionesDisponibles";
type Propiedades = { etapa: EtapaOrdenDto; estadoOrden: EstadoOrden; permisos: PermisosEtapas;
  responsables?: ReferenciaOrden[]; soloEjecucion?: boolean };
type Dialogo = "responsable" | "fechas" | "omitir" | "hecho" | null;

function BotonEtapa({ icono: Icono, etiqueta, ayuda, etapa, principal, deshabilitado, alPulsar }: {
  icono: LucideIcon; etiqueta: string; ayuda: string; etapa: string; principal?: boolean;
  deshabilitado: boolean; alPulsar: () => void;
}) {
  return <Tooltip><TooltipTrigger asChild>
    <Button type="button" size="icon" variant={principal ? "default" : "outline"} disabled={deshabilitado}
      aria-label={`${etiqueta}: ${etapa}`} onClick={alPulsar}><Icono aria-hidden="true" className="size-4" /></Button>
  </TooltipTrigger><TooltipContent side="top" sideOffset={6}>{ayuda}</TooltipContent></Tooltip>;
}

function DialogosEtapa({ dialogo, etapa, responsables, cerrar }: {
  dialogo: Dialogo; etapa: EtapaOrdenDto; responsables: ReferenciaOrden[]; cerrar: () => void;
}) {
  if (dialogo === "omitir") return <OmitirEtapa etapa={etapa} cerrar={cerrar} />;
  if (dialogo === "hecho") return <ConfirmarHecho etapa={etapa} cerrar={cerrar} />;
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
  async function ejecutar(accion: "restaurar") {
    await solicitud.enviar({ url: `/api/v1/etapas/${etapa.id}/${accion}`, metodo: "POST", cuerpo: { version: etapa.actualizadoEn } });
  }
  return <TooltipProvider delayDuration={200}><div className="min-w-0 space-y-2 text-left"><AvisoProduccion {...solicitud} />
    <div className="grid w-fit grid-cols-[repeat(2,2.5rem)] gap-2" role="group" aria-label={`Acciones de ${etapa.nombre}`}>
      {acciones.asignar ? <BotonEtapa icono={UserRoundPlus} etiqueta="Asignar responsable" ayuda="Asignar responsable" etapa={etapa.nombre}
        deshabilitado={solicitud.enviando} alPulsar={() => setDialogo("responsable")} /> : null}
      {acciones.fechas ? <BotonEtapa icono={CalendarDays} etiqueta="Planificar fechas" ayuda="Planificar fechas" etapa={etapa.nombre}
        deshabilitado={solicitud.enviando} alPulsar={() => setDialogo("fechas")} /> : null}
      {acciones.hecho ? <BotonEtapa icono={Check} etiqueta="Hecho" ayuda="Marcar etapa como hecha" etapa={etapa.nombre} principal
        deshabilitado={solicitud.enviando} alPulsar={() => setDialogo("hecho")} /> : null}
      {acciones.omitir ? <BotonEtapa icono={SkipForward} etiqueta="Omitir" ayuda="Omitir etapa" etapa={etapa.nombre}
        deshabilitado={solicitud.enviando} alPulsar={() => setDialogo("omitir")} /> : null}
      {acciones.restaurar ? <BotonEtapa icono={RotateCcw} etiqueta="Restaurar" ayuda="Restaurar etapa" etapa={etapa.nombre}
        deshabilitado={solicitud.enviando} alPulsar={() => ejecutar("restaurar")} /> : null}
    </div>
    <DialogosEtapa dialogo={dialogo} etapa={etapa} responsables={responsables} cerrar={() => setDialogo(null)} />
  </div></TooltipProvider>;
}
