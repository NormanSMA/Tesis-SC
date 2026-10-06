"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function AvisoSolicitud({ error, exito, recargar }: {
  error: { codigo?: string; mensaje?: string; campos?: Record<string, string> } | null;
  exito: boolean; recargar: () => void;
}) {
  return <div aria-live="polite" className="space-y-3">
    {exito ? <Alert role="status"><AlertTitle>Registro guardado</AlertTitle>
      <AlertDescription>La operación se registró correctamente.</AlertDescription></Alert> : null}
    {error ? <Alert variant="destructive"><AlertTitle>No se pudo guardar</AlertTitle>
      <AlertDescription className="break-words"><p>{error.mensaje}</p>
        {error.campos ? <ul className="list-inside list-disc">{Object.entries(error.campos).map(([campo, mensaje]) =>
          <li key={campo}>{mensaje}</li>)}</ul> : null}
        {error.codigo === "CONFLICTO_EDICION" ? <><p>Recargue los datos antes de editar nuevamente.</p>
          <Button type="button" variant="outline" onClick={recargar}>Recargar datos</Button></> : null}
      </AlertDescription></Alert> : null}
  </div>;
}
