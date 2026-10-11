import { afterAll, beforeAll, expect, it } from "vitest";
import { liberarClienteGlobal } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { abrirSesion } from "./cotizaciones-ayudas";
import { consumir, crearMaterial, trazaOrden } from "./inventario-consumo-ayudas";
import { leerOrden } from "./ordenes-ayudas";
import { asignarEtapa, carrera, crearAreaLibre, nuevaOrden, prepararLista, prepararProduccion, type EntornoProduccion } from "./produccion-ayudas";

const db = crearClientePropietario();
let entorno: EntornoProduccion;
let segundoActor: EntornoProduccion["actor"];

function registrarArchivoArea(ronda: number) {
  it(`restaurar contra archivar área valida bajo bloqueo, ronda ${ronda}`, async () => {
    for (const restaurarPrimero of [true, false]) {
      const area = await crearAreaLibre(entorno);
      const orden = await nuevaOrden(entorno);
      const extra = await entorno.servicio.agregarEtapa(orden.id, { areaId: area.id, nombre: "Extra" }, entorno.planificador);
      const omitida = await entorno.servicio.omitirEtapa(extra.id, { version: extra.actualizadoEn, motivo: "No corresponde" }, entorno.planificador);
      const restaurar = () => entorno.servicio.restaurarEtapa(extra.id, { version: omitida.actualizadoEn }, entorno.planificador);
      const archivar = () => entorno.servicio.archivarArea(area.id, { version: area.actualizadoEn }, entorno.operaciones);
      const resultados = restaurarPrimero
        ? await carrera({ areaId: area.id, primera: restaurar, segunda: archivar })
        : await carrera({ areaId: area.id, primera: archivar, segunda: restaurar });
      expect(resultados[0].ok).toBe(true);
      expect(resultados[1]).toMatchObject({ ok: false, error: { status: restaurarPrimero ? 409 : 422 } });
      expect((await db.area.findUniqueOrThrow({ where: { id: area.id } })).activo).toBe(restaurarPrimero);
      expect((await db.etapaOrden.findUniqueOrThrow({ where: { id: extra.id } })).estado).toBe(restaurarPrimero ? "PENDIENTE" : "OMITIDA");
    }
  });
}

function registrarPrimerInicio(ronda: number) {
  it(`dos inicios de la misma primera etapa: un ganador y fecha estable, ronda ${ronda}`, async () => {
    const orden = await nuevaOrden(entorno);
    const etapa = await asignarEtapa(entorno, orden.etapas[0]);
    const ejecutar = () => entorno.servicio.iniciarEtapa(etapa.id, { version: etapa.actualizadoEn }, entorno.actor);
    const resultados = await carrera({ ordenId: orden.id, primera: ejecutar, segunda: ejecutar });
    expect(resultados.filter((resultado) => resultado.ok)).toHaveLength(1);
    expect(resultados.filter((resultado) => !resultado.ok)).toEqual([expect.objectContaining({ error: expect.objectContaining({ codigo: "CONFLICTO_EDICION" }) })]);
    const actual = await leerOrden(entorno.ordenes, orden.id);
    expect(actual.fechaInicioReal).toBe(actual.etapas[0].fechaInicioReal);
    expect(actual.eventos.filter((evento) => evento.entidad === "ORDEN_TRABAJO" && evento.estadoNuevo === "EN_PRODUCCION")).toHaveLength(1);
    expect(actual.eventos.filter((evento) => evento.entidadId === etapa.id && evento.estadoNuevo === "EN_CURSO")).toHaveLength(1);
  });
}

function registrarEtapasDistintas(ronda: number) {
  it(`dos etapas distintas inician con versiones propias, ronda ${ronda}`, async () => {
    const orden = await nuevaOrden(entorno);
    const [primera, segunda] = await Promise.all(orden.etapas.map((etapa) => asignarEtapa(entorno, etapa)));
    const resultados = await carrera({ ordenId: orden.id,
      primera: () => entorno.servicio.iniciarEtapa(primera.id, { version: primera.actualizadoEn }, entorno.actor),
      segunda: () => entorno.servicio.iniciarEtapa(segunda.id, { version: segunda.actualizadoEn }, segundoActor) });
    expect(resultados.every((resultado) => resultado.ok)).toBe(true);
    const actual = await leerOrden(entorno.ordenes, orden.id);
    expect(actual.etapas.map((etapa) => etapa.estado)).toEqual(["EN_CURSO", "EN_CURSO"]);
    expect(actual.fechaInicioReal).toBe(actual.etapas[0].fechaInicioReal);
    expect(actual.eventos.filter((evento) => evento.entidad === "ORDEN_TRABAJO" && evento.estadoNuevo === "EN_PRODUCCION")).toHaveLength(1);
  });
}

