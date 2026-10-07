import { hoyManagua } from "@/modules/cotizaciones/fechas";
import { columnasReporte, ETIQUETAS_TOTALES } from "./columnas";
import type { NombreReporte } from "./schema";
import type { ReporteDto, ValorReporte } from "./tipos";

export function celdaCsv(valor: ValorReporte, texto = true): string {
  const cadena = valor === null ? "" : String(valor);
  const protegida = texto && /^[=+\-@\t\r]/.test(cadena) ? `'${cadena}` : cadena;
  return `"${protegida.replaceAll('"', '""')}"`;
}
export function serializarCsv(entrada: { nombre: NombreReporte; reporte: ReporteDto; dinero: boolean }): string {
  const columnas = columnasReporte(entrada.nombre, entrada.dinero);
  const lineas = [columnas.map((columna) => celdaCsv(columna.encabezado)).join(",")];
  for (const fila of entrada.reporte.filas) {
    lineas.push(columnas.map((columna) => celdaCsv(fila[columna.campo] ?? null, columna.tipo === "texto")).join(","));
  }
  lineas.push("", '"Totales"', '"Indicador","Valor"');
  for (const [campo, valor] of Object.entries(entrada.reporte.totales)) {
    lineas.push(`${celdaCsv(ETIQUETAS_TOTALES[campo])},${celdaCsv(valor, false)}`);
  }
  return `\uFEFF${lineas.join("\r\n")}\r\n`;
}
export function nombreArchivo(nombre: NombreReporte, instante = new Date()): string {
  return `${nombre}-${hoyManagua(instante).replaceAll("-", "")}.csv`;
}
