import { redirect } from "next/navigation";

import { destinoPorPerfil } from "@/core/permisos";
import { obtenerSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

export default async function Inicio() {
  const sesion = await obtenerSesion();
  redirect(sesion ? destinoPorPerfil[sesion.perfil] : "/login");
}
