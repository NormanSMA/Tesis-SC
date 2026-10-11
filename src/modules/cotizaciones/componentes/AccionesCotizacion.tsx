"use client";

import { useState, type ReactNode } from "react";
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

function siguientePaso(cotizacion: CotizacionDto, permisos: Permisos) {
  if (cotizacion.archivada) return "La cotización está archivada. Solo consulta.";
  switch (cotizacion.estado) {
    case "BORRADOR":
      if (!permisos.enviar) return "Un usuario con permiso de envío debe enviar la cotización.";
      return cotizacion.items.length ? "Envíe la cotización al cliente." : "Agregue ítems para poder enviar la cotización.";
    case "ENVIADA":
      return permisos.responder ? "Registre la respuesta del cliente: aprobación, rechazo o ajustes." : "Espere la respuesta del cliente.";
    case "AJUSTE_SOLICITADO":
      return permisos.gestionar ? "Cree la versión corregida con los ajustes pedidos." : "Un usuario con permiso de gestión debe crear la versión corregida.";
    case "APROBADA":
      return "Cotización aprobada. Continúe en la orden de producción.";
    default:
      return "Cotización cerrada. Puede duplicarla para preparar una nueva.";
  }
}

/** `children`: acciones propias del estado aprobado (orden), que se muestran junto al paso principal. */
export function AccionesCotizacion({ cotizacion, permisos, hoy, children }: {
  cotizacion: CotizacionDto; permisos: Permisos; hoy: string; children?: ReactNode;
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
  const activa = !cotizacion.archivada;
  return <div className="space-y-4">
    <AvisoGuardado {...solicitud} />
    <p className="text-sm"><span className="font-semibold">Siguiente paso:</span> {siguientePaso(cotizacion, permisos)}</p>
    <div className="flex flex-wrap items-center gap-3">
      {permisos.enviar && cotizacion.estado === "BORRADOR" && activa ?
        <Button type="button" disabled={!cotizacion.items.length || solicitud.enviando} onClick={() => setAccion("enviar")}>Enviar cotización</Button> : null}
      {permisos.responder && cotizacion.estado === "ENVIADA" && activa ?
        <ResponderCotizacion cotizacion={cotizacion} hoy={hoy} /> : null}
      {permisos.gestionar && cotizacion.estado === "AJUSTE_SOLICITADO" && activa ?
        <Button type="button" disabled={!cotizacion.cliente.activo || solicitud.enviando}
          onClick={() => setAccion("version-corregida")}>Crear versión corregida</Button> : null}
      {children}
    </div>
    <div className="flex flex-wrap gap-3">
      {permisos.gestionar && cotizacion.estado === "BORRADOR" && activa ?
        <Button asChild variant="outline"><Link href={`/cotizaciones/${cotizacion.id}/editar`}>Editar</Link></Button> : null}
      {permisos.gestionar ? <Button type="button" variant="outline" disabled={!cotizacion.cliente.activo || solicitud.enviando}
        onClick={() => setAccion("duplicar")}>Duplicar</Button> : null}
      <Button asChild variant="outline"><Link href={`/cotizaciones/${cotizacion.id}/imprimir`}>Ver proforma</Link></Button>
      {permisos.gestionar && activa ? <Button type="button" variant="outline" disabled={solicitud.enviando}
        onClick={() => setAccion("archivar")}>Archivar</Button> : null}
    </div>
    {accion ? <ConfirmDialog abierto alCambiarAbierto={(abierto) => !abierto && setAccion(null)}
      {...CONFIRMACION[accion]} etiquetaConfirmar={CONFIRMACION[accion].titulo}
      cargando={solicitud.enviando} alConfirmar={confirmar} /> : null}
  </div>;
}
