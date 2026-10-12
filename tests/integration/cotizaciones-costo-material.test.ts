import { afterAll, beforeAll, expect, it } from "vitest";

import { liberarClienteGlobal } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import {
  crearBorrador, entradaExistente, itemPersonalizado, prepararCotizaciones, type EntornoCotizaciones,
} from "./cotizaciones-ayudas";

describeConBase("cotizaciones: costo de las líneas con material registrado", () => {
  const db = crearClientePropietario();
  let entorno: EntornoCotizaciones;
  beforeAll(async () => { entorno = await prepararCotizaciones(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  it("ignora el costo enviado y toma el costo promedio del servidor al crear", async () => {
    const item = itemPersonalizado(entorno.referencias);
    item.lineas[0] = { ...item.lineas[0], tipo: "MATERIAL", costoUnitario: "1" } as typeof item.lineas[0];
    const cotizacion = await crearBorrador(entorno, { items: [item] });
    expect(cotizacion.items[0].lineas[0]).toMatchObject({ materialId: entorno.referencias.material.id, costoUnitario: "2850.0000" });
  });

  it("conserva el costo guardado al editar y no deja falsearlo con un costo menor", async () => {
    const cotizacion = await crearBorrador(entorno, { items: [itemPersonalizado(entorno.referencias)] });
    const reenvio = entradaExistente(cotizacion.items[0]);
    if (reenvio.tipo !== "PERSONALIZADO") throw new Error("Se esperaba un ítem personalizado.");
    reenvio.lineas[0] = { ...reenvio.lineas[0], tipo: "MATERIAL", cantidad: "6", costoUnitario: "1" } as typeof reenvio.lineas[0];
    const editada = await entorno.modulos.servicio.reemplazarItems(
      cotizacion.id, { version: cotizacion.actualizadoEn, items: [reenvio] }, entorno.ventas.actor,
    );
    expect(editada.items[0].lineas[0].costoUnitario).toBe("2850.0000");
  });

  it("permite el costo libre en una línea sin material registrado", async () => {
    const item = itemPersonalizado(entorno.referencias);
    item.lineas = [{ tipo: "MATERIAL", descripcion: "Compra especial", unidad: "unidad", cantidad: "2", costoUnitario: "10.125", mermaPct: "0" }];
    const cotizacion = await crearBorrador(entorno, { items: [item] });
    expect(cotizacion.items[0].lineas[0]).toMatchObject({ materialId: null, costoUnitario: "10.1250" });
  });
});
