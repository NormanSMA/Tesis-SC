import { exigir, type Actor } from "@/core/autorizacion";
import type { Prisma } from "@/generated/prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { exigirOrden, guardarCambios, registrarCambio } from "@/modules/ordenes/escritura";
import { aEtapaDto } from "./dto";
import { campoInvalido, noEncontrado, regla } from "./errores";
import { registrarEtapa, tomarEtapa, transaccionProduccion } from "./escritura";
import { actualizarEtapa, bloquearOrden, incluirEtapa, validarArea, validarResponsable, type CambiosEtapa, type EtapaGuardada } from "./repo";
import { exigirOrdenEditable, exigirTransicionEtapa, validarFechas, validarMotivo, type AccionEtapa } from "./reglas";
import type { EntradaAgregarEtapa, EntradaEditarEtapa, EntradaOmitirEtapa, EntradaVersion } from "./schema";

export async function obtenerEtapasOrden(id: string, actor: Actor) {
  exigir(actor, "produccion:ver");
  if (!await prisma.ordenTrabajo.findUnique({ where: { id }, select: { id: true } })) throw noEncontrado("orden");
  return (await prisma.etapaOrden.findMany({ where: { ordenId: id }, include: incluirEtapa, orderBy: { secuencia: "asc" } })).map(aEtapaDto);
}
export async function crearEtapaManual(tx: Tx, datos: { ordenId: string; entrada: EntradaAgregarEtapa; actor: Actor }) {
  await validarArea(tx, datos.entrada.areaId);
  const maxima = await tx.etapaOrden.aggregate({ where: { ordenId: datos.ordenId }, _max: { secuencia: true } });
  const etapa = await tx.etapaOrden.create({ data: { ordenId: datos.ordenId, ...datos.entrada,
    secuencia: (maxima._max.secuencia ?? 0) + 1 }, include: incluirEtapa });
  await registrarEtapa(tx, { etapa, actor: datos.actor, accion: "CREAR", estadoNuevo: "PENDIENTE",
    detalle: { nombre: etapa.nombre, areaId: etapa.areaId, secuencia: etapa.secuencia } });
  return etapa;
}
export async function agregarEtapa(id: string, entrada: EntradaAgregarEtapa, actor: Actor) {
  exigir(actor, "produccion:planificar");
  return transaccionProduccion(async (tx) => {
    const orden = await bloquearOrden(tx, id);
    exigirOrdenEditable(orden.estado);
    return aEtapaDto(await crearEtapaManual(tx, { ordenId: id, entrada, actor }));
  });
}
function cambiosPlanificacion(actual: EtapaGuardada, entrada: EntradaEditarEtapa) {
  const cambios: CambiosEtapa = {};
  if (entrada.responsableId !== undefined && entrada.responsableId !== actual.responsableId) cambios.responsableId = entrada.responsableId;
  for (const campo of ["fechaInicioPlan", "fechaFinPlan"] as const) {
    if (entrada[campo] !== undefined && entrada[campo] !== (actual[campo]?.toISOString().slice(0, 10) ?? null)) {
      cambios[campo] = entrada[campo] ? new Date(entrada[campo]) : null;
    }
  }
  return cambios;
}
async function validarPlanificacion(tx: Tx, actual: EtapaGuardada, cambios: CambiosEtapa) {
  if (actual.estado === "COMPLETADA") throw regla("ETAPA_NO_EDITABLE", "Una etapa completada no admite modificaciones.");
  const cambiaFechas = cambios.fechaInicioPlan !== undefined || cambios.fechaFinPlan !== undefined;
  if (cambiaFechas && actual.estado === "OMITIDA") throw regla("ETAPA_NO_EDITABLE", "Restaure la etapa antes de modificar las fechas.");
  if (cambios.responsableId === null && actual.estado === "EN_CURSO") throw campoInvalido("responsableId", "Una etapa en curso necesita responsable.");
  if (cambios.responsableId) await validarResponsable(tx, cambios.responsableId);
  validarFechas((cambios.fechaInicioPlan === undefined ? actual.fechaInicioPlan : cambios.fechaInicioPlan)?.toISOString().slice(0, 10) ?? null,
    (cambios.fechaFinPlan === undefined ? actual.fechaFinPlan : cambios.fechaFinPlan)?.toISOString().slice(0, 10) ?? null);
}
async function registrarPlanificacion(tx: Tx, datos: { actual: EtapaGuardada; cambios: CambiosEtapa; actor: Actor }) {
  const { actual, cambios, actor } = datos;
  if (cambios.responsableId !== undefined) await registrarEtapa(tx, { etapa: actual, actor, accion: "ASIGNAR_RESPONSABLE",
    detalle: { responsableId: { anterior: actual.responsableId, nuevo: cambios.responsableId } } });
  const detalle: Record<string, Prisma.InputJsonValue> = {};
  for (const campo of ["fechaInicioPlan", "fechaFinPlan"] as const) {
    if (cambios[campo] !== undefined) detalle[campo] = { anterior: actual[campo]?.toISOString().slice(0, 10) ?? null,
      nuevo: cambios[campo]?.toISOString().slice(0, 10) ?? null };
  }
  if (Object.keys(detalle).length) await registrarEtapa(tx, { etapa: actual, actor, accion: "EDITAR", detalle });
}
export async function editarEtapa(id: string, entrada: EntradaEditarEtapa, actor: Actor) {
  exigir(actor, "produccion:planificar");
  return transaccionProduccion(async (tx) => {
    const { etapa } = await tomarEtapa(tx, { id, version: entrada.version });
    const cambios = cambiosPlanificacion(etapa, entrada);
    if (!Object.keys(cambios).length) return aEtapaDto(etapa);
    await validarPlanificacion(tx, etapa, cambios);
    const guardada = await actualizarEtapa(tx, etapa, cambios);
    await registrarPlanificacion(tx, { actual: etapa, cambios, actor });
    return aEtapaDto(guardada);
  });
}
type CambioEtapa = { id: string; entrada: EntradaVersion & { motivo?: string }; actor: Actor; accion: AccionEtapa };
async function ejecutarCambio(datos: CambioEtapa) {
  exigir(datos.actor, datos.accion === "iniciar" || datos.accion === "completar" ? "produccion:ejecutar" : "produccion:planificar");
  const motivo = datos.accion === "omitir" ? validarMotivo(datos.entrada.motivo ?? "") : undefined;
  return transaccionProduccion(async (tx) => {
    const { orden, etapa } = await tomarEtapa(tx, { id: datos.id, version: datos.entrada.version });
    const estado = exigirTransicionEtapa(etapa.estado, datos.accion);
    if (datos.accion === "iniciar" && !etapa.responsableId) throw regla("ETAPA_SIN_RESPONSABLE", "Asigne un responsable antes de iniciar la etapa.");
    if (datos.accion === "iniciar" && orden.estado === "PENDIENTE") exigir(datos.actor, "orden:avanzar");
    if (datos.accion === "restaurar") await validarArea(tx, etapa.areaId);
    if ((datos.accion === "iniciar" || datos.accion === "completar") && etapa.responsableId) await validarResponsable(tx, etapa.responsableId);
    const ahora = new Date();
    if (datos.accion === "iniciar" && orden.estado === "PENDIENTE") {
      await guardarCambios(tx, await exigirOrden(tx, orden.id), { estado: "EN_PRODUCCION", fechaInicioReal: ahora });
      await registrarCambio(tx, { ordenId: orden.id, actor: datos.actor, accion: "CAMBIAR_ESTADO", estadoAnterior: "PENDIENTE", estadoNuevo: "EN_PRODUCCION" });
    }
    const guardada = await actualizarEtapa(tx, etapa, { estado,
      ...(datos.accion === "iniciar" && { fechaInicioReal: ahora }), ...(datos.accion === "completar" && { fechaFinReal: ahora }),
      ...(motivo && { observaciones: motivo }), ...(datos.accion === "restaurar" && { observaciones: null }) });
    await registrarEtapa(tx, { etapa, actor: datos.actor, accion: "CAMBIAR_ESTADO", estadoAnterior: etapa.estado,
      estadoNuevo: estado, detalle: motivo ? { motivo } : {} });
    return aEtapaDto(guardada);
  });
}
export function iniciarEtapa(id: string, entrada: EntradaVersion, actor: Actor) { return ejecutarCambio({ id, entrada, actor, accion: "iniciar" }); }
export function completarEtapa(id: string, entrada: EntradaVersion, actor: Actor) { return ejecutarCambio({ id, entrada, actor, accion: "completar" }); }
export function omitirEtapa(id: string, entrada: EntradaOmitirEtapa, actor: Actor) { return ejecutarCambio({ id, entrada, actor, accion: "omitir" }); }
export function restaurarEtapa(id: string, entrada: EntradaVersion, actor: Actor) { return ejecutarCambio({ id, entrada, actor, accion: "restaurar" }); }
