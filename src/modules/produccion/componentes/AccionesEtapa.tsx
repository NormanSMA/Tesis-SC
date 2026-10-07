"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { EtapaOrdenDto, ReferenciaOrden } from "@/modules/ordenes/tipos";
import type { EstadoOrden } from "@/generated/prisma/enums";
import { useSolicitudProduccion } from "../useSolicitudProduccion";
import { AvisoProduccion } from "./CamposProduccion";
import { EditarEtapa } from "./EditarEtapa";
import { OmitirEtapa } from "./OmitirEtapa";

export type PermisosEtapas = { planificar: boolean; ejecutar: boolean; avanzar: boolean };
type Propiedades = { etapa: EtapaOrdenDto; estadoOrden: EstadoOrden; permisos: PermisosEtapas;
  responsables?: ReferenciaOrden[]; soloEjecucion?: boolean };

export function AccionesEtapa({ etapa, estadoOrden, permisos, responsables = [], soloEjecucion = false }: Propiedades) {
  const [dialogo, setDialogo] = useState<"responsable" | "fechas" | "omitir" | null>(null);
  const solicitud = useSolicitudProduccion();
  if (!["PENDIENTE", "EN_PRODUCCION"].includes(estadoOrden)) return null;
  const planificar = permisos.planificar && !soloEjecucion;
  const iniciar = permisos.ejecutar && etapa.estado === "PENDIENTE"
    && (estadoOrden !== "PENDIENTE" || permisos.avanzar);
  async function ejecutar(accion: "iniciar" | "completar" | "restaurar") {
    await solicitud.enviar({ url: `/api/v1/etapas/${etapa.id}/${accion}`, metodo: "POST", cuerpo: { version: etapa.actualizadoEn } });
  }
  return <div className="min-w-0 space-y-2 text-left"><AvisoProduccion {...solicitud} />
    <div className="flex flex-wrap gap-2">
      {planificar && etapa.estado !== "COMPLETADA" ? <Button size="sm" variant="outline" disabled={solicitud.enviando}
        aria-label={`Asignar responsable: ${etapa.nombre}`} onClick={() => setDialogo("responsable")}>Asignar</Button> : null}
      {planificar && ["PENDIENTE", "EN_CURSO"].includes(etapa.estado) ? <Button size="sm" variant="outline" disabled={solicitud.enviando}
        aria-label={`Planificar fechas: ${etapa.nombre}`} onClick={() => setDialogo("fechas")}>Fechas</Button> : null}
      {iniciar ? <Button size="sm" disabled={solicitud.enviando} aria-label={`Iniciar: ${etapa.nombre}`}
        onClick={() => ejecutar("iniciar")}>Iniciar</Button> : null}
      {permisos.ejecutar && etapa.estado === "EN_CURSO" ? <Button size="sm" disabled={solicitud.enviando}
        aria-label={`Completar: ${etapa.nombre}`} onClick={() => ejecutar("completar")}>Completar</Button> : null}
      {planificar && etapa.estado === "PENDIENTE" ? <Button size="sm" variant="outline" disabled={solicitud.enviando}
        aria-label={`Omitir: ${etapa.nombre}`} onClick={() => setDialogo("omitir")}>Omitir</Button> : null}
      {planificar && etapa.estado === "OMITIDA" ? <Button size="sm" variant="outline" disabled={solicitud.enviando}
        aria-label={`Restaurar: ${etapa.nombre}`} onClick={() => ejecutar("restaurar")}>Restaurar</Button> : null}
    </div>
    {dialogo === "omitir" ? <OmitirEtapa etapa={etapa} cerrar={() => setDialogo(null)} /> : null}
    {dialogo === "responsable" || dialogo === "fechas" ? <EditarEtapa etapa={etapa} responsables={responsables}
      tipo={dialogo} cerrar={() => setDialogo(null)} /> : null}
  </div>;
}
