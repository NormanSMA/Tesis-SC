import { z } from "zod";
import { AppError } from "@/lib/errores";

export function noEncontrado(): AppError {
  return new AppError({ codigo: "NO_ENCONTRADO", status: 404, mensaje: "La cotización no existe." });
}

export function leerIdCotizacion(valor: string | string[] | undefined): string {
  const lectura = z.uuid().safeParse(valor);
  if (!lectura.success) throw noEncontrado();
  return lectura.data;
}

export function conflictoEdicion(): AppError {
  return new AppError({ codigo: "CONFLICTO_EDICION", status: 409,
    mensaje: "Otra persona modificó esta cotización. Recargue los datos y vuelva a intentar." });
}

export function regla(codigo: string, mensaje: string): AppError {
  return new AppError({ codigo, mensaje, status: 409 });
}

export function prefijarError(error: unknown, prefijo: string): never {
  if (!(error instanceof AppError) || !error.campos) throw error;
  const campos = Object.fromEntries(Object.entries(error.campos).map(([campo, mensaje]) => [`${prefijo}${campo}`, mensaje]));
  throw new AppError({ codigo: error.codigo, mensaje: error.mensaje, status: error.status, campos });
}
