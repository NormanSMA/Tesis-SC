import { z } from "zod";

import type { CamposError } from "@/lib/errores";

export type FalloApi = { codigo?: string; mensaje: string; campos?: CamposError };
export type RespuestaApi<T> = { datos: T } | { error: FalloApi };

type PeticionApi = {
  url: string;
  metodo: string;
  cuerpo: object;
  esquema?: z.ZodType;
  mensajeError?: string;
  mensajeConexion?: string;
};

const esquemaRespuesta = z.object({ datos: z.unknown().optional(), error: z.unknown().optional() });
const esquemaError = z.object({
  codigo: z.string().optional(),
  mensaje: z.string().optional(),
  campos: z.record(z.string(), z.string()).optional(),
});

function traducirError(error: unknown, mensaje: string): FalloApi {
  const resultado = esquemaError.safeParse(error);
  return resultado.success ? { ...resultado.data, mensaje: resultado.data.mensaje ?? mensaje } : { mensaje };
}

export function solicitarApi<T>(peticion: PeticionApi & { esquema: z.ZodType<T> }): Promise<RespuestaApi<T>>;
export function solicitarApi(peticion: PeticionApi): Promise<RespuestaApi<unknown>>;
export async function solicitarApi(peticion: PeticionApi): Promise<RespuestaApi<unknown>> {
  const mensaje = peticion.mensajeError ?? "No se pudo guardar.";
  try {
    const respuesta = await fetch(peticion.url, {
      method: peticion.metodo,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(peticion.cuerpo),
    });
    const cuerpo: unknown = await respuesta.json().catch(() => undefined);
    const resultado = esquemaRespuesta.safeParse(cuerpo);
    if (!resultado.success) return { error: { mensaje } };
    if (!respuesta.ok || resultado.data.datos == null) {
      return { error: traducirError(resultado.data.error, mensaje) };
    }
    if (!peticion.esquema) return { datos: resultado.data.datos };
    const datos = peticion.esquema.safeParse(resultado.data.datos);
    return datos.success ? { datos: datos.data } : { error: { mensaje } };
  } catch {
    return { error: { mensaje: peticion.mensajeConexion ?? "No se pudo conectar. Revise su conexión e intente nuevamente." } };
  }
}
