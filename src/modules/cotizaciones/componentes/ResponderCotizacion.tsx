"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { esquemaResponder, type EntradaResponder } from "../schema";
import type { CotizacionDto } from "../tipos";
import { enfocarError, erroresEsquema, useSolicitudCotizacion } from "../useSolicitudCotizacion";
import { AvisoGuardado } from "./AvisoGuardado";
import { CampoArea } from "./CamposEditor";

type Resultado = EntradaResponder["resultado"];
const TITULO = { APROBADA: "Aprobar cotización", RECHAZADA: "Rechazar cotización", VENCIDA: "Marcar vencida" };

export function ResponderCotizacion({ cotizacion, hoy }: { cotizacion: CotizacionDto; hoy: string }) {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [motivo, setMotivo] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const solicitud = useSolicitudCotizacion("responder-cotizacion");
  const vigente = Boolean(cotizacion.fechaVencimiento && hoy <= cotizacion.fechaVencimiento);
  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const cuerpo = { version: cotizacion.actualizadoEn, resultado, motivo };
    const validacion = erroresEsquema(esquemaResponder, cuerpo);
    setErrores(validacion);
    if (Object.keys(validacion).length) { enfocarError("responder-cotizacion"); return; }
    await solicitud.enviar({ url: `/api/v1/cotizaciones/${cotizacion.id}/responder`, metodo: "POST", cuerpo });
  }
  return <>
    <Button type="button" disabled={!vigente} onClick={() => setResultado("APROBADA")}>Aprobar</Button>
    <Button type="button" variant="outline" onClick={() => setResultado("RECHAZADA")}>Rechazar</Button>
    {!vigente ? <Button type="button" variant="outline" onClick={() => setResultado("VENCIDA")}>Marcar vencida</Button> : null}
    <Dialog open={Boolean(resultado)} onOpenChange={(abierto) => !abierto && !solicitud.enviando && setResultado(null)}>
      <DialogContent><DialogHeader>
        <DialogTitle>{resultado ? TITULO[resultado] : "Responder cotización"}</DialogTitle>
        <DialogDescription>Registre la respuesta del cliente. El estado resultante será definitivo.</DialogDescription>
      </DialogHeader>
        <form id="responder-cotizacion" onSubmit={guardar} noValidate className="space-y-4">
          <AvisoGuardado {...solicitud} />
          {resultado === "RECHAZADA" ? <CampoArea id="motivo" etiqueta="Motivo del rechazo" requerido valor={motivo}
            error={errores.motivo ?? solicitud.campos.motivo} alCambiar={setMotivo} /> : null}
          <DialogFooter><Button type="button" variant="outline" disabled={solicitud.enviando} onClick={() => setResultado(null)}>Cancelar</Button>
            <Button type="submit" disabled={solicitud.enviando}>{resultado ? TITULO[resultado] : "Guardar"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
