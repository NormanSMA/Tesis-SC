import { describe, expect, it } from "vitest";

import { MONEDAS, aCordobas, convertirDesdeCordobas, esMoneda } from "@/core/moneda";

describe("monedas admitidas", () => {
  it("enumera NIO y USD", () => {
    expect(MONEDAS).toEqual(["NIO", "USD"]);
  });

  it.each(["NIO", "USD"])("reconoce %s", (valor) => {
    expect(esMoneda(valor)).toBe(true);
  });

  it.each(["EUR", "nio", "usd", "", " NIO", null, undefined, 1, {}])("rechaza %j", (valor) => {
    expect(esMoneda(valor)).toBe(false);
  });
});

describe("convertirDesdeCordobas", () => {
  it("divide con el tipo de cambio expresado en córdobas por dólar", () => {
    expect(convertirDesdeCordobas("100", "36.6243", 2)).toBe("2.73");
    expect(convertirDesdeCordobas("100", "36.6243", 4)).toBe("2.7304");
    expect(convertirDesdeCordobas("366.243", "36.6243", 2)).toBe("10.00");
  });

  it.each([
    ["36.8074215", 2, "1.01"], ["-36.8074215", 2, "-1.01"],
    ["36.626131215", 4, "1.0001"], ["-36.626131215", 4, "-1.0001"],
    ["36.8073848757", 2, "1.00"], ["36.8074581243", 2, "1.01"],
    ["36.6260945907", 4, "1.0000"], ["36.6261678393", 4, "1.0001"],
  ] as const)("redondea %s a %i decimales", (monto, decimales, esperado) => {
    expect(convertirDesdeCordobas(monto, "36.6243", decimales)).toBe(esperado);
  });

  it.each(["0", "12", "12.3400", "-12.34567", "9007199254740993.1234"])(
    "conserva exactamente %s con tipo de cambio 1", (monto) => {
      expect(convertirDesdeCordobas(monto, "1", 2)).toBe(monto);
      expect(convertirDesdeCordobas(monto, "1", 4)).toBe(monto);
    },
  );
});

describe("aCordobas", () => {
  it.each([
    ["1", "36.6243", "36.62"], ["10", "36.6243", "366.24"],
    ["50", "36.6243", "1831.22"], ["-50", "36.6243", "-1831.22"],
    ["0", "36.6243", "0.00"], ["1.005", "1", "1.01"],
    ["9007199254740993.005", "1", "9007199254740993.01"],
  ])("convierte %s con cambio %s", (monto, tipoCambio, esperado) => {
    expect(aCordobas(monto, tipoCambio)).toBe(esperado);
  });
});

describe("entradas de conversión", () => {
  it.each([
    ["texto", "36.6243"], ["1", "texto"], ["1", "0"], ["1", "-36.6243"],
  ])("rechaza monto %s o cambio %s inválidos", (monto, tipoCambio) => {
    expect(() => convertirDesdeCordobas(monto, tipoCambio, 2)).toThrow();
    expect(() => aCordobas(monto, tipoCambio)).toThrow();
  });
});
