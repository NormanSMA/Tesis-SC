import type { Tx } from "../../src/lib/db";

// Llama a siguiente_numero() dentro de la transacción de la siembra, igual que el alta real.
// El momento fija el año del número: un documento creado en el pasado lleva el año de su fecha.
export async function siguienteNumero(
  db: Tx,
  { tipo, momento }: { tipo: "COTIZACION" | "ORDEN_TRABAJO"; momento: Date },
): Promise<string> {
  const filas = await db.$queryRaw<{ numero: string }[]>`
    SELECT siguiente_numero(${tipo}::tipo_documento, ${momento}::timestamptz) AS numero`;
  return filas[0].numero;
}
