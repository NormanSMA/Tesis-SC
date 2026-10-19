import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

import { POST as iniciarSesion } from "@/app/api/v1/auth/login/route";
import { GET } from "@/app/api/v1/sistema/route";
import { PERFILES, PERMISOS_POR_PERFIL, type PerfilCodigo } from "@/core/permisos";
import { hashearContrasena } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import { reiniciarMetricas } from "@/lib/metricas";

const origen = "http://127.0.0.1:3000";

function solicitud(cookie: string, ruta = "sistema"): Request {
  return new Request(`${origen}/api/v1/${ruta}`, { headers: { cookie, origin: origen } });
}

async function crearSesionPerfil(codigo: PerfilCodigo): Promise<string> {
  const contrasena = "ClavePruebasSistema2026";
  const definicion = PERFILES.find((perfil) => perfil.codigo === codigo)!;
  const perfil = await prisma.perfil.upsert({ where: { codigo }, create: definicion, update: {} });
  for (const permisoCodigo of PERMISOS_POR_PERFIL[codigo]) {
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
      nombre: `Prueba ${codigo}`, correo: `${randomUUID()}@sistema.test`,
      hashContrasena: await hashearContrasena(contrasena),
      perfiles: { create: { perfilId: perfil.id } },
    },
  });
  const respuesta = await iniciarSesion(new Request(`${origen}/api/v1/auth/login`, {
    method: "POST", headers: { origin: origen, "content-type": "application/json" },
    body: JSON.stringify({ correo: usuario.correo, contrasena }),
  }));
  expect(respuesta.status).toBe(200);
  return respuesta.headers.get("set-cookie")!.split(";")[0];
}

let cookieAdmin: string;
let cookieGerencia: string;

beforeAll(async () => {
  cookieAdmin = await crearSesionPerfil("ADMIN");
  cookieGerencia = await crearSesionPerfil("GERENCIA");
});

describe("API de estado del sistema", () => {
  it("exige sesión", async () => {
    expect((await GET(solicitud(""))).status).toBe(401);
  });

  it("rechaza GERENCIA", async () => {
    expect((await GET(solicitud(cookieGerencia))).status).toBe(403);
  });

  it("devuelve el estado a ADMIN sin datos sensibles", async () => {
    reiniciarMetricas();
    await GET(solicitud(cookieAdmin));
    const respuesta = await GET(solicitud(cookieAdmin));
    expect(respuesta.status).toBe(200);
    const { datos } = await respuesta.json();
    expect(datos.estado).toBe("OPERATIVO");
    expect(datos.baseDatos).toMatchObject({ disponible: true, latenciaMs: expect.any(Number), tamanoBytes: expect.any(Number) });
    expect(datos.proceso).toMatchObject({ version: expect.any(String), node: process.version });
    expect(datos.proceso.memoriaRssBytes).toBeGreaterThan(0);
    expect(datos.accesos24h).toEqual({ iniciosFallidos: expect.any(Number), usuariosBloqueados: expect.any(Number) });
    expect(datos.rendimiento.peticiones).toBeGreaterThanOrEqual(1);
    expect(datos.rendimiento.rutasLentas[0]).toMatchObject({ metodo: "GET", ruta: "/api/v1/sistema" });
    expect(JSON.stringify(datos)).not.toMatch(/cookie|sc_session|hashContrasena/i);
  });
});
