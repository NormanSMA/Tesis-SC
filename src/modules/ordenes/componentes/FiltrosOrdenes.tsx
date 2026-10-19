"use client";

import { SlidersHorizontal } from "lucide-react";
import { FiltroBuscable } from "@/components/comunes/SelectorBuscable";
import { BuscadorEnVivo } from "@/components/comunes/BuscadorEnVivo";
import { FiltroSegmentado, type OpcionSegmento } from "@/components/comunes/FiltroSegmentado";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useParametrosUrl } from "@/lib/listas/useParametrosUrl";
import type { ConteosOrdenes, ReferenciaOrden } from "../tipos";

const TODOS = "__todos__";

/** Los conteos son opcionales: sin ellos las pastillas se muestran sin número. */
function opcionesVista(conteos?: ConteosOrdenes): OpcionSegmento[] {
  return [
    { valor: "activas", etiqueta: "Activas", conteo: conteos?.activas },
    { valor: "PENDIENTE", etiqueta: "Pendientes", conteo: conteos?.PENDIENTE },
    { valor: "EN_PRODUCCION", etiqueta: "En producción", conteo: conteos?.EN_PRODUCCION },
    { valor: "LISTA", etiqueta: "Listas", conteo: conteos?.LISTA },
    { valor: "ATRASADAS", etiqueta: "Atrasadas", conteo: conteos?.atrasadas },
    { valor: "SIN_RESPONSABLE", etiqueta: "Sin responsable", conteo: conteos?.sinResponsable },
    { valor: "ENTREGADA", etiqueta: "Entregadas", conteo: conteos?.ENTREGADA },
    { valor: "CERRADA", etiqueta: "Cerradas", conteo: conteos?.CERRADA },
    { valor: "CANCELADA", etiqueta: "Canceladas", conteo: conteos?.CANCELADA },
  ];
}

/** Barra de la lista: búsqueda en vivo, vistas rápidas y responsable. Todo vive en la URL. */
export function FiltrosOrdenes({ conteos, responsables }: { conteos?: ConteosOrdenes; responsables: ReferenciaOrden[] }) {
  const { parametros, navegar } = useParametrosUrl();
  const responsable = parametros.get("responsable") ?? TODOS;
  const secundarios = Number(responsable !== TODOS);
  const hayFiltros = secundarios > 0 || ["q", "vista", "cliente"].some((clave) => Boolean(parametros.get(clave)));
  // Fila 1: buscador y filtros secundarios. Fila 2: vistas rápidas (ocupan todo el ancho y pueden desplazarse).
  return <div className="mb-4 flex flex-col gap-3">
    <div className="flex flex-wrap items-center gap-3">
      <BuscadorEnVivo etiqueta="Buscar órdenes" marcador="Buscar por número, cliente o asunto"
        className="basis-full sm:max-w-md lg:basis-auto lg:flex-1" />
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
          <FiltroBuscable etiqueta="Responsable" parametro="responsable" valorTodos={TODOS}
            opciones={[{ id: "sin-responsable", nombre: "Sin responsable" }, ...responsables]} />
        </PopoverContent>
      </Popover>
      {hayFiltros ? <Button type="button" variant="ghost" className="h-10"
        onClick={() => navegar({ q: null, vista: null, responsable: null, cliente: null })}>Limpiar filtros</Button> : null}
    </div>
    <FiltroSegmentado etiqueta="Vista" parametro="vista" valorTodos="activas" opciones={opcionesVista(conteos)} className="self-start" />
  </div>;
}
