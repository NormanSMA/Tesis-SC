import type { EstadoOrden, PrismaClient } from "@/generated/prisma/client";
import type { EntradaItem } from "@/modules/cotizaciones/schema";
import type { EntradaCrearOrden } from "@/modules/ordenes/schema";

export type EntornoOrdenes = Awaited<ReturnType<typeof prepararOrdenes>>;

type Manejador = (req: Request, contexto?: { params?: Promise<Record<string, string>> }) => Promise<Response>;
export async function invocar<T = unknown>(manejador: Manejador, solicitud: Request, id?: string) {
  const respuesta = await manejador(solicitud, id ? { params: Promise.resolve({ id }) } : undefined);
  const cuerpo = await respuesta.json() as Record<string, unknown>;
  return { status: respuesta.status, datos: cuerpo.datos as T, cuerpo,
    error: cuerpo.error as { codigo: string; mensaje: string; campos?: Record<string, string> } | undefined };
}

export async function prepararOrdenes(db: PrismaClient) {
  const { prepararCotizaciones, abrirSesion, nombreUnico } = await import("./cotizaciones-ayudas");
  const cotizaciones = await prepararCotizaciones(db);
  const produccion = await abrirSesion(db, cotizaciones.modulos, "PRODUCCION");
  const gerencia = await abrirSesion(db, cotizaciones.modulos, "GERENCIA");
  const admin = await abrirSesion(db, cotizaciones.modulos, "ADMIN");
  const area = await db.area.create({ data: { nombre: nombreUnico("Área órdenes") } });
  const categoriaId = cotizaciones.referencias.categoria.id;
  await db.etapaPlantilla.createMany({ data: [
    { categoriaId, areaId: area.id, nombre: "Diseño", secuencia: 1 },
    { categoriaId, areaId: area.id, nombre: "Impresión", secuencia: 2 },
    { categoriaId, areaId: area.id, nombre: "Plantilla archivada", secuencia: 3, activo: false },
  ] });
  await db.recetaProducto.createMany({ data: [
    { productoId: cotizaciones.referencias.unidad.id, materialId: cotizaciones.referencias.material.id, cantidad: "1.250" },
    { productoId: cotizaciones.referencias.superficie.id, materialId: cotizaciones.referencias.material.id, cantidad: "0.500" },
  ] });
  const modulos = {
    lista: await import("@/app/api/v1/ordenes/route"), ficha: await import("@/app/api/v1/ordenes/[id]/route"),
    entregar: await import("@/app/api/v1/ordenes/[id]/entregar/route"), cerrar: await import("@/app/api/v1/ordenes/[id]/cerrar/route"),
    cancelar: await import("@/app/api/v1/ordenes/[id]/cancelar/route"), opciones: await import("@/app/api/v1/ordenes/opciones/route"),
    servicio: await import("@/modules/ordenes/service"),
  };
  return { cotizaciones, modulos, sesiones: { VENTAS: cotizaciones.ventas, PRODUCCION: produccion, GERENCIA: gerencia, ADMIN: admin } };
}

export async function crearAprobada(entorno: EntornoOrdenes, items?: EntradaItem[]) {
  const { crearBorrador, itemsMixtos } = await import("./cotizaciones-ayudas");
  const { cotizaciones } = entorno;
  const borrador = await crearBorrador(cotizaciones, { items: items ?? itemsMixtos(cotizaciones.referencias) });
  const enviada = await cotizaciones.modulos.servicio.enviarCotizacion(borrador.id, borrador.actualizadoEn, cotizaciones.ventas.actor);
  return cotizaciones.modulos.servicio.responderCotizacion(enviada.id, { version: enviada.actualizadoEn, resultado: "APROBADA" }, cotizaciones.ventas.actor);
}

export function entradaConversion(entorno: EntornoOrdenes, cotizacionId: string): EntradaCrearOrden {
  return { cotizacionId, categoriaId: entorno.cotizaciones.referencias.categoria.id,
    responsableId: entorno.sesiones.PRODUCCION.usuarioId, fechaEntrega: entorno.cotizaciones.modulos.fechas.hoyManagua(),
    especificaciones: "Trabajo de integración" };
}

export async function crearOrden(entorno: EntornoOrdenes) {
  const cotizacion = await crearAprobada(entorno);
  return entorno.modulos.servicio.crearOrden(entradaConversion(entorno, cotizacion.id), entorno.sesiones.VENTAS.actor);
}

export async function ponerEstado(db: PrismaClient, id: string, destino: EstadoOrden): Promise<void> {
  if (destino === "PENDIENTE") return;
  const inicio = new Date(Date.now() - 1000);
  await db.ordenTrabajo.update({ where: { id }, data: { estado: "EN_PRODUCCION", fechaInicioReal: inicio } });
  if (destino === "EN_PRODUCCION") return;
  if (destino === "CANCELADA") {
    await db.ordenTrabajo.update({ where: { id }, data: { estado: destino, motivoCancelacion: "Cancelación de prueba" } });
    return;
  }
  await db.ordenTrabajo.update({ where: { id }, data: { estado: "LISTA" } });
  if (destino === "LISTA") return;
  await db.ordenTrabajo.update({ where: { id }, data: { estado: "ENTREGADA", fechaEntregaReal: new Date() } });
  if (destino === "CERRADA") await db.ordenTrabajo.update({ where: { id }, data: { estado: "CERRADA", fechaCierre: new Date() } });
}

export async function leerOrden(entorno: EntornoOrdenes, id: string) {
  return entorno.modulos.servicio.obtenerOrden(id, entorno.sesiones.VENTAS.actor);
}
