const calendario = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Managua", year: "numeric", month: "2-digit", day: "2-digit" });

export function hoyManagua(instante = new Date()): string {
  const partes = Object.fromEntries(calendario.formatToParts(instante).map(({ type, value }) => [type, value]));
  return `${partes.year}-${partes.month}-${partes.day}`;
}

export function sumarDias(fecha: string, dias: number): Date {
  const calendario = new Date(`${fecha}T00:00:00.000Z`);
  calendario.setUTCDate(calendario.getUTCDate() + dias);
  return calendario;
}
