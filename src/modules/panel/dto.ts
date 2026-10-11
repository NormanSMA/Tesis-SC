import { CIEN, comparar, deEntero, dividir, formatear, leerDecimal, multiplicar, restar } from "@/core/decimal";
import { formatearDecimal, formatearMoneda } from "@/lib/formato";
import type { MesComercial, Tendencia } from "./tipos";

export const META_APROBACION_PCT = 70;
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function nombreMes(fecha: string): string { return MESES[Number(fecha.slice(5, 7)) - 1]; }
export function dineroPanel(valor: string): string { return formatearMoneda(valor).replace(/\.00$/, ""); }
export function cantidadPanel(valor: number): string { return formatearDecimal(String(valor), 0); }
export function tasaAprobacion(mes: Pick<MesComercial, "aprobadas" | "respondidas">): number {
  return mes.respondidas ? mes.aprobadas * 100 / mes.respondidas : 0;
}
export function tendenciaMonto(actual: string, anterior: string): Tendencia {
  const a = leerDecimal(actual)!;
  const b = leerDecimal(anterior)!;
  const signo = comparar(a, b);
  const direccion = signo > 0 ? "sube" : signo < 0 ? "baja" : "igual";
  if (b.num === BigInt(0)) return { direccion, texto: "sin aprobaciones el mes anterior" };
  const porcentaje = multiplicar(dividir(restar(a, b), b), CIEN);
  return { direccion, texto: `${formatear({ ...porcentaje, num: porcentaje.num < BigInt(0) ? -porcentaje.num : porcentaje.num }, 0)} %` };
}
export function tendenciaTasa(actual: MesComercial, anterior: MesComercial): Tendencia {
  const tasa = (mes: MesComercial) => mes.respondidas ? dividir(deEntero(mes.aprobadas * 100), deEntero(mes.respondidas)) : deEntero(0);
  const puntos = restar(tasa(actual), tasa(anterior));
  return { direccion: puntos.num > BigInt(0) ? "sube" : puntos.num < BigInt(0) ? "baja" : "igual",
    texto: `${formatear(puntos, 0)} puntos frente al mes anterior` };
}
export function tituloGerencia(actual: MesComercial, anterior: MesComercial): string {
  const mes = nombreMes(actual.mes);
  const inicio = `${mes[0].toUpperCase()}${mes.slice(1)} lleva ${dineroPanel(actual.monto)} aprobados`;
  const tendencia = tendenciaMonto(actual.monto, anterior.monto);
  if (leerDecimal(anterior.monto)!.num === BigInt(0)) return `${inicio}, sin aprobaciones el mes anterior`;
  if (tendencia.direccion === "igual") return `${inicio}, igual que ${nombreMes(anterior.mes)}`;
  return `${inicio}, ${tendencia.texto} ${tendencia.direccion === "sube" ? "más" : "menos"} que ${nombreMes(anterior.mes)}`;
}
