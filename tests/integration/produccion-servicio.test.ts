import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { crearUsuarioPrueba, liberarClienteGlobal } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { leerOrden, ponerEstado } from "./ordenes-ayudas";
import { asignarEtapa, completarPrimera, nuevaOrden, prepararLista, prepararProduccion, type EntornoProduccion } from "./produccion-ayudas";

const db = crearClientePropietario();
let entorno: EntornoProduccion;

function registrarFlujo() {
  it("flujo completo: planificar, iniciar, completar, omitir, restaurar, lista, retrabajo y entregar", async () => {
    const { servicio, actor } = entorno;
    const orden = await nuevaOrden(entorno);
    const primera = await servicio.editarEtapa(orden.etapas[0].id, { version: orden.etapas[0].actualizadoEn,
      responsableId: actor.id, fechaInicioPlan: "2026-10-06", fechaFinPlan: "2026-10-07" }, actor);
    expect((await leerOrden(entorno.ordenes, orden.id)).actualizadoEn).toBe(orden.actualizadoEn);
    const iniciada = await servicio.iniciarEtapa(primera.id, { version: primera.actualizadoEn }, actor);
    const produciendo = await leerOrden(entorno.ordenes, orden.id);
    expect(produciendo.estado).toBe("EN_PRODUCCION");
    expect(produciendo.fechaInicioReal).toBe(iniciada.fechaInicioReal);
    const completada = await servicio.completarEtapa(primera.id, { version: iniciada.actualizadoEn }, actor);
    expect(completada.fechaFinReal).not.toBeNull();
    const omitida = await servicio.omitirEtapa(orden.etapas[1].id, { version: orden.etapas[1].actualizadoEn, motivo: "No corresponde" }, actor);
    expect(omitida.fechaInicioReal).toBeNull();
    const restaurada = await servicio.restaurarEtapa(omitida.id, { version: omitida.actualizadoEn }, actor);
    expect(restaurada.estado).toBe("PENDIENTE");
    await servicio.omitirEtapa(restaurada.id, { version: restaurada.actualizadoEn, motivo: "No corresponde" }, actor);
    const lista = await servicio.marcarLista(orden.id, { version: produciendo.actualizadoEn }, actor);
    const retrabajo = await servicio.reabrirPorRetrabajo(lista.id, { version: lista.actualizadoEn, motivo: "Corrección solicitada",
      nombre: "Corrección", areaId: primera.area.id }, actor);
    expect(retrabajo.fechaInicioReal).toBe(produciendo.fechaInicioReal);
    expect(retrabajo.etapas).toHaveLength(3);
    const nueva = retrabajo.etapas[2];
    expect(nueva).toMatchObject({ secuencia: 3, estado: "PENDIENTE", responsable: null });
    expect((await db.etapaOrden.findUniqueOrThrow({ where: { id: nueva.id } })).plantillaId).toBeNull();
    const asignada = await asignarEtapa(entorno, nueva);
    const reiniciada = await servicio.iniciarEtapa(nueva.id, { version: asignada.actualizadoEn }, actor);
    await servicio.completarEtapa(nueva.id, { version: reiniciada.actualizadoEn }, actor);
    const listaFinal = await servicio.marcarLista(orden.id, { version: retrabajo.actualizadoEn }, actor);
    const entregada = await entorno.ordenes.modulos.servicio.entregarOrden(listaFinal.id, listaFinal.actualizadoEn, actor);
    expect(entregada.estado).toBe("ENTREGADA");
    const eventos = await db.bitacora.findMany({ where: { ordenId: orden.id }, orderBy: { creadoEn: "asc" } });
    expect(eventos).toHaveLength(19);
    expect(eventos.filter((evento) => evento.entidad === "ETAPA_ORDEN").every((evento) => evento.ordenId === orden.id)).toBe(true);
    expect(eventos.find((evento) => evento.estadoAnterior === "LISTA" && evento.estadoNuevo === "EN_PRODUCCION")?.detalle)
      .toEqual({ motivo: "Corrección solicitada" });
  });
}

function registrarSinCambios() {
  it("PATCH sin cambios conserva versión y bitácora", async () => {
    const orden = await nuevaOrden(entorno);
    const etapa = await asignarEtapa(entorno, orden.etapas[0]);
    const eventos = await db.bitacora.count({ where: { ordenId: orden.id } });
    const igual = await entorno.servicio.editarEtapa(etapa.id, { version: etapa.actualizadoEn,
      responsableId: etapa.responsable!.id, fechaInicioPlan: null, fechaFinPlan: null }, entorno.actor);
    expect(igual).toEqual(etapa);
    expect(await db.bitacora.count({ where: { ordenId: orden.id } })).toBe(eventos);
  });
}

