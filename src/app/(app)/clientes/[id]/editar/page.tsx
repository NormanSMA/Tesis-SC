import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CabeceraFicha } from "@/components/comunes/CabeceraFicha";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { FormularioCliente } from "@/modules/clientes/componentes/FormularioCliente";
import { cargarCliente } from "@/modules/clientes/paginas";

export const metadata: Metadata = { title: "Editar cliente" };

export default async function PaginaEditarCliente({ params }: { params: Promise<{ id: string }> }) {
  await exigirPermisoPagina("cliente:gestionar");
  const cliente = await cargarCliente((await params).id);
  // Un cliente archivado no se edita: se reactiva primero desde su ficha.
  if (!cliente.activo) redirect(`/clientes/${cliente.id}`);
  return (
    <>
      <CabeceraFicha
        titulo="Editar cliente"
        volver={{ href: `/clientes/${cliente.id}`, etiqueta: cliente.nombre }}
        meta={<span className="font-medium text-foreground">{cliente.codigoCliente}</span>}
      />
      <FormularioCliente key={cliente.actualizadoEn} modo="editar" cliente={cliente} />
    </>
  );
}
