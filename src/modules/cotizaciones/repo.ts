import { Prisma } from "@/generated/prisma/client";
import { esMoneda, type Moneda } from "@/core/moneda";
import { prisma, type Tx } from "@/lib/db";
import { AppError } from "@/lib/errores";
import { esquemaValorPorClaveConfiguracion } from "@/modules/admin/configuracion-schema";
import { escaparComodines } from "@/modules/clientes/repo";

import { hoyManagua, sumarDias } from "./fechas";
import { CONDICIONES_PREDETERMINADAS, type ConsultaCotizaciones } from "./schema";
import type { CampoOrdenCotizacion, ConteosCotizaciones, SelectoresEditor } from "./tipos";
import { SERVICIOS_SC } from "./servicios-sc";
import { precioParaCotizar } from "./materiales";
import { esquemaPorcentajeTarifa, TARIFAS_INICIALES, type PorcentajesTarifa } from "./tarifas";

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
  const where: Prisma.CotizacionWhereInput = { creadoPorId: consulta.autorId };
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
    clave: { in: ["cotizacion_vigencia_dias", "cotizacion_condiciones", "empresa_nombre",
      "moneda", "tipo_cambio_usd", "tarifa_ocasional_pct", "tarifa_intermedia_pct", "tarifa_preferencial_pct", "tarifa_instalacion_km"] },
  } });
  const valores = Object.fromEntries(filas.map(({ clave, valor }) => [clave, valor]));
  const vigenciaDias = Number(valores.cotizacion_vigencia_dias);
  if (!Number.isInteger(vigenciaDias) || vigenciaDias < 1 || vigenciaDias > 365) {
    throw new AppError({ codigo: "CONFIGURACION_INVALIDA", status: 409,
      mensaje: "Revise la vigencia en la configuración." });
  }
  const moneda: Moneda = esMoneda(valores.moneda) ? valores.moneda : "NIO";
  const tipoCambio = esquemaValorPorClaveConfiguracion("tipo_cambio_usd")?.safeParse(valores.tipo_cambio_usd);
  const tarifas: PorcentajesTarifa = {
    OCASIONAL: esquemaPorcentajeTarifa.safeParse(valores.tarifa_ocasional_pct).data ?? TARIFAS_INICIALES.OCASIONAL,
    INTERMEDIA: esquemaPorcentajeTarifa.safeParse(valores.tarifa_intermedia_pct).data ?? TARIFAS_INICIALES.INTERMEDIA,
    PREFERENCIAL: esquemaPorcentajeTarifa.safeParse(valores.tarifa_preferencial_pct).data ?? TARIFAS_INICIALES.PREFERENCIAL,
  };
  const tarifaInstalacion = esquemaValorPorClaveConfiguracion("tarifa_instalacion_km")?.safeParse(valores.tarifa_instalacion_km).data ?? "20";
  return { vigenciaDias, moneda, tarifas, tarifaInstalacion,
    tipoCambioUsd: tipoCambio?.success ? tipoCambio.data : null,
    condiciones: valores.cotizacion_condiciones ?? CONDICIONES_PREDETERMINADAS,
    empresaNombre: valores.empresa_nombre ?? "Soluciones Creativas" };
}

export async function consultarClientesSelector(clienteActualId?: string, soloActivos = false) {
  if (!clienteActualId) return [];
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteActualId, ...(soloActivos ? { activo: true } : {}) },
    select: { id: true, nombre: true },
  });
  return cliente ? [cliente] : [];
}

export async function buscarClientesSelector(q: string) {
  if (!q) return [];
  return prisma.cliente.findMany({
    where: { activo: true, nombre: { contains: escaparComodines(q), mode: "insensitive" } },
    select: { id: true, nombre: true, codigoCliente: true },
    orderBy: [{ nombre: "asc" }, { id: "asc" }],
    take: 20,
  });
}

export function consultarCategoriasSelector() {
  return prisma.categoria.findMany({ where: { activo: true, nombre: { in: SERVICIOS_SC } },
    select: { id: true, nombre: true }, orderBy: { nombre: "asc" } });
}

export async function consultarSelectores(): Promise<SelectoresEditor> {
  const [productos, materiales, categorias] = await Promise.all([
    prisma.producto.findMany({ where: { activo: true }, select: {
      id: true, codigo: true, nombre: true, categoriaId: true, unidadCobro: true,
      precioBase: true, categoria: { select: { nombre: true } },
    }, orderBy: [{ nombre: "asc" }, { id: "asc" }] }),
    prisma.material.findMany({ where: { activo: true }, select: {
      id: true, codigo: true, nombre: true, unidad: true, costoPromedio: true,
      unidadCotizacion: true, precioCotizacion: true, areaUnidadInventario: true,
    }, orderBy: [{ nombre: "asc" }, { id: "asc" }] }),
    consultarCategoriasSelector(),
  ]);
  return {
    productos: productos.map((producto) => ({ ...producto,
      precioBase: producto.precioBase.toFixed(2), categoria: producto.categoria.nombre })),
    materiales: materiales.map(({ id, codigo, nombre, unidad, unidadCotizacion, ...precios }) =>
      ({ id, codigo, nombre, unidad, unidadCotizacion, costoPromedio: precios.costoPromedio.toFixed(4),
        precioCotizacion: precioParaCotizar(precios) })),
    categorias,
  };
}
