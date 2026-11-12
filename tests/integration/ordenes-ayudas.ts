import type { EstadoOrden, PrismaClient } from "@/generated/prisma/client";
import type { EntradaItem } from "@/modules/cotizaciones/schema";
import type { EntradaCrearOrden } from "@/modules/ordenes/schema";
import { crearAreaBase } from "../helpers/fabricas";
export type EntornoOrdenes = Awaited<ReturnType<typeof prepararOrdenes>>;

export { invocar } from "../helpers/fabricas";

export async function prepararOrdenes(db: PrismaClient) {
  const { prepararCotizaciones, abrirSesion, nombreUnico } = await import("./cotizaciones-ayudas");
  const cotizaciones = await prepararCotizaciones(db);
  const produccion = await abrirSesion(db, cotizaciones.modulos, "PRODUCCION");
  const gerencia = await abrirSesion(db, cotizaciones.modulos, "GERENCIA");
  const admin = await abrirSesion(db, cotizaciones.modulos, "ADMIN");
  const operaciones = await abrirSesion(db, cotizaciones.modulos, "OPERACIONES");
  const administracion = await abrirSesion(db, cotizaciones.modulos, "ADMINISTRACION");
  // Estas pruebas ejercitan la ODT compartida. La privacidad comercial se prueba con cuentas sin este permiso adicional.
  const verTodas = await db.permiso.findUniqueOrThrow({ where: { recurso_accion: { recurso: "cotizacion", accion: "ver_todas" } } });
  for (const sesion of [operaciones, administracion]) {
    await db.usuarioPermiso.create({ data: { usuarioId: sesion.usuarioId, permisoId: verTodas.id } });
    sesion.actor = { ...sesion.actor, permisos: [...sesion.actor.permisos, "cotizacion:ver_todas"] };
  }
  const area = await db.area.create({ data: crearAreaBase({ nombre: nombreUnico("Área órdenes") }) });
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
  return { db, cotizaciones, modulos, sesiones: { ATENCION_CLIENTE: cotizaciones.ventas, PRODUCCION: produccion, GERENCIA: gerencia, ADMIN: admin,
    OPERACIONES: operaciones, ADMINISTRACION: administracion } };
}

export async function crearAprobada(entorno: EntornoOrdenes, items?: EntradaItem[]) {
  const { crearBorrador, itemsMixtos } = await import("./cotizaciones-ayudas");
  const { cotizaciones } = entorno;
  const borrador = await crearBorrador(cotizaciones, { items: items ?? itemsMixtos(cotizaciones.referencias) });
  const enviada = await cotizaciones.modulos.servicio.enviarCotizacion(borrador.id, borrador.actualizadoEn, cotizaciones.ventas.actor);
  return cotizaciones.modulos.servicio.responderCotizacion(enviada.id, { version: enviada.actualizadoEn, resultado: "APROBADA", referenciaAprobacion: "Correo del cliente" }, cotizaciones.ventas.actor);
}

export function entradaConversion(entorno: EntornoOrdenes, cotizacionId: string): EntradaCrearOrden {
  return { cotizacionId, categoriaId: entorno.cotizaciones.referencias.categoria.id,
    responsableId: entorno.sesiones.PRODUCCION.usuarioId, fechaEntrega: entorno.cotizaciones.modulos.fechas.hoyManagua(),
    especificaciones: "Trabajo de integración" };
}

export async function crearOrden(entorno: EntornoOrdenes, opciones: { responsableId?: string | null } = {}) {
  const cotizacion = await crearAprobada(entorno);
  const entrada = entradaConversion(entorno, cotizacion.id);
  const orden = await entorno.modulos.servicio.crearOrden({ ...entrada, responsableId: opciones.responsableId ?? entrada.responsableId },
    entorno.sesiones.OPERACIONES.actor);
  if (opciones.responsableId !== null) return { ...orden, cotizacion: orden.cotizacion! };
  await entorno.db.ordenTrabajo.update({ where: { id: orden.id }, data: { responsableId: null } });
  const historica = await entorno.modulos.servicio.obtenerOrden(orden.id, entorno.sesiones.OPERACIONES.actor);
  return { ...historica, cotizacion: historica.cotizacion! };
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

export async function leerOrden(entorno: EntornoOrdenes, id: string, perfil: keyof EntornoOrdenes["sesiones"] = "ATENCION_CLIENTE") {
  return entorno.modulos.servicio.obtenerOrden(id, entorno.sesiones[perfil].actor);
}
