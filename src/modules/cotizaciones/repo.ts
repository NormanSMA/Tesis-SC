import { Prisma } from "@/generated/prisma/client";
import { esMoneda, type Moneda } from "@/core/moneda";
import { prisma, type Tx } from "@/lib/db";
import { AppError } from "@/lib/errores";
import { esquemaValorPorClaveConfiguracion } from "@/modules/admin/configuracion-schema";

import { hoyManagua, sumarDias } from "./fechas";
import { CONDICIONES_PREDETERMINADAS, type ConsultaCotizaciones } from "./schema";
import type { CampoOrdenCotizacion, ConteosCotizaciones, SelectoresEditor } from "./tipos";

const incluirFicha = {
  cliente: true,
  usuarioAprobacion: { select: { id: true, nombre: true } },
  items: { orderBy: { secuencia: "asc" as const }, include: {
    producto: { select: { activo: true } },
    lineasCosto: { orderBy: { secuencia: "asc" as const } },
  } },
};
export type FichaGuardada = Prisma.CotizacionGetPayload<{ include: typeof incluirFicha }>;
export type ItemGuardado = FichaGuardada["items"][number];

export function buscarCotizacion(tx: Tx, id: string): Promise<FichaGuardada | null> {
  return tx.cotizacion.findUnique({ where: { id }, include: incluirFicha });
}

function filtroPorVencer(hoy: string): Prisma.CotizacionWhereInput {
  return { estado: "ENVIADA", fechaRespuesta: null,
    fechaVencimiento: { gte: sumarDias(hoy, 0), lte: sumarDias(hoy, 3) } };
}

function filtroLista(consulta: ConsultaCotizaciones, hoy: string): Prisma.CotizacionWhereInput {
  const where: Prisma.CotizacionWhereInput = {};
  if (consulta.archivadas !== "todas") where.archivada = consulta.archivadas === "true";
  if (consulta.estado) where.estado = consulta.estado;
  if (consulta.porVencer) where.AND = [filtroPorVencer(hoy)];
  if (consulta.cliente) where.clienteId = consulta.cliente;
  if (consulta.q) {
    const contains = consulta.q.replace(/[\\%_]/g, "\\$&");
    const texto = { contains, mode: "insensitive" as const };
    where.OR = [{ numero: texto }, { asunto: texto }, { cliente: { nombre: texto } }];
  }
  return where;
}

function ordenLista(orden: ConsultaCotizaciones["orden"]): Prisma.CotizacionOrderByWithRelationInput[] {
  const { campo, direccion } = orden ?? { campo: "creadoEn", direccion: "desc" };
  const campos: Record<CampoOrdenCotizacion, Prisma.CotizacionOrderByWithRelationInput> = {
    creadoEn: { creadoEn: direccion }, numero: { numero: direccion },
    cliente: { cliente: { nombre: direccion } }, total: { total: direccion },
    vencimiento: { fechaVencimiento: { sort: direccion, nulls: "last" } },
  };
  return [campos[campo], { id: direccion }];
}

export function consultarCotizaciones(consulta: ConsultaCotizaciones, hoy = hoyManagua()) {
  const where = filtroLista(consulta, hoy);
  return prisma.cotizacion.findMany({ where, include: { cliente: true, usuarioAprobacion: incluirFicha.usuarioAprobacion },
    orderBy: ordenLista(consulta.orden),
    skip: (consulta.pagina - 1) * consulta.porPagina, take: consulta.porPagina });
}

export async function consultarConteosCotizaciones(consulta: ConsultaCotizaciones, hoy = hoyManagua()): Promise<ConteosCotizaciones> {
  const where = filtroLista({ ...consulta, estado: undefined, porVencer: undefined }, hoy);
  const [porEstado, porVencer] = await Promise.all([
    prisma.cotizacion.groupBy({ by: ["estado"], where, _count: { _all: true } }),
    prisma.cotizacion.count({ where: { AND: [where, filtroPorVencer(hoy)] } }),
  ]);
  const conteos: ConteosCotizaciones = {
    BORRADOR: 0, ENVIADA: 0, APROBADA: 0, RECHAZADA: 0, VENCIDA: 0, AJUSTE_SOLICITADO: 0,
    todas: 0, porVencer,
  };
  for (const fila of porEstado) {
    conteos[fila.estado] = fila._count._all;
    conteos.todas += fila._count._all;
  }
  return conteos;
}

