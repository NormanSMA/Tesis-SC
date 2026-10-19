import { Package } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/comunes/EmptyState";
import { IconoServicio } from "@/components/comunes/IconoServicio";
import { ListaEscalonada } from "@/components/comunes/ListaEscalonada";
import { Paginacion } from "@/components/comunes/Paginacion";
import { Money } from "@/components/comunes/ValorFormateado";
import { ZonaResultados } from "@/components/comunes/ZonaResultados";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatearPorcentaje } from "@/lib/formato";
import { textoOrden } from "@/lib/listas/orden";
import { servicioDeCategoria } from "@/lib/servicios";

import type { ConsultaProductos } from "../schema";
import type { ListaProductos, ProductoDto } from "../tipos";
import { EstadoProducto } from "./EstadoProducto";
import { esMargenBajo, margenPct } from "./margen";

/** Enlace extendido: toda la tarjeta navega a la ficha; el botón Editar queda por encima con z-10. */
const ENLACE_TARJETA = "line-clamp-2 rounded outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] hover:underline focus-visible:after:ring-2 focus-visible:after:ring-ring";

function TarjetaProducto({ producto, puedeGestionar }: { producto: ProductoDto; puedeGestionar: boolean }) {
  const margen = margenPct(producto.precioBase, producto.costoUnitario);
  const categoria = producto.categoria.nombre;
  return <article className="relative flex h-full min-w-0 flex-col gap-4 rounded-2xl border border-slate-200/80 bg-card p-4 shadow-sm transition-transform duration-150 ease-out hover:-translate-y-px">
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-muted">
        {servicioDeCategoria(categoria)
          ? <IconoServicio categoria={categoria} tamano={40} />
          : <Package aria-hidden="true" className="size-6 text-muted-foreground" />}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground" title={categoria}>{categoria}</p>
        <p className="font-mono text-xs font-medium text-slate-700">{producto.codigo}</p>
      </div>
    </div>
    <h2 className="min-h-12 text-base leading-snug font-medium break-words text-slate-900">
      <Link className={ENLACE_TARJETA} href={`/catalogo/${producto.id}`}>{producto.nombre}</Link>
    </h2>
    <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <p className="text-lg font-medium text-slate-900 tabular-nums">
        <Money valor={producto.precioBase} /> <span className="text-sm font-normal text-muted-foreground">/ {producto.unidadCobro === "M2" ? "m²" : "unidad"}</span>
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {esMargenBajo(margen) ? <Badge variant="advertencia">Margen bajo {formatearPorcentaje(margen, 0)}</Badge> : null}
        {producto.activo ? null : <EstadoProducto activo={false} />}
      </div>
    </div>
    {puedeGestionar && producto.activo ? <Button asChild variant="outline" size="sm" className="relative z-10 w-full">
      <Link href={`/catalogo/${producto.id}/editar`} aria-label={`Editar ${producto.nombre}`}>Editar</Link>
    </Button> : null}
  </article>;
}

function hrefPagina(consulta: ConsultaProductos, pagina: number) {
  const parametros = new URLSearchParams({ activo: String(consulta.activo), pagina: String(pagina), porPagina: String(consulta.porPagina) });
  if (consulta.q) parametros.set("q", consulta.q);
  if (consulta.categoriaId) parametros.set("categoriaId", consulta.categoriaId);
  if (consulta.orden) parametros.set("orden", textoOrden(consulta.orden));
  return `/catalogo?${parametros}`;
}

export function TarjetasCatalogo({ lista, consulta, puedeGestionar }: { lista: ListaProductos; consulta: ConsultaProductos; puedeGestionar: boolean }) {
  return <ZonaResultados className="flex flex-col gap-6">
    {lista.datos.length
      ? <ListaEscalonada key={JSON.stringify(consulta)} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {lista.datos.map((producto) => <TarjetaProducto key={producto.id} producto={producto} puedeGestionar={puedeGestionar} />)}
      </ListaEscalonada>
      : <EmptyState ilustracion="gran-formato" titulo="Sin resultados" descripcion="No hay productos para los filtros seleccionados."
        accion={<Button asChild variant="outline"><Link href="/catalogo">Limpiar filtros</Link></Button>} />}
    <Paginacion pagina={lista.pagina} total={lista.total} tamano={lista.porPagina} hrefPagina={(pagina) => hrefPagina(consulta, pagina)} />
  </ZonaResultados>;
}
