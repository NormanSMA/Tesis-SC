export type ErrorAdministracion = { codigo?: string; mensaje: string; campos?: Record<string, string>; status?: number };
export type ResultadoAdministracion<T> = { datos: T; error?: never } | { datos?: never; error: ErrorAdministracion };

export async function peticionAdministracion<T>(url: string, opciones: { metodo: string; cuerpo?: object }): Promise<ResultadoAdministracion<T>> {
  try {
    const respuesta = await fetch(url, {
      method: opciones.metodo, cache: "no-store",
      headers: { "Content-Type": "application/json" },
      ...(opciones.cuerpo ? { body: JSON.stringify(opciones.cuerpo) } : {}),
    });
    const cuerpo = await respuesta.json().catch(() => ({})) as { datos?: T; error?: ErrorAdministracion };
    if (respuesta.ok && cuerpo.datos !== undefined) return { datos: cuerpo.datos };
    return { error: { ...cuerpo.error, status: respuesta.status, mensaje: cuerpo.error?.mensaje ?? "No se pudo completar la acción." } };
  } catch {
    return { error: { mensaje: "No se pudo conectar con el servidor. Revise la conexión." } };
  }
}
