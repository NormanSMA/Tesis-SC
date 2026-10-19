import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { PageHeader } from "@/components/comunes/PageHeader";
import { Button } from "@/components/ui/button";
import { can } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { ProveedorLista } from "@/lib/listas/contexto-lista";
import { leerOrden, textoOrden } from "@/lib/listas/orden";
import { COOKIE_COLUMNAS_CLIENTES, columnasPermitidas } from "@/modules/clientes/columnas";
import { columnasDeLista } from "@/modules/clientes/componentes/columnasLista";
import { FiltrosClientes } from "@/modules/clientes/componentes/FiltrosClientes";
import { NuevoCliente } from "@/modules/clientes/componentes/NuevoCliente";
import { SelectorColumnas } from "@/modules/clientes/componentes/SelectorColumnas";
import { TablaClientes } from "@/modules/clientes/componentes/TablaClientes";
import { esquemaConsultaClientes, objetoDeParametros } from "@/modules/clientes/schema";
import { listarClientes } from "@/modules/clientes/service";
import { CAMPOS_ORDEN_CLIENTE, type ConteosClientes } from "@/modules/clientes/tipos";

export const metadata: Metadata = { title: "Clientes" };

type ParametrosPagina = Record<string, string | string[] | undefined>;
const PARAMETROS_URL = ["q", "tipo", "activo", "porPagina"] as const;

/** Traduce los parámetros de la URL a la consulta del servicio y a los parámetros que conservan los enlaces de paginación. */
function leerConsulta(parametros: ParametrosPagina) {
  const consulta = objetoDeParametros(parametros);
  const orden = leerOrden(consulta.orden, CAMPOS_ORDEN_CLIENTE);
  if (consulta.tipo === "todos") delete consulta.tipo;
  if (consulta.activo === "true") delete consulta.activo;
  const enlaces: Record<string, string> = {};
  for (const clave of PARAMETROS_URL) if (consulta[clave]) enlaces[clave] = consulta[clave];
  if (orden) { enlaces.orden = textoOrden(orden); consulta.orden = textoOrden(orden); } else delete consulta.orden;
  // Un parámetro inválido en la URL no debe romper la pantalla: se vuelve a la consulta por defecto.
  const lectura = esquemaConsultaClientes.safeParse(consulta);
  return { consulta: lectura.success ? lectura.data : esquemaConsultaClientes.parse({}), orden, enlaces };
}

export default async function PaginaClientes({ searchParams }: { searchParams: Promise<ParametrosPagina> }) {
  const actor = await exigirPermisoPagina("cliente:ver");
  const { consulta, orden, enlaces } = leerConsulta(await searchParams);
  const lista = await listarClientes(consulta, actor);
  const puedeGestionar = can(actor, "cliente:gestionar");
  const conCotizaciones = can(actor, "cotizacion:ver");
  const columnasVisibles = columnasPermitidas(
    columnasDeLista((await cookies()).get(COOKIE_COLUMNAS_CLIENTES)?.value), conCotizaciones);
  return <>
    <PageHeader titulo="Clientes" tituloVisible={false} descripcion="Personas y empresas que solicitan trabajos."
      acciones={<>
        <SelectorColumnas visibles={columnasVisibles} conCotizaciones={conCotizaciones} />
        {puedeGestionar ? <>
          <Button asChild variant="outline"><Link href="/importar?tipo=clientes">Importar CSV</Link></Button>
          <NuevoCliente devolverFoco />
        </> : null}
      </>} />
    <ProveedorLista>
      {/* Hasta que el servicio entregue los conteos, las pastillas se muestran sin contador. */}
      <FiltrosClientes conteos={lista.conteos as ConteosClientes | undefined} />
      <TablaClientes lista={lista} parametros={enlaces} orden={orden} puedeGestionar={puedeGestionar}
        conCotizaciones={conCotizaciones} columnasVisibles={columnasVisibles} />
    </ProveedorLista>
  </>;
}
