import { Archive, CircleCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";

// EstadoBadge no tiene un tipo "cliente": se compone con Badge, con ícono y texto como el resto de estados.
export function EstadoCliente({ activo }: { activo: boolean }) {
  return activo ? (
    <Badge variant="exito">
      <CircleCheck aria-hidden="true" />
      Activo
    </Badge>
  ) : (
    <Badge variant="neutroFuerte">
      <Archive aria-hidden="true" />
      Archivado
    </Badge>
  );
}
