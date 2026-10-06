import { describe, expect, it } from "vitest";

import {
  costearItemCatalogo,
  costearItemPersonalizado,
  costearLinea,
  totalizarCotizacion,
  validarCotizacion,
  validarItemCatalogo,
  validarItemPersonalizado,
  validarLinea,
  type EntradaItemCatalogo,
  type EntradaItemPersonalizado,
  type EntradaLinea,
  type ItemTotalizable,
} from "@/core/costeo";
import { comparar, leerDecimal, restar, sumar, type Racional } from "@/core/decimal";
import { AppError } from "@/lib/errores";

import * as siembra from "../../prisma/seed/calculos";

const SEMILLA = 20261006;
const MUESTRAS = 500;

// mulberry32: generador reproducible sin dependencias.
function crearAzar(semilla: number): () => number {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Azar = () => number;

function entero(azar: Azar, maximo: number): number {
  return Math.floor(azar() * (maximo + 1));
}

// Decimal entre minimo y maximo (en unidades de la última cifra) con la escala dada.
function decimal(azar: Azar, opciones: { maximo: number; decimales: number; minimo?: number }): string {
  const { maximo, decimales, minimo = 0 } = opciones;
  const escala = 10 ** decimales;
  const unidades = minimo * escala + entero(azar, (maximo - minimo) * escala);
  const texto = String(unidades).padStart(decimales + 1, "0");
  return decimales === 0 ? texto : `${texto.slice(0, -decimales)}.${texto.slice(-decimales)}`;
}

function lineaAleatoria(azar: Azar): EntradaLinea {
  const tipo = entero(azar, 2);
  if (tipo === 0) {
    return {
      tipo: "MATERIAL",
      cantidad: decimal(azar, { minimo: 0.001, maximo: 500, decimales: 3 }),
      costoUnitario: decimal(azar, { maximo: 5000, decimales: 4 }),
      mermaPct: decimal(azar, { maximo: azar() < 0.3 ? 0 : 100, decimales: 2 }),
    };
  }
  if (tipo === 1) {
    return {
      tipo: "MANO_OBRA",
      horas: decimal(azar, { minimo: 0.25, maximo: 200, decimales: 2 }),
      tarifa: decimal(azar, { maximo: 800, decimales: 2 }),
    };
  }
  return { tipo: "TERCERO", costo: decimal(azar, { maximo: 90000, decimales: 4 }) };
}

function personalizadoAleatorio(azar: Azar): EntradaItemPersonalizado {
  return {
    cantidad: decimal(azar, { minimo: 0.001, maximo: 1000, decimales: 3 }),
    margenPct: decimal(azar, { maximo: azar() < 0.1 ? 0 : 99.99, decimales: 2 }),
    lineas: Array.from({ length: 1 + entero(azar, 4) }, () => lineaAleatoria(azar)),
  };
}

function catalogoAleatorio(azar: Azar): EntradaItemCatalogo {
  const porM2 = azar() < 0.5;
  return {
    unidadCobro: porM2 ? "M2" : "UNIDAD",
    precioBase: decimal(azar, { maximo: 20000, decimales: 2 }),
    cantidad: decimal(azar, { minimo: 0.001, maximo: 1000, decimales: 3 }),
    ancho: porM2 ? decimal(azar, { minimo: 0.001, maximo: 30, decimales: 3 }) : null,
    alto: porM2 ? decimal(azar, { minimo: 0.001, maximo: 30, decimales: 3 }) : null,
  };
}

function itemsAleatorios(azar: Azar): ItemTotalizable[] {
  return Array.from({ length: 1 + entero(azar, 4) }, () =>
    azar() < 0.5 ? costearItemPersonalizado(personalizadoAleatorio(azar)) : costearItemCatalogo(catalogoAleatorio(azar)),
  );
}

// Descuento entre 0 y el subtotal, a veces en los extremos.
function descuentoAleatorio(azar: Azar, items: ItemTotalizable[]): string {
  const subtotal = items.reduce((suma, item) => suma + BigInt(item.importe.replace(".", "")), BigInt(0));
  const sorteo = azar();
  let centavos = (subtotal * BigInt(entero(azar, 1_000_000))) / BigInt(1_000_000);
  if (sorteo < 0.2) centavos = BigInt(0);
  else if (sorteo < 0.3) centavos = subtotal;
  const texto = centavos.toString().padStart(3, "0");
  return `${texto.slice(0, -2)}.${texto.slice(-2)}`;
}

function camposDelError(accion: () => unknown): Record<string, string> {
  try {
    accion();
  } catch (e) {
    if (e instanceof AppError && e.status === 422 && e.codigo === "VALIDACION") return e.campos ?? {};
    throw e;
  }
  throw new Error("Se esperaba un error de validación");
}

function exacto(texto: string): Racional {
  const valor = leerDecimal(texto);
  if (!valor) throw new Error(`No es decimal: ${texto}`);
  return valor;
}

const material = (cantidad: string, costoUnitario: string, mermaPct = "0"): EntradaLinea => ({
  tipo: "MATERIAL",
  cantidad,
  costoUnitario,
  mermaPct,
});

describe("costearLinea", () => {
  it("material con merma: cantidad × costo × (1 + merma / 100)", () => {
    expect(costearLinea(material("5", "2850", "8"))).toEqual({
      tipo: "MATERIAL",
      cantidad: "5.000",
      costoUnitario: "2850.0000",
      mermaPct: "8.00",
      importe: "15390.00",
    });
    expect(costearLinea(material("3", "22", "5")).importe).toBe("69.30");
  });

  it("material sin merma y costo unitario con cuatro decimales", () => {
    expect(costearLinea(material("7", "0.3333")).importe).toBe("2.33");
    expect(costearLinea(material("3", "33.3333")).importe).toBe("100.00");
  });

  it("merma de 100 % duplica el costo", () => {
    expect(costearLinea(material("2", "10", "100")).importe).toBe("40.00");
  });

  it("mano de obra: horas por tarifa, sin merma", () => {
    expect(costearLinea({ tipo: "MANO_OBRA", horas: "4", tarifa: "150" })).toEqual({
      tipo: "MANO_OBRA",
      cantidad: "4.000",
      costoUnitario: "150.0000",
      mermaPct: "0.00",
      importe: "600.00",
    });
  });

  it("tercero: un servicio con cantidad 1", () => {
    expect(costearLinea({ tipo: "TERCERO", costo: "3500" })).toEqual({
      tipo: "TERCERO",
      cantidad: "1.000",
      costoUnitario: "3500.0000",
      mermaPct: "0.00",
      importe: "3500.00",
    });
  });

  it("redondea la mitad alejándose de cero, como round de PostgreSQL", () => {
    expect(costearLinea(material("1", "0.0050")).importe).toBe("0.01");
    expect(costearLinea(material("1", "0.0049")).importe).toBe("0.00");
    expect(costearLinea(material("1", "0.0125", "20")).importe).toBe("0.02");
  });

  it("rechaza entradas inválidas con mensajes por campo", () => {
    expect(validarLinea(material("0", "10"))).toEqual({ cantidad: "Debe ser mayor que 0." });
    expect(validarLinea(material("1", "-1"))).toEqual({ costoUnitario: "No puede ser negativo." });
    expect(validarLinea(material("1", "10", "100.01"))).toEqual({ mermaPct: "Debe estar entre 0 y 100." });
    expect(validarLinea(material("1", "10", "-1"))).toEqual({ mermaPct: "Debe estar entre 0 y 100." });
    expect(validarLinea(material("1.2345", "10"))).toEqual({ cantidad: "Admite hasta 3 decimales." });
    expect(validarLinea(material("1", "1,5"))).toEqual({
      costoUnitario: "Debe ser un número decimal con punto, por ejemplo 12.50.",
    });
    expect(validarLinea({ tipo: "MANO_OBRA", horas: "", tarifa: "1" })).toEqual({ horas: "Es obligatorio." });
    expect(validarLinea({ tipo: "OTRO" } as unknown as EntradaLinea)).toHaveProperty("tipo");
    expect(() => costearLinea(material("0", "10"))).toThrow(AppError);
  });

  it("acepta ceros a la derecha más allá de la escala", () => {
    expect(validarLinea(material("1.50000", "2.000000"))).toEqual({});
    expect(costearLinea(material("1.50000", "2.000000")).cantidad).toBe("1.500");
  });
});

describe("costearItemPersonalizado", () => {
  const lineasSiembra: EntradaLinea[] = [
    material("5", "2850", "8"),
    { tipo: "MANO_OBRA", horas: "4", tarifa: "150" },
    { tipo: "TERCERO", costo: "1990.80" },
  ];

  it("suma las líneas y aplica el margen sobre el precio (valores fijados de la siembra)", () => {
    const item = costearItemPersonalizado({ cantidad: "1", margenPct: "35", lineas: lineasSiembra });
    expect(item).toMatchObject({
      tipo: "PERSONALIZADO",
      cantidad: "1.000",
      costoTotal: "17980.80",
      margenPct: "35.00",
      importe: "27662.77",
      precioUnitario: "27662.77",
    });
    expect(item.lineas.map((linea) => linea.importe)).toEqual(["15390.00", "600.00", "1990.80"]);
  });

  it("sin merma y con margen 40 %", () => {
    const item = costearItemPersonalizado({ cantidad: "1", margenPct: "40", lineas: [material("1", "28189")] });
    expect(item.importe).toBe("46981.67");
  });

  it("margen 0: el precio es el costo", () => {
    const item = costearItemPersonalizado({ cantidad: "2", margenPct: "0", lineas: [material("1", "1000")] });
    expect(item).toMatchObject({ costoTotal: "1000.00", importe: "1000.00", precioUnitario: "500.00" });
  });

  it("margen 99.99: el precio es diez mil veces el costo", () => {
    const item = costearItemPersonalizado({ cantidad: "1", margenPct: "99.99", lineas: [material("1", "1.23")] });
    expect(item.importe).toBe("12300.00");
  });

  it("deriva el precio unitario del importe y la cantidad", () => {
    const item = costearItemPersonalizado({ cantidad: "3", margenPct: "0", lineas: [material("1", "100")] });
    expect(item.precioUnitario).toBe("33.33");
  });

  it("rechaza margen de 100 o negativo, cantidad no positiva y la falta de líneas", () => {
    const base = { cantidad: "1", margenPct: "10", lineas: [material("1", "1")] };
    const margenFueraDeRango = "Debe ser mayor o igual que 0 y menor que 100.";
    expect(validarItemPersonalizado({ ...base, margenPct: "100" })).toEqual({ margenPct: margenFueraDeRango });
    expect(validarItemPersonalizado({ ...base, margenPct: "-0.01" })).toEqual({ margenPct: margenFueraDeRango });
    expect(validarItemPersonalizado({ ...base, cantidad: "0" })).toEqual({ cantidad: "Debe ser mayor que 0." });
    expect(validarItemPersonalizado({ ...base, lineas: [] })).toEqual({ lineas: "Agrega al menos una línea de costo." });
  });

  it("ubica los errores de cada línea con su índice", () => {
    const entrada = { cantidad: "1", margenPct: "10", lineas: [material("1", "1"), material("1", "1", "101")] };
    expect(camposDelError(() => costearItemPersonalizado(entrada))).toEqual({
      "lineas.1.mermaPct": "Debe estar entre 0 y 100.",
    });
  });

  it("rechaza un importe que no cabe en numeric(14,2)", () => {
    const entrada = { cantidad: "1", margenPct: "99.99", lineas: [{ tipo: "TERCERO" as const, costo: "100000000" }] };
    expect(validarItemPersonalizado(entrada)).toMatchObject({
      importe: "El resultado supera el máximo admitido (999999999999.99).",
    });
  });
});

describe("costearItemCatalogo", () => {
  it("por unidad: precio × cantidad", () => {
    expect(costearItemCatalogo({ unidadCobro: "UNIDAD", precioBase: "1320", cantidad: "3" })).toEqual({
      tipo: "CATALOGO",
      unidadCobro: "UNIDAD",
      cantidad: "3.000",
      ancho: null,
      alto: null,
      precioUnitario: "1320.00",
      costoTotal: null,
      margenPct: null,
      importe: "3960.00",
    });
  });

  it("por m2: precio × ancho × alto × cantidad, con un solo redondeo final", () => {
    const item = costearItemCatalogo({ unidadCobro: "M2", precioBase: "1650", cantidad: "10", ancho: "1.2", alto: "0.8" });
    expect(item).toMatchObject({ ancho: "1.200", alto: "0.800", importe: "15840.00" });
    const fraccion = { unidadCobro: "M2" as const, precioBase: "1025", cantidad: "1", ancho: "0.333", alto: "0.777" };
    expect(costearItemCatalogo(fraccion).importe).toBe("265.21");
  });

  it("redondea la mitad hacia arriba", () => {
    expect(costearItemCatalogo({ unidadCobro: "UNIDAD", precioBase: "0.05", cantidad: "0.1" }).importe).toBe("0.01");
  });

  it("conserva medidas informativas en el cobro por unidad", () => {
    const item = costearItemCatalogo({ unidadCobro: "UNIDAD", precioBase: "10", cantidad: "2", ancho: "3", alto: "4" });
    expect(item).toMatchObject({ ancho: "3.000", alto: "4.000", importe: "20.00" });
  });

  it("exige ancho y alto positivos cuando se cobra por m2", () => {
    const sinMedidas = { unidadCobro: "M2" as const, precioBase: "1650", cantidad: "1" };
    const obligatorio = "Es obligatorio cuando se cobra por m2.";
    expect(validarItemCatalogo(sinMedidas)).toEqual({ ancho: obligatorio, alto: obligatorio });
    expect(validarItemCatalogo({ ...sinMedidas, ancho: "0", alto: "1" })).toEqual({ ancho: "Debe ser mayor que 0." });
  });

  it("rechaza precio negativo, cantidad no positiva y unidad desconocida", () => {
    expect(validarItemCatalogo({ unidadCobro: "UNIDAD", precioBase: "-1", cantidad: "-2" })).toEqual({
      precioBase: "No puede ser negativo.",
      cantidad: "Debe ser mayor que 0.",
    });
    const desconocida = { unidadCobro: "LITRO", precioBase: "1", cantidad: "1" } as unknown as EntradaItemCatalogo;
    expect(validarItemCatalogo(desconocida)).toEqual({ unidadCobro: "Usa UNIDAD o M2." });
  });

  it("grandes cantidades sin pérdida de precisión", () => {
    const grande = { unidadCobro: "UNIDAD" as const, precioBase: "9.99", cantidad: "99999999999.999" };
    expect(costearItemCatalogo(grande).importe).toBe("998999999999.99");
    expect(validarItemCatalogo({ ...grande, precioBase: "10.01" })).toHaveProperty("importe");
    expect(validarItemCatalogo({ ...grande, cantidad: "100000000000" })).toEqual({
      cantidad: "No puede superar 99999999999.999.",
    });
  });
});

describe("totalizarCotizacion", () => {
  const catalogo = (importe: string): ItemTotalizable => ({ tipo: "CATALOGO", importe, costoTotal: null });
  const personalizado = (importe: string, costoTotal: string): ItemTotalizable => ({
    tipo: "PERSONALIZADO",
    importe,
    costoTotal,
  });

  it("IVA 15 % sobre el subtotal (valores fijados de la siembra)", () => {
    const totales = totalizarCotizacion({
      items: [personalizado("27662.77", "17980.80")],
      descuento: "0",
      tasaImpuesto: "15",
    });
    expect(totales).toEqual({
      subtotal: "27662.77",
      descuento: "0.00",
      tasaImpuesto: "15.00",
      impuesto: "4149.42",
      total: "31812.19",
      margenPct: "35.00",
    });
    const dos = totalizarCotizacion({ items: [catalogo("8250"), catalogo("46981.67")], descuento: "0", tasaImpuesto: "15" });
    expect(dos).toMatchObject({ subtotal: "55231.67", impuesto: "8284.75", total: "63516.42", margenPct: null });
  });

  it("rechaza un margen resultante de 100 o más (importe sin costo)", () => {
    const entrada = { items: [personalizado("1", "0")], descuento: "0", tasaImpuesto: "15" };
    expect(validarCotizacion(entrada).items).toMatch(/100\.00/);
    expect(() => totalizarCotizacion(entrada)).toThrow();
  });

  it("rechaza un margen resultante negativo (precio bajo el costo)", () => {
    const campos = validarCotizacion({ items: [personalizado("1", "2")], descuento: "0", tasaImpuesto: "15" });
    expect(campos.items).toMatch(/-100\.00/);
  });

  it("acepta margen resultante en los límites 0 y 99.99", () => {
    const sinMargen = totalizarCotizacion({ items: [personalizado("100", "100")], descuento: "0", tasaImpuesto: "0" });
    const casiTodo = totalizarCotizacion({ items: [personalizado("10000", "1")], descuento: "0", tasaImpuesto: "0" });
    expect(sinMargen.margenPct).toBe("0.00");
    expect(casiTodo.margenPct).toBe("99.99");
  });

  it("IVA 0", () => {
    const totales = totalizarCotizacion({ items: [catalogo("100")], descuento: "10", tasaImpuesto: "0" });
    expect(totales).toMatchObject({ impuesto: "0.00", total: "90.00" });
  });

  it("descuento global antes del IVA, de 0 hasta el subtotal", () => {
    const parcial = totalizarCotizacion({ items: [catalogo("1250")], descuento: "50", tasaImpuesto: "15" });
    expect(parcial).toMatchObject({ descuento: "50.00", impuesto: "180.00", total: "1380.00" });
    const completo = totalizarCotizacion({ items: [catalogo("1250")], descuento: "1250", tasaImpuesto: "15" });
    expect(completo).toMatchObject({ impuesto: "0.00", total: "0.00" });
  });

  it("redondea el IVA en la mitad", () => {
    // 0.10 × 15 % = 0.015, que redondea a 0.02.
    expect(totalizarCotizacion({ items: [catalogo("0.10")], descuento: "0", tasaImpuesto: "15" }).impuesto).toBe("0.02");
    expect(totalizarCotizacion({ items: [catalogo("333.33")], descuento: "0", tasaImpuesto: "15" }).impuesto).toBe("50.00");
  });

  it("rechaza descuento mayor que el subtotal y tasa fuera de 0 a 100", () => {
    expect(validarCotizacion({ items: [catalogo("100")], descuento: "100.01", tasaImpuesto: "15" })).toEqual({
      descuento: "No puede superar el subtotal (100.00).",
    });
    expect(validarCotizacion({ items: [catalogo("100")], descuento: "0", tasaImpuesto: "100.5" })).toEqual({
      tasaImpuesto: "Debe estar entre 0 y 100.",
    });
  });

  it("margen resultante de los ítems personalizados", () => {
    const items = [personalizado("125", "100"), personalizado("250", "200"), catalogo("999")];
    expect(totalizarCotizacion({ items, descuento: "0", tasaImpuesto: "15" }).margenPct).toBe("20.00");
    const sinImporte = [personalizado("0", "0")];
    expect(totalizarCotizacion({ items: sinImporte, descuento: "0", tasaImpuesto: "15" }).margenPct).toBeNull();
  });

  it("sin ítems todo es cero", () => {
    expect(totalizarCotizacion({ items: [], descuento: "0", tasaImpuesto: "15" })).toEqual({
      subtotal: "0.00",
      descuento: "0.00",
      tasaImpuesto: "15.00",
      impuesto: "0.00",
      total: "0.00",
      margenPct: null,
    });
  });

  it("exige el costo de los ítems personalizados", () => {
    const sinCosto = { tipo: "PERSONALIZADO", importe: "10", costoTotal: null } as ItemTotalizable;
    expect(validarCotizacion({ items: [sinCosto], descuento: "0", tasaImpuesto: "15" })).toEqual({
      "items.0.costoTotal": "Es obligatorio.",
    });
  });
});

describe("paridad con prisma/seed/calculos.ts", () => {
  it("coincide con la siembra en líneas, ítems y totales aleatorios", () => {
    const azar = crearAzar(SEMILLA);
    for (let i = 0; i < MUESTRAS; i++) {
      const entrada = personalizadoAleatorio(azar);
      const item = costearItemPersonalizado(entrada);
      for (const linea of item.lineas) expect(linea.importe).toBe(siembra.importeLinea(linea));
      const importe = siembra.importePersonalizado({ costoTotal: item.costoTotal, margenPct: entrada.margenPct });
      expect(item.importe).toBe(importe);
      expect(item.precioUnitario).toBe(siembra.precioUnitarioPersonalizado({ importe, cantidad: entrada.cantidad }));

      const catalogo = catalogoAleatorio(azar);
      const precioUnitario = catalogo.precioBase;
      expect(costearItemCatalogo(catalogo).importe).toBe(siembra.importeCatalogo({ ...catalogo, precioUnitario }));

      const items = [item, costearItemCatalogo(catalogo)];
      const descuento = descuentoAleatorio(azar, items);
      const totales = totalizarCotizacion({ items, descuento, tasaImpuesto: "15" });
      const importes = items.map((x) => x.importe);
      expect(totales).toMatchObject(siembra.totalesCotizacion({ importes, descuento, tasaPct: "15" }));
      expect(totales.margenPct).toBe(siembra.margenResultante([item]));
    }
  });
});

describe("propiedades por muestreo con semilla fija", () => {
  it("es determinista: la misma entrada da la misma salida", () => {
    const entradas = Array.from({ length: 50 }, () => personalizadoAleatorio(crearAzar(SEMILLA)));
    const salidas = entradas.map((entrada) => costearItemPersonalizado(entrada));
    expect(new Set(salidas.map((salida) => JSON.stringify(salida))).size).toBe(1);
    expect(itemsAleatorios(crearAzar(7))).toEqual(itemsAleatorios(crearAzar(7)));
  });

  it("cumple total = subtotal − descuento + impuesto y descuento ≤ subtotal", () => {
    const azar = crearAzar(SEMILLA + 1);
    for (let i = 0; i < MUESTRAS; i++) {
      const items = itemsAleatorios(azar);
      const subtotal = items.reduce((suma, item) => sumar(suma, exacto(item.importe)), exacto("0"));
      const descuento = descuentoAleatorio(azar, items);
      const totales = totalizarCotizacion({ items, descuento, tasaImpuesto: azar() < 0.2 ? "0" : "15" });
      expect(comparar(exacto(totales.subtotal), subtotal)).toBe(0);
      expect(comparar(exacto(totales.descuento), subtotal)).toBeLessThanOrEqual(0);
      const esperado = sumar(restar(exacto(totales.subtotal), exacto(totales.descuento)), exacto(totales.impuesto));
      expect(comparar(exacto(totales.total), esperado)).toBe(0);
    }
  });

  it("más margen nunca baja el precio y el precio nunca es menor que el costo", () => {
    const azar = crearAzar(SEMILLA + 2);
    for (let i = 0; i < MUESTRAS; i++) {
      const entrada = personalizadoAleatorio(azar);
      const otroMargen = decimal(azar, { maximo: 99.99, decimales: 2 });
      const [menor, mayor] = [entrada.margenPct, otroMargen].sort((a, b) => comparar(exacto(a), exacto(b)));
      const precioMenor = exacto(costearItemPersonalizado({ ...entrada, margenPct: menor }).importe);
      const item = costearItemPersonalizado({ ...entrada, margenPct: mayor });
      expect(comparar(exacto(item.importe), precioMenor)).toBeGreaterThanOrEqual(0);
      expect(comparar(exacto(item.importe), exacto(item.costoTotal))).toBeGreaterThanOrEqual(0);
    }
  });

  it("el margen resultante queda entre 0 y 100 y las salidas tienen la escala de su columna", () => {
    const azar = crearAzar(SEMILLA + 3);
    for (let i = 0; i < MUESTRAS; i++) {
      const totales = totalizarCotizacion({ items: itemsAleatorios(azar), descuento: "0", tasaImpuesto: "15" });
      for (const monto of [totales.subtotal, totales.impuesto, totales.total]) expect(monto).toMatch(/^\d+\.\d{2}$/);
      if (totales.margenPct === null) continue;
      expect(totales.margenPct).toMatch(/^\d{1,2}\.\d{2}$/);
    }
  });
});
