import { afterAll, beforeAll, expect, it } from "vitest";

import {
  costearItemCatalogo,
  costearItemPersonalizado,
  totalizarCotizacion,
  type EntradaItemCatalogo,
  type EntradaItemPersonalizado,
  type EntradaLinea,
  type ItemCatalogoCosteado,
  type ItemPersonalizadoCosteado,
  type TotalesCotizacion,
} from "@/core/costeo";
import { comparar, leerDecimal, type Racional } from "@/core/decimal";
import type { Tx } from "@/lib/db";

import { sembrarReferencia } from "../../prisma/seed/referencia";
import { crearClienteApp, crearClientePropietario, describeConBase } from "../helpers/db";

// Prueba que la base ACEPTA lo que calcula el motor: CHECK de fórmulas al insertar y trigger de sumas al enviar.
// Cada caso corre en una transacción que se revierte: no deja filas.

type ItemCaso =
  | { tipo: "CATALOGO"; entrada: EntradaItemCatalogo }
  | { tipo: "PERSONALIZADO"; entrada: EntradaItemPersonalizado };

// descuento "subtotal" pide el descuento total.
type Caso = { nombre: string; items: ItemCaso[]; descuento: string; tasaImpuesto: string };

type ItemCosteado = ItemCatalogoCosteado | ItemPersonalizadoCosteado;
type CasoCosteado = { items: ItemCosteado[]; totales: TotalesCotizacion };

type Fijos = { usuarioId: string; clienteId: string; categoriaId: string; productoId: string };

const SEMILLA = 20261006;
const CASOS_ALEATORIOS = 40;

class Revertir extends Error {}

const material = (cantidad: string, costoUnitario: string, mermaPct = "0"): EntradaLinea => ({
  tipo: "MATERIAL",
  cantidad,
  costoUnitario,
  mermaPct,
});
const catalogo = (entrada: EntradaItemCatalogo): ItemCaso => ({ tipo: "CATALOGO", entrada });
const personalizado = (entrada: EntradaItemPersonalizado): ItemCaso => ({ tipo: "PERSONALIZADO", entrada });

const CASOS_FIJOS: Caso[] = [
  {
    nombre: "catálogo por unidad y por m2",
    items: [
      catalogo({ unidadCobro: "UNIDAD", precioBase: "1320", cantidad: "3" }),
      catalogo({ unidadCobro: "M2", precioBase: "1025", cantidad: "1", ancho: "0.333", alto: "0.777" }),
    ],
    descuento: "0",
    tasaImpuesto: "15",
  },
  {
    nombre: "personalizado de la siembra: 17980.80 al 35 %",
    items: [
      personalizado({
        cantidad: "1",
        margenPct: "35",
        lineas: [material("5", "2850", "8"), { tipo: "MANO_OBRA", horas: "4", tarifa: "150" }, { tipo: "TERCERO", costo: "1990.80" }],
      }),
    ],
    descuento: "0",
    tasaImpuesto: "15",
  },
  {
    nombre: "margen 0 y margen 99.99 con descuento total",
    items: [
      personalizado({ cantidad: "2", margenPct: "0", lineas: [material("1", "1000")] }),
      personalizado({ cantidad: "3", margenPct: "99.99", lineas: [material("1", "1.23")] }),
    ],
    descuento: "subtotal",
    tasaImpuesto: "15",
  },
  {
    nombre: "redondeo en la mitad con IVA 0",
    items: [
      personalizado({ cantidad: "0.001", margenPct: "0", lineas: [material("1", "0.0050"), material("1", "0.0125", "20")] }),
      catalogo({ unidadCobro: "UNIDAD", precioBase: "0.05", cantidad: "0.1" }),
    ],
    descuento: "0",
    tasaImpuesto: "0",
  },
  {
    nombre: "IVA en la mitad: 0.10 al 15 %",
    items: [catalogo({ unidadCobro: "UNIDAD", precioBase: "0.10", cantidad: "1" })],
    descuento: "0",
    tasaImpuesto: "15",
  },
  {
    nombre: "grandes cantidades al borde de numeric(14,2)",
    items: [catalogo({ unidadCobro: "UNIDAD", precioBase: "9.99", cantidad: "99999999999.999" })],
    descuento: "0.01",
    tasaImpuesto: "0",
  },
];

