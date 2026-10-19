import type { Metadata } from "next";

import { CabeceraFicha } from "@/components/comunes/CabeceraFicha";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { FormularioCliente } from "@/modules/clientes/componentes/FormularioCliente";

export const metadata: Metadata = { title: "Nuevo cliente" };

export default async function PaginaNuevoCliente() {
  await exigirPermisoPagina("cliente:gestionar");
  return (
    <>
      <CabeceraFicha
        titulo="Nuevo cliente"
        volver={{ href: "/clientes", etiqueta: "Clientes" }}
        meta={<span>Registre una persona o empresa.</span>}
      />
      <FormularioCliente modo="crear" />
    </>
  );
}
