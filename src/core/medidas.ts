import { deEntero, multiplicar, sumar, type Racional } from "./decimal";

const DOS = deEntero(2);

/**
 * Superficie de una pieza en m². Sin profundidad: ancho × alto.
 * Con profundidad se cobra como caja abierta (frente más cuatro laterales): ancho × alto + 2 × profundidad × (ancho + alto).
 * Misma fórmula que el CHECK item_importe_catalogo de prisma/sql/restricciones.sql.
 */
export function superficiePieza(ancho: Racional, alto: Racional, profundidad: Racional | null): Racional {
  const frente = multiplicar(ancho, alto);
  return profundidad ? sumar(frente, multiplicar(multiplicar(DOS, profundidad), sumar(ancho, alto))) : frente;
}

/** Texto de medidas para mostrar: "1 × 0.5 m" o, con profundidad, "1 × 0.5 × 0.1 m". */
export function textoMedidas({ ancho, alto, profundidad }: { ancho: string | null; alto: string | null; profundidad?: string | null }) {
  if (!ancho || !alto) return null;
  return `${[ancho, alto, profundidad].filter(Boolean).join(" × ")} m`;
}
