import { UserX } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/comunes/EmptyState";
import { PageHeader } from "@/components/comunes/PageHeader";
import { Button } from "@/components/ui/button";

export default function ClienteNoEncontrado() {
  return (
    <>
      <PageHeader titulo="Cliente no encontrado" />
      <EmptyState
        icono={UserX}
        titulo="Este cliente no existe"
        descripcion="Puede que el enlace esté incompleto. Vuelva a la lista para buscarlo."
        accion={
          <Button asChild variant="outline">
            <Link href="/clientes">Volver a clientes</Link>
          </Button>
        }
      />
    </>
  );
}
