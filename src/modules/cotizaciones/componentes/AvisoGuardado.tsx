"use client";

import { CircleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function AvisoGuardado({ error, conflicto, recargar }: {
  error: string | null; conflicto: boolean; recargar: () => void;
}) {
  if (!error) return null;
  return <Alert variant="destructive">
    <CircleAlert aria-hidden="true" />
    <AlertTitle>{conflicto ? "Otra persona modificó la cotización" : "No se pudo guardar"}</AlertTitle>
    <AlertDescription className="space-y-2">
      <p>{error}</p>
      {conflicto ? <><p>Recargue los datos. Los cambios sin guardar se perderán.</p>
        <Button type="button" variant="outline" onClick={recargar}>Recargar datos</Button></> : null}
    </AlertDescription>
  </Alert>;
}
