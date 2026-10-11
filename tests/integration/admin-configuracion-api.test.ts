import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as iniciarSesion } from "@/app/api/v1/auth/login/route";
import { GET, PATCH } from "@/app/api/v1/configuracion/route";
import { PERFILES, PERMISOS_POR_PERFIL, type PerfilCodigo } from "@/core/permisos";
import type { TipoValorConfig } from "@/generated/prisma/client";
import { hashearContrasena } from "@/lib/auth/password";
import { obtenerSesionDeRequest } from "@/lib/auth/sesion";
import * as bitacora from "@/lib/bitacora";
import { prisma } from "@/lib/db";
import { editarConfiguracion } from "@/modules/admin/configuracion-service";

const origen = "http://127.0.0.1:3000";
const parametros: { clave: string; tipo: TipoValorConfig; valor: string; descripcion: string }[] = [
  { clave: "iva_porcentaje", tipo: "DECIMAL", valor: "15.00", descripcion: "IVA vigente en porcentaje" },
  { clave: "cotizacion_vigencia_dias", tipo: "ENTERO", valor: "15", descripcion: "Días de vigencia de una cotización" },
  { clave: "moneda", tipo: "TEXTO", valor: "NIO", descripcion: "Moneda de los documentos (ISO 4217)" },
  { clave: "empresa_nombre", tipo: "TEXTO", valor: "Soluciones Creativas", descripcion: "Nombre impreso en las proformas" },
  { clave: "zona_horaria", tipo: "TEXTO", valor: "America/Managua", descripcion: "Zona horaria de las fechas de calendario" },
];
let cookieAdmin: string;
let actorId: string;

function solicitud(datos: { ruta?: string; metodo?: string; cookie: string; cuerpo?: unknown }): Request {
  return new Request(`${origen}/api/v1/${datos.ruta ?? "configuracion"}`, {
    method: datos.metodo ?? "GET",
    headers: { cookie: datos.cookie, origin: origen, "content-type": "application/json" },
    body: datos.cuerpo === undefined ? undefined : JSON.stringify(datos.cuerpo),
  });
}

async function crearSesionPerfil(codigo: PerfilCodigo) {
  const contrasena = "ClavePruebasAdministracion2026";
  const definicion = PERFILES.find((perfil) => perfil.codigo === codigo)!;
  const perfil = await prisma.perfil.upsert({ where: { codigo }, create: definicion, update: {} });
  const permisos = codigo === "ADMIN" ? PERMISOS_POR_PERFIL.ADMIN : [];
  for (const permisoCodigo of permisos) {
    const [recurso, accion] = permisoCodigo.split(":");
    const permiso = await prisma.permiso.upsert({
      where: { recurso_accion: { recurso, accion } }, create: { recurso, accion }, update: {},
    });
    await prisma.perfilPermiso.upsert({
      where: { perfilId_permisoId: { perfilId: perfil.id, permisoId: permiso.id } },
      create: { perfilId: perfil.id, permisoId: permiso.id }, update: {},
    });
  }
  const usuario = await prisma.usuario.create({
    data: {
      nombre: `Prueba ${codigo}`, correo: `${randomUUID()}@configuracion.test`,
      hashContrasena: await hashearContrasena(contrasena),
      perfiles: { create: { perfilId: perfil.id } },
    },
  });
  const respuesta = await iniciarSesion(solicitud({
    ruta: "auth/login", metodo: "POST", cookie: "", cuerpo: { correo: usuario.correo, contrasena },
  }));
  expect(respuesta.status).toBe(200);
  const cookie = respuesta.headers.get("set-cookie")?.split(";")[0];
  expect(cookie).toBeTruthy();
  return { cookie: cookie!, id: usuario.id };
}

beforeEach(async () => {
  for (const parametro of parametros) {
    await prisma.configuracion.upsert({
      where: { clave: parametro.clave }, create: parametro,
      update: { ...parametro, actualizadoPorId: null },
    });
  }
  const admin = await crearSesionPerfil("ADMIN");
  cookieAdmin = admin.cookie;
  actorId = admin.id;
});

function editar(datos: { clave: string; valor: unknown; version: string; cookie?: string }) {
  const { cookie = cookieAdmin, ...cuerpo } = datos;
  return PATCH(solicitud({ metodo: "PATCH", cookie, cuerpo }));
}

async function versionDe(clave: string): Promise<string> {
  return (await prisma.configuracion.findUniqueOrThrow({ where: { clave } })).actualizadoEn.toISOString();
}

