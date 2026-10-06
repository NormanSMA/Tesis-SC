import type { Metadata } from "next";

import { PageHeader } from "@/components/comunes/PageHeader";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { FiltrosOrdenes } from "@/modules/ordenes/componentes/FiltrosOrdenes";
import { TablaOrdenes } from "@/modules/ordenes/componentes/TablaOrdenes";
import { consultarResponsables } from "@/modules/ordenes/repo";
import { esquemaConsultaOrdenes, objetoDeParametros } from "@/modules/ordenes/schema";
import { listarOrdenes } from "@/modules/ordenes/service";

export const metadata: Metadata = { title: "Órdenes de trabajo" };

function leerConsulta(parametros: Record<string, string | string[] | undefined>) {
  const consulta = objetoDeParametros(parametros);
  if (consulta.estado === "__todos__") delete consulta.estado;
  if (consulta.responsable === "__todos__") delete consulta.responsable;
  const lectura = esquemaConsultaOrdenes.safeParse(consulta);
  return lectura.success ? lectura.data : esquemaConsultaOrdenes.parse({});
}

export default async function PaginaOrdenes({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await exigirPermisoPagina("orden:ver");
  const consulta = leerConsulta(await searchParams);
  const [lista, responsables] = await Promise.all([listarOrdenes(consulta, actor), consultarResponsables()]);
  return <>
    <PageHeader titulo="Órdenes de trabajo" descripcion="Consulte las órdenes, sus etapas y las fechas de entrega." />
    <FiltrosOrdenes consulta={consulta} responsables={responsables} />
    <TablaOrdenes lista={lista} consulta={consulta} />
  </>;
}
