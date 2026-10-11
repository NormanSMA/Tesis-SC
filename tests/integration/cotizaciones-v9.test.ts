import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { ESTADOS } from "@/modules/cotizaciones/schema";
import type { CotizacionDto } from "@/modules/cotizaciones/tipos";
import { liberarClienteGlobal, peticion } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import {
  abrirSesion, crearBorrador, invocar, itemsMixtos, prepararCotizaciones, totales,
  type EntornoCotizaciones, type SesionCotizacion,
} from "./cotizaciones-ayudas";

describeConBase("cotizaciones v9: aprobación y versiones corregidas", () => {
  const db = crearClientePropietario();
  let entorno: EntornoCotizaciones;
  let operaciones: SesionCotizacion;
  beforeAll(async () => {
    entorno = await prepararCotizaciones(db);
    operaciones = await abrirSesion(db, entorno.modulos, "OPERACIONES");
  });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  async function enviada() {
    const borrador = await crearBorrador(entorno, { items: itemsMixtos(entorno.referencias) });
    return entorno.modulos.servicio.enviarCotizacion(borrador.id, borrador.actualizadoEn, entorno.ventas.actor);
  }

  async function solicitarAjustes(cotizacion: CotizacionDto) {
    return entorno.modulos.servicio.responderCotizacion(cotizacion.id, {
      version: cotizacion.actualizadoEn, resultado: "AJUSTE_SOLICITADO", motivoAjuste: " Cambiar las medidas ",
    }, operaciones.actor);
  }

  it("aprobar sin referencia responde 422 y conserva cotización y bitácora", async () => {
    const cotizacion = await enviada();
    const eventos = await db.bitacora.count({ where: { cotizacionId: cotizacion.id } });
    const respuesta = await invocar(entorno.modulos.responder.POST,
      peticion("POST", `/api/v1/cotizaciones/${cotizacion.id}/responder`, {
        cookie: operaciones.cookie, cuerpo: { version: cotizacion.actualizadoEn, resultado: "APROBADA" },
      }), cotizacion.id);
    expect(respuesta.status).toBe(422);
    expect(respuesta.error?.campos?.referenciaAprobacion).toBeTruthy();
    expect(await entorno.modulos.servicio.obtenerCotizacion(cotizacion.id)).toEqual(cotizacion);
    expect(await db.bitacora.count({ where: { cotizacionId: cotizacion.id } })).toBe(eventos);
  });

  it("aprobar registra el actor autenticado, la referencia y su bitácora", async () => {
    const cotizacion = await enviada();
    const referenciaAprobacion = "Correo del cliente del 10/10";
    const respuesta = await invocar<CotizacionDto>(entorno.modulos.responder.POST,
      peticion("POST", `/api/v1/cotizaciones/${cotizacion.id}/responder`, {
        cookie: operaciones.cookie, cuerpo: { version: cotizacion.actualizadoEn, resultado: "APROBADA",
          referenciaAprobacion, usuarioAprobacionId: entorno.ventas.usuarioId },
      }), cotizacion.id);
    expect(respuesta.status).toBe(200);
    expect(respuesta.datos).toMatchObject({ estado: "APROBADA", referenciaAprobacion,
      usuarioAprobacionId: operaciones.usuarioId, usuarioAprobacion: { id: operaciones.usuarioId } });
    expect(await db.cotizacion.findUniqueOrThrow({ where: { id: cotizacion.id } }))
      .toMatchObject({ referenciaAprobacion, usuarioAprobacionId: operaciones.usuarioId });
    expect(await db.bitacora.findFirstOrThrow({ where: { cotizacionId: cotizacion.id, estadoNuevo: "APROBADA" } }))
      .toMatchObject({ usuarioId: operaciones.usuarioId, detalle: { referenciaAprobacion, usuarioAprobacionId: operaciones.usuarioId } });
    const lista = await entorno.modulos.servicio.listarCotizaciones({ q: cotizacion.numero, archivadas: "false", pagina: 1, porPagina: 20 });
    expect(lista.datos[0]).toMatchObject({ referenciaAprobacion, usuarioAprobacion: respuesta.datos.usuarioAprobacion, version: 1 });
  });

  it("solicitar ajustes exige motivo y guarda fecha, estado y bitácora", async () => {
    const cotizacion = await enviada();
    const respuesta = await invocar(entorno.modulos.responder.POST,
      peticion("POST", `/api/v1/cotizaciones/${cotizacion.id}/responder`, {
        cookie: operaciones.cookie, cuerpo: { version: cotizacion.actualizadoEn, resultado: "AJUSTE_SOLICITADO" },
      }), cotizacion.id);
    expect(respuesta.status).toBe(422);
    expect(respuesta.error?.campos?.motivoAjuste).toBeTruthy();
    const solicitada = await solicitarAjustes(cotizacion);
    expect(solicitada).toMatchObject({ estado: "AJUSTE_SOLICITADO", motivoAjuste: "Cambiar las medidas" });
    expect(solicitada.fechaRespuesta).toMatch(/Z$/);
    expect(totales(solicitada)).toEqual(totales(cotizacion));
    expect(await db.bitacora.findFirstOrThrow({ where: { cotizacionId: cotizacion.id, estadoNuevo: "AJUSTE_SOLICITADO" } }))
      .toMatchObject({ estadoAnterior: "ENVIADA", usuarioId: operaciones.usuarioId,
        detalle: { motivoAjuste: "Cambiar las medidas", fechaRespuesta: solicitada.fechaRespuesta } });
  });

  it("crear versión corregida copia los ítems y registra versión 2 con origen", async () => {
    const solicitada = await solicitarAjustes(await enviada());
    const respuesta = await invocar<CotizacionDto>(entorno.modulos.versionCorregida.POST,
      peticion("POST", `/api/v1/cotizaciones/${solicitada.id}/version-corregida`, { cookie: entorno.ventas.cookie, cuerpo: {} }), solicitada.id);
    expect(respuesta.status).toBe(201);
    const corregida = respuesta.datos;
    expect(corregida).toMatchObject({ estado: "BORRADOR", version: 2, cotizacionOrigenId: solicitada.id,
      asunto: solicitada.asunto, condiciones: solicitada.condiciones, fechaRespuesta: null, fechaEmision: null,
      fechaVencimiento: null, usuarioAprobacionId: null, referenciaAprobacion: null, motivoAjuste: null });
    expect(corregida.numero).not.toBe(solicitada.numero);
    expect(totales(corregida)).toEqual(totales(solicitada));
    expect(corregida.items.map(({ descripcion, importe, cantidad }) => ({ descripcion, importe, cantidad })))
      .toEqual(solicitada.items.map(({ descripcion, importe, cantidad }) => ({ descripcion, importe, cantidad })));
    expect(await entorno.modulos.servicio.obtenerCotizacion(solicitada.id)).toEqual(solicitada);
    expect(await db.bitacora.findFirstOrThrow({ where: { cotizacionId: corregida.id } }))
      .toMatchObject({ accion: "CREAR", usuarioId: entorno.ventas.usuarioId,
        detalle: { version: 2, cotizacionOrigenId: solicitada.id } });
    const segunda = await entorno.modulos.servicio.enviarCotizacion(corregida.id, corregida.actualizadoEn, entorno.ventas.actor);
    const tercerOrigen = await solicitarAjustes(segunda);
    expect(await entorno.modulos.servicio.crearVersionCorregida(tercerOrigen.id, entorno.ventas.actor))
      .toMatchObject({ version: 3, cotizacionOrigenId: corregida.id });
  });

  it("rechaza versión corregida fuera de ajustes y con origen archivado", async () => {
    const cotizacion = await enviada();
    await expect(entorno.modulos.servicio.crearVersionCorregida(cotizacion.id, entorno.ventas.actor))
      .rejects.toMatchObject({ status: 409, codigo: "TRANSICION_INVALIDA" });
    const solicitada = await solicitarAjustes(cotizacion);
    await entorno.modulos.servicio.archivarCotizacion(solicitada.id, solicitada.actualizadoEn, entorno.ventas.actor);
    await expect(entorno.modulos.servicio.crearVersionCorregida(solicitada.id, entorno.ventas.actor))
      .rejects.toMatchObject({ status: 409, codigo: "COTIZACION_ARCHIVADA" });
    expect(await db.cotizacion.count({ where: { cotizacionOrigenId: cotizacion.id } })).toBe(0);
  });

  it("revierte aprobación, ajustes y versión corregida cuando falla la bitácora", async () => {
    const cotizacion = await enviada();
    const bitacora = await import("@/lib/bitacora");
    const falla = vi.spyOn(bitacora, "registrarEvento").mockRejectedValue(new Error("Bitácora indisponible"));
    try {
      for (const resultado of ["APROBADA", "AJUSTE_SOLICITADO"] as const) {
        await expect(entorno.modulos.servicio.responderCotizacion(cotizacion.id, {
          version: cotizacion.actualizadoEn, resultado, referenciaAprobacion: "Correo del cliente", motivoAjuste: "Cambiar medidas",
        }, operaciones.actor)).rejects.toThrow("Bitácora indisponible");
        expect(await entorno.modulos.servicio.obtenerCotizacion(cotizacion.id)).toEqual(cotizacion);
      }
    } finally { falla.mockRestore(); }
    const solicitada = await solicitarAjustes(cotizacion);
    const fallaCorreccion = vi.spyOn(bitacora, "registrarEvento").mockRejectedValue(new Error("Bitácora indisponible"));
    try {
      await expect(entorno.modulos.servicio.crearVersionCorregida(solicitada.id, entorno.ventas.actor))
        .rejects.toThrow("Bitácora indisponible");
      expect(await db.cotizacion.count({ where: { cotizacionOrigenId: solicitada.id } })).toBe(0);
    } finally { fallaCorreccion.mockRestore(); }
  });

  it("compara todas las transiciones del módulo con transicion_valida", async () => {
    const { transicionValidaCotizacion } = await import("@/modules/cotizaciones/estados");
    const estados = [...ESTADOS, "OTRO"];
    for (const desde of [null, ...estados]) {
      for (const hacia of estados) {
        const [fila] = await db.$queryRaw<{ valida: boolean }[]>`
          SELECT transicion_valida('cotizacion', ${desde}::text, ${hacia}::text) AS valida`;
        expect(transicionValidaCotizacion(desde, hacia), `${desde} -> ${hacia}`).toBe(fila.valida);
      }
    }
  });
});
