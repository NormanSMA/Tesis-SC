import { describe, expect, it } from "vitest";

import {
  COLUMNAS_POR_DEFECTO,
  columnasPermitidas,
  leerColumnas,
  serializarColumnas,
} from "@/modules/clientes/columnas";

describe("columnas de la lista de clientes", () => {
  it("sin cookie usa las columnas por defecto", () => {
    expect(leerColumnas(undefined)).toEqual([...COLUMNAS_POR_DEFECTO]);
  });

  it("lee una selección propia, ignora nombres desconocidos y conserva el orden fijo", () => {
    expect(leerColumnas("correo,ruc,inventada,tipo")).toEqual(["ruc", "tipo", "correo"]);
  });

  it("una cookie vacía significa que solo se ve el nombre", () => {
    expect(leerColumnas("")).toEqual([]);
  });

  it("serializa en el orden fijo y sin duplicados", () => {
    expect(serializarColumnas(["correo", "ruc", "ruc"])).toBe("ruc,correo");
  });

  it("sin permiso de cotizaciones esa columna no se muestra", () => {
    expect(columnasPermitidas(["tipo", "cotizaciones"], false)).toEqual(["tipo"]);
    expect(columnasPermitidas(["tipo", "cotizaciones"], true)).toEqual(["tipo", "cotizaciones"]);
  });
});
