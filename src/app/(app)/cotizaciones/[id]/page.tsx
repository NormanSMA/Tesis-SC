import type { Metadata } from "next";
import { Archive, CircleAlert } from "lucide-react";
import { PageHeader } from "@/components/comunes/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { can } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { AccionesCotizacion } from "@/modules/cotizaciones/componentes/AccionesCotizacion";
import { DatosCotizacion } from "@/modules/cotizaciones/componentes/DatosCotizacion";
import { ItemsCotizacion } from "@/modules/cotizaciones/componentes/ItemsCotizacion";
import { TotalesCotizacion } from "@/modules/cotizaciones/componentes/TotalesCotizacion";
import { hoyManagua } from "@/modules/cotizaciones/fechas";
import { cargarCotizacion } from "@/modules/cotizaciones/paginas";

export const metadata: Metadata = { title: "Detalle de cotización" };

export default async function PaginaDetalleCotizacion({ params }: { params: Promise<{ id: string }> }) {
  const actor = await exigirPermisoPagina("cotizacion:ver");
  const cotizacion = await cargarCotizacion((await params).id);
  const permisos = { gestionar: can(actor, "cotizacion:gestionar"), enviar: can(actor, "cotizacion:enviar"),
    responder: can(actor, "cotizacion:responder") };
  return <>
    <PageHeader titulo={cotizacion.numero} descripcion={cotizacion.asunto ?? "Cotización"} />
    <div className="space-y-6">
      {cotizacion.archivada ? <Alert role="status"><Archive aria-hidden="true" /><AlertTitle>Cotización archivada</AlertTitle>
        <AlertDescription>Conserve los datos de esta cotización para consulta.</AlertDescription></Alert> : null}
      {cotizacion.avisos.map((aviso) => <Alert key={aviso} role="status"><CircleAlert aria-hidden="true" />
        <AlertTitle>Información de la cotización</AlertTitle><AlertDescription>{aviso}</AlertDescription></Alert>)}
      <AccionesCotizacion cotizacion={cotizacion} permisos={permisos} hoy={hoyManagua()} />
      <div className="grid gap-5 lg:grid-cols-3"><div className="lg:col-span-2"><DatosCotizacion cotizacion={cotizacion} /></div>
        <TotalesCotizacion totales={cotizacion} /></div>
      <section aria-labelledby="titulo-items"><h2 id="titulo-items" className="mb-4 text-xl font-semibold">Ítems de cotización</h2>
        <ItemsCotizacion items={cotizacion.items} /></section>
    </div>
  </>;
}