// mulberry32: generador reproducible sin dependencias. Mismo que tests/unit/costeo.test.ts.
function crearAzar(semilla: number): () => number {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Azar = () => number;

function decimal(azar: Azar, maximo: number, decimales: number): string {
  const escala = 10 ** decimales;
  const unidades = 1 + Math.floor(azar() * maximo * escala);
  const texto = String(unidades).padStart(decimales + 1, "0");
  return `${texto.slice(0, -decimales)}.${texto.slice(-decimales)}`;
}

function lineaAleatoria(azar: Azar): EntradaLinea {
  const sorteo = azar();
  if (sorteo < 0.5) {
    const mermaPct = azar() < 0.3 ? "0" : decimal(azar, 100, 2);
    return { tipo: "MATERIAL", cantidad: decimal(azar, 500, 3), costoUnitario: decimal(azar, 5000, 4), mermaPct };
  }
  if (sorteo < 0.8) return { tipo: "MANO_OBRA", horas: decimal(azar, 200, 2), tarifa: decimal(azar, 800, 2) };
  return { tipo: "TERCERO", costo: decimal(azar, 90000, 4) };
}

function itemAleatorio(azar: Azar): ItemCaso {
  if (azar() < 0.5) {
    const lineas = Array.from({ length: 1 + Math.floor(azar() * 4) }, () => lineaAleatoria(azar));
    const margenPct = azar() < 0.1 ? "0" : decimal(azar, 99.98, 2);
    return personalizado({ cantidad: decimal(azar, 1000, 3), margenPct, lineas });
  }
  const porM2 = azar() < 0.5;
  return catalogo({
    unidadCobro: porM2 ? "M2" : "UNIDAD",
    precioBase: decimal(azar, 20000, 2),
    cantidad: decimal(azar, 1000, 3),
    ancho: porM2 ? decimal(azar, 30, 3) : null,
    alto: porM2 ? decimal(azar, 30, 3) : null,
  });
}

function casoAleatorio(azar: Azar, indice: number): Caso {
  const items = Array.from({ length: 1 + Math.floor(azar() * 4) }, () => itemAleatorio(azar));
  const sorteo = azar();
  let descuento = "0";
  if (sorteo < 0.1) descuento = "subtotal";
  else if (sorteo < 0.6) descuento = decimal(azar, 50, 2);
  return { nombre: `aleatorio ${indice}`, items, descuento, tasaImpuesto: azar() < 0.2 ? "0" : "15" };
}

function exacto(texto: string): Racional {
  const valor = leerDecimal(texto);
  if (!valor) throw new Error(`No es decimal: ${texto}`);
  return valor;
}

function costearCaso(caso: Caso): CasoCosteado {
  const items = caso.items.map((item) =>
    item.tipo === "CATALOGO" ? costearItemCatalogo(item.entrada) : costearItemPersonalizado(item.entrada),
  );
  const { subtotal } = totalizarCotizacion({ items, descuento: "0", tasaImpuesto: caso.tasaImpuesto });
  const descuentoPedido = caso.descuento === "subtotal" ? subtotal : caso.descuento;
  // Un descuento aleatorio mayor que el subtotal se recorta: el motor lo rechazaría, y aquí se prueba la base.
  const descuento = comparar(exacto(descuentoPedido), exacto(subtotal)) > 0 ? subtotal : descuentoPedido;
  return { items, totales: totalizarCotizacion({ items, descuento, tasaImpuesto: caso.tasaImpuesto }) };
}

async function insertarItem(tx: Tx, datos: { cotizacionId: string; secuencia: number; item: ItemCosteado; fijos: Fijos }) {
  const { cotizacionId, secuencia, item, fijos } = datos;
  const comunes = {
    cotizacionId,
    secuencia,
    categoriaId: fijos.categoriaId,
    cantidad: item.cantidad,
    precioUnitario: item.precioUnitario,
    importe: item.importe,
  };
  if (item.tipo === "CATALOGO") {
    const { unidadCobro, ancho, alto } = item;
    const data = { ...comunes, tipo: item.tipo, productoId: fijos.productoId, descripcion: "Catálogo", unidadCobro, ancho, alto };
    return tx.itemCotizacion.create({ data });
  }
  const lineas = item.lineas.map((linea, i) => ({ ...linea, secuencia: i + 1, descripcion: linea.tipo, unidad: "u" }));
  return tx.itemCotizacion.create({
    data: {
      ...comunes,
      tipo: item.tipo,
      descripcion: "Personalizado",
      unidadCobro: "UNIDAD",
      costoTotal: item.costoTotal,
      margenPct: item.margenPct,
      lineasCosto: { create: lineas },
    },
  });
}

// Inserta en BORRADOR y envía. El envío dispara fn_cotizacion_congelar, que compara las sumas.
async function guardarYEnviar(tx: Tx, costeado: CasoCosteado, fijos: Fijos): Promise<string> {
  const [{ numero }] = await tx.$queryRaw<{ numero: string }[]>`SELECT siguiente_numero('COTIZACION') AS numero`;
  const { tasaImpuesto, subtotal, descuento, impuesto, total, margenPct } = costeado.totales;
  const cotizacion = await tx.cotizacion.create({
    data: {
      numero,
      clienteId: fijos.clienteId,
      creadoPorId: fijos.usuarioId,
      vigenciaDias: 15,
      tasaImpuesto,
      subtotal,
      descuento,
      impuesto,
      total,
      margenPct,
    },
  });
  for (const [i, item] of costeado.items.entries()) {
    await insertarItem(tx, { cotizacionId: cotizacion.id, secuencia: i + 1, item, fijos });
  }
  await tx.cotizacion.update({
    where: { id: cotizacion.id },
    data: { estado: "ENVIADA", fechaEmision: new Date("2026-10-06"), fechaVencimiento: new Date("2026-10-21") },
  });
  return cotizacion.id;
}

async function leerGuardado(tx: Tx, cotizacionId: string) {
  const guardada = await tx.cotizacion.findUniqueOrThrow({
    where: { id: cotizacionId },
    include: { items: { orderBy: { secuencia: "asc" }, include: { lineasCosto: { orderBy: { secuencia: "asc" } } } } },
  });
  // Fórmula del ítem personalizado en SQL (05-modelo-datos, P-01). Hoy no es un CHECK.
  const [{ diferencias }] = await tx.$queryRaw<{ diferencias: number }[]>`
    SELECT count(*)::int AS diferencias FROM item_cotizacion
     WHERE cotizacion_id = ${cotizacionId}::uuid AND tipo = 'PERSONALIZADO'
       AND importe <> round(costo_total / (1 - margen_pct / 100), 2)`;
  return {
    estado: guardada.estado,
    total: guardada.total.toFixed(2),
    importes: guardada.items.map((item) => item.importe.toFixed(2)),
    lineas: guardada.items.flatMap((item) => item.lineasCosto.map((linea) => linea.importe.toFixed(2))),
    diferenciasSql: diferencias,
  };
}

describeConBase("paridad del motor de costeo con la base", () => {
  const propietario = crearClientePropietario();
  const app = crearClienteApp();
  let fijos: Fijos;

  beforeAll(async () => {
    await sembrarReferencia(propietario);
    const marca = `costeo-${Date.now()}`;
    const perfil = await propietario.perfil.findUniqueOrThrow({ where: { codigo: "ATENCION_CLIENTE" } });
    const usuario = await propietario.usuario.create({
      data: { nombre: "Costeo", correo: `${marca}@example.com`, hashContrasena: "no-aplica", perfiles: { create: { perfilId: perfil.id } } },
    });
    const cliente = await propietario.cliente.create({ data: { nombre: marca, tipo: "EMPRESA", telefono: "88888888" } });
    const categoria = await propietario.categoria.create({ data: { nombre: marca } });
    const producto = await propietario.producto.create({
      data: { codigo: marca.slice(0, 30), nombre: marca, categoriaId: categoria.id, unidadCobro: "UNIDAD", precioBase: "1" },
    });
    fijos = { usuarioId: usuario.id, clienteId: cliente.id, categoriaId: categoria.id, productoId: producto.id };
  });

  afterAll(async () => {
    if (fijos) {
      await propietario.producto.delete({ where: { id: fijos.productoId } });
      await propietario.categoria.delete({ where: { id: fijos.categoriaId } });
      await propietario.cliente.delete({ where: { id: fijos.clienteId } });
      await propietario.usuario.delete({ where: { id: fijos.usuarioId } });
    }
    await app.$disconnect();
    await propietario.$disconnect();
  });

  async function comprobarAceptado(caso: Caso): Promise<void> {
    const costeado = costearCaso(caso);
    let leido: Awaited<ReturnType<typeof leerGuardado>> | undefined;
    try {
      await app.$transaction(async (tx) => {
        leido = await leerGuardado(tx, await guardarYEnviar(tx, costeado, fijos));
        throw new Revertir();
      });
    } catch (e) {
      if (!(e instanceof Revertir)) {
        const detalle = e instanceof Error ? e.message : String(e);
        throw new Error(`La base rechazó el caso "${caso.nombre}": ${detalle}\n${JSON.stringify(caso)}`);
      }
    }
    expect(leido).toEqual({
      estado: "ENVIADA",
      total: costeado.totales.total,
      importes: costeado.items.map((item) => item.importe),
      lineas: costeado.items.flatMap((item) => (item.tipo === "PERSONALIZADO" ? item.lineas.map((l) => l.importe) : [])),
      diferenciasSql: 0,
    });
  }

  for (const caso of CASOS_FIJOS) {
    it(`acepta: ${caso.nombre}`, async () => {
      await comprobarAceptado(caso);
    });
  }

  it("fija los valores esperados de los casos de la siembra", () => {
    expect(costearCaso(CASOS_FIJOS[1]).totales).toMatchObject({ subtotal: "27662.77", total: "31812.19", margenPct: "35.00" });
    expect(costearCaso(CASOS_FIJOS[5]).totales.total).toBe("998999999999.98");
  });

  it(`acepta ${CASOS_ALEATORIOS} cotizaciones aleatorias con semilla ${SEMILLA}`, async () => {
    const azar = crearAzar(SEMILLA);
    for (let i = 0; i < CASOS_ALEATORIOS; i++) await comprobarAceptado(casoAleatorio(azar, i));
  });

  it("control: la base rechaza un importe de línea alterado en un centavo", async () => {
    const costeado = costearCaso(CASOS_FIJOS[1]);
    const item = costeado.items[0] as ItemPersonalizadoCosteado;
    const alterada = { ...item.lineas[0], importe: (Number(item.lineas[0].importe) + 0.01).toFixed(2) };
    const alterado = { ...costeado, items: [{ ...item, lineas: [alterada, ...item.lineas.slice(1)] }] };
    await expect(app.$transaction((tx) => guardarYEnviar(tx, alterado, fijos))).rejects.toThrow(/linea_importe/);
  });

  it("control: la base rechaza enviar con un subtotal que no suma los ítems", async () => {
    const costeado = costearCaso(CASOS_FIJOS[0]);
    const totales = totalizarCotizacion({ items: [costeado.items[0]], descuento: "0", tasaImpuesto: "15" });
    await expect(app.$transaction((tx) => guardarYEnviar(tx, { ...costeado, totales }, fijos))).rejects.toThrow(/Subtotal/);
  });
});
