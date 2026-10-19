"use client";

import { SlidersHorizontal } from "lucide-react";
import { useId, type ReactNode } from "react";
import { BuscadorEnVivo } from "@/components/comunes/BuscadorEnVivo";
import { FiltroSegmentado, type OpcionSegmento } from "@/components/comunes/FiltroSegmentado";
import { SelectorOrden } from "@/components/comunes/SelectorOrden";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { textoOrden } from "@/lib/listas/orden";
import { useParametrosUrl } from "@/lib/listas/useParametrosUrl";
import { ETIQUETA_MOVIMIENTO, etiquetar } from "../etiquetas";
import { TIPOS_MOVIMIENTO } from "../schema";
import { OPCIONES_ORDEN_MATERIAL, OPCIONES_ORDEN_MOVIMIENTO, ORDEN_MATERIAL_DEFECTO, ORDEN_MOVIMIENTO_DEFECTO } from "../tipos";

const TODOS = "todos";
const CLAVES_MOVIMIENTO = ["tipo", "material", "orden", "usuario", "desde", "hasta"] as const;
const CLAVES_OTROS = ["material", "orden", "usuario", "desde", "hasta"] as const;

type OpcionesLibro = { materiales: { id: string; codigo: string; nombre: string }[];
  usuarios: { id: string; nombre: string }[]; ordenes: { id: string; numero: string }[] };

function Campo({ etiqueta, id, children }: { etiqueta: string; id: string; children: ReactNode }) {
  return <div className="flex flex-col gap-1.5">
    <label htmlFor={id} className="text-sm font-medium">{etiqueta}</label>{children}
  </div>;
}

/** Select que escribe su valor en la URL al cambiar. "Todos" quita el parámetro. */
function CampoSelect({ etiqueta, parametro, opciones }: { etiqueta: string; parametro: string; opciones: { id: string; nombre: string }[] }) {
  const id = useId();
  const { parametros, navegar } = useParametrosUrl();
  return <Campo etiqueta={etiqueta} id={id}>
    <Select value={parametros.get(parametro) ?? TODOS} onValueChange={(valor) => navegar({ [parametro]: valor === TODOS ? null : valor })}>
      <SelectTrigger id={id}><SelectValue /></SelectTrigger>
      <SelectContent>{[{ id: TODOS, nombre: "Todos" }, ...opciones].map((opcion) =>
        <SelectItem key={opcion.id} value={opcion.id}>{opcion.nombre}</SelectItem>)}</SelectContent>
    </Select>
  </Campo>;
}

/** Fecha sin controlar: navegar con cada cambio no debe devolver el valor viejo mientras llega la URL nueva. */
function CampoFecha({ etiqueta, parametro }: { etiqueta: string; parametro: string }) {
  const id = useId();
  const { parametros, navegar } = useParametrosUrl();
  return <Campo etiqueta={etiqueta} id={id}>
    <Input id={id} type="date" defaultValue={parametros.get(parametro) ?? ""}
      onChange={(evento) => navegar({ [parametro]: evento.target.value || null })} />
  </Campo>;
}

function BotonMasFiltros({ activos, children }: { activos: number; children: ReactNode }) {
  return <Popover>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" className="h-10 gap-2">
        <SlidersHorizontal aria-hidden="true" className="size-4" />
        Más filtros
        {activos > 0 ? <span className="rounded bg-slate-200/70 px-1.5 text-[11px] font-semibold text-slate-600 tabular-nums">
          {activos}<span className="sr-only"> activos</span></span> : null}
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-4">{children}</PopoverContent>
  </Popover>;
}

/** Barra de materiales: búsqueda en vivo y estado como pastillas. Todo vive en la URL. */
export function FiltrosMateriales({ resumen }: { resumen: { materiales: number; enAlerta: number } }) {
  const { parametros, navegar } = useParametrosUrl();
  const opciones: OpcionSegmento[] = [
    { valor: TODOS, etiqueta: "Todos", conteo: resumen.materiales },
    { valor: "bajo", etiqueta: "Bajo mínimo", conteo: resumen.enAlerta },
    { valor: "archivados", etiqueta: "Archivados" },
  ];
  const hayFiltros = Boolean(parametros.get("q")) || Boolean(parametros.get("estado"));
  return <div className="flex flex-wrap items-center gap-3">
    <BuscadorEnVivo etiqueta="Buscar material" marcador="Buscar por nombre o código" className="basis-full sm:max-w-md lg:basis-auto lg:flex-1" />
    <FiltroSegmentado etiqueta="Estado" parametro="estado" valorTodos={TODOS} opciones={opciones} />
    {hayFiltros ? <Button type="button" variant="ghost" className="h-10"
      onClick={() => navegar({ q: null, estado: null })}>Limpiar filtros</Button> : null}
    <SelectorOrden parametro="ordenar" opciones={OPCIONES_ORDEN_MATERIAL} valorPorDefecto={textoOrden(ORDEN_MATERIAL_DEFECTO)} className="ml-auto" />
  </div>;
}

/** Barra del libro: tipo como pastillas; material, orden, usuario y fechas en "Más filtros". */
export function FiltrosMovimientos({ materialId, opciones }: { materialId?: string; opciones: OpcionesLibro }) {
  const { parametros, navegar } = useParametrosUrl();
  const segmentos: OpcionSegmento[] = [{ valor: TODOS, etiqueta: "Todos" },
    ...TIPOS_MOVIMIENTO.map((tipo) => ({ valor: tipo, etiqueta: etiquetar(ETIQUETA_MOVIMIENTO, tipo) }))];
  const claves = materialId ? CLAVES_OTROS.filter((clave) => clave !== "material") : CLAVES_OTROS;
  const activos = claves.filter((clave) => parametros.get(clave)).length;
  const hayFiltros = activos > 0 || Boolean(parametros.get("tipo"));
  return <div className="flex flex-wrap items-center gap-3">
    <FiltroSegmentado etiqueta="Tipo de movimiento" parametro="tipo" valorTodos={TODOS} opciones={segmentos} />
    <BotonMasFiltros activos={activos}>
      {materialId ? null : <CampoSelect etiqueta="Material" parametro="material"
        opciones={opciones.materiales.map((material) => ({ id: material.id, nombre: `${material.codigo} · ${material.nombre}` }))} />}
      <CampoSelect etiqueta="Orden" parametro="orden" opciones={opciones.ordenes.map((orden) => ({ id: orden.id, nombre: orden.numero }))} />
      <CampoSelect etiqueta="Usuario" parametro="usuario" opciones={opciones.usuarios} />
      <CampoFecha etiqueta="Desde (Managua)" parametro="desde" />
      <CampoFecha etiqueta="Hasta (Managua)" parametro="hasta" />
    </BotonMasFiltros>
    {hayFiltros ? <Button type="button" variant="ghost" className="h-10"
      onClick={() => navegar(Object.fromEntries(CLAVES_MOVIMIENTO.filter((clave) => !(materialId && clave === "material")).map((clave) => [clave, null])))}>
      Limpiar filtros</Button> : null}
    <SelectorOrden parametro="ordenar" opciones={OPCIONES_ORDEN_MOVIMIENTO} valorPorDefecto={textoOrden(ORDEN_MOVIMIENTO_DEFECTO)} className="ml-auto" />
  </div>;
}
