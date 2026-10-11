import { readFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { columnasReporte, ETIQUETAS_TOTALES, etiquetaVisible, MONETARIAS, TITULOS_REPORTES } from "./columnas";
import type { NombreReporte } from "./schema";
import type { ColumnaReporte, ReporteDto, ValorReporte } from "./tipos";

const AZUL_MARINO = "FF1F2A6B";
const ZEBRA = "FFF1F5F9";
const BORDE_FINO = "FFCBD5E1";
const DORADO_RESPALDO = "#c9962f";
const FORMATO_DINERO = '"C$" #,##0.00';
const FORMATO_PORCENTAJE = "0.0%";
const FORMATO_ENTERO = "#,##0";
const FORMATO_CANTIDAD = "#,##0.000";
const FILA_ENCABEZADO = 6;
const CAMPOS_PORCENTAJE = new Set(["tasaAprobacion"]);

type EntradaXlsx = { nombre: NombreReporte; reporte: ReporteDto; dinero: boolean; periodo?: string; generadoEn: Date };

const formatoInstante = new Intl.DateTimeFormat("es-NI", { timeZone: "America/Managua", day: "2-digit", month: "2-digit",
  year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

async function leerDorado(): Promise<string> {
  const css = await readFile(path.join(process.cwd(), "src", "app", "globals.css"), "utf8").catch(() => "");
  // En despliegues sin el código fuente el CSS no existe; se usa el valor del token vigente.
  return /--brand-gold:\s*(#[0-9a-fA-F]{6})/.exec(css)?.[1] ?? DORADO_RESPALDO;
}
const argb = (hex: string) => `FF${hex.replace("#", "").toUpperCase()}`;
const borde = (color: string): Partial<ExcelJS.Border> => ({ style: "thin", color: { argb: color } });
const bordesFinos = (): Partial<ExcelJS.Borders> => ({ top: borde(BORDE_FINO), bottom: borde(BORDE_FINO), left: borde(BORDE_FINO), right: borde(BORDE_FINO) });

function numeroDe(valor: ValorReporte): number | null {
  if (valor === null || valor === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}
function formatoDeCampo(columna: ColumnaReporte): string | undefined {
  if (MONETARIAS.has(columna.campo)) return FORMATO_DINERO;
  if (columna.tipo === "numero") return FORMATO_ENTERO;
  return columna.tipo === "decimal" ? FORMATO_CANTIDAD : undefined;
}
function valorDeCelda(columna: ColumnaReporte, valor: ValorReporte): ValorReporte {
  return columna.tipo === "texto" ? valor : numeroDe(valor);
}
function estiloEncabezado(fila: ExcelJS.Row) {
  fila.eachCell((celda) => {
    celda.font = { bold: true, color: { argb: "FFFFFFFF" } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL_MARINO } };
    celda.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    celda.border = bordesFinos();
  });
  fila.height = 24;
}
function estiloCuerpo(fila: ExcelJS.Row, indice: number) {
  fila.eachCell({ includeEmpty: true }, (celda) => {
    celda.border = bordesFinos();
    celda.alignment = { vertical: "middle", horizontal: typeof celda.value === "number" ? "right" : "left" };
    if (indice % 2 === 1) celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
  });
}
function bordeInferiorDorado(fila: ExcelJS.Row, columnas: number, dorado: string) {
  for (let columna = 1; columna <= columnas; columna++) {
    const celda = fila.getCell(columna);
    celda.border = { ...celda.border, bottom: { style: "medium", color: { argb: dorado } } };
  }
}
function agregarCabecera(hoja: ExcelJS.Worksheet, entrada: EntradaXlsx) {
  const lineas = [
    { texto: "Soluciones Creativas", font: { bold: true, size: 16, color: { argb: AZUL_MARINO } } },
    { texto: TITULOS_REPORTES[entrada.nombre], font: { bold: true, size: 13, color: { argb: AZUL_MARINO } } },
    { texto: `Periodo: ${entrada.periodo ?? "Sin filtro de periodo"}`, font: { size: 10, color: { argb: "FF475569" } } },
    { texto: `Generado: ${formatoInstante.format(entrada.generadoEn)} (America/Managua)`, font: { size: 10, color: { argb: "FF475569" } } },
  ];
  lineas.forEach((linea, indice) => {
    const celda = hoja.getCell(indice + 1, 2);
    celda.value = linea.texto;
    celda.font = linea.font;
    celda.alignment = { vertical: "middle" };
    hoja.getRow(indice + 1).height = 20;
  });
}
async function agregarLogo(libro: ExcelJS.Workbook, hoja: ExcelJS.Worksheet) {
  // Sin logo el reporte sigue siendo válido; la exportación no debe fallar por un recurso de imagen.
  const imagen = await readFile(path.join(process.cwd(), "public", "brand", "isotipo.png")).catch(() => undefined);
  if (!imagen) return;
  const id = libro.addImage({ buffer: imagen as unknown as ExcelJS.Buffer, extension: "png" });
  hoja.addImage(id, { tl: { col: 0.15, row: 0.15 }, ext: { width: 64, height: 60 } });
}
type ContextoHoja = { hoja: ExcelJS.Worksheet; entrada: EntradaXlsx; dorado: string };

function agregarTabla({ hoja, entrada, dorado }: ContextoHoja, columnas: ColumnaReporte[]) {
  estiloEncabezado(hoja.getRow(FILA_ENCABEZADO));
  entrada.reporte.filas.forEach((datos, indice) => {
    const fila = hoja.getRow(FILA_ENCABEZADO + 1 + indice);
    columnas.forEach((columna, posicion) => {
      const celda = fila.getCell(posicion + 1);
      celda.value = valorDeCelda(columna, datos[columna.campo] ?? null);
      const formato = formatoDeCampo(columna);
      if (formato) celda.numFmt = formato;
    });
    estiloCuerpo(fila, indice);
  });
  const ultima = FILA_ENCABEZADO + entrada.reporte.filas.length;
  bordeInferiorDorado(hoja.getRow(ultima), columnas.length, dorado);
  hoja.autoFilter = { from: { row: FILA_ENCABEZADO, column: 1 }, to: { row: ultima, column: columnas.length } };
  return ultima;
}
function agregarTotales({ hoja, entrada, dorado }: ContextoHoja, filaInicial: number) {
  const titulo = hoja.getCell(filaInicial, 1);
  titulo.value = "Totales";
  titulo.font = { bold: true, size: 13, color: { argb: AZUL_MARINO } };
  hoja.getCell(filaInicial + 1, 1).value = "Indicador";
  hoja.getCell(filaInicial + 1, 2).value = "Valor";
  estiloEncabezado(hoja.getRow(filaInicial + 1));
  const totales = Object.entries(entrada.reporte.totales).filter(([campo]) => entrada.dinero || !MONETARIAS.has(campo));
  totales.forEach(([campo, valor], indice) => {
    const fila = hoja.getRow(filaInicial + 2 + indice);
    const esPorcentaje = CAMPOS_PORCENTAJE.has(campo);
    const numero = numeroDe(valor);
    fila.getCell(1).value = esPorcentaje ? etiquetaVisible(ETIQUETAS_TOTALES[campo]) : ETIQUETAS_TOTALES[campo];
    const celdaValor = fila.getCell(2);
    celdaValor.value = esPorcentaje && numero !== null ? numero / 100 : numero;
    celdaValor.numFmt = esPorcentaje ? FORMATO_PORCENTAJE : MONETARIAS.has(campo) ? FORMATO_DINERO : FORMATO_ENTERO;
    estiloCuerpo(fila, indice);
    fila.getCell(1).font = { bold: true };
  });
  bordeInferiorDorado(hoja.getRow(filaInicial + 1 + totales.length), 2, dorado);
  return totales.map(([campo]) => ETIQUETAS_TOTALES[campo]);
}
function ajustarAnchos({ hoja, entrada }: ContextoHoja, columnas: ColumnaReporte[], etiquetasTotales: string[]) {
  columnas.forEach((columna, posicion) => {
    const textos = entrada.reporte.filas.map((fila) => String(fila[columna.campo] ?? ""));
    const mayor = Math.max(columna.encabezado.length, ...textos.map((texto) => texto.length));
    hoja.getColumn(posicion + 1).width = Math.min(Math.max(mayor + 4, 14), 50);
  });
  const primera = hoja.getColumn(1);
  primera.width = Math.max(primera.width ?? 14, ...etiquetasTotales.map((etiqueta) => etiqueta.length + 4));
  if (columnas.length > 1) hoja.getColumn(2).width = Math.max(hoja.getColumn(2).width ?? 14, 16);
}

export async function generarXlsx(entrada: EntradaXlsx): Promise<Buffer> {
  const columnas = columnasReporte(entrada.nombre, entrada.dinero);
  const dorado = argb(await leerDorado());
  const libro = new ExcelJS.Workbook();
  libro.creator = "Soluciones Creativas";
  libro.created = entrada.generadoEn;
  libro.title = TITULOS_REPORTES[entrada.nombre];
  const hoja = libro.addWorksheet(TITULOS_REPORTES[entrada.nombre].slice(0, 31), {
    views: [{ state: "frozen", ySplit: FILA_ENCABEZADO, showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: `${FILA_ENCABEZADO}:${FILA_ENCABEZADO}` },
  });
  columnas.forEach((columna, posicion) => { hoja.getCell(FILA_ENCABEZADO, posicion + 1).value = columna.encabezado; });
  agregarCabecera(hoja, entrada);
  await agregarLogo(libro, hoja);
  const contexto = { hoja, entrada, dorado };
  const ultimaFila = agregarTabla(contexto, columnas);
  const etiquetasTotales = agregarTotales(contexto, ultimaFila + 2);
  ajustarAnchos(contexto, columnas, etiquetasTotales);
  return Buffer.from(await libro.xlsx.writeBuffer());
}
export function textoPeriodo(desde?: string, hasta?: string): string | undefined {
  if (!desde && !hasta) return undefined;
  return `${desde ?? "inicio"} a ${hasta ?? "hoy"}`;
}
