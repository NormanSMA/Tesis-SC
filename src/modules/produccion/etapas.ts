import { exigir, type Actor } from "@/core/autorizacion";
import { etapasVisibles, exigirEjecucion, exigirParticipacion } from "./acceso";
import type { Prisma } from "@/generated/prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { exigirOrden, guardarCambios, registrarCambio } from "@/modules/ordenes/escritura";
import { aEtapaDto } from "./dto";
import { campoInvalido, noEncontrado, regla } from "./errores";
import { registrarEtapa, tomarEtapa, transaccionProduccion } from "./escritura";
import { actualizarEtapa, bloquearOrden, incluirEtapa, validarArea, validarResponsable, type CambiosEtapa, type EtapaGuardada } from "./repo";
import { exigirOrdenEditable, exigirTransicionEtapa, validarFechas, validarMotivo, validarRangoPlan, type AccionEtapa } from "./reglas";
import type { EntradaAgregarEtapa, EntradaEditarEtapa, EntradaOmitirEtapa, EntradaVersion } from "./schema";

export async function obtenerEtapasOrden(id: string, actor: Actor) {
  exigir(actor, "produccion:ver");
  const orden = await prisma.ordenTrabajo.findUnique({ where: { id }, select: { responsableId: true } });
  if (!orden) throw noEncontrado("orden");
  const etapas = await prisma.etapaOrden.findMany({ where: { ordenId: id }, include: incluirEtapa, orderBy: { secuencia: "asc" } });
  exigirParticipacion(actor, { responsableId: orden.responsableId, etapas });
  return etapasVisibles({ responsableId: orden.responsableId, etapas }, actor).map(aEtapaDto);
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
  validarRangoPlan({ fechaInicioPlan: cambios.fechaInicioPlan?.toISOString().slice(0, 10),
    fechaFinPlan: cambios.fechaFinPlan?.toISOString().slice(0, 10) });
  validarFechas((cambios.fechaInicioPlan === undefined ? actual.fechaInicioPlan : cambios.fechaInicioPlan)?.toISOString().slice(0, 10) ?? null,
    (cambios.fechaFinPlan === undefined ? actual.fechaFinPlan : cambios.fechaFinPlan)?.toISOString().slice(0, 10) ?? null);
}
async function registrarPlanificacion(tx: Tx, datos: { actual: EtapaGuardada; cambios: CambiosEtapa; actor: Actor }) {
  const { actual, cambios, actor } = datos;
  if (cambios.responsableId !== undefined) await registrarEtapa(tx, {
    etapa: { ...actual, responsableId: cambios.responsableId }, actor, accion: "ASIGNAR_RESPONSABLE",
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
type Paso = { orden: OrdenTomada; etapa: EtapaGuardada; actor: Actor; accion: AccionEtapa; motivo?: string };
type OrdenTomada = Awaited<ReturnType<typeof tomarEtapa>>["orden"];
const EJECUCION: readonly AccionEtapa[] = ["iniciar", "completar"];

async function aplicarPaso(tx: Tx, { orden, etapa, actor, accion, motivo }: Paso) {
  const estado = exigirTransicionEtapa(etapa.estado, accion);
  if (accion === "iniciar" && !etapa.responsableId) throw regla("ETAPA_SIN_RESPONSABLE", "Asigne un responsable antes de iniciar la etapa.");
  if (accion === "iniciar" && orden.estado === "PENDIENTE") exigir(actor, "orden:avanzar");
  if (accion === "restaurar") await validarArea(tx, etapa.areaId);
  if (EJECUCION.includes(accion) && etapa.responsableId) await validarResponsable(tx, etapa.responsableId);
  const ahora = new Date();
  if (accion === "iniciar" && orden.estado === "PENDIENTE") {
    await guardarCambios(tx, await exigirOrden(tx, orden.id), { estado: "EN_PRODUCCION", fechaInicioReal: ahora });
    await registrarCambio(tx, { ordenId: orden.id, actor, accion: "CAMBIAR_ESTADO", estadoAnterior: "PENDIENTE", estadoNuevo: "EN_PRODUCCION" });
  }
  const guardada = await actualizarEtapa(tx, etapa, { estado,
    ...(accion === "iniciar" && { fechaInicioReal: ahora }), ...(accion === "completar" && { fechaFinReal: ahora }),
    ...(motivo && { observaciones: motivo }), ...(accion === "restaurar" && { observaciones: null }) });
  await registrarEtapa(tx, { etapa: guardada, actor, accion: "CAMBIAR_ESTADO", estadoAnterior: etapa.estado,
    estadoNuevo: estado, detalle: motivo ? { motivo } : {} });
  return guardada;
}
async function ejecutarCambio(datos: CambioEtapa) {
  exigir(datos.actor, EJECUCION.includes(datos.accion) ? "produccion:ejecutar" : "produccion:planificar");
  const motivo = datos.accion === "omitir" ? validarMotivo(datos.entrada.motivo ?? "") : undefined;
  return transaccionProduccion(async (tx) => {
    const { orden, etapa } = await tomarEtapa(tx, { id: datos.id, version: datos.entrada.version });
    if (EJECUCION.includes(datos.accion)) await exigirEjecucion(tx, etapa, datos.actor);
    return aEtapaDto(await aplicarPaso(tx, { orden, etapa, actor: datos.actor, accion: datos.accion, motivo }));
  });
}
/** "Hecho": una etapa pendiente pasa por EN_CURSO y COMPLETADA en la misma transacción; la bitácora conserva ambos pasos. */
export async function terminarEtapa(id: string, entrada: EntradaVersion, actor: Actor) {
  exigir(actor, "produccion:ejecutar");
  return transaccionProduccion(async (tx) => {
    const { orden, etapa } = await tomarEtapa(tx, { id, version: entrada.version });
    await exigirEjecucion(tx, etapa, actor);
    if (etapa.estado !== "PENDIENTE" && etapa.estado !== "EN_CURSO") throw regla("TRANSICION_INVALIDA", "La etapa no admite esa transición.");
    const enCurso = etapa.estado === "PENDIENTE" ? await aplicarPaso(tx, { orden, etapa, actor, accion: "iniciar" }) : etapa;
    return aEtapaDto(await aplicarPaso(tx, { orden, etapa: enCurso, actor, accion: "completar" }));
  });
}
export function iniciarEtapa(id: string, entrada: EntradaVersion, actor: Actor) { return ejecutarCambio({ id, entrada, actor, accion: "iniciar" }); }
export function completarEtapa(id: string, entrada: EntradaVersion, actor: Actor) { return ejecutarCambio({ id, entrada, actor, accion: "completar" }); }
export function omitirEtapa(id: string, entrada: EntradaOmitirEtapa, actor: Actor) { return ejecutarCambio({ id, entrada, actor, accion: "omitir" }); }
export function restaurarEtapa(id: string, entrada: EntradaVersion, actor: Actor) { return ejecutarCambio({ id, entrada, actor, accion: "restaurar" }); }
