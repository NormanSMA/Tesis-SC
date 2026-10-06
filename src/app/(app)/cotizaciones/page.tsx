import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/comunes/PageHeader";
import { Button } from "@/components/ui/button";
import { can } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { FiltrosCotizaciones } from "@/modules/cotizaciones/componentes/FiltrosCotizaciones";
import { TablaCotizaciones } from "@/modules/cotizaciones/componentes/TablaCotizaciones";
import { consultarClientesSelector } from "@/modules/cotizaciones/repo";
import { esquemaConsultaCotizaciones, objetoDeParametros } from "@/modules/cotizaciones/schema";
import { listarCotizaciones } from "@/modules/cotizaciones/service";

export const metadata: Metadata = { title: "Cotizaciones" };

function leerConsulta(parametros: Record<string, string | string[] | undefined>) {
  const consulta = objetoDeParametros(parametros);
  if (consulta.estado === "__todos__") delete consulta.estado;
  if (consulta.cliente === "__todos__") delete consulta.cliente;
  const lectura = esquemaConsultaCotizaciones.safeParse(consulta);
  return lectura.success ? lectura.data : esquemaConsultaCotizaciones.parse({});
}

export default async function PaginaCotizaciones({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await exigirPermisoPagina("cotizacion:ver");
  const consulta = leerConsulta(await searchParams);
  const [lista, clientes] = await Promise.all([listarCotizaciones(consulta), consultarClientesSelector()]);
  const puedeGestionar = can(actor, "cotizacion:gestionar");
  return <>
    <PageHeader titulo="Cotizaciones" descripcion="Proformas con catálogo y trabajos personalizados."
      acciones={puedeGestionar ? <Button asChild><Link href="/cotizaciones/nueva">Nueva cotización</Link></Button> : null} />
    <FiltrosCotizaciones consulta={consulta} clientes={clientes} />
    <TablaCotizaciones lista={lista} consulta={consulta} puedeGestionar={puedeGestionar} />
  </>;
}
