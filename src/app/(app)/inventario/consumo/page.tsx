import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { PageHeader } from "@/components/comunes/PageHeader";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { FormularioMovimientosOrden } from "@/modules/inventario/componentes/FormularioMovimientosOrden";

export const metadata: Metadata = { title: "Registrar consumo" };
export default async function Pagina({ searchParams }: { searchParams: Promise<{ ordenId?: string }> }) {
  await exigirPermisoPagina("inventario:consumir");
  await exigirPermisoPagina("orden:ver");
  const lectura = z.uuid().safeParse((await searchParams).ordenId);
  return <><PageHeader titulo="Registrar consumo" descripcion="Registre las cantidades por material." />
    {lectura.success ? <FormularioMovimientosOrden ordenId={lectura.data} tipo="consumo" />
      : <p>Seleccione una orden desde <Link className="text-primary underline" href="/ordenes">Órdenes de trabajo</Link>.</p>}</>;
}
