import { Client } from "pg";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { crearUsuarioPrueba, liberarClienteGlobal } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { urlParaPg, urlPropietario } from "../helpers/entorno-bd";
import { asignarEtapa, nuevaOrden, prepararProduccion, type EntornoProduccion } from "./produccion-ayudas";

describeConBase("producción: historial propio de etapas", () => {
  const db = crearClientePropietario();
  let entorno: EntornoProduccion;
  beforeAll(async () => { entorno = await prepararProduccion(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  it("crear una etapa manual guarda el estado inicial junto con CREAR", async () => {
    const orden = await nuevaOrden(entorno);
    const etapa = await entorno.servicio.agregarEtapa(orden.id,
      { areaId: orden.etapas[0].area.id, nombre: "Acabado historial" }, entorno.planificador);
    expect(await db.historialEtapa.findMany({ where: { etapaId: etapa.id } })).toMatchObject([
      { ordenId: orden.id, etapaId: etapa.id, usuarioId: entorno.planificador.id,
        estadoAnterior: null, estadoNuevo: "PENDIENTE", responsableId: null },
    ]);
    expect(await db.bitacora.count({ where: { entidadId: etapa.id, accion: "CREAR" } })).toBe(1);
  });

  it("iniciar, completar, omitir y restaurar guardan actor, estados y responsable vigente", async () => {
    const { servicio, actor, planificador } = entorno;
    const orden = await nuevaOrden(entorno);
    const asignada = await asignarEtapa(entorno, orden.etapas[0]);
    const iniciada = await servicio.iniciarEtapa(asignada.id, { version: asignada.actualizadoEn }, actor);
    await servicio.completarEtapa(iniciada.id, { version: iniciada.actualizadoEn }, actor);
    const segunda = orden.etapas[1];
    const omitida = await servicio.omitirEtapa(segunda.id, { version: segunda.actualizadoEn, motivo: "No corresponde" }, planificador);
    await servicio.restaurarEtapa(omitida.id, { version: omitida.actualizadoEn }, planificador);
    const historial = await db.historialEtapa.findMany({ where: { ordenId: orden.id, estadoAnterior: { not: null } },
      orderBy: [{ creadoEn: "asc" }, { id: "asc" }] });
    expect(historial.map(({ etapaId, usuarioId, estadoAnterior, estadoNuevo, responsableId }) =>
      ({ etapaId, usuarioId, estadoAnterior, estadoNuevo, responsableId }))).toEqual([
      { etapaId: asignada.id, usuarioId: planificador.id, estadoAnterior: "PENDIENTE", estadoNuevo: "PENDIENTE", responsableId: actor.id },
      { etapaId: asignada.id, usuarioId: actor.id, estadoAnterior: "PENDIENTE", estadoNuevo: "EN_CURSO", responsableId: actor.id },
      { etapaId: asignada.id, usuarioId: actor.id, estadoAnterior: "EN_CURSO", estadoNuevo: "COMPLETADA", responsableId: actor.id },
      { etapaId: segunda.id, usuarioId: planificador.id, estadoAnterior: "PENDIENTE", estadoNuevo: "OMITIDA", responsableId: null },
      { etapaId: segunda.id, usuarioId: planificador.id, estadoAnterior: "OMITIDA", estadoNuevo: "PENDIENTE", responsableId: null },
    ]);
    expect(historial.every((fila) => fila.creadoEn instanceof Date)).toBe(true);
    expect(await db.bitacora.count({ where: { ordenId: orden.id, entidad: "ETAPA_ORDEN",
      accion: { in: ["ASIGNAR_RESPONSABLE", "CAMBIAR_ESTADO"] } } })).toBe(historial.length);
  });

  it("reasignar y retirar responsable guardan historial; fechas y PATCH sin cambios no crean filas", async () => {
    const orden = await nuevaOrden(entorno);
    const inicial = orden.etapas[0];
    const cantidadInicial = await db.historialEtapa.count({ where: { etapaId: inicial.id } });
    const asignada = await asignarEtapa(entorno, inicial);
    const usuario = await crearUsuarioPrueba(db, { perfil: "PRODUCCION" });
    const reasignada = await entorno.servicio.editarEtapa(asignada.id,
      { version: asignada.actualizadoEn, responsableId: usuario.id }, entorno.planificador);
    const retirada = await entorno.servicio.editarEtapa(asignada.id,
      { version: reasignada.actualizadoEn, responsableId: null }, entorno.planificador);
    const fechas = await entorno.servicio.editarEtapa(retirada.id,
      { version: retirada.actualizadoEn, fechaInicioPlan: "2026-10-10" }, entorno.planificador);
    await entorno.servicio.editarEtapa(fechas.id, { version: fechas.actualizadoEn, responsableId: null }, entorno.planificador);
    const historial = await db.historialEtapa.findMany({ where: { etapaId: inicial.id, estadoAnterior: { not: null } },
      orderBy: [{ creadoEn: "asc" }, { id: "asc" }] });
    expect(historial.map((fila) => fila.responsableId)).toEqual([entorno.actor.id, usuario.id, null]);
    expect(historial.every((fila) => fila.estadoAnterior === "PENDIENTE" && fila.estadoNuevo === "PENDIENTE")).toBe(true);
    expect(await db.historialEtapa.count({ where: { etapaId: inicial.id } })).toBe(cantidadInicial + 3);
  });

  it("UPDATE y DELETE rechazan historial con SQLSTATE SC001", async () => {
    const orden = await nuevaOrden(entorno);
    await asignarEtapa(entorno, orden.etapas[0]);
    const fila = await db.historialEtapa.findFirstOrThrow({ where: { etapaId: orden.etapas[0].id } });
    const cliente = new Client({ connectionString: urlParaPg(urlPropietario()) });
    await cliente.connect();
    try {
      await expect(cliente.query("UPDATE historial_etapa SET responsable_id = NULL WHERE id = $1", [fila.id]))
        .rejects.toMatchObject({ code: "SC001" });
      await expect(cliente.query("DELETE FROM historial_etapa WHERE id = $1", [fila.id]))
        .rejects.toMatchObject({ code: "SC001" });
      expect(await db.historialEtapa.findUniqueOrThrow({ where: { id: fila.id } })).toEqual(fila);
    } finally { await cliente.end(); }
  });

  it("un fallo de bitácora revierte el historial junto con la etapa", async () => {
    const orden = await nuevaOrden(entorno);
    const asignada = await asignarEtapa(entorno, orden.etapas[0]);
    const iniciada = await entorno.servicio.iniciarEtapa(asignada.id, { version: asignada.actualizadoEn }, entorno.actor);
    const antes = await db.historialEtapa.findMany({ where: { ordenId: orden.id } });
    const eventos = await db.bitacora.count({ where: { ordenId: orden.id } });
    const fallo = vi.spyOn(await import("@/lib/bitacora"), "registrarEvento").mockRejectedValueOnce(new Error("Bitácora rechazada"));
    try {
      await expect(entorno.servicio.completarEtapa(iniciada.id, { version: iniciada.actualizadoEn }, entorno.actor))
        .rejects.toThrow("Bitácora rechazada");
      expect(fallo).toHaveBeenCalledOnce();
    } finally { fallo.mockRestore(); }
    expect(await db.historialEtapa.findMany({ where: { ordenId: orden.id } })).toEqual(antes);
    expect(await db.bitacora.count({ where: { ordenId: orden.id } })).toBe(eventos);
    expect((await db.etapaOrden.findUniqueOrThrow({ where: { id: asignada.id } })).estado).toBe("EN_CURSO");
  });
  it('RB-08: la base rechaza un cambio a EN_CURSO o COMPLETADA sin responsable', async () => {
    const orden = await nuevaOrden(entorno);
    for (const estadoNuevo of ['EN_CURSO', 'COMPLETADA'] as const) {
      await expect(db.historialEtapa.create({ data: { ordenId: orden.id, etapaId: orden.etapas[0].id,
        usuarioId: entorno.actor.id, estadoAnterior: 'PENDIENTE', estadoNuevo, responsableId: null } }))
        .rejects.toThrow(/historial_etapa_responsable_obligatorio|check constraint/i);
    }
  });

});
