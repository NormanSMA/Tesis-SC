import { beforeAll, afterAll, it, expect } from "vitest";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { liberarClienteGlobal, peticion } from "../helpers/auth";
import { abrirSesion, invocar } from "../helpers/fabricas";
import type { CentroNotificaciones } from "@/modules/notificaciones/tipos";
import { esquemaConsultaOrdenes } from "@/modules/ordenes/schema";
import { asignarEtapa, nuevaOrden, prepararProduccion, type EntornoProduccion } from "./produccion-ayudas";

describeConBase("producción: órdenes compartidas, botón Hecho y avisos por etapa", () => {
  const db = crearClientePropietario();
  let entorno: EntornoProduccion;
  beforeAll(async () => { entorno = await prepararProduccion(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  async function sesionProduccion() {
    return abrirSesion(db, entorno.ordenes.cotizaciones.modulos, "PRODUCCION");
  }

  it("oculta las órdenes en las que el usuario no participa", async () => {
    const orden = await nuevaOrden(entorno);
    const ajeno = await sesionProduccion();
    const servicioOrdenes = entorno.ordenes.modulos.servicio;
    const lista = await servicioOrdenes.listarOrdenes(esquemaConsultaOrdenes.parse({ porPagina: 100, terminales: "todas" }), ajeno.actor);
    expect(lista.datos.map((fila) => fila.id)).not.toContain(orden.id);
    await expect(servicioOrdenes.obtenerOrden(orden.id, ajeno.actor)).rejects.toMatchObject({ status: 404 });
    await expect(entorno.servicio.obtenerEtapasOrden(orden.id, ajeno.actor)).rejects.toMatchObject({ status: 404 });
    const trazabilidad = await import("@/modules/trazabilidad/service");
    await expect(trazabilidad.obtenerTrazabilidad(orden.id, ajeno.actor)).rejects.toMatchObject({ status: 404 });
    // Gerencia y Operaciones conservan la vista completa.
    expect((await servicioOrdenes.obtenerOrden(orden.id, entorno.gerencia)).id).toBe(orden.id);
  });

  it("muestra la orden y todas sus etapas a quien participa, con historial", async () => {
    const orden = await nuevaOrden(entorno);
    const companero = await sesionProduccion();
    await asignarEtapa(entorno, orden.etapas[1], companero.actor);
    const servicioOrdenes = entorno.ordenes.modulos.servicio;
    const lista = await servicioOrdenes.listarOrdenes(esquemaConsultaOrdenes.parse({ porPagina: 100, terminales: "todas" }), companero.actor);
    expect(lista.datos.map((fila) => fila.id)).toEqual([orden.id]);
    const ficha = await servicioOrdenes.obtenerOrden(orden.id, companero.actor);
    expect(ficha.etapas.map((etapa) => etapa.id)).toEqual(orden.etapas.map((etapa) => etapa.id));
  });

  it("Hecho completa una etapa pendiente en un paso y deja ambos pasos en el historial", async () => {
    const orden = await nuevaOrden(entorno);
    const asignada = await asignarEtapa(entorno, orden.etapas[0]);
    const hecha = await entorno.servicio.terminarEtapa(asignada.id, { version: asignada.actualizadoEn }, entorno.actor);
    expect(hecha.estado).toBe("COMPLETADA");
    // Ambos pasos comparten instante (misma transacción): se comparan como conjunto.
    const historial = await db.historialEtapa.findMany({ where: { etapaId: asignada.id } });
    expect(historial.filter((fila) => fila.estadoAnterior && fila.estadoAnterior !== fila.estadoNuevo)
      .map((fila) => `${fila.estadoAnterior}>${fila.estadoNuevo}`).sort()).toEqual(["EN_CURSO>COMPLETADA", "PENDIENTE>EN_CURSO"]);
    const guardada = await db.etapaOrden.findUniqueOrThrow({ where: { id: asignada.id } });
    expect(guardada.fechaInicioReal).not.toBeNull();
    expect(guardada.fechaFinReal).not.toBeNull();
    expect((await db.ordenTrabajo.findUniqueOrThrow({ where: { id: orden.id } })).estado).toBe("EN_PRODUCCION");
  });

  it("Hecho rechaza etapas ajenas, bloqueadas o ya cerradas", async () => {
    const orden = await nuevaOrden(entorno);
    const otro = await sesionProduccion();
    const primera = await asignarEtapa(entorno, orden.etapas[0]);
    const segunda = await asignarEtapa(entorno, orden.etapas[1], otro.actor);
    await expect(entorno.servicio.terminarEtapa(primera.id, { version: primera.actualizadoEn }, otro.actor))
      .rejects.toMatchObject({ status: 403 });
    await expect(entorno.servicio.terminarEtapa(segunda.id, { version: segunda.actualizadoEn }, otro.actor))
      .rejects.toMatchObject({ status: 409, codigo: "ETAPA_ANTERIOR_PENDIENTE" });
    const hecha = await entorno.servicio.terminarEtapa(primera.id, { version: primera.actualizadoEn }, entorno.actor);
    await expect(entorno.servicio.terminarEtapa(primera.id, { version: hecha.actualizadoEn }, entorno.actor))
      .rejects.toMatchObject({ status: 409, codigo: "TRANSICION_INVALIDA" });
  });

  it("da un aviso por etapa a quien tiene dos áreas en la misma orden y marca lectura", async () => {
    const orden = await nuevaOrden(entorno);
    const doble = await sesionProduccion();
    const rutas = { lista: await import("@/app/api/v1/notificaciones/route"), leidas: await import("@/app/api/v1/notificaciones/leidas/route") };
    const centro = async () => (await invocar<CentroNotificaciones>(rutas.lista.GET,
      peticion("GET", "/api/v1/notificaciones", { cookie: doble.cookie }))).datos;
    const primera = await asignarEtapa(entorno, orden.etapas[0], doble.actor);
    const segunda = await asignarEtapa(entorno, orden.etapas[1], doble.actor);
    const propias = () => centro().then((datos) => datos.datos.filter((aviso) => aviso.destino === `/ordenes/${orden.id}`));
    expect((await propias()).map((aviso) => aviso.id.split(":")[1])).toEqual([primera.id]);
    await entorno.servicio.terminarEtapa(primera.id, { version: primera.actualizadoEn }, doble.actor);
    const avisos = await propias();
    expect(avisos.map((aviso) => aviso.id.split(":")[1])).toEqual([segunda.id]);
    expect(avisos[0].detalle).toContain(segunda.nombre);
    expect((await centro()).noLeidas).toBeGreaterThan(0);
    expect((await invocar(rutas.leidas.POST, peticion("POST", "/api/v1/notificaciones/leidas", { cookie: doble.cookie }))).status).toBe(200);
    expect((await centro()).noLeidas).toBe(0);
  });

  it("no muestra avisos de órdenes ni inventario al personal de Producción", async () => {
    await nuevaOrden(entorno);
    const ajeno = await sesionProduccion();
    const notificaciones = await import("@/modules/notificaciones/service");
    const { datos } = await notificaciones.obtenerNotificaciones(ajeno.actor);
    expect(datos.every((aviso) => aviso.tipo.startsWith("ETAPA"))).toBe(true);
    const gerencia = await notificaciones.obtenerNotificaciones(entorno.gerencia);
    expect(gerencia.datos.some((aviso) => aviso.tipo === "ORDEN_NUEVA")).toBe(true);
  });
});
