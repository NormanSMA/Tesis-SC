"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { EtapaOrdenDto } from "@/modules/ordenes/tipos";
import { useSolicitudProduccion } from "../useSolicitudProduccion";
import { AvisoProduccion, MotivoProduccion } from "./CamposProduccion";

export function OmitirEtapa({ etapa, cerrar }: { etapa: EtapaOrdenDto; cerrar: () => void }) {
  const [motivo, setMotivo] = useState("");
  const solicitud = useSolicitudProduccion(`omitir-${etapa.id}`);
  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    if (await solicitud.enviar({ url: `/api/v1/etapas/${etapa.id}/omitir`, metodo: "POST",
      cuerpo: { version: etapa.actualizadoEn, motivo } })) cerrar();
  }
  return <Dialog open onOpenChange={(valor) => !valor && !solicitud.enviando && cerrar()}>
    <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Omitir etapa</DialogTitle>
      <DialogDescription>{etapa.nombre}. Registre el motivo de la omisión.</DialogDescription></DialogHeader>
      <form id={`omitir-${etapa.id}`} onSubmit={guardar} className="space-y-4">
        <AvisoProduccion {...solicitud} /><MotivoProduccion id={`motivo-${etapa.id}`} etiqueta="Motivo"
          valor={motivo} alCambiar={setMotivo} deshabilitado={solicitud.enviando} error={solicitud.campos.motivo} />
        <DialogFooter><Button type="button" variant="outline" disabled={solicitud.enviando} onClick={cerrar}>Volver</Button>
          <Button type="submit" disabled={solicitud.enviando}>Omitir etapa</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
