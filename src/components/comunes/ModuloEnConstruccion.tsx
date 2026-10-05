import { Construction } from "lucide-react";

import { EmptyState } from "@/components/comunes/EmptyState";
import { PageHeader } from "@/components/comunes/PageHeader";

export function ModuloEnConstruccion({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <>
      <PageHeader titulo={titulo} descripcion={descripcion} />
      <EmptyState
        icono={Construction}
        titulo="Módulo en construcción"
        descripcion="Esta sección se habilita en una fase posterior del piloto."
      />
    </>
  );
}
