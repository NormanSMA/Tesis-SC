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
