import { describe, expect, it } from "vitest";

import type { TipoValorConfig } from "@/generated/prisma/client";
import {
  esquemaEditarConfiguracion, validarValorConfiguracion, validarVersionConfiguracion,
} from "@/modules/admin/configuracion-schema";
import { esquemaValorConfiguracion } from "@/modules/admin/componentes/interfaz";

const version = "2026-10-10T12:00:00.000Z";

describe("schema de configuración", () => {
  it("exige clave, valor como cadena y versión ISO", () => {
    expect(esquemaEditarConfiguracion.safeParse({ clave: "iva_porcentaje", valor: "15.00", version }).success)
      .toBe(true);
  });

  it.each([
    { clave: "", valor: "15", version }, { clave: "iva_porcentaje", valor: 15, version },
    { clave: "iva_porcentaje", valor: "15" }, { clave: "iva_porcentaje", valor: "15", version: "ayer" },
    { clave: "iva_porcentaje", valor: "15", version, tipo: "TEXTO" },
  ])("rechaza una entrada inválida: %j", (entrada) => {
    expect(esquemaEditarConfiguracion.safeParse(entrada).success).toBe(false);
  });
});

describe("valores y versión de configuración", () => {
  it.each(["0", "15.00", "100", "99.99"])("acepta IVA %s", (valor) => {
    expect(validarValorConfiguracion({ clave: "iva_porcentaje", tipo: "DECIMAL", valor })).toBe(valor);
  });

  it.each(["1", "15", "365"])("acepta vigencia %s", (valor) => {
    expect(validarValorConfiguracion({ clave: "cotizacion_vigencia_dias", tipo: "ENTERO", valor })).toBe(valor);
  });

  it.each(["1", "36.6243", "1000", "1000.0000"])("acepta tipo de cambio %s", (valor) => {
    expect(validarValorConfiguracion({ clave: "tipo_cambio_usd", tipo: "DECIMAL", valor })).toBe(valor);
  });

  it.each(["NIO", "USD"])("acepta moneda %s", (valor) => {
    expect(validarValorConfiguracion({ clave: "moneda", tipo: "TEXTO", valor })).toBe(valor);
  });

  const invalidos: { clave: string; tipo: TipoValorConfig; valor: string }[] = [
    ...["-0.01", "100.01", "100.000000000000000001", "99.999999999999999999999999",
      "15.001", "15.000", "101", "NaN", "Infinity", "1e2", "15,5", ""].map(
      (valor) => ({ clave: "iva_porcentaje", tipo: "DECIMAL" as const, valor }),
    ),
    ...["0", "366", "1.5", "1e2", "", "999999999999999999999999"].map(
      (valor) => ({ clave: "cotizacion_vigencia_dias", tipo: "ENTERO" as const, valor }),
    ),
    ...["0", "0.9999", "1000.0001", "36.62430", "texto", "-36.6243", "0000036", "1e2", "36,6243", ""].map(
      (valor) => ({ clave: "tipo_cambio_usd", tipo: "DECIMAL" as const, valor }),
    ),
    ...["nio", "NI", "NIOS", "N1O", " NIO", "EUR"].map(
      (valor) => ({ clave: "moneda", tipo: "TEXTO" as const, valor }),
    ),
    ...["", "   ", "a".repeat(121)].map((valor) => ({ clave: "empresa_nombre", tipo: "TEXTO" as const, valor })),
    { clave: "otro", tipo: "ENTERO", valor: "2.5" },
    { clave: "otro", tipo: "DECIMAL", valor: "texto" },
    { clave: "iva_porcentaje", tipo: "TEXTO", valor: "texto" },
  ];

  it.each(invalidos)("rechaza $clave=$valor", (datos) => {
    expect(() => validarValorConfiguracion(datos)).toThrow(expect.objectContaining({ status: 422 }));
  });

  it("acepta moneda y recorta el nombre de empresa", () => {
    expect(validarValorConfiguracion({ clave: "moneda", tipo: "TEXTO", valor: "NIO" })).toBe("NIO");
    expect(validarValorConfiguracion({ clave: "empresa_nombre", tipo: "TEXTO", valor: " Empresa " })).toBe("Empresa");
    expect(validarValorConfiguracion({ clave: "empresa_nombre", tipo: "TEXTO", valor: "a".repeat(120) }))
      .toHaveLength(120);
  });

  it("valida tipos para otros parámetros", () => {
    expect(validarValorConfiguracion({ clave: "condiciones", tipo: "TEXTO", valor: "Texto libre" })).toBe("Texto libre");
    expect(validarValorConfiguracion({ clave: "otro", tipo: "DECIMAL", valor: "-2.50" })).toBe("-2.50");
    expect(validarValorConfiguracion({ clave: "otro", tipo: "ENTERO", valor: "-2" })).toBe("-2");
  });

  it("impide editar la zona horaria", () => {
    expect(() => validarValorConfiguracion({ clave: "zona_horaria", tipo: "TEXTO", valor: "America/Managua" }))
      .toThrow(expect.objectContaining({ codigo: "CONFIGURACION_NO_EDITABLE", status: 422 }));
  });

  it("acepta la versión actual y rechaza versiones anteriores", () => {
    expect(() => validarVersionConfiguracion(new Date(version), version)).not.toThrow();
    expect(() => validarVersionConfiguracion(new Date(version), "2026-10-10T11:59:59.999Z"))
      .toThrow(expect.objectContaining({ codigo: "CONFLICTO_EDICION", status: 409 }));
    expect(() => validarVersionConfiguracion(new Date(version), "2026-10-10T06:00:00.000-06:00")).not.toThrow();
  });
});

