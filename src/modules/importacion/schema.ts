import { z } from "zod";

import { esquemaCrearCliente } from "@/modules/clientes/schema";
import { esquemaCrearMaterial } from "@/modules/inventario/schema";

import { LIMITE_CSV_BYTES } from "./tipos";

export const esquemaImportacion = z.strictObject({
  texto: z.string().refine((texto) => new TextEncoder().encode(texto).length <= LIMITE_CSV_BYTES,
    "El CSV supera 1 000 000 de bytes."),
  confirmar: z.boolean(),
});

export const esquemaFilaCliente = esquemaCrearCliente;
export const esquemaFilaMaterial = z.preprocess((valor) => {
  if (typeof valor !== "object" || valor === null) return valor;
  const datos = valor as Record<string, unknown>;
  return { ...datos, stockMinimo: datos.stockMinimo === "" ? undefined : datos.stockMinimo,
    costoPromedio: datos.costoPromedio === "" ? undefined : datos.costoPromedio };
}, esquemaCrearMaterial);

export type EntradaImportacion = z.output<typeof esquemaImportacion>;
