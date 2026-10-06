import type { Metadata } from "next";

import { PageHeader } from "@/components/comunes/PageHeader";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { FormularioCliente } from "@/modules/clientes/componentes/FormularioCliente";

export const metadata: Metadata = { title: "Nuevo cliente" };

export default async function PaginaNuevoCliente() {
  await exigirPermisoPagina("cliente:gestionar");
  return (
    <>
      <PageHeader
        titulo="Nuevo cliente"
        descripcion="Registre una persona o empresa. Indique al menos un teléfono o un correo."
      />
      <FormularioCliente modo="crear" />
    </>
  );
}
