import { z } from "zod";
import { AppError, aErrorHttp } from "@/lib/errores";

export function regla(codigo: string, mensaje: string) { return new AppError({ codigo, mensaje, status: 409 }); }
export function noEncontrado(recurso = "registro") {
  return new AppError({ codigo: "NO_ENCONTRADO", status: 404, mensaje: `El ${recurso} no existe.` });
}
export function leerId(valor: string | string[] | undefined) {
  const lectura = z.uuid().safeParse(valor);
  if (!lectura.success) throw noEncontrado();
  return lectura.data.toLowerCase();
}
export function conflictoEdicion() { return regla("CONFLICTO_EDICION", "Otra persona modificó el registro. Recargue los datos y vuelva a intentar."); }
export function exigirVersion(actual: { actualizadoEn: Date }, version: string) {
  if (actual.actualizadoEn.getTime() !== new Date(version).getTime()) throw conflictoEdicion();
}
export function campoInvalido(campo: string, mensaje: string) {
  return new AppError({ codigo: "VALIDACION", status: 422, mensaje: "Hay campos con errores.", campos: { [campo]: mensaje } });
}
const MENSAJES_SQL: Record<string, string> = {
  SC001: "El historial registrado no admite modificaciones.", SC002: "La transición de estado no está permitida.",
  SC003: "La cotización está congelada o incompleta.", SC004: "La orden requiere una cotización aprobada.",
  SC005: "El consumo o la devolución no corresponde a la orden.", SC006: "La existencia solo cambia mediante movimientos.",
  SC007: "El campo no admite modificaciones después del alta.",
};
export function traducirError(error: unknown): never {
  if (error instanceof AppError) throw error;
  const texto = JSON.stringify(error) ?? String(error);
  const codigo = texto.match(/SC00[1-7]/)?.[0];
  if (codigo) throw regla(codigo, MENSAJES_SQL[codigo]);
  if (/40P01|40001/.test(texto)) throw regla("CONFLICTO_CONCURRENCIA", "Otra operación está en curso. Vuelva a intentar.");
  if (/23514/.test(texto)) throw regla("DATOS_INCONSISTENTES", "Los datos no cumplen las reglas de fechas o estado.");
  if (/22003/.test(texto)) throw regla("SECUENCIA_FUERA_DE_RANGO", "La secuencia supera el máximo permitido.");
  const { status, cuerpo: { error: datos } } = aErrorHttp(error);
  if (status === 500) throw error;
  if (datos.codigo === "DUPLICADO") throw regla("DUPLICADO", "Ya existe un registro con ese nombre o secuencia.");
  throw new AppError({ ...datos, status });
}
