import type { Metadata } from "next";
import { CabeceraFicha } from "@/components/comunes/CabeceraFicha";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { FormularioMaterial } from "@/modules/inventario/componentes/FormularioMaterial";
import { cargarMaterial } from "@/modules/inventario/paginas";

export const metadata: Metadata = { title: "Editar material" };
export default async function PaginaEditarMaterial({ params }: { params: Promise<{ id: string }> }) {
  const actor = await exigirPermisoPagina("material:gestionar");
  const material = await cargarMaterial((await params).id, actor);
  return <><CabeceraFicha titulo="Editar material" meta={material.nombre}
    volver={{ href: `/inventario/${material.id}`, etiqueta: "Volver al material" }} />
    <FormularioMaterial key={material.actualizadoEn} material={material} /></>;
}
