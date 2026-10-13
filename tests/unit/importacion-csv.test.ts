import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { analizarCsv } from "@/modules/importacion/csv";
import { esquemaImportacion } from "@/modules/importacion/schema";
import { COLUMNAS } from "@/modules/importacion/tipos";

describe("analizarCsv", () => {
  const columnas = ["nombre", "telefono"];

  it("acepta UTF-8 con BOM y sin BOM", () => {
    for (const prefijo of ["", "\uFEFF"]) {
      expect(analizarCsv(`${prefijo}nombre,telefono\nMaría,8888`, columnas).filas)
        .toEqual([{ fila: 2, datos: { nombre: "María", telefono: "8888" } }]);
    }
  });

  it("omite líneas vacías y conserva las filas físicas", () => {
    const resultado = analizarCsv("nombre,telefono\r\n\r\n , \r\nAna,8888\r\n\r\nEva,9999", columnas);
    expect(resultado.errores).toEqual([]);
    expect(resultado.filas.map(({ fila }) => fila)).toEqual([4, 6]);
  });

  it("interpreta comillas, comas y saltos dentro de un campo", () => {
    const resultado = analizarCsv('nombre,telefono\n"Ana, ""SA""\nEstelí",8888\nEva,9999', columnas);
    expect(resultado.filas[0]).toEqual({ fila: 2, datos: { nombre: 'Ana, "SA"\nEstelí', telefono: "8888" } });
    expect(resultado.filas[1].fila).toBe(4);
  });

  it("rechaza encabezados faltantes, adicionales, repetidos y otro separador", () => {
    for (const encabezado of ["nombre", "nombre,telefono,extra", "nombre,nombre", "nombre;telefono"]) {
      const resultado = analizarCsv(`${encabezado}\nAna,8888`, columnas);
      expect(resultado.filas).toEqual([]);
      expect(resultado.errores[0].fila).toBe(1);
    }
  });

  it("excluye filas con columnas faltantes o adicionales", () => {
    const resultado = analizarCsv("nombre,telefono\nAna\nEva,9999\nLeo,1111,extra", columnas);
    expect(resultado.filas.map(({ fila }) => fila)).toEqual([3]);
    expect(resultado.errores.map(({ fila }) => fila)).toEqual([2, 4]);
  });

  it("acepta 500 filas y rechaza el archivo completo al superar el límite", () => {
    const texto = `nombre,telefono\n${Array.from({ length: 500 }, () => "Ana,8888").join("\n")}`;
    expect(analizarCsv(texto, columnas).filas).toHaveLength(500);
    expect(analizarCsv(`${texto}\nEva,9999`, columnas)).toMatchObject({ total: 501, filas: [] });
  });

  it("rechaza archivos vacíos, comillas sin cierre y exceso de bytes UTF-8", () => {
    for (const texto of ["", 'nombre,telefono\n"Ana,8888', `nombre,telefono\n${"á".repeat(500_001)}`]) {
      const resultado = analizarCsv(texto, columnas);
      expect(resultado.filas).toEqual([]);
      expect(resultado.errores.length).toBeGreaterThan(0);
    }
  });

  it("conserva las plantillas compatibles con los encabezados del importador", () => {
    for (const tipo of ["clientes", "materiales"] as const) {
      const plantilla = readFileSync(`public/plantillas/${tipo}.csv`, "utf8");
      expect(analizarCsv(plantilla, COLUMNAS[tipo])).toEqual({ filas: [], errores: [], total: 0 });
    }
  });

  it("exige un booleano explícito para confirmar la importación", () => {
    expect(esquemaImportacion.safeParse({ texto: "", confirmar: false }).success).toBe(true);
    expect(esquemaImportacion.safeParse({ texto: "", confirmar: true }).success).toBe(true);
    for (const cuerpo of [{ texto: "" }, { texto: "", confirmar: "false" }, { texto: "", confirmar: 1 }]) {
      expect(esquemaImportacion.safeParse(cuerpo).success).toBe(false);
    }
  });
});
