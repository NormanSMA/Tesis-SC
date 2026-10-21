import { randomUUID } from "node:crypto";

import type { Actor } from "@/core/autorizacion";
import type { PerfilCodigo } from "@/core/permisos";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { CrearMaterial } from "@/modules/inventario/schema";

import type { ModulosAuth } from "./auth";
import { nombreBaseDeDatos, urlPropietario } from "./entorno-bd";

export type Sesion = { usuarioId: string; cookie: string; actor: Actor };
export type RespuestaApi<T = unknown> = {
  status: number;
  datos: T;
  error?: { codigo: string; mensaje: string; campos?: Record<string, string> };
  cuerpo: Record<string, unknown>;
};
export type Manejador = (req: Request, contexto?: { params?: Promise<Record<string, string>> }) => Promise<Response>;

export async function abrirSesion(
  db: PrismaClient,
  modulos: { auth: ModulosAuth; mensajeError?: string },
  perfil: PerfilCodigo,
): Promise<Sesion> {
  const { crearUsuarioPrueba, iniciarSesionPrueba, peticion } = await import("./auth");
  const usuario = await crearUsuarioPrueba(db, { perfil });
  const { cookie } = await iniciarSesionPrueba(modulos.auth, usuario.correo);
  const actor = await modulos.auth.sesion.obtenerSesionDeRequest(peticion("GET", "/", { cookie }));
  if (!actor) throw new Error(modulos.mensajeError ?? "La sesión de prueba no se resolvió.");
  return { usuarioId: usuario.id, cookie, actor };
}

export async function invocar<T = unknown>(
  manejador: Manejador,
  solicitud: Request,
  id?: string,
): Promise<RespuestaApi<T>> {
  const respuesta = await manejador(solicitud, id ? { params: Promise.resolve({ id }) } : undefined);
  const cuerpo = (await respuesta.json()) as Record<string, unknown>;
  return { status: respuesta.status, datos: cuerpo.datos as T, error: cuerpo.error as RespuestaApi["error"], cuerpo };
}

export function nombreUnico(prefijo: string, opciones: { separador?: string; longitud?: number } = {}): string {
  return `${prefijo}${opciones.separador ?? " "}${randomUUID().slice(0, opciones.longitud ?? 8)}`;
}

export function crearClienteBase(cambios: Partial<Prisma.ClienteCreateInput> = {}) {
  return { nombre: nombreUnico("Cliente"), tipo: "EMPRESA" as const, telefono: "8888 0000", ...cambios };
}

export function crearCategoriaBase(cambios: Partial<Prisma.CategoriaCreateInput> = {}) {
  return { nombre: nombreUnico("Categoría de prueba"), ...cambios };
}

export function crearMaterialBase(cambios: Partial<CrearMaterial> = {}): CrearMaterial {
  return { codigo: nombreUnico("MAT"), nombre: nombreUnico("Material"), unidad: "UNIDAD",
    stockMinimo: "0", costoPromedio: "10", ...cambios };
}

export function crearAreaBase(cambios: Partial<Prisma.AreaCreateInput> = {}) {
  return { nombre: nombreUnico("Área"), ...cambios };
}

export async function conPermisoRevocado<T>(
  db: PrismaClient,
  { perfil, permiso }: { perfil: PerfilCodigo; permiso: string },
  prueba: () => Promise<T>,
): Promise<T> {
  const [recurso, accion] = permiso.split(":");
  const fila = await db.perfilPermiso.findFirstOrThrow({
    where: { perfil: { codigo: perfil }, permiso: { recurso, accion } },
  });
  await db.perfilPermiso.delete({ where: { perfilId_permisoId: { perfilId: fila.perfilId, permisoId: fila.permisoId } } });
  try {
    return await prueba();
  } finally {
    await db.perfilPermiso.createMany({ data: [fila], skipDuplicates: true });
  }
}

export function exigirBaseTest(): void {
  if (!nombreBaseDeDatos(urlPropietario()).endsWith("_test")) throw new Error("Use una base terminada en _test.");
}
