"use client";

import { Layers, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AvatarIniciales } from "@/components/comunes/AvatarIniciales";
import { EmptyState } from "@/components/comunes/EmptyState";
import { BrazoRobot } from "@/components/layout/IconoBrazoRobot";
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
  return <li className="min-w-0 space-y-1.5 rounded-lg border border-border/70 bg-card p-2.5 shadow-xs">
    <div className="flex min-w-0 items-start justify-between gap-2">
      <Link href={`/ordenes/${etapa.orden.id}`}
        className="text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">{etapa.orden.numero}</Link>
      <InsigniaEstado etapa={etapa} />
    </div>
    <p className="break-words text-sm text-foreground">{etapa.secuencia}. {etapa.nombre}</p>
    <p className={cn("break-words text-xs", vista === "area" && !etapa.responsable ? "text-amber-700" : "text-muted-foreground")}>{secundario}</p>
    {etapa.instrucciones ? <p className="line-clamp-2 whitespace-pre-wrap break-words text-xs text-muted-foreground" title={etapa.instrucciones}>
      {etapa.instrucciones}</p> : null}
    <p className={cn("flex flex-wrap items-center gap-x-1.5 text-xs", etapa.atrasada ? "font-medium text-danger" : "text-muted-foreground")}>
      {etapa.atrasada ? <><PuntoEnVivo /><span className="sr-only">Atrasada: </span></> : null}
      <span>{tiempoRelativo(finDeDia(fecha), referencia)}</span>
      <span>· {etapa.fechaFinPlan ? "Fin plan" : "Entrega"}: <Fecha valor={fecha} /></span>
    </p>
    {permisos.ejecutar ? <AccionesEtapa key={etapa.actualizadoEn} etapa={etapa} estadoOrden={etapa.orden.estado} permisos={permisos} soloEjecucion />
      : null}
  </li>;
}

function CabeceraGrupo({ grupo, indice, vista, esMio }: { grupo: GrupoEtapas; indice: number; vista: Vista; esMio: boolean }) {
  const enCurso = grupo.etapas.filter((etapa) => etapa.estado === "EN_CURSO").length;
  const Icono = vista === "area" ? Layers : UserRound;
  return <div className="flex min-w-0 items-center gap-2 px-1 pb-2">
    {vista === "responsable" && grupo.id ? <AvatarIniciales nombre={grupo.nombre} className="size-7 text-xs" />
      : <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icono className="size-3.5" /></span>}
    <h2 id={`grupo-produccion-${indice}`} className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground" title={grupo.nombre}>{grupo.nombre}</h2>
    {esMio ? <InsigniaPunto tono="exito">Mis etapas</InsigniaPunto> : null}
    <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums"
      aria-label={`${grupo.etapas.length} etapas, ${enCurso} en curso`}>{grupo.etapas.length}</span>
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
    {/* Tablero compacto: una columna por responsable o área; las columnas se acomodan al ancho sin desplazamiento horizontal. */}
    <ZonaResultados className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {grupos.length ? grupos.map((grupo, indice) => <section key={grupo.id ?? "sin-responsable"} aria-labelledby={`grupo-produccion-${indice}`}
        className="min-w-0 rounded-xl bg-muted/60 p-2">
        <CabeceraGrupo grupo={grupo} indice={indice} vista={vista} esMio={vista === "responsable" && Boolean(miId) && grupo.id === miId} />
        <ul aria-label={`Etapas: ${grupo.nombre}`} className="flex flex-col gap-2">
          {grupo.etapas.map((etapa) => <FilaEtapa key={etapa.id} etapa={etapa} vista={vista} permisos={permisos} referencia={referencia} />)}
        </ul>
      </section>) : <div className="col-span-full"><EmptyState icono={BrazoRobot} titulo="Sin etapas abiertas" descripcion="No hay etapas pendientes ni en curso con estos filtros." /></div>}
    </ZonaResultados>
  </div>;
}
