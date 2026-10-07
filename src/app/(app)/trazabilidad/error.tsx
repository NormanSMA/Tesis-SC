"use client";

import { ErrorState } from "@/components/comunes/ErrorState";
import { Button } from "@/components/ui/button";

export default function ErrorTrazabilidad({ reset }: { reset: () => void }) {
  return <div aria-live="assertive"><ErrorState descripcion="No se pudo consultar la trazabilidad. Intente nuevamente."
    accion={<Button type="button" onClick={reset}>Reintentar</Button>} /></div>;
}
