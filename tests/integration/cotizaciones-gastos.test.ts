import { afterAll, beforeAll, expect, it } from "vitest";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { liberarClienteGlobal } from "../helpers/auth";
import { prepararCotizaciones, crearBorrador, itemPersonalizado, type EntornoCotizaciones } from "./cotizaciones-ayudas";
import { gastosIniciales } from "@/modules/personalizadas/gastos-schema";
import { aEntradaItem } from "@/modules/cotizaciones/calculo";

describeConBase("cotizaciones: persistencia de gastos personalizados", () => {
  const db = crearClientePropietario();
  let e: EntornoCotizaciones;
  beforeAll(async () => { e = await prepararCotizaciones(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });
  it("conserva instantánea, recalcula cantidades y quita gastos sin duplicar líneas", async () => {
    const gastos = { ...gastosIniciales("NIO"), rentaValor: "1500", imprevistosPct: "5", kmIda: "10" };
    const inicial = await crearBorrador(e, { items: [{ ...itemPersonalizado(e.referencias), gastosPersonalizados: gastos }] });
    expect(inicial.items[0].gastosPersonalizados).toEqual(gastos);
    expect(inicial.items[0].lineas.filter(l => l.esGastoPersonalizado)).toHaveLength(3);
    const conservada = await e.modulos.servicio.reemplazarItems(inicial.id, { version: inicial.actualizadoEn, items: [aEntradaItem(inicial.items[0])] }, e.ventas.actor);
    expect(conservada.items[0]).toEqual(inicial.items[0]);
    const item = aEntradaItem(conservada.items[0]);
    if (item.tipo !== "PERSONALIZADO") throw new Error("Tipo incorrecto");
    const editada = await e.modulos.servicio.reemplazarItems(inicial.id, { version: conservada.actualizadoEn, items: [{ ...item, actualizarPrecio: true, gastosPersonalizados: { ...gastos, kmIda: "20" } }] }, e.ventas.actor);
    expect(editada.items[0].lineas.filter(l => l.esGastoPersonalizado)).toHaveLength(3);
    expect(editada.items[0].lineas.find(l => l.descripcion.startsWith("Traslado:"))?.importe).toBe("640.00");
    await expect(e.modulos.servicio.editarCotizacion(inicial.id, { version: editada.actualizadoEn, descuento: "50" }, e.ventas.actor)).rejects.toMatchObject({ status: 422 });
    const sin = aEntradaItem(editada.items[0]);
    if (sin.tipo !== "PERSONALIZADO") throw new Error("Tipo incorrecto");
    const quitada = await e.modulos.servicio.reemplazarItems(inicial.id, { version: editada.actualizadoEn, items: [{ ...sin, actualizarPrecio: true, gastosPersonalizados: null }] }, e.ventas.actor);
    expect(quitada.items[0].gastosPersonalizados).toBeUndefined();
    expect(quitada.items[0].lineas.some(l => l.esGastoPersonalizado)).toBe(false);
    expect(quitada.items[0].lineas).toHaveLength(3);
  });
});
