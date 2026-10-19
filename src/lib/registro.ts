import pino from "pino";

import { registrarErrorMedido } from "@/lib/metricas";

const CAMPOS_SENSIBLES = [
  "cookie",
  "authorization",
  "contrasena",
  "contrasenaActual",
  "contrasenaNueva",
  "clave",
  "claveTemporal",
  "hashContrasena",
  "token",
  "tokenHash",
];

export function crearRegistro(destino?: pino.DestinationStream) {
  const opciones: pino.LoggerOptions = {
    level: process.env.LOG_LEVEL ?? (process.env.VITEST !== undefined ? "silent" : "info"),
    base: { servicio: "tracore" },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: CAMPOS_SENSIBLES.flatMap((campo) => [campo, `req.headers.${campo}`, `*.${campo}`]),
      censor: "[REDACTADO]",
    },
    serializers: { err: pino.stdSerializers.err },
    // Copia los errores (nivel 50 o más) al búfer de métricas.
    hooks: {
      logMethod(argumentos, metodo, nivel) {
        if (nivel >= 50) registrarErrorMedido(argumentos[0]);
        metodo.apply(this, argumentos);
      },
    },
  };
  return destino ? pino(opciones, destino) : pino(opciones);
}

export const registro = crearRegistro();
