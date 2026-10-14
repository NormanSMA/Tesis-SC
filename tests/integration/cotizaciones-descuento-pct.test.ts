import { afterAll, beforeAll, expect, it } from "vitest";

import { liberarClienteGlobal } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import {
  crearBorrador, entradaExistente, itemUnidad, prepararCotizaciones, type EntornoCotizaciones,
} from "./cotizaciones-ayudas";

describeConBase("cotizaciones: descuento por porcentaje", () => {
  const db = crearClientePropietario();
  let entorno: EntornoCotizaciones;
  beforeAll(async () => { entorno = await prepararCotizaciones(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  const servicio = () => entorno.modulos.servicio;
  const actor = () => entorno.ventas.actor;

  it("fijar 10 % calcula el monto sobre el subtotal", async () => {
    const borrador = await crearBorrador(entorno, { items: [itemUnidad(entorno.referencias, "3")] });
    expect(borrador.subtotal).toBe("3960.00");
    const editada = await servicio().editarCotizacion(borrador.id, { version: borrador.actualizadoEn, descuentoPct: "10" }, actor());
    expect(editada).toMatchObject({ descuentoPct: "10.00", descuento: "396.00", impuesto: "534.60", total: "4098.60" });
    const fila = await db.cotizacion.findUniqueOrThrow({ where: { id: borrador.id } });
    expect(fila.descuentoPct?.toFixed(2)).toBe("10.00");
    const bitacora = await db.bitacora.findFirstOrThrow({ where: { entidadId: borrador.id, accion: "EDITAR" }, orderBy: { creadoEn: "desc" } });
    expect(JSON.stringify(bitacora.detalle)).toContain("descuentoPct");
  });

  it("reemplazar ítems recalcula el monto con el porcentaje vigente", async () => {
    const borrador = await crearBorrador(entorno, { items: [itemUnidad(entorno.referencias, "1")] });
    const con = await servicio().editarCotizacion(borrador.id, { version: borrador.actualizadoEn, descuentoPct: "10" }, actor());
    expect(con.descuento).toBe("132.00");
    const nueva = await servicio().reemplazarItems(con.id, {
      version: con.actualizadoEn, items: [...con.items.map(entradaExistente), itemUnidad(entorno.referencias, "1")],
    }, actor());
    expect(nueva).toMatchObject({ subtotal: "2640.00", descuentoPct: "10.00", descuento: "264.00" });
  });

  it("escribir un monto fijo limpia el porcentaje y descuentoPct null conserva el monto", async () => {
    const borrador = await crearBorrador(entorno, { items: [itemUnidad(entorno.referencias, "1")] });
    const con = await servicio().editarCotizacion(borrador.id, { version: borrador.actualizadoEn, descuentoPct: "10" }, actor());
    const monto = await servicio().editarCotizacion(con.id, { version: con.actualizadoEn, descuento: "50" }, actor());
    expect(monto).toMatchObject({ descuentoPct: null, descuento: "50.00" });
    const otra = await servicio().editarCotizacion(monto.id, { version: monto.actualizadoEn, descuentoPct: "5" }, actor());
    expect(otra).toMatchObject({ descuentoPct: "5.00", descuento: "66.00" });
    const limpia = await servicio().editarCotizacion(otra.id, { version: otra.actualizadoEn, descuentoPct: null }, actor());
    expect(limpia).toMatchObject({ descuentoPct: null, descuento: "66.00" });
  });

  it("duplicar y crear la versión corregida copian el porcentaje", async () => {
    const borrador = await crearBorrador(entorno, { items: [itemUnidad(entorno.referencias, "1")] });
    const con = await servicio().editarCotizacion(borrador.id, { version: borrador.actualizadoEn, descuentoPct: "10" }, actor());
    const copia = await servicio().duplicarCotizacion(con.id, actor());
    expect(copia).toMatchObject({ descuentoPct: "10.00", descuento: "132.00" });
    const enviada = await servicio().enviarCotizacion(con.id, con.actualizadoEn, actor());
    const ajuste = await servicio().responderCotizacion(con.id, {
      version: enviada.actualizadoEn, resultado: "AJUSTE_SOLICITADO", motivoAjuste: "Cambiar las medidas",
    }, actor());
    const corregida = await servicio().crearVersionCorregida(ajuste.id, actor());
    expect(corregida).toMatchObject({ descuentoPct: "10.00", descuento: "132.00" });
  });

  it("rechaza monto y porcentaje juntos en el esquema de la API", async () => {
    const { esquemaEditarCotizacion } = await import("@/modules/cotizaciones/schema");
    const borrador = await crearBorrador(entorno);
    expect(esquemaEditarCotizacion.safeParse({ version: borrador.actualizadoEn, descuento: "5", descuentoPct: "10" }).success).toBe(false);
  });

  it("rechaza en la base un porcentaje mayor que 100", async () => {
    const borrador = await crearBorrador(entorno);
    await expect(db.cotizacion.update({ where: { id: borrador.id }, data: { descuentoPct: "100.01" } })).rejects.toThrow();
    await expect(db.cotizacion.update({ where: { id: borrador.id }, data: { descuentoPct: "-0.01" } })).rejects.toThrow();
    expect(await servicio().obtenerCotizacion(borrador.id)).toMatchObject({ descuentoPct: null });
  });
});
