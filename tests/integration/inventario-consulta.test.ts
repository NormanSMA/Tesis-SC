import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { esquemaConsultaMovimientos } from "@/modules/inventario/schema";
import type { MovimientoDto } from "@/modules/inventario/dto";
import { liberarClienteGlobal, peticion } from "../helpers/auth";
import { crearBorrador, itemUnidad } from "./cotizaciones-ayudas";
import { clienteInventario, crearMaterial, invocar, prepararInventario, recibir, type EntornoInventario } from "./inventario-ayudas";

describe("inventario: libro, visibilidad y conciliación", () => {
  const db = clienteInventario();
  let entorno: EntornoInventario;
  beforeAll(async () => { entorno = await prepararInventario(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });
  async function ordenPropietario() {
    const { cotizaciones } = entorno;
    const servicio = cotizaciones.modulos.servicio;
    const borrador = await crearBorrador(cotizaciones, { items: [itemUnidad(cotizaciones.referencias)] });
    const enviada = await servicio.enviarCotizacion(borrador.id, borrador.actualizadoEn, cotizaciones.ventas.actor);
    const aprobada = await servicio.responderCotizacion(enviada.id, { version: enviada.actualizadoEn, resultado: "APROBADA" }, cotizaciones.ventas.actor);
    const [fila] = await db.$queryRaw<{ numero: string }[]>`SELECT siguiente_numero('ORDEN_TRABAJO') AS numero`;
    return db.ordenTrabajo.create({ data: { numero: fila.numero, cotizacionId: aprobada.id,
      categoriaId: cotizaciones.referencias.categoria.id, responsableId: entorno.sesiones.PRODUCCION.usuarioId,
      creadoPorId: entorno.sesiones.VENTAS.usuarioId, fechaEntrega: new Date("2026-10-07") } });
  }
  it("libro por material pagina, ordena y conserva el signo", async () => {
    const material = await crearMaterial(entorno);
    const primero = await recibir(entorno, material.id);
    const ajuste = await entorno.modulos.servicio.registrarAjuste({ materialId: material.id, direccion: "DISMINUIR", cantidad: "1.234", motivo: "Conteo físico" }, entorno.sesiones.GERENCIA.actor, randomUUID());
    const consulta = esquemaConsultaMovimientos.parse({ porPagina: 1 });
    const libro = await entorno.modulos.servicio.listarMovimientosMaterial(material.id, consulta, entorno.sesiones.VENTAS.actor);
    expect(libro.total).toBe(2); expect(libro.datos[0]).toMatchObject({ id: ajuste.id, cantidad: "-1.234" });
    const siguiente = await entorno.modulos.servicio.listarMovimientosMaterial(material.id, { ...consulta, pagina: 2 }, entorno.sesiones.VENTAS.actor);
    expect(siguiente.datos[0].id).toBe(primero.id);
  });
  it("filtra material, tipo y usuario", async () => {
    const material = await crearMaterial(entorno); await recibir(entorno, material.id);
    const consulta = esquemaConsultaMovimientos.parse({ material: material.id, tipo: "ENTRADA", usuario: entorno.sesiones.PRODUCCION.usuarioId });
    const libro = await entorno.modulos.servicio.listarMovimientos(consulta, entorno.sesiones.PRODUCCION.actor);
    expect(libro.total).toBe(1); expect(libro.datos[0].material.id).toBe(material.id);
    expect((await entorno.modulos.servicio.listarMovimientos({ ...consulta, usuario: entorno.sesiones.GERENCIA.usuarioId }, entorno.sesiones.VENTAS.actor)).total).toBe(0);
  });
  it("filtra desde y hasta por calendario de Managua", async () => {
    const material = await crearMaterial(entorno);
    for (const creadoEn of ["2026-10-06T05:59:59.999Z", "2026-10-06T06:00:00.000Z", "2026-10-07T05:59:59.999Z", "2026-10-07T06:00:00.000Z"]) {
      await db.movimientoInventario.create({ data: { materialId: material.id, tipo: "ENTRADA", cantidad: "1", costoUnitario: "1",
        usuarioId: entorno.sesiones.PRODUCCION.usuarioId, creadoEn: new Date(creadoEn) } });
    }
    const libro = await entorno.modulos.servicio.listarMovimientos(esquemaConsultaMovimientos.parse({ material: material.id, desde: "2026-10-06", hasta: "2026-10-06" }), entorno.sesiones.VENTAS.actor);
    expect(libro.total).toBe(2);
    expect(libro.datos.map((fila) => fila.creadoEn)).toEqual(["2026-10-07T05:59:59.999Z", "2026-10-06T06:00:00.000Z"]);
  });
  it("oculta costos de CONSUMO y DEVOLUCION en API y filtra orden", async () => {
    const material = await crearMaterial(entorno); await recibir(entorno, material.id);
    const orden = await ordenPropietario();
    await db.$transaction(async (tx) => {
      for (const [tipo, cantidad] of [["CONSUMO", "-3"], ["DEVOLUCION", "1"]] as const) {
        const movimiento = await tx.movimientoInventario.create({ data: { materialId: material.id, tipo, cantidad, usuarioId: entorno.sesiones.PRODUCCION.usuarioId } });
        await tx.consumoOrden.create({ data: { ordenId: orden.id, materialId: material.id, movimientoId: movimiento.id } });
      }
    });
    for (const perfil of ["GERENCIA", "VENTAS", "PRODUCCION"] as const) {
      const respuesta = await invocar<MovimientoDto[]>(entorno.modulos.movimientos.GET, peticion("GET", `/api/v1/movimientos?orden=${orden.id}`, { cookie: entorno.sesiones[perfil].cookie }));
      expect(respuesta.status).toBe(200); expect(respuesta.datos).toHaveLength(2);
      for (const movimiento of respuesta.datos) {
        expect(movimiento.orden?.id).toBe(orden.id);
        if (perfil === "PRODUCCION") {
          expect(movimiento).not.toHaveProperty("costoUnitario"); expect(movimiento).not.toHaveProperty("costoPromedioResultante");
        } else expect(movimiento).toMatchObject({ costoUnitario: "10.0000", costoPromedioResultante: "10.0000" });
      }
    }
    const ficha = await entorno.modulos.servicio.obtenerMaterial(material.id, entorno.sesiones.PRODUCCION.actor);
    expect(ficha.conciliacion).toEqual({ existencia: "8.000", sumaLibro: "8.000", conciliado: true });
  });
  it("mantiene costos de ENTRADA, AJUSTE y material visibles para Producción", async () => {
    const material = await crearMaterial(entorno); await recibir(entorno, material.id);
    await entorno.modulos.servicio.registrarAjuste({ materialId: material.id, direccion: "AUMENTAR", cantidad: "1", motivo: "Conteo físico" }, entorno.sesiones.GERENCIA.actor, randomUUID());
    const libro = await entorno.modulos.servicio.listarMovimientosMaterial(material.id, esquemaConsultaMovimientos.parse({}), entorno.sesiones.PRODUCCION.actor);
    expect(libro.datos.every((fila) => fila.costoUnitario === "10.0000")).toBe(true);
    expect((await entorno.modulos.servicio.obtenerMaterial(material.id, entorno.sesiones.PRODUCCION.actor)).costoPromedio).toBe("10.0000");
  });
  it("concilia bajo entradas concurrentes sin falso defecto", async () => {
    const material = await crearMaterial(entorno);
    const operaciones = Array.from({ length: 5 }, async () => {
      await recibir(entorno, material.id, { cantidad: "0.001" });
      return entorno.modulos.servicio.obtenerMaterial(material.id, entorno.sesiones.VENTAS.actor);
    });
    const fichas = await Promise.all(operaciones);
    expect(fichas.every((ficha) => ficha.conciliacion.conciliado && ficha.conciliacion.existencia === ficha.conciliacion.sumaLibro)).toBe(true);
    expect((await entorno.modulos.servicio.obtenerMaterial(material.id, entorno.sesiones.VENTAS.actor)).conciliacion)
      .toEqual({ existencia: "0.005", sumaLibro: "0.005", conciliado: true });
  });
  it("ofrece nombres en los filtros y aplica permisos", async () => {
    const material = await crearMaterial(entorno);
    const orden = await ordenPropietario();
    const opciones = await entorno.modulos.servicio.opcionesLibro(entorno.sesiones.PRODUCCION.actor);
    expect(opciones.materiales).toContainEqual({ id: material.id, codigo: material.codigo, nombre: material.nombre });
    expect(opciones.ordenes).toContainEqual({ id: orden.id, numero: orden.numero });
    expect(opciones.usuarios).toContainEqual({ id: entorno.sesiones.PRODUCCION.usuarioId, nombre: entorno.sesiones.PRODUCCION.actor.nombre });
    expect(() => entorno.modulos.servicio.opcionesLibro(entorno.sesiones.ADMIN.actor)).toThrow();
    const sinOrden = { ...entorno.sesiones.VENTAS.actor, permisos: ["inventario:ver"] };
    expect((await entorno.modulos.servicio.opcionesLibro(sinOrden)).ordenes).toEqual([]);
  });
});
