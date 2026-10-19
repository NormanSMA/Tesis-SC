import type { Metadata } from "next";
import { Calculator } from "lucide-react";
import { CabeceraFicha, MarcaIcono } from "@/components/comunes/CabeceraFicha";
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
    <div className="controles-impresion"><CabeceraFicha titulo="Proforma imprimible" marca={<MarcaIcono><Calculator /></MarcaIcono>}
      meta={<span>Imprima o guarde la proforma como PDF.</span>}
      volver={{ href: `/cotizaciones/${cotizacion.id}`, etiqueta: "Volver al detalle" }} acciones={<ImprimirProforma />} /></div>
    <Proforma cotizacion={cotizacion} empresaNombre={configuracion.empresaNombre} />
  </>;
}
