import { z } from "zod";

export const CODIGOS_PERFIL = [
  "GERENCIA", "ADMINISTRACION", "OPERACIONES", "ATENCION_CLIENTE", "PRODUCCION", "ADMIN",
] as const;

const nombre = z.string().trim().min(1, "Ingrese el nombre.").max(120);
const correo = z.string().trim().toLowerCase().max(254).pipe(z.email("Ingrese un correo válido."));
const perfiles = z.array(z.enum(CODIGOS_PERFIL)).min(1, "Asigne al menos un perfil.")
  .refine((valores) => new Set(valores).size === valores.length, "No repita perfiles.");
const version = z.iso.datetime({ offset: true, error: "Indique la versión del usuario." });

export const esquemaCrearUsuario = z.strictObject({ nombre, correo, perfiles });
export const esquemaEditarUsuario = z.strictObject({
  nombre: nombre.optional(),
  correo: correo.optional(),
  perfiles: perfiles.optional(),
  version,
});
export const esquemaCambiarActivoUsuario = z.strictObject({ version });
export const esquemaIdUsuario = z.uuid();
export const esquemaConsultaUsuarios = z.object({
  q: z.string().trim().max(200).optional(),
  perfil: z.enum(CODIGOS_PERFIL).optional(),
  activo: z.enum(["true", "false"]).optional().transform((valor) =>
    valor === undefined ? undefined : valor === "true"),
  pagina: z.coerce.number().int().min(1).max(100_000).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
});

export type EntradaCrearUsuario = z.output<typeof esquemaCrearUsuario>;
export type EntradaEditarUsuario = z.output<typeof esquemaEditarUsuario>;
export type EntradaCambiarActivoUsuario = z.output<typeof esquemaCambiarActivoUsuario>;
export type ConsultaUsuarios = z.output<typeof esquemaConsultaUsuarios>;
