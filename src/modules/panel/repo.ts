import { prisma } from "@/lib/db";
import { comparar, dividir, leerDecimal } from "@/core/decimal";
import { sumarDias } from "@/modules/cotizaciones/fechas";
import { filtroAlerta } from "@/modules/inventario/repo";
import { alertaMaterial } from "@/modules/inventario/reglas";
import { estaAtrasada, TERMINALES } from "@/modules/ordenes/reglas";
import { textoEstado } from "@/modules/trazabilidad/etiquetas";

export async function consultarPendientes(hoy: string) {
  const fecha = sumarDias(hoy, 0);
  const where = { estado: "ENVIADA" as const, archivada: false };
  const vigente = { ...where, fechaVencimiento: { gte: fecha } };
  const [cantidad, vencenPronto, porMarcarVencidas, filas] = await Promise.all([
    prisma.cotizacion.count({ where: vigente }),
    prisma.cotizacion.count({ where: { ...where, fechaVencimiento: { gte: fecha, lte: sumarDias(hoy, 3) } } }),
    prisma.cotizacion.count({ where: { ...where, fechaVencimiento: { lt: fecha } } }),
    prisma.cotizacion.findMany({ where: vigente, take: 10, orderBy: [{ fechaVencimiento: "asc" }, { id: "asc" }],
      select: { id: true, numero: true, fechaVencimiento: true, total: true, cliente: { select: { nombre: true } } } }),
  ]);
  return { cantidad, vencenPronto, porMarcarVencidas, filas: filas.map((fila) => ({ numero: fila.numero,
    cliente: fila.cliente.nombre, vencimiento: fila.fechaVencimiento!.toISOString().slice(0, 10),
    total: fila.total.toFixed(2), href: `/cotizaciones/${fila.id}` })) };
}
export async function consultarMaterialesPanel() {
  const [enAlerta, sinExistencia, filas] = await Promise.all([
    prisma.material.count({ where: filtroAlerta() }),
    prisma.material.count({ where: { activo: true, existencia: 0 } }),
    prisma.material.findMany({ where: filtroAlerta(), select: { id: true, codigo: true, nombre: true,
      existencia: true, stockMinimo: true } }),
  ]);
  const materiales = filas.map((fila) => ({ id: fila.id, codigo: fila.codigo, nombre: fila.nombre,
    existencia: fila.existencia.toFixed(3), stockMinimo: fila.stockMinimo.toFixed(3) }));
  materiales.sort((a, b) => comparar(dividir(leerDecimal(a.existencia)!, leerDecimal(a.stockMinimo)!),
    dividir(leerDecimal(b.existencia)!, leerDecimal(b.stockMinimo)!)) || a.nombre.localeCompare(b.nombre, "es") || a.id.localeCompare(b.id));
  return { enAlerta, sinExistencia, filas: materiales.slice(0, 10).map((fila) => ({ codigo: fila.codigo, nombre: fila.nombre,
    existencia: fila.existencia, stockMinimo: fila.stockMinimo, alerta: alertaMaterial({ ...fila, activo: true })!,
    href: `/inventario/${fila.id}` })) };
}
export async function consultarOperacion(hoy: string) {
  const ordenes = await prisma.ordenTrabajo.findMany({ where: { estado: { notIn: TERMINALES } },
    orderBy: [{ fechaEntrega: "asc" }, { id: "asc" }], select: { id: true, numero: true, estado: true, fechaEntrega: true } });
  const filas = ordenes.map((orden) => ({ numero: orden.numero, estado: textoEstado(orden.estado)!,
    fechaEntrega: orden.fechaEntrega.toISOString().slice(0, 10), href: `/ordenes/${orden.id}`,
    atrasada: estaAtrasada({ estado: orden.estado, fechaEntrega: orden.fechaEntrega.toISOString().slice(0, 10) }, hoy) }));
  const limite = sumarDias(hoy, 7).toISOString().slice(0, 10);
  const entregas = filas.filter((fila) => fila.fechaEntrega >= hoy && fila.fechaEntrega <= limite);
  return { porEstado: ["PENDIENTE", "EN_PRODUCCION", "LISTA"].map((estado) => ({ estado: textoEstado(estado)!,
    cantidad: ordenes.filter((orden) => orden.estado === estado).length, href: `/ordenes?estado=${estado}&terminales=false` })),
    entregas, resumen: { enProduccion: ordenes.filter((orden) => orden.estado === "EN_PRODUCCION").length,
      atrasadas: filas.filter((fila) => fila.atrasada).length, entregasProximas: entregas.length } };
}
