"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/comunes/ConfirmDialog";
import type { CotizacionDto } from "../tipos";
import { useSolicitudCotizacion } from "../useSolicitudCotizacion";
import { AvisoGuardado } from "./AvisoGuardado";
import { ResponderCotizacion } from "./ResponderCotizacion";
import { accionesDisponibles, type PermisosCotizacion } from "./accionesDisponibles";

type Accion = "enviar" | "duplicar" | "archivar" | "version-corregida";
const CONFIRMACION = {
  "version-corregida": { titulo: "Crear versión corregida", descripcion: "Cree la siguiente versión en borrador para atender los ajustes solicitados." },
  enviar: { titulo: "Enviar cotización", descripcion: "Fije los montos y las fechas. Después del envío, corrija mediante un duplicado." },
  duplicar: { titulo: "Duplicar cotización", descripcion: "Cree un borrador con los ítems guardados, el IVA vigente y la vigencia vigente." },
  archivar: { titulo: "Archivar cotización", descripcion: "Oculte la cotización de la lista predeterminada. Conserve los datos y el historial." },
};
const ETIQUETA_CONFIRMAR: Record<Accion, string> = {
  "version-corregida": "Crear versión",
  enviar: "Enviar",
  duplicar: "Duplicar",
  archivar: "Archivar",
};

function AccionesSecundarias({ cotizacion, acciones, enviando, seleccionar }: {
  cotizacion: CotizacionDto; acciones: ReturnType<typeof accionesDisponibles>;
  enviando: boolean; seleccionar: (accion: Accion) => void;
}) {
  return <>
    {acciones.editar ? <Button asChild variant="outline"><Link href={`/cotizaciones/${cotizacion.id}/editar`}>Editar</Link></Button> : null}
    {acciones.duplicar ? <Button type="button" variant="outline" disabled={acciones.borradorDeshabilitado || enviando}
      onClick={() => seleccionar("duplicar")}>Duplicar</Button> : null}
    <Button asChild variant="outline"><Link href={`/cotizaciones/${cotizacion.id}/imprimir`}>Ver proforma</Link></Button>
    {acciones.archivar ? <Button type="button" variant="outline" disabled={enviando} className="text-rose-700 hover:text-rose-800"
      onClick={() => seleccionar("archivar")}>Archivar</Button> : null}
  </>;
}

/** Acciones de la cabecera de la ficha. `children`: acciones propias del estado aprobado (orden), antes de las secundarias. */
export function AccionesCotizacion({ cotizacion, permisos, hoy, children }: {
  cotizacion: CotizacionDto; permisos: PermisosCotizacion; hoy: string; children?: ReactNode;
}) {
  const [accion, setAccion] = useState<Accion | null>(null);
  const solicitud = useSolicitudCotizacion();
  const acciones = accionesDisponibles({ cotizacion, permisos });
  async function confirmar() {
    if (!accion) return;
    const creaBorrador = accion === "duplicar" || accion === "version-corregida";
    await solicitud.enviar({ url: `/api/v1/cotizaciones/${cotizacion.id}/${accion}`, metodo: "POST",
      cuerpo: creaBorrador ? {} : { version: cotizacion.actualizadoEn },
      destino: creaBorrador ? "editar" : "detalle" });
    setAccion(null);
  }
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2 sm:justify-end max-sm:[&>*]:flex-1">
      {acciones.enviar ?
        <Button type="button" disabled={acciones.envioDeshabilitado || solicitud.enviando} onClick={() => setAccion("enviar")}>Enviar cotización</Button> : null}
      {acciones.responder ?
        <ResponderCotizacion cotizacion={cotizacion} hoy={hoy} /> : null}
      {acciones.versionCorregida ?
        <Button type="button" disabled={acciones.borradorDeshabilitado || solicitud.enviando}
          onClick={() => setAccion("version-corregida")}>Crear versión corregida</Button> : null}
      {children}
      <AccionesSecundarias cotizacion={cotizacion} acciones={acciones} enviando={solicitud.enviando} seleccionar={setAccion} />
    </div>
    {solicitud.error ? <div className="max-w-md"><AvisoGuardado {...solicitud} /></div> : null}
    {accion ? <ConfirmDialog abierto alCambiarAbierto={(abierto) => !abierto && setAccion(null)}
      {...CONFIRMACION[accion]} etiquetaConfirmar={ETIQUETA_CONFIRMAR[accion]}
      cargando={solicitud.enviando} alConfirmar={confirmar} /> : null}
  </div>;
}
