import { afterAll, beforeAll, expect, it } from "vitest";

import { totalizarCotizacion } from "@/core/costeo";
import { liberarClienteGlobal } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import {
  conConfiguracion, crearBorrador, crearReferencias, entradaExistente, itemPersonalizado,
  itemUnidad, prepararCotizaciones, totales, type EntornoCotizaciones,
} from "./cotizaciones-ayudas";

describeConBase("cotizaciones: instantáneas y reutilización", () => {
  const db = crearClientePropietario();
  let entorno: EntornoCotizaciones;
  beforeAll(async () => { entorno = await prepararCotizaciones(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  async function escenarioPropio() {
    return { ...entorno, referencias: await crearReferencias(db) };
  }

  it("conserva el precio de catálogo al modificar otro ítem", async () => {
    const propio = await escenarioPropio();
    const inicial = await crearBorrador(propio, { items: [itemUnidad(propio.referencias), itemPersonalizado(propio.referencias)] });
    await db.producto.update({ where: { id: propio.referencias.unidad.id }, data: { precioBase: "9999" } });
    const entradas = inicial.items.map(entradaExistente);
    entradas[1].cantidad = "2";
    const editada = await entorno.modulos.servicio.reemplazarItems(inicial.id, {
      version: inicial.actualizadoEn, items: entradas,
    }, entorno.ventas.actor);
    expect(editada.items[0]).toEqual(inicial.items[0]);
    expect(editada.items[1]).toMatchObject({ costoTotal: "17980.80", importe: "27662.77", cantidad: "2.000" });
  });

  it("relee precio, unidad y producto solamente con actualizarPrecio", async () => {
    const propio = await escenarioPropio();
    const inicial = await crearBorrador(propio, { items: [itemUnidad(propio.referencias)] });
    await db.producto.update({
      where: { id: propio.referencias.unidad.id }, data: { precioBase: "2000", unidadCobro: "M2" },
    });
    const entrada = { ...entradaExistente(inicial.items[0]), ancho: "2", alto: "3" };
    const conservada = await entorno.modulos.servicio.reemplazarItems(inicial.id, {
      version: inicial.actualizadoEn, items: [entrada],
    }, entorno.ventas.actor);
    expect(conservada.items[0]).toMatchObject({ unidadCobro: "UNIDAD", precioUnitario: "1320.00", importe: "1320.00" });
    const actualizada = await entorno.modulos.servicio.reemplazarItems(inicial.id, {
      version: conservada.actualizadoEn, items: [{ ...entrada, actualizarPrecio: true }],
    }, entorno.ventas.actor);
    expect(actualizada.items[0]).toMatchObject({ unidadCobro: "M2", precioUnitario: "2000.00", importe: "12000.00" });
  });

  it("rechaza cambiar la identidad del producto de un ítem existente", async () => {
    const propio = await escenarioPropio();
    const inicial = await crearBorrador(propio, { items: [itemUnidad(propio.referencias)] });
    const entrada = { ...entradaExistente(inicial.items[0]), productoId: propio.referencias.superficie.id };
    await expect(entorno.modulos.servicio.reemplazarItems(inicial.id, {
      version: inicial.actualizadoEn, items: [entrada],
    }, entorno.ventas.actor)).rejects.toMatchObject({ status: 409 });
    expect(await entorno.modulos.servicio.obtenerCotizacion(inicial.id)).toEqual(inicial);
  });

  it("conserva producto archivado incluido y rechaza nuevos ítems o actualización de precio", async () => {
    const propio = await escenarioPropio();
    const inicial = await crearBorrador(propio, { items: [itemUnidad(propio.referencias)] });
    await db.producto.update({ where: { id: propio.referencias.unidad.id }, data: { activo: false } });
    const conservada = await entorno.modulos.servicio.reemplazarItems(inicial.id, {
      version: inicial.actualizadoEn, items: [entradaExistente(inicial.items[0])],
    }, entorno.ventas.actor);
    expect(conservada.items[0]).toMatchObject({ precioUnitario: "1320.00", productoActivo: false });
    for (const item of [itemUnidad(propio.referencias), { ...entradaExistente(conservada.items[0]), actualizarPrecio: true }]) {
      await expect(entorno.modulos.servicio.reemplazarItems(inicial.id, {
        version: conservada.actualizadoEn, items: [item],
      }, entorno.ventas.actor)).rejects.toMatchObject({ status: 409 });
    }
  });

  it("conserva costos y margen personalizados hasta solicitar actualizarPrecio", async () => {
    const inicial = await crearBorrador(entorno, { items: [itemPersonalizado(entorno.referencias)] });
    const entrada = entradaExistente(inicial.items[0]);
    if (entrada.tipo !== "PERSONALIZADO") throw new Error("Falta el ítem personalizado.");
    entrada.margenPct = "10";
    entrada.lineas = [{ tipo: "TERCERO", descripcion: "Costo nuevo", unidad: "servicio", costo: "900" }];
    const conservada = await entorno.modulos.servicio.reemplazarItems(inicial.id, {
      version: inicial.actualizadoEn, items: [entrada],
    }, entorno.ventas.actor);
    expect(conservada.items[0]).toMatchObject({ costoTotal: "17980.80", margenPct: "35.00", importe: "27662.77" });
    expect(conservada.items[0].lineas).toEqual(inicial.items[0].lineas);
    const actualizada = await entorno.modulos.servicio.reemplazarItems(inicial.id, {
      version: conservada.actualizadoEn, items: [{ ...entrada, actualizarPrecio: true }],
    }, entorno.ventas.actor);
    expect(actualizada.items[0]).toMatchObject({ costoTotal: "900.00", margenPct: "10.00", importe: "1000.00" });
  });

  it("conserva material archivado mediante lineaId y rechaza referencias nuevas", async () => {
    const propio = await escenarioPropio();
    const inicial = await crearBorrador(propio, { items: [itemPersonalizado(propio.referencias)] });
    await db.material.update({ where: { id: propio.referencias.material.id }, data: { activo: false } });
    const entrada = { ...entradaExistente(inicial.items[0]), actualizarPrecio: true };
    const conservada = await entorno.modulos.servicio.reemplazarItems(inicial.id, {
      version: inicial.actualizadoEn, items: [entrada],
    }, entorno.ventas.actor);
    expect(conservada.items[0].lineas[0]).toMatchObject({ materialId: propio.referencias.material.id, costoUnitario: "2850.0000" });
    await expect(entorno.modulos.servicio.reemplazarItems(inicial.id, {
      version: conservada.actualizadoEn, items: [itemPersonalizado(propio.referencias)],
    }, entorno.ventas.actor)).rejects.toMatchObject({ status: 409 });
  });

  it("rechaza itemId ajeno y repetido sin alterar ítems ni bitácora", async () => {
    const inicial = await crearBorrador(entorno, { items: [itemUnidad(entorno.referencias)] });
    const ajena = await crearBorrador(entorno, { items: [itemUnidad(entorno.referencias)] });
    const eventos = await db.bitacora.count({ where: { cotizacionId: inicial.id } });
    await expect(entorno.modulos.servicio.reemplazarItems(inicial.id, {
      version: inicial.actualizadoEn, items: [entradaExistente(ajena.items[0])],
    }, entorno.ventas.actor)).rejects.toMatchObject({ status: 409 });
    const repetida = entradaExistente(inicial.items[0]);
    await expect(entorno.modulos.servicio.reemplazarItems(inicial.id, {
      version: inicial.actualizadoEn, items: [repetida, repetida],
    }, entorno.ventas.actor)).rejects.toMatchObject({ status: 409 });
    expect(await entorno.modulos.servicio.obtenerCotizacion(inicial.id)).toEqual(inicial);
    expect(await db.bitacora.count({ where: { cotizacionId: inicial.id } })).toBe(eventos);
  });

  it("duplica asunto, condiciones, descuento e ítems con IVA y vigencia vigentes", async () => {
    const inicial = await crearBorrador(entorno, { items: [itemUnidad(entorno.referencias), itemPersonalizado(entorno.referencias)] });
    const editada = await entorno.modulos.servicio.editarCotizacion(inicial.id, {
      version: inicial.actualizadoEn, condiciones: "Anticipo acordado", descuento: "500",
    }, entorno.ventas.actor);
    const enviada = await entorno.modulos.servicio.enviarCotizacion(editada.id, editada.actualizadoEn, entorno.ventas.actor);
    await conConfiguracion(db, { iva_porcentaje: "10", cotizacion_vigencia_dias: "30" }, async () => {
      const duplicada = await entorno.modulos.servicio.duplicarCotizacion(enviada.id, entorno.ventas.actor);
      expect(duplicada).toMatchObject({ cotizacionOrigenId: enviada.id, estado: "BORRADOR", asunto: enviada.asunto,
        condiciones: enviada.condiciones, descuento: "500.00", tasaImpuesto: "10.00", vigenciaDias: 30,
        fechaEmision: null, fechaVencimiento: null, fechaRespuesta: null, motivoRechazo: null, archivada: false });
      expect(duplicada.id).not.toBe(enviada.id);
      expect(duplicada.numero).not.toBe(enviada.numero);
      duplicada.items.forEach((item, indice) => {
        expect(item.id).not.toBe(enviada.items[indice].id);
        expect(item).toMatchObject({ importe: enviada.items[indice].importe, precioUnitario: enviada.items[indice].precioUnitario });
      });
      expect(totales(duplicada)).toEqual(totalizarCotizacion({ items: duplicada.items, descuento: "500", tasaImpuesto: "10" }));
      expect((await db.bitacora.findFirstOrThrow({ where: { cotizacionId: duplicada.id } })).accion).toBe("CREAR");
    });
  });

  it("duplica origen archivado y conserva producto archivado con aviso", async () => {
    const propio = await escenarioPropio();
    const inicial = await crearBorrador(propio, { items: [itemUnidad(propio.referencias)] });
    const archivada = await entorno.modulos.servicio.archivarCotizacion(inicial.id, inicial.actualizadoEn, entorno.ventas.actor);
    await db.producto.update({ where: { id: propio.referencias.unidad.id }, data: { activo: false, precioBase: "9999" } });
    const duplicada = await entorno.modulos.servicio.duplicarCotizacion(archivada.id, entorno.ventas.actor);
    expect(duplicada).toMatchObject({ archivada: false, cotizacionOrigenId: inicial.id, estado: "BORRADOR" });
    expect(duplicada.items[0]).toMatchObject({ productoId: propio.referencias.unidad.id, precioUnitario: "1320.00", productoActivo: false });
    expect(duplicada.avisos.join(" ")).toMatch(/archivad/i);
  });

  it("rechaza duplicar cuando el cliente del origen está archivado", async () => {
    const propio = await escenarioPropio();
    const inicial = await crearBorrador(propio);
    await db.cliente.update({ where: { id: propio.referencias.cliente.id }, data: { activo: false } });
    await expect(entorno.modulos.servicio.duplicarCotizacion(inicial.id, entorno.ventas.actor)).rejects.toMatchObject({ status: 409 });
    expect(await db.cotizacion.count({ where: { cotizacionOrigenId: inicial.id } })).toBe(0);
  });
});
