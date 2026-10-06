import { randomUUID } from "node:crypto";

import type { Actor } from "@/core/autorizacion";
import type { PerfilCodigo } from "@/core/permisos";
import type { PrismaClient } from "@/generated/prisma/client";
import type { ProductoDto } from "@/modules/catalogo/tipos";

import { cargarAuth, crearUsuarioPrueba, iniciarSesionPrueba, peticion } from "../helpers/auth";

export type ModuloCatalogo = Awaited<ReturnType<typeof cargarModuloCatalogo>>;
export type Sesion = { cookie: string; actor: Actor };
export async function cargarModuloCatalogo() {
  const auth = await cargarAuth();
  return { auth,
    productos: await import("@/app/api/v1/productos/route"), ficha: await import("@/app/api/v1/productos/[id]/route"),
    archivar: await import("@/app/api/v1/productos/[id]/archivar/route"), reactivar: await import("@/app/api/v1/productos/[id]/reactivar/route"),
    receta: await import("@/app/api/v1/productos/[id]/receta/route"), categorias: await import("@/app/api/v1/categorias/route"),
    categoria: await import("@/app/api/v1/categorias/[id]/route"), materiales: await import("@/app/api/v1/catalogo/materiales/route"),
    servicio: await import("@/modules/catalogo/service"), recetas: await import("@/modules/catalogo/recetas"),
    servicioCategorias: await import("@/modules/catalogo/categorias"),
  };
}
export async function abrirSesion(db: PrismaClient, modulos: ModuloCatalogo, perfil: PerfilCodigo): Promise<Sesion> {
  const usuario = await crearUsuarioPrueba(db, { perfil });
  const { cookie } = await iniciarSesionPrueba(modulos.auth, usuario.correo);
  const actor = await modulos.auth.sesion.obtenerSesionDeRequest(peticion("GET", "/", { cookie }));
  if (!actor) throw new Error("No se resolvió la sesión de prueba.");
  return { cookie, actor };
}
type Manejador = (req: Request, contexto?: { params?: Promise<Record<string, string>> }) => Promise<Response>;
export async function invocar<T = ProductoDto>(manejador: Manejador, solicitud: Request, id?: string) {
  const respuesta = await manejador(solicitud, id ? { params: Promise.resolve({ id }) } : undefined);
  const cuerpo = await respuesta.json();
  return { status: respuesta.status, datos: cuerpo.datos as T,
    error: cuerpo.error as { codigo: string; campos?: Record<string, string> } | undefined,
    total: cuerpo.total as number, pagina: cuerpo.pagina as number };
}
export function unico(prefijo = "Catálogo") { return `${prefijo}-${randomUUID().slice(0, 12)}`; }
export function cuerpoProducto(categoriaId: string, extra: Record<string, unknown> = {}) {
  return { codigo: unico("P"), nombre: unico(), categoriaId, unidadCobro: "UNIDAD" as const, precioBase: "100.00", ...extra };
}
export async function crearProductoDirecto(db: PrismaClient, categoriaId: string, extra: Record<string, unknown> = {}) {
  return db.producto.create({ data: cuerpoProducto(categoriaId, extra) });
}
export function crearMaterial(db: PrismaClient, activo = true) {
  return db.material.create({ data: { codigo: unico("M"), nombre: unico("Material"), unidad: "M2", costoPromedio: "12.3456", activo } });
}
export async function conPermisoRevocado(db: PrismaClient, condicion: { perfil: PerfilCodigo; permiso: string }, prueba: () => Promise<void>) {
  const [recurso, accion] = condicion.permiso.split(":");
  const fila = await db.perfilPermiso.findFirstOrThrow({ where: { perfil: { codigo: condicion.perfil }, permiso: { recurso, accion } } });
  const where = { perfilId_permisoId: { perfilId: fila.perfilId, permisoId: fila.permisoId } };
  await db.perfilPermiso.delete({ where });
  try { await prueba(); }
  finally { await db.perfilPermiso.createMany({ data: [fila], skipDuplicates: true }); }
}
