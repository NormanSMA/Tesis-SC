"use client";

import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function AvisoGuardado({ error, conflicto, recargar, ordenExistente }: {
  error: string | null; conflicto: boolean; recargar: () => void; ordenExistente?: { id: string; numero: string } | null;
}) {
  if (!error) return null;
  return <Alert variant="destructive" role="alert">
    <CircleAlert aria-hidden="true" />
    <AlertTitle>{conflicto ? "Otra persona modificó la orden" : "No se pudo guardar"}</AlertTitle>
    <AlertDescription className="space-y-2 break-words">
      <p>{error}</p>
      {conflicto ? <><p>Recargue los datos. Los cambios sin guardar se perderán.</p>
        <Button type="button" variant="outline" onClick={recargar}>Recargar datos</Button></> : null}
      {ordenExistente ? <Link className="underline" href={`/ordenes/${ordenExistente.id}`}>Ver {ordenExistente.numero}</Link> : null}
    </AlertDescription>
  </Alert>;
}
