import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { Archive, Calculator, CircleAlert } from "lucide-react";
import { CabeceraFicha, MarcaIcono } from "@/components/comunes/CabeceraFicha";
import { TarjetaSeccion } from "@/components/comunes/TarjetaSeccion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { can } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { AccionesCotizacion } from "@/modules/cotizaciones/componentes/AccionesCotizacion";
import { DatosCotizacion } from "@/modules/cotizaciones/componentes/DatosCotizacion";
import { accionesDisponibles } from "@/modules/cotizaciones/componentes/accionesDisponibles";
import { EncabezadoCotizacion } from "@/modules/cotizaciones/componentes/EncabezadoCotizacion";
import { EstadoCotizacion } from "@/modules/cotizaciones/componentes/EstadoCotizacion";
import { monedaDe } from "@/modules/cotizaciones/moneda";
import { CostosInternosCotizacion, ItemsCotizacion } from "@/modules/cotizaciones/componentes/ItemsCotizacion";
import { TotalesCotizacion } from "@/modules/cotizaciones/componentes/TotalesCotizacion";
import { hoyManagua } from "@/modules/cotizaciones/fechas";
import { cargarCotizacion } from "@/modules/cotizaciones/paginas";
import { consultarCategoriasSelector } from "@/modules/cotizaciones/repo";
import { ordenDeCotizacion } from "@/modules/ordenes/service";

const cargarPagina = cache(async (id: string) => {
  const actor = await exigirPermisoPagina("cotizacion:ver");
  return { actor, cotizacion: await cargarCotizacion(id) };
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { cotizacion } = await cargarPagina((await params).id);
  return { title: `Cotización ${cotizacion.numero}` };
}

export default async function PaginaDetalleCotizacion({ params }: { params: Promise<{ id: string }> }) {
  const { actor, cotizacion } = await cargarPagina((await params).id);
  const [categorias, orden] = await Promise.all([
    consultarCategoriasSelector(),
    cotizacion.estado === "APROBADA" ? ordenDeCotizacion(cotizacion.id, actor) : null,
  ]);
  const permisos = { gestionar: can(actor, "cotizacion:gestionar"), enviar: can(actor, "cotizacion:enviar"),
    responder: can(actor, "cotizacion:responder") };
  const ordenVisible = orden && can(actor, "orden:ver") ? orden : null;
  const { siguientePaso } = accionesDisponibles({ cotizacion, permisos });
  return <>
    <CabeceraFicha titulo={cotizacion.numero} marca={<MarcaIcono><Calculator /></MarcaIcono>}
      volver={{ href: "/cotizaciones", etiqueta: "Cotizaciones" }}
      className="max-sm:[&>div:last-child]:flex-col max-sm:[&>div:last-child>div]:w-full"
      meta={<><span>{cotizacion.cliente.nombre}</span><EstadoCotizacion estado={cotizacion.estado} />
        {cotizacion.version > 1 ? <span>Versión {cotizacion.version}</span> : null}
        {cotizacion.asunto ? <span className="break-words">{cotizacion.asunto}</span> : null}</>}
      acciones={<AccionesCotizacion cotizacion={cotizacion} permisos={permisos} hoy={hoyManagua()}>
        {cotizacion.estado === "APROBADA" ? orden ? <Button asChild>
          <Link href={`/ordenes/${orden.id}`}>Ver orden {orden.numero}</Link></Button> : can(actor, "orden:crear") ?
          <Button asChild><Link href={`/ordenes/nueva?cotizacionId=${cotizacion.id}`}>Convertir en orden</Link></Button> : null : null}
        {ordenVisible ? <Button asChild variant="outline">
          <Link href={`/trazabilidad/ordenes/${ordenVisible.id}`}>Trazabilidad completa</Link></Button> : null}
      </AccionesCotizacion>} />
    <div className="min-w-0 space-y-4">
      {cotizacion.archivada ? <Alert role="status"><Archive aria-hidden="true" /><AlertTitle>Cotización archivada</AlertTitle>
        <AlertDescription>Conserve los datos de esta cotización para consulta.</AlertDescription></Alert> : null}
      {cotizacion.avisos.map((aviso) => <Alert key={aviso} role="status"><CircleAlert aria-hidden="true" />
        <AlertTitle>Información de la cotización</AlertTitle><AlertDescription>{aviso}</AlertDescription></Alert>)}
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <TarjetaSeccion titulo="Ítems de cotización" sinRelleno className="lg:col-span-2">
          <ItemsCotizacion items={cotizacion.items} mostrarCostos={false} categorias={categorias} moneda={monedaDe(cotizacion.moneda)} sinMarco apilarEnMovil />
        </TarjetaSeccion>
        <div className="min-w-0 space-y-4">
          <TotalesCotizacion totales={cotizacion} moneda={cotizacion.moneda} mostrarMargen={false} />
          <div className="rounded-xl border border-border/80 bg-card p-5 text-sm shadow-sm">
            <span className="font-semibold">Siguiente paso:</span> {siguientePaso}</div>
          <EncabezadoCotizacion cotizacion={cotizacion} />
        </div>
      </div>
      <DatosCotizacion cotizacion={cotizacion} />
      <CostosInternosCotizacion items={cotizacion.items} margenPct={cotizacion.margenPct} moneda={monedaDe(cotizacion.moneda)} />
    </div>
  </>;
}
