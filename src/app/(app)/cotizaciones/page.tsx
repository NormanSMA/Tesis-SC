import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/comunes/PageHeader";
import { Button } from "@/components/ui/button";
import { can } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { ProveedorLista } from "@/lib/listas/contexto-lista";
import { leerOrden, textoOrden } from "@/lib/listas/orden";
import { FiltrosCotizaciones } from "@/modules/cotizaciones/componentes/FiltrosCotizaciones";
import { TablaCotizaciones } from "@/modules/cotizaciones/componentes/TablaCotizaciones";
import { consultarClientesSelector } from "@/modules/cotizaciones/repo";
import { esquemaConsultaCotizaciones, objetoDeParametros } from "@/modules/cotizaciones/schema";
import { listarCotizaciones } from "@/modules/cotizaciones/service";
import { CAMPOS_ORDEN_COTIZACION } from "@/modules/cotizaciones/tipos";

export const metadata: Metadata = { title: "Cotizaciones" };

type ParametrosPagina = Record<string, string | string[] | undefined>;
const PARAMETROS_URL = ["q", "estado", "cliente", "archivadas", "porPagina"] as const;

/** Traduce los parámetros de la URL a la consulta del servicio y a los parámetros que conservan los enlaces de paginación. */
function leerConsulta(parametros: ParametrosPagina) {
  const consulta = objetoDeParametros(parametros);
  const orden = leerOrden(consulta.orden, CAMPOS_ORDEN_COTIZACION);
  const enlaces: Record<string, string> = {};
  for (const clave of PARAMETROS_URL) if (consulta[clave]) enlaces[clave] = consulta[clave];
  if (orden) enlaces.orden = textoOrden(orden);
  if (consulta.estado === "todas") delete consulta.estado;
  if (consulta.cliente === "__todos__") delete consulta.cliente;
  if (consulta.estado === "POR_VENCER") { delete consulta.estado; consulta.porVencer = "true"; }
  if (orden) consulta.orden = textoOrden(orden); else delete consulta.orden;
  const lectura = esquemaConsultaCotizaciones.safeParse(consulta);
  return { consulta: lectura.success ? lectura.data : esquemaConsultaCotizaciones.parse({}), orden, enlaces };
}

export default async function PaginaCotizaciones({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await exigirPermisoPagina("cotizacion:ver");
  const parametros = await searchParams;
  const puedeGestionar = can(actor, "cotizacion:gestionar");
  if (puedeGestionar && parametros.crear === "1") {
    const clienteId = typeof parametros.clienteId === "string" ? `?clienteId=${encodeURIComponent(parametros.clienteId)}` : "";
    redirect(`/cotizaciones/nueva${clienteId}`);
  }
  const { consulta, orden, enlaces } = leerConsulta(parametros);
  const [lista, clientes] = await Promise.all([listarCotizaciones(consulta, actor), consultarClientesSelector(consulta.cliente)]);
  return <>
    <PageHeader titulo="Cotizaciones" tituloVisible={false} descripcion="Proformas con catálogo y trabajos personalizados."
      acciones={puedeGestionar ? <Button asChild><Link href="/cotizaciones/nueva">Nueva cotización</Link></Button> : null} />
    <ProveedorLista>
      <FiltrosCotizaciones conteos={lista.conteos} clientes={clientes} />
      <TablaCotizaciones lista={lista} parametros={enlaces} orden={orden} puedeGestionar={puedeGestionar} />
    </ProveedorLista>
  </>;
}
