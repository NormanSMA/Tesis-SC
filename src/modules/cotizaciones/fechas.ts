export { hoyManagua } from "@/core/fechas";

export function sumarDias(fecha: string, dias: number): Date {
  const calendario = new Date(`${fecha}T00:00:00.000Z`);
  calendario.setUTCDate(calendario.getUTCDate() + dias);
  return calendario;
}
