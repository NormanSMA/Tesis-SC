import type { Metadata } from "next";

import { PageHeader } from "@/components/comunes/PageHeader";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { ProveedorLista } from "@/lib/listas/contexto-lista";
import { leerOrden, textoOrden } from "@/lib/listas/orden";
import { FiltrosOrdenes } from "@/modules/ordenes/componentes/FiltrosOrdenes";
import { TablaOrdenes } from "@/modules/ordenes/componentes/TablaOrdenes";
import { consultarResponsables } from "@/modules/ordenes/repo";
import { ESTADOS, esquemaConsultaOrdenes, objetoDeParametros } from "@/modules/ordenes/schema";
import { listarOrdenes } from "@/modules/ordenes/service";
import { CAMPOS_ORDEN_ORDENES } from "@/modules/ordenes/tipos";

export const metadata: Metadata = { title: "Órdenes de trabajo" };

type ParametrosPagina = Record<string, string | string[] | undefined>;
const PARAMETROS_URL = ["q", "vista", "responsable", "cliente", "porPagina"] as const;
const TERMINALES: readonly string[] = ["ENTREGADA", "CERRADA", "CANCELADA"];

/**
 * Traduce los parámetros de la URL a la consulta del servicio y a los parámetros que conservan los enlaces.
 * La vista decide estado, atraso y terminales; sin vista se listan las órdenes activas.
 */
function leerConsulta(parametros: ParametrosPagina) {
  const consulta = objetoDeParametros(parametros);
  const orden = leerOrden(consulta.orden, CAMPOS_ORDEN_ORDENES);
  const vista = consulta.vista;
  const vistaEstado = (ESTADOS as readonly string[]).includes(vista ?? "");
  if (vista && vista !== "activas" && !vistaEstado && vista !== "ATRASADAS" && vista !== "SIN_RESPONSABLE") delete consulta.vista;
  if (consulta.responsable === "__todos__") delete consulta.responsable;
  const enlaces: Record<string, string> = {};
  for (const clave of PARAMETROS_URL) if (consulta[clave]) enlaces[clave] = consulta[clave];
  if (orden) enlaces.orden = textoOrden(orden);
  delete consulta.estado; delete consulta.vencidas; delete consulta.terminales;
  if (vistaEstado && vista) {
    consulta.estado = vista;
    if (TERMINALES.includes(vista)) consulta.terminales = "todas";
  } else if (vista === "ATRASADAS") consulta.vencidas = "true";
  else if (vista === "SIN_RESPONSABLE") consulta.responsable = "sin-responsable";
  if (orden) consulta.orden = textoOrden(orden); else delete consulta.orden;
  const lectura = esquemaConsultaOrdenes.safeParse(consulta);
  return { consulta: lectura.success ? lectura.data : esquemaConsultaOrdenes.parse({}), orden, enlaces };
}

export default async function PaginaOrdenes({ searchParams }: { searchParams: Promise<ParametrosPagina> }) {
  const actor = await exigirPermisoPagina("orden:ver");
  const { consulta, orden, enlaces } = leerConsulta(await searchParams);
  const [lista, responsables] = await Promise.all([listarOrdenes(consulta, actor), consultarResponsables()]);
  // Referencia fija del servidor: el texto relativo de la entrega no cambia al hidratar.
  const referencia = new Date().toISOString();
  return <>
    <PageHeader titulo="Órdenes de trabajo" tituloVisible={false} descripcion="Consulte las órdenes, sus etapas y las fechas de entrega." />
    <ProveedorLista>
      <FiltrosOrdenes conteos={lista.conteos} responsables={responsables} />
      <TablaOrdenes lista={lista} parametros={enlaces} orden={orden} referencia={referencia} />
    </ProveedorLista>
  </>;
}
