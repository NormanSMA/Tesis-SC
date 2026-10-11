import { beforeEach, describe, expect, it, vi } from "vitest";

import { abrirSesion, cambiarClave, iniciarSesion, respuestaSesion } from "@/modules/auth/service";

const dobles = vi.hoisted(() => ({
  consulta: vi.fn(), buscarUsuario: vi.fn(), actualizarUsuario: vi.fn(),
  buscarSesion: vi.fn(), crearSesion: vi.fn(), revocarSesiones: vi.fn(), purgarSesiones: vi.fn(),
  verificar: vi.fn(), hashear: vi.fn(), evento: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const tx = {
    $queryRaw: dobles.consulta,
    usuario: { findUnique: dobles.buscarUsuario, update: dobles.actualizarUsuario },
    sesion: { findUnique: dobles.buscarSesion, create: dobles.crearSesion,
      updateMany: dobles.revocarSesiones, deleteMany: dobles.purgarSesiones },
  };
  return { prisma: { ...tx, $transaction: (operacion: (cliente: typeof tx) => Promise<unknown>) => operacion(tx) } };
});
vi.mock("@/lib/auth/password", () => ({
  verificarContrasena: dobles.verificar, hashearContrasena: dobles.hashear, verificarContraFicticio: vi.fn(),
}));
vi.mock("@/lib/bitacora", () => ({ registrarEvento: dobles.evento }));

const actor = { id: "usuario", nombre: "Usuario", correo: "usuario@example.test",
  perfil: "PRODUCCION" as const, perfiles: ["PRODUCCION" as const], permisos: [], debeCambiarClave: true };
const entrada = { claveActual: "Clave-actual-123", claveNueva: "Clave-nueva-456" };
const ahora = new Date("2026-10-11T12:00:00.000Z");
const fila = {
  ...actor, perfiles: [{ perfil: { codigo: "PRODUCCION" as const, permisos: [] } }],
  hashContrasena: "hash-actual", activo: true, bloqueadoHasta: null,
  contrasenaTemporal: true, contrasenaTemporalExpiraEn: new Date(ahora.getTime() + 1000),
};
const filaBloqueada = {
  hash_contrasena: "hash-actual", activo: true, bloqueado_hasta: null,
  contrasena_temporal: true, contrasena_temporal_expira_en: fila.contrasenaTemporalExpiraEn,
  actualizado_en: ahora,
};

beforeEach(() => {
  vi.resetAllMocks();
  dobles.consulta.mockResolvedValue([filaBloqueada]);
  dobles.buscarUsuario.mockResolvedValue(fila);
  dobles.buscarSesion.mockResolvedValue({ usuarioId: actor.id, revocadaEn: null, expiraEn: new Date(Date.now() + 60_000) });
  dobles.verificar.mockResolvedValue(true);
  dobles.hashear.mockResolvedValue("hash-nuevo");
});

describe("clave temporal durante login", () => {
  it("rechaza el vencimiento exacto con el error genérico", async () => {
    dobles.buscarUsuario.mockResolvedValue({ ...fila, contrasenaTemporalExpiraEn: ahora });
    await expect(iniciarSesion({ correo: actor.correo, contrasena: entrada.claveActual }, ahora))
      .rejects.toMatchObject({ codigo: "CREDENCIALES_INVALIDAS", status: 401 });
    expect(dobles.crearSesion).not.toHaveBeenCalled();
  });

  it("abre sesión con el indicador de cambio obligatorio", async () => {
    const resultado = await iniciarSesion({ correo: actor.correo, contrasena: entrada.claveActual }, ahora);
    expect(resultado.usuario.debeCambiarClave).toBe(true);
    expect(respuestaSesion(actor).usuario.debeCambiarClave).toBe(true);
    expect(dobles.crearSesion).toHaveBeenCalledOnce();
  });

  it("revalida el vencimiento bajo bloqueo antes de crear la sesión", async () => {
    dobles.consulta.mockResolvedValue([{ ...filaBloqueada, contrasena_temporal_expira_en: ahora }]);
    await expect(abrirSesion(fila, ahora)).rejects.toMatchObject({ codigo: "CREDENCIALES_INVALIDAS" });
    expect(dobles.crearSesion).not.toHaveBeenCalled();
  });
});

describe("cambio de clave", () => {
  it("verifica la clave actual y guarda únicamente el hash nuevo", async () => {
    expect(await cambiarClave(entrada, actor, "token-actual")).toEqual({ debeCambiarClave: false });
    expect(dobles.verificar).toHaveBeenCalledWith("hash-actual", entrada.claveActual);
    expect(dobles.hashear).toHaveBeenCalledWith(entrada.claveNueva);
    expect(dobles.actualizarUsuario).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: actor.id }, data: expect.objectContaining({
        hashContrasena: "hash-nuevo", contrasenaTemporal: false, contrasenaTemporalExpiraEn: null,
      }),
    }));
    expect(dobles.revocarSesiones).toHaveBeenCalledWith(expect.objectContaining({
      where: { usuarioId: actor.id, tokenHash: { not: expect.any(String) }, revocadaEn: null },
    }));
    const evento = dobles.evento.mock.calls[0][1];
    expect(evento).toMatchObject({ entidad: "USUARIO", accion: "EDITAR", actorId: actor.id });
    for (const secreto of [entrada.claveActual, entrada.claveNueva, "hash-actual", "hash-nuevo", "token-actual"]) {
      expect(JSON.stringify(evento)).not.toContain(secreto);
    }
  });

  it("rechaza la clave actual incorrecta sin escrituras", async () => {
    dobles.verificar.mockResolvedValue(false);
    await expect(cambiarClave(entrada, actor, "token-actual"))
      .rejects.toMatchObject({ codigo: "CREDENCIALES_INVALIDAS", status: 401 });
    expect(dobles.actualizarUsuario).not.toHaveBeenCalled();
    expect(dobles.revocarSesiones).not.toHaveBeenCalled();
    expect(dobles.evento).not.toHaveBeenCalled();
  });

  it.each([null, { usuarioId: "otro", revocadaEn: null, expiraEn: new Date(Date.now() + 60_000) },
    { usuarioId: actor.id, revocadaEn: new Date(), expiraEn: new Date(Date.now() + 60_000) },
    { usuarioId: actor.id, revocadaEn: null, expiraEn: new Date(0) },
  ])("rechaza sesiones inválidas dentro de la transacción: %j", async (sesion) => {
    dobles.buscarSesion.mockResolvedValue(sesion);
    await expect(cambiarClave(entrada, actor, "token-actual")).rejects.toMatchObject({ codigo: "SIN_SESION" });
    expect(dobles.verificar).not.toHaveBeenCalled();
    expect(dobles.actualizarUsuario).not.toHaveBeenCalled();
  });
});
