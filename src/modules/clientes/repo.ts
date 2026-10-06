import { Prisma, type Cliente } from "@/generated/prisma/client";
import { prisma, type Tx } from "@/lib/db";

import type { CampoEditable, ConsultaClientes, EntradaCrearCliente } from "./schema";

export const LIMITE_HISTORIAL = 20;

const COLUMNAS: Record<CampoEditable | "activo", string> = {
  nombre: "nombre",
  tipo: "tipo",
  ruc: "ruc",
  contactoPrincipal: "contacto_principal",
  telefono: "telefono",
  correo: "correo",
  direccion: "direccion",
  notas: "notas",
  activo: "activo",
};

export type CondicionEscritura = { id: string; activo: boolean; version: string };

export type FilaListada = Cliente & { _count: { cotizaciones: number } };

// Prisma pasa el texto tal cual a ILIKE: sin escapar, % y _ de la búsqueda actuarían como comodines.
function escaparComodines(texto: string): string {
  return texto.replace(/[\\%_]/g, "\\$&");
}

function filtroLista({ q, tipo, activo }: ConsultaClientes): Prisma.ClienteWhereInput {
  const where: Prisma.ClienteWhereInput = { activo };
  if (tipo) where.tipo = tipo;
  if (q) {
    const contiene = { contains: escaparComodines(q), mode: "insensitive" as const };
    where.OR = [{ nombre: contiene }, { ruc: contiene }, { contactoPrincipal: contiene }, { correo: contiene }];
  }
  return where;
}

export async function consultarClientes(consulta: ConsultaClientes): Promise<{ filas: FilaListada[]; total: number }> {
  const where = filtroLista(consulta);
  const [filas, total] = await Promise.all([
    prisma.cliente.findMany({
      where,
      orderBy: [{ nombre: "asc" }, { id: "asc" }],
      skip: (consulta.pagina - 1) * consulta.porPagina,
      take: consulta.porPagina,
      include: { _count: { select: { cotizaciones: true } } },
    }),
    prisma.cliente.count({ where }),
  ]);
  return { filas, total };
}

export function buscarCliente(db: Tx, id: string): Promise<Cliente | null> {
  return db.cliente.findUnique({ where: { id } });
}

export function insertarCliente(tx: Tx, datos: EntradaCrearCliente): Promise<Cliente> {
  return tx.cliente.create({ data: datos });
}

function asignacion(campo: CampoEditable | "activo", valor: unknown): Prisma.Sql {
  const columna = Prisma.raw(COLUMNAS[campo]);
  return campo === "tipo" ? Prisma.sql`${columna} = ${valor}::tipo_cliente` : Prisma.sql`${columna} = ${valor}`;
}

/**
 * UPDATE condicionado a id, activo y versión. Devuelve false si no afectó ninguna fila.
 * La versión nueva es siempre mayor que la anterior, aunque dos cambios caigan en el mismo milisegundo.
 * La versión viaja con precisión de milisegundos: se compara contra la ventana [version, version + 1 ms).
 */
export async function actualizarCondicionado(
  tx: Tx,
  { id, activo, version }: CondicionEscritura,
  cambios: Partial<Record<CampoEditable | "activo", unknown>>,
): Promise<boolean> {
  const asignaciones = (Object.entries(cambios) as [CampoEditable | "activo", unknown][]).map(([campo, valor]) =>
    asignacion(campo, valor),
  );
  const desde = new Date(version);
  const afectadas = await tx.$executeRaw`
    UPDATE cliente SET ${Prisma.join(asignaciones)},
      actualizado_en = GREATEST(
        date_trunc('milliseconds', clock_timestamp()),
        date_trunc('milliseconds', actualizado_en) + interval '1 millisecond')
    WHERE id = ${id}::uuid AND activo = ${activo}
      AND actualizado_en >= ${desde}::timestamptz
      AND actualizado_en < ${desde}::timestamptz + interval '1 millisecond'`;
  return afectadas === 1;
}

export async function cotizacionesDeCliente(clienteId: string) {
  const [filas, total] = await Promise.all([
    prisma.cotizacion.findMany({
      where: { clienteId },
      orderBy: [{ creadoEn: "desc" }, { id: "desc" }],
      take: LIMITE_HISTORIAL,
      select: { id: true, numero: true, asunto: true, estado: true, total: true, fechaEmision: true, creadoEn: true },
    }),
    prisma.cotizacion.count({ where: { clienteId } }),
  ]);
  return { filas, total };
}

export async function ordenesDeCliente(clienteId: string) {
  const where = { cotizacion: { clienteId } };
  const [filas, total] = await Promise.all([
    prisma.ordenTrabajo.findMany({
      where,
      orderBy: [{ creadoEn: "desc" }, { id: "desc" }],
      take: LIMITE_HISTORIAL,
      select: { id: true, numero: true, estado: true, fechaEntrega: true },
    }),
    prisma.ordenTrabajo.count({ where }),
  ]);
  return { filas, total };
}

export function agregadoCotizaciones(clienteId: string) {
  return prisma.cotizacion.groupBy({
    by: ["estado"],
    where: { clienteId },
    _count: { _all: true },
    _sum: { total: true },
  });
}

export function eventosDeCliente(clienteId: string) {
  return prisma.bitacora.findMany({
    where: { entidad: "CLIENTE", entidadId: clienteId },
    orderBy: [{ creadoEn: "desc" }, { id: "desc" }],
    take: LIMITE_HISTORIAL,
    include: { usuario: { select: { nombre: true } } },
  });
}
