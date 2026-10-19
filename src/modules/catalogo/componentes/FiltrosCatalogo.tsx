"use client";

import { SlidersHorizontal } from "lucide-react";
import { useId } from "react";

import { BuscadorEnVivo } from "@/components/comunes/BuscadorEnVivo";
import { FiltroSegmentado } from "@/components/comunes/FiltroSegmentado";
import { SelectorOrden } from "@/components/comunes/SelectorOrden";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useParametrosUrl } from "@/lib/listas/useParametrosUrl";

import type { CategoriaDto } from "../tipos";

const OPCIONES_ORDEN = [
  { valor: "nombre:asc", etiqueta: "Nombre A-Z" }, { valor: "nombre:desc", etiqueta: "Nombre Z-A" },
  { valor: "precio:asc", etiqueta: "Menor precio" }, { valor: "precio:desc", etiqueta: "Mayor precio" },
  { valor: "creadoEn:desc", etiqueta: "Más recientes" },
];
const ESTADOS = [{ id: "true", nombre: "Activos" }, { id: "false", nombre: "Archivados" }];

function CampoEstado({ valor, alCambiar }: { valor: string; alCambiar: (valor: string) => void }) {
  const id = useId();
  return <div className="flex flex-col gap-1.5">
    <label htmlFor={id} className="text-sm font-medium">Estado</label>
    <Select value={valor} onValueChange={alCambiar}>
      <SelectTrigger id={id}><SelectValue /></SelectTrigger>
      <SelectContent>{ESTADOS.map((estado) => <SelectItem key={estado.id} value={estado.id}>{estado.nombre}</SelectItem>)}</SelectContent>
    </Select>
  </div>;
}

function CampoCategoria({ opciones, valor, alCambiar }: { opciones: { valor: string; etiqueta: string }[]; valor: string; alCambiar: (valor: string) => void }) {
  const id = useId();
  return <div className="flex flex-col gap-1.5 md:hidden">
    <label htmlFor={id} className="text-sm font-medium">Categoría</label>
    <Select value={valor} onValueChange={alCambiar}>
      <SelectTrigger id={id}><SelectValue /></SelectTrigger>
      <SelectContent>{opciones.map((opcion) => <SelectItem key={opcion.valor} value={opcion.valor}>{opcion.etiqueta}</SelectItem>)}</SelectContent>
    </Select>
  </div>;
}

/** Barra de la lista: búsqueda en vivo, categorías como pastillas y estado en "Más filtros". Todo vive en la URL. */
export function FiltrosCatalogo({ categorias }: { categorias: CategoriaDto[] }) {
  const { parametros, navegar } = useParametrosUrl();
  const activo = parametros.get("activo") ?? "true";
  const archivados = activo === "false";
  const hayFiltros = archivados || Boolean(parametros.get("q")) || Boolean(parametros.get("categoriaId"));
  const opciones = [{ valor: "todas", etiqueta: "Todas" }, ...categorias.map((categoria) => ({ valor: categoria.id, etiqueta: categoria.nombre }))];
  return <div className="mb-4 flex flex-col gap-3">
   <div className="flex flex-wrap items-center gap-3">
    <BuscadorEnVivo etiqueta="Buscar productos" marcador="Buscar por código, nombre o descripción" className="basis-full sm:max-w-md sm:flex-1 sm:basis-auto" />
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="h-10 gap-2">
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          Más filtros
          {archivados ? <span className="rounded bg-slate-200/70 px-1.5 text-[11px] font-semibold text-slate-600 tabular-nums">
            1<span className="sr-only"> activo</span></span> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-4">
        {/* En móvil la categoría vive aquí: las pastillas ocuparían varias líneas. */}
        <CampoCategoria opciones={opciones} valor={parametros.get("categoriaId") ?? "todas"}
          alCambiar={(valor) => navegar({ categoriaId: valor === "todas" ? null : valor })} />
        <CampoEstado valor={activo} alCambiar={(valor) => navegar({ activo: valor === "true" ? null : valor })} />
      </PopoverContent>
    </Popover>
    <SelectorOrden opciones={OPCIONES_ORDEN} valorPorDefecto="nombre:asc" />
    {hayFiltros ? <Button type="button" variant="ghost" className="h-10"
      onClick={() => navegar({ q: null, categoriaId: null, activo: null })}>Limpiar filtros</Button> : null}
   </div>
    <FiltroSegmentado etiqueta="Categoría" parametro="categoriaId" valorTodos="todas" opciones={opciones} className="self-start max-md:hidden" />
  </div>;
}
