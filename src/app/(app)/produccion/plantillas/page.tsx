import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/comunes/PageHeader";
import { EmptyState } from "@/components/comunes/EmptyState";
import { FormField } from "@/components/comunes/FormField";
import { Button } from "@/components/ui/button";
import { can } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { AdministracionPlantillas } from "@/modules/produccion/componentes/AdministracionPlantillas";
import { listarPlantillas, opcionesProduccion } from "@/modules/produccion/service";

export const metadata: Metadata = { title: "Plantillas de producción" };
type Parametros = Record<string, string | string[] | undefined>;

export default async function PaginaPlantillas({ searchParams }: { searchParams: Promise<Parametros> }) {
  const actor = await exigirPermisoPagina("produccion:ver");
  const [parametros, opciones] = await Promise.all([searchParams, opcionesProduccion(actor)]);
  const categoria = opciones.categorias.find((categoria) => categoria.id === parametros.categoria) ?? opciones.categorias[0];
  const plantillas = categoria ? await listarPlantillas(categoria.id, actor) : [];
  return <><PageHeader titulo="Plantillas de producción" descripcion="Consulte las etapas que se copian al convertir una cotización." acciones={<>
    <Button asChild variant="outline"><Link href="/produccion">Ver tablero</Link></Button>
    <Button asChild variant="outline"><Link href="/produccion/areas">Ver áreas</Link></Button></>} />
    <div className="min-w-0 space-y-6"><form action="/produccion/plantillas" method="get" aria-label="Seleccionar categoría"
      className="flex flex-wrap items-end gap-3"><FormField id="categoria-plantillas" etiqueta="Categoría" className="w-full max-w-sm">
        {(atributos) => <select {...atributos} name="categoria" defaultValue={categoria?.id ?? ""} key={categoria?.id}
          className="h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 focus-visible:outline-2 focus-visible:outline-ring">
          {opciones.categorias.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>)}
        </select>}</FormField><Button type="submit" disabled={!categoria}>Consultar</Button></form>
      {categoria ? <section aria-labelledby="titulo-plantillas" className="min-w-0 space-y-4">
        <h2 id="titulo-plantillas" className="break-words text-xl font-semibold">{categoria.nombre}</h2>
        <AdministracionPlantillas key={`${categoria.id}:${plantillas.map((plantilla) => plantilla.actualizadoEn).join("|")}`}
          categoriaId={categoria.id} plantillas={plantillas}
          areas={opciones.areas.filter((area) => area.activo)} gestionar={can(actor, "catalogo:gestionar")} />
      </section> : <EmptyState titulo="Sin categorías" descripcion="Agregue una categoría al catálogo para definir sus plantillas." />}
    </div>
  </>;
}
