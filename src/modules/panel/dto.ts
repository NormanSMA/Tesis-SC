import { CIEN, comparar, deEntero, dividir, formatear, leerDecimal, multiplicar, restar } from "@/core/decimal";
import { formatearCantidadPorUnidad, formatearDecimal, formatearMonedaEntera } from "@/lib/formato";
import type { ComparacionIndicador, MesComercial, Tendencia } from "./tipos";

export const META_APROBACION_PCT = 70;
export function comparacionPanel(actual: number, anterior: number, periodo: string): ComparacionIndicador {
  const porcentaje = anterior === 0 ? null : (actual - anterior) * 100 / anterior;
  const texto = porcentaje === null ? `Sin datos en ${periodo}`
    : `${porcentaje > 0 ? "+" : ""}${formatearDecimal(String(porcentaje), 0)} % respecto a ${periodo}`;
  return { porcentaje, texto };
}
export function mesAnterior(hoy: string): string {
  const fecha = new Date(`${hoy.slice(0, 7)}-01T00:00:00Z`);
  fecha.setUTCMonth(fecha.getUTCMonth() - 1);
  return fecha.toISOString().slice(0, 10);
}
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function nombreMes(fecha: string): string { return MESES[Number(fecha.slice(5, 7)) - 1]; }
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export function nombreMesCorto(fecha: string): string { return nombreMes(fecha).slice(0, 3); }
export function etiquetaDia(fecha: string): string {
  const dia = new Date(`${fecha}T00:00:00Z`);
  return `${DIAS[dia.getUTCDay()]} ${dia.getUTCDate()}`;
}
export function etiquetaSemana(fecha: string): string { return `${Number(fecha.slice(8, 10))} ${nombreMesCorto(fecha)}`; }
export function mesesConActividad<T extends Pick<MesComercial, "monto">>(meses: T[]): T[] {
  const primero = meses.findIndex((mes) => Number(mes.monto) !== 0);
  const inicioUltimosDos = Math.max(meses.length - 2, 0);
  return meses.slice(primero === -1 ? inicioUltimosDos : Math.min(primero, inicioUltimosDos));
}
export function cantidadMaterialPanel(valor: string, unidad: string): string {
  return formatearCantidadPorUnidad(valor, unidad);
}
export function dineroPanel(valor: string): string { return formatearMonedaEntera(valor); }
export function cantidadPanel(valor: number): string { return formatearDecimal(String(valor), 0); }
export function tasaAprobacion(mes: Pick<MesComercial, "aprobadas" | "respondidas">): number {
  return mes.respondidas ? mes.aprobadas * 100 / mes.respondidas : 0;
}
export function tendenciaMonto(actual: string, anterior: string): Tendencia {
  const montoActual = leerDecimal(actual)!;
  const montoAnterior = leerDecimal(anterior)!;
  const signo = comparar(montoActual, montoAnterior);
  const direccion = signo > 0 ? "sube" : signo < 0 ? "baja" : "igual";
  if (montoAnterior.num === BigInt(0)) return { direccion, texto: "sin aprobaciones el mes anterior" };
  const porcentaje = multiplicar(dividir(restar(montoActual, montoAnterior), montoAnterior), CIEN);
  return { direccion, texto: `${formatear({ ...porcentaje, num: porcentaje.num < BigInt(0) ? -porcentaje.num : porcentaje.num }, 0)} %` };
}
export function tendenciaTasa(actual: MesComercial, anterior: MesComercial): Tendencia {
  const tasa = (mes: MesComercial) => mes.respondidas ? dividir(deEntero(mes.aprobadas * 100), deEntero(mes.respondidas)) : deEntero(0);
  const puntos = restar(tasa(actual), tasa(anterior));
  return { direccion: puntos.num > BigInt(0) ? "sube" : puntos.num < BigInt(0) ? "baja" : "igual",
    texto: `${formatear({ ...puntos, num: puntos.num < BigInt(0) ? -puntos.num : puntos.num }, 0)} pts` };
}
export function tituloGerencia(actual: MesComercial, anterior: MesComercial): string {
  const mes = nombreMes(actual.mes);
  const inicio = `${mes[0].toUpperCase()}${mes.slice(1)} lleva ${dineroPanel(actual.monto)} aprobados`;
  const tendencia = tendenciaMonto(actual.monto, anterior.monto);
  if (leerDecimal(anterior.monto)!.num === BigInt(0)) return `${inicio}, sin aprobaciones el mes anterior`;
  if (tendencia.direccion === "igual") return `${inicio}, igual que ${nombreMes(anterior.mes)}`;
  return `${inicio}, ${tendencia.texto} ${tendencia.direccion === "sube" ? "más" : "menos"} que ${nombreMes(anterior.mes)}`;
}
