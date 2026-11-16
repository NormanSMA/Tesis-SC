import type { Metadata } from "next";
import { Calculator } from "lucide-react";
import { BotonImprimir } from "@/components/comunes/BotonImprimir";
import { CabeceraFicha, MarcaIcono } from "@/components/comunes/CabeceraFicha";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { Proforma } from "@/modules/cotizaciones/componentes/Proforma";
import { cargarCotizacion } from "@/modules/cotizaciones/paginas";
import "./impresion.css";

export const metadata: Metadata = { title: "Proforma imprimible" };

export default async function PaginaImprimirCotizacion({ params }: { params: Promise<{ id: string }> }) {
  const actor = await exigirPermisoPagina("cotizacion:ver");
  const cotizacion = await cargarCotizacion((await params).id, actor);
  return <>
    <div className="controles-impresion"><CabeceraFicha titulo="Proforma imprimible" marca={<MarcaIcono><Calculator /></MarcaIcono>}
      meta={<span>Imprima o guarde la proforma como PDF.</span>}
      volver={{ href: `/cotizaciones/${cotizacion.id}`, etiqueta: "Volver al detalle" }} acciones={<BotonImprimir />} /></div>
    <Proforma cotizacion={cotizacion} />
  </>;
}
