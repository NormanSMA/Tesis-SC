import type { EntidadBitacora } from "@/generated/prisma/client";
import type { Tx } from "@/lib/db";
import type { EventoGuardado } from "./repo";

export type Referencia = { nombre: string; ruta?: string; permiso?: "cliente:ver" | "catalogo:ver" | "inventario:ver" };
export type Referencias = { registros: Map<string, Referencia>; nombres: Map<string, string> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function idsDetalle(valor: unknown): string[] {
  if (typeof valor === "string") return UUID.test(valor) ? [valor] : [];
  return valor && typeof valor === "object" ? Object.values(valor).flatMap(idsDetalle) : [];
}
export async function leerReferencias(tx: Tx, eventos: EventoGuardado[]): Promise<Referencias> {
  const ids = [...new Set(eventos.flatMap((evento) => [evento.entidadId, ...idsDetalle(evento.detalle)]))];
  const [clientes, materiales, productos, categorias, areas, usuarios, etapas, movimientos] = await Promise.all([
    tx.cliente.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true } }),
    tx.material.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true } }),
    tx.producto.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true } }),
    tx.categoria.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true } }),
    tx.area.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true } }),
    tx.usuario.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true } }),
    tx.etapaOrden.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true } }),
    tx.movimientoInventario.findMany({ where: { id: { in: ids } }, select: { id: true, material: { select: { id: true, nombre: true } } } }),
  ]);
  const registros = new Map<string, Referencia>();
  const guardar = (entidad: EntidadBitacora, filas: { id: string; nombre: string }[], opciones: { ruta?: string; permiso?: Referencia["permiso"] } = {}) => {
    for (const fila of filas) registros.set(`${entidad}:${fila.id}`, { nombre: fila.nombre,
      ruta: opciones.ruta ? `${opciones.ruta}/${fila.id}` : undefined, permiso: opciones.permiso });
  };
  guardar("CLIENTE", clientes, { ruta: "/clientes", permiso: "cliente:ver" });
  guardar("MATERIAL", materiales, { ruta: "/inventario", permiso: "inventario:ver" });
  guardar("PRODUCTO", productos, { ruta: "/catalogo", permiso: "catalogo:ver" });
  guardar("CATEGORIA", categorias); guardar("AREA", areas); guardar("USUARIO", usuarios); guardar("ETAPA_ORDEN", etapas);
  for (const fila of movimientos) registros.set(`MOVIMIENTO_INVENTARIO:${fila.id}`, {
    nombre: fila.material.nombre, ruta: `/inventario/${fila.material.id}`, permiso: "inventario:ver" });
  return { registros, nombres: new Map([...clientes, ...materiales, ...productos, ...categorias, ...areas, ...usuarios, ...etapas]
    .map((fila) => [fila.id, fila.nombre])) };
}
