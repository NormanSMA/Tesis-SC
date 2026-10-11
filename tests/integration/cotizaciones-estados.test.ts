import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";

import { liberarClienteGlobal } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import {
  crearBorrador, itemPersonalizado, itemUnidad, prepararCotizaciones, totales, type EntornoCotizaciones,
} from "./cotizaciones-ayudas";

describeConBase("cotizaciones: estados, fechas Managua y congelación", () => {
  const db = crearClientePropietario();
  let entorno: EntornoCotizaciones;
  beforeAll(async () => { entorno = await prepararCotizaciones(db); });
  afterEach(() => { vi.restoreAllMocks(); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  async function enviada() {
    const borrador = await crearBorrador(entorno, { items: [itemUnidad(entorno.referencias)] });
    return entorno.modulos.servicio.enviarCotizacion(borrador.id, borrador.actualizadoEn, entorno.ventas.actor);
  }

  it("exige al menos un ítem para enviar y conserva el borrador", async () => {
    const borrador = await crearBorrador(entorno);
    await expect(entorno.modulos.servicio.enviarCotizacion(borrador.id, borrador.actualizadoEn, entorno.ventas.actor))
      .rejects.toMatchObject({ status: 409 });
    expect(await entorno.modulos.servicio.obtenerCotizacion(borrador.id)).toEqual(borrador);
    expect(await db.bitacora.count({ where: { cotizacionId: borrador.id } })).toBe(1);
  });

  it("envía con emisión Managua y vencimiento según vigencia", async () => {
    vi.spyOn(entorno.modulos.fechas, "hoyManagua").mockReturnValue("2026-10-31");
    const cotizacion = await enviada();
    expect(cotizacion).toMatchObject({ estado: "ENVIADA", fechaEmision: "2026-10-31", fechaVencimiento: "2026-11-15" });
    const evento = await db.bitacora.findFirstOrThrow({ where: { cotizacionId: cotizacion.id, accion: "CAMBIAR_ESTADO" } });
    expect(evento).toMatchObject({ estadoAnterior: "BORRADOR", estadoNuevo: "ENVIADA", usuarioId: entorno.ventas.usuarioId });
  });

  it("aprueba el último día de vigencia en Managua", async () => {
    const hoy = vi.spyOn(entorno.modulos.fechas, "hoyManagua").mockReturnValue("2026-10-01");
    const cotizacion = await enviada();
    hoy.mockReturnValue("2026-10-16");
    const aprobada = await entorno.modulos.servicio.responderCotizacion(cotizacion.id, {
      version: cotizacion.actualizadoEn, resultado: "APROBADA", referenciaAprobacion: "Correo del cliente del 10/10",
    }, entorno.ventas.actor);
    expect(aprobada.estado).toBe("APROBADA");
    expect(aprobada.fechaRespuesta).toMatch(/Z$/);
    expect(totales(aprobada)).toEqual(totales(cotizacion));
  });

  it("rechaza aprobar al día siguiente y permite marcar vencida", async () => {
    const hoy = vi.spyOn(entorno.modulos.fechas, "hoyManagua").mockReturnValue("2026-10-01");
    const cotizacion = await enviada();
    hoy.mockReturnValue("2026-10-17");
    await expect(entorno.modulos.servicio.responderCotizacion(cotizacion.id, {
      version: cotizacion.actualizadoEn, resultado: "APROBADA", referenciaAprobacion: "Correo del cliente del 10/10",
    }, entorno.ventas.actor)).rejects.toMatchObject({ status: 409 });
    const vencida = await entorno.modulos.servicio.responderCotizacion(cotizacion.id, {
      version: cotizacion.actualizadoEn, resultado: "VENCIDA",
    }, entorno.ventas.actor);
    expect(vencida.estado).toBe("VENCIDA");
    expect(vencida.fechaRespuesta).toMatch(/Z$/);
  });

  it("rechaza vencer durante la vigencia, incluido el último día", async () => {
    const hoy = vi.spyOn(entorno.modulos.fechas, "hoyManagua").mockReturnValue("2026-10-01");
    const cotizacion = await enviada();
    for (const fecha of ["2026-10-01", "2026-10-16"]) {
      hoy.mockReturnValue(fecha);
      await expect(entorno.modulos.servicio.responderCotizacion(cotizacion.id, {
        version: cotizacion.actualizadoEn, resultado: "VENCIDA",
      }, entorno.ventas.actor)).rejects.toMatchObject({ status: 409 });
    }
    expect((await entorno.modulos.servicio.obtenerCotizacion(cotizacion.id)).estado).toBe("ENVIADA");
  });

  it("rechaza sin motivo y guarda motivo y fecha cuando responde RECHAZADA", async () => {
    const cotizacion = await enviada();
    await expect(entorno.modulos.servicio.responderCotizacion(cotizacion.id, {
      version: cotizacion.actualizadoEn, resultado: "RECHAZADA", motivo: "  ",
    }, entorno.ventas.actor)).rejects.toMatchObject({ status: 409 });
    const rechazada = await entorno.modulos.servicio.responderCotizacion(cotizacion.id, {
      version: cotizacion.actualizadoEn, resultado: "RECHAZADA", motivo: "Presupuesto insuficiente",
    }, entorno.ventas.actor);
    expect(rechazada).toMatchObject({ estado: "RECHAZADA", motivoRechazo: "Presupuesto insuficiente" });
    expect(rechazada.fechaRespuesta).toMatch(/Z$/);
  });

  it("rechaza responder BORRADOR y reenviar ENVIADA", async () => {
    const borrador = await crearBorrador(entorno, { items: [itemUnidad(entorno.referencias)] });
    await expect(entorno.modulos.servicio.responderCotizacion(borrador.id, {
      version: borrador.actualizadoEn, resultado: "APROBADA", referenciaAprobacion: "Correo del cliente del 10/10",
    }, entorno.ventas.actor)).rejects.toMatchObject({ status: 409 });
    const cotizacion = await entorno.modulos.servicio.enviarCotizacion(borrador.id, borrador.actualizadoEn, entorno.ventas.actor);
    await expect(entorno.modulos.servicio.enviarCotizacion(cotizacion.id, cotizacion.actualizadoEn, entorno.ventas.actor))
      .rejects.toMatchObject({ status: 409 });
  });

  it("rechaza modificaciones y respuestas posteriores en estados terminales", async () => {
    const hoy = vi.spyOn(entorno.modulos.fechas, "hoyManagua").mockReturnValue("2026-10-01");
    for (const resultado of ["APROBADA", "RECHAZADA", "VENCIDA", "AJUSTE_SOLICITADO"] as const) {
      hoy.mockReturnValue("2026-10-01");
      const cotizacion = await enviada();
      if (resultado === "VENCIDA") hoy.mockReturnValue("2026-10-17");
      const terminal = await entorno.modulos.servicio.responderCotizacion(cotizacion.id, {
        version: cotizacion.actualizadoEn, resultado, motivo: "Motivo comprobado", referenciaAprobacion: "Correo del cliente del 10/10", motivoAjuste: "Cambiar medidas",
      }, entorno.ventas.actor);
      await expect(entorno.modulos.servicio.editarCotizacion(terminal.id, {
        version: terminal.actualizadoEn, asunto: "Cambio prohibido",
      }, entorno.ventas.actor)).rejects.toMatchObject({ status: 409 });
      await expect(entorno.modulos.servicio.responderCotizacion(terminal.id, {
        version: terminal.actualizadoEn, resultado: "APROBADA", referenciaAprobacion: "Correo del cliente del 10/10",
      }, entorno.ventas.actor)).rejects.toMatchObject({ status: 409 });
      expect(await entorno.modulos.servicio.obtenerCotizacion(terminal.id)).toEqual(terminal);
    }
  });

  it("la base congela cabecera, ítems y líneas fuera de BORRADOR", async () => {
    const borrador = await crearBorrador(entorno, { items: [itemPersonalizado(entorno.referencias)] });
    const cotizacion = await entorno.modulos.servicio.enviarCotizacion(borrador.id, borrador.actualizadoEn, entorno.ventas.actor);
    const item = cotizacion.items[0];
    await expect(db.cotizacion.update({ where: { id: cotizacion.id }, data: { asunto: "Cambio directo" } }))
      .rejects.toThrow(/SC003|solo admite cambio/i);
    await expect(db.itemCotizacion.update({ where: { id: item.id }, data: { descripcion: "Cambio directo" } }))
      .rejects.toThrow(/SC003|no se modifican/i);
    await expect(db.lineaCosto.update({ where: { id: item.lineas[0].id }, data: { descripcion: "Cambio directo" } }))
      .rejects.toThrow(/SC003|no se modifican/i);
    await expect(entorno.modulos.servicio.reemplazarItems(cotizacion.id, {
      version: cotizacion.actualizadoEn, items: [],
    }, entorno.ventas.actor)).rejects.toMatchObject({ status: 409 });
    expect(await entorno.modulos.servicio.obtenerCotizacion(cotizacion.id)).toEqual(cotizacion);
  });

  it("la base rechaza enviar cuando la suma guardada no coincide", async () => {
    const cotizacion = await crearBorrador(entorno, { items: [itemUnidad(entorno.referencias)] });
    await db.cotizacion.update({ where: { id: cotizacion.id }, data: { subtotal: "100", impuesto: "15", total: "115" } });
    await expect(db.cotizacion.update({ where: { id: cotizacion.id }, data: {
      estado: "ENVIADA", fechaEmision: new Date("2026-10-01"), fechaVencimiento: new Date("2026-10-16"),
    } })).rejects.toThrow(/SC003|no coincide/i);
  });
});
