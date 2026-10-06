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
const CONFIRMACION = {
  entregar: { titulo: "Entregar orden", descripcion: "Registre la entrega de la orden al cliente.", etiquetaConfirmar: "Entregar" },
  cerrar: { titulo: "Cerrar orden", descripcion: "Registre el cierre de la orden entregada.", etiquetaConfirmar: "Cerrar" },
};

export function AccionesOrden({ orden, permisos }: { orden: OrdenDto; permisos: Permisos }) {
  const [accion, setAccion] = useState<"entregar" | "cerrar" | null>(null);
  const solicitud = useSolicitudOrden();
  async function confirmar() {
    if (!accion) return;
    await solicitud.enviar({ url: `/api/v1/ordenes/${orden.id}/${accion}`, metodo: "POST", cuerpo: { version: orden.actualizadoEn } });
    setAccion(null);
  }
  return <div className="space-y-4">
    <AvisoGuardado {...solicitud} />
    <div className="flex flex-wrap gap-3">
      {permisos.gestionar && EDITABLES.includes(orden.estado) ? <Button asChild variant="outline">
        <Link href={`/ordenes/${orden.id}/editar`}>Editar</Link></Button> : null}
      {permisos.entregar && orden.estado === "LISTA" ? <Button type="button" disabled={solicitud.enviando}
        onClick={() => setAccion("entregar")}>Entregar</Button> : null}
      {permisos.cerrar && orden.estado === "ENTREGADA" ? <Button type="button" disabled={solicitud.enviando}
        onClick={() => setAccion("cerrar")}>Cerrar</Button> : null}
      {permisos.cancelar && EDITABLES.includes(orden.estado) ? <CancelarOrden orden={orden} /> : null}
    </div>
    {accion ? <ConfirmDialog abierto alCambiarAbierto={(valor) => !valor && setAccion(null)} {...CONFIRMACION[accion]}
      cargando={solicitud.enviando} alConfirmar={confirmar} /> : null}
  </div>;
}
