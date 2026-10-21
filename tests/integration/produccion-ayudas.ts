import { Client } from "pg";
import type { Actor } from "@/core/autorizacion";
import type { PrismaClient } from "@/generated/prisma/client";
import { urlParaPg, urlPropietario } from "../helpers/entorno-bd";
import { crearAreaBase, exigirBaseTest, nombreUnico } from "../helpers/fabricas";
import { prepararConsumo, capturar, type EntornoConsumo } from "./inventario-consumo-ayudas";
import { crearOrden, leerOrden } from "./ordenes-ayudas";

export type EntornoProduccion = Awaited<ReturnType<typeof prepararProduccion>>;
export async function prepararProduccion(db: PrismaClient) {
  exigirBaseTest();
  const consumo = await prepararConsumo(db);
  const servicio = await import("@/modules/produccion/service");
  const rutas = { etapas: await import("@/app/api/v1/ordenes/[id]/etapas/route"), etapa: await import("@/app/api/v1/etapas/[id]/route"),
    iniciar: await import("@/app/api/v1/etapas/[id]/iniciar/route"), completar: await import("@/app/api/v1/etapas/[id]/completar/route"),
    omitir: await import("@/app/api/v1/etapas/[id]/omitir/route"), restaurar: await import("@/app/api/v1/etapas/[id]/restaurar/route"),
    lista: await import("@/app/api/v1/ordenes/[id]/lista/route"), retrabajo: await import("@/app/api/v1/ordenes/[id]/retrabajo/route"),
    areas: await import("@/app/api/v1/areas/route"), area: await import("@/app/api/v1/areas/[id]/route"),
    archivarArea: await import("@/app/api/v1/areas/[id]/archivar/route"), reactivarArea: await import("@/app/api/v1/areas/[id]/reactivar/route"),
    plantillas: await import("@/app/api/v1/categorias/[id]/plantillas/route"), plantilla: await import("@/app/api/v1/plantillas/[id]/route"),
    archivarPlantilla: await import("@/app/api/v1/plantillas/[id]/archivar/route"),
    tablero: await import("@/app/api/v1/produccion/tablero/route"), opciones: await import("@/app/api/v1/produccion/opciones/route") };
  return { db, consumo, ordenes: consumo.ordenes, servicio, rutas,
    actor: consumo.ordenes.sesiones.PRODUCCION.actor,
    planificador: consumo.ordenes.sesiones.OPERACIONES.actor,
    operaciones: consumo.ordenes.sesiones.OPERACIONES.actor,
    gerencia: consumo.ordenes.sesiones.GERENCIA.actor };
}
export async function nuevaOrden(entorno: EntornoProduccion) {
  return crearOrden(entorno.ordenes);
}
export async function asignarEtapa(entorno: EntornoProduccion, etapa: { id: string; actualizadoEn: string }, actor: Actor = entorno.actor) {
  return entorno.servicio.editarEtapa(etapa.id, { version: etapa.actualizadoEn, responsableId: actor.id }, entorno.planificador);
}
export async function completarPrimera(entorno: EntornoProduccion) {
  const orden = await nuevaOrden(entorno);
  const asignada = await asignarEtapa(entorno, orden.etapas[0]);
  const iniciada = await entorno.servicio.iniciarEtapa(asignada.id, { version: asignada.actualizadoEn }, entorno.actor);
  const completada = await entorno.servicio.completarEtapa(iniciada.id, { version: iniciada.actualizadoEn }, entorno.actor);
  return { orden: await leerOrden(entorno.ordenes, orden.id), completada };
}
export async function prepararLista(entorno: EntornoProduccion) {
  const { orden } = await completarPrimera(entorno);
  for (const etapa of orden.etapas.filter((etapa) => etapa.estado === "PENDIENTE")) {
    await entorno.servicio.omitirEtapa(etapa.id, { version: etapa.actualizadoEn, motivo: "No corresponde" }, entorno.planificador);
  }
  return leerOrden(entorno.ordenes, orden.id);
}
export async function crearAreaLibre(entorno: EntornoProduccion) {
  return entorno.servicio.crearArea(crearAreaBase({ nombre: nombreUnico("Área producción") }), entorno.operaciones);
}
async function esperarBloqueados(cliente: Client, pid: number, cantidad: number) {
  const limite = Date.now() + 10000;
  while (Date.now() < limite) {
    // La instantánea de estadísticas ocultaría las conexiones abiertas después del primer sondeo.
    await cliente.query("SELECT pg_stat_clear_snapshot()");
    const { rows } = await cliente.query<{ cantidad: number }>(
      `WITH RECURSIVE esperando AS (
        SELECT pid FROM pg_stat_activity WHERE $1::int = ANY(pg_blocking_pids(pid))
        UNION SELECT a.pid FROM pg_stat_activity a JOIN esperando e ON e.pid = ANY(pg_blocking_pids(a.pid))
      ) SELECT count(*)::int AS cantidad FROM esperando`, [pid]);
    if (rows[0].cantidad >= cantidad) return;
    await new Promise((resolver) => setTimeout(resolver, 10));
  }
  throw new Error(`No se observaron ${cantidad} operaciones esperando el bloqueo.`);
}
export async function carrera<T, U>(datos: { ordenId?: string; areaId?: string; primera: () => Promise<T>; segunda: () => Promise<U> }) {
  const cliente = new Client({ connectionString: urlParaPg(urlPropietario()) });
  await cliente.connect();
  const pendientes: Promise<unknown>[] = [];
  try {
    await cliente.query("BEGIN");
    const { rows } = await cliente.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
    if (datos.areaId) await cliente.query("SELECT id FROM area WHERE id = $1 FOR UPDATE", [datos.areaId]);
    else await cliente.query("SELECT id FROM orden_trabajo WHERE id = $1 FOR UPDATE", [datos.ordenId]);
    const primera = capturar(datos.primera()); pendientes.push(primera);
    await esperarBloqueados(cliente, rows[0].pid, 1);
    const segunda = capturar(datos.segunda()); pendientes.push(segunda);
    await esperarBloqueados(cliente, rows[0].pid, 2);
    await cliente.query("COMMIT");
    return await Promise.all([primera, segunda]);
  } finally {
    await cliente.query("ROLLBACK");
    await Promise.allSettled(pendientes);
    await cliente.end();
  }
}
export { capturar };
export type { EntornoConsumo };
