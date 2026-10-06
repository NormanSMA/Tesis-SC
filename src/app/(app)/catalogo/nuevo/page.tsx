import type { Metadata } from "next";

import { PageHeader } from "@/components/comunes/PageHeader";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { listarCategorias } from "@/modules/catalogo/categorias";
import { FormularioProducto } from "@/modules/catalogo/componentes/FormularioProducto";

export const metadata: Metadata = { title: "Nuevo producto" };
export default async function Pagina() {
  await exigirPermisoPagina("catalogo:gestionar");
  return <>
    <PageHeader titulo="Nuevo producto" descripcion="Defina el producto y su precio base. Agregue su receta después de crearlo." />
    <FormularioProducto categorias={await listarCategorias()} />
  </>;
}
