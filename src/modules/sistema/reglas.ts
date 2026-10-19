import type { ResumenMetricas } from "@/lib/metricas";

export const UMBRAL_P95_MS = 800;
export const UMBRAL_5XX = 0.02;

export type EstadoGeneral = "OPERATIVO" | "CON_ALERTAS" | "CAIDO";

export const ETIQUETA_ESTADO: Record<EstadoGeneral, string> = {
  OPERATIVO: "Operativo",
  CON_ALERTAS: "Con alertas",
  CAIDO: "Caído",
};

/** Caído si la base no responde; con alertas si el p95 o los errores 5xx superan el umbral. */
export function evaluarEstado(
  baseDisponible: boolean,
  metricas: Pick<ResumenMetricas, "p95Ms" | "tasa5xx">,
): { estado: EstadoGeneral; alertas: string[] } {
  if (!baseDisponible) return { estado: "CAIDO", alertas: ["La base de datos no responde."] };
  const alertas: string[] = [];
  if (metricas.p95Ms !== null && metricas.p95Ms > UMBRAL_P95_MS) {
    alertas.push(`La respuesta p95 supera ${UMBRAL_P95_MS} ms.`);
  }
  if (metricas.tasa5xx > UMBRAL_5XX) alertas.push(`Los errores 5xx superan ${UMBRAL_5XX * 100} %.`);
  return { estado: alertas.length ? "CON_ALERTAS" : "OPERATIVO", alertas };
}
