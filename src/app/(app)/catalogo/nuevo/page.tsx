import type { Metadata } from "next";

import { CabeceraFicha } from "@/components/comunes/CabeceraFicha";
import { can } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { listarCategorias } from "@/modules/catalogo/categorias";
import { FormularioProducto } from "@/modules/catalogo/componentes/FormularioProducto";

export const metadata: Metadata = { title: "Nuevo producto" };
export default async function Pagina() {
  const actor = await exigirPermisoPagina("catalogo:gestionar");
  return <>
    <CabeceraFicha titulo="Nuevo producto" volver={{ href: "/catalogo", etiqueta: "Catálogo" }}
      meta={<span>Defina el producto y su precio base. Agregue su receta después de crearlo.</span>} />
    <FormularioProducto categorias={await listarCategorias()} puedeVerCosto={can(actor, "cotizacion:ver")} />
  </>;
}
