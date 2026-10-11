"use client";

import { RefreshCw } from "lucide-react";

import { ErrorState } from "@/components/comunes/ErrorState";
import { Button } from "@/components/ui/button";

export default function ErrorCotizaciones({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorState
      titulo="No se pudo cargar la información de cotizaciones"
      descripcion="Ocurrió un problema al consultar los datos. Intente de nuevo en unos segundos."
      accion={
        <Button type="button" variant="outline" onClick={reset}>
          <RefreshCw aria-hidden="true" />
          Reintentar
        </Button>
      }
    />
  );
}
