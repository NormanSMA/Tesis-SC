import { z } from "zod";

export const DIRECCIONES_ORDEN = ["asc", "desc"] as const;
export type DireccionOrden = (typeof DIRECCIONES_ORDEN)[number];
export type Orden<C extends string> = { campo: C; direccion: DireccionOrden };

/**
 * Esquema del parámetro `orden=campo:direccion` con lista blanca de campos.
 * Un campo fuera de la lista falla la validación (422 en la API).
 * El resultado se mapea a un objeto orderBy de Prisma; nunca se concatena en SQL.
 */
export function esquemaOrden<const C extends readonly [string, ...string[]]>(campos: C) {
  const campo = z.enum(campos);
  const direccion = z.enum(DIRECCIONES_ORDEN);
  return z
    .string()
    .max(60)
    .transform((valor, contexto): Orden<C[number]> => {
      const partes = valor.split(":");
      const resultadoCampo = campo.safeParse(partes[0]);
      const resultadoDireccion = direccion.safeParse(partes[1] ?? "asc");
      if (partes.length > 2 || !resultadoCampo.success || !resultadoDireccion.success) {
        contexto.addIssue({ code: "custom", message: "Orden no válido" });
        return z.NEVER;
      }
      return { campo: resultadoCampo.data, direccion: resultadoDireccion.data };
    });
}

export function textoOrden<C extends string>(orden: Orden<C>): string {
  return `${orden.campo}:${orden.direccion}`;
}

/** Lee el orden activo de un texto de URL; null si falta o no coincide con la lista blanca. */
export function leerOrden<C extends string>(valor: string | null | undefined, campos: readonly C[]): Orden<C> | null {
  if (!valor) return null;
  const [campo, direccion = "asc", sobra] = valor.split(":");
  if (sobra !== undefined || !campos.includes(campo as C)) return null;
  if (direccion !== "asc" && direccion !== "desc") return null;
  return { campo: campo as C, direccion };
}
