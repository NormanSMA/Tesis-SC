import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResumenCliente } from "@/modules/clientes/componentes/ResumenCliente";
import { TotalesCotizacion } from "@/modules/cotizaciones/componentes/TotalesCotizacion";
import { monedaDe, nombreMoneda, simboloMoneda } from "@/modules/cotizaciones/moneda";

describe("nombreMoneda", () => {
  it("muestra córdobas para NIO", () => {
    expect(nombreMoneda("NIO")).toBe("Córdobas (NIO)");
  });

  it("muestra dólares para USD", () => {
    expect(nombreMoneda("USD")).toBe("Dólares (USD)");
  });

  it("conserva otros códigos", () => {
    expect(nombreMoneda("EUR")).toBe("EUR");
  });
});

describe("monedaDe y simboloMoneda", () => {
  it("reconoce USD y cae a NIO con otros códigos", () => {
    expect(monedaDe("USD")).toBe("USD");
    expect(monedaDe("EUR")).toBe("NIO");
    expect(monedaDe(undefined)).toBe("NIO");
  });

  it("rotula cada moneda", () => {
    expect(simboloMoneda("NIO")).toBe("C$");
    expect(simboloMoneda("USD")).toBe("US$");
  });
});

describe("importes con la moneda de la cotización", () => {
  const totales = { subtotal: "100.00", descuento: "0.00", tasaImpuesto: "15", impuesto: "15.00", total: "115.00", margenPct: null };

  it("muestra US$ en los totales de una cotización en dólares", () => {
    const html = renderToStaticMarkup(createElement(TotalesCotizacion, { totales, moneda: "USD" }));
    expect(html).toContain("US$");
    expect(html).not.toContain("C$");
  });

  it("muestra C$ cuando no se indica moneda", () => {
    expect(renderToStaticMarkup(createElement(TotalesCotizacion, { totales }))).toContain("C$");
  });

  it("muestra el descuento como monto y agrega el porcentaje solo cuando existe", () => {
    const con = renderToStaticMarkup(createElement(TotalesCotizacion, {
      totales: { ...totales, descuento: "10.00", descuentoPct: "10.00" }, moneda: "USD" }));
    expect(con).toContain("Descuento (10 %)");
    expect(con).toMatch(/US\$\s*10\.00/);
    const decimal = renderToStaticMarkup(createElement(TotalesCotizacion, { totales: { ...totales, descuentoPct: "12.50" } }));
    expect(decimal).toContain("Descuento (12.5 %)");
    for (const descuentoPct of [null, undefined]) {
      const sin = renderToStaticMarkup(createElement(TotalesCotizacion, { totales: { ...totales, descuentoPct } }));
      expect(sin).toContain("<dt>Descuento</dt>");
    }
  });

  it("rotula el total aprobado del cliente como C$ equivalente", () => {
    const html = renderToStaticMarkup(createElement(ResumenCliente, { resumen: { cotizaciones: 1, porEstado: {}, totalAprobado: "100.00" } }));
    expect(html).toContain("C$ equivalente");
  });
});
