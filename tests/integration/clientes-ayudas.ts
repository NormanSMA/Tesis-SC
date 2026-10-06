import { randomUUID } from "node:crypto";

import type { Actor } from "@/core/autorizacion";
import type { PerfilCodigo } from "@/core/permisos";
import type { EstadoCotizacion } from "@/generated/prisma/enums";
import type { PrismaClient } from "@/generated/prisma/client";

import { cargarAuth, crearUsuarioPrueba, iniciarSesionPrueba, peticion, type ModulosAuth } from "../helpers/auth";

export type ModuloClientes = Awaited<ReturnType<typeof cargarModuloClientes>>;

export type Sesion = { usuarioId: string; cookie: string; actor: Actor };

export type RespuestaApi<T = unknown> = {
  status: number;
  datos: T;
  error?: { codigo: string; mensaje: string; campos?: Record<string, string> };
  cuerpo: Record<string, unknown>;
};

type Manejador = (req: Request, contexto?: { params?: Promise<Record<string, string>> }) => Promise<Response>;

// src/lib/db.ts toma DATABASE_URL al importarse: las rutas se cargan después de apuntarla a la base de pruebas.
export async function cargarModuloClientes() {
  const auth: ModulosAuth = await cargarAuth();
  return {
    auth,
    lista: await import("@/app/api/v1/clientes/route"),
    ficha: await import("@/app/api/v1/clientes/[id]/route"),
    archivar: await import("@/app/api/v1/clientes/[id]/archivar/route"),
    reactivar: await import("@/app/api/v1/clientes/[id]/reactivar/route"),
    servicio: await import("@/modules/clientes/service"),
  };
}

export async function abrirSesion(db: PrismaClient, modulos: ModuloClientes, perfil: PerfilCodigo): Promise<Sesion> {
  const usuario = await crearUsuarioPrueba(db, { perfil });
  const { cookie } = await iniciarSesionPrueba(modulos.auth, usuario.correo);
  const actor = await modulos.auth.sesion.obtenerSesionDeRequest(peticion("GET", "/", { cookie }));
  if (!actor) throw new Error("La sesión de prueba no se resolvió.");
  return { usuarioId: usuario.id, cookie, actor };
}

export async function invocar<T = Record<string, unknown>>(
  manejador: Manejador,
  solicitud: Request,
  id?: string,
): Promise<RespuestaApi<T>> {
  const respuesta = await manejador(solicitud, id ? { params: Promise.resolve({ id }) } : undefined);
  const cuerpo = (await respuesta.json()) as Record<string, unknown>;
  return {
    status: respuesta.status,
    datos: cuerpo.datos as T,
    error: cuerpo.error as RespuestaApi["error"],
    cuerpo,
  };
}

export function nombreUnico(prefijo = "Cliente"): string {
  return `${prefijo} ${randomUUID().slice(0, 8)}`;
}

export function cuerpoCliente(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { nombre: nombreUnico(), tipo: "EMPRESA", telefono: "8888 0000", ...extra };
}

export async function crearCategoriaPrueba(db: PrismaClient): Promise<string> {
  return (await db.categoria.create({ data: { nombre: nombreUnico("Categoría de prueba") } })).id;
}

export async function crearClienteDirecto(db: PrismaClient, extra: Record<string, unknown> = {}) {
  return db.cliente.create({
    data: { nombre: nombreUnico(), tipo: "EMPRESA", telefono: "8888 0000", ...extra },
  });
}

type DatosCotizacion = {
  clienteId: string;
  usuarioId: string;
  categoriaId: string;
  estado?: EstadoCotizacion;
  total?: string;
  asunto?: string;
};

const CAMINO_ESTADO: Record<EstadoCotizacion, EstadoCotizacion[]> = {
  BORRADOR: [],
  ENVIADA: ["ENVIADA"],
  APROBADA: ["ENVIADA", "APROBADA"],
  RECHAZADA: ["ENVIADA", "RECHAZADA"],
  VENCIDA: ["ENVIADA", "VENCIDA"],
};

function diasDesdeHoy(dias: number): Date {
  const fecha = new Date();
  fecha.setUTCHours(0, 0, 0, 0);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha;
}

async function siguienteNumero(db: PrismaClient, tipo: "COTIZACION" | "ORDEN_TRABAJO"): Promise<string> {
  const filas = await db.$queryRaw<{ numero: string }[]>`SELECT siguiente_numero(${tipo}::tipo_documento) AS numero`;
  return filas[0].numero;
}

// Crea la cotización en BORRADOR con un ítem y la lleva al estado pedido por las transiciones válidas.
export async function crearCotizacionPrueba(db: PrismaClient, datos: DatosCotizacion) {
  const total = datos.total ?? "100.00";
  const cotizacion = await db.cotizacion.create({
    data: {
      numero: await siguienteNumero(db, "COTIZACION"),
      clienteId: datos.clienteId,
      asunto: datos.asunto ?? "Trabajo de prueba",
      tasaImpuesto: 0,
      subtotal: total,
      impuesto: 0,
      total,
      vigenciaDias: 15,
      creadoPorId: datos.usuarioId,
      items: {
        create: {
          secuencia: 1,
          tipo: "PERSONALIZADO",
          categoriaId: datos.categoriaId,
          descripcion: "Ítem de prueba",
          unidadCobro: "UNIDAD",
          cantidad: 1,
          precioUnitario: total,
          costoTotal: 0,
          margenPct: 0,
          importe: total,
        },
      },
    },
  });
  for (const estado of CAMINO_ESTADO[datos.estado ?? "BORRADOR"]) {
    await db.cotizacion.update({
      where: { id: cotizacion.id },
      data:
        estado === "ENVIADA"
          ? { estado, fechaEmision: diasDesdeHoy(-3), fechaVencimiento: diasDesdeHoy(12) }
          : { estado, fechaRespuesta: new Date() },
    });
  }
  return cotizacion;
}

type DatosOrden = { cotizacionId: string; categoriaId: string; responsableId: string };

export async function crearOrdenPrueba(db: PrismaClient, datos: DatosOrden) {
  return db.ordenTrabajo.create({
    data: {
      numero: await siguienteNumero(db, "ORDEN_TRABAJO"),
      cotizacionId: datos.cotizacionId,
      categoriaId: datos.categoriaId,
      responsableId: datos.responsableId,
      creadoPorId: datos.responsableId,
      fechaEntrega: diasDesdeHoy(10),
    },
  });
}

// Quita un permiso de la matriz de un perfil y lo restituye siempre, incluso si la prueba falla.
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