describe("API de configuración", () => {
  it("exige sesión para GET y PATCH", async () => {
    expect((await GET(solicitud({ cookie: "" }))).status).toBe(401);
    expect((await editar({ clave: "iva_porcentaje", valor: "10", version: await versionDe("iva_porcentaje"), cookie: "" })).status)
      .toBe(401);
  });

  it("lista valor, tipo, descripción y última edición para ADMIN", async () => {
    const respuesta = await GET(solicitud({ cookie: cookieAdmin }));
    expect(respuesta.status).toBe(200);
    const { datos } = await respuesta.json();
    expect(datos).toEqual(expect.arrayContaining(parametros.map((parametro) => expect.objectContaining({
      ...parametro, actualizadoEn: expect.any(String), actualizadoPorId: null,
    }))));
  });

  it.each(PERFILES.filter(({ codigo }) => codigo !== "ADMIN"))("rechaza GET y PATCH de $codigo", async ({ codigo }) => {
    const { cookie } = await crearSesionPerfil(codigo);
    expect((await GET(solicitud({ cookie }))).status).toBe(403);
    expect((await editar({ clave: "iva_porcentaje", valor: "10", version: await versionDe("iva_porcentaje"), cookie })).status)
      .toBe(403);
  });

  it.each([
    ["iva_porcentaje", "0"], ["iva_porcentaje", "100"],
    ["cotizacion_vigencia_dias", "1"], ["cotizacion_vigencia_dias", "365"],
    ["moneda", "USD"], ["empresa_nombre", "Empresa nueva"],
  ])("edita %s con valor %s y registra bitácora", async (clave, valor) => {
    const actual = await prisma.configuracion.findUniqueOrThrow({ where: { clave } });
    const respuesta = await editar({ clave, valor, version: actual.actualizadoEn.toISOString() });
    expect(respuesta.status).toBe(200);
    const { datos } = await respuesta.json();
    expect(datos).toMatchObject({ clave, valor, actualizadoPorId: actorId });
    expect(new Date(datos.actualizadoEn).getTime()).toBeGreaterThan(actual.actualizadoEn.getTime());
    expect(await prisma.bitacora.findMany({ where: { entidad: "CONFIGURACION", usuarioId: actorId } }))
      .toEqual([expect.objectContaining({
        entidadId: actual.id, accion: "EDITAR", detalle: { clave, valor: { anterior: actual.valor, nuevo: valor } },
      })]);
  });

  it.each([
    ["iva_porcentaje", "-1"], ["iva_porcentaje", "100.01"], ["iva_porcentaje", "15,5"],
    ["cotizacion_vigencia_dias", "0"], ["cotizacion_vigencia_dias", "366"], ["cotizacion_vigencia_dias", "1.5"],
    ["moneda", "nio"], ["moneda", "NI"], ["empresa_nombre", " "], ["empresa_nombre", "a".repeat(121)],
    ["zona_horaria", "America/Managua"],
  ])("rechaza %s con valor %s sin escribir", async (clave, valor) => {
    const actual = await prisma.configuracion.findUniqueOrThrow({ where: { clave } });
    expect((await editar({ clave, valor, version: actual.actualizadoEn.toISOString() })).status).toBe(422);
    const nuevo = await prisma.configuracion.findUniqueOrThrow({ where: { clave } });
    expect(nuevo).toEqual(actual);
    expect(await prisma.bitacora.count({ where: { entidad: "CONFIGURACION", usuarioId: actorId } })).toBe(0);
  });

  it("rechaza una versión obsoleta sin sobrescribir ni duplicar bitácora", async () => {
    const version = await versionDe("iva_porcentaje");
    expect((await editar({ clave: "iva_porcentaje", valor: "10", version })).status).toBe(200);
    const respuesta = await editar({ clave: "iva_porcentaje", valor: "12", version });
    expect(respuesta.status).toBe(409);
    expect((await respuesta.json()).error.codigo).toBe("CONFLICTO_EDICION");
    expect((await prisma.configuracion.findUniqueOrThrow({ where: { clave: "iva_porcentaje" } })).valor).toBe("10");
    expect(await prisma.bitacora.count({ where: { entidad: "CONFIGURACION", usuarioId: actorId } })).toBe(1);
  });

  it("acepta solo una edición concurrente con la misma versión", async () => {
    const version = await versionDe("iva_porcentaje");
    const respuestas = await Promise.all(["10", "12"].map((valor) => editar({ clave: "iva_porcentaje", valor, version })));
    expect(respuestas.map((respuesta) => respuesta.status).sort()).toEqual([200, 409]);
    expect(await prisma.bitacora.count({ where: { entidad: "CONFIGURACION", usuarioId: actorId } })).toBe(1);
  });

  it("rechaza parámetros inexistentes, valores numéricos y versiones ausentes", async () => {
    const version = await versionDe("iva_porcentaje");
    expect((await editar({ clave: "inexistente", valor: "10", version })).status).toBe(404);
    expect((await editar({ clave: "iva_porcentaje", valor: 10, version })).status).toBe(422);
    const respuesta = await PATCH(solicitud({ metodo: "PATCH", cookie: cookieAdmin, cuerpo: { clave: "iva_porcentaje", valor: "10" } }));
    expect(respuesta.status).toBe(422);
  });

  it("revierte el valor y la versión cuando falla la bitácora", async () => {
    const actor = await obtenerSesionDeRequest(solicitud({ cookie: cookieAdmin }));
    expect(actor).not.toBeNull();
    const actual = await prisma.configuracion.findUniqueOrThrow({ where: { clave: "iva_porcentaje" } });
    const registrar = vi.spyOn(bitacora, "registrarEvento").mockRejectedValueOnce(new Error("Fallo de bitácora"));
    try {
      await expect(editarConfiguracion({
        clave: actual.clave, valor: "10", version: actual.actualizadoEn.toISOString(),
      }, actor!)).rejects.toThrow("Fallo de bitácora");
      expect(await prisma.configuracion.findUniqueOrThrow({ where: { clave: actual.clave } })).toEqual(actual);
      expect(await prisma.bitacora.count({ where: { entidad: "CONFIGURACION", usuarioId: actorId } })).toBe(0);
    } finally {
      registrar.mockRestore();
    }
  });
});
