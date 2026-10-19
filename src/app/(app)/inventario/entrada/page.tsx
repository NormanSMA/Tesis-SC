import type { Metadata } from "next";
import { CabeceraFicha } from "@/components/comunes/CabeceraFicha";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { FormularioLibro } from "@/modules/inventario/componentes/FormularioLibro";
import { cargarMaterial } from "@/modules/inventario/paginas";

export const metadata: Metadata = { title: "Registrar entrada" };
export default async function Pagina({ searchParams }: { searchParams: Promise<{ materialId?: string }> }) {
  const actor = await exigirPermisoPagina("inventario:entrada");
  const { materialId } = await searchParams;
  const inicial = materialId ? await cargarMaterial(materialId, actor) : undefined;
  return <div className="mx-auto w-full min-w-0 max-w-2xl"><CabeceraFicha titulo="Registrar entrada"
    volver={{ href: "/inventario", etiqueta: "Inventario" }} /><FormularioLibro tipo="entrada" inicial={inicial} /></div>;
}
