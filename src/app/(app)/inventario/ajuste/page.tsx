import type { Metadata } from "next";
import { PageHeader } from "@/components/comunes/PageHeader";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { FormularioLibro } from "@/modules/inventario/componentes/FormularioLibro";
import { cargarMaterial } from "@/modules/inventario/paginas";

export const metadata: Metadata = { title: "Ajustar inventario" };
export default async function Pagina({ searchParams }: { searchParams: Promise<{ materialId?: string }> }) {
  const actor = await exigirPermisoPagina("inventario:ajustar");
  const { materialId } = await searchParams;
  const inicial = materialId ? await cargarMaterial(materialId, actor) : undefined;
  return <><PageHeader titulo="Ajustar inventario" /><FormularioLibro tipo="ajuste" inicial={inicial} /></>;
}
