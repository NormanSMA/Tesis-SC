import type { Metadata } from "next";

import { UserPlus } from "lucide-react";

import { CabeceraFicha, MarcaIcono } from "@/components/comunes/CabeceraFicha";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { NuevoUsuario } from "@/modules/admin/componentes/FormularioUsuario";

export const metadata: Metadata = { title: "Nuevo usuario" };

export default async function Pagina() {
  await exigirPermisoPagina("usuario:gestionar");
  return (
    <div className="min-w-0">
      <CabeceraFicha titulo="Nuevo usuario" volver={{ href: "/admin/usuarios", etiqueta: "Usuarios" }}
        marca={<MarcaIcono><UserPlus /></MarcaIcono>} meta="Copie la clave temporal después de crear el usuario." className="mx-auto max-w-5xl" />
      <NuevoUsuario />
    </div>
  );
}
