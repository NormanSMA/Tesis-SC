// Límites de fechas de calendario (AAAA-MM-DD). Evitan años absurdos como 0001 o 9999 por error de tipeo.

const calendario = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Managua", year: "numeric", month: "2-digit", day: "2-digit" });

export function hoyManagua(instante = new Date()): string {
  const partes = Object.fromEntries(calendario.formatToParts(instante).map(({ type, value }) => [type, value]));
  return `${partes.year}-${partes.month}-${partes.day}`;
}

/** Ninguna consulta ni registro de la empresa es anterior a este día. */
export const FECHA_MINIMA = "2000-01-01";
/** Las fechas planificadas y de entrega admiten como máximo este alcance desde hoy. */
export const ANIOS_PLANIFICACION = 1;

/** Suma años conservando el día; el 29 de febrero pasa al 28 en años no bisiestos. */
export function desplazarAnios(fecha: string, anios: number): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const destino = new Date(Date.UTC(anio + anios, mes - 1, dia));
  if (destino.getUTCMonth() !== mes - 1) destino.setUTCDate(0);
  return destino.toISOString().slice(0, 10);
}

/** Rango de planificación: un año antes y un año después de hoy. */
export function rangoPlanificacion(hoy: string) {
  return { minimo: desplazarAnios(hoy, -ANIOS_PLANIFICACION), maximo: desplazarAnios(hoy, ANIOS_PLANIFICACION) };
}

/** Rango de filtros de consulta: desde FECHA_MINIMA hasta un año después de hoy. */
export function rangoConsulta(hoy: string) {
  return { minimo: FECHA_MINIMA, maximo: desplazarAnios(hoy, ANIOS_PLANIFICACION) };
}

export function fueraDeRango(fecha: string, rango: { minimo: string; maximo: string }): boolean {
  return fecha < rango.minimo || fecha > rango.maximo;
}
