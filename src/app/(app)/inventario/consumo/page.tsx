import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { CabeceraFicha } from "@/components/comunes/CabeceraFicha";
import { EmptyState } from "@/components/comunes/EmptyState";
import { Button } from "@/components/ui/button";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { cargarOrden } from "@/modules/ordenes/paginas";
import { FormularioMovimientosOrden } from "@/modules/inventario/componentes/FormularioMovimientosOrden";

export const metadata: Metadata = { title: "Registrar consumo" };
export default async function Pagina({ searchParams }: { searchParams: Promise<{ ordenId?: string }> }) {
  await exigirPermisoPagina("inventario:consumir");
  const actor = await exigirPermisoPagina("orden:ver");
  const lectura = z.uuid().safeParse((await searchParams).ordenId);
  const orden = lectura.success ? await cargarOrden(lectura.data, actor) : null;
  return <div className="mx-auto w-full min-w-0 max-w-2xl"><CabeceraFicha titulo="Registrar consumo" meta="Registre las cantidades por material."
    volver={{ href: "/inventario", etiqueta: "Inventario" }} />
    {lectura.success && orden ? <FormularioMovimientosOrden ordenId={lectura.data} numeroOrden={orden.numero} tipo="consumo" />
      : <EmptyState titulo="Seleccione una orden desde Órdenes de trabajo." accion={<Button asChild variant="outline" className="max-sm:w-full">
        <Link href="/ordenes">Órdenes de trabajo</Link></Button>} className="max-sm:[&>div:last-child]:w-full" />}</div>;
}
