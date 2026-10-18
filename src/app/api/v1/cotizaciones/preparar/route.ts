import { prisma } from "@/lib/db";
import { manejar, ok } from "@/lib/http";
import { configuracionCotizacion, consultarClientesSelector } from "@/modules/cotizaciones/repo";

// Datos para abrir el drawer de nueva cotización sin recargar la lista: clientes activos y condiciones por defecto.
export const GET = manejar({ permiso: "cotizacion:gestionar" }, async () => {
  const [clientes, configuracion] = await Promise.all([consultarClientesSelector(), configuracionCotizacion(prisma)]);
  return ok({ clientes, condiciones: configuracion.condiciones });
});
