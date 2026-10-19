import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/comunes/PageHeader";
import { EmptyState } from "@/components/comunes/EmptyState";
import { Button } from "@/components/ui/button";
import { can } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { ProveedorLista } from "@/lib/listas/contexto-lista";
import { AdministracionPlantillas } from "@/modules/produccion/componentes/AdministracionPlantillas";
import { filtrarCatalogo } from "@/modules/produccion/componentes/filtrarCatalogo";
import { listarPlantillas, opcionesProduccion } from "@/modules/produccion/service";

export const metadata: Metadata = { title: "Plantillas de producción" };
type Parametros = Record<string, string | string[] | undefined>;

export default async function PaginaPlantillas({ searchParams }: { searchParams: Promise<Parametros> }) {
  const actor = await exigirPermisoPagina("produccion:ver");
  const [parametros, opciones] = await Promise.all([searchParams, opcionesProduccion(actor)]);
  const categoria = opciones.categorias.find((categoria) => categoria.id === parametros.categoria) ?? opciones.categorias[0];
  const plantillas = categoria ? await listarPlantillas(categoria.id, actor) : [];
  const { filtradas, conteos } = filtrarCatalogo(plantillas, parametros, (plantilla) => `${plantilla.nombre} ${plantilla.area.nombre}`);
  return <><PageHeader titulo="Plantillas de producción" tituloVisible={false}
    descripcion="Consulte las etapas que se copian al convertir una cotización." acciones={<>
      <Button asChild variant="outline"><Link href="/produccion">Ver tablero</Link></Button>
      <Button asChild variant="outline"><Link href="/produccion/areas">Ver áreas</Link></Button></>} />
    {categoria ? <ProveedorLista>
      <AdministracionPlantillas key={`${categoria.id}:${plantillas.map((plantilla) => plantilla.actualizadoEn).join("|")}`}
        categoriaId={categoria.id} categorias={opciones.categorias} plantillas={filtradas} conteos={conteos}
        areas={opciones.areas.filter((area) => area.activo)} gestionar={can(actor, "catalogo:gestionar")} />
    </ProveedorLista> : <EmptyState titulo="Sin categorías" descripcion="Agregue una categoría al catálogo para definir sus plantillas." />}
  </>;
}
