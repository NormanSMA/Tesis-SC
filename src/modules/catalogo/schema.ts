import { z } from "zod";

import { validarItemCatalogo, validarLinea } from "@/core/costeo";

export const CAMPOS_PRODUCTO = ["codigo", "nombre", "descripcion", "categoriaId", "unidadCobro", "precioBase"] as const;
export const CAMPOS_CATEGORIA = ["nombre", "descripcion", "activo"] as const;
export const MENSAJE_VERSION = "Falta la versión. Recargue la página.";
const version = z.iso.datetime({ offset: true, error: MENSAJE_VERSION });
const identificador = z.uuid({ error: "Seleccione un registro válido." });

function textoObligatorio(maximo: number, etiqueta: string) {
  return z.string({ error: `Ingrese ${etiqueta}.` }).trim()
    .min(1, `Ingrese ${etiqueta}.`).max(maximo, `Admite hasta ${maximo} caracteres.`);
}

const descripcion = z.string().nullish().transform((valor) => valor === undefined ? undefined : valor?.trim() || null).optional();
const precioBase = z.string({ error: "Ingrese el precio como cadena decimal." }).superRefine((precio, contexto) => {
  const errores = validarItemCatalogo({ unidadCobro: "UNIDAD", precioBase: precio, cantidad: "1" });
  if (errores.precioBase) contexto.addIssue({ code: "custom", message: errores.precioBase });
});
const cantidad = z.string({ error: "Ingrese la cantidad como cadena decimal." }).superRefine((valor, contexto) => {
  const errores = validarLinea({ tipo: "MATERIAL", cantidad: valor, costoUnitario: "0", mermaPct: "0" });
  if (errores.cantidad) contexto.addIssue({ code: "custom", message: errores.cantidad });
});

const camposProducto = {
  codigo: textoObligatorio(30, "el código"),
  nombre: textoObligatorio(160, "el nombre del producto"),
  descripcion,
  categoriaId: identificador,
  unidadCobro: z.enum(["UNIDAD", "M2"], { error: "Seleccione Unidad o m²." }),
  precioBase,
};
export const esquemaCrearProducto = z.object(camposProducto);
export const esquemaEditarProducto = z.strictObject({
  ...esquemaCrearProducto.partial().shape, version,
});
export const esquemaCambioEstado = z.strictObject({ version });
export const esquemaReceta = z.strictObject({
  version,
  materiales: z.array(z.strictObject({ materialId: identificador, cantidad })).superRefine((materiales, contexto) => {
    const vistos = new Set<string>();
    materiales.forEach((material, indice) => {
      if (vistos.has(material.materialId)) contexto.addIssue({
        code: "custom", path: [indice, "materialId"], message: "Un material no se puede repetir en la receta.",
      });
      vistos.add(material.materialId);
    });
  }),
});

export const esquemaCrearCategoria = z.object({
  nombre: textoObligatorio(80, "el nombre de la categoría"), descripcion,
});
export const esquemaEditarCategoria = z.strictObject({
  ...esquemaCrearCategoria.partial().shape, activo: z.boolean().optional(), version,
});
const consultaActivos = {
  q: z.string().trim().max(200, "La búsqueda admite hasta 200 caracteres.").optional(),
  activo: z.enum(["true", "false"], { error: "El estado debe ser true o false." })
    .default("true").transform((valor) => valor === "true"),
};
export const esquemaConsultaProductos = z.object({
  ...consultaActivos, categoriaId: identificador.optional(),
  pagina: z.coerce.number().int().min(1).max(100_000).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
});
export const esquemaConsultaMateriales = z.object(consultaActivos);
export const esquemaConsultaCategorias = z.object({
  q: consultaActivos.q,
  activo: z.enum(["true", "false"]).optional().transform((valor) => valor === undefined ? undefined : valor === "true"),
});

export type EntradaCrearProducto = z.output<typeof esquemaCrearProducto>;
export type EntradaEditarProducto = z.output<typeof esquemaEditarProducto>;
export type EntradaReceta = z.output<typeof esquemaReceta>;
export type EntradaCrearCategoria = z.output<typeof esquemaCrearCategoria>;
export type EntradaEditarCategoria = z.output<typeof esquemaEditarCategoria>;
export type ConsultaProductos = z.output<typeof esquemaConsultaProductos>;
export type ConsultaMateriales = z.output<typeof esquemaConsultaMateriales>;
export type ConsultaCategorias = z.output<typeof esquemaConsultaCategorias>;

type Parametros = URLSearchParams | Record<string, string | string[] | undefined>;
export function objetoDeParametros(parametros: Parametros): Record<string, string> {
  const pares = parametros instanceof URLSearchParams ? [...parametros.entries()] : Object.entries(parametros);
  const resultado: Record<string, string> = {};
  for (const [clave, valor] of pares) {
    const limpio = (Array.isArray(valor) ? valor[0] : valor)?.trim();
    if (limpio && !(clave === "categoriaId" && limpio === "todas")) resultado[clave] = limpio;
  }
  return resultado;
}
