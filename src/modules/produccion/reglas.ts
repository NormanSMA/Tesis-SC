import type { EstadoEtapa, EstadoOrden } from "@/generated/prisma/enums";
import { campoInvalido, regla } from "./errores";

export type AccionEtapa = "iniciar" | "completar" | "omitir" | "restaurar";
export const TRANSICIONES_ETAPA = { iniciar: { desde: "PENDIENTE", hacia: "EN_CURSO" },
  completar: { desde: "EN_CURSO", hacia: "COMPLETADA" }, omitir: { desde: "PENDIENTE", hacia: "OMITIDA" },
  restaurar: { desde: "OMITIDA", hacia: "PENDIENTE" } } as const;
export function exigirOrdenEditable(estado: EstadoOrden) {
  if (estado !== "PENDIENTE" && estado !== "EN_PRODUCCION") {
    throw regla("ORDEN_NO_ADMITE_CAMBIOS_DE_ETAPA", "La orden no admite cambios de etapa. Reabra una orden lista mediante retrabajo.");
  }
}
export function exigirTransicionEtapa(estado: EstadoEtapa, accion: AccionEtapa) {
  if (estado !== TRANSICIONES_ETAPA[accion].desde) throw regla("TRANSICION_INVALIDA", "La etapa no admite esa transición.");
  return TRANSICIONES_ETAPA[accion].hacia;
}
export function puedeMarcarseLista(estado: EstadoOrden, estados: readonly EstadoEtapa[], avanzar: boolean): boolean {
  return avanzar && estado === "EN_PRODUCCION"
    && estados.every((etapa) => etapa === "COMPLETADA" || etapa === "OMITIDA")
    && estados.includes("COMPLETADA");
}
export function exigirLista(estados: readonly EstadoEtapa[]) {
  if (estados.some((estado) => estado !== "COMPLETADA" && estado !== "OMITIDA")) {
    throw regla("ETAPAS_ABIERTAS", "Complete u omita las etapas abiertas antes de marcar la orden lista.");
  }
  if (!estados.includes("COMPLETADA")) throw regla("ORDEN_SIN_TRABAJO", "La orden necesita al menos una etapa completada.");
}
export function validarFechas(inicio: string | null, fin: string | null) {
  if (inicio && fin && fin < inicio) throw campoInvalido("fechaFinPlan", "El fin no puede ser anterior al inicio.");
}
export function validarMotivo(motivo: string) {
  const limpio = motivo.trim();
  if (limpio.length < 5 || limpio.length > 10000) throw campoInvalido("motivo", "Indique un motivo de 5 a 10000 caracteres.");
  return limpio;
}
