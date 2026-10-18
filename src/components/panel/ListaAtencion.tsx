import { CircleCheck, ClipboardList, FileText, Layers, Package } from "lucide-react";
import Link from "next/link";

import { FilaOperativa } from "@/components/comunes/FilaOperativa";
import { ListaEscalonada } from "@/components/comunes/ListaEscalonada";
import { URGENCIAS } from "@/components/panel/urgencias";
import { Badge } from "@/components/ui/badge";
import { formatearMonedaEntera } from "@/lib/formato";
import { tiempoRelativo } from "@/lib/listas/tiempo-relativo";
import type { AtencionPanel } from "@/modules/panel/tipos";

const ICONOS = { cotizacion: FileText, orden: ClipboardList, material: Package, etapa: Layers };
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

export function tiempoAtencion(elemento: AtencionPanel, generadoEn: string): string {
  const relativo = tiempoRelativo(elemento.referencia, generadoEn);
  switch (elemento.urgencia) {
    case "POR_VENCER": return elemento.dias === 0 ? "Vence hoy" : `Vence ${relativo}`;
    case "ORDEN_ATRASADA":
    case "ETAPA_ATRASADA": return `Atrasada ${relativo.replace(/^hace /, "")}`;
    case "SIN_RESPUESTA": return `Sin respuesta ${relativo}`;
    case "ETAPA_DETENIDA": return `Detenida ${relativo}`;
    case "AJUSTE_SOLICITADO": return `Ajuste solicitado ${relativo}`;
    default: return relativo;
  }
}

function FilaAtencion({ elemento, generadoEn }: { elemento: AtencionPanel; generadoEn: string }) {
  const urgencia = URGENCIAS[elemento.urgencia];
  const IconoUrgencia = urgencia.icono;
  return (
    <FilaOperativa destino={elemento.destino} icono={ICONOS[elemento.tipo]} codigo={elemento.codigo}
      insignia={<Badge variant={urgencia.tono}><IconoUrgencia aria-hidden="true" />{urgencia.etiqueta}</Badge>}
      titulo={elemento.titulo} detalle={elemento.detalle}
      valor={elemento.monto !== null && elemento.moneda !== null
        ? formatearMonedaEntera(elemento.monto, elemento.moneda) : null}
      tiempo={tiempoAtencion(elemento, generadoEn)} critica={elemento.gravedad === "alta"} />
  );
}

function AtencionVacia({ vacio }: { vacio?: MensajeVacio }) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center gap-2 px-4 text-center">
      <CircleCheck aria-hidden="true" className="mb-1 size-8 text-success" />
      <p className="text-sm font-semibold">Todo al día</p>
      <p className="text-xs text-muted-foreground">{vacio?.texto ?? "No hay elementos que requieran atención ahora."}</p>
      {vacio && <Link href={vacio.destino} className="inline-flex min-h-10 items-center rounded text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring">{vacio.enlace}</Link>}
    </div>
  );
}

export function ListaAtencion({ atencion, generadoEn, atencionTotal, vacio }: PropiedadesAtencion) {
  const destinos = [...new Set(atencion.map(({ destino }) => destino.split("?")[0].split("/")[1]))];
  const destino = destinos.length === 1 && destinos[0] ? `/${destinos[0]}` : undefined;
  return (
    <aside aria-label="Requiere atención" className="h-full min-w-0 rounded-xl border border-border/80 bg-card p-4 shadow-sm lg:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Requiere atención</h2>
        <Badge variant={atencionTotal > 0 ? "advertencia" : "neutro"} aria-label={`${atencionTotal} elementos requieren atención`}>{atencionTotal}</Badge>
        {destino && <Link href={destino} className="ml-auto inline-flex min-h-10 items-center rounded text-xs font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring">Ver todas</Link>}
      </div>
      {atencion.length === 0 ? <AtencionVacia vacio={vacio} /> : (
        <ListaEscalonada className="[&_a]:min-w-0 [&_a]:grid-cols-[auto_minmax(0,1fr)] sm:[&_a]:grid-cols-[auto_minmax(0,1fr)_auto] [&_a>span:last-child]:col-span-2 [&_a>span:last-child]:justify-self-end sm:[&_a>span:last-child]:col-span-1">
          {ordenarPorGravedad(atencion).map((elemento) => (
            <FilaAtencion key={`${elemento.id}-${elemento.urgencia}`} elemento={elemento} generadoEn={generadoEn} />
          ))}
        </ListaEscalonada>
      )}
    </aside>
  );
}
