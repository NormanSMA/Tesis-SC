import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { EstadoOrden } from "@/generated/prisma/client";
import { liberarClienteGlobal } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { abrirSesion } from "./cotizaciones-ayudas";
import { crearOrden, leerOrden, ponerEstado, prepararOrdenes, type EntornoOrdenes } from "./ordenes-ayudas";

describeConBase("órdenes: edición, transiciones y bitácora", () => {
  const db = crearClientePropietario();
  let entorno: EntornoOrdenes;
  beforeAll(async () => { entorno = await prepararOrdenes(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  for (const permiso of ["orden:gestionar", "produccion:planificar"] as const) {
    it(`asigna después de crear sin responsable mediante ${permiso}`, async () => {
      const orden = await crearOrden(entorno, { responsableId: null });
      const actor = { ...entorno.sesiones.ADMINISTRACION.actor, permisos: ["orden:ver", permiso] };
      const sinCambios = await entorno.modulos.servicio.editarOrden(orden.id,
        { version: orden.actualizadoEn, responsableId: null }, actor);
      expect(sinCambios.actualizadoEn).toBe(orden.actualizadoEn);
      expect(await db.bitacora.count({ where: { ordenId: orden.id, accion: "ASIGNAR_RESPONSABLE" } })).toBe(0);
      const responsableId = entorno.sesiones.PRODUCCION.usuarioId;
      const asignada = await entorno.modulos.servicio.editarOrden(orden.id,
        { version: orden.actualizadoEn, responsableId }, actor);
      expect(asignada.responsable?.id).toBe(responsableId);
      expect(asignada.etapas.every((etapa) => etapa.responsable === null)).toBe(true);
      const evento = await db.bitacora.findFirstOrThrow({ where: { ordenId: orden.id, accion: "ASIGNAR_RESPONSABLE" } });
      expect(evento.detalle).toEqual({ responsableId: { anterior: null, nuevo: responsableId } });
      await expect(entorno.modulos.servicio.editarOrden(orden.id,
        { version: orden.actualizadoEn, responsableId }, actor)).rejects.toMatchObject({ codigo: "CONFLICTO_EDICION" });
    });
  }

  it("planificar permite consultar opciones y rechaza cambios de fecha y especificaciones", async () => {
    const orden = await crearOrden(entorno, { responsableId: null });
    const actor = { ...entorno.sesiones.ADMINISTRACION.actor, permisos: ["orden:ver", "produccion:planificar"] };
    expect((await entorno.modulos.servicio.opcionesOrden(actor)).responsables.map((fila) => fila.id))
      .toContain(entorno.sesiones.PRODUCCION.usuarioId);
    for (const cambios of [{ fechaEntrega: "2099-12-31" }, { especificaciones: "Cambio prohibido" }]) {
      await expect(entorno.modulos.servicio.editarOrden(orden.id, { version: orden.actualizadoEn, ...cambios }, actor))
        .rejects.toMatchObject({ status: 403 });
    }
    expect(await leerOrden(entorno, orden.id)).toEqual(orden);
  });

  it("permite dejar sin responsable y registra la desasignación", async () => {
    const orden = await crearOrden(entorno);
    const nueva = await entorno.modulos.servicio.editarOrden(orden.id,
      { version: orden.actualizadoEn, responsableId: null }, entorno.sesiones.OPERACIONES.actor);
    expect(nueva.responsable).toBeNull();
    expect(nueva.eventos.find((evento) => evento.accion === "ASIGNAR_RESPONSABLE")?.detalle)
      .toEqual({ responsableId: { anterior: entorno.sesiones.PRODUCCION.usuarioId, nuevo: null } });
  });

  it("edita cabecera y asignación con dos eventos y conserva responsables de etapas", async () => {
    const orden = await crearOrden(entorno);
    const responsable = await abrirSesion(db, entorno.cotizaciones.modulos, "PRODUCCION");
    const etapa = orden.etapas[0];
    await db.etapaOrden.update({ where: { id: etapa.id }, data: { responsableId: entorno.sesiones.PRODUCCION.usuarioId } });
    const nueva = await entorno.modulos.servicio.editarOrden(orden.id, { version: orden.actualizadoEn,
      responsableId: responsable.usuarioId, fechaEntrega: "2099-12-31", especificaciones: "Especificaciones nuevas" }, entorno.sesiones.OPERACIONES.actor);
    expect(nueva).toMatchObject({ especificaciones: "Especificaciones nuevas", fechaEntrega: "2099-12-31" });
    expect(nueva.responsable?.id).toBe(responsable.usuarioId);
    expect(nueva.etapas[0].responsable?.id).toBe(entorno.sesiones.PRODUCCION.usuarioId);
    expect(new Date(nueva.actualizadoEn).getTime()).toBeGreaterThan(new Date(orden.actualizadoEn).getTime());
    const eventos = nueva.eventos.filter((evento) => ["EDITAR", "ASIGNAR_RESPONSABLE"].includes(evento.accion));
    expect(eventos).toHaveLength(2);
    expect(eventos.find((evento) => evento.accion === "ASIGNAR_RESPONSABLE")?.detalle)
      .toEqual({ responsableId: { anterior: entorno.sesiones.PRODUCCION.usuarioId, nuevo: responsable.usuarioId } });
    expect(eventos.find((evento) => evento.accion === "EDITAR")?.detalle).toEqual({
      fechaEntrega: { anterior: orden.fechaEntrega, nuevo: "2099-12-31" },
      especificaciones: { anterior: orden.especificaciones, nuevo: "Especificaciones nuevas" },
    });
  });

  it("un PATCH sin cambios conserva la versión, incluso con fecha vencida", async () => {
    const inicial = await crearOrden(entorno);
    await db.ordenTrabajo.update({ where: { id: inicial.id }, data: { fechaEntrega: new Date("2000-01-01") } });
    const orden = await leerOrden(entorno, inicial.id);
    const respuesta = await entorno.modulos.servicio.editarOrden(orden.id, { version: orden.actualizadoEn,
      responsableId: entorno.sesiones.PRODUCCION.usuarioId, fechaEntrega: orden.fechaEntrega, especificaciones: orden.especificaciones }, entorno.sesiones.OPERACIONES.actor);
    expect(respuesta).toEqual(orden);
    const vacia = await entorno.modulos.servicio.editarOrden(orden.id, { version: orden.actualizadoEn }, entorno.sesiones.OPERACIONES.actor);
    expect(vacia).toEqual(orden);
  });

  it("permite reasignar una orden vencida sin cambiar su fecha", async () => {
    const inicial = await crearOrden(entorno);
    await db.ordenTrabajo.update({ where: { id: inicial.id }, data: { fechaEntrega: new Date("2000-01-01") } });
    const orden = await leerOrden(entorno, inicial.id);
    const responsable = await abrirSesion(db, entorno.cotizaciones.modulos, "PRODUCCION");
    const nueva = await entorno.modulos.servicio.editarOrden(orden.id, { version: orden.actualizadoEn,
      fechaEntrega: orden.fechaEntrega, responsableId: responsable.usuarioId }, entorno.sesiones.OPERACIONES.actor);
    expect(nueva.fechaEntrega).toBe(orden.fechaEntrega);
    expect(nueva.eventos.filter((evento) => evento.accion === "EDITAR")).toHaveLength(0);
    expect(nueva.eventos.filter((evento) => evento.accion === "ASIGNAR_RESPONSABLE")).toHaveLength(1);
  });

  it("rechaza cambio a fecha pasada y responsable inválido sin modificar nada", async () => {
    const orden = await crearOrden(entorno);
    await expect(entorno.modulos.servicio.editarOrden(orden.id, { version: orden.actualizadoEn, fechaEntrega: "2000-01-01" }, entorno.sesiones.OPERACIONES.actor))
      .rejects.toMatchObject({ status: 422 });
    await expect(entorno.modulos.servicio.editarOrden(orden.id, { version: orden.actualizadoEn, responsableId: randomUUID() }, entorno.sesiones.OPERACIONES.actor))
      .rejects.toMatchObject({ status: 422 });
    expect(await leerOrden(entorno, orden.id)).toEqual(orden);
  });

  it("rechaza versión vieja, incluso cuando el PATCH no cambia campos", async () => {
    const orden = await crearOrden(entorno);
    const nueva = await entorno.modulos.servicio.editarOrden(orden.id, { version: orden.actualizadoEn, especificaciones: "Primer cambio" }, entorno.sesiones.OPERACIONES.actor);
    await expect(entorno.modulos.servicio.editarOrden(orden.id, { version: orden.actualizadoEn, especificaciones: "Primer cambio" }, entorno.sesiones.OPERACIONES.actor))
      .rejects.toMatchObject({ status: 409, codigo: "CONFLICTO_EDICION" });
    expect(await leerOrden(entorno, orden.id)).toEqual(nueva);
  });

  it("dos ediciones simultáneas dejan un ganador y una fila de bitácora", async () => {
    const orden = await crearOrden(entorno);
    const resultados = await Promise.allSettled(["Cambio A", "Cambio B"].map((especificaciones) =>
      entorno.modulos.servicio.editarOrden(orden.id, { version: orden.actualizadoEn, especificaciones }, entorno.sesiones.OPERACIONES.actor)));
    expect(resultados.filter((resultado) => resultado.status === "fulfilled")).toHaveLength(1);
    const perdedor = resultados.find((resultado) => resultado.status === "rejected");
    if (perdedor?.status !== "rejected") throw new Error("Falta el conflicto de edición.");
    expect(perdedor.reason).toMatchObject({ codigo: "CONFLICTO_EDICION", status: 409 });
    expect(await db.bitacora.count({ where: { ordenId: orden.id, accion: "EDITAR" } })).toBe(1);
  });

  it("revierte la edición y su versión cuando falla la bitácora", async () => {
    const orden = await crearOrden(entorno);
    await expect(entorno.modulos.servicio.editarOrden(orden.id, { version: orden.actualizadoEn, especificaciones: "No persistir" },
      { ...entorno.sesiones.OPERACIONES.actor, id: randomUUID() })).rejects.toThrow();
    expect(await leerOrden(entorno, orden.id)).toEqual(orden);
  });

  it("entrega una orden LISTA y cierra una ENTREGADA con fechas y eventos", async () => {
    const inicial = await crearOrden(entorno);
    await ponerEstado(db, inicial.id, "LISTA");
    const orden = await leerOrden(entorno, inicial.id);
    const entregada = await entorno.modulos.servicio.entregarOrden(orden.id, orden.actualizadoEn, entorno.sesiones.OPERACIONES.actor);
    expect(entregada.estado).toBe("ENTREGADA");
    expect(entregada.fechaEntregaReal).toBeTruthy();
    const cerrada = await entorno.modulos.servicio.cerrarOrden(orden.id, entregada.actualizadoEn, entorno.sesiones.OPERACIONES.actor);
    expect(cerrada.estado).toBe("CERRADA");
    expect(new Date(cerrada.fechaCierre!).getTime()).toBeGreaterThanOrEqual(new Date(entregada.fechaEntregaReal!).getTime());
    expect(cerrada.eventos.filter((evento) => evento.accion === "CAMBIAR_ESTADO").map((evento) => [evento.estadoAnterior, evento.estadoNuevo]))
      .toEqual([["LISTA", "ENTREGADA"], ["ENTREGADA", "CERRADA"]]);
  });

  for (const estado of ["PENDIENTE", "EN_PRODUCCION", "LISTA"] as const) {
    it(`cancela desde ${estado} y omite cada etapa pendiente con su evento`, async () => {
      const inicial = await crearOrden(entorno);
      await ponerEstado(db, inicial.id, estado);
      const orden = await leerOrden(entorno, inicial.id);
      const motivo = "El cliente pospuso el trabajo";
      const cancelada = await entorno.modulos.servicio.cancelarOrden(orden.id, { version: orden.actualizadoEn, motivo }, entorno.sesiones.OPERACIONES.actor);
      expect(cancelada.estado).toBe("CANCELADA");
      expect(cancelada.etapas.every((etapa) => etapa.estado === "OMITIDA" && etapa.observaciones === motivo)).toBe(true);
      const eventos = cancelada.eventos.filter((evento) => evento.accion === "CAMBIAR_ESTADO");
      expect(eventos).toHaveLength(3);
      expect(eventos.filter((evento) => evento.entidad === "ETAPA_ORDEN")).toHaveLength(2);
      expect(eventos.every((evento) => evento.detalle && typeof evento.detalle === "object" && !Array.isArray(evento.detalle)
        && evento.detalle.motivo === motivo)).toBe(true);
    });
  }

  it("cancelar conserva la etapa EN_CURSO y la evidencia de su inicio", async () => {
    const inicial = await crearOrden(entorno);
    await ponerEstado(db, inicial.id, "EN_PRODUCCION");
    const inicio = new Date();
    await db.etapaOrden.update({ where: { id: inicial.etapas[0].id }, data: {
      estado: "EN_CURSO", responsableId: entorno.sesiones.PRODUCCION.usuarioId, fechaInicioReal: inicio, observaciones: "Trabajo iniciado",
    } });
    const orden = await leerOrden(entorno, inicial.id);
    const cancelada = await entorno.modulos.servicio.cancelarOrden(orden.id, { version: orden.actualizadoEn, motivo: "Trabajo interrumpido" }, entorno.sesiones.OPERACIONES.actor);
    expect(cancelada.etapas[0]).toEqual(orden.etapas[0]);
    expect(cancelada.etapas[1].estado).toBe("OMITIDA");
    expect(cancelada.eventos.filter((evento) => evento.entidad === "ETAPA_ORDEN" && evento.accion === "CAMBIAR_ESTADO")).toHaveLength(1);
  });

  it("cancelar permite consumo registrado sin devolución automática ni pérdida del movimiento", async () => {
    const orden = await crearOrden(entorno);
    const materialId = entorno.cotizaciones.referencias.material.id;
    const usuarioId = entorno.sesiones.ADMINISTRACION.usuarioId;
    await db.movimientoInventario.create({ data: { materialId, usuarioId, tipo: "ENTRADA", cantidad: "10", costoUnitario: "25" } });
    const consumo = await db.$transaction(async (tx) => {
      const movimiento = await tx.movimientoInventario.create({ data: { materialId, usuarioId, tipo: "CONSUMO", cantidad: "-3" } });
      return tx.consumoOrden.create({ data: { ordenId: orden.id, materialId, movimientoId: movimiento.id } });
    });
    const cancelada = await entorno.modulos.servicio.cancelarOrden(orden.id, { version: orden.actualizadoEn, motivo: "Cancelación con consumo" }, entorno.sesiones.OPERACIONES.actor);
    expect(cancelada.estado).toBe("CANCELADA");
    expect(await db.consumoOrden.findUnique({ where: { id: consumo.id } })).toEqual(consumo);
    expect((await db.material.findUniqueOrThrow({ where: { id: materialId } })).existencia.toFixed(3)).toBe("7.000");
    expect(await db.consumoOrden.count({ where: { ordenId: orden.id } })).toBe(1);
  });

  const INVALIDAS: { estado: EstadoOrden; accion: "entregar" | "cerrar" | "cancelar" }[] = [
    { estado: "PENDIENTE", accion: "entregar" }, { estado: "EN_PRODUCCION", accion: "entregar" },
    { estado: "LISTA", accion: "cerrar" }, { estado: "ENTREGADA", accion: "cancelar" },
    { estado: "CERRADA", accion: "cancelar" }, { estado: "CANCELADA", accion: "entregar" },
  ];
  for (const { estado, accion } of INVALIDAS) {
    it(`rechaza ${accion} desde ${estado} sin cambiar versión ni bitácora`, async () => {
      const inicial = await crearOrden(entorno);
      await ponerEstado(db, inicial.id, estado);
      const orden = await leerOrden(entorno, inicial.id);
      const servicio = entorno.modulos.servicio;
      const operacion = accion === "entregar" ? servicio.entregarOrden(orden.id, orden.actualizadoEn, entorno.sesiones.ATENCION_CLIENTE.actor)
        : accion === "cerrar" ? servicio.cerrarOrden(orden.id, orden.actualizadoEn, entorno.sesiones.OPERACIONES.actor)
          : servicio.cancelarOrden(orden.id, { version: orden.actualizadoEn, motivo: "Motivo inválido por estado" }, entorno.sesiones.OPERACIONES.actor);
      await expect(operacion).rejects.toMatchObject({ status: 409, codigo: "TRANSICION_INVALIDA" });
      expect(await leerOrden(entorno, orden.id)).toEqual(orden);
    });
  }

  it("rechaza editar una orden terminal", async () => {
    const inicial = await crearOrden(entorno);
    await ponerEstado(db, inicial.id, "ENTREGADA");
    const orden = await leerOrden(entorno, inicial.id);
    await expect(entorno.modulos.servicio.editarOrden(orden.id, { version: orden.actualizadoEn, especificaciones: "Cambio terminal" }, entorno.sesiones.OPERACIONES.actor))
      .rejects.toMatchObject({ status: 409, codigo: "ORDEN_TERMINAL" });
    expect(await leerOrden(entorno, orden.id)).toEqual(orden);
  });

  it("dos entregas concurrentes producen un evento y un conflicto", async () => {
    const inicial = await crearOrden(entorno);
    await ponerEstado(db, inicial.id, "LISTA");
    const orden = await leerOrden(entorno, inicial.id);
    const resultados = await Promise.allSettled([
      entorno.modulos.servicio.entregarOrden(orden.id, orden.actualizadoEn, entorno.sesiones.ATENCION_CLIENTE.actor),
      entorno.modulos.servicio.entregarOrden(orden.id, orden.actualizadoEn, entorno.sesiones.OPERACIONES.actor),
    ]);
    expect(resultados.filter((resultado) => resultado.status === "fulfilled")).toHaveLength(1);
    const perdedor = resultados.find((resultado) => resultado.status === "rejected");
    if (perdedor?.status !== "rejected") throw new Error("Falta el conflicto de entrega.");
    expect(perdedor.reason).toMatchObject({ status: 409, codigo: "CONFLICTO_EDICION" });
    expect(await db.bitacora.count({ where: { ordenId: orden.id, accion: "CAMBIAR_ESTADO", estadoNuevo: "ENTREGADA" } })).toBe(1);
  });

  it("cada transición rechaza una versión vieja antes de escribir", async () => {
    const inicial = await crearOrden(entorno);
    const version = "2000-01-01T00:00:00.000Z";
    for (const accion of ["entregar", "cerrar", "cancelar"] as const) {
      const servicio = entorno.modulos.servicio;
      const operacion = accion === "entregar" ? servicio.entregarOrden(inicial.id, version, entorno.sesiones.ATENCION_CLIENTE.actor)
        : accion === "cerrar" ? servicio.cerrarOrden(inicial.id, version, entorno.sesiones.OPERACIONES.actor)
          : servicio.cancelarOrden(inicial.id, { version, motivo: "Versión desactualizada" }, entorno.sesiones.OPERACIONES.actor);
      await expect(operacion).rejects.toMatchObject({ codigo: "CONFLICTO_EDICION", status: 409 });
    }
    expect(await leerOrden(entorno, inicial.id)).toEqual(inicial);
  });

  it("revierte cancelación y etapas cuando falla la bitácora", async () => {
    const orden = await crearOrden(entorno);
    const { vi } = await import("vitest");
    const modulo = await import("@/lib/bitacora");
    const original = modulo.registrarEvento;
    const espia = vi.spyOn(modulo, "registrarEvento").mockImplementation((tx, evento) =>
      original(tx, evento.entidad === "ETAPA_ORDEN" ? { ...evento, actorId: randomUUID() } : evento));
    try {
      await expect(entorno.modulos.servicio.cancelarOrden(orden.id, { version: orden.actualizadoEn, motivo: "No persistir etapas" }, entorno.sesiones.OPERACIONES.actor))
        .rejects.toThrow();
    } finally { espia.mockRestore(); }
    expect(await leerOrden(entorno, orden.id)).toEqual(orden);
  });

  it("revierte entregar y cerrar si falla el evento", async () => {
    const inicial = await crearOrden(entorno);
    await ponerEstado(db, inicial.id, "LISTA");
    const orden = await leerOrden(entorno, inicial.id);
    await expect(entorno.modulos.servicio.entregarOrden(orden.id, orden.actualizadoEn, { ...entorno.sesiones.ATENCION_CLIENTE.actor, id: randomUUID() })).rejects.toThrow();
    expect(await leerOrden(entorno, orden.id)).toEqual(orden);
    const entregada = await entorno.modulos.servicio.entregarOrden(orden.id, orden.actualizadoEn, entorno.sesiones.ATENCION_CLIENTE.actor);
    await expect(entorno.modulos.servicio.cerrarOrden(orden.id, entregada.actualizadoEn, { ...entorno.sesiones.OPERACIONES.actor, id: randomUUID() })).rejects.toThrow();
    expect(await leerOrden(entorno, orden.id)).toEqual(entregada);
  });
});
