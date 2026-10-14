import { z } from "zod";

import { MONEDAS } from "@/core/moneda";

export const ESTADOS = ["BORRADOR", "ENVIADA", "APROBADA", "RECHAZADA", "VENCIDA", "AJUSTE_SOLICITADO"] as const;
export const CONDICIONES_PREDETERMINADAS = "Precios expresados en la moneda de la cotización. La producción inicia después de aprobar la cotización.";
export const version = z.iso.datetime({ offset: true, error: "Falta la versión de la cotización. Recargue los datos." });
const id = z.uuid({ error: "Seleccione un registro válido." });
const texto = z.string().trim().min(1, "Es obligatorio.");
const textoCorto = texto.max(200, "Admite hasta 200 caracteres.");
const decimal = z.string({ error: "Ingrese una cadena decimal con punto." });
const descuentoPct = z.string({ error: "Ingrese una cadena decimal con punto." })
  .regex(/^(100(\.0{1,2})?|\d{1,2}(\.\d{1,2})?)$/, "Ingrese un porcentaje de 0 a 100 con hasta 2 decimales.");
const medidas ={ ancho: decimal.nullish(), alto: decimal.nullish() };
const vigenciaDias = z.number().int().min(1, "Debe ser mayor que 0.").max(36500, "Admite hasta 36500 días.");
const condiciones = z.string().trim().max(2000, "Admite hasta 2000 caracteres.").nullable();

export const esquemaCrearCotizacion = z.object({
  clienteId: id,
  asunto: texto.max(200, "El asunto admite hasta 200 caracteres."),
  condiciones: condiciones.optional(),
  moneda: z.enum(MONEDAS, { error: "Indique NIO o USD." }).optional(),
});
export const esquemaEditarCotizacion = z.object({
  version,
  asunto: texto.max(200).optional(),
  condiciones: condiciones.optional(),
  descuento: decimal.optional(),
  descuentoPct: descuentoPct.nullable().optional(),
  vigenciaDias: vigenciaDias.optional(),
}).superRefine((entrada, contexto) => {
  if (entrada.descuento !== undefined && entrada.descuentoPct != null) {
    contexto.addIssue({ code: "custom", path: ["descuentoPct"], message: "Envíe el descuento como monto o como porcentaje, no ambos." });
  }
});
export const esquemaCambioEstado = z.object({ version });
export const esquemaResponder = z.object({
  version,
  resultado: z.enum(["APROBADA", "RECHAZADA", "VENCIDA", "AJUSTE_SOLICITADO"]),
  motivo: z.string().trim().max(500, "Admite hasta 500 caracteres.").optional(),
  referenciaAprobacion: z.string().trim().min(3, "Ingrese al menos 3 caracteres.").max(200).optional(),
  motivoAjuste: z.string().trim().min(3, "Ingrese al menos 3 caracteres.").max(500).optional(),
}).superRefine((entrada, contexto) => {
  if (entrada.resultado === "RECHAZADA" && !entrada.motivo) {
    contexto.addIssue({ code: "custom", path: ["motivo"], message: "Indique el motivo del rechazo." });
  }
  if (entrada.resultado === "APROBADA" && !entrada.referenciaAprobacion) {
    contexto.addIssue({ code: "custom", path: ["referenciaAprobacion"], message: "Indique la referencia de aprobación." });
  }
  if (entrada.resultado === "AJUSTE_SOLICITADO" && !entrada.motivoAjuste) {
    contexto.addIssue({ code: "custom", path: ["motivoAjuste"], message: "Indique el motivo del ajuste." });
  }
});

const baseLinea = { lineaId: id.optional(), descripcion: textoCorto, unidad: texto.max(20) };
export const esquemaLinea = z.discriminatedUnion("tipo", [
  z.object({ ...baseLinea, tipo: z.literal("MATERIAL"), materialId: id.nullish(), cantidad: decimal,
    costoUnitario: decimal.optional(), mermaPct: decimal }),
  z.object({ ...baseLinea, tipo: z.literal("MANO_OBRA"), horas: decimal, tarifa: decimal }),
  z.object({ ...baseLinea, tipo: z.literal("TERCERO"), costo: decimal }),
]);
const baseItem = { itemId: id.optional(), actualizarPrecio: z.boolean().optional(), cantidad: decimal, ...medidas };
export const esquemaItem = z.discriminatedUnion("tipo", [
  z.object({ ...baseItem, tipo: z.literal("CATALOGO"), productoId: id }),
  z.object({ ...baseItem, tipo: z.literal("PERSONALIZADO"), categoriaId: id, descripcion: textoCorto,
    unidadCobro: z.enum(["UNIDAD", "M2"]), margenPct: decimal, lineas: z.array(esquemaLinea).min(1).max(100) }),
]);
export const esquemaReemplazarItems = z.object({ version, items: z.array(esquemaItem).max(200) })
  .superRefine((entrada, contexto) => {
    const usados = new Set<string>();
    entrada.items.forEach((item, indice) => {
      if (item.itemId && usados.has(item.itemId)) {
        contexto.addIssue({ code: "custom", path: ["items", indice, "itemId"], message: "El ítem está repetido." });
      }
      if (item.itemId) usados.add(item.itemId);
    });
  });

export const esquemaConsultaCotizaciones = z.object({
  q: z.string().max(200).optional(),
  estado: z.enum(ESTADOS).optional(),
  cliente: id.optional(),
  archivadas: z.enum(["true", "false", "todas"]).default("false"),
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
});
export function objetoDeParametros(parametros: URLSearchParams | Record<string, string | string[] | undefined>) {
  const pares = parametros instanceof URLSearchParams ? [...parametros.entries()] : Object.entries(parametros);
  return Object.fromEntries(pares.map(([clave, valor]) => [clave, Array.isArray(valor) ? valor[0]?.trim() : valor?.trim()])
    .filter(([, valor]) => Boolean(valor)));
}

export type EntradaCrearCotizacion = z.output<typeof esquemaCrearCotizacion>;
export type EntradaEditarCotizacion = z.output<typeof esquemaEditarCotizacion>;
export type EntradaResponder = z.output<typeof esquemaResponder>;
export type EntradaReemplazarItems = z.output<typeof esquemaReemplazarItems>;
export type EntradaItem = z.output<typeof esquemaItem>;
export type EntradaLineaEditor = z.output<typeof esquemaLinea>;
export type ConsultaCotizaciones = z.output<typeof esquemaConsultaCotizaciones>;
