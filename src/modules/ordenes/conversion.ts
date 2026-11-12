import { exigirAccesoCotizacion } from "@/modules/cotizaciones/acceso";
import { can, exigir, type Actor } from "@/core/autorizacion";
import { Prisma } from "@/generated/prisma/client";
import { registrarEvento } from "@/lib/bitacora";
import { prisma, type Tx } from "@/lib/db";
import { AppError } from "@/lib/errores";
import { registrarEtapa } from "@/modules/produccion/escritura";
import { nombresAreasConversion, ordenarAreasConversion } from "./areas-conversion";
import { aOrdenDto } from "./dto";
import { esCotizacionDuplicada, ordenExistente, regla, traducirError } from "./errores";
import { exigirOrden, registrarCambio, validarResponsable } from "./escritura";
import { estimarCotizacion } from "./estimado";
import { buscarCotizacion, buscarOrdenDeCotizacion, siguienteNumero, type CotizacionGuardada } from "./repo";
import { validarFechaEntrega } from "./reglas";
import type { EntradaCrearOrden } from "./schema";
import type { PropuestaOrden } from "./tipos";

async function tomarCotizacion(tx: Tx, cotizacionId: string, actor: Actor): Promise<CotizacionGuardada> {
  await tx.$queryRaw`SELECT id FROM cotizacion WHERE id = ${cotizacionId}::uuid FOR UPDATE`;
  const cotizacion = await buscarCotizacion(tx, cotizacionId);
  if (!cotizacion) throw new AppError({ codigo: "NO_ENCONTRADO", status: 404, mensaje: "La cotización no existe." });
  exigirAccesoCotizacion(actor, cotizacion);
  const existente = await buscarOrdenDeCotizacion(tx, cotizacionId);
  if (existente) throw ordenExistente(existente);
  if (cotizacion.archivada) throw regla("COTIZACION_ARCHIVADA", "La cotización está archivada y no se puede convertir en orden.");
  exigirAccesoCotizacion(actor, cotizacion);
  if (cotizacion.estado !== "APROBADA") throw regla("SC004", "La orden requiere una cotización aprobada.");
  return cotizacion;
}

async function leerPlantillas(tx: Tx, categoriaId: string) {
  await tx.$queryRaw`SELECT id FROM categoria WHERE id = ${categoriaId}::uuid FOR SHARE`;
  const categoria = await tx.categoria.findUnique({ where: { id: categoriaId } });
  if (!categoria?.activo) throw new AppError({ codigo: "VALIDACION", status: 422, mensaje: "Hay campos con errores.",
    campos: { categoriaId: "Seleccione una categoría activa." } });
  const plantillas = await tx.etapaPlantilla.findMany({ where: { categoriaId, activo: true }, orderBy: { secuencia: "asc" } });
  if (!plantillas.length) throw regla("SIN_PLANTILLA", "La categoría no tiene etapas activas. Configure una plantilla antes de convertir.");
  await tx.$queryRaw`SELECT a.id FROM area a WHERE a.id IN (
    SELECT area_id FROM etapa_plantilla WHERE categoria_id = ${categoriaId}::uuid AND activo
  ) ORDER BY a.id FOR SHARE OF a`;
  const areas = await tx.area.findMany({ where: { id: { in: plantillas.map((plantilla) => plantilla.areaId) } } });
  if (areas.some((area) => !area.activo)) throw regla("AREA_ARCHIVADA", "Una plantilla utiliza un área archivada. Actualice la plantilla antes de convertir.");
  return plantillas;
}

async function guardarEstimado(tx: Tx, ordenId: string, estimado: ReturnType<typeof estimarCotizacion>): Promise<void> {
  if (estimado.consumos.length) await tx.consumoEstimado.createMany({
    data: estimado.consumos.map((consumo) => ({ ...consumo, ordenId })),
  });
}

async function leerEtapasSeleccionadas(tx: Tx, entrada: EntradaCrearOrden) {
  const seleccionadas = entrada.etapas!;
  if (!seleccionadas.length || new Set(seleccionadas.map(({ areaId }) => areaId)).size !== seleccionadas.length) {
    throw regla("AREAS_INVALIDAS", "Seleccione al menos un área y no la repita.");
  }
  await tx.$queryRaw`SELECT id FROM categoria WHERE id = ${entrada.categoriaId}::uuid FOR SHARE`;
  if (!await tx.categoria.findFirst({ where: { id: entrada.categoriaId, activo: true }, select: { id: true } })) {
    throw regla("CATEGORIA_ARCHIVADA", "Seleccione una categoría activa.");
  }
  const areas = await tx.$queryRaw<{ id: string; nombre: string }[]>`
    SELECT id, nombre FROM area WHERE activo AND nombre IN (${Prisma.join(nombresAreasConversion)}) ORDER BY id FOR SHARE`;
  const autorizadas = new Map(ordenarAreasConversion(areas).map(({ id, nombre }) => [id, nombre]));
  for (const responsableId of [...new Set(seleccionadas.map((etapa) => etapa.responsableId))].sort()) {
    await validarResponsable(tx, responsableId);
  }
  const asignaciones = await tx.$queryRaw<{ usuarioId: string; areaId: string }[]>`
    SELECT usuario_id AS "usuarioId", area_id AS "areaId" FROM usuario_area
    WHERE usuario_id IN (${Prisma.join(seleccionadas.map(({ responsableId }) => Prisma.sql`${responsableId}::uuid`))})
    FOR SHARE`;
  const miembros = new Set(asignaciones.map(({ usuarioId, areaId }) => `${usuarioId}:${areaId}`));
  return seleccionadas.map((etapa, indice) => {
    const nombre = autorizadas.get(etapa.areaId);
    if (!nombre) throw regla("AREA_INVALIDA", "Seleccione un área de producción activa.");
    if (!miembros.has(`${etapa.responsableId}:${etapa.areaId}`)) {
      const mensaje = "Seleccione un colaborador asignado a esta área.";
      throw new AppError({ codigo: "VALIDACION", status: 422, mensaje, campos: { [`etapas.${indice}.responsableId`]: mensaje } });
    }
    return { ...etapa, nombre, secuencia: indice + 1 };
  });
}

