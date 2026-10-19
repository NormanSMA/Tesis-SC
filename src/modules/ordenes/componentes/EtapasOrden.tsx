"use client";

import { useEffect, useRef } from "react";

import { DataTable, type ColumnaTabla } from "@/components/comunes/DataTable";
import { TarjetaSeccion } from "@/components/comunes/TarjetaSeccion";
import { EstadoBadge } from "@/components/comunes/EstadoBadge";
import { Fecha } from "@/components/comunes/ValorFormateado";
import { formatearFechaHora } from "@/lib/formato";
import { AccionesEtapa, type PermisosEtapas } from "@/modules/produccion/componentes/AccionesEtapa";
import { AccionesProduccionOrden } from "@/modules/produccion/componentes/AccionesProduccionOrden";
import type { EtapaOrdenDto, OrdenDto, ReferenciaOrden } from "../tipos";

const columnas: ColumnaTabla<EtapaOrdenDto>[] = [
  { id: "nombre", encabezado: "Etapa y área", principal: true, celda: (etapa) => <div className="space-y-1">
    <p className="font-medium">{etapa.secuencia}. {etapa.nombre}</p><p className="text-xs text-muted-foreground">{etapa.area.nombre}</p>
    {etapa.observaciones ? <p className="text-xs">{etapa.observaciones}</p> : null}</div> },
  { id: "estado", encabezado: "Estado y responsable", celda: (etapa) => <div className="space-y-2">
    <EstadoBadge tipo="etapa" estado={etapa.estado} /><p className="text-xs">{etapa.responsable?.nombre ?? "Sin responsable"}</p></div> },
  { id: "plan", encabezado: "Fechas planificadas", celda: (etapa) => <div className="space-y-1 text-xs">
    <p>Inicio: <Fecha valor={etapa.fechaInicioPlan} /></p><p>Fin: <Fecha valor={etapa.fechaFinPlan} /></p></div> },
  { id: "reales", encabezado: "Fechas reales", celda: (etapa) => <div className="space-y-1 text-xs">
    <p>Inicio: {formatearFechaHora(etapa.fechaInicioReal) || "—"}</p><p>Fin: {formatearFechaHora(etapa.fechaFinReal) || "—"}</p></div> },
];

type AccionConFoco = { boton: HTMLButtonElement; mensajes: Map<HTMLElement, string | null>; dialogo?: HTMLElement | null };
const opcionesFoco: MutationObserverInit = { childList: true, subtree: true, characterData: true, attributes: true,
  attributeFilter: ["disabled", "aria-disabled"] };

export function recuperarFocoEtapas({ seccion, accion, estado }: {
  seccion: HTMLElement; accion: AccionConFoco; estado: HTMLElement;
}) {
  if (seccion.ownerDocument.activeElement !== seccion.ownerDocument.body) return;
  const mensajes = (accion.dialogo?.isConnected ? accion.dialogo : seccion)
    .querySelectorAll<HTMLElement>('[role="alert"], [role="status"]');
  const mensaje = [...mensajes].find((elemento) => elemento !== estado && elemento.textContent?.trim()
    && accion.mensajes.get(elemento) !== elemento.textContent);
  if (mensaje) {
    mensaje.tabIndex = -1;
    mensaje.focus();
  } else if (accion.boton.isConnected && !accion.boton.disabled
    && accion.boton.getAttribute("aria-disabled") !== "true") accion.boton.focus();
  else if (!accion.boton.isConnected) {
    estado.textContent = "Etapas actualizadas.";
    estado.focus();
  }
}

function useFocoEtapas() {
  const seccion = useRef<HTMLElement>(null);
  const estado = useRef<HTMLSpanElement>(null);
  const accion = useRef<AccionConFoco | null>(null);
  const observadorActual = useRef<MutationObserver | null>(null);
  useEffect(() => {
    const elemento = seccion.current;
    const mensaje = estado.current;
    if (!elemento || !mensaje) return;
    const observador = new MutationObserver(() => {
      if (accion.current) recuperarFocoEtapas({ seccion: elemento, accion: accion.current, estado: mensaje });
    });
    observadorActual.current = observador;
    observador.observe(elemento, opcionesFoco);
    return () => { observador.disconnect(); observadorActual.current = null; };
  }, []);
  function registrarAccion(objetivo: EventTarget) {
    if (!(objetivo instanceof Element)) return;
    const boton = objetivo.closest<HTMLButtonElement>("button");
    if (!boton || !seccion.current) return;
    const dialogo = boton.closest<HTMLElement>('[role="dialog"]');
    observadorActual.current?.disconnect();
    observadorActual.current?.observe(seccion.current, opcionesFoco);
    if (dialogo) observadorActual.current?.observe(dialogo, opcionesFoco);
    accion.current = { boton, dialogo, mensajes: new Map([...(dialogo ?? seccion.current).querySelectorAll<HTMLElement>(
      '[role="alert"], [role="status"]',
    )].map((mensaje) => [mensaje, mensaje.textContent])) };
  }
  return { seccion, estado, registrarAccion };
}

export function EtapasOrden({ etapas, orden, permisos, areas = [], responsables = [] }: {
  etapas: EtapaOrdenDto[]; orden?: Pick<OrdenDto, "id" | "estado" | "actualizadoEn" | "etapas">;
  permisos?: PermisosEtapas; areas?: ReferenciaOrden[]; responsables?: ReferenciaOrden[];
}) {
  const { seccion, estado, registrarAccion } = useFocoEtapas();
  // "Marcar lista" vive en el encabezado de la ficha (siguiente paso) mientras la orden está en producción.
  const acciones = orden && permisos && (permisos.planificar || permisos.ejecutar);
  return <section ref={seccion} onClickCapture={(evento) => registrarAccion(evento.target)}
    aria-labelledby="titulo-etapas" className="relative min-w-0"><span id="titulo-etapas" className="sr-only">Etapas</span>
    <span ref={estado} role="status" tabIndex={-1} className="sr-only" />
    <TarjetaSeccion titulo="Etapas" descripcion="Consulte las etapas y sus fechas." sinRelleno>
      {orden && permisos ? <div className="hidden border-b border-slate-100 p-5 has-[button,p,[role=alert]]:block">
        <AccionesProduccionOrden orden={orden} areas={areas}
          permisos={{ ...permisos, avanzar: permisos.avanzar && orden.estado !== "EN_PRODUCCION" }} /></div> : null}
      <DataTable titulo="Etapas de la orden" columnas={columnas} filas={etapas} idFila={(etapa) => etapa.id}
        acciones={acciones ? (etapa) => <AccionesEtapa key={etapa.actualizadoEn} etapa={etapa} estadoOrden={orden.estado}
          permisos={permisos} responsables={responsables} /> : undefined}
        apilarEnMovil
        className="min-w-0 rounded-none border-0 shadow-none md:[&_table]:table-fixed [&_th]:whitespace-normal [&_td]:whitespace-normal [&_td]:break-words [&_td]:[overflow-wrap:anywhere] md:[&_th]:px-2 md:[&_td]:px-2" />
    </TarjetaSeccion>
  </section>;
}
