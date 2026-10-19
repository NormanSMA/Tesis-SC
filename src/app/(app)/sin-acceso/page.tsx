import { ShieldOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/comunes/EmptyState";
import { PageHeader } from "@/components/comunes/PageHeader";
import { inicioDeUsuario } from "@/components/layout/navegacion";
import { Button } from "@/components/ui/button";
import { destinoPorPerfil } from "@/core/permisos";
import { obtenerSesion } from "@/lib/auth/sesion";

export const metadata: Metadata = { title: "Sin acceso" };

export default async function PaginaSinAcceso() {
  const usuario = await obtenerSesion();
  if (!usuario) redirect("/login");
  // Su inicio habitual; si la matriz se lo quitó, la primera sección que sí puede ver.
  const destino = inicioDeUsuario(destinoPorPerfil[usuario.perfil], usuario.permisos);

  return (
    <>
      <PageHeader titulo="Sin acceso" tituloVisible={false} />
      <div className="mx-auto max-w-xl pt-4 sm:pt-10">
      <EmptyState
        icono={ShieldOff}
        titulo="No tiene permiso para ver esta sección"
        descripcion="Su perfil no incluye acceso a esta pantalla. Si lo necesita, pida al administrador del sistema que ajuste sus permisos."
        accion={
          <Button asChild>
            <Link href={destino}>Ir a mi inicio</Link>
          </Button>
        }
      />
      </div>
    </>
  );
}
