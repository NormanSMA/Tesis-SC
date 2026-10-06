import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { liberarClienteGlobal } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { crearBorrador, itemPersonalizado, itemUnidad } from "./cotizaciones-ayudas";
import { crearAprobada, crearOrden, entradaConversion, prepararOrdenes, type EntornoOrdenes } from "./ordenes-ayudas";

describeConBase("órdenes: conversión y concurrencia", () => {
  const db = crearClientePropietario();
  let entorno: EntornoOrdenes;
  beforeAll(async () => { entorno = await prepararOrdenes(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  it("convierte con etapas activas, estimado agregado y eventos transaccionales", async () => {
    const cotizacion = await crearAprobada(entorno);
    const entrada = entradaConversion(entorno, cotizacion.id);
    const orden = await entorno.modulos.servicio.crearOrden(entrada, entorno.sesiones.VENTAS.actor);
    expect(orden.numero).toMatch(/^OT-\d{4}-\d{4,}$/);
    expect(orden).toMatchObject({ estado: "PENDIENTE", fechaEntrega: entrada.fechaEntrega, especificaciones: entrada.especificaciones });
    expect(orden.etapas.map((etapa) => [etapa.nombre, etapa.estado, etapa.responsable])).toEqual([
      ["Diseño", "PENDIENTE", null], ["Impresión", "PENDIENTE", null],
    ]);
    expect(orden.consumosEstimados.map((consumo) => [consumo.cantidad, consumo.origen])).toEqual([["9.409", "RECETA"]]);
    expect(orden.items.map((item) => item.id)).toEqual(cotizacion.items.map((item) => item.id));
    expect(orden.cotizacion.total).toBe(cotizacion.total);
    const eventos = await db.bitacora.findMany({ where: { ordenId: orden.id } });
    expect(eventos).toHaveLength(3);
    expect(eventos.filter((evento) => evento.accion === "CONVERTIR_EN_ORDEN")[0])
      .toMatchObject({ entidad: "ORDEN_TRABAJO", entidadId: orden.id, cotizacionId: cotizacion.id, usuarioId: entorno.sesiones.VENTAS.usuarioId });
    expect(eventos.filter((evento) => evento.accion === "CREAR")).toHaveLength(2);
    expect((await db.material.findUniqueOrThrow({ where: { id: entorno.cotizaciones.referencias.material.id } })).existencia.toFixed(3)).toBe("0.000");
  });

  it("propone categoría del mayor importe y especificaciones desde el asunto", async () => {
    const categoria = await db.categoria.create({ data: { nombre: `Propuesta ${randomUUID()}` } });
    const personalizado = itemPersonalizado(entorno.cotizaciones.referencias);
    const cotizacion = await crearAprobada(entorno, [itemUnidad(entorno.cotizaciones.referencias), { ...personalizado, categoriaId: categoria.id }]);
    expect(await entorno.modulos.servicio.proponerOrden(cotizacion.id, entorno.sesiones.VENTAS.actor))
      .toMatchObject({ categoriaId: categoria.id, especificaciones: cotizacion.asunto, orden: null });
    const { especificaciones: omitidas, ...entrada } = entradaConversion(entorno, cotizacion.id);
    expect(omitidas).toBeTruthy();
    const orden = await entorno.modulos.servicio.crearOrden(entrada, entorno.sesiones.VENTAS.actor);
    expect(orden.especificaciones).toBe(cotizacion.asunto);
  });

  it("la doble conversión responde ORDEN_EXISTENTE con el número", async () => {
    const orden = await crearOrden(entorno);
    await expect(entorno.modulos.servicio.crearOrden(entradaConversion(entorno, orden.cotizacion.id), entorno.sesiones.VENTAS.actor))
      .rejects.toMatchObject({ status: 409, codigo: "ORDEN_EXISTENTE", campos: { numero: orden.numero, ordenId: orden.id } });
  });

  it("el UNIQUE real de cotizacion_id se traduce a ORDEN_EXISTENTE tras revertir", async () => {
    const orden = await crearOrden(entorno);
    const antes = await db.contador.findMany({ where: { tipo: "ORDEN_TRABAJO" } });
    const { vi } = await import("vitest");
    const repo = await import("@/modules/ordenes/repo");
    const espia = vi.spyOn(repo, "buscarOrdenDeCotizacion").mockResolvedValueOnce(null);
    try {
      await expect(entorno.modulos.servicio.crearOrden(entradaConversion(entorno, orden.cotizacion.id), entorno.sesiones.VENTAS.actor))
        .rejects.toMatchObject({ status: 409, codigo: "ORDEN_EXISTENTE", campos: { numero: orden.numero } });
    } finally { espia.mockRestore(); }
    expect(await db.contador.findMany({ where: { tipo: "ORDEN_TRABAJO" } })).toEqual(antes);
    expect(await db.bitacora.count({ where: { ordenId: orden.id } })).toBe(3);
  });

  it("traduce SC004 cuando la cotización está en borrador", async () => {
    const cotizacion = await crearBorrador(entorno.cotizaciones, { items: [itemUnidad(entorno.cotizaciones.referencias)] });
    await expect(entorno.modulos.servicio.crearOrden(entradaConversion(entorno, cotizacion.id), entorno.sesiones.VENTAS.actor))
      .rejects.toMatchObject({ status: 409, codigo: "SC004" });
    expect(await db.ordenTrabajo.count({ where: { cotizacionId: cotizacion.id } })).toBe(0);
  });

  it("traduce el trigger real SC004 y revierte incluso ante una lectura alterada", async () => {
    const cotizacion = await crearBorrador(entorno.cotizaciones, { items: [itemUnidad(entorno.cotizaciones.referencias)] });
    const repo = await import("@/modules/ordenes/repo");
    const lectura = await repo.buscarCotizacion(db, cotizacion.id);
    if (!lectura) throw new Error("Falta la cotización de prueba.");
    const { vi } = await import("vitest");
    const espia = vi.spyOn(repo, "buscarCotizacion").mockResolvedValueOnce({ ...lectura, estado: "APROBADA" });
    try {
      await expect(entorno.modulos.servicio.crearOrden(entradaConversion(entorno, cotizacion.id), entorno.sesiones.VENTAS.actor))
        .rejects.toMatchObject({ status: 409, codigo: "SC004", mensaje: expect.stringContaining("APROBADA") });
    } finally { espia.mockRestore(); }
    expect(await db.ordenTrabajo.count({ where: { cotizacionId: cotizacion.id } })).toBe(0);
  });

  it("rechaza categoría sin plantillas activas sin crear orden", async () => {
    const cotizacion = await crearAprobada(entorno);
    const categoria = await db.categoria.create({ data: { nombre: `Sin plantilla ${randomUUID()}` } });
    const entrada = { ...entradaConversion(entorno, cotizacion.id), categoriaId: categoria.id };
    await expect(entorno.modulos.servicio.crearOrden(entrada, entorno.sesiones.VENTAS.actor))
      .rejects.toMatchObject({ status: 409, codigo: "SIN_PLANTILLA" });
    expect(await db.ordenTrabajo.count({ where: { cotizacionId: cotizacion.id } })).toBe(0);
  });

  it("dos conversiones simultáneas dejan un ganador y solo sus eventos", async () => {
    const cotizacion = await crearAprobada(entorno);
    const entrada = entradaConversion(entorno, cotizacion.id);
    const resultados = await Promise.allSettled([
      entorno.modulos.servicio.crearOrden(entrada, entorno.sesiones.VENTAS.actor),
      entorno.modulos.servicio.crearOrden(entrada, entorno.sesiones.VENTAS.actor),
    ]);
    const ganador = resultados.find((resultado) => resultado.status === "fulfilled");
    const perdedor = resultados.find((resultado) => resultado.status === "rejected");
    expect(ganador?.status).toBe("fulfilled");
    expect(perdedor?.status).toBe("rejected");
    if (ganador?.status !== "fulfilled" || perdedor?.status !== "rejected") throw new Error("La carrera no tuvo un ganador.");
    expect(perdedor.reason).toMatchObject({ status: 409, codigo: "ORDEN_EXISTENTE", campos: { numero: ganador.value.numero } });
    expect(await db.ordenTrabajo.count({ where: { cotizacionId: cotizacion.id } })).toBe(1);
    expect(await db.bitacora.count({ where: { ordenId: ganador.value.id } })).toBe(3);
    expect(await db.etapaOrden.count({ where: { ordenId: ganador.value.id } })).toBe(2);
  });

  it("revierte orden, etapas, estimado y numeración cuando falla un evento", async () => {
    const cotizacion = await crearAprobada(entorno);
    const antes = await db.contador.findMany({ where: { tipo: "ORDEN_TRABAJO" } });
    const servicio = entorno.modulos.servicio;
    const bitacora = await import("@/lib/bitacora");
    const { vi } = await import("vitest");
    const original = bitacora.registrarEvento;
    let llamadas = 0;
    const espia = vi.spyOn(bitacora, "registrarEvento").mockImplementation(async (tx, evento) => {
      if (++llamadas === 3) throw new Error("Fallo de bitácora de prueba");
      return original(tx, evento);
    });
    try {
      await expect(servicio.crearOrden(entradaConversion(entorno, cotizacion.id), entorno.sesiones.VENTAS.actor)).rejects.toThrow("Fallo de bitácora");
    } finally { espia.mockRestore(); }
    expect(llamadas).toBe(3);
    expect(await db.ordenTrabajo.count({ where: { cotizacionId: cotizacion.id } })).toBe(0);
    expect(await db.bitacora.count({ where: { cotizacionId: cotizacion.id, accion: "CONVERTIR_EN_ORDEN" } })).toBe(0);
    expect(await db.contador.findMany({ where: { tipo: "ORDEN_TRABAJO" } })).toEqual(antes);
  });

  it("lee la receta vigente dentro de la conversión", async () => {
    const referencias = entorno.cotizaciones.referencias;
    const cotizacion = await crearAprobada(entorno, [itemUnidad(referencias, "2")]);
    const where = { productoId_materialId: { productoId: referencias.unidad.id, materialId: referencias.material.id } };
    await db.recetaProducto.update({ where, data: { cantidad: "3.125" } });
    try {
      const orden = await entorno.modulos.servicio.crearOrden(entradaConversion(entorno, cotizacion.id), entorno.sesiones.VENTAS.actor);
      expect(orden.consumosEstimados[0].cantidad).toBe("6.250");
    } finally { await db.recetaProducto.update({ where, data: { cantidad: "1.250" } }); }
  });

  it("rechaza una unidad de cobro que cambió con RECETA_INCOMPATIBLE", async () => {
    const referencias = entorno.cotizaciones.referencias;
    const cotizacion = await crearAprobada(entorno, [itemUnidad(referencias)]);
    await db.producto.update({ where: { id: referencias.unidad.id }, data: { unidadCobro: "M2" } });
    try {
      await expect(entorno.modulos.servicio.crearOrden(entradaConversion(entorno, cotizacion.id), entorno.sesiones.VENTAS.actor))
        .rejects.toMatchObject({ codigo: "RECETA_INCOMPATIBLE", status: 409 });
      expect(await db.ordenTrabajo.count({ where: { cotizacionId: cotizacion.id } })).toBe(0);
    } finally { await db.producto.update({ where: { id: referencias.unidad.id }, data: { unidadCobro: "UNIDAD" } }); }
  });

  it("advierte unidades incompatibles sin sumar y conserva la advertencia en la ficha", async () => {
    const personalizado = itemPersonalizado(entorno.cotizaciones.referencias);
    const items = [{ ...personalizado, lineas: personalizado.lineas.map((linea) => ({ ...linea, unidad: "litro" })) }];
    const cotizacion = await crearAprobada(entorno, items);
    const orden = await entorno.modulos.servicio.crearOrden(entradaConversion(entorno, cotizacion.id), entorno.sesiones.VENTAS.actor);
    expect(orden.consumosEstimados).toEqual([]);
    expect(orden.advertencias).toHaveLength(1);
    expect(orden.advertencias[0].mensaje).toContain("no se estimó");
    const ficha = await entorno.modulos.servicio.obtenerOrden(orden.id, entorno.sesiones.PRODUCCION.actor);
    expect(ficha.advertencias).toEqual(orden.advertencias);
  });

  it("rechaza fecha pasada y responsable fuera de Producción con 422", async () => {
    const cotizacion = await crearAprobada(entorno);
    const entrada = entradaConversion(entorno, cotizacion.id);
    await expect(entorno.modulos.servicio.crearOrden({ ...entrada, fechaEntrega: "2000-01-01" }, entorno.sesiones.VENTAS.actor))
      .rejects.toMatchObject({ status: 422, campos: { fechaEntrega: expect.any(String) } });
    await expect(entorno.modulos.servicio.crearOrden({ ...entrada, responsableId: entorno.sesiones.VENTAS.usuarioId }, entorno.sesiones.VENTAS.actor))
      .rejects.toMatchObject({ status: 422, campos: { responsableId: expect.any(String) } });
    expect(await db.ordenTrabajo.count({ where: { cotizacionId: cotizacion.id } })).toBe(0);
  });

  it("rechaza responsable inactivo y categoría archivada", async () => {
    const cotizacion = await crearAprobada(entorno);
    const entrada = entradaConversion(entorno, cotizacion.id);
    await db.usuario.update({ where: { id: entrada.responsableId }, data: { activo: false } });
    try {
      await expect(entorno.modulos.servicio.crearOrden(entrada, entorno.sesiones.VENTAS.actor)).rejects.toMatchObject({ status: 422 });
    } finally { await db.usuario.update({ where: { id: entrada.responsableId }, data: { activo: true } }); }
    await db.categoria.update({ where: { id: entrada.categoriaId }, data: { activo: false } });
    try {
      await expect(entorno.modulos.servicio.crearOrden(entrada, entorno.sesiones.VENTAS.actor)).rejects.toMatchObject({ status: 422 });
    } finally { await db.categoria.update({ where: { id: entrada.categoriaId }, data: { activo: true } }); }
  });
});
