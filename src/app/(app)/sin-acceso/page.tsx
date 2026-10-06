import { ShieldOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/comunes/EmptyState";
import { PageHeader } from "@/components/comunes/PageHeader";
import { filtrarNavegacion, gruposNavegacion } from "@/components/layout/navegacion";
import { Button } from "@/components/ui/button";
import { destinoPorPerfil } from "@/core/permisos";
import { obtenerSesion } from "@/lib/auth/sesion";

export const metadata: Metadata = { title: "Sin acceso" };

export default async function PaginaSinAcceso() {
  const usuario = await obtenerSesion();
  if (!usuario) redirect("/login");
  // Si la matriz le quitó el destino habitual, lo lleva a la primera sección que sí puede ver.
  const primeraPermitida = filtrarNavegacion(gruposNavegacion, usuario.permisos)[0]?.items[0]?.href;
  const destino = primeraPermitida ?? destinoPorPerfil[usuario.perfil];

  return (
    <>
      <PageHeader titulo="Sin acceso" />
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
    </>
  );
}
