// Nicaragua no usa horario de verano: America/Managua es UTC-6 todo el año.
const DESFASE_HORAS = 6;
const MS_POR_MINUTO = 60_000;

export type Reloj = {
  ahora: Date;
  hoy: { anio: number; mes: number; dia: number };
};

export function crearReloj(ahora: Date = new Date()): Reloj {
  const local = new Date(ahora.getTime() - DESFASE_HORAS * 3_600_000);
  return {
    ahora,
    hoy: { anio: local.getUTCFullYear(), mes: local.getUTCMonth(), dia: local.getUTCDate() },
  };
}

// Ningún hecho sembrado puede quedar en el futuro: se recorta un minuto antes de ahora.
export function limitar(reloj: Reloj, fecha: Date): Date {
  return new Date(Math.min(fecha.getTime(), reloj.ahora.getTime() - MS_POR_MINUTO));
}

// Hora local de Managua en decimal (13.5 = 13:30) del día que queda diasAtras antes de hoy.
export function instante(reloj: Reloj, diasAtras: number, hora: number): Date {
  const horas = Math.floor(hora);
  const minutos = Math.round((hora - horas) * 60);
  const { anio, mes, dia } = reloj.hoy;
  return limitar(reloj, new Date(Date.UTC(anio, mes, dia - diasAtras, horas + DESFASE_HORAS, minutos)));
}

export function desplazarMinutos(reloj: Reloj, fecha: Date, minutos: number): Date {
  return limitar(reloj, new Date(fecha.getTime() + minutos * MS_POR_MINUTO));
}

// Día siguiente al de la fecha dada (hora de Managua), a la hora indicada.
export function diaSiguiente(reloj: Reloj, fecha: Date, hora: number): Date {
  const local = new Date(fecha.getTime() - DESFASE_HORAS * 3_600_000);
  const ms = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1, hora + DESFASE_HORAS);
  return limitar(reloj, new Date(ms));
}

// Valor para columnas date: medianoche UTC del día de calendario. diasAtras negativo da una fecha futura.
export function fechaCalendario(reloj: Reloj, diasAtras: number): Date {
  const { anio, mes, dia } = reloj.hoy;
  return new Date(Date.UTC(anio, mes, dia - diasAtras));
}

export function sumarDiasCalendario(fecha: Date, dias: number): Date {
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate() + dias));
}
