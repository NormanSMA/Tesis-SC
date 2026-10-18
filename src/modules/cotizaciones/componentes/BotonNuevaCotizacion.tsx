"use client";

import { Button } from "@/components/ui/button";
import { useParametrosUrl } from "@/lib/listas/useParametrosUrl";

export function BotonNuevaCotizacion() {
  const { superficial } = useParametrosUrl();
  return <Button onClick={() => superficial({ crear: "1" }, "agregar")}>Nueva cotización</Button>;
}
