import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CabeceraFicha } from "@/components/comunes/CabeceraFicha";
import { can } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { listarCategorias, listarMateriales } from "@/modules/catalogo/categorias";
import { EditorReceta } from "@/modules/catalogo/componentes/EditorReceta";
import { FormularioProducto } from "@/modules/catalogo/componentes/FormularioProducto";
import { cargarProducto } from "@/modules/catalogo/paginas";

export const metadata: Metadata = { title: "Editar producto" };
export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const actor = await exigirPermisoPagina("catalogo:gestionar");
  const producto = await cargarProducto((await params).id, actor);
  if (!producto.activo) redirect(`/catalogo/${producto.id}`);
  const puedeVerMateriales = can(actor, "inventario:ver");
  const [categorias, materiales] = await Promise.all([
    listarCategorias(), puedeVerMateriales ? listarMateriales({ activo: true }) : Promise.resolve([]),
  ]);
  return <>
    <CabeceraFicha titulo="Editar producto" volver={{ href: `/catalogo/${producto.id}`, etiqueta: producto.nombre }}
      meta={<span className="font-medium text-foreground">{producto.codigo}</span>} />
    <div className="flex flex-col gap-8">
      <FormularioProducto key={`producto-${producto.id}`} producto={producto} categorias={categorias} puedeVerCosto={can(actor, "cotizacion:ver")} />
      <EditorReceta key={`receta-${producto.actualizadoEn}`} producto={producto} materiales={materiales} puedeVerMateriales={puedeVerMateriales} />
    </div>
  </>;
}
