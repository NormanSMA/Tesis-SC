"use client";

import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "@/components/comunes/ConfirmDialog";
import { Button } from "@/components/ui/button";
import type { MaterialDto } from "../dto";
import { useSolicitudInventario } from "../useSolicitudInventario";
import { AvisoSolicitud } from "./AvisoSolicitud";

export type PermisosMaterial = { gestionar: boolean; entrada: boolean; ajustar: boolean };
export function AccionesMaterial({ material, permisos }: { material: MaterialDto; permisos: PermisosMaterial }) {
  const [abierto, setAbierto] = useState(false);
  const solicitud = useSolicitudInventario("acciones-material");
  const accion = material.activo ? "archivar" : "reactivar";
  async function confirmar() {
    // El aviso de error vive fuera del diálogo: se cierra siempre para que el motivo del rechazo se vea y se anuncie.
    await solicitud.enviar({ url: `/api/v1/materiales/${material.id}/${accion}`, cuerpo: { version: material.actualizadoEn } });
    setAbierto(false);
  }
  return <div id="acciones-material" className="min-w-0 space-y-3 max-sm:w-full"><AvisoSolicitud {...solicitud} />
    <div className="grid grid-cols-3 gap-2 [&>*:first-child]:col-span-3 sm:flex sm:flex-row sm:flex-wrap">
      {material.activo && permisos.entrada ? <Button asChild><Link href={`/inventario/entrada?materialId=${material.id}`}>Registrar entrada</Link></Button> : null}
      {material.activo && permisos.ajustar ? <Button asChild variant="outline"><Link href={`/inventario/ajuste?materialId=${material.id}`}>Ajustar</Link></Button> : null}
      {permisos.gestionar ? <><Button asChild variant="outline"><Link href={`/inventario/${material.id}/editar`}>Editar</Link></Button>
        <Button variant="outline" disabled={solicitud.enviando} onClick={() => setAbierto(true)}>{material.activo ? "Archivar" : "Reactivar"}</Button></> : null}
    </div>
    <ConfirmDialog abierto={abierto} alCambiarAbierto={setAbierto} titulo={material.activo ? "Archivar material" : "Reactivar material"}
      descripcion={material.activo ? "El material debe tener existencia cero para archivarlo." : "El material estará disponible para entradas y consumos."}
      etiquetaConfirmar={material.activo ? "Archivar" : "Reactivar"} cargando={solicitud.enviando} alConfirmar={confirmar} />
  </div>;
}
