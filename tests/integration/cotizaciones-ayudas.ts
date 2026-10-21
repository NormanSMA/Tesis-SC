import { randomUUID } from "node:crypto";

import type { PerfilCodigo } from "@/core/permisos";
import type { PrismaClient } from "@/generated/prisma/client";
import type { EntradaItem } from "@/modules/cotizaciones/schema";
import type { CotizacionDto, ItemDto } from "@/modules/cotizaciones/tipos";

import { sembrarReferencia } from "../../prisma/seed/referencia";
import { cargarAuth } from "../helpers/auth";
import { abrirSesion as abrirSesionComun, crearCategoriaBase, crearClienteBase, crearMaterialBase, nombreUnico as crearNombreUnico } from "../helpers/fabricas";

export { conPermisoRevocado, invocar } from "../helpers/fabricas";
export type { RespuestaApi, Sesion as SesionCotizacion } from "../helpers/fabricas";

export type ModulosCotizaciones = Awaited<ReturnType<typeof cargarModuloCotizaciones>>;
export type Referencias = Awaited<ReturnType<typeof crearReferencias>>;
export type EntornoCotizaciones = Awaited<ReturnType<typeof prepararCotizaciones>>;
export async function cargarModuloCotizaciones() {
  const auth = await cargarAuth();
  return {
    auth,
    lista: await import("@/app/api/v1/cotizaciones/route"),
    ficha: await import("@/app/api/v1/cotizaciones/[id]/route"),
    items: await import("@/app/api/v1/cotizaciones/[id]/items/route"),
    enviar: await import("@/app/api/v1/cotizaciones/[id]/enviar/route"),
    responder: await import("@/app/api/v1/cotizaciones/[id]/responder/route"),
    duplicar: await import("@/app/api/v1/cotizaciones/[id]/duplicar/route"),
    versionCorregida: await import("@/app/api/v1/cotizaciones/[id]/version-corregida/route"),
    archivar: await import("@/app/api/v1/cotizaciones/[id]/archivar/route"),
    catalogo: await import("@/app/api/v1/productos/route"),
    servicio: await import("@/modules/cotizaciones/service"),
    fechas: await import("@/modules/cotizaciones/fechas"),
  };
}

export async function abrirSesion(db: PrismaClient, modulos: ModulosCotizaciones, perfil: PerfilCodigo) {
  return abrirSesionComun(db, modulos, perfil);
}

export function nombreUnico(prefijo = "Cotización") {
  return crearNombreUnico(prefijo);
}

export async function crearReferencias(db: PrismaClient) {
  const cliente = await db.cliente.create({ data: crearClienteBase({ nombre: nombreUnico("Cliente cotizaciones"), telefono: "8888 0101" }) });
  const categoria = await db.categoria.create({ data: crearCategoriaBase({ nombre: nombreUnico("Categoría cotizaciones") }) });
  const unidad = await db.producto.create({
    data: { codigo: nombreUnico("CU"), nombre: "Rótulo unitario", categoriaId: categoria.id, unidadCobro: "UNIDAD", precioBase: "1320" },
  });
  const superficie = await db.producto.create({
    data: { codigo: nombreUnico("CM"), nombre: "Impresión por superficie", categoriaId: categoria.id, unidadCobro: "M2", precioBase: "1025" },
  });
  const material = await db.material.create({ data: crearMaterialBase({ nombre: "Material cotizaciones", costoPromedio: "2850" }) });
  return { cliente, categoria, unidad, superficie, material };
}

export async function prepararCotizaciones(db: PrismaClient) {
  await sembrarReferencia(db);
  await db.configuracion.upsert({
    where: { clave: "iva_porcentaje" }, update: { valor: "15" },
    create: { clave: "iva_porcentaje", tipo: "DECIMAL", valor: "15" },
  });
  await db.configuracion.upsert({
    where: { clave: "cotizacion_vigencia_dias" }, update: { valor: "15" },
    create: { clave: "cotizacion_vigencia_dias", tipo: "ENTERO", valor: "15" },
  });
  const modulos = await cargarModuloCotizaciones();
  const ventas = await abrirSesion(db, modulos, "ATENCION_CLIENTE");
  return { modulos, ventas, referencias: await crearReferencias(db) };
}

export function itemUnidad(referencias: Referencias, cantidad = "1"): EntradaItem {
  return { tipo: "CATALOGO", productoId: referencias.unidad.id, cantidad };
}

