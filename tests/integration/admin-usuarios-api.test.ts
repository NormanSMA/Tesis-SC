import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as listar, POST as crear } from "@/app/api/v1/usuarios/route";
import { GET as ver, PATCH as editar } from "@/app/api/v1/usuarios/[id]/route";
import { POST as desbloquear } from "@/app/api/v1/usuarios/[id]/desbloquear/route";
import { POST as desactivar } from "@/app/api/v1/usuarios/[id]/desactivar/route";
import { POST as reactivar } from "@/app/api/v1/usuarios/[id]/reactivar/route";
import { POST as reiniciar } from "@/app/api/v1/usuarios/[id]/reiniciar-clave/route";
import type { Actor } from "@/core/autorizacion";
import { PERFILES, PERMISOS_POR_PERFIL, type PerfilCodigo } from "@/core/permisos";
import { hashearContrasena } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import type { RutaHandler } from "@/lib/http";

const sesion = vi.hoisted(() => ({ actor: null as Actor | null }));
vi.mock("@/lib/auth/sesion", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/sesion")>(),
  obtenerSesionDeRequest: vi.fn(async () => sesion.actor),
}));

let id: string;
let actor: Actor;

function request(datos: { metodo: string; cuerpo?: unknown; origen?: string; ruta?: string }): Request {
  return new Request(`http://127.0.0.1:3000/api/v1/usuarios${datos.ruta ?? ""}`, {
    method: datos.metodo,
    headers: { origin: datos.origen ?? "http://127.0.0.1:3000", "content-type": "application/json" },
    body: datos.cuerpo === undefined ? undefined : JSON.stringify(datos.cuerpo),
  });
}

function ejecutar(handler: RutaHandler, datos: { metodo: string; cuerpo?: unknown; origen?: string; ruta?: string }) {
  return handler(request(datos), { params: Promise.resolve({ id }) });
}

beforeEach(async () => {
  const perfil = await prisma.perfil.upsert({
    where: { codigo: "ADMIN" }, update: {}, create: { codigo: "ADMIN", nombre: "Administración técnica" },
  });
  const usuario = await prisma.usuario.create({
    data: { nombre: "ADMIN API", correo: `admin-api-${randomUUID()}@example.test`,
      hashContrasena: await hashearContrasena("clave-fixture-usuarios"),
      perfiles: { create: { perfilId: perfil.id } } },
  });
  id = usuario.id;
  actor = { id, nombre: usuario.nombre, correo: usuario.correo, perfil: "ADMIN",
    perfiles: ["ADMIN"], permisos: PERMISOS_POR_PERFIL.ADMIN };
  sesion.actor = actor;
});

afterEach(async () => {
  sesion.actor = null;
  await prisma.usuario.updateMany({ where: { id }, data: { activo: false } });
});

const rutas: { handler: RutaHandler; metodo: string; ruta?: string; cuerpo?: unknown }[] = [
  { handler: listar, metodo: "GET" }, { handler: crear, metodo: "POST", cuerpo: {} },
  { handler: ver, metodo: "GET", ruta: "/usuario" },
  { handler: editar, metodo: "PATCH", cuerpo: {}, ruta: "/usuario" },
  { handler: desbloquear, metodo: "POST", ruta: "/usuario/desbloquear" },
  { handler: desactivar, metodo: "POST", ruta: "/usuario/desactivar" },
  { handler: reactivar, metodo: "POST", ruta: "/usuario/reactivar" },
  { handler: reiniciar, metodo: "POST", ruta: "/usuario/reiniciar-clave" },
];

