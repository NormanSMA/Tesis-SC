import { beforeEach, describe, expect, it } from "vitest";

import {
  BufferCircular, listarErrores, normalizarRuta, percentil, redactarMensaje, registrarErrorMedido, registrarPeticion,
  reiniciarMetricas, resumirMetricas,
} from "@/lib/metricas";
import { evaluarEstado } from "@/modules/sistema/reglas";

beforeEach(() => reiniciarMetricas());

const UUID = "3f2b8c1e-9d4a-4e6b-8a7c-1b2d3e4f5a6b";

describe("percentil", () => {
  it("usa rango más cercano", () => {
    const valores = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentil(valores, 50)).toBe(50);
    expect(percentil(valores, 95)).toBe(95);
    expect(percentil([7], 95)).toBe(7);
    expect(percentil([], 50)).toBeNull();
  });
});

describe("búfer circular", () => {
  it("descarta lo más antiguo al llenarse", () => {
    const b = new BufferCircular<number>(3);
    [1, 2, 3, 4, 5].forEach((n) => b.agregar(n));
    expect(b.listar()).toEqual([3, 4, 5]);
  });

  it("guarda solo las últimas 500 peticiones y 100 errores", () => {
    for (let i = 0; i < 520; i++) registrarPeticion({ ruta: "/api/v1/x", metodo: "GET", estado: 200, duracionMs: 1 });
    for (let i = 0; i < 130; i++) registrarErrorMedido({ codigo: "E", mensaje: `fallo ${i}`, ruta: "/api/v1/x", peticionId: String(i) });
    expect(resumirMetricas().peticiones).toBe(500);
    const errores = listarErrores();
    expect(errores).toHaveLength(100);
    expect(errores[0].peticionId).toBe("129");
  });
});

describe("resumen", () => {
  it("calcula percentiles, tasas, por minuto y rutas lentas", () => {
    for (let i = 1; i <= 18; i++) registrarPeticion({ ruta: `/api/v1/ordenes/${UUID}`, metodo: "GET", estado: 200, duracionMs: i * 10 });
    registrarPeticion({ ruta: "/api/v1/boom", metodo: "POST", estado: 500, duracionMs: 900 });
    registrarPeticion({ ruta: "/api/v1/nada", metodo: "GET", estado: 404, duracionMs: 5 });
    const r = resumirMetricas();
    expect(r.peticiones).toBe(20);
    expect(r.p95Ms).toBe(180);
    expect(r.tasa5xx).toBe(0.05);
    expect(r.tasa4xx).toBe(0.05);
    expect(r.peticionesPorMinuto).toBe(20);
    expect(resumirMetricas(Date.now() + 120_000).peticionesPorMinuto).toBe(0);
    expect(r.rutasLentas[0]).toMatchObject({ metodo: "POST", ruta: "/api/v1/boom", p95Ms: 900 });
    expect(r.rutasLentas.map((x) => x.ruta)).toContain("/api/v1/ordenes/:id");
    expect(r.rutasLentas.length).toBeLessThanOrEqual(5);
  });
});

describe("redacción", () => {
  it("normaliza ids y descarta la consulta", () => {
    expect(normalizarRuta(`/api/v1/ordenes/${UUID}/etapas/42?token=abc`)).toBe("/api/v1/ordenes/:id/etapas/:id");
  });

  it("oculta correos, ids, tokens y números largos del mensaje", () => {
    const mensaje = redactarMensaje(
      `falló ana@correo.com ${UUID} Bearer abc123 clave=secreta cuenta 1234567890 ${"a".repeat(40)}`,
    );
    expect(mensaje).not.toMatch(/ana@|3f2b8c1e|abc123|secreta|1234567890|aaaaaaaa/);
    expect(mensaje.length).toBeLessThanOrEqual(200);
  });

  it("ignora campos desconocidos como cuerpos o cookies", () => {
    registrarErrorMedido({ codigo: "X", mensaje: "m", ruta: "/r", peticionId: "p", cookie: "sid=1", body: { clave: "z" } });
    expect(JSON.stringify(listarErrores())).not.toMatch(/sid=1|"z"/);
  });
});

describe("estado general", () => {
  it("cae si la base no responde y alerta sobre los umbrales", () => {
    expect(evaluarEstado(false, { p95Ms: 10, tasa5xx: 0 }).estado).toBe("CAIDO");
    expect(evaluarEstado(true, { p95Ms: 800, tasa5xx: 0.02 }).estado).toBe("OPERATIVO");
    expect(evaluarEstado(true, { p95Ms: 801, tasa5xx: 0 }).estado).toBe("CON_ALERTAS");
    expect(evaluarEstado(true, { p95Ms: null, tasa5xx: 0.021 }).estado).toBe("CON_ALERTAS");
  });
});