function registrarInicioCancelacion(ronda: number) {
  it(`primer inicio contra cancelar conserva versiones y estado, ronda ${ronda}`, async () => {
    for (const iniciarPrimero of [true, false]) {
      const orden = await nuevaOrden(entorno);
      const etapa = await asignarEtapa(entorno, orden.etapas[0]);
      const iniciar = () => entorno.servicio.iniciarEtapa(etapa.id, { version: etapa.actualizadoEn }, entorno.actor);
      const cancelar = () => entorno.ordenes.modulos.servicio.cancelarOrden(orden.id,
        { version: orden.actualizadoEn, motivo: "Cancelación concurrente" }, entorno.operaciones);
      const resultados = iniciarPrimero
        ? await carrera({ ordenId: orden.id, primera: iniciar, segunda: cancelar })
        : await carrera({ ordenId: orden.id, primera: cancelar, segunda: iniciar });
      expect(resultados[0].ok).toBe(true);
      expect(resultados[1]).toMatchObject({ ok: false, error: { codigo: iniciarPrimero ? "CONFLICTO_EDICION" : "ORDEN_NO_ADMITE_CAMBIOS_DE_ETAPA" } });
      const actual = await leerOrden(entorno.ordenes, orden.id);
      expect(actual.estado).toBe(iniciarPrimero ? "EN_PRODUCCION" : "CANCELADA");
      expect(actual.etapas[0].estado).toBe(iniciarPrimero ? "EN_CURSO" : "OMITIDA");
      expect(actual.fechaInicioReal === null).toBe(!iniciarPrimero);
    }
  });
}

function registrarEjecucionCancelacion(ronda: number) {
  for (const accion of ["iniciar", "completar"] as const) {
    it(`${accion} contra cancelar una orden en producción, ambos órdenes, ronda ${ronda}`, async () => {
      for (const etapaPrimero of [true, false]) {
        const orden = await nuevaOrden(entorno);
        const asignada = await asignarEtapa(entorno, orden.etapas[0]);
        const iniciada = await entorno.servicio.iniciarEtapa(asignada.id, { version: asignada.actualizadoEn }, entorno.actor);
        const actual = await leerOrden(entorno.ordenes, orden.id);
        const etapa = accion === "completar" ? iniciada : await asignarEtapa(entorno, orden.etapas[1]);
        const ejecutar = () => accion === "completar"
          ? entorno.servicio.completarEtapa(etapa.id, { version: etapa.actualizadoEn }, entorno.actor)
          : entorno.servicio.iniciarEtapa(etapa.id, { version: etapa.actualizadoEn }, entorno.actor);
        const cancelar = () => entorno.ordenes.modulos.servicio.cancelarOrden(orden.id,
          { version: actual.actualizadoEn, motivo: "Cancelación concurrente" }, entorno.operaciones);
        const resultados = etapaPrimero
          ? await carrera({ ordenId: orden.id, primera: ejecutar, segunda: cancelar })
          : await carrera({ ordenId: orden.id, primera: cancelar, segunda: ejecutar });
        expect(resultados[0].ok).toBe(true);
        if (etapaPrimero) expect(resultados[1].ok).toBe(true);
        else expect(resultados[1]).toMatchObject({ ok: false, error: { codigo: "ORDEN_NO_ADMITE_CAMBIOS_DE_ETAPA" } });
        const final = await leerOrden(entorno.ordenes, orden.id);
        expect(final.estado).toBe("CANCELADA");
        expect(final.fechaInicioReal).toBe(actual.fechaInicioReal);
        const eventos = final.eventos.filter((evento) => evento.entidadId === etapa.id && evento.estadoNuevo === (accion === "iniciar" ? "EN_CURSO" : "COMPLETADA"));
        expect(eventos).toHaveLength(etapaPrimero ? 1 : 0);
      }
    });
  }
}

function registrarConsumoLista(ronda: number) {
  it(`consumir contra marcar lista confirma ambos órdenes sin interbloqueo, ronda ${ronda}`, async () => {
    for (const consumirPrimero of [true, false]) {
      const orden = await prepararLista(entorno);
      const material = await crearMaterial(entorno.consumo, { existencia: "3" });
      const consumo = () => consumir(entorno.consumo, { ordenId: orden.id, lineas: [{ materialId: material.id, cantidad: "1" }] });
      const lista = () => entorno.servicio.marcarLista(orden.id, { version: orden.actualizadoEn }, entorno.actor);
      const resultados = consumirPrimero
        ? await carrera({ ordenId: orden.id, primera: consumo, segunda: lista })
        : await carrera({ ordenId: orden.id, primera: lista, segunda: consumo });
      expect(resultados.every((resultado) => resultado.ok)).toBe(true);
      expect((await leerOrden(entorno.ordenes, orden.id)).estado).toBe("LISTA");
      expect((await db.material.findUniqueOrThrow({ where: { id: material.id } })).existencia.toFixed(3)).toBe("2.000");
      const traza = await trazaOrden(db, orden.id);
      expect(traza.movimientos).toEqual(traza.eventos);
      expect(traza.movimientos).toHaveLength(1);
    }
  });
}

