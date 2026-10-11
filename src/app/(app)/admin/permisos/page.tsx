import type { Metadata } from "next";

import { PageHeader } from "@/components/comunes/PageHeader";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { MatrizPermisos } from "@/modules/admin/componentes/MatrizPermisos";
import { listarPermisos } from "@/modules/admin/permisos-service";

export const metadata: Metadata = { title: "Perfiles y permisos" };

export default async function Pagina() {
  const actor = await exigirPermisoPagina("permiso:gestionar");
  const datos = await listarPermisos(actor);
  return (
    <div className="w-full min-w-0 max-w-full">
      <PageHeader titulo="Perfiles y permisos" descripcion="Asigne permisos por perfil. Revise las altas y bajas antes de guardar." />
      <MatrizPermisos datos={datos} />
    </div>
  );
}
