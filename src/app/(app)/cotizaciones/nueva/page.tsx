import type { Metadata } from "next";
import { z } from "zod";
import { Calculator } from "lucide-react";
import { CabeceraFicha, MarcaIcono } from "@/components/comunes/CabeceraFicha";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { prisma } from "@/lib/db";
import { puedeCrearCliente } from "@/modules/clientes/acceso";
import { NuevaCotizacion } from "@/modules/cotizaciones/componentes/NuevaCotizacion";
import { configuracionCotizacion, consultarClientesSelector, consultarSelectores } from "@/modules/cotizaciones/repo";

export const metadata: Metadata = { title: "Nueva cotización" };

export default async function PaginaNuevaCotizacion({ searchParams }: {
  searchParams: Promise<{ clienteId?: string | string[] }>;
}) {
  const actor = await exigirPermisoPagina("cotizacion:gestionar");
  const parametro = z.uuid().safeParse((await searchParams).clienteId);
  const [clientes, configuracion, selectores] = await Promise.all([
    consultarClientesSelector(parametro.data, true), configuracionCotizacion(prisma), consultarSelectores(),
  ]);
  const clienteId = clientes[0]?.id ?? "";
  return <>
    <CabeceraFicha titulo="Nueva cotización" marca={<MarcaIcono><Calculator /></MarcaIcono>}
      volver={{ href: "/cotizaciones", etiqueta: "Cotizaciones" }} meta={<span>Seleccione el cliente y describa el trabajo.</span>} />
    <NuevaCotizacion {...configuracion} clientes={clientes} clienteId={clienteId} selectores={selectores}
      puedeCrearCliente={puedeCrearCliente(actor)} />
  </>;
}
