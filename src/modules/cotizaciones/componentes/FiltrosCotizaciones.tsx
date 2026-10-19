"use client";

import { SlidersHorizontal } from "lucide-react";
import { useId } from "react";
import { FiltroBuscable } from "@/components/comunes/SelectorBuscable";
import { BuscadorEnVivo } from "@/components/comunes/BuscadorEnVivo";
import { FiltroSegmentado, type OpcionSegmento } from "@/components/comunes/FiltroSegmentado";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useParametrosUrl } from "@/lib/listas/useParametrosUrl";
import type { ConteosCotizaciones } from "../tipos";

const TODOS = "__todos__";
const ARCHIVADAS = [
  { id: "false", nombre: "Sin archivar" }, { id: "true", nombre: "Archivadas" }, { id: "todas", nombre: "Todas" },
];

function opcionesEstado(conteos: ConteosCotizaciones): OpcionSegmento[] {
  return [
    { valor: "todas", etiqueta: "Todas", conteo: conteos.todas },
    { valor: "BORRADOR", etiqueta: "Borrador", conteo: conteos.BORRADOR },
    { valor: "ENVIADA", etiqueta: "Enviada", conteo: conteos.ENVIADA },
    { valor: "APROBADA", etiqueta: "Aprobada", conteo: conteos.APROBADA },
    { valor: "POR_VENCER", etiqueta: "Por vencer", conteo: conteos.porVencer },
    { valor: "AJUSTE_SOLICITADO", etiqueta: "Ajustes solicitados", conteo: conteos.AJUSTE_SOLICITADO },
    { valor: "RECHAZADA", etiqueta: "Rechazada", conteo: conteos.RECHAZADA },
    { valor: "VENCIDA", etiqueta: "Vencida", conteo: conteos.VENCIDA },
  ];
}

function CampoSeleccion({ etiqueta, valor, opciones, alCambiar }: {
  etiqueta: string; valor: string; opciones: { id: string; nombre: string }[]; alCambiar: (valor: string) => void;
}) {
  const id = useId();
  return <div className="flex flex-col gap-1.5">
    <label htmlFor={id} className="text-sm font-medium">{etiqueta}</label>
    <Select value={valor} onValueChange={alCambiar}>
      <SelectTrigger id={id}><SelectValue /></SelectTrigger>
      <SelectContent>{opciones.map((opcion) => <SelectItem key={opcion.id} value={opcion.id}>{opcion.nombre}</SelectItem>)}</SelectContent>
    </Select>
  </div>;
}

/** Barra de la lista: búsqueda en vivo, pastillas de estado y filtros secundarios. Todo vive en la URL. */
export function FiltrosCotizaciones({ conteos, clientes }: {
  conteos: ConteosCotizaciones; clientes: { id: string; nombre: string }[];
}) {
  const { parametros, navegar } = useParametrosUrl();
  const cliente = parametros.get("cliente") ?? TODOS;
  const archivadas = parametros.get("archivadas") ?? "false";
  const secundarios = Number(cliente !== TODOS) + Number(archivadas !== "false");
  const hayFiltros = secundarios > 0 || Boolean(parametros.get("q")) || Boolean(parametros.get("estado"));
  // Fila 1: buscador y filtros secundarios. Fila 2: pastillas de estado (ocupan todo el ancho y pueden desplazarse).
  return <div className="mb-4 flex flex-col gap-3">
    <div className="flex flex-wrap items-center gap-3">
    <BuscadorEnVivo etiqueta="Buscar cotizaciones" marcador="Buscar por número, cliente o asunto" className="sm:max-w-md sm:flex-1" />
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="h-10 gap-2">
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          Más filtros
          {secundarios > 0 ? <span className="rounded bg-slate-200/70 px-1.5 text-[11px] font-semibold text-slate-600 tabular-nums">
            {secundarios}<span className="sr-only"> activos</span></span> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-4">
        <FiltroBuscable etiqueta="Cliente" parametro="cliente" opciones={clientes} valorTodos={TODOS} />
        <CampoSeleccion etiqueta="Archivo" valor={archivadas} alCambiar={(valor) => navegar({ archivadas: valor === "false" ? null : valor })}
          opciones={ARCHIVADAS} />
      </PopoverContent>
    </Popover>
    {hayFiltros ? <Button type="button" variant="ghost" className="h-10"
      onClick={() => navegar({ q: null, estado: null, cliente: null, archivadas: null })}>Limpiar filtros</Button> : null}
    </div>
    <FiltroSegmentado etiqueta="Estado" parametro="estado" valorTodos="todas" opciones={opcionesEstado(conteos)} className="self-start" />
  </div>;
}
