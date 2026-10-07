"use client";

import Link from "next/link";
import { useState } from "react";
import { DataTable, type ColumnaTabla } from "@/components/comunes/DataTable";
import { EmptyState } from "@/components/comunes/EmptyState";
import { EstadoBadge } from "@/components/comunes/EstadoBadge";
import { Fecha } from "@/components/comunes/ValorFormateado";
import { Button } from "@/components/ui/button";
import type { EtapaTablero, GrupoEtapas } from "../tipos";
import { AccionesEtapa, type PermisosEtapas } from "./AccionesEtapa";

const columnas: ColumnaTabla<EtapaTablero>[] = [
  { id: "orden", encabezado: "Orden y etapa", principal: true, celda: (etapa) => <div className="space-y-1">
    <Link href={`/ordenes/${etapa.orden.id}`} className="font-medium underline">{etapa.orden.numero}</Link>
    <p>{etapa.secuencia}. {etapa.nombre}</p><p className="text-xs text-muted-foreground">Entrega: <Fecha valor={etapa.orden.fechaEntrega} /></p>
  </div> },
  { id: "estado", encabezado: "Estado", celda: (etapa) => <div className="space-y-2"><EstadoBadge tipo="etapa" estado={etapa.estado} />
    {etapa.atrasada ? <p className="text-sm font-medium text-danger">Atrasada</p> : null}</div> },
  { id: "area", encabezado: "Área y responsable", celda: (etapa) => <div className="space-y-1"><p>{etapa.area.nombre}</p>
    <p className="text-xs">{etapa.responsable?.nombre ?? "Sin responsable"}</p></div> },
  { id: "fechas", encabezado: "Fechas planificadas", celda: (etapa) => <div className="space-y-1 text-xs">
    <p>Inicio: <Fecha valor={etapa.fechaInicioPlan} /></p><p>Fin: <Fecha valor={etapa.fechaFinPlan} /></p></div> },
];

export function TableroProduccion({ porArea, porResponsable, permisos, vistaInicial }: {
  porArea: GrupoEtapas[]; porResponsable: GrupoEtapas[]; permisos: PermisosEtapas; vistaInicial: "area" | "responsable";
}) {
  const [vista, setVista] = useState(vistaInicial);
  const grupos = vista === "area" ? porArea : porResponsable;
  return <div className="min-w-0 space-y-5"><div role="group" aria-label="Agrupar etapas" className="flex flex-wrap gap-2">
    <Button type="button" variant={vista === "responsable" ? "default" : "outline"} aria-pressed={vista === "responsable"}
      onClick={() => setVista("responsable")}>Por responsable</Button>
    <Button type="button" variant={vista === "area" ? "default" : "outline"} aria-pressed={vista === "area"}
      onClick={() => setVista("area")}>Por área</Button>
  </div>{grupos.length ? grupos.map((grupo, indice) => <section key={grupo.id ?? "sin-responsable"}
    aria-labelledby={`grupo-produccion-${indice}`} className="min-w-0 space-y-3">
    <h2 id={`grupo-produccion-${indice}`} className="break-words text-lg font-semibold">{grupo.nombre} ({grupo.etapas.length})</h2>
    <DataTable titulo={`Etapas: ${grupo.nombre}`} columnas={columnas} filas={grupo.etapas} idFila={(etapa) => etapa.id}
      acciones={permisos.ejecutar ? (etapa) => <AccionesEtapa key={etapa.actualizadoEn} etapa={etapa}
        estadoOrden={etapa.orden.estado} permisos={permisos} soloEjecucion /> : undefined}
      className="min-w-0 [&_table]:table-fixed [&_th]:whitespace-normal [&_td]:whitespace-normal [&_td]:break-words [&_td]:[overflow-wrap:anywhere] [&_th]:px-2 [&_td]:px-2" />
  </section>) : <EmptyState titulo="Sin etapas abiertas" descripcion="No hay etapas pendientes ni en curso con estos filtros." />}
  </div>;
}
