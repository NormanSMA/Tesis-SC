import { z } from "zod";
import { AREAS_MATERIAL } from "@/core/areas-material";
import { CERO, comparar, leerDecimal } from "@/core/decimal";
import { esquemaFechaConsulta } from "@/lib/listas/fecha";
import { esquemaOrden } from "@/lib/listas/orden";
import { CAMPOS_ORDEN_MATERIAL, CAMPOS_ORDEN_MOVIMIENTO } from "./campos-orden";

export const UNIDADES = ["UNIDAD", "METRO", "M2", "YARDA", "PIE", "LITRO", "GALON", "KILOGRAMO", "LIBRA", "PLIEGO", "ROLLO"] as const;
export const TIPOS_MOVIMIENTO = ["ENTRADA", "CONSUMO", "AJUSTE", "DEVOLUCION"] as const;
export const TIPOS_PRESENTACION = ["ROLLO", "LAMINA"] as const;
const id = z.uuid({ error: "Seleccione un registro válido." });
const version = z.iso.datetime({ offset: true, error: "Falta la versión. Recargue los datos." });
const cantidad = z.string({ error: "Ingrese una cadena decimal." }).regex(/^\d{1,11}(\.\d{1,3})?$/, "Admite hasta 3 decimales.");
const positiva = cantidad.refine((texto) => {
  const valor = leerDecimal(texto);
  return valor !== null && comparar(valor, CERO) > 0;
}, "La cantidad debe ser mayor que cero.");
const costo = z.string({ error: "Ingrese una cadena decimal." }).regex(/^\d{1,10}(\.\d{1,4})?$/, "Admite hasta 4 decimales.");
const descripcion = z.string().trim().max(10000).transform((texto) => texto || null).nullable();
const dimension = z.string().regex(/^\d{1,4}(\.\d{1,3})?$/, "Ingrese metros con hasta 3 decimales.")
  .refine((texto) => {
    const valor = leerDecimal(texto);
    return valor !== null && comparar(valor, CERO) > 0;
  }, "La dimensión debe ser mayor que cero.");
const presentacion = z.strictObject({
  tipo: z.enum(TIPOS_PRESENTACION), ancho: dimension, largo: dimension,
}).nullable().optional();
const unidadesCotizacion = {
  unidadCotizacion: z.enum(UNIDADES).nullish(),
  areaUnidadInventario: z.string().regex(/^\d{1,8}(\.\d{1,6})?$/, "Ingrese el área en m² con hasta 6 decimales.")
    .refine((valor) => Number(valor) > 0, "Ingrese un área mayor que cero.").nullish(),
};
export function unidadCotizacionValida(datos: { unidad: string; unidadCotizacion?: string | null; areaUnidadInventario?: string | null }) {
  if (!datos.unidadCotizacion || datos.unidadCotizacion === datos.unidad) return datos.areaUnidadInventario == null;
  return datos.unidadCotizacion === "M2" && ["PLIEGO", "ROLLO"].includes(datos.unidad) && datos.areaUnidadInventario != null;
}
const fotoBase64 = z.string().max(700000).regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/).nullable().optional();
const camposMaterial = {
  fotoBase64,
  nombre: z.string().trim().min(1, "Ingrese el nombre.").max(160),
  descripcion: descripcion.optional(), stockMinimo: cantidad.default("0"), costoPromedio: costo.default("0"),
  areaProduccion: z.enum(AREAS_MATERIAL).nullish(),
};
export const esquemaCrearMaterial = z.strictObject({
  codigo: z.string().trim().max(30).default(""), unidad: z.enum(UNIDADES), ...camposMaterial, presentacion, ...unidadesCotizacion,
}).refine(({ unidad, presentacion }) => !presentacion || unidad === "M2", {
  path: ["presentacion", "tipo"], message: "La presentación requiere una unidad de inventario en metros cuadrados.",
}).refine(unidadCotizacionValida, { path: ["unidadCotizacion"], message: "Indique la unidad de inventario o el área de un pliego o rollo." });
export const esquemaEditarMaterial = z.strictObject({ version, fotoBase64,
  nombre: camposMaterial.nombre.optional(), descripcion: descripcion.optional(),
  areaProduccion: camposMaterial.areaProduccion,
  stockMinimo: cantidad.optional(), costoPromedio: costo.optional(), presentacion, ...unidadesCotizacion,
});
export const esquemaVersion = z.strictObject({ version });
export const esquemaEntrada = z.strictObject({ materialId: id, cantidad: positiva, costoUnitario: costo,
  referencia: z.string().trim().max(60).transform((texto) => texto || null).nullable().optional(),
});
export const esquemaAjuste = z.strictObject({ materialId: id, direccion: z.enum(["AUMENTAR", "DISMINUIR"]),
  cantidad: positiva, motivo: z.string().trim().min(5, "Indique un motivo de al menos 5 caracteres.").max(10000),
});
const paginacion = { pagina: z.coerce.number().int().min(1).max(100000).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20) };
export const esquemaConsultaMateriales = z.object({ q: z.string().trim().max(200).optional(),
  area: z.enum([...AREAS_MATERIAL, "SIN_CLASIFICAR"]).optional(),
  activo: z.enum(["true", "false", "todos"]).default("true"),
  bajoMinimo: z.enum(["true", "false"]).default("false"),
  ordenar: esquemaOrden(CAMPOS_ORDEN_MATERIAL).optional(), ...paginacion,
});
export const esquemaConsultaMovimientos = z.object({ material: id.optional(), tipo: z.enum(TIPOS_MOVIMIENTO).optional(),
  orden: id.optional(), usuario: id.optional(), desde: esquemaFechaConsulta.optional(), hasta: esquemaFechaConsulta.optional(),
  ordenar: esquemaOrden(CAMPOS_ORDEN_MOVIMIENTO).optional(), ...paginacion,
}).refine((datos) => !datos.desde || !datos.hasta || datos.desde <= datos.hasta,
  { path: ["hasta"], message: "La fecha final debe ser igual o posterior a la inicial." });
export function objetoDeParametros(parametros: URLSearchParams | Record<string, string | string[] | undefined>) {
  const pares = parametros instanceof URLSearchParams ? [...parametros.entries()] : Object.entries(parametros);
  return Object.fromEntries(pares.map(([clave, valor]) => [clave, Array.isArray(valor) ? valor[0] : valor])
    .filter(([, valor]) => valor !== undefined && valor !== ""));
}
export type CrearMaterial = z.output<typeof esquemaCrearMaterial>;
export type EditarMaterial = z.output<typeof esquemaEditarMaterial>;
export type Entrada = z.output<typeof esquemaEntrada>;
export type Ajuste = z.output<typeof esquemaAjuste>;
export type ConsultaMateriales = z.output<typeof esquemaConsultaMateriales>;
export type ConsultaMovimientos = z.output<typeof esquemaConsultaMovimientos>;
