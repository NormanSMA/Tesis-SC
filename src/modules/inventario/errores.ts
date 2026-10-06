import { z } from "zod";
import { AppError, aErrorHttp } from "@/lib/errores";

export function regla(codigo: string, mensaje: string) {
  return new AppError({ codigo, mensaje, status: 409 });
}
export function noEncontrado() {
  return new AppError({ codigo: "NO_ENCONTRADO", mensaje: "El material no existe.", status: 404 });
}
export function leerIdMaterial(valor: string | string[] | undefined) {
  const lectura = z.uuid().safeParse(valor);
  if (!lectura.success) throw noEncontrado();
  return lectura.data;
}
export function exigirVersion(actual: { actualizadoEn: Date }, version: string) {
  if (actual.actualizadoEn.getTime() !== new Date(version).getTime()) throw conflictoEdicion();
}
export function conflictoEdicion() {
  return regla("CONFLICTO_EDICION", "Otra persona modificó el material. Recargue los datos y vuelva a intentar.");
}
export function traducirError(error: unknown): never {
  if (error instanceof AppError) throw error;
  const texto = JSON.stringify(error);
  if (texto?.includes("23514") && texto.includes("material_existencia_no_negativa")) {
    throw regla("EXISTENCIA_INSUFICIENTE", "La existencia del material no alcanza para la operación.");
  }
  if (texto?.includes("22003")) throw regla("VALOR_FUERA_DE_RANGO", "La operación supera el rango permitido de cantidades o costos.");
  const { status, cuerpo: { error: datos } } = aErrorHttp(error);
  if (status === 500) throw error;
  if (datos.codigo === "DUPLICADO") throw new AppError({ ...datos, status,
    mensaje: "Ya existe un material con ese código.", campos: { codigo: "El código ya está registrado." } });
  throw new AppError({ ...datos, status });
}
