import type { Metadata } from "next";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { can } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { AccionesEstado } from "@/modules/catalogo/componentes/AccionesEstado";
import { EncabezadoFicha } from "@/modules/catalogo/componentes/EncabezadoFicha";
import { EstadoProducto } from "@/modules/catalogo/componentes/EstadoProducto";
import { FichaProducto } from "@/modules/catalogo/componentes/FichaProducto";
import { cargarProducto } from "@/modules/catalogo/paginas";

export const metadata: Metadata = { title: "Ficha de producto" };
export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const actor = await exigirPermisoPagina("catalogo:ver");
  const producto = await cargarProducto((await params).id, actor);
  return <>
    <EncabezadoFicha titulo={producto.nombre} codigo={producto.codigo} detalle={producto.categoria.nombre}
      estado={<EstadoProducto activo={producto.activo} />}
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
