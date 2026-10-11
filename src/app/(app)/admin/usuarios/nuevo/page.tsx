import type { Metadata } from "next";

import { PageHeader } from "@/components/comunes/PageHeader";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { NuevoUsuario } from "@/modules/admin/componentes/FormularioUsuario";

export const metadata: Metadata = { title: "Nuevo usuario" };

export default async function Pagina() {
  await exigirPermisoPagina("usuario:gestionar");
  return (
    <div className="min-w-0">
      <PageHeader titulo="Nuevo usuario" descripcion="Registre los datos y asigne perfiles. Copie la clave temporal después de crear el usuario." />
      <NuevoUsuario />
    </div>
  );
}
