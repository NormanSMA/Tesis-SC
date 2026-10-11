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
  return <Card className="relative min-w-0 overflow-hidden pt-0 transition duration-200 hover:-translate-y-0.5 hover:bg-background hover:shadow-md">
    <Image src={imagenPorCategoria(producto.categoria.nombre)} alt={`Producto: ${producto.nombre}`}
      width={640} height={640} sizes="(min-width: 1536px) 25vw, (min-width: 1024px) 33vw, 50vw"
      className="aspect-[2/1] w-full object-cover" />
    <CardHeader>
      <CardDescription className="flex items-center gap-2">
        <IconoServicio categoria={producto.categoria.nombre} tamano={24} className="shrink-0" />
        <span className="min-w-0 truncate">{producto.categoria.nombre}</span>
        <span className="shrink-0 whitespace-nowrap">· {producto.codigo}</span>
      </CardDescription>
      <CardTitle><h2 className="text-base leading-normal break-words">
        <Link className="outline-none hover:underline after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset" href={`/catalogo/${producto.id}`}>{producto.nombre}</Link>
      </h2></CardTitle>
    </CardHeader>
    <CardContent className="flex flex-wrap items-center justify-between gap-2">
      <span className="tabular-nums"><Money valor={producto.precioBase} /> / {producto.unidadCobro === "M2" ? "m²" : "unidad"}</span>
      <EstadoProducto activo={producto.activo} />
    </CardContent>
    {puedeGestionar && producto.activo ? <CardFooter className="mt-auto">
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
