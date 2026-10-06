import type { Metadata } from "next";
import { PageHeader } from "@/components/comunes/PageHeader";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { FormularioMaterial } from "@/modules/inventario/componentes/FormularioMaterial";
import { cargarMaterial } from "@/modules/inventario/paginas";

export const metadata: Metadata = { title: "Editar material" };
export default async function PaginaEditarMaterial({ params }: { params: Promise<{ id: string }> }) {
  const actor = await exigirPermisoPagina("material:gestionar");
  const material = await cargarMaterial((await params).id, actor);
  return <><PageHeader titulo="Editar material" descripcion={material.nombre} />
    <FormularioMaterial key={material.actualizadoEn} material={material} /></>;
}
