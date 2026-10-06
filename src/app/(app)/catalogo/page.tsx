import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/comunes/PageHeader";
import { Button } from "@/components/ui/button";
import { can } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { listarCategorias } from "@/modules/catalogo/categorias";
import { FiltrosCatalogo } from "@/modules/catalogo/componentes/FiltrosCatalogo";
import { TarjetasCatalogo } from "@/modules/catalogo/componentes/TarjetasCatalogo";
import { esquemaConsultaProductos, objetoDeParametros } from "@/modules/catalogo/schema";
import { listarProductos } from "@/modules/catalogo/service";

export const metadata: Metadata = { title: "Catálogo" };

export default async function Pagina({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await exigirPermisoPagina("catalogo:ver");
  const lectura = esquemaConsultaProductos.safeParse(objetoDeParametros(await searchParams));
  const consulta = lectura.success ? lectura.data : esquemaConsultaProductos.parse({});
  const [lista, categorias] = await Promise.all([listarProductos(consulta), listarCategorias()]);
  const puedeGestionar = can(actor, "catalogo:gestionar");
  return <>
    <PageHeader titulo="Catálogo" descripcion="Productos, precios y recetas de materiales."
      acciones={puedeGestionar ? <Button asChild><Link href="/catalogo/nuevo">Nuevo producto</Link></Button> : null} />
    <FiltrosCatalogo key={JSON.stringify(consulta)} consulta={consulta} categorias={categorias} />
    <TarjetasCatalogo lista={lista} consulta={consulta} puedeGestionar={puedeGestionar} />
  </>;
}
