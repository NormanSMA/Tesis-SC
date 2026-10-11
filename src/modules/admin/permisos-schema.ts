import { z } from "zod";

import { CATALOGO_PERMISOS, type PerfilCodigo, type Permiso } from "@/core/permisos";
import { AppError } from "@/lib/errores";

import { CODIGOS_PERFIL } from "./schema";

export const PERMISOS_PROTEGIDOS: readonly Permiso[] = [
  "usuario:gestionar", "permiso:gestionar", "configuracion:gestionar",
];

export const esquemaPerfilPermisos = z.enum(CODIGOS_PERFIL);
export const esquemaReemplazarPermisos = z.strictObject({
  version: z.string().regex(/^[0-9a-f]{64}$/, "Indique una versión SHA-256 hexadecimal válida."),
  permisos: z.array(z.enum(CATALOGO_PERMISOS.map(({ permiso }) => permiso)))
    .refine((codigos) => new Set(codigos).size === codigos.length, "No repita permisos."),
});

export type EntradaReemplazarPermisos = z.output<typeof esquemaReemplazarPermisos>;

export function validarPermisosPerfil(perfil: PerfilCodigo, permisos: readonly Permiso[]): void {
  if (perfil !== "ADMIN" || PERMISOS_PROTEGIDOS.every((codigo) => permisos.includes(codigo))) return;
  throw new AppError({
    codigo: "PERMISO_PROTEGIDO", mensaje: "Conserve los permisos de administración de ADMIN.",
    status: 422, campos: { permisos: "No puede revocar los permisos protegidos de ADMIN." },
  });
}

export function calcularDiferenciasPermisos(actuales: readonly string[], nuevos: readonly string[]) {
  const actual = new Set(actuales);
  const nuevo = new Set(nuevos);
  return {
    altas: nuevos.filter((codigo) => !actual.has(codigo)),
    bajas: actuales.filter((codigo) => !nuevo.has(codigo)),
  };
}
