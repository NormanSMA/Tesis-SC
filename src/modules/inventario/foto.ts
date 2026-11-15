import sharp from "sharp";
import type { Tx } from "@/lib/db";
import { AppError } from "@/lib/errores";

export async function prepararFoto(base64: string | null | undefined) {
  if (base64 == null) return base64;
  try {
    const buffer = Buffer.from(base64.replace(/^data:image\/(png|jpeg|webp);base64,/, ""), "base64");
    if (buffer.length > 524288) throw new Error("tamaño");
    const imagen = sharp(buffer, { limitInputPixels: 20_000_000, animated: false });
    const metadatos = await imagen.metadata();
    if (!["png", "jpeg", "webp"].includes(metadatos.format ?? "") || (metadatos.pages ?? 1) > 1) throw new Error("formato");
    const foto = await imagen.rotate().resize({ width: 960, height: 960, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    if (foto.length > 524288) throw new Error("tamaño");
    return new Uint8Array(foto);
  } catch {
    throw new AppError({ codigo: "FOTO_INVALIDA", status: 422, mensaje: "Seleccione una foto PNG, JPEG o WebP válida de hasta 512 KB.", campos: { fotoBase64: "No se pudo procesar la foto." } });
  }
}

export async function guardarFoto(tx: Tx, datos: { id: string; foto: Uint8Array<ArrayBuffer> | null | undefined }) {
  if (datos.foto === undefined) return;
  if (datos.foto === null) await tx.materialFoto.deleteMany({ where: { materialId: datos.id } });
  else await tx.materialFoto.upsert({ where: { materialId: datos.id }, create: { materialId: datos.id, contenido: datos.foto }, update: { contenido: datos.foto } });
  const version = datos.foto === null ? null : new Date();
  // La versión optimista ya se avanzó bajo bloqueo; Prisma no debe reemplazarla con otro reloj.
  await tx.$executeRaw`UPDATE material SET foto_version = ${version}::timestamptz WHERE id = ${datos.id}::uuid`;
}
