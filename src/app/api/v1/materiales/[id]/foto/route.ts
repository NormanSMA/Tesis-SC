import { manejar } from "@/lib/http";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errores";
import { leerIdMaterial } from "@/modules/inventario/service";

export const GET = manejar({ permiso: "inventario:ver" }, async ({ params }) => {
  const foto = await prisma.materialFoto.findUnique({ where: { materialId: leerIdMaterial(params.id) } });
  if (!foto) throw new AppError({ codigo: "NO_ENCONTRADO", status: 404, mensaje: "El material no tiene foto." });
  return new Response(new Uint8Array(foto.contenido), { headers: { "Content-Type": "image/webp",
    "Cache-Control": "private, no-cache", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" } });
});
