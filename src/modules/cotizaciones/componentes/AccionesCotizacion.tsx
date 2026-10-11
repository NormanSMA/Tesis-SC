"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/comunes/ConfirmDialog";
import type { CotizacionDto } from "../tipos";
import { useSolicitudCotizacion } from "../useSolicitudCotizacion";
import { AvisoGuardado } from "./AvisoGuardado";
import { ResponderCotizacion } from "./ResponderCotizacion";

type Accion = "enviar" | "duplicar" | "archivar" | "version-corregida";
type Permisos = { gestionar: boolean; enviar: boolean; responder: boolean };
const CONFIRMACION = {
  "version-corregida": { titulo: "Crear versión corregida", descripcion: "Cree la siguiente versión en borrador para atender los ajustes solicitados." },
  enviar: { titulo: "Enviar cotización", descripcion: "Fije los montos y las fechas. Después del envío, corrija mediante un duplicado." },
  duplicar: { titulo: "Duplicar cotización", descripcion: "Cree un borrador con los ítems guardados, el IVA vigente y la vigencia vigente." },
  archivar: { titulo: "Archivar cotización", descripcion: "Oculte la cotización de la lista predeterminada. Conserve los datos y el historial." },
};

export function AccionesCotizacion({ cotizacion, permisos, hoy }: {
  cotizacion: CotizacionDto; permisos: Permisos; hoy: string;
}) {
  const [accion, setAccion] = useState<Accion | null>(null);
  const solicitud = useSolicitudCotizacion();
  async function confirmar() {
    if (!accion) return;
    const creaBorrador = accion === "duplicar" || accion === "version-corregida";
    await solicitud.enviar({ url: `/api/v1/cotizaciones/${cotizacion.id}/${accion}`, metodo: "POST",
      cuerpo: creaBorrador ? {} : { version: cotizacion.actualizadoEn },
      destino: creaBorrador ? "editar" : "detalle" });
    setAccion(null);
  }
  return <div className="space-y-4">
    <AvisoGuardado {...solicitud} />
    <div className="flex flex-wrap gap-3">
      {permisos.gestionar && cotizacion.estado === "BORRADOR" && !cotizacion.archivada ?
        <Button asChild variant="outline"><Link href={`/cotizaciones/${cotizacion.id}/editar`}>Editar</Link></Button> : null}
      {permisos.enviar && cotizacion.estado === "BORRADOR" && !cotizacion.archivada ?
        <Button type="button" disabled={!cotizacion.items.length || solicitud.enviando} onClick={() => setAccion("enviar")}>Enviar cotización</Button> : null}
      {permisos.responder && cotizacion.estado === "ENVIADA" && !cotizacion.archivada ?
        <ResponderCotizacion cotizacion={cotizacion} hoy={hoy} /> : null}
      {permisos.gestionar && cotizacion.estado === "AJUSTE_SOLICITADO" && !cotizacion.archivada ?
        <Button type="button" disabled={!cotizacion.cliente.activo || solicitud.enviando}
          onClick={() => setAccion("version-corregida")}>Crear versión corregida</Button> : null}
      {permisos.gestionar ? <Button type="button" variant="outline" disabled={!cotizacion.cliente.activo || solicitud.enviando}
        onClick={() => setAccion("duplicar")}>Duplicar</Button> : null}
      <Button asChild variant="outline"><Link href={`/cotizaciones/${cotizacion.id}/imprimir`}>Ver proforma</Link></Button>
      {permisos.gestionar && !cotizacion.archivada ? <Button type="button" variant="outline" disabled={solicitud.enviando}
        onClick={() => setAccion("archivar")}>Archivar</Button> : null}
    </div>
    {accion ? <ConfirmDialog abierto alCambiarAbierto={(abierto) => !abierto && setAccion(null)}
      {...CONFIRMACION[accion]} etiquetaConfirmar={CONFIRMACION[accion].titulo}
      cargando={solicitud.enviando} alConfirmar={confirmar} /> : null}
  </div>;
}
