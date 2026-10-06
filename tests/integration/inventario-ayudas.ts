import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import type { CrearMaterial } from "@/modules/inventario/schema";
import { crearCliente } from "@/lib/db";

export { invocar } from "./ordenes-ayudas";
export type EntornoInventario = Awaited<ReturnType<typeof prepararInventario>>;
export async function prepararInventario(db: PrismaClient) {
  const { abrirSesion, prepararCotizaciones } = await import("./cotizaciones-ayudas");
  const cotizaciones = await prepararCotizaciones(db);
  const PRODUCCION = await abrirSesion(db, cotizaciones.modulos, "PRODUCCION");
  const GERENCIA = await abrirSesion(db, cotizaciones.modulos, "GERENCIA");
  const ADMIN = await abrirSesion(db, cotizaciones.modulos, "ADMIN");
  const modulos = { servicio: await import("@/modules/inventario/service"),
    lista: await import("@/app/api/v1/materiales/route"), ficha: await import("@/app/api/v1/materiales/[id]/route"),
    archivar: await import("@/app/api/v1/materiales/[id]/archivar/route"), reactivar: await import("@/app/api/v1/materiales/[id]/reactivar/route"),
    movimientos: await import("@/app/api/v1/movimientos/route"), libro: await import("@/app/api/v1/materiales/[id]/movimientos/route"),
    entrada: await import("@/app/api/v1/inventario/entradas/route"), ajuste: await import("@/app/api/v1/inventario/ajustes/route") };
  return { cotizaciones, modulos, sesiones: { PRODUCCION, GERENCIA, ADMIN, VENTAS: cotizaciones.ventas } };
}
export function entradaMaterial(cambios: Partial<CrearMaterial> = {}): CrearMaterial {
  return { codigo: `INV-${randomUUID().slice(0, 12)}`, nombre: `Material ${randomUUID().slice(0, 8)}`,
    unidad: "METRO", stockMinimo: "2.000", costoPromedio: "5.1234", ...cambios };
}
export function crearMaterial(entorno: EntornoInventario, cambios: Partial<CrearMaterial> = {}) {
  return entorno.modulos.servicio.crearMaterial(entradaMaterial(cambios), entorno.sesiones.PRODUCCION.actor);
}
export function recibir(entorno: EntornoInventario, materialId: string, opciones: { cantidad?: string; costo?: string; clave?: string } = {}) {
  return entorno.modulos.servicio.registrarEntrada({ materialId, cantidad: opciones.cantidad ?? "10.000", costoUnitario: opciones.costo ?? "10.0000" },
    entorno.sesiones.PRODUCCION.actor, opciones.clave ?? randomUUID());
}
export function peticionLibro(entrada: { ruta: string; cookie?: string; cuerpo: object; clave?: string | null }) {
  const solicitud = new Request(`http://localhost${entrada.ruta}`, { method: "POST",
    headers: { origin: "http://localhost", "Content-Type": "application/json", ...(entrada.cookie && { cookie: entrada.cookie }) },
    body: JSON.stringify(entrada.cuerpo) });
  if (entrada.clave !== null) solicitud.headers.set("Idempotency-Key", entrada.clave ?? randomUUID());
  return solicitud;
}
export function clienteInventario() {
  const texto = process.env.TEST_DATABASE_URL;
  if (!texto || !new URL(texto).pathname.endsWith("_test")) throw new Error("TEST_DATABASE_URL debe apuntar a una base _test.");
  return crearCliente(texto);
}
