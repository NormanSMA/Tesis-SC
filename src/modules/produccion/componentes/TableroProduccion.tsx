"use client";

import { Layers, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AvatarIniciales } from "@/components/comunes/AvatarIniciales";
import { BarraProgresoAnimada } from "@/components/comunes/BarraProgresoAnimada";
import { EmptyState } from "@/components/comunes/EmptyState";
import { InsigniaPunto } from "@/components/comunes/FilaOperativa";
import { PuntoEnVivo } from "@/components/comunes/PuntoEnVivo";
import { Fecha } from "@/components/comunes/ValorFormateado";
import { ZonaResultados } from "@/components/comunes/ZonaResultados";
import { tiempoRelativo } from "@/lib/listas/tiempo-relativo";
import { cn } from "@/lib/utils";
import type { EtapaTablero, GrupoEtapas } from "../tipos";
import { AccionesEtapa, type PermisosEtapas } from "./AccionesEtapa";

type Vista = "area" | "responsable";
const VISTAS: { valor: Vista; etiqueta: string }[] = [{ valor: "responsable", etiqueta: "Por responsable" }, { valor: "area", etiqueta: "Por área" }];

/** La fecha es de calendario: vence al final de ese día en Managua (UTC-6, sin horario de verano). */
function finDeDia(fecha: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? `${fecha}T23:59:59-06:00` : fecha;
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

function InsigniaEstado({ etapa }: { etapa: EtapaTablero }) {
  const enCurso = etapa.estado === "EN_CURSO";
  return <span className="flex flex-wrap items-center gap-1.5">
    <InsigniaPunto tono={enCurso ? "info" : "neutro"}>{enCurso ? "En curso" : "Pendiente"}</InsigniaPunto>
    {etapa.atrasada ? <InsigniaPunto tono="peligro">Atrasada</InsigniaPunto> : null}
  </span>;
}

function FilaEtapa({ etapa, vista, permisos, referencia }: { etapa: EtapaTablero; vista: Vista; permisos: PermisosEtapas; referencia: string }) {
  const fecha = etapa.fechaFinPlan ?? etapa.orden.fechaEntrega;
  const secundario = vista === "area" ? (etapa.responsable?.nombre ?? "Sin responsable") : etapa.area.nombre;
  return <li className="grid min-w-0 grid-cols-1 items-center gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-[minmax(0,1fr)_auto_10rem_auto]">
    <div className="min-w-0">
      <Link href={`/ordenes/${etapa.orden.id}`}
        className="text-[15px] font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">{etapa.orden.numero}</Link>
      <p className="mt-0.5 break-words text-[15px] text-slate-900">{etapa.secuencia}. {etapa.nombre}</p>
      <p className={cn("mt-0.5 break-words text-sm", vista === "area" && !etapa.responsable ? "text-amber-700" : "text-slate-500")}>{secundario}</p>
    </div>
    <div className="flex min-w-0 flex-col gap-1.5 sm:items-end xl:items-start">
      <InsigniaEstado etapa={etapa} />
    </div>
    <div className="min-w-0">
      <span className={cn("flex items-center gap-1.5 text-sm", etapa.atrasada ? "font-medium text-danger" : "text-slate-600")}>
        {etapa.atrasada ? <><PuntoEnVivo /><span className="sr-only">Atrasada: </span></> : null}
        {tiempoRelativo(finDeDia(fecha), referencia)}
      </span>
      <span className="block text-xs text-slate-500">{etapa.fechaFinPlan ? "Fin plan" : "Entrega"}: <Fecha valor={fecha} /></span>
    </div>
    {permisos.ejecutar ? <div className="min-w-0 sm:col-span-2 xl:col-span-1 xl:justify-self-end">
      <AccionesEtapa key={etapa.actualizadoEn} etapa={etapa} estadoOrden={etapa.orden.estado} permisos={permisos} soloEjecucion />
    </div> : null}
  </li>;
}

function CabeceraGrupo({ grupo, indice, vista, esMio }: { grupo: GrupoEtapas; indice: number; vista: Vista; esMio: boolean }) {
  const enCurso = grupo.etapas.filter((etapa) => etapa.estado === "EN_CURSO").length;
  const Icono = vista === "area" ? Layers : UserRound;
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-100 px-4 py-3.5 lg:px-5">
    {vista === "responsable" && grupo.id ? <AvatarIniciales nombre={grupo.nombre} className="size-9" />
      : <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200">
        <Icono className="size-4" /></span>}
    <h2 id={`grupo-produccion-${indice}`} className="min-w-0 break-words text-lg font-medium text-slate-900">{grupo.nombre}</h2>
    <span className="rounded-md border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 tabular-nums"
      aria-label={`${grupo.etapas.length} etapas`}>{grupo.etapas.length}</span>
    {esMio ? <InsigniaPunto tono="exito">Mis etapas</InsigniaPunto> : null}
    <BarraProgresoAnimada valor={enCurso} total={grupo.etapas.length} etiqueta="Etapas en curso"
      texto={`${enCurso} de ${grupo.etapas.length} en curso`} className="w-full sm:ml-auto sm:w-64" />
  </div>;
}

export function TableroProduccion({ porArea, porResponsable, permisos, vistaInicial, miId, referencia }: {
  porArea: GrupoEtapas[]; porResponsable: GrupoEtapas[]; permisos: PermisosEtapas; vistaInicial: Vista; miId?: string;
  /** Referencia fija del servidor: el texto relativo no cambia al hidratar. */
  referencia: string;
}) {
  const [vista, setVista] = useState(vistaInicial);
  const grupos = ordenar(vista === "area" ? porArea : porResponsable, miId, vista === "responsable");
  return <div className="min-w-0 space-y-4">
    <div role="group" aria-label="Agrupar etapas" className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-lg border border-border/80 bg-slate-100/70 p-1">
      {VISTAS.map((opcion) => <button key={opcion.valor} type="button" aria-pressed={vista === opcion.valor} onClick={() => setVista(opcion.valor)}
        className="inline-flex h-8 shrink-0 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors duration-100 ease-out hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-sm">
        {opcion.etiqueta}</button>)}
    </div>
    <ZonaResultados className="space-y-4">
      {grupos.length ? grupos.map((grupo, indice) => <section key={grupo.id ?? "sin-responsable"} aria-labelledby={`grupo-produccion-${indice}`}
        className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-card shadow-sm">
        <CabeceraGrupo grupo={grupo} indice={indice} vista={vista} esMio={vista === "responsable" && Boolean(miId) && grupo.id === miId} />
        <ul aria-label={`Etapas: ${grupo.nombre}`} className="flex flex-col gap-1.5 p-2">
          {grupo.etapas.map((etapa) => <FilaEtapa key={etapa.id} etapa={etapa} vista={vista} permisos={permisos} referencia={referencia} />)}
        </ul>
      </section>) : <EmptyState ilustracion="corte-grabado-laser" titulo="Sin etapas abiertas" descripcion="No hay etapas pendientes ni en curso con estos filtros." />}
    </ZonaResultados>
  </div>;
}
