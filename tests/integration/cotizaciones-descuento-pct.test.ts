import { afterAll, beforeAll, expect, it } from "vitest";

import { liberarClienteGlobal } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import {
  conConfiguracion, crearBorrador, entradaExistente, itemPersonalizado, itemUnidad, prepararCotizaciones, type EntornoCotizaciones,
} from "./cotizaciones-ayudas";

describeConBase("cotizaciones: descuento por porcentaje", () => {
  const db = crearClientePropietario();
  let entorno: EntornoCotizaciones;
  beforeAll(async () => { entorno = await prepararCotizaciones(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  const servicio = () => entorno.modulos.servicio;
  const actor = () => entorno.ventas.actor;

  it("calcula instalación y aplica a dos materiales las dimensiones de un solo trabajo", async () => {
    const primero = await db.material.create({ data: {
      codigo: `AREA-${crypto.randomUUID().slice(0, 8)}`, nombre: "Acrílico para prueba", unidad: "M2",
      unidadCotizacion: "M2", precioCotizacion: "100",
    } });
    const segundo = await db.material.create({ data: {
      codigo: `AREA-${crypto.randomUUID().slice(0, 8)}`, nombre: "Vinil para prueba", unidad: "ROLLO",
      unidadCotizacion: "M2", areaUnidadInventario: "10", precioCotizacion: "50",
    } });
    const base = itemPersonalizado(entorno.referencias);
    const partida = { ...base, unidadCobro: "M2" as const, ancho: "1.20", alto: "0.80", margenPct: "0", lineas: [primero, segundo].map((material) => ({
      tipo: "MATERIAL" as const, materialId: material.id, unidad: "unidad", descripcion: material.nombre, cantidad: "20", mermaPct: "0",
    })) };
    const borrador = await servicio().crearCotizacion({
      clienteId: entorno.referencias.cliente.id, asunto: "Acrílico forrado", items: [partida],
      instalacion: { km: "10", destino: "Instalación fuera de Estelí", manoObra: "50" },
    }, actor());
    expect(borrador.items[0].lineas.map(({ cantidad, unidad, importe }) => ({ cantidad, unidad, importe }))).toEqual([
      { cantidad: "0.960", unidad: "M2", importe: "96.00" }, { cantidad: "0.960", unidad: "M2", importe: "48.00" },
    ]);
    expect(borrador).toMatchObject({ subtotal: "144.00", total: "394.00", instalacion: { tarifa: "20.00", total: "250.00" } });
    const enviada = await servicio().enviarCotizacion(borrador.id, borrador.actualizadoEn, actor());
    expect(enviada.total).toBe("394.00");
  });

  it("pide el área del pliego completo y cotiza solo la fracción usada", async () => {
    const material = await db.material.create({ data: {
      codigo: `AREA-${crypto.randomUUID().slice(0, 8)}`, nombre: "Lámina de acrílico", unidad: "PLIEGO", costoPromedio: "2850",
    } });
    const linea = { tipo: "MATERIAL" as const, materialId: material.id, unidad: "PLIEGO",
      descripcion: material.nombre, cantidad: "1", mermaPct: "0" };
    const entrada = { clienteId: entorno.referencias.cliente.id, asunto: "Fracción de lámina", items: [{
      ...itemPersonalizado(entorno.referencias), unidadCobro: "M2" as const, ancho: "1.20", alto: "0.80",
      margenPct: "0", lineas: [linea],
    }] };
    await expect(servicio().crearCotizacion(entrada, actor())).rejects.toMatchObject({
      status: 422, campos: { "items.0.lineas.0.materialId": expect.stringContaining("Configure en Inventario") },
    });
    await db.material.update({ where: { id: material.id }, data: { unidadCotizacion: "M2", areaUnidadInventario: "3" } });
    const guardada = await servicio().crearCotizacion(entrada, actor());
    expect(guardada.items[0].lineas[0]).toMatchObject({
      cantidad: "0.960", unidad: "M2", costoUnitario: "950.0000", importe: "912.00", areaUnidadInventario: "3.000000",
    });
  });

  it("crea el formulario completo, congela la tarifa y permite reemplazar o quitar el descuento manual", async () => {
    const borrador = await servicio().crearCotizacion({
      clienteId: entorno.referencias.cliente.id, asunto: "Tarifa preferencial",
      tarifa: "PREFERENCIAL", mostrarCondiciones: false, items: [itemUnidad(entorno.referencias)],
    }, actor());
    expect(borrador).toMatchObject({ tarifaPct: "10.00", mostrarCondiciones: false, descuento: "132.00", total: "1188.00" });
    expect(borrador.items).toHaveLength(1);
    await conConfiguracion(db, { tarifa_preferencial_pct: "15" }, async () => {
      const editada = await servicio().editarCotizacion(borrador.id, {
        version: borrador.actualizadoEn, descuentoPct: "2", mostrarCondiciones: true,
      }, actor());
      expect(editada).toMatchObject({ tarifaPct: "10.00", descuentoManual: true, mostrarCondiciones: true, descuento: "26.40", total: "1293.60" });
      const restablecida = await servicio().editarCotizacion(editada.id, {
        version: editada.actualizadoEn, descuentoManual: false,
      }, actor());
      expect(restablecida).toMatchObject({ tarifaPct: "10.00", descuentoManual: false, descuento: "132.00" });
      const ocasional = await servicio().editarCotizacion(restablecida.id, {
        version: restablecida.actualizadoEn, tarifa: "OCASIONAL",
      }, actor());
      expect(ocasional).toMatchObject({ tarifaPct: "0.00", descuento: "0.00", total: "1320.00" });
    });
  });

  it("fijar 10 % calcula el monto sobre el subtotal", async () => {
    const borrador = await crearBorrador(entorno, { items: [itemUnidad(entorno.referencias, "3")] });
    expect(borrador.subtotal).toBe("3960.00");
    const editada = await servicio().editarCotizacion(borrador.id, { version: borrador.actualizadoEn, descuentoPct: "10" }, actor());
    expect(editada).toMatchObject({ descuentoPct: "10.00", descuento: "396.00", impuesto: "0.00", total: "3564.00" });
    const fila = await db.cotizacion.findUniqueOrThrow({ where: { id: borrador.id } });
    expect(fila.descuentoPct?.toFixed(2)).toBe("10.00");
    const bitacora = await db.bitacora.findFirstOrThrow({ where: { entidadId: borrador.id, accion: "EDITAR" }, orderBy: { creadoEn: "desc" } });
    expect(JSON.stringify(bitacora.detalle)).toContain("descuentoPct");
  });

  it("reemplazar productos recalcula el monto con el porcentaje vigente", async () => {
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
