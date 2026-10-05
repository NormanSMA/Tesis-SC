import { prisma } from "@/lib/db";
import { aErrorHttp } from "@/lib/errores";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return Response.json({
      datos: {
        estado: "ok",
        baseDatos: "ok",
      },
    });
  } catch (e) {
    const { status, cuerpo } = aErrorHttp(e);
    return Response.json(cuerpo, { status });
  }
}
