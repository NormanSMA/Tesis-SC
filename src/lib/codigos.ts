import type { Tx } from "@/lib/db";
import { AppError } from "@/lib/errores";

const PREFIJOS: Record<string, string> = { CORTE_LASER: "GCL", IMPRESION_DIGITAL: "ID", ACABADO: "AC", TALLER: "TA" };
export function prefijoMaterial(area?: string | null) { return PREFIJOS[area ?? ""] ?? "SA"; }

export async function siguienteCodigo(tx: Tx, prefijo: string) {
  while (true) {
    const [fila] = await tx.$queryRaw<{ numero: bigint }[]>`INSERT INTO secuencia_codigo (clave, ultimo) VALUES (${prefijo}, 1)
      ON CONFLICT (clave) DO UPDATE SET ultimo = secuencia_codigo.ultimo + 1 RETURNING ultimo AS numero`;
    const codigo = `${prefijo}-${String(fila.numero).padStart(3, "0")}`;
    const where = { OR: [{ codigo }, { codigosAnteriores: { has: codigo } }] };
    const ocupado = prefijo.startsWith("P-") ? await tx.producto.findFirst({ where, select: { id: true } })
      : await tx.material.findFirst({ where, select: { id: true } });
    if (!ocupado) return codigo;
  }
}

export async function prefijoCategoria(tx: Tx, id: string) {
  if (!await tx.categoria.findUnique({ where: { id }, select: { id: true } })) throw new AppError({ codigo: "REFERENCIA_INVALIDA", status: 409, mensaje: "La categoría no existe.", campos: { categoriaId: "Seleccione una categoría vigente." } });
  const [fila] = await tx.$queryRaw<{ prefijo: string }[]>`SELECT prefijo_categoria(${id}::uuid) AS prefijo`;
  return `P-${fila.prefijo}`;
}

export async function exigirCodigoDisponible(tx: Tx, entrada: { tipo: "material" | "producto"; codigo?: string }) {
  if (!entrada.codigo) return;
  const codigo = entrada.codigo.toUpperCase();
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`codigo:${entrada.tipo}:${codigo}`}))::text AS bloqueo`;
  const where = { OR: [{ codigo }, { codigosAnteriores: { has: codigo } }] };
  const existe = entrada.tipo === "material" ? await tx.material.findFirst({ where }) : await tx.producto.findFirst({ where });
  if (existe) throw new AppError({ codigo: "DUPLICADO", status: 409, mensaje: "El código anterior ya pertenece a otro registro.", campos: { codigo: "Código duplicado." } });
}
