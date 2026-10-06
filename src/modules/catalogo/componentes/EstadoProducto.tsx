import { Archive, CircleCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";

// EstadoBadge no incluye productos; conserva el patrón de EstadoCliente con Badge.
export function EstadoProducto({ activo }: { activo: boolean }) {
  return <Badge variant={activo ? "exito" : "neutroFuerte"}>
    {activo ? <CircleCheck aria-hidden="true" /> : <Archive aria-hidden="true" />}
    {activo ? "Activo" : "Archivado"}
  </Badge>;
}
