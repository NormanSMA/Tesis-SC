import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";

import type { ItemDto } from "@/modules/cotizaciones/tipos";
import { liberarClienteGlobal } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import {
  crearBorrador, entradaExistente, itemPersonalizado, itemUnidad, prepararCotizaciones,
  totales, type EntornoCotizaciones,
} from "./cotizaciones-ayudas";

function instantanea(item: ItemDto) {
  return { secuencia: item.secuencia, descripcion: item.descripcion, tipo: item.tipo,
    productoId: item.productoId, categoriaId: item.categoriaId, unidadCobro: item.unidadCobro,
    cantidad: item.cantidad, ancho: item.ancho, alto: item.alto, precioUnitario: item.precioUnitario,
    costoTotal: item.costoTotal, margenPct: item.margenPct, importe: item.importe, lineas: item.lineas };
}

describeConBase("cotizaciones: bitácora reconstruible y transacciones", () => {
  const db = crearClientePropietario();
  let entorno: EntornoCotizaciones;
  beforeAll(async () => { entorno = await prepararCotizaciones(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  const eventos = (id: string) => db.bitacora.findMany({
    where: { entidad: "COTIZACION", entidadId: id }, orderBy: [{ creadoEn: "asc" }, { id: "asc" }],
  });

  it("registra campos anteriores y nuevos de cabecera con ambos totales", async () => {
    const inicial = await crearBorrador(entorno, { items: [itemUnidad(entorno.referencias)] });
    const editada = await entorno.modulos.servicio.editarCotizacion(inicial.id, {
      version: inicial.actualizadoEn, asunto: "Asunto corregido", condiciones: "Entrega acordada", descuento: "100", vigenciaDias: 30,
    }, entorno.ventas.actor);
    const evento = (await eventos(inicial.id)).find((fila) => fila.accion === "EDITAR" &&
      (fila.detalle as Record<string, unknown>)?.cambios && Object.keys((fila.detalle as { cambios: object }).cambios).length);
    expect(evento).toMatchObject({ cotizacionId: inicial.id, usuarioId: entorno.ventas.usuarioId, accion: "EDITAR" });
    expect(evento?.detalle).toEqual({
      cambios: {
        asunto: { anterior: inicial.asunto, nuevo: editada.asunto },
        condiciones: { anterior: inicial.condiciones, nuevo: editada.condiciones },
        descuento: { anterior: inicial.descuento, nuevo: editada.descuento },
        vigenciaDias: { anterior: inicial.vigenciaDias, nuevo: editada.vigenciaDias },
      },
      totales: { anterior: totales(inicial), nuevo: totales(editada) },
    });
  });

  it("reconstruye ítems agregados, modificados y quitados usando el detalle EDITAR", async () => {
    const inicial = await crearBorrador(entorno, {
      items: [itemUnidad(entorno.referencias), itemPersonalizado(entorno.referencias)],
    });
    const existente = { ...entradaExistente(inicial.items[0]), cantidad: "2" };
    const editada = await entorno.modulos.servicio.reemplazarItems(inicial.id, {
      version: inicial.actualizadoEn, items: [existente, itemUnidad(entorno.referencias, "3")],
    }, entorno.ventas.actor);
    const evento = await db.bitacora.findFirstOrThrow({
      where: { cotizacionId: inicial.id, accion: "EDITAR" }, orderBy: { creadoEn: "desc" },
    });
    type Cambio = { accion: string; itemId: string; secuencia: number; descripcion: string;
      anterior: ReturnType<typeof instantanea> | null; nuevo: ReturnType<typeof instantanea> | null };
    const detalle = evento.detalle as unknown as { items: Cambio[]; totales: object };
    expect(detalle.items.map((item) => item.accion).sort()).toEqual(["agregado", "modificado", "quitado"]);
    const reconstruidos = new Map(inicial.items.map((item) => [item.id, instantanea(item)]));
    for (const cambio of detalle.items) {
      expect(cambio.anterior).toEqual(reconstruidos.get(cambio.itemId) ?? null);
      expect(cambio.secuencia).toBe((cambio.nuevo ?? cambio.anterior)?.secuencia);
      expect(cambio.descripcion).toBe((cambio.nuevo ?? cambio.anterior)?.descripcion);
      if (cambio.nuevo) reconstruidos.set(cambio.itemId, cambio.nuevo);
      else reconstruidos.delete(cambio.itemId);
    }
    expect([...reconstruidos.values()].sort((a, b) => a.secuencia - b.secuencia)).toEqual(editada.items.map(instantanea));
    expect(detalle.totales).toEqual({ anterior: totales(inicial), nuevo: totales(editada) });
  });

  it("registra CREAR, EDITAR, CAMBIAR_ESTADO y ARCHIVAR con el mismo enlace y actor", async () => {
    const borrador = await crearBorrador(entorno, { items: [itemUnidad(entorno.referencias)] });
    const enviada = await entorno.modulos.servicio.enviarCotizacion(borrador.id, borrador.actualizadoEn, entorno.ventas.actor);
    const aprobada = await entorno.modulos.servicio.responderCotizacion(enviada.id, {
      version: enviada.actualizadoEn, resultado: "APROBADA",
    }, entorno.ventas.actor);
    await entorno.modulos.servicio.archivarCotizacion(aprobada.id, aprobada.actualizadoEn, entorno.ventas.actor);
    const filas = await eventos(borrador.id);
    expect(filas.map((fila) => fila.accion)).toEqual(["CREAR", "EDITAR", "CAMBIAR_ESTADO", "CAMBIAR_ESTADO", "ARCHIVAR"]);
    filas.forEach((fila) => expect(fila).toMatchObject({
      entidad: "COTIZACION", entidadId: borrador.id, cotizacionId: borrador.id, usuarioId: entorno.ventas.usuarioId,
    }));
    expect(filas.filter((fila) => fila.accion === "CAMBIAR_ESTADO").map((fila) => [fila.estadoAnterior, fila.estadoNuevo]))
      .toEqual([["BORRADOR", "ENVIADA"], ["ENVIADA", "APROBADA"]]);
  });

  it("revierte cabecera y versión cuando falla la bitácora por actor inexistente", async () => {
    const inicial = await crearBorrador(entorno, { items: [itemUnidad(entorno.referencias)] });
    const actor = { ...entorno.ventas.actor, id: randomUUID() };
    const cantidad = (await eventos(inicial.id)).length;
    await expect(entorno.modulos.servicio.editarCotizacion(inicial.id, {
      version: inicial.actualizadoEn, asunto: "No persistir", descuento: "100",
    }, actor)).rejects.toThrow();
    expect(await entorno.modulos.servicio.obtenerCotizacion(inicial.id)).toEqual(inicial);
    expect(await eventos(inicial.id)).toHaveLength(cantidad);
  });

  it("revierte reemplazo completo cuando falla la bitácora por actor inexistente", async () => {
    const inicial = await crearBorrador(entorno, { items: [itemPersonalizado(entorno.referencias)] });
    const actor = { ...entorno.ventas.actor, id: randomUUID() };
    const cantidad = (await eventos(inicial.id)).length;
    await expect(entorno.modulos.servicio.reemplazarItems(inicial.id, {
      version: inicial.actualizadoEn, items: [itemUnidad(entorno.referencias)],
    }, actor)).rejects.toThrow();
    expect(await entorno.modulos.servicio.obtenerCotizacion(inicial.id)).toEqual(inicial);
    expect(await eventos(inicial.id)).toHaveLength(cantidad);
  });

  it("revierte estado y fechas cuando falla la bitácora", async () => {
    const inicial = await crearBorrador(entorno, { items: [itemUnidad(entorno.referencias)] });
    const cantidad = (await eventos(inicial.id)).length;
    await expect(entorno.modulos.servicio.enviarCotizacion(inicial.id, inicial.actualizadoEn, {
      ...entorno.ventas.actor, id: randomUUID(),
    })).rejects.toThrow();
    expect(await entorno.modulos.servicio.obtenerCotizacion(inicial.id)).toEqual(inicial);
    expect(await eventos(inicial.id)).toHaveLength(cantidad);
  });
});
