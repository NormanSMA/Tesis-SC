import { Package } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { CabeceraFicha } from "@/components/comunes/CabeceraFicha";
import { IconoServicio } from "@/components/comunes/IconoServicio";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { can } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { servicioDeCategoria } from "@/lib/servicios";
import { AccionesEstado } from "@/modules/catalogo/componentes/AccionesEstado";
import { EstadoProducto } from "@/modules/catalogo/componentes/EstadoProducto";
import { FichaProducto } from "@/modules/catalogo/componentes/FichaProducto";
import { imagenPorCategoria } from "@/modules/catalogo/imagenes";
import { cargarProducto } from "@/modules/catalogo/paginas";

export const metadata: Metadata = { title: "Ficha de producto" };
export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const actor = await exigirPermisoPagina("catalogo:ver");
  const producto = await cargarProducto((await params).id, actor);
  return <>
    <CabeceraFicha titulo={producto.nombre} volver={{ href: "/catalogo", etiqueta: "Catálogo" }}
      marca={<span className="relative flex size-16 items-center justify-center overflow-hidden rounded-xl bg-muted ring-1 ring-border sm:size-20">
        {servicioDeCategoria(producto.categoria.nombre) ? <IconoServicio categoria={producto.categoria.nombre} tamano={36} /> : <Package aria-hidden="true" className="size-6 text-muted-foreground" />}
        <Image src={imagenPorCategoria(producto.categoria.nombre)} alt={`Producto: ${producto.nombre}`} fill sizes="80px" className="object-cover" />
      </span>}
      meta={<>
        <span className="font-medium text-foreground">{producto.codigo}</span>
        <EstadoProducto activo={producto.activo} />
        <span>{producto.categoria.nombre}</span>
      </>}
      acciones={can(actor, "catalogo:gestionar") ? <>
        {producto.activo ? <Button asChild><Link href={`/catalogo/${producto.id}/editar`}>Editar</Link></Button> : null}
        <AccionesEstado producto={producto} principal={!producto.activo} />
      </> : null} />
    {!producto.activo ? <Alert role="status" className="mb-6"><AlertTitle>Producto archivado</AlertTitle>
      <AlertDescription>Las cotizaciones existentes conservan el producto y su precio.</AlertDescription>
    </Alert> : null}
    <FichaProducto ficha={producto} />
  </>;
}
