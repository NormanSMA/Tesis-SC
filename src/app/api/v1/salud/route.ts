import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/db";
import { registro } from "@/lib/registro";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ datos: { estado: "ok", baseDatos: "ok" } });
  } catch (e) {
    registro.error({
      codigo: "BASE_DATOS_NO_DISPONIBLE",
      ruta: "/api/v1/salud",
      metodo: "GET",
      peticionId: randomUUID(),
      err: e,
    }, "La base de datos no responde.");
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
