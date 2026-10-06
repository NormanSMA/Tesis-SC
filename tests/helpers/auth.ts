import { randomUUID } from "node:crypto";
import { vi } from "vitest";

import type { PerfilCodigo } from "@/core/permisos";
import type { PrismaClient } from "@/generated/prisma/client";
import { hashearContrasena } from "@/lib/auth/password";

import { urlApp } from "./entorno-bd";

export const CLAVE_PRUEBA = "Clave-de-prueba-123";
export const ORIGEN = "http://localhost";

const globales = globalThis as unknown as { prisma?: { $disconnect(): Promise<void> } };

export async function liberarClienteGlobal() {
  await globales.prisma?.$disconnect();
  delete globales.prisma;
}

// src/lib/db.ts toma DATABASE_URL al importarse: hay que apuntarla a la base de pruebas antes de cargar las rutas.
export async function cargarAuth() {
  await liberarClienteGlobal();
  vi.resetModules();
  vi.stubEnv("DATABASE_URL", urlApp());
  return {
    login: await import("@/app/api/v1/auth/login/route"),
    yo: await import("@/app/api/v1/auth/yo/route"),
    logout: await import("@/app/api/v1/auth/logout/route"),
    http: await import("@/lib/http"),
    sesion: await import("@/lib/auth/sesion"),
  };
}

export type ModulosAuth = Awaited<ReturnType<typeof cargarAuth>>;

type OpcionesUsuario = { perfil?: PerfilCodigo; activo?: boolean; contrasena?: string };

export async function crearUsuarioPrueba(db: PrismaClient, opciones: OpcionesUsuario = {}) {
  const perfil = await db.perfil.findUniqueOrThrow({ where: { codigo: opciones.perfil ?? "VENTAS" } });
  return db.usuario.create({
    data: {
      nombre: "Usuario de prueba",
      correo: `auth-${randomUUID()}@example.com`,
      hashContrasena: await hashearContrasena(opciones.contrasena ?? CLAVE_PRUEBA),
      perfilId: perfil.id,
      activo: opciones.activo ?? true,
    },
  });
}

type OpcionesPeticion = { cuerpo?: unknown; cookie?: string; origen?: string | null };

export function peticion(metodo: string, ruta: string, opciones: OpcionesPeticion = {}): Request {
  const encabezados: Record<string, string> = {};
  if (opciones.origen !== null) encabezados.origin = opciones.origen ?? ORIGEN;
  if (opciones.cookie) encabezados.cookie = opciones.cookie;
  if (opciones.cuerpo !== undefined) encabezados["content-type"] = "application/json";
  return new Request(`${ORIGEN}${ruta}`, {
    method: metodo,
    headers: encabezados,
    body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
  });
}

// Devuelve "nombre=valor" para reenviarlo como encabezado Cookie.
export function cookieDeRespuesta(respuesta: Response): string {
  return (respuesta.headers.get("set-cookie") ?? "").split(";")[0];
}

export async function iniciarSesionPrueba(modulos: ModulosAuth, correo: string, contrasena = CLAVE_PRUEBA) {
  const respuesta = await modulos.login.POST(
    peticion("POST", "/api/v1/auth/login", { cuerpo: { correo, contrasena } }),
  );
  return { respuesta, cookie: cookieDeRespuesta(respuesta) };
}
