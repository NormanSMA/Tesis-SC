import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  configurarLimites,
  exigirCupoLogin,
  limitarPorIp,
  limitarPorUsuario,
  registrarFalloLogin,
  reiniciarLimites,
} from "@/lib/limite-tasa";

const politica = { puntos: 2, duracion: 1 };
const error429 = {
  status: 429,
  codigo: "DEMASIADAS_SOLICITUDES",
  mensaje: "Demasiadas solicitudes. Intente de nuevo en 1 segundos.",
  reintentarEnSegundos: expect.any(Number),
};

describe("límite de tasa en memoria", () => {
  beforeEach(() => {
    configurarLimites({ lectura: politica, escritura: politica, publica: politica, loginFallo: politica });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    reiniciarLimites();
  });

  it.each(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"])("rechaza el tercer consumo de %s", async (metodo) => {
    await limitarPorUsuario("usuario", metodo);
    await limitarPorUsuario("usuario", metodo);
    await expect(limitarPorUsuario("usuario", metodo)).rejects.toMatchObject(error429);
    await expect(limitarPorUsuario("usuario", metodo)).rejects.toHaveProperty("reintentarEnSegundos", 1);
  });

  it("rechaza el tercer consumo público", async () => {
    await limitarPorIp("local");
    await limitarPorIp("local");
    await expect(limitarPorIp("local")).rejects.toMatchObject(error429);
  });

  it("separa usuarios, IP y políticas", async () => {
    await limitarPorUsuario("uno", "GET");
    await limitarPorUsuario("uno", "HEAD");
    await expect(limitarPorUsuario("uno", "POST")).resolves.toBeUndefined();
    await expect(limitarPorUsuario("dos", "GET")).resolves.toBeUndefined();
    await limitarPorIp("uno");
    await limitarPorIp("uno");
    await expect(limitarPorIp("dos")).resolves.toBeUndefined();
  });

  it("comprueba el login sin consumir puntos", async () => {
    for (let intento = 0; intento < 3; intento++) await exigirCupoLogin("local");
    await registrarFalloLogin("local");
    await exigirCupoLogin("local");
    await registrarFalloLogin("local");
    await expect(exigirCupoLogin("local")).rejects.toMatchObject(error429);
    await expect(registrarFalloLogin("local")).rejects.toMatchObject(error429);
  });

  it("bloquea durante una duración completa desde el último fallo", async () => {
    vi.useFakeTimers();
    await registrarFalloLogin("local");
    await vi.advanceTimersByTimeAsync(700);
    await registrarFalloLogin("local");
    await vi.advanceTimersByTimeAsync(400);
    await expect(exigirCupoLogin("local")).rejects.toMatchObject(error429);
    await vi.advanceTimersByTimeAsync(601);
    await expect(exigirCupoLogin("local")).resolves.toBeUndefined();
  });

  it("reiniciarLimites restablece los cupos y los límites predeterminados", async () => {
    await limitarPorUsuario("usuario", "GET");
    await limitarPorUsuario("usuario", "GET");
    await limitarPorIp("local");
    await limitarPorIp("local");
    await registrarFalloLogin("local");
    await registrarFalloLogin("local");
    reiniciarLimites();
    for (let lectura = 0; lectura < 10; lectura++) await limitarPorUsuario("usuario", "GET");
    await expect(limitarPorIp("local")).resolves.toBeUndefined();
    await expect(exigirCupoLogin("local")).resolves.toBeUndefined();
  });

  it.each([
    ["LIMITE_LECTURA", () => limitarPorUsuario("usuario", "GET")],
    ["LIMITE_ESCRITURA", () => limitarPorUsuario("usuario", "POST")],
    ["LIMITE_PUBLICA", () => limitarPorIp("local")],
    ["LIMITE_LOGIN_FALLOS", () => registrarFalloLogin("local")],
  ] as const)("aplica %s desde el entorno", async (variable, consumir) => {
    vi.stubEnv(variable, "2");
    reiniciarLimites();
    await consumir();
    await consumir();
    await expect(consumir()).rejects.toMatchObject({ status: 429, reintentarEnSegundos: expect.any(Number) });
  });
});
