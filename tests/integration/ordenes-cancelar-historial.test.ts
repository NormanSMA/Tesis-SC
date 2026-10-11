import { afterAll, beforeAll, expect, it } from "vitest";
import { liberarClienteGlobal } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { crearOrden, leerOrden, prepararOrdenes, type EntornoOrdenes } from "./ordenes-ayudas";

describeConBase("órdenes: historial de etapas al cancelar", () => {
  const db = crearClientePropietario();
  let entorno: EntornoOrdenes;
  beforeAll(async () => { entorno = await prepararOrdenes(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  it("RB-08: cancelar registra las dos etapas omitidas con actor y responsable vigente", async () => {
    const inicial = await crearOrden(entorno);
    expect(inicial.etapas).toHaveLength(2);
    expect(inicial.etapas.map((etapa) => etapa.estado)).toEqual(["PENDIENTE", "PENDIENTE"]);
    const responsableId = entorno.sesiones.PRODUCCION.usuarioId;
    await db.etapaOrden.update({ where: { id: inicial.etapas[0].id }, data: { responsableId } });
    const orden = await leerOrden(entorno, inicial.id);
    const cantidadInicial = await db.historialEtapa.count({ where: { ordenId: orden.id } });
    const actor = entorno.sesiones.OPERACIONES.actor;
    const motivo = "El cliente canceló el trabajo";

    const cancelada = await entorno.modulos.servicio.cancelarOrden(orden.id,
      { version: orden.actualizadoEn, motivo }, actor);

    expect(cancelada.estado).toBe("CANCELADA");
    expect(cancelada.etapas.map((etapa) => etapa.estado)).toEqual(["OMITIDA", "OMITIDA"]);
    const historial = await db.historialEtapa.findMany({ where: { ordenId: orden.id, estadoNuevo: "OMITIDA" } });
    expect(historial).toHaveLength(2);
    expect(historial).toEqual(expect.arrayContaining([
      expect.objectContaining({ ordenId: orden.id, etapaId: orden.etapas[0].id, usuarioId: actor.id,
        estadoAnterior: "PENDIENTE", estadoNuevo: "OMITIDA", responsableId }),
      expect.objectContaining({ ordenId: orden.id, etapaId: orden.etapas[1].id, usuarioId: actor.id,
        estadoAnterior: "PENDIENTE", estadoNuevo: "OMITIDA", responsableId: null }),
    ]));
    expect(await db.historialEtapa.count({ where: { ordenId: orden.id } })).toBe(cantidadInicial + 2);
    expect(await db.bitacora.count({ where: { ordenId: orden.id, entidad: "ETAPA_ORDEN",
      accion: "CAMBIAR_ESTADO", estadoAnterior: "PENDIENTE", estadoNuevo: "OMITIDA" } })).toBe(2);
  });
});
