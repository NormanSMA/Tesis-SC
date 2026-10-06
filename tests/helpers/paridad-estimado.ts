import { expect } from "vitest";
import { cargarDatos } from "../../prisma/seed/cargar-datos";
import { planificarCotizacion, type CotizacionSembrada } from "../../prisma/seed/cotizaciones";
import { calcularConsumoEstimado as estimadoSiembra } from "../../prisma/seed/estimado";
import { crearReloj } from "../../prisma/seed/fechas";
import type { ItemCalculado } from "../../prisma/seed/items";
import type { Catalogos } from "../../prisma/seed/tipos";
import type { PrismaClient } from "@/generated/prisma/client";
import { estimarCotizacion } from "@/modules/ordenes/estimado";
import { buscarCotizacion } from "@/modules/ordenes/repo";

type CotizacionOrden = NonNullable<Awaited<ReturnType<typeof buscarCotizacion>>>;

async function catalogosDeRecetas(db: PrismaClient): Promise<Catalogos> {
  const productos = await db.producto.findMany({ include: { receta: true } });
  const recetas = new Map(productos.map((producto) => [producto.codigo, producto.receta.map((linea) => ({
    materialId: linea.materialId, cantidad: linea.cantidad.toNumber(),
  }))]));
  return { usuarios: new Map(), clientes: new Map(), categorias: new Map(), areas: new Map(),
    materiales: new Map(), productos: new Map(), plantillas: new Map(), recetas };
}

function itemsSembrados(cotizacion: CotizacionOrden): ItemCalculado[] {
  return cotizacion.items.map((item) => ({ id: item.id, secuencia: item.secuencia, tipo: item.tipo,
    productoId: item.productoId, productoCodigo: item.producto?.codigo ?? null, categoriaId: item.categoriaId,
    descripcion: item.descripcion, unidadCobro: item.unidadCobro, cantidad: item.cantidad.toFixed(3),
    ancho: item.ancho?.toFixed(3) ?? null, alto: item.alto?.toFixed(3) ?? null,
    precioUnitario: item.precioUnitario.toFixed(2), costoTotal: item.costoTotal?.toFixed(2) ?? null,
    margenPct: item.margenPct?.toFixed(2) ?? null, importe: item.importe.toFixed(2),
    lineas: item.lineasCosto.map((linea) => ({ id: linea.id, secuencia: linea.secuencia, tipo: linea.tipo,
      descripcion: linea.descripcion, materialId: linea.materialId, unidad: linea.unidad,
      cantidad: linea.cantidad.toFixed(3), costoUnitario: linea.costoUnitario.toFixed(4),
      mermaPct: linea.mermaPct.toFixed(2), importe: linea.importe.toFixed(2) })) }));
}

const porMaterial = (a: { materialId: string }, b: { materialId: string }) => a.materialId.localeCompare(b.materialId);

// Requiere una base sembrada: compara el estimado del módulo de órdenes con el de la siembra y con las filas guardadas.
export async function comprobarParidadEstimado(db: PrismaClient): Promise<void> {
  const escenarios = cargarDatos().escenarios.filter((escenario) => escenario.orden);
  expect(escenarios.length).toBeGreaterThan(0);
  const catalogos = await catalogosDeRecetas(db);
  for (const escenario of escenarios) {
    const fila = await db.cotizacion.findFirstOrThrow({ where: { asunto: escenario.asunto, orden: { isNot: null } } });
    const cotizacion = await buscarCotizacion(db, fila.id);
    if (!cotizacion) throw new Error("Falta la cotización sembrada.");
    const sembrada: CotizacionSembrada = { id: fila.id, numero: fila.numero, escenario, items: itemsSembrados(cotizacion),
      plan: planificarCotizacion(crearReloj(), escenario) };
    const esperado = estimadoSiembra(sembrada, catalogos).sort(porMaterial);
    const actual = estimarCotizacion(cotizacion);
    expect(actual.advertencias, escenario.clave).toEqual([]);
    expect(actual.consumos, escenario.clave).toEqual(esperado);
    const guardado = await db.consumoEstimado.findMany({ where: { orden: { cotizacionId: fila.id } } });
    expect(guardado.map((consumo) => ({ materialId: consumo.materialId, cantidad: consumo.cantidad.toFixed(3), origen: consumo.origen }))
      .sort(porMaterial), escenario.clave).toEqual(esperado);
  }
}
