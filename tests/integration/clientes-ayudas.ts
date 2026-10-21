import type { PerfilCodigo } from "@/core/permisos";
import type { EstadoCotizacion } from "@/generated/prisma/enums";
import type { PrismaClient } from "@/generated/prisma/client";

import { cargarAuth, type ModulosAuth } from "../helpers/auth";
import {
  abrirSesion as abrirSesionComun, invocar as invocarApi, nombreUnico as crearNombreUnico,
  crearCategoriaBase, crearClienteBase, type Manejador, type RespuestaApi, type Sesion,
} from "../helpers/fabricas";

export { conPermisoRevocado } from "../helpers/fabricas";
export type { RespuestaApi, Sesion } from "../helpers/fabricas";

export type ModuloClientes = Awaited<ReturnType<typeof cargarModuloClientes>>;

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
  return abrirSesionComun(db, modulos, perfil);
}

export async function invocar<T = Record<string, unknown>>(
  manejador: Manejador,
  solicitud: Request,
  id?: string,
): Promise<RespuestaApi<T>> {
  return invocarApi<T>(manejador, solicitud, id);
}

export function nombreUnico(prefijo = "Cliente"): string {
  return crearNombreUnico(prefijo);
}

export function cuerpoCliente(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return crearClienteBase(extra);
}

export async function crearCategoriaPrueba(db: PrismaClient): Promise<string> {
  return (await db.categoria.create({ data: crearCategoriaBase() })).id;
}

export async function crearClienteDirecto(db: PrismaClient, extra: Record<string, unknown> = {}) {
  return db.cliente.create({ data: crearClienteBase(extra) });
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
  AJUSTE_SOLICITADO: ["ENVIADA", "AJUSTE_SOLICITADO"],
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
          : {
              estado,
              fechaRespuesta: new Date(),
              ...(estado === "APROBADA"
                ? { usuarioAprobacionId: datos.usuarioId, referenciaAprobacion: "Correo del cliente" }
                : {}),
              ...(estado === "AJUSTE_SOLICITADO" ? { motivoAjuste: "El cliente pidió cambios" } : {}),
            },
    });
  }
  return cotizacion;
}

type DatosOrden = { cotizacionId: string; categoriaId: string; responsableId: string };

export async function crearOrdenPrueba(db: PrismaClient, datos: DatosOrden) {
  const { clienteId } = await db.cotizacion.findUniqueOrThrow({ where: { id: datos.cotizacionId }, select: { clienteId: true } });
  return db.ordenTrabajo.create({
    data: {
      numero: await siguienteNumero(db, "ORDEN_TRABAJO"),
      cotizacionId: datos.cotizacionId,
      clienteId,
      categoriaId: datos.categoriaId,
      responsableId: datos.responsableId,
      creadoPorId: datos.responsableId,
      fechaEntrega: diasDesdeHoy(10),
    },
  });
}

