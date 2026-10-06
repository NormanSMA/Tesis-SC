import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/comunes/PageHeader";
import { Button } from "@/components/ui/button";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { prisma } from "@/lib/db";
import { ImprimirProforma } from "@/modules/cotizaciones/componentes/ImprimirProforma";
import { Proforma } from "@/modules/cotizaciones/componentes/Proforma";
import { cargarCotizacion } from "@/modules/cotizaciones/paginas";
import { configuracionCotizacion } from "@/modules/cotizaciones/repo";
import "./impresion.css";

export const metadata: Metadata = { title: "Proforma imprimible" };

export default async function PaginaImprimirCotizacion({ params }: { params: Promise<{ id: string }> }) {
  await exigirPermisoPagina("cotizacion:ver");
  const [cotizacion, configuracion] = await Promise.all([cargarCotizacion((await params).id), configuracionCotizacion(prisma)]);
  return <>
    <div className="controles-impresion"><PageHeader titulo="Proforma imprimible" descripcion="Imprima o guarde la proforma como PDF."
      acciones={<><ImprimirProforma /><Button asChild variant="outline"><Link href={`/cotizaciones/${cotizacion.id}`}>Volver al detalle</Link></Button></>} /></div>
    <Proforma cotizacion={cotizacion} empresaNombre={configuracion.empresaNombre} />
  </>;
}
