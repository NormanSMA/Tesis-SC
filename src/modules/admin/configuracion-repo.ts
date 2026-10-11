import type { Configuracion } from "@/generated/prisma/client";
import type { Tx } from "@/lib/db";

export function consultarConfiguracion(tx: Tx) {
  return tx.configuracion.findMany({ orderBy: { clave: "asc" } });
}

export async function bloquearConfiguracion(tx: Tx, clave: string): Promise<Configuracion | null> {
  await tx.$queryRaw`SELECT id FROM configuracion WHERE clave = ${clave} FOR UPDATE`;
  return tx.configuracion.findUnique({ where: { clave } });
}

export function actualizarConfiguracion(tx: Tx, datos: {
  actual: Configuracion; valor: string; actorId: string;
}): Promise<Configuracion> {
  const actualizadoEn = new Date(Math.max(Date.now(), datos.actual.actualizadoEn.getTime() + 1));
  return tx.configuracion.update({
    where: { id: datos.actual.id },
    data: { valor: datos.valor, actualizadoPorId: datos.actorId, actualizadoEn },
  });
}
