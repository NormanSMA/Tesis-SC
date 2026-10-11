import type { Metadata } from "next";
import Link from "next/link";
import { Archive, CircleAlert } from "lucide-react";
import { PageHeader } from "@/components/comunes/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { can } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { AccionesCotizacion } from "@/modules/cotizaciones/componentes/AccionesCotizacion";
import { DatosCotizacion } from "@/modules/cotizaciones/componentes/DatosCotizacion";
import { EncabezadoCotizacion } from "@/modules/cotizaciones/componentes/EncabezadoCotizacion";
import { CostosInternosCotizacion, ItemsCotizacion } from "@/modules/cotizaciones/componentes/ItemsCotizacion";
import { TotalesCotizacion } from "@/modules/cotizaciones/componentes/TotalesCotizacion";
import { hoyManagua } from "@/modules/cotizaciones/fechas";
import { cargarCotizacion } from "@/modules/cotizaciones/paginas";
import { ordenDeCotizacion } from "@/modules/ordenes/service";

export const metadata: Metadata = { title: "Detalle de cotización" };

export default async function PaginaDetalleCotizacion({ params }: { params: Promise<{ id: string }> }) {
  const actor = await exigirPermisoPagina("cotizacion:ver");
  const cotizacion = await cargarCotizacion((await params).id);
  const orden = cotizacion.estado === "APROBADA" ? await ordenDeCotizacion(cotizacion.id, actor) : null;
  const permisos = { gestionar: can(actor, "cotizacion:gestionar"), enviar: can(actor, "cotizacion:enviar"),
    responder: can(actor, "cotizacion:responder") };
  return <>
    <PageHeader titulo={cotizacion.numero} descripcion={cotizacion.asunto ?? "Cotización"} />
    <div className="space-y-6">
      {cotizacion.archivada ? <Alert role="status"><Archive aria-hidden="true" /><AlertTitle>Cotización archivada</AlertTitle>
        <AlertDescription>Conserve los datos de esta cotización para consulta.</AlertDescription></Alert> : null}
      {cotizacion.avisos.map((aviso) => <Alert key={aviso} role="status"><CircleAlert aria-hidden="true" />
        <AlertTitle>Información de la cotización</AlertTitle><AlertDescription>{aviso}</AlertDescription></Alert>)}
      <EncabezadoCotizacion cotizacion={cotizacion}>
        <AccionesCotizacion cotizacion={cotizacion} permisos={permisos} hoy={hoyManagua()}>
          {orden && can(actor, "orden:ver") ? <Button asChild variant="outline">
            <Link href={`/trazabilidad/ordenes/${orden.id}`}>Trazabilidad completa</Link></Button> : null}
          {cotizacion.estado === "APROBADA" ? orden ? <Button asChild>
            <Link href={`/ordenes/${orden.id}`}>Ver orden {orden.numero}</Link></Button> : can(actor, "orden:crear") ?
            <Button asChild><Link href={`/ordenes/nueva?cotizacionId=${cotizacion.id}`}>Convertir en orden</Link></Button> : null : null}
        </AccionesCotizacion>
      </EncabezadoCotizacion>
      <div className="grid items-start gap-5 lg:grid-cols-3">
        <section aria-labelledby="titulo-items" className="min-w-0 lg:col-span-2">
          <h2 id="titulo-items" className="mb-4 text-xl font-semibold">Ítems de cotización</h2>
          <ItemsCotizacion items={cotizacion.items} mostrarCostos={false} /></section>
        <TotalesCotizacion totales={cotizacion} mostrarMargen={false} /></div>
      <DatosCotizacion cotizacion={cotizacion} />
      <CostosInternosCotizacion items={cotizacion.items} margenPct={cotizacion.margenPct} />
    </div>
  </>;
}
