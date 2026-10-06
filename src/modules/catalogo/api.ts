export type FalloApi = { codigo?: string; mensaje: string; campos?: Record<string, string> };

export async function enviarApi<T>(url: string, metodo: string, datos: object): Promise<{ datos: T } | { error: FalloApi }> {
  try {
    const respuesta = await fetch(url, { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos) });
    const cuerpo = await respuesta.json().catch(() => ({}));
    if (respuesta.ok && cuerpo.datos) return { datos: cuerpo.datos as T };
    return { error: cuerpo.error ?? { mensaje: "No se pudo guardar. Intente de nuevo." } };
  } catch {
    return { error: { mensaje: "No se pudo conectar con el servidor. Revise su conexión." } };
  }
}
