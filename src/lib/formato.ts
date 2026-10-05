const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const ZONA_HORARIA = "America/Managua";
const FECHA_CALENDARIO = /^(\d{4})-(\d{2})-(\d{2})$/;
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

export function formatearMoneda(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "";
  const numero = formatearDecimal(valor, 2);
  if (!numero) return "";
  return numero.startsWith("-") ? `-C$ ${numero.slice(1)}` : `C$ ${numero}`;
}

export function formatearCantidad(valor: string | number | null | undefined, decimales = 2): string {
  if (valor === null || valor === undefined || valor === "") return "";
  return formatearDecimal(valor, decimales);
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