function registrarEtapasLista(ronda: number) {
  for (const accion of ["agregar", "restaurar"] as const) {
    it(`${accion} etapa contra marcar lista, ambos órdenes, ronda ${ronda}`, async () => {
      for (const etapaPrimero of [true, false]) {
        const orden = await prepararLista(entorno);
        const omitida = orden.etapas.find((etapa) => etapa.estado === "OMITIDA")!;
        const ejecutar = () => accion === "agregar"
          ? entorno.servicio.agregarEtapa(orden.id, { areaId: omitida.area.id, nombre: "Extra concurrente" }, entorno.planificador)
          : entorno.servicio.restaurarEtapa(omitida.id, { version: omitida.actualizadoEn }, entorno.planificador);
        const lista = () => entorno.servicio.marcarLista(orden.id, { version: orden.actualizadoEn }, entorno.actor);
        const resultados = etapaPrimero
          ? await carrera({ ordenId: orden.id, primera: ejecutar, segunda: lista })
          : await carrera({ ordenId: orden.id, primera: lista, segunda: ejecutar });
        expect(resultados[0].ok).toBe(true);
        expect(resultados[1]).toMatchObject({ ok: false, error: { codigo: etapaPrimero ? "ETAPAS_ABIERTAS" : "ORDEN_NO_ADMITE_CAMBIOS_DE_ETAPA" } });
        const actual = await leerOrden(entorno.ordenes, orden.id);
        expect(actual.estado).toBe(etapaPrimero ? "EN_PRODUCCION" : "LISTA");
        expect(actual.etapas.some((etapa) => etapa.estado === "PENDIENTE")).toBe(etapaPrimero);
      }
    });
  }
}

function registrarEntregaRetrabajo(ronda: number) {
  it(`entregar contra retrabajo: una transición y ninguna etapa huérfana, ronda ${ronda}`, async () => {
    for (const entregarPrimero of [true, false]) {
      const orden = await prepararLista(entorno);
      const lista = await entorno.servicio.marcarLista(orden.id, { version: orden.actualizadoEn }, entorno.actor);
      const entregar = () => entorno.ordenes.modulos.servicio.entregarOrden(lista.id, lista.actualizadoEn, entorno.operaciones);
      const retrabajo = () => entorno.servicio.reabrirPorRetrabajo(lista.id, { version: lista.actualizadoEn,
        motivo: "Corrección concurrente", areaId: orden.etapas[0].area.id, nombre: "Corrección" }, entorno.actor);
      const resultados = entregarPrimero
        ? await carrera({ ordenId: orden.id, primera: entregar, segunda: retrabajo })
        : await carrera({ ordenId: orden.id, primera: retrabajo, segunda: entregar });
      expect(resultados[0].ok).toBe(true);
      expect(resultados[1]).toMatchObject({ ok: false, error: { codigo: "CONFLICTO_EDICION" } });
      const actual = await leerOrden(entorno.ordenes, orden.id);
      expect(actual.estado).toBe(entregarPrimero ? "ENTREGADA" : "EN_PRODUCCION");
      expect(actual.etapas).toHaveLength(entregarPrimero ? 2 : 3);
      expect(actual.fechaInicioReal).toBe(lista.fechaInicioReal);
    }
  });
}

function registrarCompletadoDuplicado(ronda: number) {
  it(`dos usuarios completan la misma etapa: un evento confirmado, ronda ${ronda}`, async () => {
    const orden = await nuevaOrden(entorno);
    const asignada = await asignarEtapa(entorno, orden.etapas[0]);
    const etapa = await entorno.servicio.iniciarEtapa(asignada.id, { version: asignada.actualizadoEn }, entorno.actor);
    const resultados = await carrera({ ordenId: orden.id,
      primera: () => entorno.servicio.completarEtapa(etapa.id, { version: etapa.actualizadoEn }, entorno.actor),
      segunda: () => entorno.servicio.completarEtapa(etapa.id, { version: etapa.actualizadoEn }, segundoActor) });
    expect(resultados.filter((resultado) => resultado.ok)).toHaveLength(1);
    expect(resultados[1]).toMatchObject({ ok: false, error: { codigo: "CONFLICTO_EDICION" } });
    const actual = await leerOrden(entorno.ordenes, orden.id);
    expect(actual.etapas[0].estado).toBe("COMPLETADA");
    expect(actual.eventos.filter((evento) => evento.entidadId === etapa.id && evento.estadoNuevo === "COMPLETADA")).toHaveLength(1);
  });
}

describeConBase("producción: concurrencia con bloqueos observables", () => {
  beforeAll(async () => {
  entorno = await prepararProduccion(db);
  segundoActor = (await abrirSesion(db, entorno.ordenes.cotizaciones.modulos, "PRODUCCION")).actor;
    });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });
  for (const ronda of [1, 2, 3]) {
    registrarArchivoArea(ronda);
    registrarPrimerInicio(ronda);
    registrarEtapasDistintas(ronda);
    registrarInicioCancelacion(ronda);
    registrarEjecucionCancelacion(ronda);
    registrarConsumoLista(ronda);
    registrarEtapasLista(ronda);
    registrarEntregaRetrabajo(ronda);
    registrarCompletadoDuplicado(ronda);
  }
});
