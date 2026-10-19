"use client";

import { BellRing, Calculator, ChevronDown, CircleCheck, ClipboardList, Layers, Package } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { COLUMNAS_FEED, FilaOperativa, InsigniaPunto, type TonoMiniatura } from "@/components/comunes/FilaOperativa";
import { ListaEscalonada } from "@/components/comunes/ListaEscalonada";
import { URGENCIAS } from "@/components/panel/urgencias";
import { formatearMonedaEntera } from "@/lib/formato";
import { tiempoRelativo } from "@/lib/listas/tiempo-relativo";
import { cn } from "@/lib/utils";
import type { AtencionPanel } from "@/modules/panel/tipos";

const ICONOS = { cotizacion: Calculator, orden: ClipboardList, material: Package, etapa: Layers };
const TONOS: Record<AtencionPanel["tipo"], TonoMiniatura> = { cotizacion: "primario", orden: "info", material: "advertencia", etapa: "exito" };
type MensajeVacio = { texto: string; enlace: string; destino: string };
type PropiedadesAtencion = {
  atencion: readonly AtencionPanel[];
  generadoEn: string;
  atencionTotal: number;
  vacio?: MensajeVacio;
};

export function ordenarPorGravedad(atencion: readonly AtencionPanel[]): AtencionPanel[] {
  const prioridad = { alta: 0, media: 1 };
  return [...atencion].sort((primero, segundo) => prioridad[primero.gravedad] - prioridad[segundo.gravedad]);
}

const conMayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

// Texto corto de la columna Tiempo: la insignia ya dice el tipo de urgencia.
export function tiempoAtencion(elemento: AtencionPanel, generadoEn: string): string {
  const relativo = tiempoRelativo(elemento.referencia, generadoEn);
  switch (elemento.urgencia) {
    case "POR_VENCER": return elemento.dias === 0 ? "Vence hoy" : `Vence ${relativo}`;
    case "ORDEN_ATRASADA":
    case "ETAPA_ATRASADA": return `${relativo.replace(/^hace /, "")} de atraso`;
    case "BAJO_MINIMO": return "Reponer";
    default: return conMayuscula(relativo);
  }
}

// Columna de valor: monto de la cotización u orden; en materiales, la existencia frente al mínimo.
function valorFila(elemento: AtencionPanel): string | null {
  if (elemento.tipo === "material") return elemento.detalle.replace(/^Existencia /, "");
  return elemento.monto !== null && elemento.moneda !== null ? formatearMonedaEntera(elemento.monto, elemento.moneda) : null;
}

function FilaAtencion({ elemento, generadoEn }: { elemento: AtencionPanel; generadoEn: string }) {
  const urgencia = URGENCIAS[elemento.urgencia];
  return (
    <FilaOperativa destino={elemento.destino} icono={ICONOS[elemento.tipo]} tono={TONOS[elemento.tipo]}
      titulo={elemento.titulo} codigo={elemento.codigo} detalle={elemento.tipo === "material" ? undefined : elemento.detalle}
      insignia={<InsigniaPunto tono={urgencia.tono}>{urgencia.etiqueta}</InsigniaPunto>}
      valor={valorFila(elemento)}
      tiempo={tiempoAtencion(elemento, generadoEn)} critica={elemento.gravedad === "alta"} />
  );
}

function AtencionVacia({ vacio }: { vacio?: MensajeVacio }) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center gap-2 px-4 text-center">
      <span className="mb-1 flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-success ring-1 ring-emerald-100">
        <CircleCheck aria-hidden="true" className="size-5" />
      </span>
      <p className="text-[15px] font-medium text-slate-900">Todo al día</p>
      <p className="text-sm text-slate-500">{vacio?.texto ?? "No hay elementos que requieran atención ahora."}</p>
      {vacio && <Link href={vacio.destino} className="inline-flex min-h-10 items-center rounded text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring">{vacio.enlace}</Link>}
    </div>
  );
}

const ENCABEZADOS = ["Elemento", "Urgencia", "Monto", "Tiempo"];

/** Filas visibles al cargar: el resto se abre con "Ver más" para no saturar el panel. */
export const FILAS_INICIALES = 5;

export function ListaAtencion({ atencion, generadoEn, atencionTotal, vacio }: PropiedadesAtencion) {
  const [todas, setTodas] = useState(false);
  const destinos = [...new Set(atencion.map(({ destino }) => destino.split("?")[0].split("/")[1]))];
  const destino = destinos.length === 1 && destinos[0] ? `/${destinos[0]}` : undefined;
  const ordenadas = ordenarPorGravedad(atencion);
  const visibles = todas ? ordenadas : ordenadas.slice(0, FILAS_INICIALES);
  const ocultas = ordenadas.length - visibles.length;
  return (
    <aside aria-label="Requiere atención" className="h-full min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3.5 lg:px-5">
        <span className="flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-card text-slate-600">
          <BellRing aria-hidden="true" className="size-4" />
        </span>
        <h2 className="text-lg font-medium text-slate-900">Requiere atención</h2>
        <span className="rounded-md border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 tabular-nums"
          aria-label={`${atencionTotal} elementos requieren atención`}>
          {atencionTotal} {atencionTotal === 1 ? "elemento" : "elementos"}
        </span>
        {destino && <Link href={destino} className="ml-auto inline-flex min-h-10 items-center rounded text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring">Ver todas</Link>}
      </div>
      {atencion.length === 0 ? <AtencionVacia vacio={vacio} /> : (
        <>
          <div aria-hidden="true" className={cn("hidden gap-4 px-5 pt-3 pb-1 text-sm font-semibold text-slate-700 lg:grid", COLUMNAS_FEED)}>
            {ENCABEZADOS.map((encabezado, indice) => <span key={encabezado} className={indice === 0 ? "pl-16" : undefined}>{encabezado}</span>)}
          </div>
          <ListaEscalonada className="gap-1.5 p-2">
            {visibles.map((elemento) => (
              <FilaAtencion key={`${elemento.id}-${elemento.urgencia}`} elemento={elemento} generadoEn={generadoEn} />
            ))}
          </ListaEscalonada>
          {ocultas > 0 ? (
            <div className="border-t border-slate-100 px-2 py-1.5">
              <button type="button" onClick={() => setTodas(true)}
                className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-slate-600 transition-colors duration-100 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-ring">
                Ver {ocultas} más <ChevronDown aria-hidden="true" className="size-4" />
              </button>
            </div>
          ) : null}
        </>
      )}
    </aside>
  );
}
