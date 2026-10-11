import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as iniciarSesion } from "@/app/api/v1/auth/login/route";
import { GET } from "@/app/api/v1/permisos/route";
import { PUT } from "@/app/api/v1/permisos/[perfil]/route";
import { GET as listarClientes } from "@/app/api/v1/clientes/route";
import { CATALOGO_PERMISOS, PERFILES, PERMISOS_POR_PERFIL, type PerfilCodigo } from "@/core/permisos";
import { hashearContrasena } from "@/lib/auth/password";
import { obtenerSesionDeRequest } from "@/lib/auth/sesion";
import * as bitacora from "@/lib/bitacora";
import { prisma } from "@/lib/db";
import { PERMISOS_PROTEGIDOS } from "@/modules/admin/permisos-schema";
import { reemplazarPermisosPerfil } from "@/modules/admin/permisos-service";

const origen = "http://127.0.0.1:3000";
let cookieAdmin: string;
let actorId: string;

function solicitud(datos: { ruta?: string; metodo?: string; cookie: string; cuerpo?: unknown }): Request {
  return new Request(`${origen}/api/v1/${datos.ruta ?? "permisos"}`, {
    method: datos.metodo ?? "GET",
    headers: { cookie: datos.cookie, origin: origen, "content-type": "application/json" },
    body: datos.cuerpo === undefined ? undefined : JSON.stringify(datos.cuerpo),
  });
}

async function crearSesionPerfil(codigo: PerfilCodigo) {
  const contrasena = "ClavePruebasAdministracion2026";
  const perfil = await prisma.perfil.findUniqueOrThrow({ where: { codigo } });
  const usuario = await prisma.usuario.create({
    data: {
      nombre: `Prueba ${codigo}`, correo: `${randomUUID()}@admin.test`,
      hashContrasena: await hashearContrasena(contrasena),
      perfiles: { create: { perfilId: perfil.id } },
    },
  });
  const respuesta = await iniciarSesion(solicitud({
    ruta: "auth/login", metodo: "POST", cookie: "",
    cuerpo: { correo: usuario.correo, contrasena },
  }));
  expect(respuesta.status).toBe(200);
  const cookie = respuesta.headers.get("set-cookie")?.split(";")[0];
  expect(cookie).toBeTruthy();
  return { cookie: cookie!, id: usuario.id };
}

async function prepararMatriz(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const perfil of PERFILES) {
      const fila = await tx.perfil.upsert({ where: { codigo: perfil.codigo }, update: {}, create: perfil });
      await tx.perfilPermiso.deleteMany({ where: { perfilId: fila.id } });
      for (const codigo of PERMISOS_POR_PERFIL[perfil.codigo]) {
        const [recurso, accion] = codigo.split(":");
        const permiso = await tx.permiso.findUniqueOrThrow({ where: { recurso_accion: { recurso, accion } } });
        await tx.perfilPermiso.create({ data: { perfilId: fila.id, permisoId: permiso.id } });
      }
    }
  });
}

beforeEach(async () => {
  for (const { permiso: codigo, descripcion } of CATALOGO_PERMISOS) {
    const [recurso, accion] = codigo.split(":");
    await prisma.permiso.upsert({ where: { recurso_accion: { recurso, accion } }, update: {}, create: { recurso, accion, descripcion } });
  }
  await prepararMatriz();
  const admin = await crearSesionPerfil("ADMIN");
  cookieAdmin = admin.cookie;
  actorId = admin.id;
});

afterEach(prepararMatriz);

function reemplazar(perfil: PerfilCodigo, permisos: readonly string[], cookie = cookieAdmin) {
  return PUT(solicitud({ ruta: `permisos/${perfil}`, metodo: "PUT", cookie, cuerpo: { permisos } }), {
    params: Promise.resolve({ perfil }),
  });
}

