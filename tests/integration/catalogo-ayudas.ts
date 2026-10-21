import type { Actor } from "@/core/autorizacion";
import type { PerfilCodigo } from "@/core/permisos";
import type { PrismaClient } from "@/generated/prisma/client";
import type { ProductoDto } from "@/modules/catalogo/tipos";

import { cargarAuth } from "../helpers/auth";
import {
  abrirSesion as abrirSesionComun, conPermisoRevocado as revocarPermiso,
  invocar as invocarApi, nombreUnico, type Manejador,
} from "../helpers/fabricas";

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
  const { cookie, actor } = await abrirSesionComun(db, {
    auth: modulos.auth, mensajeError: "No se resolvió la sesión de prueba.",
  }, perfil);
  return { cookie, actor };
}
export async function invocar<T = ProductoDto>(manejador: Manejador, solicitud: Request, id?: string) {
  const { status, datos, error, cuerpo } = await invocarApi<T>(manejador, solicitud, id);
  return { status, datos,
    error: error as { codigo: string; campos?: Record<string, string> } | undefined,
    total: cuerpo.total as number, pagina: cuerpo.pagina as number };
}
export function unico(prefijo = "Catálogo") { return nombreUnico(prefijo, { separador: "-", longitud: 12 }); }
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
  await revocarPermiso(db, condicion, prueba);
}
