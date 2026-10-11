"use client";

import Link from "next/link";
import { useState } from "react";
import { DataTable, type ColumnaTabla } from "@/components/comunes/DataTable";
import { EmptyState } from "@/components/comunes/EmptyState";
import { EstadoBadge } from "@/components/comunes/EstadoBadge";
import { Fecha } from "@/components/comunes/ValorFormateado";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EtapaTablero, GrupoEtapas } from "../tipos";
import { AccionesEtapa, type PermisosEtapas } from "./AccionesEtapa";

const APILADO = "max-md:[&_table]:block max-md:[&_thead]:sr-only max-md:[&_tbody]:block max-md:[&_tr]:block max-md:[&_td]:block "
  + "max-md:[&_td]:static max-md:[&_td]:!text-left max-md:[&_tr]:h-auto max-md:[&_tr]:border-b max-md:[&_tr]:py-2";

/** En el grupo "Sin responsable" la leyenda por fila repite el encabezado del grupo. */
function crearColumnas(ocultarSinResponsable: boolean): ColumnaTabla<EtapaTablero>[] {
  return [
  { id: "orden", encabezado: "Orden y etapa", principal: true, celda: (etapa) => <div className="space-y-1">
    <Link href={`/ordenes/${etapa.orden.id}`} className="font-medium text-primary underline-offset-4 hover:underline">{etapa.orden.numero}</Link>
    <p>{etapa.secuencia}. {etapa.nombre}</p><p className="text-xs text-muted-foreground">Entrega: <Fecha valor={etapa.orden.fechaEntrega} /></p>
  </div> },
  { id: "estado", encabezado: "Estado", celda: (etapa) => <div className="flex flex-wrap gap-1"><EstadoBadge tipo="etapa" estado={etapa.estado} />
    {etapa.atrasada ? <Badge variant="peligro">Atrasada</Badge> : null}</div> },
  { id: "area", encabezado: "Área y responsable", celda: (etapa) => <div className="space-y-1">
    <p className={etapa.area.nombre === etapa.nombre ? "max-md:hidden" : undefined}>{etapa.area.nombre}</p>
    {etapa.responsable || !ocultarSinResponsable ? <p className="text-xs">{etapa.responsable?.nombre ?? "Sin responsable"}</p> : null}</div> },
  ];
}

function prioridad(etapa: EtapaTablero) {
  if (etapa.estado === "EN_CURSO") return 0;
  return etapa.atrasada ? 1 : 2;
}

function ordenar(grupos: GrupoEtapas[], miId: string | undefined, propios: boolean): GrupoEtapas[] {
  const ordenados = grupos.map((grupo) => ({ ...grupo, etapas: [...grupo.etapas].sort((a, b) => prioridad(a) - prioridad(b)) }));
  if (!propios || !miId) return ordenados;
  return [...ordenados.filter((grupo) => grupo.id === miId), ...ordenados.filter((grupo) => grupo.id !== miId)];
}

export function TableroProduccion({ porArea, porResponsable, permisos, vistaInicial, miId }: {
  porArea: GrupoEtapas[]; porResponsable: GrupoEtapas[]; permisos: PermisosEtapas; vistaInicial: "area" | "responsable"; miId?: string;
}) {
  const [vista, setVista] = useState(vistaInicial);
  const grupos = ordenar(vista === "area" ? porArea : porResponsable, miId, vista === "responsable");
  return <div className="min-w-0 space-y-5"><div role="group" aria-label="Agrupar etapas" className="flex flex-wrap gap-2">
    <Button type="button" variant={vista === "responsable" ? "default" : "outline"} aria-pressed={vista === "responsable"}
      onClick={() => setVista("responsable")}>Por responsable</Button>
    <Button type="button" variant={vista === "area" ? "default" : "outline"} aria-pressed={vista === "area"}
      onClick={() => setVista("area")}>Por área</Button>
  </div>{grupos.length ? grupos.map((grupo, indice) => <section key={grupo.id ?? "sin-responsable"}
    aria-labelledby={`grupo-produccion-${indice}`} className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <h2 id={`grupo-produccion-${indice}`} className="break-words text-lg font-semibold">{grupo.nombre} ({grupo.etapas.length})</h2>
      {vista === "responsable" && miId && grupo.id === miId ? <Badge variant="neutroFuerte">Mis etapas</Badge> : null}
    </div>
    <DataTable titulo={`Etapas: ${grupo.nombre}`} columnas={crearColumnas(vista === "responsable" && grupo.id === null)} filas={grupo.etapas} idFila={(etapa) => etapa.id}
      acciones={permisos.ejecutar ? (etapa) => <AccionesEtapa key={etapa.actualizadoEn} etapa={etapa}
        estadoOrden={etapa.orden.estado} permisos={permisos} soloEjecucion /> : undefined}
      className={`min-w-0 [&_table]:table-fixed [&_th]:whitespace-normal [&_td]:whitespace-normal [&_td]:break-words [&_td]:[overflow-wrap:anywhere] [&_th]:px-2 [&_td]:px-2 ${APILADO}`} />
  </section>) : <EmptyState ilustracion="corte-grabado-laser" titulo="Sin etapas abiertas" descripcion="No hay etapas pendientes ni en curso con estos filtros." />}
  </div>;
}
