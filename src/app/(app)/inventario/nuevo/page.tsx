import type { Metadata } from "next";
import { PageHeader } from "@/components/comunes/PageHeader";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { FormularioMaterial } from "@/modules/inventario/componentes/FormularioMaterial";

export const metadata: Metadata = { title: "Nuevo material" };
export default async function PaginaNuevoMaterial() {
  await exigirPermisoPagina("material:gestionar");
  return <><PageHeader titulo="Nuevo material" descripcion="El material se crea con existencia cero." /><FormularioMaterial /></>;
}
