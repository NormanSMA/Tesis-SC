"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function AvisoAdmin({ mensaje, alRecargar }: { mensaje: string; alRecargar?: () => void }) {
  return (
    <Alert role="alert" variant="destructive">
      <AlertTitle>{alRecargar ? "Los datos cambiaron" : "No se pudo completar la acción"}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{mensaje}</p>
        {alRecargar ? <>
          <p>Recargue los datos. Los cambios sin guardar se perderán.</p>
          <Button type="button" variant="outline" className="min-h-10" onClick={alRecargar}>Recargar datos</Button>
        </> : null}
      </AlertDescription>
    </Alert>
  );
}
