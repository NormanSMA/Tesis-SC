"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { EtapaOrdenDto } from "@/modules/ordenes/tipos";
import { useSolicitudProduccion } from "../useSolicitudProduccion";
import { AvisoProduccion } from "./CamposProduccion";

export function ConfirmarHecho({ etapa, cerrar }: { etapa: EtapaOrdenDto; cerrar: () => void }) {
  const solicitud = useSolicitudProduccion(`hecho-${etapa.id}`);
  async function confirmar() {
    if (await solicitud.enviar({ url: `/api/v1/etapas/${etapa.id}/terminar`, metodo: "POST",
      cuerpo: { version: etapa.actualizadoEn } })) cerrar();
  }
  return <Dialog open onOpenChange={(valor) => !valor && !solicitud.enviando && cerrar()}>
    <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Marcar etapa como hecha</DialogTitle>
      <DialogDescription>{etapa.nombre}. La etapa quedará completada y se habilitará la siguiente.</DialogDescription></DialogHeader>
      <AvisoProduccion {...solicitud} />
      <DialogFooter><Button type="button" variant="outline" disabled={solicitud.enviando} onClick={cerrar}>Volver</Button>
        <Button type="button" disabled={solicitud.enviando} onClick={confirmar}>Confirmar</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
