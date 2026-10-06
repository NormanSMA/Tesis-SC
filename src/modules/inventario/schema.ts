import { z } from "zod";
import { CERO, comparar, leerDecimal } from "@/core/decimal";

export const UNIDADES = ["UNIDAD", "METRO", "M2", "YARDA", "PIE", "LITRO", "GALON", "KILOGRAMO", "LIBRA", "PLIEGO", "ROLLO"] as const;
export const TIPOS_MOVIMIENTO = ["ENTRADA", "CONSUMO", "AJUSTE", "DEVOLUCION"] as const;
const id = z.uuid({ error: "Seleccione un registro válido." });
const version = z.iso.datetime({ offset: true, error: "Falta la versión. Recargue los datos." });
const cantidad = z.string({ error: "Ingrese una cadena decimal." }).regex(/^\d{1,11}(\.\d{1,3})?$/, "Admite hasta 3 decimales.");
const positiva = cantidad.refine((texto) => {
  const valor = leerDecimal(texto);
  return valor !== null && comparar(valor, CERO) > 0;
}, "La cantidad debe ser mayor que cero.");
const costo = z.string({ error: "Ingrese una cadena decimal." }).regex(/^\d{1,10}(\.\d{1,4})?$/, "Admite hasta 4 decimales.");
const descripcion = z.string().trim().max(10000).transform((texto) => texto || null).nullable();
const camposMaterial = {
  nombre: z.string().trim().min(1, "Ingrese el nombre.").max(160),
  descripcion: descripcion.optional(), stockMinimo: cantidad.default("0"), costoPromedio: costo.default("0"),
};
export const esquemaCrearMaterial = z.strictObject({
  codigo: z.string().trim().min(1, "Ingrese el código.").max(30), unidad: z.enum(UNIDADES), ...camposMaterial,
});
export const esquemaEditarMaterial = z.strictObject({ version,
  nombre: camposMaterial.nombre.optional(), descripcion: descripcion.optional(),
  stockMinimo: cantidad.optional(), costoPromedio: costo.optional(),
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
  activo: z.enum(["true", "false", "todos"]).default("true"),
  bajoMinimo: z.enum(["true", "false"]).default("false"), ...paginacion,
});
export const esquemaConsultaMovimientos = z.object({ material: id.optional(), tipo: z.enum(TIPOS_MOVIMIENTO).optional(),
  orden: id.optional(), usuario: id.optional(), desde: z.iso.date().optional(), hasta: z.iso.date().optional(), ...paginacion,
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