export function itemPersonalizado(referencias: Referencias): EntradaItem & { tipo: "PERSONALIZADO" } {
  return {
    tipo: "PERSONALIZADO", categoriaId: referencias.categoria.id, descripcion: "Trabajo personalizado",
    cantidad: "1", unidadCobro: "UNIDAD", margenPct: "35",
    lineas: [
      { tipo: "MATERIAL", descripcion: "Material total del trabajo", unidad: "unidad", materialId: referencias.material.id,
        cantidad: "5", mermaPct: "8" },
      { tipo: "MANO_OBRA", descripcion: "Horas totales", unidad: "hora", horas: "4", tarifa: "150" },
      { tipo: "TERCERO", descripcion: "Servicio externo", unidad: "servicio", costo: "1990.80" },
    ],
  };
}

export function itemsMixtos(referencias: Referencias): EntradaItem[] {
  return [
    itemUnidad(referencias, "3"),
    { tipo: "CATALOGO", productoId: referencias.superficie.id, cantidad: "2", ancho: "0.333", alto: "0.777" },
    itemPersonalizado(referencias),
  ];
}

export function entradaExistente(item: ItemDto): EntradaItem {
  const base = { itemId: item.id, cantidad: item.cantidad, ancho: item.ancho, alto: item.alto };
  if (item.tipo === "CATALOGO") return { ...base, tipo: "CATALOGO", productoId: item.productoId! };
  return {
    ...base, tipo: "PERSONALIZADO", categoriaId: item.categoriaId, descripcion: item.descripcion,
    unidadCobro: item.unidadCobro, margenPct: item.margenPct!,
    lineas: item.lineas.map((linea) => {
      const baseLinea = { lineaId: linea.id, descripcion: linea.descripcion, unidad: linea.unidad };
      if (linea.tipo === "MANO_OBRA") return { ...baseLinea, tipo: "MANO_OBRA", horas: linea.cantidad, tarifa: linea.costoUnitario };
      if (linea.tipo === "TERCERO") return { ...baseLinea, tipo: "TERCERO", costo: linea.costoUnitario };
      return { ...baseLinea, tipo: "MATERIAL", materialId: linea.materialId, cantidad: linea.cantidad,
        costoUnitario: linea.costoUnitario, mermaPct: linea.mermaPct };
    }),
  };
}

export async function crearBorrador(entorno: EntornoCotizaciones, opciones: { asunto?: string; items?: EntradaItem[]; moneda?: "NIO" | "USD" } = {}) {
  const { servicio } = entorno.modulos;
  const cotizacion = await servicio.crearCotizacion({
    clienteId: entorno.referencias.cliente.id, asunto: opciones.asunto ?? nombreUnico(), moneda: opciones.moneda,
  }, entorno.ventas.actor);
  if (!opciones.items) return cotizacion;
  return servicio.reemplazarItems(cotizacion.id, { version: cotizacion.actualizadoEn, items: opciones.items }, entorno.ventas.actor);
}

export function totales(cotizacion: CotizacionDto) {
  const { subtotal, descuento, tasaImpuesto, impuesto, total, margenPct } = cotizacion;
  return { subtotal, descuento, tasaImpuesto, impuesto, total, margenPct };
}

export async function conConfiguracion<T>(
  db: PrismaClient, valores: Record<string, string | null>, prueba: () => Promise<T>,
): Promise<T> {
  const anteriores = await db.configuracion.findMany({ where: { clave: { in: Object.keys(valores) } } });
  const temporales: string[] = [];
  for (const [clave, valor] of Object.entries(valores)) {
    const anterior = anteriores.find((fila) => fila.clave === clave);
    if (valor === null && anterior) {
      await db.configuracion.update({ where: { id: anterior.id }, data: { clave: `reserva_${randomUUID().replaceAll("-", "")}` } });
    } else if (valor !== null) {
      const fila = await db.configuracion.upsert({ where: { clave }, update: { valor }, create: { clave, valor, tipo: "TEXTO" } });
      if (!anterior) temporales.push(fila.id);
    }
  }
  try { return await prueba(); } finally {
    for (const anterior of anteriores) {
      await db.configuracion.update({ where: { id: anterior.id }, data: { clave: anterior.clave, valor: anterior.valor } });
    }
    for (const id of temporales) {
      await db.configuracion.update({ where: { id }, data: { clave: `reserva_${randomUUID().replaceAll("-", "")}` } });
    }
  }
}

