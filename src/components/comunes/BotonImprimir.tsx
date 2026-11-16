"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BotonImprimir({ etiqueta = "Imprimir o guardar PDF" }: { etiqueta?: string }) {
  return <Button type="button" onClick={() => window.print()}><Printer aria-hidden="true" />{etiqueta}</Button>;
}
