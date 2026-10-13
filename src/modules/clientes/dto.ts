import type { Cliente } from "@/generated/prisma/client";

import type {
  ClienteDto,
  ClienteFila,
  CotizacionDeCliente,
  EventoActividad,
  TrabajoDeCliente,
} from "./tipos";

type FilaCotizacion = {
  id: string;
  numero: string;
  moneda: string;
  asunto: string | null;
  estado: string;
  total: { toFixed(decimales: number): string };
  fechaEmision: Date | null;
  creadoEn: Date;
};

type FilaOrden = { id: string; numero: string; estado: string; fechaEntrega: Date };

type FilaEvento = {
  id: string;
  accion: string;
  creadoEn: Date;
  estadoAnterior: string | null;
  estadoNuevo: string | null;
  detalle: unknown;
  usuario: { nombre: string };
};

const formateadorCalendario = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Managua" });

function calendarioIso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function aClienteDto(cliente: Cliente): ClienteDto {
  return {
    id: cliente.id,
    codigoCliente: cliente.codigoCliente,
    nombre: cliente.nombre,
    tipo: cliente.tipo,
    ruc: cliente.ruc,
    contactoPrincipal: cliente.contactoPrincipal,
    telefono: cliente.telefono,
    correo: cliente.correo,
    direccion: cliente.direccion,
    notas: cliente.notas,
    activo: cliente.activo,
    creadoEn: cliente.creadoEn.toISOString(),
    actualizadoEn: cliente.actualizadoEn.toISOString(),
  };
}

export function aClienteFila(cliente: Cliente, cotizaciones: number | undefined): ClienteFila {
  const fila: ClienteFila = {
    id: cliente.id,
    codigoCliente: cliente.codigoCliente,
    nombre: cliente.nombre,
    tipo: cliente.tipo,
    ruc: cliente.ruc,
    contactoPrincipal: cliente.contactoPrincipal,
    telefono: cliente.telefono,
    correo: cliente.correo,
    activo: cliente.activo,
  };
  if (cotizaciones !== undefined) fila.cotizaciones = cotizaciones;
  return fila;
}

export function aCotizacionDeCliente(cotizacion: FilaCotizacion): CotizacionDeCliente {
  return {
    id: cotizacion.id,
    numero: cotizacion.numero,
    asunto: cotizacion.asunto,
    estado: cotizacion.estado,
    total: cotizacion.total.toFixed(2),
    moneda: cotizacion.moneda,
    // El CHECK de la base deja informar fechaEmision en un borrador: ahí manda la fecha de creación.
    fecha:
      cotizacion.estado !== "BORRADOR" && cotizacion.fechaEmision
        ? calendarioIso(cotizacion.fechaEmision)
        : formateadorCalendario.format(cotizacion.creadoEn),
  };
}

export function aTrabajoDeCliente(orden: FilaOrden): TrabajoDeCliente {
  return {
    id: orden.id,
    numero: orden.numero,
    estado: orden.estado,
    fechaEntrega: calendarioIso(orden.fechaEntrega),
  };
}

export function aEventoActividad(evento: FilaEvento): EventoActividad {
  const detalle = typeof evento.detalle === "object" && evento.detalle !== null ? evento.detalle : {};
  return {
    id: evento.id,
    accion: evento.accion,
    instante: evento.creadoEn.toISOString(),
    actor: evento.usuario.nombre,
    estadoAnterior: evento.estadoAnterior,
    estadoNuevo: evento.estadoNuevo,
    detalle: detalle as Record<string, unknown>,
  };
}
