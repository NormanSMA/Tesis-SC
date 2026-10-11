"use client";

import { useEffect, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function ClaveTemporal({ clave, alCerrar }: { clave: string; alCerrar: () => void }) {
  const [mensaje, setMensaje] = useState("");
  const region = useRef<HTMLDivElement>(null);
  // El formulario se sustituye al crear el usuario: el foco pasa a la región de la clave.
  useEffect(() => { region.current?.focus(); }, []);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(clave);
      setMensaje("Clave copiada.");
    } catch {
      setMensaje("No se pudo copiar. Seleccione la clave y cópiela manualmente.");
    }
  }
  return (
    <Alert ref={region} role="region" aria-label="Clave temporal" tabIndex={-1}
      className="min-w-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
      <AlertTitle>Clave temporal</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>Copie la clave y entréguela al usuario. No se vuelve a mostrar.</p>
        <code className="block select-all break-all rounded border bg-muted p-3 text-base text-foreground">{clave}</code>
        <div className="flex flex-wrap gap-3">
          <Button className="min-h-10" type="button" onClick={copiar}>Copiar clave</Button>
          <Button className="min-h-10" type="button" variant="outline" onClick={alCerrar}>Cerrar clave</Button>
        </div>
        <p role="status">{mensaje}</p>
      </AlertDescription>
    </Alert>
  );
}
