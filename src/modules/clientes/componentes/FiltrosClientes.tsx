"use client";

import { SlidersHorizontal } from "lucide-react";
import { useId } from "react";
import { BuscadorEnVivo } from "@/components/comunes/BuscadorEnVivo";
import { FiltroSegmentado, type OpcionSegmento } from "@/components/comunes/FiltroSegmentado";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useParametrosUrl } from "@/lib/listas/useParametrosUrl";
import type { ConteosClientes } from "../tipos";

const ESTADOS = [{ id: "true", nombre: "Activos" }, { id: "false", nombre: "Archivados" }];

function opcionesTipo(conteos?: ConteosClientes): OpcionSegmento[] {
  return [
    { valor: "todos", etiqueta: "Todos", conteo: conteos?.todos },
    { valor: "EMPRESA", etiqueta: "Empresas", conteo: conteos?.EMPRESA },
    { valor: "PERSONA", etiqueta: "Personas", conteo: conteos?.PERSONA },
  ];
}

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

/** Barra de la lista: búsqueda en vivo, pastillas de tipo y filtro de estado. Todo vive en la URL. */
export function FiltrosClientes({ conteos }: { conteos?: ConteosClientes }) {
  const { parametros, navegar } = useParametrosUrl();
  const activo = parametros.get("activo") ?? "true";
  const archivados = activo === "false";
  const hayFiltros = archivados || Boolean(parametros.get("q")) || Boolean(parametros.get("tipo"));
  return <div className="mb-4 flex flex-wrap items-center gap-3">
    <BuscadorEnVivo etiqueta="Buscar clientes" marcador="Buscar por nombre, RUC, contacto o correo" className="basis-full sm:max-w-md lg:basis-auto lg:flex-1" />
    <FiltroSegmentado etiqueta="Tipo" parametro="tipo" valorTodos="todos" opciones={opcionesTipo(conteos)} />
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
        <CampoEstado valor={activo} alCambiar={(valor) => navegar({ activo: valor === "true" ? null : valor })} />
      </PopoverContent>
    </Popover>
    {hayFiltros ? <Button type="button" variant="ghost" className="h-10"
      onClick={() => navegar({ q: null, tipo: null, activo: null })}>Limpiar filtros</Button> : null}
  </div>;
}
