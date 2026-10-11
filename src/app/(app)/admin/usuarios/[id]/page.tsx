import type { Metadata } from "next";

import { PageHeader } from "@/components/comunes/PageHeader";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { FichaUsuario } from "@/modules/admin/componentes/FichaUsuario";
import { cargarUsuario } from "@/modules/admin/paginas";

export const metadata: Metadata = { title: "Ficha de usuario" };

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const actor = await exigirPermisoPagina("usuario:gestionar");
  const { id } = await params;
  const { usuario, ahora } = await cargarUsuario(id, actor);
  return (
    <div className="min-w-0">
      <PageHeader titulo="Ficha de usuario" descripcion="Edite los datos, gestione el acceso y reinicie la clave." />
      <FichaUsuario key={usuario.id} inicial={usuario} ahora={ahora} />
    </div>
  );
}
