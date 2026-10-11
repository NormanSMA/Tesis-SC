import { formatearCantidadPorUnidad, formatearMoneda, formatearPorcentaje } from "@/lib/formato";
import type { NombreReporte } from "./schema";
import type { ColumnaReporte, FilaReporte, ValorReporte } from "./tipos";

export const TITULOS_REPORTES: Record<NombreReporte, string> = {
  "cotizaciones-por-estado": "Cotizaciones por estado", existencias: "Existencias",
  "carga-por-operario": "Carga por operario", "ordenes-por-etapa": "Órdenes por etapa",
};
const COLUMNAS: Record<NombreReporte, ColumnaReporte[]> = {
  "cotizaciones-por-estado": [
    { campo: "estado", encabezado: "Estado", tipo: "texto" },
    { campo: "cantidad", encabezado: "Cantidad", tipo: "numero" },
    { campo: "importe", encabezado: "Importe (C$)", tipo: "decimal" },
  ],
  existencias: [
    { campo: "codigo", encabezado: "Código", tipo: "texto" },
    { campo: "material", encabezado: "Material", tipo: "texto" },
    { campo: "unidad", encabezado: "Unidad", tipo: "texto" },
    { campo: "existencia", encabezado: "Existencia", tipo: "decimal" },
    { campo: "stockMinimo", encabezado: "Stock mínimo", tipo: "decimal" },
    { campo: "costoPromedio", encabezado: "Costo promedio (C$)", tipo: "decimal" },
    { campo: "valorInventario", encabezado: "Valor del inventario (C$)", tipo: "decimal" },
    { campo: "alerta", encabezado: "Alerta", tipo: "texto" },
  ],
  "carga-por-operario": [
    { campo: "responsable", encabezado: "Responsable", tipo: "texto" },
    { campo: "pendientes", encabezado: "Pendientes", tipo: "numero" },
    { campo: "enCurso", encabezado: "En curso", tipo: "numero" },
    { campo: "completadas", encabezado: "Completadas en el periodo", tipo: "numero" },
    { campo: "atrasadas", encabezado: "Atrasadas", tipo: "numero" },
    { campo: "ordenes", encabezado: "Órdenes a su cargo", tipo: "numero" },
  ],
  "ordenes-por-etapa": [
    { campo: "etapa", encabezado: "Etapa actual", tipo: "texto" },
    { campo: "area", encabezado: "Área", tipo: "texto" },
    { campo: "cantidad", encabezado: "Cantidad", tipo: "numero" },
    { campo: "atrasadas", encabezado: "Órdenes atrasadas", tipo: "numero" },
  ],
};
export const ETIQUETAS_TOTALES: Record<string, string> = {
  cantidad: "Cantidad", importe: "Importe (C$)", tasaAprobacion: "Tasa de aprobación (%)",
  materiales: "Materiales", enAlerta: "Materiales en alerta", sinExistencia: "Materiales sin existencia",
  valorInventario: "Valor del inventario (C$)", pendientes: "Etapas pendientes", enCurso: "Etapas en curso",
  completadas: "Completadas en el periodo", atrasadas: "Atrasadas", ordenes: "Órdenes a cargo",
};
export const MONETARIAS = new Set(["importe", "costoPromedio", "valorInventario"]);
export function columnasReporte(nombre: NombreReporte, dinero: boolean): ColumnaReporte[] {
  return COLUMNAS[nombre].filter((columna) => dinero || !MONETARIAS.has(columna.campo));
}
const CANTIDADES = new Set(["existencia", "stockMinimo"]);
export function etiquetaVisible(etiqueta: string): string {
  return etiqueta.replace(/ \((?:C\$|%)\)$/, "");
}
export function celdaVisible(columna: ColumnaReporte, fila: FilaReporte): ValorReporte {
  const valor = fila[columna.campo] ?? null;
  if (valor === null) return "Sin dato";
  if (MONETARIAS.has(columna.campo)) return formatearMoneda(valor);
  if (CANTIDADES.has(columna.campo)) return formatearCantidadPorUnidad(valor, String(fila.unidad ?? ""));
  return valor;
}
export function totalVisible(campo: string, valor: ValorReporte): ValorReporte {
  if (valor === null) return null;
  if (MONETARIAS.has(campo)) return formatearMoneda(valor);
  if (campo === "tasaAprobacion") return formatearPorcentaje(valor);
  return valor;
}
