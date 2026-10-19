"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CampoArea } from "@/modules/cotizaciones/componentes/CamposEditor";
import { enfocarError, erroresEsquema } from "@/modules/cotizaciones/useSolicitudCotizacion";
import { esquemaCancelarOrden } from "../schema";
import type { OrdenDto } from "../tipos";
import { useSolicitudOrden } from "../useSolicitudOrden";
import { AvisoGuardado } from "./AvisoGuardado";

export function CancelarOrden({ orden }: { orden: OrdenDto }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const solicitud = useSolicitudOrden("cancelar-orden");
  async function confirmar(evento: FormEvent) {
    evento.preventDefault();
    const cuerpo = { version: orden.actualizadoEn, motivo };
    const validacion = erroresEsquema(esquemaCancelarOrden, cuerpo);
    setErrores(validacion);
    if (Object.keys(validacion).length) { enfocarError("cancelar-orden"); return; }
    if (await solicitud.enviar({ url: `/api/v1/ordenes/${orden.id}/cancelar`, metodo: "POST", cuerpo })) setAbierto(false);
  }
  return <Dialog open={abierto} onOpenChange={(valor) => !solicitud.enviando && setAbierto(valor)}>
    <Button type="button" variant="outline" className="text-rose-700 hover:text-rose-800" onClick={() => setAbierto(true)}>Cancelar orden</Button>
    <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Cancelar {orden.numero}</DialogTitle>
      <DialogDescription>Omita las etapas pendientes. Conserve las etapas iniciadas y los consumos registrados.</DialogDescription></DialogHeader>
      <form id="cancelar-orden" onSubmit={confirmar} noValidate className="space-y-4">
        <AvisoGuardado {...solicitud} />
        <CampoArea id="motivo" etiqueta="Motivo" valor={motivo} requerido error={errores.motivo ?? solicitud.campos.motivo}
          deshabilitado={solicitud.enviando} alCambiar={setMotivo} ayuda="Escriba al menos 5 caracteres." />
        <DialogFooter><Button type="button" variant="outline" disabled={solicitud.enviando} onClick={() => setAbierto(false)}>Volver</Button>
          <Button type="submit" variant="destructive" disabled={solicitud.enviando}>Cancelar orden</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
