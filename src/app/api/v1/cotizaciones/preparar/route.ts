import { z } from "zod";
import { prisma } from "@/lib/db";
import { manejar, ok } from "@/lib/http";
import { configuracionCotizacion, consultarClientesSelector } from "@/modules/cotizaciones/repo";

export const GET = manejar({ permiso: "cotizacion:gestionar" }, async ({ req }) => {
  const cliente = z.uuid().safeParse(new URL(req.url).searchParams.get("clienteId"));
  const [clientes, configuracion] = await Promise.all([
    consultarClientesSelector(cliente.data, true), configuracionCotizacion(prisma),
  ]);
  return ok({ clientes, condiciones: configuracion.condiciones });
});
