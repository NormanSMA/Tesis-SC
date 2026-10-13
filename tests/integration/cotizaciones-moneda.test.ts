import { afterAll, beforeAll, expect, it } from "vitest";

import { liberarClienteGlobal } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import {
  conConfiguracion, crearBorrador, entradaExistente, itemPersonalizado, itemUnidad,
  prepararCotizaciones, type EntornoCotizaciones,
} from "./cotizaciones-ayudas";

describeConBase("cotizaciones: moneda y tipo de cambio congelado", () => {
  const db = crearClientePropietario();
  let entorno: EntornoCotizaciones;
  beforeAll(async () => { entorno = await prepararCotizaciones(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  const servicio = () => entorno.modulos.servicio;

  it("crea en córdobas con tipo de cambio 1 por defecto", async () => {
    const cotizacion = await crearBorrador(entorno);
    expect(cotizacion).toMatchObject({ moneda: "NIO", tipoCambio: "1.0000" });
  });

  it("congela el tipo de cambio de la configuración al crear en USD", async () => {
    await conConfiguracion(db, { tipo_cambio_usd: "36.6243" }, async () => {
      const cotizacion = await crearBorrador(entorno, { moneda: "USD" });
      expect(cotizacion).toMatchObject({ moneda: "USD", tipoCambio: "36.6243" });
      await conConfiguracion(db, { tipo_cambio_usd: "40" }, async () => {
        expect(await servicio().obtenerCotizacion(cotizacion.id)).toMatchObject({ moneda: "USD", tipoCambio: "36.6243" });
        const editada = await servicio().editarCotizacion(cotizacion.id, {
          version: cotizacion.actualizadoEn, descuento: "0",
        }, entorno.ventas.actor);
        expect(editada).toMatchObject({ moneda: "USD", tipoCambio: "36.6243" });
      });
    });
  });

  it("usa la moneda de la configuración cuando el cuerpo no la indica", async () => {
    await conConfiguracion(db, { moneda: "USD", tipo_cambio_usd: "36.6243" }, async () => {
      expect(await crearBorrador(entorno)).toMatchObject({ moneda: "USD", tipoCambio: "36.6243" });
      expect(await crearBorrador(entorno, { moneda: "NIO" })).toMatchObject({ moneda: "NIO", tipoCambio: "1.0000" });
    });
  });

  it.each([null, "0.5", "0.9999", "1000.01"])("rechaza USD con tipo de cambio de configuración %s", async (valor) => {
    await conConfiguracion(db, { tipo_cambio_usd: valor }, async () => {
      const antes = await db.cotizacion.count();
      await expect(crearBorrador(entorno, { moneda: "USD" }))
        .rejects.toMatchObject({ status: 409, codigo: "CONFIGURACION_INVALIDA" });
      expect(await db.cotizacion.count()).toBe(antes);
    });
  });

  it("copia moneda y tipo de cambio al duplicar y al crear la versión corregida", async () => {
    const origen = await conConfiguracion(db, { tipo_cambio_usd: "36.6243" }, () => crearBorrador(entorno, {
      moneda: "USD", items: [itemUnidad(entorno.referencias)],
    }));
    await conConfiguracion(db, { moneda: "NIO", tipo_cambio_usd: "40" }, async () => {
      const copia = await servicio().duplicarCotizacion(origen.id, entorno.ventas.actor);
      expect(copia).toMatchObject({ moneda: "USD", tipoCambio: "36.6243" });
      const enviada = await servicio().enviarCotizacion(origen.id, origen.actualizadoEn, entorno.ventas.actor);
      const ajuste = await servicio().responderCotizacion(origen.id, {
        version: enviada.actualizadoEn, resultado: "AJUSTE_SOLICITADO", motivoAjuste: "Cambiar las medidas",
      }, entorno.ventas.actor);
      const corregida = await servicio().crearVersionCorregida(ajuste.id, entorno.ventas.actor);
      expect(corregida).toMatchObject({ moneda: "USD", tipoCambio: "36.6243" });
    });
  });

  it("convierte el catálogo y el material solo al tomarlos de córdobas", async () => {
    await conConfiguracion(db, { tipo_cambio_usd: "36.6243" }, async () => {
      const cotizacion = await crearBorrador(entorno, {
        moneda: "USD", items: [itemUnidad(entorno.referencias, "3"), itemPersonalizado(entorno.referencias)],
      });
      expect(cotizacion.items[0]).toMatchObject({ precioUnitario: "36.04", importe: "108.12" });
      expect(cotizacion.items[1].lineas.map((linea) => linea.costoUnitario)).toEqual(["77.8172", "150.0000", "1990.8000"]);
      const reenvio = cotizacion.items.map(entradaExistente);
      const editada = await servicio().reemplazarItems(cotizacion.id, {
        version: cotizacion.actualizadoEn, items: reenvio,
      }, entorno.ventas.actor);
      expect(editada.items[0].precioUnitario).toBe("36.04");
      expect(editada.items[1].lineas[0].costoUnitario).toBe("77.8172");
      const copia = await servicio().duplicarCotizacion(cotizacion.id, entorno.ventas.actor);
      expect(copia.items[0].precioUnitario).toBe("36.04");
      expect(copia.items[1].lineas[0].costoUnitario).toBe("77.8172");
    });
  });

  it("rechaza en la base una cotización en córdobas con tipo de cambio distinto de 1", async () => {
    const cotizacion = await crearBorrador(entorno);
    await expect(db.cotizacion.update({ where: { id: cotizacion.id }, data: { tipoCambio: "36.6243" } })).rejects.toThrow();
    await expect(db.cotizacion.update({ where: { id: cotizacion.id }, data: { moneda: "EUR" } })).rejects.toThrow();
    expect(await servicio().obtenerCotizacion(cotizacion.id)).toMatchObject({ moneda: "NIO", tipoCambio: "1.0000" });
  });
});
