import { z } from "zod";

export const ESTADOS = ["PENDIENTE", "EN_PRODUCCION", "LISTA", "ENTREGADA", "CERRADA", "CANCELADA"] as const;
export const version = z.iso.datetime({ offset: true, error: "Falta la versión de la orden. Recargue los datos." });
const id = z.uuid({ error: "Seleccione un registro válido." });
const fecha = z.iso.date({ error: "Ingrese una fecha válida con formato AAAA-MM-DD." });
const especificaciones = z.string().trim().max(10000, "Admite hasta 10000 caracteres.")
  .transform((texto) => texto || null).nullable();

export const esquemaCrearOrden = z.object({
  cotizacionId: id, categoriaId: id, responsableId: id.nullable().optional(), fechaEntrega: fecha,
  especificaciones: especificaciones.optional(),
});
export const esquemaEditarOrden = z.object({
  version, responsableId: id.nullable().optional(), fechaEntrega: fecha.optional(),
  especificaciones: especificaciones.optional(),
});
export const esquemaCambioEstado = z.object({ version });
export const esquemaCancelarOrden = z.object({
  version, motivo: z.string().trim().min(5, "Indique un motivo de al menos 5 caracteres.").max(10000),
});
export const esquemaConsultaOrdenes = z.object({
  q: z.string().trim().max(200).optional(), estado: z.enum(ESTADOS).optional(),
  responsable: z.union([id, z.literal("sin-responsable")]).optional(), cliente: id.optional(),
  vencidas: z.enum(["true", "false"]).default("false"),
  terminales: z.enum(["true", "false", "todas"]).default("false"),
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
});

export function objetoDeParametros(parametros: URLSearchParams | Record<string, string | string[] | undefined>) {
  const pares = parametros instanceof URLSearchParams ? [...parametros.entries()] : Object.entries(parametros);
  return Object.fromEntries(pares.map(([clave, valor]) => [clave, Array.isArray(valor) ? valor[0]?.trim() : valor?.trim()])
    .filter(([, valor]) => Boolean(valor)));
}

export type EntradaCrearOrden = z.output<typeof esquemaCrearOrden>;
export type EntradaEditarOrden = z.output<typeof esquemaEditarOrden>;
export type EntradaCancelarOrden = z.output<typeof esquemaCancelarOrden>;
export type ConsultaOrdenes = z.output<typeof esquemaConsultaOrdenes>;
