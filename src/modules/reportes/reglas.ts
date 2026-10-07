import { CIEN, CERO, deEntero, dividir, formatear, multiplicar } from "@/core/decimal";

export function tasaAprobacion(aprobadas: number, rechazadas: number): string {
  const respondidas = aprobadas + rechazadas;
  return formatear(respondidas ? multiplicar(dividir(deEntero(aprobadas), deEntero(respondidas)), CIEN) : CERO, 2);
}
