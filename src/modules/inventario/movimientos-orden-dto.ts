import type { Prisma } from "@/generated/prisma/client";
import type { MaterialResumenDto, MovimientoOrdenDto } from "./contrato-orden";

export type MovimientoGuardado = {
  id: string;
  tipo: string;
  cantidad: Prisma.Decimal;
  costoUnitario: Prisma.Decimal;
  existenciaResultante: Prisma.Decimal;
  costoPromedioResultante: Prisma.Decimal;
  creadoEn: Date;
  material: MaterialResumenDto;
  usuario: { nombre: string };
};

/**
 * Lista blanca: el costo de un movimiento ligado a una orden es dinero de la orden y exige cotizacion:ver.
 * Sin ese permiso los campos no existen en el objeto (no se envían como null).
 */
export function aMovimientoOrdenDto(movimiento: MovimientoGuardado, verCostos: boolean): MovimientoOrdenDto {
  const base: MovimientoOrdenDto = {
    id: movimiento.id,
    tipo: movimiento.tipo === "CONSUMO" ? "CONSUMO" : "DEVOLUCION",
    material: { id: movimiento.material.id, codigo: movimiento.material.codigo, nombre: movimiento.material.nombre,
      unidad: movimiento.material.unidad },
    cantidad: movimiento.cantidad.abs().toFixed(3),
    existenciaResultante: movimiento.existenciaResultante.toFixed(3),
    usuario: movimiento.usuario.nombre,
    creadoEn: movimiento.creadoEn.toISOString(),
  };
  if (!verCostos) return base;
  return { ...base, costoUnitario: movimiento.costoUnitario.toFixed(4),
    costoPromedioResultante: movimiento.costoPromedioResultante.toFixed(4) };
}
