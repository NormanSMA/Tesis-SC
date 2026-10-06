import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";

import { costearItemCatalogo, costearItemPersonalizado, totalizarCotizacion } from "@/core/costeo";
import { CONDICIONES_PREDETERMINADAS } from "@/modules/cotizaciones/schema";
import { liberarClienteGlobal } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import {
  conConfiguracion, crearBorrador, itemPersonalizado, itemsMixtos, itemUnidad,
  prepararCotizaciones, totales, type EntornoCotizaciones,
} from "./cotizaciones-ayudas";

describeConBase("cotizaciones: creación y costeo persistido", () => {
  const db = crearClientePropietario();
  let entorno: EntornoCotizaciones;
  beforeAll(async () => { entorno = await prepararCotizaciones(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  it("crea un borrador numerado con cliente activo, IVA y vigencia vigentes", async () => {
    const cotizacion = await crearBorrador(entorno);
    expect(cotizacion).toMatchObject({
      clienteId: entorno.referencias.cliente.id, estado: "BORRADOR", moneda: "NIO", tasaImpuesto: "15.00",
      vigenciaDias: 15, fechaEmision: null, fechaVencimiento: null, fechaRespuesta: null,
      archivada: false, subtotal: "0.00", total: "0.00", items: [],
    });
    expect(cotizacion.numero).toMatch(/^COT-\d{4}-\d{4,}$/);
    expect(cotizacion.actualizadoEn).toMatch(/Z$/);
    const eventos = await db.bitacora.findMany({ where: { cotizacionId: cotizacion.id } });
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({
      entidad: "COTIZACION", entidadId: cotizacion.id, accion: "CREAR",
      estadoNuevo: "BORRADOR", usuarioId: entorno.ventas.usuarioId,
    });
  });

  it("rechaza un cliente archivado sin crear cotización ni bitácora", async () => {
    const cliente = await db.cliente.create({
      data: { nombre: `Archivado ${randomUUID()}`, tipo: "EMPRESA", telefono: "8888", activo: false },
    });
    await expect(entorno.modulos.servicio.crearCotizacion({
      clienteId: cliente.id, asunto: "No permitido",
    }, entorno.ventas.actor)).rejects.toMatchObject({ status: 409 });
    expect(await db.cotizacion.count({ where: { clienteId: cliente.id } })).toBe(0);
  });

  it("precarga las condiciones predeterminadas cuando falta la configuración", async () => {
    await conConfiguracion(db, { cotizacion_condiciones: null }, async () => {
      expect((await crearBorrador(entorno)).condiciones).toBe(CONDICIONES_PREDETERMINADAS);
    });
  });

  it("precarga condiciones configuradas y permite condiciones explícitas", async () => {
    await conConfiguracion(db, { cotizacion_condiciones: "Entrega con anticipo del 50 %." }, async () => {
      expect((await crearBorrador(entorno)).condiciones).toBe("Entrega con anticipo del 50 %.");
      const cotizacion = await entorno.modulos.servicio.crearCotizacion({
        clienteId: entorno.referencias.cliente.id, asunto: "Condiciones propias", condiciones: "Pago contado",
      }, entorno.ventas.actor);
      expect(cotizacion.condiciones).toBe("Pago contado");
    });
  });

  it("persiste el caso exacto de costo 17980.80, margen 35 e IVA 15", async () => {
    const cotizacion = await crearBorrador(entorno, { items: [itemPersonalizado(entorno.referencias)] });
    expect(cotizacion.items[0]).toMatchObject({ costoTotal: "17980.80", margenPct: "35.00", importe: "27662.77" });
    expect(cotizacion).toMatchObject({ subtotal: "27662.77", impuesto: "4149.42", total: "31812.19" });
    expect(cotizacion.items[0].lineas.map((linea) => linea.importe)).toEqual(["15390.00", "600.00", "1990.80"]);
    const enviada = await entorno.modulos.servicio.enviarCotizacion(cotizacion.id, cotizacion.actualizadoEn, entorno.ventas.actor);
    expect(enviada.estado).toBe("ENVIADA");
    expect(totales(enviada)).toEqual(totales(cotizacion));
  });

  it("CF-10: totaliza catálogo UNIDAD, catálogo M2 y personalizado con el motor", async () => {
    const cotizacion = await crearBorrador(entorno, { items: itemsMixtos(entorno.referencias) });
    const esperados = [
      costearItemCatalogo({ unidadCobro: "UNIDAD", precioBase: "1320", cantidad: "3" }),
      costearItemCatalogo({ unidadCobro: "M2", precioBase: "1025", cantidad: "2", ancho: "0.333", alto: "0.777" }),
      costearItemPersonalizado({ cantidad: "1", margenPct: "35", lineas: [
        { tipo: "MATERIAL", cantidad: "5", costoUnitario: "2850", mermaPct: "8" },
        { tipo: "MANO_OBRA", horas: "4", tarifa: "150" }, { tipo: "TERCERO", costo: "1990.80" },
      ] }),
    ];
    cotizacion.items.forEach((item, indice) => expect(item).toMatchObject(esperados[indice]));
    expect(totales(cotizacion)).toEqual(totalizarCotizacion({ items: esperados, descuento: "0", tasaImpuesto: "15" }));
    const guardados = await db.itemCotizacion.findMany({ where: { cotizacionId: cotizacion.id }, orderBy: { secuencia: "asc" } });
    expect(guardados.map((item) => item.importe.toFixed(2))).toEqual(esperados.map((item) => item.importe));
    expect((await entorno.modulos.servicio.enviarCotizacion(cotizacion.id, cotizacion.actualizadoEn, entorno.ventas.actor)).estado).toBe("ENVIADA");
  });

  it("interpreta las líneas como consumos totales aunque cambie la cantidad personalizada", async () => {
    const item = { ...itemPersonalizado(entorno.referencias), cantidad: "2" };
    const cotizacion = await crearBorrador(entorno, { items: [item] });
    expect(cotizacion.items[0]).toMatchObject({ cantidad: "2.000", costoTotal: "17980.80", importe: "27662.77", precioUnitario: "13831.39" });
  });

  it("permite costos materiales explícitos y referencias materiales opcionales", async () => {
    const item = itemPersonalizado(entorno.referencias);
    item.lineas = [{ tipo: "MATERIAL", descripcion: "Compra especial", unidad: "unidad", cantidad: "2", costoUnitario: "10.125", mermaPct: "0" }];
    const cotizacion = await crearBorrador(entorno, { items: [item] });
    expect(cotizacion.items[0].lineas[0]).toMatchObject({ materialId: null, costoUnitario: "10.1250", importe: "20.25" });
  });

  it("aplica descuento global y admite descuento igual al subtotal", async () => {
    const inicial = await crearBorrador(entorno, { items: [itemUnidad(entorno.referencias)] });
    const parcial = await entorno.modulos.servicio.editarCotizacion(inicial.id, {
      version: inicial.actualizadoEn, descuento: "100",
    }, entorno.ventas.actor);
    expect(totales(parcial)).toEqual(totalizarCotizacion({ items: parcial.items, descuento: "100", tasaImpuesto: "15" }));
    const completo = await entorno.modulos.servicio.editarCotizacion(parcial.id, {
      version: parcial.actualizadoEn, descuento: parcial.subtotal,
    }, entorno.ventas.actor);
    expect(completo).toMatchObject({ impuesto: "0.00", total: "0.00" });
  });

  it("rechaza descuento superior al subtotal y conserva la cotización", async () => {
    const inicial = await crearBorrador(entorno, { items: [itemUnidad(entorno.referencias)] });
    await expect(entorno.modulos.servicio.editarCotizacion(inicial.id, {
      version: inicial.actualizadoEn, descuento: "1320.01",
    }, entorno.ventas.actor)).rejects.toMatchObject({ status: 422 });
    expect(await entorno.modulos.servicio.obtenerCotizacion(inicial.id)).toEqual(inicial);
  });

  it("rechaza reemplazar con subtotal menor al descuento y revierte los ítems", async () => {
    const inicial = await crearBorrador(entorno, { items: [itemUnidad(entorno.referencias)] });
    const descontada = await entorno.modulos.servicio.editarCotizacion(inicial.id, {
      version: inicial.actualizadoEn, descuento: "100",
    }, entorno.ventas.actor);
    await expect(entorno.modulos.servicio.reemplazarItems(inicial.id, {
      version: descontada.actualizadoEn, items: [],
    }, entorno.ventas.actor)).rejects.toMatchObject({ status: 422 });
    expect(await entorno.modulos.servicio.obtenerCotizacion(inicial.id)).toEqual(descontada);
  });
});
