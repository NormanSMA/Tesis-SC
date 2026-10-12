import { createHash, randomBytes, randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { POST as login } from "@/app/api/v1/auth/login/route";
import type { Actor } from "@/core/autorizacion";
import { PERFILES, PERMISOS_POR_PERFIL, type PerfilCodigo } from "@/core/permisos";
import { hashearContrasena, verificarContrasena } from "@/lib/auth/password";
import { obtenerSesionDeRequest } from "@/lib/auth/sesion";
import { prisma } from "@/lib/db";
import { esquemaConsultaUsuarios } from "@/modules/admin/schema";
import {
  crearUsuario, desbloquearUsuario, desactivarUsuario, editarUsuario, listarUsuarios,
  obtenerUsuario, reactivarUsuario, reiniciarClaveUsuario,
} from "@/modules/admin/service";
import type { UsuarioConClave } from "@/modules/admin/tipos";

let adminA: Actor;
let adminB: Actor;
let usuario: UsuarioConClave;
let ids: string[];

async function leerVersionUsuario(id: string): Promise<string> {
  const fila = await prisma.usuario.findUniqueOrThrow({
    where: { id }, select: { actualizadoEn: true },
  });
  return fila.actualizadoEn.toISOString();
}

async function crearActor(perfil: PerfilCodigo): Promise<Actor> {
  const fila = await prisma.usuario.create({
    data: {
      nombre: `Usuario ${perfil}`, correo: `${randomUUID()}@example.test`,
      hashContrasena: await hashearContrasena("clave-fixture-usuarios"),
      perfiles: { create: { perfil: { connect: { codigo: perfil } } } },
    },
  });
  ids.push(fila.id);
  return { id: fila.id, nombre: fila.nombre, correo: fila.correo,
    perfil, perfiles: [perfil], permisos: PERMISOS_POR_PERFIL[perfil] };
}

beforeEach(async () => {
  ids = [];
  for (const { codigo, nombre } of PERFILES) {
    await prisma.perfil.upsert({ where: { codigo }, update: {}, create: { codigo, nombre } });
  }
  adminA = await crearActor("ADMIN");
  adminB = await crearActor("ADMIN");
  usuario = await crearUsuario({ nombre: "Usuario de prueba",
    correo: `${randomUUID()}@example.test`, perfiles: ["PRODUCCION"] }, adminA);
  ids.push(usuario.usuario.id);
});

afterEach(async () => {
  await prisma.usuario.updateMany({ where: { id: { in: ids } }, data: { activo: false } });
  await prisma.sesion.updateMany({ where: { usuarioId: { in: ids }, revocadaEn: null },
    data: { revocadaEn: new Date() } });
});

async function conAdministradoresFixture(accion: () => Promise<void>): Promise<void> {
  const otros = await prisma.usuario.findMany({
    where: { activo: true, id: { notIn: [adminA.id, adminB.id] },
      perfiles: { some: { perfil: { codigo: "ADMIN" } } } }, select: { id: true },
  });
  const otrosIds = otros.map(({ id }) => id);
  try {
    await prisma.usuario.updateMany({ where: { id: { in: otrosIds } }, data: { activo: false } });
    await accion();
  } finally {
    await prisma.usuario.updateMany({ where: { id: { in: otrosIds } }, data: { activo: true } });
  }
}

async function insertarSesion(usuarioId: string) {
  const token = randomBytes(32).toString("hex");
  return prisma.sesion.create({ data: {
    usuarioId, tokenHash: createHash("sha256").update(token).digest("hex"),
    expiraEn: new Date(Date.now() + 3_600_000),
  } });
}

function iniciarSesion(correo: string, contrasena: string): Promise<Response> {
  return login(new Request("http://127.0.0.1:3000/api/v1/auth/login", {
    method: "POST", headers: { origin: "http://127.0.0.1:3000", "content-type": "application/json" },
    body: JSON.stringify({ correo, contrasena }),
  }));
}

async function solicitudAutenticada(correo: string, contrasena: string): Promise<Request> {
  const respuesta = await iniciarSesion(correo, contrasena);
  expect(respuesta.status).toBe(200);
  const cookie = respuesta.headers.get("set-cookie")?.split(";")[0];
  expect(cookie).toBeTruthy();
  return new Request("http://127.0.0.1:3000/api/v1/usuarios", { headers: { cookie: cookie! } });
}

describe("Servicio de usuarios", () => {
  it("impide crear usuarios activos sin perfiles desde el servicio", async () => {
    await expect(crearUsuario({ nombre: "Sin perfil", correo: `${randomUUID()}@example.test`, perfiles: [] }, adminA))
      .rejects.toMatchObject({ status: 409, codigo: "USUARIO_SIN_PERFIL" });
  });
  it("genera clave temporal compatible con login y guarda solamente argon2id", async () => {
    expect(usuario.claveTemporal).toHaveLength(16);
    const guardado = await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.usuario.id } });
    expect(guardado.hashContrasena).toMatch(/^\$argon2id\$/);
    expect(guardado.hashContrasena).not.toBe(usuario.claveTemporal);
    expect(await verificarContrasena(guardado.hashContrasena, usuario.claveTemporal)).toBe(true);
    const respuesta = await iniciarSesion(usuario.usuario.correo, usuario.claveTemporal);
    expect(respuesta.status).toBe(200);
    expect(await prisma.sesion.count({ where: { usuarioId: usuario.usuario.id, revocadaEn: null } })).toBeGreaterThan(0);
  });

  it("registra actor, campos y perfiles sin secretos", async () => {
    const reinicio = await reiniciarClaveUsuario(usuario.usuario.id, adminA);
    await editarUsuario(usuario.usuario.id, { version: reinicio.usuario.actualizadoEn,
      nombre: "Nombre editado", correo: `${randomUUID()}@example.test`,
      perfiles: ["OPERACIONES", "PRODUCCION"] }, adminA);
    const eventos = await prisma.bitacora.findMany({
      where: { entidad: "USUARIO", entidadId: usuario.usuario.id }, orderBy: { creadoEn: "asc" },
    });
    expect(eventos.map(({ accion }) => accion)).toEqual(["CREAR", "EDITAR", "EDITAR"]);
    expect(eventos.every(({ usuarioId }) => usuarioId === adminA.id)).toBe(true);
    const serializado = JSON.stringify(eventos);
    expect(serializado).not.toContain(usuario.claveTemporal);
    expect(serializado).not.toContain(reinicio.claveTemporal);
    expect(serializado).not.toContain("hashContrasena");
    expect(serializado).not.toContain("claveTemporal");
    expect(serializado).not.toContain("$argon2id$");
    expect(eventos[2].detalle).toMatchObject({
      antes: { nombre: "Usuario de prueba", perfiles: ["PRODUCCION"] },
      despues: { nombre: "Nombre editado", perfiles: ["OPERACIONES", "PRODUCCION"] },
    });
    const ficha = await obtenerUsuario(usuario.usuario.id, adminA);
    expect(ficha).not.toHaveProperty("claveTemporal");
    expect(ficha).not.toHaveProperty("hashContrasena");
  });

  it("rechaza correo duplicado al crear y editar sin cambios parciales", async () => {
    await expect(crearUsuario({ nombre: "Duplicado", correo: usuario.usuario.correo.toUpperCase(),
      perfiles: ["PRODUCCION"] }, adminA)).rejects.toMatchObject({ status: 409, codigo: "DUPLICADO" });
    await expect(editarUsuario(usuario.usuario.id, { version: usuario.usuario.actualizadoEn,
      correo: adminA.correo, perfiles: ["OPERACIONES"] }, adminA))
      .rejects.toMatchObject({ status: 409, codigo: "DUPLICADO" });
    expect((await obtenerUsuario(usuario.usuario.id, adminA)).perfiles).toEqual(["PRODUCCION"]);
  });

  it("reemplaza perfiles y rechaza versión obsoleta", async () => {
    const editado = await editarUsuario(usuario.usuario.id, {
      version: usuario.usuario.actualizadoEn, perfiles: ["OPERACIONES"],
    }, adminA);
    expect(editado.perfiles).toEqual(["OPERACIONES"]);
    expect(editado.actualizadoEn).not.toBe(usuario.usuario.actualizadoEn);
    await expect(editarUsuario(usuario.usuario.id, { version: usuario.usuario.actualizadoEn, nombre: "Obsoleto" }, adminA))
      .rejects.toMatchObject({ status: 409, codigo: "CONFLICTO_EDICION" });
  });

  it("impide desactivar o degradar el ADMIN propio", async () => {
    const ficha = await obtenerUsuario(adminA.id, adminA);
    await expect(desactivarUsuario(adminA.id, { version: await leerVersionUsuario(adminA.id) }, adminA))
      .rejects.toMatchObject({ status: 409, codigo: "ADMIN_PROPIO" });
    await expect(editarUsuario(adminA.id, { version: ficha.actualizadoEn, perfiles: ["PRODUCCION"] }, adminA))
      .rejects.toMatchObject({ status: 409, codigo: "ADMIN_PROPIO" });
  });

  it("impide degradar y desactivar el último ADMIN", async () => {
    await conAdministradoresFixture(async () => {
      await desactivarUsuario(adminB.id, { version: await leerVersionUsuario(adminB.id) }, adminA);
      const ficha = await obtenerUsuario(adminA.id, adminA);
      await expect(desactivarUsuario(adminA.id, { version: await leerVersionUsuario(adminA.id) }, adminB))
        .rejects.toMatchObject({ status: 409, codigo: "ULTIMO_ADMIN" });
      await expect(editarUsuario(adminA.id, { version: ficha.actualizadoEn, perfiles: ["PRODUCCION"] }, adminB))
        .rejects.toMatchObject({ status: 409, codigo: "ULTIMO_ADMIN" });
    });
  });

  it("serializa dos desactivaciones simultáneas y conserva un ADMIN", async () => {
    await conAdministradoresFixture(async () => {
      const versionA = await leerVersionUsuario(adminA.id);
      const versionB = await leerVersionUsuario(adminB.id);
      const resultados = await Promise.allSettled([
        desactivarUsuario(adminB.id, { version: versionB }, adminA),
        desactivarUsuario(adminA.id, { version: versionA }, adminB),
      ]);
      expect(resultados.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
      const rechazado = resultados.find((resultado) => resultado.status === "rejected");
      expect(rechazado).toMatchObject({ status: "rejected", reason: { codigo: "ULTIMO_ADMIN", status: 409 } });
      expect(await prisma.usuario.count({ where: {
        activo: true, perfiles: { some: { perfil: { codigo: "ADMIN" } } },
      } })).toBe(1);
    });
  });

  it("revoca sesiones al desactivar y conserva historial al reactivar", async () => {
    const sesion = await insertarSesion(usuario.usuario.id);
    const solicitud = await solicitudAutenticada(usuario.usuario.correo, usuario.claveTemporal);
    expect((await obtenerSesionDeRequest(solicitud))?.id).toBe(usuario.usuario.id);
    await desactivarUsuario(usuario.usuario.id, { version: await leerVersionUsuario(usuario.usuario.id) }, adminA);
    expect(await obtenerSesionDeRequest(solicitud)).toBeNull();
    expect((await prisma.sesion.findUniqueOrThrow({ where: { id: sesion.id } })).revocadaEn).not.toBeNull();
    expect((await iniciarSesion(usuario.usuario.correo, usuario.claveTemporal)).status).toBe(401);
    const reactivado = await reactivarUsuario(usuario.usuario.id,
      { version: await leerVersionUsuario(usuario.usuario.id) }, adminA);
    expect(reactivado.activo).toBe(true);
    expect(reactivado.perfiles).toEqual(["PRODUCCION"]);
    expect(await obtenerSesionDeRequest(solicitud)).toBeNull();
    expect((await prisma.sesion.findUniqueOrThrow({ where: { id: sesion.id } })).revocadaEn).not.toBeNull();
    const eventos = await prisma.bitacora.findMany({ where: {
      entidadId: usuario.usuario.id, accion: "CAMBIAR_ESTADO", usuarioId: adminA.id,
    }, orderBy: { creadoEn: "asc" } });
    expect(eventos.map(({ estadoAnterior, estadoNuevo }) => [estadoAnterior, estadoNuevo]))
      .toEqual([["ACTIVO", "INACTIVO"], ["INACTIVO", "ACTIVO"]]);
  });

  it("reinicia clave, limpia bloqueo y revoca todas las sesiones", async () => {
    await insertarSesion(usuario.usuario.id);
    await insertarSesion(usuario.usuario.id);
    const solicitud = await solicitudAutenticada(usuario.usuario.correo, usuario.claveTemporal);
    expect((await obtenerSesionDeRequest(solicitud))?.id).toBe(usuario.usuario.id);
    await prisma.usuario.update({ where: { id: usuario.usuario.id }, data: {
      intentosFallidos: 5, bloqueadoHasta: new Date(Date.now() + 600_000),
    } });
    const reinicio = await reiniciarClaveUsuario(usuario.usuario.id, adminA);
    expect(reinicio.claveTemporal).toHaveLength(16);
    expect(reinicio.claveTemporal).not.toBe(usuario.claveTemporal);
    expect(reinicio.usuario).toMatchObject({ intentosFallidos: 0, bloqueadoHasta: null });
    expect(await prisma.sesion.count({ where: { usuarioId: usuario.usuario.id, revocadaEn: null } })).toBe(0);
    expect(await obtenerSesionDeRequest(solicitud)).toBeNull();
    const guardado = await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.usuario.id } });
    expect(await verificarContrasena(guardado.hashContrasena, usuario.claveTemporal)).toBe(false);
    expect((await iniciarSesion(usuario.usuario.correo, reinicio.claveTemporal)).status).toBe(200);
  });

  it("desbloquea sin revocar sesiones", async () => {
    const sesion = await insertarSesion(usuario.usuario.id);
    await prisma.usuario.update({ where: { id: usuario.usuario.id }, data: {
      intentosFallidos: 5, bloqueadoHasta: new Date(Date.now() + 600_000),
    } });
    expect(await desbloquearUsuario(usuario.usuario.id, adminA)).toMatchObject({ intentosFallidos: 0, bloqueadoHasta: null });
    expect((await prisma.sesion.findUniqueOrThrow({ where: { id: sesion.id } })).revocadaEn).toBeNull();
  });

  it("filtra por búsqueda, perfil y estado con paginación", async () => {
    const consulta = esquemaConsultaUsuarios.parse({ q: usuario.usuario.correo, perfil: "PRODUCCION",
      activo: "true", pagina: "1", porPagina: "1" });
    const lista = await listarUsuarios(consulta, adminA);
    expect(lista.total).toBe(1);
    expect(lista.datos.map(({ id }) => id)).toEqual([usuario.usuario.id]);
    expect(lista.datos[0]).not.toHaveProperty("hashContrasena");
    await desactivarUsuario(usuario.usuario.id, { version: await leerVersionUsuario(usuario.usuario.id) }, adminA);
    expect((await listarUsuarios(consulta, adminA)).total).toBe(0);
    expect((await listarUsuarios({ ...consulta, activo: false }, adminA)).total).toBe(1);
  });

  it("revierte edición y perfiles cuando falla la bitácora", async () => {
    await expect(editarUsuario(usuario.usuario.id, { version: usuario.usuario.actualizadoEn,
      nombre: "No persistir", perfiles: ["OPERACIONES"] }, { ...adminA, id: randomUUID() })).rejects.toThrow();
    const ficha = await obtenerUsuario(usuario.usuario.id, adminA);
    expect(ficha.nombre).toBe(usuario.usuario.nombre);
    expect(ficha.perfiles).toEqual(["PRODUCCION"]);
    expect(ficha.actualizadoEn).toBe(usuario.usuario.actualizadoEn);
  });
});
