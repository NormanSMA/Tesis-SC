import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { columnasReporte } from "@/modules/reportes/columnas";
import type { ReporteDto } from "@/modules/reportes/tipos";
import { generarXlsx, textoPeriodo } from "@/modules/reportes/xlsx";

const generadoEn = new Date("2034-05-01T18:30:00Z");
const cotizaciones: ReporteDto = { filas: [{ estado: "Enviada", cantidad: 2, importe: "1234.50" }, { estado: "Aprobada", cantidad: 1, importe: "0.30" }],
  totales: { cantidad: 3, importe: "1234.80", tasaAprobacion: "66.67" }, generadoEn: generadoEn.toISOString() };

async function leerLibro(buffer: Buffer) {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  return libro;
}
const textos = (hoja: ExcelJS.Worksheet) => {
  const celdas: string[] = [];
  hoja.eachRow((fila) => fila.eachCell((celda) => celdas.push(String(celda.value))));
  return celdas;
};

describe("XLSX de reportes", () => {
  it("escribe encabezados, formatos numéricos y totales", async () => {
    const libro = await leerLibro(await generarXlsx({ nombre: "cotizaciones-por-estado", reporte: cotizaciones, dinero: true,
      periodo: textoPeriodo("2034-01-01", "2034-05-01"), generadoEn }));
    const hoja = libro.worksheets[0];
    expect(libro.creator).toBe("TRACORE");
    expect(hoja.getCell("B1").value).toBe("Soluciones Creativas");
    expect(hoja.getCell("B2").value).toBe("Cotizaciones por estado");
    expect(hoja.getCell("B3").value).toBe("Periodo: 2034-01-01 a 2034-05-01");
    expect(String(hoja.getCell("B4").value)).toContain("01/05/2034");
    expect(String(hoja.getCell("B4").value)).toContain("12:30");
    expect(hoja.getRow(6).values).toEqual([undefined, "Estado", "Cantidad", "Importe (C$ equivalente)"]);
    const encabezado = hoja.getCell("A6");
    expect(encabezado.font?.bold).toBe(true);
    expect(encabezado.font?.color?.argb).toBe("FFFFFFFF");
    expect(encabezado.fill).toMatchObject({ fgColor: { argb: "FF1F2A6B" } });
    expect(hoja.getCell("A8").fill).toMatchObject({ fgColor: { argb: "FFF1F5F9" } });
    expect(hoja.getCell("A7").fill).not.toMatchObject({ fgColor: { argb: "FFF1F5F9" } });
    expect(hoja.getCell("B7").value).toBe(2);
    expect(hoja.getCell("B7").numFmt).toBe("#,##0");
    expect(hoja.getCell("C7").value).toBe(1234.5);
    expect(hoja.getCell("C7").numFmt).toBe('"C$" #,##0.00');
    expect(hoja.getCell("A8").border?.bottom?.style).toBe("medium");
    expect(hoja.getCell("A8").border?.bottom?.color?.argb).toBe("FFC9962F");
    expect(hoja.views[0]).toMatchObject({ state: "frozen", ySplit: 6 });
    expect(hoja.autoFilter).toBe("A6:C8");
    expect(hoja.pageSetup).toMatchObject({ orientation: "landscape", fitToWidth: 1 });
    expect(hoja.getImages()).toHaveLength(1);
    expect(hoja.getCell("A10").value).toBe("Totales");
    expect(hoja.getRow(11).values).toEqual([undefined, "Indicador", "Valor"]);
    expect(hoja.getCell("A12").value).toBe("Cantidad");
    expect(hoja.getCell("B12").value).toBe(3);
    expect(hoja.getCell("B13").value).toBe(1234.8);
    expect(hoja.getCell("B13").numFmt).toBe('"C$" #,##0.00');
    expect(hoja.getCell("A14").value).toBe("Tasa de aprobación");
    expect(hoja.getCell("B14").value).toBeCloseTo(0.6667, 4);
    expect(hoja.getCell("B14").numFmt).toBe("0.0%");
  });
  it("oculta columnas y totales monetarios sin permiso", async () => {
    const libro = await leerLibro(await generarXlsx({ nombre: "existencias", dinero: false, generadoEn,
      reporte: { filas: [{ codigo: "MAT", material: "Diseño", unidad: "Metro", existencia: "1.001", stockMinimo: "2.000", alerta: "Stock bajo" }],
        totales: { materiales: 1, enAlerta: 1, valorInventario: "99.00" }, generadoEn: generadoEn.toISOString() } }));
    const hoja = libro.worksheets[0];
    expect(hoja.getRow(6).values).toEqual([undefined, ...columnasReporte("existencias", false).map((columna) => columna.encabezado)]);
    expect(hoja.getCell("D7").value).toBe(1.001);
    expect(hoja.getCell("D7").numFmt).toBe("#,##0.000");
    const contenido = textos(hoja).join("|");
    expect(contenido).not.toMatch(/Costo|Valor del inventario|C\$|99/);
    expect(contenido).toContain("Sin filtro de periodo");
  });
  it("conserva texto con prefijo de fórmula como texto", async () => {
    const libro = await leerLibro(await generarXlsx({ nombre: "cotizaciones-por-estado", dinero: false, generadoEn,
      reporte: { filas: [{ estado: "=SUM(A1)", cantidad: 1 }], totales: { cantidad: 1 }, generadoEn: generadoEn.toISOString() } }));
    expect(libro.worksheets[0].getCell("A7").value).toBe("=SUM(A1)");
  });
});
