import { FileQuestion } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/comunes/EmptyState";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Página no encontrada" };

export default function PaginaNoEncontrada() {
  return (
    <main id="contenido" tabIndex={-1} className="mx-auto flex min-h-dvh max-w-xl items-center px-4 outline-none">
      <EmptyState
        icono={FileQuestion}
        titulo="No se encontró la página"
        descripcion="La dirección no existe o fue movida. Vuelva al inicio para continuar."
        accion={
          <Button asChild>
            <Link href="/">Ir al inicio</Link>
          </Button>
        }
      />
    </main>
  );
}
