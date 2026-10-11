import type { Configuracion } from "@/generated/prisma/client";

export function aConfiguracionDto(fila: Configuracion) {
  return {
    clave: fila.clave, valor: fila.valor, tipo: fila.tipo, descripcion: fila.descripcion,
    actualizadoEn: fila.actualizadoEn.toISOString(), actualizadoPorId: fila.actualizadoPorId,
  };
}
