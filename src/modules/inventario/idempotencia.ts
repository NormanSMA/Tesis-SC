import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { Tx } from "@/lib/db";
import { AppError } from "@/lib/errores";

const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SolicitudIdempotente = { clave: string; usuarioId: string; operacion: string; cuerpo: unknown };
export type ResultadoIdempotente<T> = { resultado: T; repetida: boolean };

/** Lee el encabezado Idempotency-Key. Falta o formato inválido: 422. */
export function leerClave(valor: string | null): string {
  const clave = valor?.trim() ?? "";
  if (!PATRON_UUID.test(clave)) {
    throw new AppError({ codigo: "VALIDACION", status: 422, mensaje: "Falta una Idempotency-Key válida (UUID).",
      campos: { "Idempotency-Key": "Envíe un UUID generado por el cliente." } });
  }
  return clave.toLowerCase();
}

// Mismo cuerpo con claves en otro orden produce la misma huella.
function canonico(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(canonico);
  if (valor && typeof valor === "object") {
    return Object.fromEntries(Object.entries(valor as Record<string, unknown>)
      .filter(([, campo]) => campo !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([nombre, campo]) => [nombre, canonico(campo)]));
  }
  return valor;
}

export function huellaDe(cuerpo: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonico(cuerpo))).digest("hex");
}

/**
 * Ejecuta una escritura del libro una sola vez por clave. Va dentro de la transacción de la operación:
 * un candado de aviso serializa las solicitudes con la misma clave, así la segunda ve la respuesta
 * confirmada de la primera en lugar de competir por el saldo. Si la operación falla, nada queda guardado
 * y la clave se puede reintentar.
 */
export async function ejecutarIdempotente<T extends Prisma.InputJsonValue>(
  tx: Tx,
  solicitud: SolicitudIdempotente,
  ejecutar: () => Promise<T>,
): Promise<ResultadoIdempotente<T>> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${solicitud.clave}, 0))`;
  const huella = huellaDe(solicitud.cuerpo);
  const previa = await tx.solicitudIdempotente.findUnique({ where: { clave: solicitud.clave } });
  if (previa) {
    if (previa.usuarioId !== solicitud.usuarioId) {
      throw new AppError({ codigo: "CLAVE_EN_USO", status: 409, mensaje: "La clave de idempotencia ya está en uso." });
    }
    if (previa.operacion !== solicitud.operacion || previa.huella !== huella) {
      throw new AppError({ codigo: "CLAVE_REUTILIZADA", status: 422,
        mensaje: "La clave de idempotencia ya se usó con otra solicitud. Genere una nueva." });
    }
    return { resultado: previa.respuesta as T, repetida: true };
  }
  const resultado = await ejecutar();
  await tx.solicitudIdempotente.create({ data: { clave: solicitud.clave, usuarioId: solicitud.usuarioId,
    operacion: solicitud.operacion, huella, respuesta: resultado } });
  return { resultado, repetida: false };
}
