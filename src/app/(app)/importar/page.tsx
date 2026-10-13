import type { Metadata } from "next";

import { PageHeader } from "@/components/comunes/PageHeader";
import { can } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { ImportadorCsv } from "@/modules/importacion/componentes/ImportadorCsv";
import type { TipoImportacion } from "@/modules/importacion/tipos";

export const metadata: Metadata = { title: "Importar CSV" };

async function exigirImportacion() {
  try {
    return await exigirPermisoPagina("cliente:gestionar");
  } catch {
    return exigirPermisoPagina("material:gestionar");
  }
}

export default async function PaginaImportar({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await exigirImportacion();
  const tipos: TipoImportacion[] = [];
  if (can(actor, "cliente:gestionar")) tipos.push("clientes");
  if (can(actor, "material:gestionar")) tipos.push("materiales");
  const { tipo } = await searchParams;
  const inicial = tipo === "clientes" || tipo === "materiales" ? tipo : undefined;
  return <>
    <PageHeader titulo="Importar CSV" descripcion="Importación piloto de clientes y materiales." />
    {tipos.length ? <ImportadorCsv tipos={tipos} inicial={inicial} />
      : <p role="alert">Su perfil no tiene permiso para importar clientes ni materiales.</p>}
  </>;
}
