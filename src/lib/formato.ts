import type { Moneda } from "@/core/moneda";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const ZONA_HORARIA = "America/Managua";
const FECHA_CALENDARIO = /^(\d{4})-(\d{2})-(\d{2})$/;
const ESPACIO_DURO = " ";
const DECIMAL = /^(-)?(\d+)(?:\.(\d+))?$/;

const formateadorInstante = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONA_HORARIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function agruparMiles(entero: string): string {
  return entero.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Redondea con aritmética entera: los montos llegan como cadena decimal y no deben pasar por float.
function redondearDecimales(entero: string, fraccion: string, decimales: number): [string, string] {
  const relleno = fraccion.padEnd(decimales + 1, "0");
  const escala = BigInt(`1${"0".repeat(decimales)}`);
  const base = BigInt(entero) * escala + BigInt(relleno.slice(0, decimales) || "0");
  const redondeo = Number(relleno[decimales]) >= 5 ? BigInt(1) : BigInt(0);
  const total = (base + redondeo).toString().padStart(decimales + 1, "0");
  const corte = total.length - decimales;
  return [total.slice(0, corte), total.slice(corte)];
}

export function formatearDecimal(valor: string | number, decimales: number): string {
  const texto = typeof valor === "number" ? valor.toFixed(decimales + 2) : valor.trim();
  const partes = DECIMAL.exec(texto);
  if (!partes) return "";
  const [, signo, entero, fraccion = ""] = partes;
  const [enteroFinal, fraccionFinal] = redondearDecimales(entero, fraccion, decimales);
  const esCero = /^0*$/.test(enteroFinal + fraccionFinal);
  const prefijo = signo && !esCero ? "-" : "";
  const cuerpo = agruparMiles(enteroFinal);
  return decimales > 0 ? `${prefijo}${cuerpo}.${fraccionFinal}` : `${prefijo}${cuerpo}`;
}

// Espacio duro: el símbolo y la cifra no se separan al cortar línea.
function conSimboloMoneda(numero: string, moneda: Moneda): string {
  const simbolo = moneda === "USD" ? "US$" : "C$";
  return numero.startsWith("-")
    ? `-${simbolo}${ESPACIO_DURO}${numero.slice(1)}` : `${simbolo}${ESPACIO_DURO}${numero}`;
}

function quitarCerosFinales(numero: string): string {
  return numero.includes(".") ? numero.replace(/0+$/, "").replace(/\.$/, "") : numero;
}

export function formatearMoneda(valor: string | number | null | undefined, moneda: Moneda = "NIO"): string {
  if (valor === null || valor === undefined || valor === "") return "";
  const numero = formatearDecimal(valor, 2);
  if (!numero) return "";
  return conSimboloMoneda(numero, moneda);
}

export function formatearCantidad(valor: string | number | null | undefined, decimales = 2): string {
  if (valor === null || valor === undefined || valor === "") return "";
  return formatearDecimal(valor, decimales);
}

export function formatearMonedaEntera(valor: string | number | null | undefined, moneda: Moneda = "NIO"): string {
  if (valor === null || valor === undefined || valor === "") return "";
  const numero = formatearDecimal(valor, 0);
  if (!numero) return "";
  return conSimboloMoneda(numero, moneda);
}

export function formatearPorcentaje(valor: string | number | null | undefined, decimales = 1): string {
  if (valor === null || valor === undefined || valor === "") return "";
  const numero = quitarCerosFinales(formatearDecimal(valor, decimales));
  return numero ? `${numero} %` : "";
}

const NOMBRES_UNIDAD: Record<string, string> = {
  UNIDAD: "unidad", METRO: "metro", M2: "m²", YARDA: "yarda", PIE: "pie", LITRO: "litro",
  GALON: "galón", KILOGRAMO: "kilogramo", LIBRA: "libra", PLIEGO: "pliego", ROLLO: "rollo",
};

/** Nombre legible en minúscula: "M2" -> "m²". Un código desconocido se devuelve en minúscula. */
export function nombreUnidad(unidad: string): string {
  const codigo = unidad.trim().toUpperCase();
  return NOMBRES_UNIDAD[codigo] ?? unidad.trim().toLowerCase();
}

/**
 * Cantidad sin ceros sobrantes: 8.000 -> "8", 3.700 -> "3.7", 0.125 -> "0.125".
 * Una unidad entera se ve sin decimales; una fraccionaria (medio rollo) conserva su valor real.
 * El parámetro unidad se conserva por compatibilidad; la regla no redondea nunca.
 */
export function formatearCantidadPorUnidad(valor: string | number | null | undefined, _unidad: string, decimales = 3): string {
  return quitarCerosFinales(formatearCantidad(valor, decimales));
}

/** Cantidad con su unidad legible: "1,200 pliego", "2.5 m²". */
export function formatearCantidadConUnidad(valor: string | number | null | undefined, unidad: string): string {
  const cantidad = formatearCantidadPorUnidad(valor, unidad);
  return cantidad ? `${cantidad}${ESPACIO_DURO}${nombreUnidad(unidad)}` : "";
}

function fechaDesdePartes(dia: string, mes: number, anio: string): string {
  return `${dia} ${MESES[mes - 1]} ${anio}`;
}

function partesEnManagua(instante: Date): Record<string, string> {
  return Object.fromEntries(
    formateadorInstante.formatToParts(instante).map((parte) => [parte.type, parte.value]),
  );
}

function leerInstante(valor: string): Date | null {
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/**
 * Acepta AAAA-MM-DD (fecha de calendario, sin zona horaria) o un instante ISO 8601.
 * La fecha de calendario no pasa por Date para evitar el corrimiento de un día.
 */
export function formatearFecha(valor: string | null | undefined): string {
  if (!valor) return "";
  const calendario = FECHA_CALENDARIO.exec(valor);
  if (calendario) return fechaDesdePartes(calendario[3], Number(calendario[2]), calendario[1]);
  const instante = leerInstante(valor);
  if (!instante) return "";
  const partes = partesEnManagua(instante);
  return fechaDesdePartes(partes.day, Number(partes.month), partes.year);
}

export function formatearFechaHora(instante: string | null | undefined): string {
  if (!instante) return "";
  const fecha = leerInstante(instante);
  if (!fecha) return "";
  const partes = partesEnManagua(fecha);
  return `${fechaDesdePartes(partes.day, Number(partes.month), partes.year)}, ${partes.hour}:${partes.minute}`;
}
