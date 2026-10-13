import pino from "pino";

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
  };
  return destino ? pino(opciones, destino) : pino(opciones);
}

export const registro = crearRegistro();
