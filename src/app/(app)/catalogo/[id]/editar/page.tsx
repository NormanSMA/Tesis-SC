import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/comunes/PageHeader";
import { can } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { listarCategorias, listarMateriales } from "@/modules/catalogo/categorias";
import { EditorReceta } from "@/modules/catalogo/componentes/EditorReceta";
import { FormularioProducto } from "@/modules/catalogo/componentes/FormularioProducto";
import { cargarProducto } from "@/modules/catalogo/paginas";

export const metadata: Metadata = { title: "Editar producto" };
export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const actor = await exigirPermisoPagina("catalogo:gestionar");
  const producto = await cargarProducto((await params).id);
  if (!producto.activo) redirect(`/catalogo/${producto.id}`);
  const puedeVerMateriales = can(actor, "inventario:ver");
  const [categorias, materiales] = await Promise.all([
    listarCategorias(), puedeVerMateriales ? listarMateriales({ activo: true }) : Promise.resolve([]),
  ]);
  return <>
    <PageHeader titulo="Editar producto" descripcion={producto.nombre} />
    <div className="flex flex-col gap-8">
      <FormularioProducto key={`producto-${producto.actualizadoEn}`} producto={producto} categorias={categorias} />
      <EditorReceta key={`receta-${producto.actualizadoEn}`} producto={producto} materiales={materiales} puedeVerMateriales={puedeVerMateriales} />
    </div>
  </>;
}
