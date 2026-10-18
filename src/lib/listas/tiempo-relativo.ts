const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

function plural(cantidad: number, singular: string, varios: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : varios}`;
}

function magnitud(ms: number): string {
  if (ms < MINUTO) return "menos de 1 min";
  if (ms < HORA) return `${Math.floor(ms / MINUTO)} min`;
  if (ms < DIA) return plural(Math.floor(ms / HORA), "h", "h");
  return plural(Math.floor(ms / DIA), "día", "días");
}

/**
 * Texto relativo entre una fecha y una referencia fija ("hace 3 días", "en 2 h").
 * Pura: recibe la referencia (ej. generadoEn del servidor) y nunca usa Date.now(),
 * así el servidor y el cliente producen el mismo texto al hidratar.
 */
export function tiempoRelativo(fecha: string | Date, referencia: string | Date): string {
  const objetivo = new Date(fecha).getTime();
  const base = new Date(referencia).getTime();
  if (Number.isNaN(objetivo) || Number.isNaN(base)) return "";
  const diferencia = objetivo - base;
  if (Math.abs(diferencia) < MINUTO) return "ahora";
  return diferencia < 0 ? `hace ${magnitud(-diferencia)}` : `en ${magnitud(diferencia)}`;
}

/** Días completos entre dos fechas (positivo si fecha es anterior a referencia). */
export function diasTranscurridos(fecha: string | Date, referencia: string | Date): number {
  const diferencia = new Date(referencia).getTime() - new Date(fecha).getTime();
  return Number.isNaN(diferencia) ? 0 : Math.floor(diferencia / DIA);
}
