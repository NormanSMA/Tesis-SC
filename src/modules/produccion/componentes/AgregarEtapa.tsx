"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ReferenciaOrden } from "@/modules/ordenes/tipos";
import { useSolicitudProduccion } from "../useSolicitudProduccion";
import { AvisoProduccion, MotivoProduccion, SeleccionProduccion, TextoProduccion } from "./CamposProduccion";

type Propiedades = { orden: { id: string; actualizadoEn: string }; areas: ReferenciaOrden[]; retrabajo?: boolean };

export function AgregarEtapa({ orden, areas, retrabajo = false }: Propiedades) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [areaId, setAreaId] = useState("");
  const [motivo, setMotivo] = useState("");
  const idFormulario = retrabajo ? "retrabajo-orden" : "agregar-etapa";
  const solicitud = useSolicitudProduccion(idFormulario);
  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const cuerpo = retrabajo ? { version: orden.actualizadoEn, areaId, nombre, motivo } : { areaId, nombre };
    if (await solicitud.enviar({ url: `/api/v1/ordenes/${orden.id}/${retrabajo ? "retrabajo" : "etapas"}`,
      metodo: "POST", cuerpo })) { setAbierto(false); setNombre(""); setMotivo(""); setAreaId(""); }
  }
  const titulo = retrabajo ? "Reabrir por retrabajo" : "Agregar etapa";
  return <Dialog open={abierto} onOpenChange={(valor) => !solicitud.enviando && setAbierto(valor)}>
    <Button type="button" variant="outline" disabled={solicitud.enviando} onClick={() => setAbierto(true)}>{titulo}</Button>
    <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{titulo}</DialogTitle>
      <DialogDescription>{retrabajo ? "Reabra la orden y agregue una etapa pendiente." : "Agregue una etapa pendiente al final de la orden."}</DialogDescription>
    </DialogHeader><form id={idFormulario} onSubmit={guardar} className="space-y-4">
      <AvisoProduccion {...solicitud} /><fieldset disabled={solicitud.enviando} className="min-w-0 space-y-4">
        <SeleccionProduccion id={`${idFormulario}-area`} etiqueta="Área" valor={areaId} opciones={areas}
          alCambiar={setAreaId} requerido error={solicitud.campos.areaId} />
        <TextoProduccion id={`${idFormulario}-nombre`} etiqueta="Nombre de la etapa" valor={nombre}
          alCambiar={setNombre} requerido maximo={80} error={solicitud.campos.nombre} />
        {retrabajo ? <MotivoProduccion id={`${idFormulario}-motivo`} etiqueta="Motivo" valor={motivo}
          alCambiar={setMotivo} error={solicitud.campos.motivo} /> : null}
      </fieldset><DialogFooter><Button type="button" variant="outline" disabled={solicitud.enviando} onClick={() => setAbierto(false)}>Volver</Button>
        <Button type="submit" disabled={solicitud.enviando}>{titulo}</Button></DialogFooter>
    </form></DialogContent>
  </Dialog>;
}
