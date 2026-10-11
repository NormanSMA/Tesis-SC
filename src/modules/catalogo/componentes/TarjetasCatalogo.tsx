import Image from "next/image";
import Link from "next/link";

import { EmptyState } from "@/components/comunes/EmptyState";
import { IconoServicio } from "@/components/comunes/IconoServicio";
import { Paginacion } from "@/components/comunes/Paginacion";
import { Money } from "@/components/comunes/ValorFormateado";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

import { imagenPorCategoria } from "../imagenes";
import type { ConsultaProductos } from "../schema";
import type { ListaProductos, ProductoDto } from "../tipos";
import { EstadoProducto } from "./EstadoProducto";

function TarjetaProducto({ producto, puedeGestionar }: { producto: ProductoDto; puedeGestionar: boolean }) {
  return <Card className="relative flex min-w-0 flex-col overflow-hidden pt-0 transition duration-200 hover:-translate-y-0.5 hover:bg-background hover:shadow-md">
    <div className="relative flex aspect-[2/1] w-full items-center justify-center bg-muted">
      <IconoServicio categoria={producto.categoria.nombre} tamano={48} />
      <Image src={imagenPorCategoria(producto.categoria.nombre)} alt={`Producto: ${producto.nombre}`}
        fill sizes="(min-width: 1536px) 25vw, (min-width: 1024px) 33vw, 50vw" className="object-cover" />
    </div>
    <CardHeader className="grid-cols-[minmax(0,1fr)]">
      <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <IconoServicio categoria={producto.categoria.nombre} tamano={24} className="shrink-0" />
        <span className="min-w-0 break-words">{producto.categoria.nombre}</span>
        <span className="shrink-0 whitespace-nowrap font-mono text-xs">{producto.codigo}</span>
      </CardDescription>
      <CardTitle><h2 className="min-h-12 text-base leading-normal break-words">
        <Link className="outline-none hover:underline after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset" href={`/catalogo/${producto.id}`}>{producto.nombre}</Link>
      </h2></CardTitle>
    </CardHeader>
    <CardContent className="mt-auto flex flex-wrap items-center justify-between gap-2">
      <span className="tabular-nums"><Money valor={producto.precioBase} /> / {producto.unidadCobro === "M2" ? "m²" : "unidad"}</span>
      <EstadoProducto activo={producto.activo} />
    </CardContent>
    {puedeGestionar && producto.activo ? <CardFooter>
      <Button asChild variant="outline" className="relative z-10 w-full"><Link href={`/catalogo/${producto.id}/editar`} aria-label={`Editar ${producto.nombre}`}>Editar</Link></Button>
    </CardFooter> : null}
  </Card>;
}
function hrefPagina(consulta: ConsultaProductos, pagina: number) {
  const parametros = new URLSearchParams({ activo: String(consulta.activo), pagina: String(pagina), porPagina: String(consulta.porPagina) });
  if (consulta.q) parametros.set("q", consulta.q);
  if (consulta.categoriaId) parametros.set("categoriaId", consulta.categoriaId);
  return `/catalogo?${parametros}`;
}
export function TarjetasCatalogo({ lista, consulta, puedeGestionar }: { lista: ListaProductos; consulta: ConsultaProductos; puedeGestionar: boolean }) {
  return <div className="flex flex-col gap-6">
    {lista.datos.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {lista.datos.map((producto) => <TarjetaProducto key={producto.id} producto={producto} puedeGestionar={puedeGestionar} />)}
    </div> : <EmptyState ilustracion="gran-formato" titulo="Sin resultados" descripcion="No hay productos para los filtros seleccionados." />}
    <Paginacion pagina={lista.pagina} total={lista.total} tamano={lista.porPagina} hrefPagina={(pagina) => hrefPagina(consulta, pagina)} />
  </div>;
}