function registrarVersionVieja() {
  it("versión vieja y versión de otra etapa rechazan la escritura", async () => {
    const orden = await nuevaOrden(entorno);
    const inicial = orden.etapas[0];
    const asignada = await asignarEtapa(entorno, inicial);
    await expect(entorno.servicio.iniciarEtapa(inicial.id, { version: inicial.actualizadoEn }, entorno.actor))
      .rejects.toMatchObject({ status: 409, codigo: "CONFLICTO_EDICION" });
    expect((await db.etapaOrden.findUniqueOrThrow({ where: { id: inicial.id } })).estado).toBe("PENDIENTE");
    expect(asignada.actualizadoEn).not.toBe(inicial.actualizadoEn);
  });
}

function registrarSinResponsable() {
  it("rechaza iniciar sin responsable", async () => {
    const orden = await nuevaOrden(entorno);
    await expect(entorno.servicio.iniciarEtapa(orden.etapas[0].id, { version: orden.etapas[0].actualizadoEn }, entorno.actor))
      .rejects.toMatchObject({ status: 409, codigo: "ETAPA_SIN_RESPONSABLE" });
    expect((await leerOrden(entorno.ordenes, orden.id)).fechaInicioReal).toBeNull();
  });
}

function registrarResponsableInvalido() {
  it("responsables inexistentes, inactivos y de otro perfil responden 422", async () => {
    const orden = await nuevaOrden(entorno);
    const inactivo = await crearUsuarioPrueba(db, { perfil: "PRODUCCION", activo: false });
    for (const responsableId of [randomUUID(), inactivo.id, entorno.gerencia.id]) {
      await expect(entorno.servicio.editarEtapa(orden.etapas[0].id, { version: orden.etapas[0].actualizadoEn, responsableId }, entorno.actor))
        .rejects.toMatchObject({ status: 422, campos: { responsableId: expect.any(String) } });
    }
  });
}

function registrarResponsableInactivo() {
  it("revalida responsable inactivo al iniciar", async () => {
    const orden = await nuevaOrden(entorno);
    const usuario = await crearUsuarioPrueba(db, { perfil: "PRODUCCION" });
    const asignada = await entorno.servicio.editarEtapa(orden.etapas[0].id, { version: orden.etapas[0].actualizadoEn, responsableId: usuario.id }, entorno.actor);
    await db.usuario.update({ where: { id: usuario.id }, data: { activo: false } });
    await expect(entorno.servicio.iniciarEtapa(asignada.id, { version: asignada.actualizadoEn }, entorno.actor)).rejects.toMatchObject({ status: 422 });
  });
}

function registrarPlanificacion() {
  it("PATCH valida fechas contra valores existentes y no retira responsable en curso", async () => {
    const orden = await nuevaOrden(entorno);
    const etapa = await entorno.servicio.editarEtapa(orden.etapas[0].id, { version: orden.etapas[0].actualizadoEn,
      responsableId: entorno.actor.id, fechaInicioPlan: "2026-10-10" }, entorno.actor);
    await expect(entorno.servicio.editarEtapa(etapa.id, { version: etapa.actualizadoEn, fechaFinPlan: "2026-10-09" }, entorno.actor))
      .rejects.toMatchObject({ status: 422 });
    const iniciada = await entorno.servicio.iniciarEtapa(etapa.id, { version: etapa.actualizadoEn }, entorno.actor);
    await expect(entorno.servicio.editarEtapa(etapa.id, { version: iniciada.actualizadoEn, responsableId: null }, entorno.actor))
      .rejects.toMatchObject({ status: 422 });
  });
}

function registrarTransiciones() {
  it("transiciones coinciden con transicion_valida de PostgreSQL", async () => {
    const { TRANSICIONES_ETAPA } = await import("@/modules/produccion/reglas");
    for (const accion of Object.keys(TRANSICIONES_ETAPA) as (keyof typeof TRANSICIONES_ETAPA)[]) {
      for (const desde of ["PENDIENTE", "EN_CURSO", "COMPLETADA", "OMITIDA"]) {
        const hacia = TRANSICIONES_ETAPA[accion].hacia;
        const [fila] = await db.$queryRaw<{ valida: boolean }[]>`SELECT transicion_valida('etapa', ${desde}, ${hacia}) AS valida`;
        expect(fila.valida).toBe(desde === TRANSICIONES_ETAPA[accion].desde);
      }
    }
  });
}

function registrarEtapasCerradas() {
  it("completadas no se reabren ni reasignan; omitidas no cambian fechas", async () => {
    const { orden, completada } = await completarPrimera(entorno);
    await expect(entorno.servicio.restaurarEtapa(completada.id, { version: completada.actualizadoEn }, entorno.actor))
      .rejects.toMatchObject({ codigo: "TRANSICION_INVALIDA" });
    await expect(entorno.servicio.editarEtapa(completada.id, { version: completada.actualizadoEn, responsableId: null }, entorno.actor))
      .rejects.toMatchObject({ codigo: "ETAPA_NO_EDITABLE" });
    const omitida = await entorno.servicio.omitirEtapa(orden.etapas[1].id, { version: orden.etapas[1].actualizadoEn, motivo: "No corresponde" }, entorno.actor);
    await expect(entorno.servicio.editarEtapa(omitida.id, { version: omitida.actualizadoEn, fechaFinPlan: "2026-10-10" }, entorno.actor))
      .rejects.toMatchObject({ codigo: "ETAPA_NO_EDITABLE" });
  });
}