async function convertir(tx: Tx, entrada: EntradaCrearOrden, actor: Actor) {
  const cotizacion = await tomarCotizacion(tx, entrada.cotizacionId, actor);
  exigirAccesoCotizacion(actor, cotizacion);
  const etapas = entrada.etapas ? await leerEtapasSeleccionadas(tx, entrada) :
    (await leerPlantillas(tx, entrada.categoriaId)).map(({ id, areaId, secuencia, nombre }) =>
      ({ plantillaId: id, areaId, secuencia, nombre }));
  const responsableGeneral = entrada.responsableId;
  if (!responsableGeneral) throw new AppError({ codigo: "VALIDACION", status: 422,
    mensaje: "Seleccione el responsable general de la orden.", campos: { responsableId: "Seleccione un responsable." } });
  await validarResponsable(tx, responsableGeneral);
  const estimado = estimarCotizacion(cotizacion);
  const orden = await tx.ordenTrabajo.create({ data: { numero: await siguienteNumero(tx), cotizacionId: cotizacion.id,
    clienteId: cotizacion.clienteId, categoriaId: entrada.categoriaId, responsableId: responsableGeneral,
    fechaEntrega: new Date(entrada.fechaEntrega),
    especificaciones: entrada.especificaciones === undefined ? cotizacion.asunto : entrada.especificaciones, creadoPorId: actor.id } });
  await guardarEstimado(tx, orden.id, estimado);
  await registrarCambio(tx, { ordenId: orden.id, cotizacionId: cotizacion.id, actor, accion: "CONVERTIR_EN_ORDEN",
    estadoNuevo: "PENDIENTE", detalle: { cotizacionNumero: cotizacion.numero,
      responsableId: responsableGeneral,
      advertencias: estimado.advertencias.map((advertencia) => ({ ...advertencia })) } });
  for (const datos of etapas) {
    const etapa = await tx.etapaOrden.create({ data: { ordenId: orden.id, ...datos } });
    const detalle = { nombre: etapa.nombre, secuencia: etapa.secuencia, areaId: etapa.areaId,
      responsableId: etapa.responsableId, instrucciones: etapa.instrucciones };
    if (entrada.etapas) await registrarEtapa(tx, { etapa, actor, accion: "CREAR", estadoNuevo: "PENDIENTE", detalle });
    else await registrarEvento(tx, { entidad: "ETAPA_ORDEN", entidadId: etapa.id, ordenId: orden.id,
      actorId: actor.id, accion: "CREAR", estadoNuevo: "PENDIENTE", detalle });
  }
  return aOrdenDto(await exigirOrden(tx, orden.id), actor);
}

export async function crearOrden(entrada: EntradaCrearOrden, actor: Actor) {
  exigir(actor, "orden:crear");
  validarFechaEntrega(entrada.fechaEntrega);
  try { return await prisma.$transaction((tx) => convertir(tx, entrada, actor)); } catch (error) {
    if (esCotizacionDuplicada(error)) {
      const ganadora = await buscarOrdenDeCotizacion(prisma, entrada.cotizacionId);
      if (ganadora) throw ordenExistente(ganadora);
    }
    traducirError(error);
  }
}

export async function proponerOrden(cotizacionId: string, actor: Actor): Promise<PropuestaOrden> {
  exigir(actor, "orden:crear");
  const cotizacion = await buscarCotizacion(prisma, cotizacionId);
  if (!cotizacion) throw new AppError({ codigo: "NO_ENCONTRADO", status: 404, mensaje: "La cotización no existe." });
  exigirAccesoCotizacion(actor, cotizacion);
  if (cotizacion.estado !== "APROBADA") throw regla("SC004", "La orden requiere una cotización aprobada.");
  const principal = [...cotizacion.items].sort((a, b) => b.importe.comparedTo(a.importe) || a.secuencia - b.secuencia)[0];
  return { cotizacionId, numero: cotizacion.numero, cliente: cotizacion.cliente.nombre,
    categoriaId: principal?.categoriaId ?? "", especificaciones: cotizacion.asunto ?? "",
    orden: await buscarOrdenDeCotizacion(prisma, cotizacionId) };
}

export async function ordenDeCotizacion(cotizacionId: string, actor: Actor) {
  if (!can(actor, "orden:ver")) return null;
  return buscarOrdenDeCotizacion(prisma, cotizacionId);
}
