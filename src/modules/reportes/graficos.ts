import { formatearMoneda } from "@/lib/formato";
import type { NombreReporte } from "./schema";
import type { FilaReporte, ReporteDto } from "./tipos";

export type SerieGrafico = { clave: string; nombre: string; tono: "principal" | "advertencia" };
export type DatosGrafico = { titulo: string; descripcion: string; unidad: "cantidad" | "moneda"; series: SerieGrafico[];
  filas: { nombre: string; valores: number[] }[] };
const principal = (nombre: string): SerieGrafico => ({ clave: "principal", nombre, tono: "principal" });
const advertencia = (nombre: string): SerieGrafico => ({ clave: "advertencia", nombre, tono: "advertencia" });
const numero = (fila: FilaReporte, campo: string) => Math.max(0, Number(fila[campo]) || 0);
export function textoGrafico(valor: number, unidad: DatosGrafico["unidad"]) {
  return unidad === "moneda" ? formatearMoneda(String(valor)) : new Intl.NumberFormat("es-NI", { maximumFractionDigits: 0 }).format(valor);
}
export function graficosReporte(entrada: { nombre: NombreReporte; reporte: ReporteDto; dinero: boolean }): DatosGrafico[] {
  const { nombre, reporte, dinero } = entrada, filas = reporte.filas;
  if (nombre === "cotizaciones-por-estado") return [
    { titulo: "Distribución de cotizaciones", descripcion: "Cantidad por estado actual de las cotizaciones creadas en el período.", unidad: "cantidad", series: [principal("Cotizaciones")],
      filas: filas.map(f => ({ nombre: String(f.estado), valores: [numero(f, "cantidad")] })) },
    ...(dinero ? [{ titulo: "Monto cotizado por estado", descripcion: "Córdobas equivalentes al tipo de cambio guardado. Estos montos no representan cobros ni ingresos realizados.", unidad: "moneda" as const,
      series: [principal("Monto cotizado")], filas: filas.map(f => ({ nombre: String(f.estado), valores: [numero(f, "importe")] })) }] : []),
  ];
  if (nombre === "existencias") return [{ titulo: "Situación del inventario registrado", unidad: "cantidad", series: [principal("Materiales")],
    descripcion: "Se cuentan materiales, sin sumar m², metros y unidades. Los saldos cero importados requieren verificación física; el gráfico no comprueba existencias reales.",
    filas: [
      { nombre: "Saldo registrado cero", valores: [filas.filter(f => numero(f, "existencia") === 0).length] },
      { nombre: "Saldo positivo bajo mínimo", valores: [filas.filter(f => numero(f, "existencia") > 0 && numero(f, "stockMinimo") > 0 && numero(f, "existencia") <= numero(f, "stockMinimo")).length] },
      { nombre: "Saldo positivo sin alerta", valores: [filas.filter(f => numero(f, "existencia") > 0 && (numero(f, "stockMinimo") === 0 || numero(f, "existencia") > numero(f, "stockMinimo"))).length] },
    ] }];
  if (nombre === "carga-por-operario") return [
    { titulo: "Carga abierta por responsable", descripcion: "Etapas pendientes y en curso en órdenes abiertas a la fecha de consulta. El número de etapas no mide horas de esfuerzo ni productividad.", unidad: "cantidad",
      series: [principal("Pendientes"), advertencia("En curso")], filas: filas.map(f => ({ nombre: String(f.responsable), valores: [numero(f, "pendientes"), numero(f, "enCurso")] })) },
    { titulo: "Etapas completadas en el período", descripcion: "Se cuentan por fecha real de finalización. Las etapas pueden tener distinta complejidad.", unidad: "cantidad", series: [principal("Completadas")],
      filas: filas.map(f => ({ nombre: String(f.responsable), valores: [numero(f, "completadas")] })) },
  ];
  const areas = new Map<string, number[]>();
  for (const f of filas) { const clave = String(f.area), valores = areas.get(clave) ?? [0, 0]; valores[0] += numero(f, "cantidad"); valores[1] += numero(f, "atrasadas"); areas.set(clave, valores); }
  return [{ titulo: "Órdenes abiertas por área", descripcion: "Cada orden se cuenta en su primera etapa abierta. Las atrasadas son parte del total, no una cantidad adicional. Refleja la situación actual.", unidad: "cantidad",
    series: [principal("Órdenes"), advertencia("De ellas, atrasadas")], filas: [...areas].map(([nombre, valores]) => ({ nombre, valores })) }];
}
