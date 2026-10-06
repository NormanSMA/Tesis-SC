"use client";

import { ErrorState } from "@/components/comunes/ErrorState";
import { PageHeader } from "@/components/comunes/PageHeader";
import { Button } from "@/components/ui/button";

export default function ErrorCatalogo({ reset }: { reset: () => void }) {
  return <><PageHeader titulo="Catálogo" /><ErrorState accion={<Button onClick={reset}>Reintentar</Button>} /></>;
}
