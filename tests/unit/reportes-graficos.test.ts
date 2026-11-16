import { describe, expect, it } from "vitest";
import { graficosReporte } from "@/modules/reportes/graficos";
import type { ReporteDto } from "@/modules/reportes/tipos";
const reporte = (filas: ReporteDto["filas"]): ReporteDto => ({ filas, totales: {}, generadoEn: "2026-11-13T12:00:00Z" });
describe("BI-01: interpretación de gráficos", () => {
  it("no incluye montos sin autorización ni presenta cotizaciones como ingresos", () => {
    const datos = reporte([{ estado: "Aprobada", cantidad: 3, importe: "1500.00" }]);
    expect(graficosReporte({ nombre: "cotizaciones-por-estado", reporte: datos, dinero: false })).toHaveLength(1);
    const graficos = graficosReporte({ nombre: "cotizaciones-por-estado", reporte: datos, dinero: true });
    expect(graficos[1].filas[0].valores).toEqual([1500]);
    expect(graficos[1].descripcion).toContain("no representan cobros");
  });
  it("cuenta materiales en grupos excluyentes sin sumar unidades incompatibles", () => {
    const datos = reporte([{ existencia: "0", stockMinimo: "0", unidad: "m²" }, { existencia: "5", stockMinimo: "8", unidad: "Libra" }, { existencia: "20", stockMinimo: "0", unidad: "Unidad" }]);
    const g = graficosReporte({ nombre: "existencias", reporte: datos, dinero: false })[0];
    expect(g.filas.map(f => f.valores)).toEqual([[1],[1],[1]]);
    expect(g.descripcion).toContain("verificación física");
  });
  it("separa carga abierta y completadas en el período", () => {
    const datos = reporte([{ responsable: "Danny", pendientes: 3, enCurso: 2, completadas: 10, atrasadas: 1 }]);
    const graficos = graficosReporte({ nombre: "carga-por-operario", reporte: datos, dinero: false });
    expect(graficos[0].filas[0].valores).toEqual([3,2]);
    expect(graficos[1].filas[0].valores).toEqual([10]);
  });
  it("agrupa áreas y mantiene atrasadas como subconjunto del total", () => {
    const datos = reporte([{ area: "Taller", cantidad: 3, atrasadas: 1 }, { area: "Taller", cantidad: 2, atrasadas: 1 }]);
    expect(graficosReporte({ nombre: "ordenes-por-etapa", reporte: datos, dinero: false })[0].filas).toEqual([{ nombre: "Taller", valores: [5,2] }]);
  });
});
