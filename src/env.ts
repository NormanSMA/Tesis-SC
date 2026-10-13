import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const esquemaEntorno = z.object({
  DATABASE_URL: z.url(),
  SESSION_COOKIE_NAME: z.string().default("sc_sesion"),
  SESSION_COOKIE_SECURE: z.enum(["true", "false"]).default("false"),
  PROXY_CLAVE: z.string().min(32).optional(),
  LIMITE_LECTURA: z.coerce.number().int().positive().optional(),
  LIMITE_ESCRITURA: z.coerce.number().int().positive().optional(),
  LIMITE_PUBLICA: z.coerce.number().int().positive().optional(),
  LIMITE_LOGIN_FALLOS: z.coerce.number().int().positive().optional(),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(12),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).optional(),
});

export const env = createEnv({
  server: esquemaEntorno.shape,
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME,
    SESSION_COOKIE_SECURE: process.env.SESSION_COOKIE_SECURE,
    PROXY_CLAVE: process.env.PROXY_CLAVE,
    LIMITE_LECTURA: process.env.LIMITE_LECTURA,
    LIMITE_ESCRITURA: process.env.LIMITE_ESCRITURA,
    LIMITE_PUBLICA: process.env.LIMITE_PUBLICA,
    LIMITE_LOGIN_FALLOS: process.env.LIMITE_LOGIN_FALLOS,
    SESSION_TTL_HOURS: process.env.SESSION_TTL_HOURS,
    NODE_ENV: process.env.NODE_ENV,
    LOG_LEVEL: process.env.LOG_LEVEL,
  },
  emptyStringAsUndefined: true,
  skipValidation:
    process.env.VITEST !== undefined ||
    process.env.SKIP_ENV_VALIDATION === "1" ||
    process.env.NEXT_PHASE === "phase-production-build",
});

const esquemaDinamico = esquemaEntorno.omit({ DATABASE_URL: true });

/**
 * Lee de nuevo las variables de sesión y NODE_ENV en cada llamada.
 * `env` se calcula una vez al cargar; esta función respeta cambios posteriores (pruebas y configuración en caliente).
 */
export function leerEntorno() {
  const actual = Object.fromEntries(Object.entries(process.env).filter(([, valor]) => valor !== ""));
  return esquemaDinamico.parse(actual);
}
