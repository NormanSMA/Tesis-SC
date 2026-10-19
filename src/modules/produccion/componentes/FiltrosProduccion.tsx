"use client";

import { SlidersHorizontal } from "lucide-react";
import { useId } from "react";
import { BuscadorEnVivo } from "@/components/comunes/BuscadorEnVivo";
import { FiltroSegmentado } from "@/components/comunes/FiltroSegmentado";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useParametrosUrl } from "@/lib/listas/useParametrosUrl";
import type { ReferenciaOrden } from "@/modules/ordenes/tipos";

const TODOS = "__todos__";

function CampoArea({ areas }: { areas: ReferenciaOrden[] }) {
  const { parametros, navegar } = useParametrosUrl();
  const id = useId();
  return <div className="flex flex-col gap-1.5 md:hidden">
    <label htmlFor={id} className="text-sm font-medium">Área</label>
    <Select value={parametros.get("area") ?? TODOS} onValueChange={(valor) => navegar({ area: valor === TODOS ? null : valor })}>
      <SelectTrigger id={id}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={TODOS}>Todas las áreas</SelectItem>
        {areas.map((area) => <SelectItem key={area.id} value={area.id}>{area.nombre}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>;
}

/** Barra del tablero: búsqueda en vivo, estado y área en pastillas, responsable en "Más filtros" (y área en móvil). Todo vive en la URL. */
export function FiltrosProduccion({ opciones }: { opciones: { areas: ReferenciaOrden[]; responsables: ReferenciaOrden[] } }) {
  const { parametros, navegar } = useParametrosUrl();
  const idResponsable = useId();
  const responsable = parametros.get("responsable") ?? TODOS;
  const secundarios = Number(responsable !== TODOS);
  const hayFiltros = secundarios > 0 || ["q", "area", "estado"].some((clave) => Boolean(parametros.get(clave)));
  return <div className="flex flex-col gap-3">
    <div className="flex flex-wrap items-center gap-3">
      <BuscadorEnVivo etiqueta="Buscar orden" marcador="Buscar por número de orden"
        className="basis-full sm:max-w-md lg:basis-auto lg:flex-1" />
      <FiltroSegmentado etiqueta="Estado" parametro="estado" valorTodos="abiertas" opciones={[{ valor: "abiertas", etiqueta: "Abiertas" },
        { valor: "PENDIENTE", etiqueta: "Pendientes" }, { valor: "EN_CURSO", etiqueta: "En curso" }]} />
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
          {/* En móvil el área vive aquí: las pastillas ocuparían varias líneas. */}
          <CampoArea areas={opciones.areas} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor={idResponsable} className="text-sm font-medium">Responsable</label>
            <Select value={responsable} onValueChange={(valor) => navegar({ responsable: valor === TODOS ? null : valor })}>
              <SelectTrigger id={idResponsable}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos los responsables</SelectItem>
                {opciones.responsables.map((usuario) => <SelectItem key={usuario.id} value={usuario.id}>{usuario.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </PopoverContent>
      </Popover>
      {hayFiltros ? <Button type="button" variant="ghost" className="h-10"
        onClick={() => navegar({ q: null, area: null, estado: null, responsable: null })}>Limpiar filtros</Button> : null}
    </div>
    <FiltroSegmentado etiqueta="Área" parametro="area" valorTodos="todas" className="self-start max-md:hidden"
      opciones={[{ valor: "todas", etiqueta: "Todas las áreas" }, ...opciones.areas.map((opcion) => ({ valor: opcion.id, etiqueta: opcion.nombre }))]} />
  </div>;
}
