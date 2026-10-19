"use client";

import type { ReactNode } from "react";
import { BuscadorEnVivo } from "@/components/comunes/BuscadorEnVivo";
import { FiltroSegmentado } from "@/components/comunes/FiltroSegmentado";
import { Button } from "@/components/ui/button";
import { useParametrosUrl } from "@/lib/listas/useParametrosUrl";
import type { ReferenciaOrden } from "@/modules/ordenes/tipos";

export type ConteosCatalogo = { todas: number; activas: number; archivadas: number };

/** Barra de los catálogos: búsqueda en vivo, estado en pastillas y, si aplica, categoría. Todo vive en la URL. */
export function FiltrosCatalogo({ busqueda, marcador, conteos, categorias, children }: {
  busqueda: string; marcador: string; conteos: ConteosCatalogo; categorias?: ReferenciaOrden[]; children?: ReactNode;
}) {
  const { parametros, navegar } = useParametrosUrl();
  const hayFiltros = ["q", "estado"].some((clave) => Boolean(parametros.get(clave)));
  return <div className="mb-4 flex flex-col gap-3">
    <div className="flex flex-wrap items-center gap-3">
      <BuscadorEnVivo etiqueta={busqueda} marcador={marcador} className="basis-full sm:max-w-md lg:basis-auto lg:flex-1" />
      <FiltroSegmentado etiqueta="Estado" parametro="estado" valorTodos="todas" opciones={[
        { valor: "todas", etiqueta: "Todas", conteo: conteos.todas },
        { valor: "activas", etiqueta: "Activas", conteo: conteos.activas },
        { valor: "archivadas", etiqueta: "Archivadas", conteo: conteos.archivadas }]} />
      {hayFiltros ? <Button type="button" variant="ghost" className="h-10" onClick={() => navegar({ q: null, estado: null })}>Limpiar filtros</Button> : null}
      {children ? <div className="sm:ml-auto">{children}</div> : null}
    </div>
    {categorias?.length ? <FiltroSegmentado etiqueta="Categoría" parametro="categoria" valorTodos={categorias[0].id} className="self-start"
      opciones={categorias.map((categoria) => ({ valor: categoria.id, etiqueta: categoria.nombre }))} /> : null}
  </div>;
}
