import { beforeAll, afterAll, it, expect } from "vitest";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { liberarClienteGlobal, peticion } from "../helpers/auth";
import { abrirSesion, invocar } from "../helpers/fabricas";
import { asignarEtapa, nuevaOrden, prepararProduccion, type EntornoProduccion } from "./produccion-ayudas";

describeConBase("producción personal y secuencial", () => {
  const db = crearClientePropietario();
  let entorno: EntornoProduccion;
  beforeAll(async () => { entorno = await prepararProduccion(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  it("habilita impresión después de diseño, a su responsable y con un aviso personal", async () => {
    const orden = await nuevaOrden(entorno);
    const impresor = await abrirSesion(db, entorno.ordenes.cotizaciones.modulos, "PRODUCCION");
    const diseno = await asignarEtapa(entorno, orden.etapas[0]);
    const impresion = await asignarEtapa(entorno, orden.etapas[1], impresor.actor);
    const notificaciones = await import("@/app/api/v1/notificaciones/route");
    const avisos = async () => (await invocar<{ datos: { destino: string }[] }>(notificaciones.GET,
      peticion("GET", "/api/v1/notificaciones", { cookie: impresor.cookie }))).datos;
    expect((await entorno.servicio.obtenerTablero({ q: orden.numero }, impresor.actor)).datos).toHaveLength(0);
    expect((await avisos()).datos).toHaveLength(0);
    await expect(entorno.servicio.iniciarEtapa(impresion.id, { version: impresion.actualizadoEn }, impresor.actor))
      .rejects.toMatchObject({ status: 409, codigo: "ETAPA_ANTERIOR_PENDIENTE" });
    await expect(entorno.servicio.iniciarEtapa(diseno.id, { version: diseno.actualizadoEn }, impresor.actor))
      .rejects.toMatchObject({ status: 403 });
    const iniciada = await entorno.servicio.iniciarEtapa(diseno.id, { version: diseno.actualizadoEn }, entorno.actor);
    await entorno.servicio.completarEtapa(diseno.id, { version: iniciada.actualizadoEn }, entorno.actor);
    expect((await entorno.servicio.obtenerTablero({ q: orden.numero }, impresor.actor)).datos.map(e => e.id)).toEqual([impresion.id]);
    // Quien participa ve todas las etapas de la orden, aunque solo ejecute las suyas.
    expect((await entorno.servicio.obtenerEtapasOrden(orden.id, impresor.actor)).map(e => e.id)).toEqual(orden.etapas.map(e => e.id));
    expect((await avisos()).datos.map(n => n.destino)).toContain("/ordenes/" + orden.id);
    const ficha = await entorno.ordenes.modulos.servicio.obtenerOrden(orden.id, impresor.actor);
    expect(ficha.etapas.map(e => e.id)).toEqual(orden.etapas.map(e => e.id));
    expect((await entorno.servicio.iniciarEtapa(impresion.id, { version: impresion.actualizadoEn }, impresor.actor)).estado).toBe("EN_CURSO");
  });
});
