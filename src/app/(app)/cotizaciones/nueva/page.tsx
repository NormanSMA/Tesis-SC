import type { Metadata } from "next";
import { z } from "zod";
import { PageHeader } from "@/components/comunes/PageHeader";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { prisma } from "@/lib/db";
import { NuevaCotizacion } from "@/modules/cotizaciones/componentes/NuevaCotizacion";
import { configuracionCotizacion, consultarClientesSelector } from "@/modules/cotizaciones/repo";

export const metadata: Metadata = { title: "Nueva cotización" };

export default async function PaginaNuevaCotizacion({ searchParams }: {
  searchParams: Promise<{ clienteId?: string | string[] }>;
}) {
  await exigirPermisoPagina("cotizacion:gestionar");
  const [clientes, configuracion] = await Promise.all([consultarClientesSelector(), configuracionCotizacion(prisma)]);
  const parametro = z.uuid().safeParse((await searchParams).clienteId);
  const cliente = parametro.success
    ? await prisma.cliente.findFirst({ where: { id: parametro.data, activo: true }, select: { id: true } })
    : null;
  const clienteId = clientes.find(({ id }) => id === cliente?.id)?.id ?? "";
  return <>
    <PageHeader titulo="Nueva cotización" descripcion="Seleccione el cliente y describa el trabajo." />
    <NuevaCotizacion clientes={clientes} condiciones={configuracion.condiciones} clienteId={clienteId} />
  </>;
}
