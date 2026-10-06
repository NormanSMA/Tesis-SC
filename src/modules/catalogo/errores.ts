import { z } from "zod";

import { aErrorHttp, AppError } from "@/lib/errores";

export function noEncontrado(entidad = "producto"): AppError {
  return new AppError({ codigo: "NO_ENCONTRADO", mensaje: `El registro de ${entidad} no existe.`, status: 404 });
}
export function leerId(valor: unknown): string {
  const resultado = z.uuid().safeParse(valor);
  if (!resultado.success) throw noEncontrado();
  return resultado.data;
}
export function conflictoEdicion(): AppError {
  return new AppError({ codigo: "CONFLICTO_EDICION", status: 409,
    mensaje: "Otra persona modificó este registro. Recargue los datos y vuelva a intentar." });
}
export function exigirVersion(actual: { actualizadoEn: Date }, version: string): void {
  if (actual.actualizadoEn.getTime() !== new Date(version).getTime()) throw conflictoEdicion();
}
export function traducirDuplicado(error: unknown, campo: string): unknown {
  if (aErrorHttp(error).cuerpo.error.codigo !== "DUPLICADO") return error;
  const mensaje = campo === "codigo" ? "Ya existe un producto con ese código." : "Ya existe una categoría con ese nombre.";
  return new AppError({ codigo: "DUPLICADO", status: 409, mensaje, campos: { [campo]: mensaje } });
}
