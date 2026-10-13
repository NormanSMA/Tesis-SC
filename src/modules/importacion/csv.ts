import Papa from "papaparse";

import { LIMITE_CSV_BYTES, LIMITE_FILAS, type AnalisisCsv, type ErrorFila } from "./tipos";

function localizarFilas(texto: string) {
  const origenes: number[] = [];
  let encabezados: string[] = [];
  let cursor = 0;
  let linea = 1;
  Papa.parse<string[]>(texto, {
    delimiter: ",",
    skipEmptyLines: false,
    step: ({ data, meta }) => {
      if (data.join("").trim()) {
        if (!origenes.length) encabezados = data;
        origenes.push(linea);
      }
      linea += (texto.slice(cursor, meta.cursor).match(/\r\n|\r|\n/g) ?? []).length;
      cursor = meta.cursor;
    },
  });
  return { encabezados, origenes };
}

export function analizarCsv(texto: string, columnas: readonly string[]): AnalisisCsv {
  const vacio = (mensaje: string, total = 0): AnalisisCsv => ({
    filas: [], errores: [{ fila: 1, mensaje }], total,
  });
  if (new TextEncoder().encode(texto).length > LIMITE_CSV_BYTES) {
    return vacio("El CSV supera 1 000 000 de bytes.");
  }
  const limpio = texto.replace(/^\uFEFF/, "");
  const { encabezados, origenes } = localizarFilas(limpio);
  const total = Math.max(0, origenes.length - 1);
  if (encabezados.join("\u0000") !== columnas.join("\u0000")) {
    return vacio(`Encabezados esperados: ${columnas.join(",")}.`, total);
  }
  if (total > LIMITE_FILAS) return vacio("El CSV admite como máximo 500 filas.", total);
  const lectura = Papa.parse<Record<string, string>>(limpio, {
    header: true, delimiter: ",", skipEmptyLines: "greedy",
  });
  const errores: ErrorFila[] = lectura.errors.map((error) => ({
    fila: origenes[(error.row ?? 0) + 1] ?? 1,
    mensaje: error.type === "FieldMismatch" ? "La cantidad de columnas no coincide con los encabezados."
      : "Formato CSV inválido: revise las comillas y los separadores.",
  }));
  const invalidas = new Set(errores.map(({ fila }) => fila));
  const filas = lectura.data.map((datos, indice) => ({ fila: origenes[indice + 1] ?? indice + 2, datos }))
    .filter(({ fila }) => !invalidas.has(fila));
  return { filas, errores, total };
}