describe("validación compartida de configuración", () => {
  it.each([
    ["1", true], ["36.6243", true], ["1000", true], ["1000.0000", true],
    ["0", false], ["1000.0001", false], ["36.62430", false], ["texto", false],
  ])("valida tipo de cambio %s igual en interfaz y servidor", (valor, valido) => {
    const datos = { clave: "tipo_cambio_usd", tipo: "DECIMAL" as const, valor };
    expect(esquemaValorConfiguracion(datos).safeParse(valor).success).toBe(valido);
    if (valido) expect(validarValorConfiguracion(datos)).toBe(valor);
    else expect(() => validarValorConfiguracion(datos)).toThrow(expect.objectContaining({ status: 422 }));
  });

  it.each([
    ["0", true], ["100", true], ["100.00", true], ["100.01", false],
    ["100.000000000000000001", false], ["-0.01", false], ["15.5", true],
    ["15,5", false], ["1e2", false], ["15.55", true], ["15.555", false], ["15.000", false],
  ])("valida IVA %s igual en interfaz y servidor", (valor, valido) => {
    const datos = { clave: "iva_porcentaje", tipo: "DECIMAL" as const, valor };
    expect(esquemaValorConfiguracion(datos).safeParse(valor).success).toBe(valido);
    if (valido) expect(validarValorConfiguracion(datos)).toBe(valor);
    else expect(() => validarValorConfiguracion(datos)).toThrow(expect.objectContaining({ status: 422 }));
  });

  it.each([
    ["1", true], ["15", true], ["365", true], ["0", false], ["366", false],
    ["-1", false], ["1.5", false], ["1.0", false], ["15,5", false], ["1e2", false],
    ["999999999999999999999999", false], ["", false],
  ])("valida vigencia %s igual en interfaz y servidor", (valor, valido) => {
    const datos = { clave: "cotizacion_vigencia_dias", tipo: "ENTERO" as const, valor };
    expect(esquemaValorConfiguracion(datos).safeParse(valor).success).toBe(valido);
    if (valido) expect(validarValorConfiguracion(datos)).toBe(valor);
    else expect(() => validarValorConfiguracion(datos)).toThrow(expect.objectContaining({ status: 422 }));
  });
});
