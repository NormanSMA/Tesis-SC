"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { EtapaOrdenDto, ReferenciaOrden } from "@/modules/ordenes/tipos";
import { useSolicitudProduccion } from "../useSolicitudProduccion";
import { AvisoProduccion, SeleccionProduccion, TextoProduccion } from "./CamposProduccion";

type Propiedades = { etapa: EtapaOrdenDto; responsables: ReferenciaOrden[]; tipo: "responsable" | "fechas";
  cerrar: () => void };

export function EditarEtapa({ etapa, responsables, tipo, cerrar }: Propiedades) {
  const [responsableId, setResponsableId] = useState(etapa.responsable?.id ?? "");
  const [inicio, setInicio] = useState(etapa.fechaInicioPlan ?? "");
  const [fin, setFin] = useState(etapa.fechaFinPlan ?? "");
  const solicitud = useSolicitudProduccion(`editar-${etapa.id}`);
  const opciones = etapa.responsable && !responsables.some((usuario) => usuario.id === etapa.responsable!.id)
    ? [...responsables, { ...etapa.responsable, nombre: `${etapa.responsable.nombre} (responsable actual)` }] : responsables;
  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const cambios = tipo === "responsable" ? { responsableId: responsableId || null }
      : { fechaInicioPlan: inicio || null, fechaFinPlan: fin || null };
    if (await solicitud.enviar({ url: `/api/v1/etapas/${etapa.id}`, metodo: "PATCH",
      cuerpo: { version: etapa.actualizadoEn, ...cambios } })) cerrar();
  }
  return <Dialog open onOpenChange={(valor) => !valor && !solicitud.enviando && cerrar()}>
    <DialogContent className="sm:max-w-md"><DialogHeader>
      <DialogTitle>{tipo === "responsable" ? "Asignar responsable" : "Planificar fechas"}</DialogTitle>
      <DialogDescription>{etapa.nombre}</DialogDescription></DialogHeader>
      <form id={`editar-${etapa.id}`} onSubmit={guardar} className="space-y-4">
        <AvisoProduccion {...solicitud} /><fieldset disabled={solicitud.enviando} className="min-w-0 space-y-4">
          {tipo === "responsable" ? <SeleccionProduccion id={`responsable-${etapa.id}`} etiqueta="Responsable"
            valor={responsableId} opciones={opciones} vacio="Sin responsable" alCambiar={setResponsableId} error={solicitud.campos.responsableId} />
            : <><TextoProduccion id={`inicio-${etapa.id}`} etiqueta="Inicio planificado" tipo="date" valor={inicio}
              alCambiar={setInicio} error={solicitud.campos.fechaInicioPlan} />
              <TextoProduccion id={`fin-${etapa.id}`} etiqueta="Fin planificado" tipo="date" valor={fin}
                alCambiar={setFin} error={solicitud.campos.fechaFinPlan} /></>}
        </fieldset><DialogFooter>
          <Button type="button" variant="outline" disabled={solicitud.enviando} onClick={cerrar}>Volver</Button>
          <Button type="submit" disabled={solicitud.enviando}>Guardar cambios</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
