import ExcelJS from "exceljs";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import type { ReporteDto } from "@/modules/reportes/tipos";
import { NOMBRES_REPORTES } from "@/modules/reportes/schema";
import { columnasReporte, ETIQUETAS_TOTALES } from "@/modules/reportes/columnas";
import { liberarClienteGlobal } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { conPermisoRevocado } from "./cotizaciones-ayudas";
import { crearCotizacionPanel, crearMaterialPanel, prepararPanel, solicitarReporte, type EntornoPanel } from "./panel-ayudas";

let db: PrismaClient;
let entorno: EntornoPanel;
function parsearCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [], celda = "", comillas = false;
  for (let indice = texto.charCodeAt(0) === 0xfeff ? 1 : 0; indice < texto.length; indice++) {
    const caracter = texto[indice];
    if (caracter === '"' && comillas && texto[indice + 1] === '"') { celda += '"'; indice++; }
    else if (caracter === '"') comillas = !comillas;
    else if (!comillas && caracter === ",") { fila.push(celda); celda = ""; }
    else if (!comillas && caracter === "\r" && texto[indice + 1] === "\n") {
      fila.push(celda); filas.push(fila); fila = []; celda = ""; indice++;
    } else celda += caracter;
  }
  return filas;
}
function comprobarCsv(entrada: { csv: string; nombre: typeof NOMBRES_REPORTES[number]; reporte: ReporteDto }) {
  const columnas = columnasReporte(entrada.nombre, true);
  const filas = parsearCsv(entrada.csv);
  expect(filas[0]).toEqual(columnas.map((columna) => columna.encabezado));
  const esperadas = entrada.reporte.filas.map((fila) => columnas.map((columna) => {
    const valor = String(fila[columna.campo] ?? "");
    return columna.tipo === "texto" && /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  }));
  expect(filas.slice(1, 1 + esperadas.length)).toEqual(esperadas);
  expect(filas.slice(esperadas.length + 4)).toEqual(Object.entries(entrada.reporte.totales).map(([campo, valor]) =>
    [ETIQUETAS_TOTALES[campo], String(valor)]));
}
function registrarPerfiles() {
  for (const nombre of NOMBRES_REPORTES) {
    for (const perfil of ["GERENCIA", "ADMINISTRACION", "OPERACIONES", "ATENCION_CLIENTE", "PRODUCCION", "ADMIN"] as const) {
      it(`${nombre}: ${perfil} JSON y CSV`, async () => {
        for (const parametros of ["", "formato=csv"]) {
          const respuesta = await solicitarReporte(entorno, { nombre, parametros, cookie: entorno.sesiones[perfil].cookie });
          expect(respuesta.status).toBe(perfil === "GERENCIA" ? 200 : 403);
          if (perfil !== "GERENCIA") expect((await respuesta.json()).error.codigo).toBe("SIN_PERMISO");
        }
      });
    }
    it(`${nombre}: sin sesión devuelve 401`, async () => {
      const respuesta = await solicitarReporte(entorno, { nombre });
      expect(respuesta.status).toBe(401); expect((await respuesta.json()).error.codigo).toBe("SIN_SESION");
    });
  }
}
function registrarValidaciones() {
  for (const parametros of ["desde=2026-02-30", "hasta=2025-02-29", "desde=2034-05-02&hasta=2034-05-01",
    "desde=2025-05-01&hasta=2030-05-02", "formato=pdf", "area=no", "soloAlertas=si"]) {
    it(`responde 422: ${parametros}`, async () => {
      const respuesta = await solicitarReporte(entorno, { nombre: "cotizaciones-por-estado", parametros, cookie: entorno.sesiones.GERENCIA.cookie });
      expect(respuesta.status).toBe(422);
      expect((await respuesta.json()).error).toMatchObject({ codigo: "VALIDACION", campos: expect.any(Object) });
    });
  }
  it("reporte desconocido devuelve 404 y protege primero la sesión", async () => {
    const respuesta = await solicitarReporte(entorno, { nombre: "desconocido", cookie: entorno.sesiones.GERENCIA.cookie });
    expect(respuesta.status).toBe(404); expect((await respuesta.json()).error.codigo).toBe("NO_ENCONTRADO");
    expect((await solicitarReporte(entorno, { nombre: "desconocido" })).status).toBe(401);
    expect((await solicitarReporte(entorno, { nombre: "desconocido", cookie: entorno.sesiones.ATENCION_CLIENTE.cookie })).status).toBe(403);
  });
}
function registrarExportaciones() {
  for (const nombre of NOMBRES_REPORTES) {
    it(`${nombre}: CSV coincide con JSON, BOM, cabeceras y nombre local`, async () => {
      const cookie = entorno.sesiones.GERENCIA.cookie;
      const parametros = nombre === "cotizaciones-por-estado" || nombre === "carga-por-operario"
        ? "desde=2041-01-01&hasta=2041-01-01" : "";
      const json = await solicitarReporte(entorno, { nombre, parametros, cookie });
      const reporte = (await json.json()).datos as ReporteDto;
      const respuesta = await solicitarReporte(entorno, { nombre, parametros: `${parametros}&formato=csv`, cookie });
      expect(respuesta.status).toBe(200);
      expect(respuesta.headers.get("content-type")).toBe("text/csv; charset=utf-8");
      const { hoyManagua } = await import("@/modules/cotizaciones/fechas");
      expect(respuesta.headers.get("content-disposition")).toBe(`attachment; filename="${nombre}-${hoyManagua().replaceAll("-", "")}.csv"`);
      const bytes = Buffer.from(await respuesta.arrayBuffer());
      expect([...bytes.subarray(0, 3)]).toEqual([239, 187, 191]);
      comprobarCsv({ csv: bytes.toString("utf8"), nombre, reporte });
    });
  }
  for (const nombre of NOMBRES_REPORTES) {
    it(`${nombre}: XLSX coincide con JSON, tipo y nombre local`, async () => {
      const cookie = entorno.sesiones.GERENCIA.cookie;
      const parametros = nombre === "cotizaciones-por-estado" || nombre === "carga-por-operario"
        ? "desde=2041-01-01&hasta=2041-01-01" : "";
      const json = await solicitarReporte(entorno, { nombre, parametros, cookie });
      const reporte = (await json.json()).datos as ReporteDto;
      const respuesta = await solicitarReporte(entorno, { nombre, parametros: `${parametros}&formato=xlsx`, cookie });
      expect(respuesta.status).toBe(200);
      expect(respuesta.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      expect(respuesta.headers.get("cache-control")).toBe("private, no-store");
      const { hoyManagua } = await import("@/modules/cotizaciones/fechas");
      expect(respuesta.headers.get("content-disposition")).toBe(`attachment; filename="${nombre}-${hoyManagua().replaceAll("-", "")}.xlsx"`);
      const libro = new ExcelJS.Workbook();
      await libro.xlsx.load(Buffer.from(await respuesta.arrayBuffer()) as unknown as ExcelJS.Buffer);
      const hoja = libro.worksheets[0];
      expect(hoja.getRow(6).values).toEqual([undefined, ...columnasReporte(nombre, true).map((columna) => columna.encabezado)]);
      expect(hoja.getCell(7 + reporte.filas.length + 1, 1).value).toBe("Totales");
    });
  }
  it("exporta texto peligroso protegido y conserva tildes", async () => {
    const marca = `Csv ${entorno.sesiones.GERENCIA.usuarioId}`;
    await crearMaterialPanel(entorno, { nombre: `=FÓRMULA ${marca}`, existencia: "1.001" });
    const respuesta = await solicitarReporte(entorno, { nombre: "existencias", parametros: `texto=${marca}&formato=csv`, cookie: entorno.sesiones.GERENCIA.cookie });
    const filas = parsearCsv(Buffer.from(await respuesta.arrayBuffer()).toString("utf8"));
    expect(filas[1][1]).toBe(`'=FÓRMULA ${marca}`); expect(filas[1][3]).toBe("1.001");
  });
  it("registra usuario, reporte y filtros sin contenido ni bitácora", async () => {
    const registro = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const antes = await db.bitacora.count();
    try {
      await solicitarReporte(entorno, { nombre: "existencias", parametros: "texto=registrado&formato=csv", cookie: entorno.sesiones.GERENCIA.cookie });
      expect(registro).toHaveBeenCalledExactlyOnceWith("Exportación CSV", { usuario: entorno.sesiones.GERENCIA.usuarioId,
        reporte: "existencias", filtros: { texto: "registrado", formato: "csv", soloAlertas: "false" } });
      expect(await db.bitacora.count()).toBe(antes);
    } finally { registro.mockRestore(); }
  });
}
function registrarRevocaciones() {
  it("exige reporte:exportar aunque pueda consultar JSON", async () => {
    await conPermisoRevocado(db, { perfil: "GERENCIA", permiso: "reporte:exportar" }, async () => {
      for (const nombre of NOMBRES_REPORTES) {
        expect((await solicitarReporte(entorno, { nombre, cookie: entorno.sesiones.GERENCIA.cookie })).status).toBe(200);
        for (const formato of ["csv", "xlsx"]) {
          expect((await solicitarReporte(entorno, { nombre, parametros: `formato=${formato}`, cookie: entorno.sesiones.GERENCIA.cookie })).status).toBe(403);
        }
      }
    });
  });
  it("revocar reporte:ver bloquea JSON y CSV en sesiones existentes", async () => {
    await conPermisoRevocado(db, { perfil: "GERENCIA", permiso: "reporte:ver" }, async () => {
      for (const nombre of NOMBRES_REPORTES) for (const parametros of ["", "formato=csv"]) {
        expect((await solicitarReporte(entorno, { nombre, parametros, cookie: entorno.sesiones.GERENCIA.cookie })).status).toBe(403);
      }
    });
  });
  it("revocar cotizacion:ver elimina columnas y totales monetarios del CSV", async () => {
    await conPermisoRevocado(db, { perfil: "GERENCIA", permiso: "cotizacion:ver" }, async () => {
      for (const nombre of ["cotizaciones-por-estado", "existencias"] as const) {
        const respuesta = await solicitarReporte(entorno, { nombre, parametros: "formato=csv", cookie: entorno.sesiones.GERENCIA.cookie });
        expect(respuesta.status).toBe(200); expect(await respuesta.text()).not.toMatch(/Importe|Costo|Valor del inventario|C\$/);
      }
    });
  });
}
describeConBase("reportes: API y exportaciones por perfil", () => {
  db = crearClientePropietario();
  beforeAll(async () => {
    entorno = await prepararPanel(db);
    await crearCotizacionPanel(entorno, { estado: "APROBADA", total: "123.45", creadoEn: "2041-01-01T12:00:00Z" });
  });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });
  registrarPerfiles(); registrarValidaciones(); registrarExportaciones(); registrarRevocaciones();
});
