import type { Metadata } from "next";
import { PageHeader } from "@/components/comunes/PageHeader";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { prisma } from "@/lib/db";
import { NuevaCotizacion } from "@/modules/cotizaciones/componentes/NuevaCotizacion";
import { configuracionCotizacion, consultarClientesSelector } from "@/modules/cotizaciones/repo";

export const metadata: Metadata = { title: "Nueva cotización" };

export default async function PaginaNuevaCotizacion() {
  await exigirPermisoPagina("cotizacion:gestionar");
  const [clientes, configuracion] = await Promise.all([consultarClientesSelector(), configuracionCotizacion(prisma)]);
  return <>
    <PageHeader titulo="Nueva cotización" descripcion="Seleccione el cliente y describa el trabajo." />
    <NuevaCotizacion clientes={clientes} condiciones={configuracion.condiciones} />
  </>;
}
