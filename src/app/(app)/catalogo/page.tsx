import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/comunes/PageHeader";
import { Button } from "@/components/ui/button";
import { can } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { ProveedorLista } from "@/lib/listas/contexto-lista";
import { leerOrden, textoOrden } from "@/lib/listas/orden";
import { listarCategorias } from "@/modules/catalogo/categorias";
import { FiltrosCatalogo } from "@/modules/catalogo/componentes/FiltrosCatalogo";
import { TarjetasCatalogo } from "@/modules/catalogo/componentes/TarjetasCatalogo";
import { esquemaConsultaProductos, objetoDeParametros } from "@/modules/catalogo/schema";
import { listarProductos } from "@/modules/catalogo/service";
import { CAMPOS_ORDEN_PRODUCTO } from "@/modules/catalogo/tipos";

export const metadata: Metadata = { title: "Catálogo" };

export default async function Pagina({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await exigirPermisoPagina("catalogo:ver");
  const parametros = objetoDeParametros(await searchParams);
  const orden = leerOrden(parametros.orden, CAMPOS_ORDEN_PRODUCTO);
  if (orden) parametros.orden = textoOrden(orden); else delete parametros.orden;
  const lectura = esquemaConsultaProductos.safeParse(parametros);
  const consulta = lectura.success ? lectura.data : esquemaConsultaProductos.parse({});
  const [lista, categorias] = await Promise.all([listarProductos(consulta, actor), listarCategorias()]);
  const puedeGestionar = can(actor, "catalogo:gestionar");
  return <>
    <PageHeader titulo="Catálogo" tituloVisible={false} descripcion="Productos, precios y recetas de materiales."
      acciones={puedeGestionar ? <Button asChild><Link href="/catalogo/nuevo">Nuevo producto</Link></Button> : null} />
    <ProveedorLista>
      <FiltrosCatalogo categorias={categorias} />
      <TarjetasCatalogo lista={lista} consulta={consulta} puedeGestionar={puedeGestionar} />
    </ProveedorLista>
  </>;
}
