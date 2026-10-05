import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ datos: { estado: "ok", baseDatos: "ok" } });
  } catch (e) {
    console.error("salud: la base de datos no responde", e);
    return Response.json(
      {
        error: {
          codigo: "BASE_DATOS_NO_DISPONIBLE",
          mensaje: "La base de datos no responde.",
        },
      },
      { status: 503 },
    );
  }
}
