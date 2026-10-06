import { can, exigir, type Actor } from "@/core/autorizacion";
import type { ResultadoEstimado } from "@/core/consumo-estimado";
import { registrarEvento } from "@/lib/bitacora";
import { prisma, type Tx } from "@/lib/db";
import { AppError } from "@/lib/errores";
import { aOrdenDto } from "./dto";
import { esCotizacionDuplicada, ordenExistente, regla, traducirError } from "./errores";
import { exigirOrden, registrarCambio, validarResponsable } from "./escritura";
import { estimarCotizacion } from "./estimado";
import { buscarCotizacion, buscarOrdenDeCotizacion, siguienteNumero, type CotizacionGuardada } from "./repo";
import { validarFechaEntrega } from "./reglas";
import type { EntradaCrearOrden } from "./schema";
import type { PropuestaOrden } from "./tipos";

async function tomarCotizacion(tx: Tx, cotizacionId: string): Promise<CotizacionGuardada> {
  await tx.$queryRaw`SELECT id FROM cotizacion WHERE id = ${cotizacionId}::uuid FOR UPDATE`;
  const cotizacion = await buscarCotizacion(tx, cotizacionId);
  if (!cotizacion) throw new AppError({ codigo: "NO_ENCONTRADO", status: 404, mensaje: "La cotización no existe." });
  const existente = await buscarOrdenDeCotizacion(tx, cotizacionId);
  if (existente) throw ordenExistente(existente);
  if (cotizacion.estado !== "APROBADA") throw regla("SC004", "La orden requiere una cotización aprobada.");
  return cotizacion;
}

async function leerPlantillas(tx: Tx, categoriaId: string) {
  const categoria = await tx.categoria.findUnique({ where: { id: categoriaId } });
  if (!categoria?.activo) throw new AppError({ codigo: "VALIDACION", status: 422, mensaje: "Hay campos con errores.",
    campos: { categoriaId: "Seleccione una categoría activa." } });
  const plantillas = await tx.etapaPlantilla.findMany({ where: { categoriaId, activo: true }, orderBy: { secuencia: "asc" } });
  if (!plantillas.length) throw regla("SIN_PLANTILLA", "La categoría no tiene etapas activas. Configure una plantilla antes de convertir.");
  return plantillas;
}

async function guardarEstimado(tx: Tx, ordenId: string, estimado: ResultadoEstimado): Promise<void> {
  if (estimado.consumos.length) await tx.consumoEstimado.createMany({
    data: estimado.consumos.map((consumo) => ({ ...consumo, ordenId })),
  });
}

async function convertir(tx: Tx, entrada: EntradaCrearOrden, actor: Actor) {
  const cotizacion = await tomarCotizacion(tx, entrada.cotizacionId);
  const plantillas = await leerPlantillas(tx, entrada.categoriaId);
  await validarResponsable(tx, entrada.responsableId);
  const estimado = estimarCotizacion(cotizacion);
  const orden = await tx.ordenTrabajo.create({ data: { numero: await siguienteNumero(tx), cotizacionId: cotizacion.id,
    categoriaId: entrada.categoriaId, responsableId: entrada.responsableId, fechaEntrega: new Date(entrada.fechaEntrega),
    especificaciones: entrada.especificaciones === undefined ? cotizacion.asunto : entrada.especificaciones, creadoPorId: actor.id } });
  await guardarEstimado(tx, orden.id, estimado);
  await registrarCambio(tx, { ordenId: orden.id, cotizacionId: cotizacion.id, actor, accion: "CONVERTIR_EN_ORDEN",
    estadoNuevo: "PENDIENTE", detalle: { cotizacionNumero: cotizacion.numero,
      advertencias: estimado.advertencias.map((advertencia) => ({ ...advertencia })) } });
  for (const plantilla of plantillas) {
    const etapa = await tx.etapaOrden.create({ data: { ordenId: orden.id, plantillaId: plantilla.id,
      areaId: plantilla.areaId, secuencia: plantilla.secuencia, nombre: plantilla.nombre } });
    await registrarEvento(tx, { entidad: "ETAPA_ORDEN", entidadId: etapa.id, ordenId: orden.id,
      actorId: actor.id, accion: "CREAR", estadoNuevo: "PENDIENTE", detalle: { nombre: etapa.nombre, secuencia: etapa.secuencia } });
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
