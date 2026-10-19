import type { Metadata } from "next";
import { CabeceraFicha } from "@/components/comunes/CabeceraFicha";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { FormularioMaterial } from "@/modules/inventario/componentes/FormularioMaterial";

export const metadata: Metadata = { title: "Nuevo material" };
export default async function PaginaNuevoMaterial() {
  await exigirPermisoPagina("material:gestionar");
  return <><CabeceraFicha titulo="Nuevo material" meta="El material se crea con existencia cero."
    volver={{ href: "/inventario", etiqueta: "Inventario" }} /><FormularioMaterial /></>;
}
