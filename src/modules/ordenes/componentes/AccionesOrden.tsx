"use client";

import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "@/components/comunes/ConfirmDialog";
import { Button } from "@/components/ui/button";
import type { OrdenDto } from "../tipos";
import { useSolicitudOrden } from "../useSolicitudOrden";
import { AvisoGuardado } from "./AvisoGuardado";
import { CancelarOrden } from "./CancelarOrden";
import { accionesDisponibles, type PermisosOrden, type PermisosProduccionOrden } from "./accionesDisponibles";

export type { PermisosProduccionOrden } from "./accionesDisponibles";
type Accion = "entregar" | "cerrar" | "lista";
const CONFIRMACION = {
  entregar: { titulo: "Entregar orden", descripcion: "Registre la entrega de la orden al cliente.", etiquetaConfirmar: "Entregar" },
  cerrar: { titulo: "Cerrar orden", descripcion: "Registre el cierre de la orden entregada.", etiquetaConfirmar: "Cerrar" },
  lista: { titulo: "Marcar orden lista", descripcion: "Confirme que la orden está lista para entregar.", etiquetaConfirmar: "Marcar lista" },
};

export function AccionesOrden({ orden, permisos, permisosEtapas }: {
  orden: OrdenDto; permisos: PermisosOrden; permisosEtapas: PermisosProduccionOrden;
}) {
  const [accion, setAccion] = useState<Accion | null>(null);
  const solicitud = useSolicitudOrden();
  const acciones = accionesDisponibles({ orden, permisos, permisosEtapas });
  async function confirmar() {
    if (!accion) return;
    await solicitud.enviar({ url: `/api/v1/ordenes/${orden.id}/${accion}`, metodo: "POST", cuerpo: { version: orden.actualizadoEn } });
    setAccion(null);
  }
  return <div className="space-y-3">
    <AvisoGuardado {...solicitud} />
    <div className="flex flex-wrap items-center gap-3">
      {acciones.iniciarProduccion ? <Button asChild><a href="#titulo-etapas">Iniciar producción</a></Button> : null}
      {acciones.lista ? <Button type="button" disabled={solicitud.enviando || !acciones.listaHabilitada}
        onClick={() => setAccion("lista")}>Marcar lista</Button> : null}
      {acciones.entregar ? <Button type="button" disabled={solicitud.enviando}
        onClick={() => setAccion("entregar")}>Entregar</Button> : null}
      {acciones.cerrar ? <Button type="button" disabled={solicitud.enviando}
        onClick={() => setAccion("cerrar")}>Cerrar</Button> : null}
      {acciones.editar ? <Button asChild variant="outline">
        <Link href={`/ordenes/${orden.id}/editar`}>Editar</Link></Button> : null}
      <Button asChild variant="outline"><Link href={`/trazabilidad/ordenes/${orden.id}`}>Trazabilidad completa</Link></Button>
      {acciones.cancelar ? <CancelarOrden orden={orden} /> : null}
    </div>
    {acciones.avisoLista ? <p className={acciones.avisoLista.clase}>{acciones.avisoLista.texto}</p> : null}
    {accion ? <ConfirmDialog abierto alCambiarAbierto={(valor) => !valor && setAccion(null)} {...CONFIRMACION[accion]}
      cargando={solicitud.enviando} alConfirmar={confirmar} /> : null}
  </div>;
}
