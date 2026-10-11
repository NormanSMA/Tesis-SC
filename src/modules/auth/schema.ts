import { z } from "zod";

export const esquemaLogin = z.object({
  correo: z
    .string({ error: "Ingrese su correo electrónico." })
    .trim()
    .min(1, "Ingrese su correo electrónico.")
    .max(254, "El correo electrónico es demasiado largo.")
    .email("Ingrese un correo electrónico válido."),
  // Tope de longitud para que una clave enorme no se use como carga contra argon2.
  contrasena: z
    .string({ error: "Ingrese su contraseña." })
    .min(1, "Ingrese su contraseña.")
    .max(256, "La contraseña es demasiado larga."),
});

export type CredencialesLogin = z.infer<typeof esquemaLogin>;

export const esquemaCambiarClave = z.object({
  claveActual: z.string({ error: "Ingrese su contraseña actual." })
    .min(1, "Ingrese su contraseña actual.")
    .max(256, "La contraseña es demasiado larga."),
  claveNueva: z.string({ error: "Ingrese su nueva contraseña." })
    .min(14, "La contraseña debe tener al menos 14 caracteres.")
    .max(256, "La contraseña es demasiado larga."),
}).refine(({ claveActual, claveNueva }) => claveActual !== claveNueva, {
  message: "La nueva contraseña debe ser distinta de la actual.", path: ["claveNueva"],
});

export type EntradaCambiarClave = z.infer<typeof esquemaCambiarClave>;

export const esquemaFormularioCambiarClave = esquemaCambiarClave.safeExtend({
  confirmacion: z.string({ error: "Confirme su nueva clave." })
    .min(1, "Confirme su nueva clave.")
    .max(256, "La clave es demasiado larga."),
}).refine(({ claveNueva, confirmacion }) => claveNueva === confirmacion, {
  message: "Las claves no coinciden.", path: ["confirmacion"],
});

export type ValoresCambiarClave = z.infer<typeof esquemaFormularioCambiarClave>;
