import { createHash, randomUUID } from "node:crypto";

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
import type { PermisosPerfilDto } from "@/modules/admin/permisos-dto";
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

async function leerPermisos(perfil: PerfilCodigo): Promise<PermisosPerfilDto> {
  const respuesta = await GET(solicitud({ cookie: cookieAdmin }));
  expect(respuesta.status).toBe(200);
  const { datos } = await respuesta.json();
  return datos.matriz.find((fila: PermisosPerfilDto) => fila.perfil === perfil);
}

async function reemplazar(perfil: PerfilCodigo, permisos: readonly string[], opciones: { cookie?: string; version?: string } = {}) {
  const version = opciones.version ?? (await leerPermisos(perfil)).version;
  return PUT(solicitud({
    ruta: `permisos/${perfil}`, metodo: "PUT", cookie: opciones.cookie ?? cookieAdmin, cuerpo: { permisos, version },
  }), {
    params: Promise.resolve({ perfil }),
  });
}

describe("API de permisos", () => {
  it("exige sesión para GET y PUT", async () => {
    expect((await GET(solicitud({ cookie: "" }))).status).toBe(401);
    expect((await reemplazar("PRODUCCION", [], { cookie: "" })).status).toBe(401);
  });

  it("devuelve perfiles, catálogo agrupado y matriz para ADMIN", async () => {
    const respuesta = await GET(solicitud({ cookie: cookieAdmin }));
    expect(respuesta.status).toBe(200);
    const { datos } = await respuesta.json();
    expect(datos.perfiles).toHaveLength(6);
    expect(datos.permisos.flatMap((grupo: { permisos: unknown[] }) => grupo.permisos)).toHaveLength(CATALOGO_PERMISOS.length);
    for (const fila of datos.matriz as PermisosPerfilDto[]) {
      expect(fila.version).toMatch(/^[0-9a-f]{64}$/);
      expect(fila.version).toBe(createHash("sha256").update(JSON.stringify([...fila.permisos].sort())).digest("hex"));
    }
    expect(datos.matriz).toContainEqual(expect.objectContaining({ perfil: "ADMIN", permisos: [...PERMISOS_POR_PERFIL.ADMIN].sort() }));
  });

  it.each(PERFILES.filter(({ codigo }) => codigo !== "ADMIN"))("rechaza GET y PUT de $codigo", async ({ codigo }) => {
    const { cookie } = await crearSesionPerfil(codigo);
    expect((await GET(solicitud({ cookie }))).status).toBe(403);
    expect((await reemplazar("PRODUCCION", [], { cookie })).status).toBe(403);
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

  it("exige una versión hexadecimal válida sin cambios ni bitácora", async () => {
    const anterior = await leerPermisos("PRODUCCION");
    for (const cuerpo of [{ permisos: [] }, { permisos: [], version: "antigua" }]) {
      const respuesta = await PUT(solicitud({
        ruta: "permisos/PRODUCCION", metodo: "PUT", cookie: cookieAdmin, cuerpo,
      }), { params: Promise.resolve({ perfil: "PRODUCCION" }) });
      expect(respuesta.status).toBe(422);
      expect((await respuesta.json()).error.campos).toHaveProperty("version");
    }
    expect(await leerPermisos("PRODUCCION")).toEqual(anterior);
    expect(await prisma.bitacora.count({ where: { entidad: "PERFIL_PERMISO", usuarioId: actorId } })).toBe(0);
  });

  it("guarda con la versión vigente y devuelve la nueva versión", async () => {
    const anterior = await leerPermisos("PRODUCCION");
    const permisos = [...anterior.permisos, "cliente:ver"];
    const respuesta = await reemplazar("PRODUCCION", permisos, { version: anterior.version });
    expect(respuesta.status).toBe(200);
    const { datos } = await respuesta.json();
    expect(datos.permisos).toEqual([...permisos].sort());
    expect(datos.version).not.toBe(anterior.version);
    expect(datos.version).toBe(createHash("sha256").update(JSON.stringify([...permisos].sort())).digest("hex"));
    expect(await leerPermisos("PRODUCCION")).toEqual(datos);
    expect((await reemplazar("PRODUCCION", anterior.permisos, { version: datos.version })).status).toBe(200);
  });

  it("rechaza la versión antigua sin modificar asignaciones ni bitácora", async () => {
    const anterior = await leerPermisos("PRODUCCION");
    expect((await reemplazar("PRODUCCION", [...anterior.permisos, "cliente:ver"], { version: anterior.version })).status).toBe(200);
    const vigente = await leerPermisos("PRODUCCION");
    const asignaciones = await prisma.perfilPermiso.findMany({
      where: { perfil: { codigo: "PRODUCCION" } }, orderBy: { permisoId: "asc" },
    });
    const eventos = await prisma.bitacora.findMany({ where: { entidad: "PERFIL_PERMISO", usuarioId: actorId } });
    const respuesta = await reemplazar("PRODUCCION", [], { version: anterior.version });
    expect(respuesta.status).toBe(409);
    expect((await respuesta.json()).error.codigo).toBe("CONFLICTO_EDICION");
    expect(await leerPermisos("PRODUCCION")).toEqual(vigente);
    expect(await prisma.perfilPermiso.findMany({
      where: { perfil: { codigo: "PRODUCCION" } }, orderBy: { permisoId: "asc" },
    })).toEqual(asignaciones);
    expect(await prisma.bitacora.findMany({ where: { entidad: "PERFIL_PERMISO", usuarioId: actorId } })).toEqual(eventos);
  });

  it.each([false, true])("serializa dos PUT con la misma versión; matriz vacía: %s", async (vacia) => {
    if (vacia) expect((await reemplazar("PRODUCCION", [])).status).toBe(200);
    const anterior = await leerPermisos("PRODUCCION");
    const eventosPrevios = await prisma.bitacora.count({ where: { entidad: "PERFIL_PERMISO", usuarioId: actorId } });
    const respuestas = await Promise.all([
      reemplazar("PRODUCCION", [...anterior.permisos, "cliente:ver"], { version: anterior.version }),
      reemplazar("PRODUCCION", [...anterior.permisos, "cliente:gestionar"], { version: anterior.version }),
    ]);
    expect(respuestas.map(({ status }) => status).sort()).toEqual([200, 409]);
    const ganadora = respuestas.find(({ status }) => status === 200)!;
    const rechazada = respuestas.find(({ status }) => status === 409)!;
    const { datos } = await ganadora.json();
    expect((await rechazada.json()).error.codigo).toBe("CONFLICTO_EDICION");
    expect(await leerPermisos("PRODUCCION")).toEqual(datos);
    expect(await prisma.bitacora.count({ where: { entidad: "PERFIL_PERMISO", usuarioId: actorId } })).toBe(eventosPrevios + 1);
  });

  it("revierte la matriz cuando falla la bitácora", async () => {
    const actor = await obtenerSesionDeRequest(solicitud({ cookie: cookieAdmin }));
    expect(actor).not.toBeNull();
    const { version } = await leerPermisos("PRODUCCION");
    const registrar = vi.spyOn(bitacora, "registrarEvento").mockRejectedValueOnce(new Error("Fallo de bitácora"));
    try {
      await expect(reemplazarPermisosPerfil("PRODUCCION", { permisos: [], version }, actor!)).rejects.toThrow("Fallo de bitácora");
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
