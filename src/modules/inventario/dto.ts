import { can, type Actor } from "@/core/autorizacion";
import type { Material, Prisma } from "@/generated/prisma/client";
import { alertaMaterial } from "./reglas";

export function aMaterialDto(material: Material) {
  const valores = { ...material, existencia: material.existencia.toFixed(3),
    costoPromedio: material.costoPromedio.toFixed(4), stockMinimo: material.stockMinimo.toFixed(3),
    creadoEn: material.creadoEn.toISOString(), actualizadoEn: material.actualizadoEn.toISOString() };
  return { ...valores, alerta: alertaMaterial(valores) };
}
export type MaterialDto = ReturnType<typeof aMaterialDto>;
export type Conciliacion = { existencia: string; sumaLibro: string; conciliado: boolean };
export type FichaMaterial = MaterialDto & { conciliacion: Conciliacion };
export const incluirMovimiento = { material: { select: { id: true, codigo: true, nombre: true, unidad: true } },
  usuario: { select: { id: true, nombre: true } }, consumo: { select: { orden: { select: { id: true, numero: true } } } } };
export type MovimientoGuardado = Prisma.MovimientoInventarioGetPayload<{ include: typeof incluirMovimiento }>;
export function aMovimientoDto(movimiento: MovimientoGuardado, actor: Actor) {
  const ligadoOrden = movimiento.tipo === "CONSUMO" || movimiento.tipo === "DEVOLUCION";
  return { id: movimiento.id, material: movimiento.material, tipo: movimiento.tipo,
    cantidad: movimiento.cantidad.toFixed(3), existenciaResultante: movimiento.existenciaResultante.toFixed(3),
    usuario: movimiento.usuario, orden: movimiento.consumo?.orden ?? null, motivo: movimiento.motivo,
    referencia: movimiento.referencia, creadoEn: movimiento.creadoEn.toISOString(),
    ...(!ligadoOrden || can(actor, "cotizacion:ver") ? { costoUnitario: movimiento.costoUnitario.toFixed(4),
      costoPromedioResultante: movimiento.costoPromedioResultante.toFixed(4) } : {}),
  };
}
export type MovimientoDto = ReturnType<typeof aMovimientoDto>;
export type ListaMateriales = { datos: MaterialDto[]; total: number; pagina: number; porPagina: number;
  resumen: { materiales: number; enAlerta: number; sinExistencia: number } };
export type ListaMovimientos = { datos: MovimientoDto[]; total: number; pagina: number; porPagina: number };