type CondicionEscritura = { id: string; estado: string; archivada: boolean; version: string };

export async function actualizarCondicionado(tx: Tx, condicion: CondicionEscritura): Promise<boolean> {
  const desde = new Date(condicion.version);
  // La ventana reproduce la precisión de milisegundos que Prisma devuelve al navegador.
  const afectadas = await tx.$executeRaw`
    UPDATE cotizacion SET actualizado_en = GREATEST(
      date_trunc('milliseconds', clock_timestamp()),
      date_trunc('milliseconds', actualizado_en) + interval '1 millisecond')
    WHERE id = ${condicion.id}::uuid AND estado = ${condicion.estado}::estado_cotizacion
      AND archivada = ${condicion.archivada}
      AND actualizado_en >= ${desde}::timestamptz
      AND actualizado_en < ${desde}::timestamptz + interval '1 millisecond'`;
  return afectadas === 1;
}

export async function siguienteNumero(tx: Tx): Promise<string> {
  const [fila] = await tx.$queryRaw<{ numero: string }[]>`SELECT siguiente_numero('COTIZACION') AS numero`;
  return fila.numero;
}

export async function configuracionCotizacion(tx: Tx) {
  const filas = await tx.configuracion.findMany({ where: {
    clave: { in: ["iva_porcentaje", "cotizacion_vigencia_dias", "cotizacion_condiciones", "empresa_nombre",
      "moneda", "tipo_cambio_usd"] },
  } });
  const valores = Object.fromEntries(filas.map(({ clave, valor }) => [clave, valor]));
  const vigenciaDias = Number(valores.cotizacion_vigencia_dias);
  if (!valores.iva_porcentaje || !Number.isInteger(vigenciaDias) || vigenciaDias < 1 || vigenciaDias > 36500) {
    throw new AppError({ codigo: "CONFIGURACION_INVALIDA", status: 409,
      mensaje: "Revise el IVA y la vigencia en la configuración." });
  }
  const moneda: Moneda = esMoneda(valores.moneda) ? valores.moneda : "NIO";
  const tipoCambio = esquemaValorPorClaveConfiguracion("tipo_cambio_usd")?.safeParse(valores.tipo_cambio_usd);
  return { tasaImpuesto: valores.iva_porcentaje, vigenciaDias, moneda,
    tipoCambioUsd: tipoCambio?.success ? tipoCambio.data : null,
    condiciones: valores.cotizacion_condiciones ?? CONDICIONES_PREDETERMINADAS,
    empresaNombre: valores.empresa_nombre ?? "Soluciones Creativas" };
}

/** Tope de clientes en el selector. El cliente seleccionado se agrega siempre. */
export const TOPE_CLIENTES_SELECTOR = 200;
export async function consultarClientesSelector(clienteActualId?: string) {
  const [base, actual] = await Promise.all([
    prisma.cliente.findMany({ where: { activo: true }, select: { id: true, nombre: true },
      orderBy: [{ nombre: "asc" }, { id: "asc" }], take: TOPE_CLIENTES_SELECTOR }),
    clienteActualId ? prisma.cliente.findMany({ where: { id: clienteActualId }, select: { id: true, nombre: true } }) : [],
  ]);
  return [...base, ...actual.filter((cliente) => !base.some((fila) => fila.id === cliente.id))];
}

export function consultarCategoriasSelector() {
  return prisma.categoria.findMany({ where: { activo: true }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } });
}

export async function consultarSelectores(): Promise<SelectoresEditor> {
  const [productos, materiales, categorias] = await Promise.all([
    prisma.producto.findMany({ where: { activo: true }, select: {
      id: true, codigo: true, nombre: true, categoriaId: true, unidadCobro: true,
      precioBase: true, categoria: { select: { nombre: true } },
    }, orderBy: [{ nombre: "asc" }, { id: "asc" }] }),
    prisma.material.findMany({ where: { activo: true }, select: {
      id: true, codigo: true, nombre: true, unidad: true, costoPromedio: true,
    }, orderBy: [{ nombre: "asc" }, { id: "asc" }] }),
    consultarCategoriasSelector(),
  ]);
  return {
    productos: productos.map((producto) => ({ ...producto,
      precioBase: producto.precioBase.toFixed(2), categoria: producto.categoria.nombre })),
    materiales: materiales.map((material) => ({ ...material, costoPromedio: material.costoPromedio.toFixed(4) })),
    categorias,
  };
}
