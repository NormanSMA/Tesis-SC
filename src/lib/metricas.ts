// Métricas del proceso en memoria. No hay cuerpos, cookies ni consultas: solo ruta normalizada, método, estado y duración.
// Se reinician con el proceso. El estado vive en globalThis porque Next puede cargar este módulo más de una vez.

const MAX_PETICIONES = 500;
const MAX_ERRORES = 100;
const MAX_MENSAJE = 200;
const VENTANA_MINUTO_MS = 60_000;

export type PeticionMedida = { ruta: string; metodo: string; estado: number; duracionMs: number; hora: number };
export type ErrorMedido = { codigo: string; mensaje: string; ruta: string; peticionId: string; hora: number };
export type RutaLenta = { metodo: string; ruta: string; peticiones: number; p95Ms: number; promedioMs: number };
export type ResumenMetricas = {
  desde: number;
  peticiones: number;
  p50Ms: number | null;
  p95Ms: number | null;
  tasa5xx: number;
  tasa4xx: number;
  peticionesPorMinuto: number;
  rutasLentas: RutaLenta[];
};

export class BufferCircular<T> {
  private items: T[] = [];
  private siguiente = 0;
  constructor(private readonly capacidad: number) {}

  agregar(item: T): void {
    if (this.items.length < this.capacidad) this.items.push(item);
    else this.items[this.siguiente] = item;
    this.siguiente = (this.siguiente + 1) % this.capacidad;
  }

  /** Del más antiguo al más reciente. */
  listar(): T[] {
    if (this.items.length < this.capacidad) return [...this.items];
    return [...this.items.slice(this.siguiente), ...this.items.slice(0, this.siguiente)];
  }

  vaciar(): void {
    this.items = [];
    this.siguiente = 0;
  }
}

type Estado = { desde: number; peticiones: BufferCircular<PeticionMedida>; errores: BufferCircular<ErrorMedido> };
const CLAVE = Symbol.for("tracore.metricas");

function estado(): Estado {
  const global = globalThis as unknown as Record<symbol, Estado | undefined>;
  return (global[CLAVE] ??= {
    desde: Date.now(),
    peticiones: new BufferCircular(MAX_PETICIONES),
    errores: new BufferCircular(MAX_ERRORES),
  });
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Reemplaza ids (UUID y números) por `:id` y descarta la consulta. */
export function normalizarRuta(ruta: string): string {
  const sinConsulta = ruta.split(/[?#]/)[0] ?? "";
  return sinConsulta
    .replace(UUID, ":id")
    .split("/")
    .map((tramo) => (/^\d+$/.test(tramo) ? ":id" : tramo))
    .join("/");
}

/** Quita datos sensibles de un mensaje: correos, ids, tokens, números largos y cadenas largas sin espacios. */
export function redactarMensaje(mensaje: string): string {
  return mensaje
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[correo]")
    .replace(UUID, "[id]")
    .replace(/\b(bearer|basic)\s+\S+/gi, "$1 [REDACTADO]")
    .replace(/\b(contrasena|clave|token|cookie|authorization|password|secret)\b\s*[:=]\s*\S+/gi, "$1=[REDACTADO]")
    .replace(/\d{6,}/g, "[número]")
    .replace(/[A-Za-z0-9_\-+/=]{32,}/g, "[REDACTADO]")
    .slice(0, MAX_MENSAJE);
}

export function registrarPeticion(datos: { ruta: string; metodo: string; estado: number; duracionMs: number }): void {
  estado().peticiones.agregar({
    ruta: normalizarRuta(datos.ruta),
    metodo: datos.metodo,
    estado: datos.estado,
    duracionMs: Math.round(datos.duracionMs * 10) / 10,
    hora: Date.now(),
  });
}

/** Copia un registro de error del logger. Solo lee campos conocidos; ignora cuerpos y cabeceras. */
export function registrarErrorMedido(entrada: unknown): void {
  if (typeof entrada !== "object" || entrada === null) return;
  const campo = (nombre: string): string => {
    const valor = (entrada as Record<string, unknown>)[nombre];
    return typeof valor === "string" ? valor : "";
  };
  estado().errores.agregar({
    codigo: campo("codigo").slice(0, 60) || "ERROR",
    mensaje: redactarMensaje(campo("mensaje")),
    ruta: normalizarRuta(campo("ruta")),
    peticionId: campo("peticionId").slice(0, 60),
    hora: Date.now(),
  });
}

/** Percentil por rango más cercano. Devuelve null sin datos. */
export function percentil(valores: number[], p: number): number | null {
  if (valores.length === 0) return null;
  const orden = [...valores].sort((a, b) => a - b);
  return orden[Math.min(orden.length - 1, Math.max(0, Math.ceil((p / 100) * orden.length) - 1))];
}

const redondear = (valor: number | null): number | null => (valor === null ? null : Math.round(valor * 10) / 10);

function rutasMasLentas(peticiones: PeticionMedida[], limite: number): RutaLenta[] {
  const grupos = new Map<string, PeticionMedida[]>();
  for (const p of peticiones) {
    const clave = `${p.metodo} ${p.ruta}`;
    grupos.set(clave, [...(grupos.get(clave) ?? []), p]);
  }
  return [...grupos.values()]
    .map((grupo) => {
      const duraciones = grupo.map((p) => p.duracionMs);
      return {
        metodo: grupo[0].metodo,
        ruta: grupo[0].ruta,
        peticiones: grupo.length,
        p95Ms: redondear(percentil(duraciones, 95)) ?? 0,
        promedioMs: redondear(duraciones.reduce((a, b) => a + b, 0) / duraciones.length) ?? 0,
      };
    })
    .sort((a, b) => b.p95Ms - a.p95Ms)
    .slice(0, limite);
}

export function resumirMetricas(ahora = Date.now()): ResumenMetricas {
  const { desde, peticiones } = estado();
  const lista = peticiones.listar();
  const duraciones = lista.map((p) => p.duracionMs);
  const total = lista.length;
  return {
    desde,
    peticiones: total,
    p50Ms: redondear(percentil(duraciones, 50)),
    p95Ms: redondear(percentil(duraciones, 95)),
    tasa5xx: total ? lista.filter((p) => p.estado >= 500).length / total : 0,
    tasa4xx: total ? lista.filter((p) => p.estado >= 400 && p.estado < 500).length / total : 0,
    peticionesPorMinuto: lista.filter((p) => ahora - p.hora < VENTANA_MINUTO_MS).length,
    rutasLentas: rutasMasLentas(lista, 5),
  };
}

/** Errores recientes, del más nuevo al más antiguo. */
export function listarErrores(): ErrorMedido[] {
  return estado().errores.listar().reverse();
}

export function reiniciarMetricas(): void {
  const actual = estado();
  actual.desde = Date.now();
  actual.peticiones.vaciar();
  actual.errores.vaciar();
}
