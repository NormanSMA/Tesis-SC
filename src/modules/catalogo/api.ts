import { z } from "zod";

import { solicitarApi, type FalloApi } from "@/lib/cliente-api";

export type { FalloApi } from "@/lib/cliente-api";

export async function enviarApi<T>(url: string, metodo: string, datos: object): Promise<{ datos: T } | { error: FalloApi }> {
  return solicitarApi({
    url, metodo, cuerpo: datos,
    // El contrato legado permite elegir T sin aportar un esquema de respuesta.
    esquema: z.custom<T>(),
    mensajeError: "No se pudo guardar. Intente de nuevo.",
    mensajeConexion: "No se pudo conectar con el servidor. Revise su conexión.",
  });
}