describe("API de permisos", () => {
  it("exige sesión para GET y PUT", async () => {
    expect((await GET(solicitud({ cookie: "" }))).status).toBe(401);
    expect((await reemplazar("PRODUCCION", [], "")).status).toBe(401);
  });

  it("devuelve perfiles, catálogo agrupado y matriz para ADMIN", async () => {
    const respuesta = await GET(solicitud({ cookie: cookieAdmin }));
    expect(respuesta.status).toBe(200);
    const { datos } = await respuesta.json();
    expect(datos.perfiles).toHaveLength(6);
    expect(datos.permisos.flatMap((grupo: { permisos: unknown[] }) => grupo.permisos)).toHaveLength(CATALOGO_PERMISOS.length);
    expect(datos.matriz).toContainEqual({ perfil: "ADMIN", permisos: [...PERMISOS_POR_PERFIL.ADMIN].sort() });
  });

  it.each(PERFILES.filter(({ codigo }) => codigo !== "ADMIN"))("rechaza GET y PUT de $codigo", async ({ codigo }) => {
    const { cookie } = await crearSesionPerfil(codigo);
    expect((await GET(solicitud({ cookie }))).status).toBe(403);
    expect((await reemplazar("PRODUCCION", [], cookie)).status).toBe(403);
  });

  it.each(PERMISOS_PROTEGIDOS)("impide revocar %s sin cambios ni bitácora", async (protegido) => {
    const permisos = PERMISOS_POR_PERFIL.ADMIN.filter((codigo) => codigo !== protegido);
    const respuesta = await reemplazar("ADMIN", permisos);
    expect(respuesta.status).toBe(422);
    expect(await prisma.bitacora.count({ where: { entidad: "PERFIL_PERMISO", usuarioId: actorId } })).toBe(0);
    expect((await GET(solicitud({ cookie: cookieAdmin }))).status).toBe(200);
  });

  it("registra altas, bajas y actor sin repetir permisos conservados", async () => {
    const anteriores = PERMISOS_POR_PERFIL.PRODUCCION;
    const nuevos = [...anteriores.filter((codigo) => codigo !== "panel:ver"), "cliente:ver"];
    expect((await reemplazar("PRODUCCION", nuevos)).status).toBe(200);
    const eventos = await prisma.bitacora.findMany({ where: { entidad: "PERFIL_PERMISO", usuarioId: actorId } });
    expect(eventos).toHaveLength(2);
    expect(eventos).toEqual(expect.arrayContaining([
      expect.objectContaining({ accion: "OTORGAR_PERMISO", detalle: { perfil: "PRODUCCION", recurso: "cliente", accion: "ver" } }),
      expect.objectContaining({ accion: "REVOCAR_PERMISO", detalle: { perfil: "PRODUCCION", recurso: "panel", accion: "ver" } }),
    ]));
    const asignacion = await prisma.perfilPermiso.findFirstOrThrow({
      where: { perfil: { codigo: "PRODUCCION" }, permiso: { recurso: "cliente", accion: "ver" } },
    });
    expect(asignacion.otorgadoPorId).toBe(actorId);
    expect((await reemplazar("PRODUCCION", nuevos)).status).toBe(200);
    expect(await prisma.bitacora.count({ where: { entidad: "PERFIL_PERMISO", usuarioId: actorId } })).toBe(2);
  });

  it("revoca el acceso en la siguiente petición con la misma sesión", async () => {
    const { cookie } = await crearSesionPerfil("ATENCION_CLIENTE");
    expect((await listarClientes(solicitud({ ruta: "clientes", cookie }))).status).toBe(200);
    const nuevos = PERMISOS_POR_PERFIL.ATENCION_CLIENTE.filter((codigo) => codigo !== "cliente:ver");
    expect((await reemplazar("ATENCION_CLIENTE", nuevos)).status).toBe(200);
    expect((await listarClientes(solicitud({ ruta: "clientes", cookie }))).status).toBe(403);
  });

  it("permite asignar permisos de negocio a ADMIN y deja bitácora", async () => {
    expect((await reemplazar("ADMIN", [...PERMISOS_POR_PERFIL.ADMIN, "cliente:gestionar"])).status).toBe(200);
    expect(await prisma.bitacora.count({
      where: { entidad: "PERFIL_PERMISO", usuarioId: actorId, accion: "OTORGAR_PERMISO" },
    })).toBe(1);
  });

  it("rechaza códigos desconocidos y duplicados sin cambios", async () => {
    expect((await reemplazar("PRODUCCION", ["cliente:borrar"])).status).toBe(422);
    expect((await reemplazar("PRODUCCION", ["cliente:ver", "cliente:ver"])).status).toBe(422);
    expect(await prisma.bitacora.count({ where: { entidad: "PERFIL_PERMISO", usuarioId: actorId } })).toBe(0);
  });

  it("revierte la matriz cuando falla la bitácora", async () => {
    const actor = await obtenerSesionDeRequest(solicitud({ cookie: cookieAdmin }));
    expect(actor).not.toBeNull();
    const registrar = vi.spyOn(bitacora, "registrarEvento").mockRejectedValueOnce(new Error("Fallo de bitácora"));
    try {
      await expect(reemplazarPermisosPerfil("PRODUCCION", { permisos: [] }, actor!)).rejects.toThrow("Fallo de bitácora");
      const perfil = await prisma.perfil.findUniqueOrThrow({
        where: { codigo: "PRODUCCION" }, include: { permisos: { include: { permiso: true } } },
      });
      expect(perfil.permisos.map(({ permiso }) => `${permiso.recurso}:${permiso.accion}`).sort())
        .toEqual([...PERMISOS_POR_PERFIL.PRODUCCION].sort());
      expect(await prisma.bitacora.count({ where: { entidad: "PERFIL_PERMISO", usuarioId: actorId } })).toBe(0);
    } finally {
      registrar.mockRestore();
    }
  });
});
