import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as desactivar } from "@/app/api/v1/usuarios/[id]/desactivar/route";
import { POST as reactivar } from "@/app/api/v1/usuarios/[id]/reactivar/route";
import type { Actor } from "@/core/autorizacion";
import { PERMISOS_POR_PERFIL } from "@/core/permisos";
import { hashearContrasena } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import type { RutaHandler } from "@/lib/http";
import type { UsuarioDto } from "@/modules/admin/tipos";

const sesion = vi.hoisted(() => ({ actor: null as Actor | null }));
vi.mock("@/lib/auth/sesion", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/sesion")>(),
  obtenerSesionDeRequest: vi.fn(async () => sesion.actor),
}));

let id: string;
let actorId: string;
let versionInicial: string;

function ejecutar(handler: RutaHandler, cuerpo: unknown) {
  const accion = handler === reactivar ? "reactivar" : "desactivar";
  const req = new Request(`http://127.0.0.1:3000/api/v1/usuarios/${id}/${accion}`, {
    method: "POST",
    headers: { origin: "http://127.0.0.1:3000", "content-type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  return handler(req, { params: Promise.resolve({ id }) });
}

async function cambiar(handler: RutaHandler, version: string): Promise<UsuarioDto> {
  const respuesta = await ejecutar(handler, { version });
  expect(respuesta.status).toBe(200);
  return (await respuesta.json()).datos;
}

async function exigirConflicto(handler: RutaHandler, version: string) {
  const respuesta = await ejecutar(handler, { version });
  expect(respuesta.status).toBe(409);
  expect(await respuesta.json()).toMatchObject({ error: { codigo: "CONFLICTO_EDICION" } });
}

beforeEach(async () => {
  const perfil = await prisma.perfil.upsert({
    where: { codigo: "ADMIN" }, update: {}, create: { codigo: "ADMIN", nombre: "Administración técnica" },
  });
  const hashContrasena = await hashearContrasena("clave-fixture-usuarios-version");
  const actor = await prisma.usuario.create({
    data: {
      nombre: "ADMIN versión", correo: `admin-version-${randomUUID()}@example.test`, hashContrasena,
      perfiles: { create: { perfilId: perfil.id } },
    },
  });
  actorId = actor.id;
  sesion.actor = {
    id: actor.id, nombre: actor.nombre, correo: actor.correo, perfil: "ADMIN",
    perfiles: ["ADMIN"], permisos: PERMISOS_POR_PERFIL.ADMIN,
  };
  const usuario = await prisma.usuario.create({
    data: {
      nombre: "Usuario versión", correo: `usuario-version-${randomUUID()}@example.test`, hashContrasena,
      activo: false, perfiles: { create: { perfilId: perfil.id } },
    },
  });
  id = usuario.id;
  versionInicial = usuario.actualizadoEn.toISOString();
});

afterEach(async () => {
  sesion.actor = null;
  await prisma.usuario.updateMany({ where: { id: { in: [id, actorId] } }, data: { activo: false } });
});

describe("Versión al cambiar el estado del usuario", () => {
  it("rechaza reactivar con la versión inicial después de reactivar y desactivar", async () => {
    const activo = await cambiar(reactivar, versionInicial);
    expect(activo.activo).toBe(true);
    const inactivo = await cambiar(desactivar, activo.actualizadoEn);
    expect(inactivo.activo).toBe(false);

    await exigirConflicto(reactivar, versionInicial);
    const persistido = await prisma.usuario.findUniqueOrThrow({ where: { id } });
    expect(persistido.activo).toBe(false);
    expect(persistido.actualizadoEn.toISOString()).toBe(inactivo.actualizadoEn);

    const reactivado = await cambiar(reactivar, inactivo.actualizadoEn);
    expect(reactivado.activo).toBe(true);
    await exigirConflicto(reactivar, inactivo.actualizadoEn);
    expect((await cambiar(reactivar, reactivado.actualizadoEn)).activo).toBe(true);
  });

  it("rechaza desactivar con versión obsoleta aunque el usuario ya esté inactivo", async () => {
    const activo = await cambiar(reactivar, versionInicial);
    await exigirConflicto(desactivar, versionInicial);
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id } })).activo).toBe(true);

    const inactivo = await cambiar(desactivar, activo.actualizadoEn);
    expect(inactivo.activo).toBe(false);
    await exigirConflicto(desactivar, activo.actualizadoEn);
    expect((await cambiar(desactivar, inactivo.actualizadoEn)).activo).toBe(false);
  });

  it.each([
    { accion: "reactivar", handler: reactivar, cuerpo: {} },
    { accion: "reactivar", handler: reactivar, cuerpo: { version: "invalida" } },
    { accion: "desactivar", handler: desactivar, cuerpo: {} },
    { accion: "desactivar", handler: desactivar, cuerpo: { version: "invalida" } },
  ])("exige versión ISO válida para $accion: $cuerpo", async ({ handler, cuerpo }) => {
    expect((await ejecutar(handler, cuerpo)).status).toBe(422);
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id } })).activo).toBe(false);
  });
});
