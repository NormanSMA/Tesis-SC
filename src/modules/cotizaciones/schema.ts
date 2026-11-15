import { esquemaGastos, tieneGastosFijos } from "@/modules/personalizadas/gastos-schema";
import { esquemaSeleccionProducto } from "@/modules/personalizadas/seleccion-schema";
import { z } from "zod";

import { MONEDAS } from "@/core/moneda";
import { esquemaOrden } from "@/lib/listas/orden";

import { CAMPOS_ORDEN_COTIZACION } from "./campos-orden";
import { esquemaPorcentajeTarifa, TARIFAS } from "./tarifas";

export const ESTADOS = ["BORRADOR", "ENVIADA", "APROBADA", "RECHAZADA", "VENCIDA", "AJUSTE_SOLICITADO"] as const;
export const CONDICIONES_PREDETERMINADAS = "Precios expresados en la moneda de la cotización. La producción inicia después de aprobar la cotización.";
export const version = z.iso.datetime({ offset: true, error: "Falta la versión de la cotización. Recargue los datos." });
const id = z.uuid({ error: "Seleccione un registro válido." });
const texto = z.string().trim().min(1, "Es obligatorio.");
const textoCorto = texto.max(200, "Admite hasta 200 caracteres.");
const decimal = z.string({ error: "Ingrese una cadena decimal con punto." });
const descuentoPct = esquemaPorcentajeTarifa;
const medidas ={ ancho: decimal.nullish(), alto: decimal.nullish(), profundidad: decimal.nullish() };
const vigenciaDias = z.number().int().min(1, "Debe ser mayor que 0.").max(365, "Admite hasta 365 días.");
const condiciones = z.string().trim().max(2000, "Admite hasta 2000 caracteres.").nullable();
const instalacion = z.object({
  tarifa: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, "Ingrese una tarifa con hasta dos decimales.").nullish(),
  idaVuelta: z.boolean().optional(),
  manoObra: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, "Ingrese un monto con hasta dos decimales.").default("0"),
  destino: z.string().trim().max(120).nullish(),
  km: z.string().regex(/^\d{1,6}(\.\d{1,3})?$/, "Ingrese kilómetros con hasta tres decimales.")
    .refine((valor) => Number(valor) > 0, "Ingrese una distancia mayor que cero.").nullish(),
}).refine(({ km, destino }) => !km || Boolean(destino), { path: ["destino"], message: "Indique el punto de instalación." }).nullish();

const datosComerciales = {
  mostrarCondiciones: z.boolean().optional(),
  tarifa: z.enum(TARIFAS).optional(),
  descuentoManual: z.boolean().optional(),
  descuento: decimal.optional(),
  descuentoPct: descuentoPct.nullable().optional(),
  instalacion,
};

const cabeceraCreacion = z.object({
  clienteId: id,
  asunto: texto.max(200, "El asunto admite hasta 200 caracteres."),
  condiciones: condiciones.optional(),
  moneda: z.enum(MONEDAS, { error: "Indique NIO o USD." }).optional(),
  ...datosComerciales,
});
export const esquemaEditarCotizacion = z.object({
  version,
  asunto: texto.max(200).optional(),
  condiciones: condiciones.optional(),
  ...datosComerciales,
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

const baseLinea = { esGastoPersonalizado: z.boolean().optional(), lineaId: id.optional(), descripcion: textoCorto, unidad: texto.max(20) };
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
    unidadCobro: z.enum(["UNIDAD", "M2"]), margenPct: decimal, productoPersonalizado: esquemaSeleccionProducto.nullish(), gastosPersonalizados: esquemaGastos.nullish(), lineas: z.array(esquemaLinea).max(100) }),
]).superRefine((item, ctx) => {
  if (item.tipo === "PERSONALIZADO" && !item.lineas.length && !tieneGastosFijos(item.gastosPersonalizados)) ctx.addIssue({ code: "custom", path: ["lineas"], message: "Seleccione materiales del producto o registre horas de trabajo u otro costo para calcular el precio." });
});
export const esquemaCrearCotizacion = cabeceraCreacion.extend({ items: z.array(esquemaItem).max(200).optional() })
  .refine((entrada) => entrada.descuento === undefined || entrada.descuentoPct == null,
    { path: ["descuentoPct"], message: "Envíe el descuento como monto o como porcentaje, no ambos." });
export const esquemaReemplazarItems = z.object({ version, items: z.array(esquemaItem).max(200) })
  .superRefine((entrada, contexto) => {
    const usados = new Set<string>();
    entrada.items.forEach((item, indice) => {
      if (item.itemId && usados.has(item.itemId)) {
        contexto.addIssue({ code: "custom", path: ["items", indice, "itemId"], message: "El producto está repetido." });
      }
      if (item.itemId) usados.add(item.itemId);
    });
  });

export const esquemaConsultaCotizaciones = z.object({
  q: z.string().max(200).optional(),
  estado: z.enum(ESTADOS).optional(),
  orden: esquemaOrden(CAMPOS_ORDEN_COTIZACION).optional(),
  porVencer: z.enum(["true"]).optional(),
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
export type ConsultaCotizaciones = z.output<typeof esquemaConsultaCotizaciones> & { autorId?: string };
