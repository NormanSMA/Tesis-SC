// Logo del cliente en el navegador: URL versionada, preparación de la imagen y envío.

export const TIPOS_LOGO = ["image/png", "image/jpeg", "image/webp"] as const;
const LADO_MAXIMO = 256;
const LIMITE_BYTES = 524288;
const LIMITE_ORIGINAL = 10 * 1024 * 1024;

export type CambioLogo = { tipo: "nuevo"; imagen: Blob; vista: string } | { tipo: "quitar" } | null;

/** La versión en la URL permite cachear un año: cambia cuando cambia el logo. */
export function urlLogo(id: string, version: string): string {
  return `/api/v1/clientes/${encodeURIComponent(id)}/logo?v=${encodeURIComponent(version)}`;
}

function exportar(lienzo: HTMLCanvasElement, calidad: number): Promise<Blob | null> {
  return new Promise((resolver) => lienzo.toBlob(resolver, "image/webp", calidad));
}

/** Reduce la imagen a 256 px de lado como máximo y la convierte a WebP. Lanza un Error con texto para el usuario. */
export async function prepararLogo(archivo: File): Promise<Blob> {
  if (!(TIPOS_LOGO as readonly string[]).includes(archivo.type)) throw new Error("Use una imagen PNG, JPG o WebP.");
  if (archivo.size > LIMITE_ORIGINAL) throw new Error("La imagen supera los 10 MB.");
  const mapa = await createImageBitmap(archivo).catch(() => { throw new Error("No se pudo leer la imagen."); });
  const escala = Math.min(1, LADO_MAXIMO / Math.max(mapa.width, mapa.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.max(1, Math.round(mapa.width * escala));
  lienzo.height = Math.max(1, Math.round(mapa.height * escala));
  lienzo.getContext("2d")?.drawImage(mapa, 0, 0, lienzo.width, lienzo.height);
  mapa.close();
  for (const calidad of [0.9, 0.75, 0.6]) {
    const imagen = await exportar(lienzo, calidad);
    if (imagen && imagen.size <= LIMITE_BYTES) return imagen;
  }
  throw new Error("La imagen sigue pesando más de 512 KB. Pruebe con otra.");
}

/** Aplica el cambio pendiente después de guardar el cliente. Devuelve un mensaje de error o null. */
export async function aplicarCambioLogo(id: string, cambio: CambioLogo): Promise<string | null> {
  if (!cambio) return null;
  try {
    const respuesta = await fetch(`/api/v1/clientes/${encodeURIComponent(id)}/logo`, cambio.tipo === "nuevo"
      ? { method: "PUT", body: cambio.imagen, headers: { "Content-Type": cambio.imagen.type || "image/webp" } }
      : { method: "DELETE" });
    if (respuesta.ok) return null;
    const cuerpo = await respuesta.json().catch(() => null) as { error?: { mensaje?: string } } | null;
    return cuerpo?.error?.mensaje ?? "No se pudo guardar el logo.";
  } catch {
    return "No se pudo guardar el logo. Revise la conexión.";
  }
}