describe("API de usuarios por perfil", () => {
  it.each(PERFILES.filter(({ codigo }) => codigo !== "ADMIN").map(({ codigo }) => codigo))(
    "%s recibe 403 en todas las rutas", async (perfil: PerfilCodigo) => {
      sesion.actor = { ...actor, perfil, perfiles: [perfil], permisos: PERMISOS_POR_PERFIL[perfil] };
      for (const { handler, ...datos } of rutas) {
        const respuesta = await ejecutar(handler, datos);
        expect(respuesta.status).toBe(403);
        expect(await respuesta.json()).toMatchObject({ error: { codigo: "SIN_PERMISO" } });
      }
    },
  );

  it("ADMIN lista, consulta, crea, edita y ejecuta acciones", async () => {
    expect((await ejecutar(listar, { metodo: "GET" })).status).toBe(200);
    expect((await ejecutar(ver, { metodo: "GET" })).status).toBe(200);
    const respuesta = await ejecutar(crear, { metodo: "POST", cuerpo: {
      nombre: "Usuario API", correo: `usuario-api-${randomUUID()}@example.test`, perfiles: ["ADMIN"],
    } });
    expect(respuesta.status).toBe(201);
    const { datos } = await respuesta.json();
    const actorId = id;
    id = datos.usuario.id;
    try {
      expect(datos.claveTemporal).toHaveLength(16);
      expect((await ejecutar(editar, { metodo: "PATCH", cuerpo: {
        nombre: "Usuario editado", version: datos.usuario.actualizadoEn,
      } })).status).toBe(200);
      for (const handler of [desbloquear, desactivar, reactivar, reiniciar]) {
        const conVersion = handler === desactivar || handler === reactivar;
        const cuerpo = conVersion ? { version: (await prisma.usuario.findUniqueOrThrow({
          where: { id }, select: { actualizadoEn: true },
        })).actualizadoEn.toISOString() } : undefined;
        expect((await ejecutar(handler, { metodo: "POST", cuerpo })).status).toBe(200);
      }
      const ficha = await (await ejecutar(ver, { metodo: "GET" })).json();
      expect(ficha.datos).not.toHaveProperty("hashContrasena");
      expect(ficha.datos).not.toHaveProperty("claveTemporal");
    } finally {
      await prisma.usuario.update({ where: { id }, data: { activo: false } });
      id = actorId;
    }
  });

  it("exige sesión en todas las rutas", async () => {
    sesion.actor = null;
    for (const { handler, ...datos } of rutas) {
      expect((await ejecutar(handler, datos)).status).toBe(401);
    }
  });

  it("rechaza origen externo en todas las escrituras", async () => {
    for (const { handler, ...datos } of rutas.filter(({ metodo }) => metodo !== "GET")) {
      const respuesta = await ejecutar(handler, { ...datos, origen: "https://externo.example" });
      expect(respuesta.status).toBe(403);
      expect(await respuesta.json()).toMatchObject({ error: { codigo: "ORIGEN_NO_PERMITIDO" } });
    }
  });

  it("valida entrada y consulta", async () => {
    expect((await ejecutar(crear, { metodo: "POST", cuerpo: {} })).status).toBe(422);
    expect((await ejecutar(listar, { metodo: "GET", ruta: "?pagina=0" })).status).toBe(422);
    const original = id;
    id = "no-uuid";
    expect((await ejecutar(ver, { metodo: "GET" })).status).toBe(404);
    id = original;
  });

  it("devuelve 409 por correo duplicado", async () => {
    const respuesta = await ejecutar(crear, { metodo: "POST", cuerpo: {
      nombre: "Duplicado", correo: actor.correo.toUpperCase(), perfiles: ["ADMIN"],
    } });
    expect(respuesta.status).toBe(409);
    expect(await respuesta.json()).toMatchObject({ error: { codigo: "DUPLICADO" } });
  });

  it("devuelve CONFLICTO_EDICION con versión obsoleta", async () => {
    const ficha = await (await ejecutar(ver, { metodo: "GET" })).json();
    const cuerpo = { nombre: "Primera edición", version: ficha.datos.actualizadoEn };
    expect((await ejecutar(editar, { metodo: "PATCH", cuerpo })).status).toBe(200);
    const respuesta = await ejecutar(editar, { metodo: "PATCH", cuerpo });
    expect(respuesta.status).toBe(409);
    expect(await respuesta.json()).toMatchObject({ error: { codigo: "CONFLICTO_EDICION" } });
  });
});
