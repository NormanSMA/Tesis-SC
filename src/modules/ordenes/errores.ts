import { z } from "zod";
import { AppError, aErrorHttp } from "@/lib/errores";

export function regla(codigo: string, mensaje: string): AppError {
  return new AppError({ codigo, mensaje, status: 409 });
}

export function noEncontrado(): AppError {
  return new AppError({ codigo: "NO_ENCONTRADO", status: 404, mensaje: "La orden no existe." });
}

export function leerIdOrden(valor: string | string[] | undefined): string {
  const lectura = z.uuid().safeParse(valor);
  if (!lectura.success) throw noEncontrado();
  return lectura.data;
}

export function conflictoEdicion(): AppError {
  return regla("CONFLICTO_EDICION", "Otra persona modificó esta orden. Recargue los datos y vuelva a intentar.");
}

export function ordenExistente(orden: { id: string; numero: string }): AppError {
  return new AppError({ codigo: "ORDEN_EXISTENTE", status: 409,
    mensaje: `La cotización ya tiene la orden ${orden.numero}.`, campos: { ordenId: orden.id, numero: orden.numero } });
}

export function esCotizacionDuplicada(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const datos = JSON.stringify(error);
  return /P2002|23505/.test(datos) && /cotizacion_id|cotizacionId/.test(datos);
}

export function traducirError(error: unknown): never {
  if (error instanceof AppError) throw error;
  const { status, cuerpo: { error: datos } } = aErrorHttp(error);
  if (status === 500) throw error;
  throw new AppError({ ...datos, status });
}
