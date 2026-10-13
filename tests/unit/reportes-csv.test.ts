import { describe, expect, it } from "vitest";
import { celdaCsv, nombreArchivo, serializarCsv } from "@/modules/reportes/csv";
import type { ReporteDto } from "@/modules/reportes/tipos";

describe("CSV de reportes", () => {
  it.each(["=SUM(A1)", "+123", "-cmd", "@SUM(A1)", "\tformula", "\rformula"])("protege el prefijo %j", (texto) => {
    expect(celdaCsv(texto)).toBe(`"'${texto}"`);
  });
  it("escapa comillas, comas y saltos internos", () => {
    expect(celdaCsv('Diseño, "rápido"\r\nImpresión')).toBe('"Diseño, ""rápido""\r\nImpresión"');
  });
  it("conserva números y decimales con punto sin protección textual", () => {
    expect(celdaCsv("-123.45", false)).toBe('"-123.45"');
    expect(celdaCsv("123456789012.34", false)).toBe('"123456789012.34"');
    expect(celdaCsv(0, false)).toBe('"0"');
    expect(celdaCsv(null)).toBe('""');
  });
  it("escribe BOM, tildes, CRLF, filas y totales", () => {
    const reporte: ReporteDto = { filas: [{ estado: "Enviada", cantidad: 2, importe: "0.30" }],
      totales: { cantidad: 2, importe: "0.30", tasaAprobacion: "66.67" }, generadoEn: "2034-05-01T06:00:00Z" };
    const csv = serializarCsv({ nombre: "cotizaciones-por-estado", reporte, dinero: true });
    expect(csv).toBe('\uFEFF"Estado","Cantidad","Importe (C$ equivalente)"\r\n"Enviada","2","0.30"\r\n\r\n"Totales"\r\n"Indicador","Valor"\r\n"Cantidad","2"\r\n"Importe (C$ equivalente)","0.30"\r\n"Tasa de aprobación (%)","66.67"\r\n');
    expect(Buffer.from(csv).subarray(0, 3)).toEqual(Buffer.from([239, 187, 191]));
    expect(csv.replaceAll("\r\n", "")).not.toContain("\n");
  });
  it("excluye columnas monetarias sin permiso", () => {
    const csv = serializarCsv({ nombre: "existencias", dinero: false,
      reporte: { filas: [{ codigo: "MAT", material: "Diseño", unidad: "Metro", existencia: "1.000", stockMinimo: "2.000", alerta: "Stock bajo" }],
        totales: { materiales: 1 }, generadoEn: "2034-05-01T06:00:00Z" } });
    expect(csv).toContain('"Código"'); expect(csv).not.toMatch(/Costo|Valor del inventario/);
  });
  it("usa la fecha local de Managua para el nombre", () => {
    expect(nombreArchivo("existencias", new Date("2034-05-02T05:59:59Z"))).toBe("existencias-20340501.csv");
    expect(nombreArchivo("existencias", new Date("2034-05-02T06:00:00Z"))).toBe("existencias-20340502.csv");
  });
});
