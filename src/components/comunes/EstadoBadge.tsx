import { Badge } from "@/components/ui/badge";

import { ESTADOS, type TipoEstado } from "./estados";

type PropiedadesEstado = {
  tipo: TipoEstado;
  estado: string;
  className?: string;
};

export function EstadoBadge({ tipo, estado, className }: PropiedadesEstado) {
  const definicion = ESTADOS[tipo][estado];
  if (!definicion) {
    return (
      <Badge variant="neutro" className={className}>
        {estado}
      </Badge>
    );
  }
  const Icono = definicion.icono;
  return (
    <Badge variant={definicion.tono} className={className}>
      <Icono aria-hidden="true" />
      {definicion.etiqueta}
    </Badge>
  );
}