function registrarGuardasLista() {
  it("marcar lista rechaza etapas abiertas y órdenes sin trabajo", async () => {
    const orden = await nuevaOrden(entorno);
    await ponerEstado(db, orden.id, "EN_PRODUCCION");
    const vigente = await leerOrden(entorno.ordenes, orden.id);
    await expect(entorno.servicio.marcarLista(orden.id, { version: vigente.actualizadoEn }, entorno.actor))
      .rejects.toMatchObject({ codigo: "ETAPAS_ABIERTAS" });
    for (const etapa of vigente.etapas) await entorno.servicio.omitirEtapa(etapa.id, { version: etapa.actualizadoEn, motivo: "No corresponde" }, entorno.actor);
    await expect(entorno.servicio.marcarLista(orden.id, { version: vigente.actualizadoEn }, entorno.actor))
      .rejects.toMatchObject({ codigo: "ORDEN_SIN_TRABAJO" });
  });
}

function registrarVersionOrden() {
  it("lista y retrabajo usan versión de orden", async () => {
    const orden = await prepararLista(entorno);
    await expect(entorno.servicio.marcarLista(orden.id, { version: "2000-01-01T00:00:00Z" }, entorno.actor))
      .rejects.toMatchObject({ codigo: "CONFLICTO_EDICION" });
    const lista = await entorno.servicio.marcarLista(orden.id, { version: orden.actualizadoEn }, entorno.actor);
    await expect(entorno.servicio.reabrirPorRetrabajo(orden.id, { version: orden.actualizadoEn, motivo: "Corrección", nombre: "Corrección", areaId: orden.etapas[0].area.id }, entorno.actor))
      .rejects.toMatchObject({ codigo: "CONFLICTO_EDICION" });
    expect(lista.estado).toBe("LISTA");
  });
}

function registrarOrdenesBloqueadas() {
  for (const estado of ["LISTA", "ENTREGADA", "CERRADA", "CANCELADA"] as const) {
    it(`${estado} rechaza toda modificación de etapas`, async () => {
      const orden = await nuevaOrden(entorno);
      await ponerEstado(db, orden.id, estado);
      const etapa = orden.etapas[0];
      const version = { version: etapa.actualizadoEn };
      const operaciones = [() => entorno.servicio.editarEtapa(etapa.id, { ...version, responsableId: entorno.actor.id }, entorno.actor),
        () => entorno.servicio.iniciarEtapa(etapa.id, version, entorno.actor), () => entorno.servicio.completarEtapa(etapa.id, version, entorno.actor),
        () => entorno.servicio.omitirEtapa(etapa.id, { ...version, motivo: "No corresponde" }, entorno.actor),
        () => entorno.servicio.restaurarEtapa(etapa.id, version, entorno.actor),
        () => entorno.servicio.agregarEtapa(orden.id, { areaId: etapa.area.id, nombre: "Extra" }, entorno.actor)];
      for (const ejecutar of operaciones) await expect(ejecutar()).rejects.toMatchObject({ status: 409, codigo: "ORDEN_NO_ADMITE_CAMBIOS_DE_ETAPA" });
    });
  }
}

function registrarRollback() {
  it("un fallo de bitácora revierte etapa y primer inicio de orden", async () => {
    const orden = await nuevaOrden(entorno);
    const etapa = await asignarEtapa(entorno, orden.etapas[0]);
    const antes = await leerOrden(entorno.ordenes, orden.id);
    await expect(entorno.servicio.iniciarEtapa(etapa.id, { version: etapa.actualizadoEn }, { ...entorno.actor, id: randomUUID() })).rejects.toThrow();
    expect(await leerOrden(entorno.ordenes, orden.id)).toEqual(antes);
  });
}

function registrarEtapaManual() {
  it("agregar etapa usa máxima secuencia, sin plantilla y una fila CREAR", async () => {
    const orden = await nuevaOrden(entorno);
    const etapa = await entorno.servicio.agregarEtapa(orden.id, { nombre: "Acabado", areaId: orden.etapas[0].area.id }, entorno.actor);
    expect(etapa).toMatchObject({ secuencia: 3, estado: "PENDIENTE", responsable: null });
    expect((await db.etapaOrden.findUniqueOrThrow({ where: { id: etapa.id } })).plantillaId).toBeNull();
    expect(await db.bitacora.count({ where: { entidadId: etapa.id, ordenId: orden.id, accion: "CREAR" } })).toBe(1);
  });
}

describeConBase("producción: servicios y trazabilidad", () => {
  beforeAll(async () => { entorno = await prepararProduccion(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });
  registrarFlujo();
  registrarSinCambios();
  registrarVersionVieja();
  registrarSinResponsable();
  registrarResponsableInvalido();
  registrarResponsableInactivo();
  registrarPlanificacion();
  registrarTransiciones();
  registrarEtapasCerradas();
  registrarGuardasLista();
  registrarVersionOrden();
  registrarOrdenesBloqueadas();
  registrarRollback();
  registrarEtapaManual();
});
