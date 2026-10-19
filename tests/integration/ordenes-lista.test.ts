import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { OrdenTrabajo } from "@/generated/prisma/client";
import { esquemaConsultaOrdenes, type ConsultaOrdenes } from "@/modules/ordenes/schema";
import { CAMPOS_ORDEN_ORDENES, type CampoOrdenOrdenes } from "@/modules/ordenes/tipos";
import { liberarClienteGlobal, peticion } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { crearReferencias } from "./cotizaciones-ayudas";
import { invocar, ponerEstado } from "./ordenes-ayudas";
import { crearCotizacionPanel, crearEtapaPanel, crearOrdenPanel, prepararPanel, type EntornoPanel } from "./panel-ayudas";

async function crearOrdenConEmpate(entorno: EntornoPanel) {
  const cotizacion = await crearCotizacionPanel(entorno, { estado: "APROBADA" });
  return entorno.db.$transaction(async (tx) => {
    const [numeracion] = await tx.$queryRaw<{ numero: string }[]>`SELECT siguiente_numero('ORDEN_TRABAJO') AS numero`;
    // creadoEn es inmutable; el empate debe fijarse al insertar.
    return tx.ordenTrabajo.create({ data: { numero: numeracion.numero, cotizacionId: cotizacion.id,
      clienteId: cotizacion.clienteId, categoriaId: entorno.ordenes.cotizaciones.referencias.categoria.id,
      creadoPorId: entorno.sesiones.OPERACIONES.usuarioId, responsableId: entorno.sesiones.PRODUCCION.usuarioId,
      fechaEntrega: new Date("2099-01-01"), creadoEn: new Date("2000-01-01T12:00:00Z") } });
  });
}

describeConBase("órdenes: orden, conteos y avance de lista", () => {
  const db = crearClientePropietario();
  let entorno: EntornoPanel;
  let ordenes: OrdenTrabajo[];
  let clienteId: string;
  const nombres = new Map<string, string>();
  const marca = `Lista_100% ${randomUUID()}`;
  const esperados = { PENDIENTE: 1, EN_PRODUCCION: 1, LISTA: 1, ENTREGADA: 1,
    CERRADA: 1, CANCELADA: 1, activas: 4, atrasadas: 3, sinResponsable: 3 };

  beforeAll(async () => {
    entorno = await prepararPanel(db);
    const referencias = entorno.ordenes.cotizaciones.referencias;
    clienteId = referencias.cliente.id;
    await db.cliente.update({ where: { id: clienteId }, data: { nombre: `${marca} A` } });
    nombres.set(clienteId, `${marca} A`);
    ordenes = [];
    for (const estado of ["PENDIENTE", "EN_PRODUCCION", "LISTA", "ENTREGADA", "CERRADA", "CANCELADA"] as const) {
      const orden = await crearOrdenPanel(entorno, { fechaEntrega: estado === "LISTA" ? "2099-01-01" : "2000-01-01",
        responsableId: estado === "EN_PRODUCCION" ? entorno.sesiones.PRODUCCION.usuarioId : null });
      await ponerEstado(db, orden.id, estado);
      ordenes.push({ ...orden, estado });
    }
    const otrasReferencias = await crearReferencias(db);
    await db.cliente.update({ where: { id: otrasReferencias.cliente.id }, data: { nombre: `${marca} Z` } });
    nombres.set(otrasReferencias.cliente.id, `${marca} Z`);
    const otroEntorno: EntornoPanel = { ...entorno, ordenes: { ...entorno.ordenes,
      cotizaciones: { ...entorno.ordenes.cotizaciones, referencias: { ...referencias, cliente: otrasReferencias.cliente } } } };
    ordenes.push(await crearOrdenPanel(otroEntorno, { fechaEntrega: "2099-01-01" }));
    ordenes.push(await crearOrdenConEmpate(otroEntorno), await crearOrdenConEmpate(otroEntorno));
    const areaId = (await db.area.create({ data: { nombre: `Área ${randomUUID()}` } })).id;
    const produccion = ordenes[1];
    const instante = new Date("2026-10-01T12:00:00Z");
    for (const [indice, estado] of (["COMPLETADA", "OMITIDA", "PENDIENTE", "EN_CURSO"] as const).entries()) {
      await crearEtapaPanel(entorno, { ordenId: produccion.id, areaId, nombre: `Etapa ${indice}`, secuencia: indice + 1,
        estado, responsableId: entorno.sesiones.PRODUCCION.usuarioId,
        fechaInicioReal: instante, fechaFinReal: estado === "COMPLETADA" ? instante : null });
    }
    await crearEtapaPanel(entorno, { ordenId: ordenes[0].id, areaId, nombre: "Omitida", secuencia: 1, estado: "OMITIDA" });
  });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  function consultar(filtros: Partial<ConsultaOrdenes> = {}) {
    return entorno.ordenes.modulos.servicio.listarOrdenes(esquemaConsultaOrdenes.parse({ cliente: clienteId, ...filtros,
      orden: filtros.orden ? `${filtros.orden.campo}:${filtros.orden.direccion}` : undefined }),
      entorno.sesiones.PRODUCCION.actor);
  }

  function valorOrden(orden: OrdenTrabajo, campo: CampoOrdenOrdenes): string {
    if (campo === "cliente") return nombres.get(orden.clienteId)!;
    if (campo === "numero") return orden.numero;
    return orden[campo].toISOString();
  }

  for (const campo of CAMPOS_ORDEN_ORDENES) {
    it.each(["asc", "desc"] as const)(`${campo}:%s ordena y desempata por id entre páginas`, async (direccion) => {
      const esperado = [...ordenes].sort((a, b) => {
        const primero = valorOrden(a, campo);
        const segundo = valorOrden(b, campo);
        const comparacion = primero === segundo ? (a.id < b.id ? -1 : 1) : (primero < segundo ? -1 : 1);
        return direccion === "asc" ? comparacion : -comparacion;
      }).map(({ id }) => id);
      const ids: string[] = [];
      for (let pagina = 1; pagina <= 4; pagina += 1) {
        const lista = await consultar({ cliente: undefined, q: marca, terminales: "todas", orden: { campo, direccion }, porPagina: 3, pagina });
        expect(lista.total).toBe(9);
        ids.push(...lista.datos.map(({ id }) => id));
      }
      expect(ids).toEqual(esperado);
      expect(new Set(ids).size).toBe(9);
    });
  }

  it("conserva el orden predeterminado por creación descendente", async () => {
    const predeterminada = await consultar({ terminales: "todas" });
    const explicita = await consultar({ terminales: "todas", orden: { campo: "creadoEn", direccion: "desc" } });
    expect(predeterminada.datos.map(({ id }) => id)).toEqual(explicita.datos.map(({ id }) => id));
  });

  it("excluye omitidas del avance y devuelve 0/0 sin etapas o con todas omitidas", async () => {
    const lista = await consultar({ terminales: "todas" });
    expect(lista.datos.find(({ id }) => id === ordenes[1].id)?.avance).toEqual({ completadas: 1, total: 3 });
    for (const orden of [ordenes[0], ordenes[2]]) {
      expect(lista.datos.find(({ id }) => id === orden.id)?.avance).toEqual({ completadas: 0, total: 0 });
    }
  });

  const filtros: { filtros: Partial<ConsultaOrdenes>; total: number }[] = [
    { filtros: {}, total: 3 }, { filtros: { estado: "LISTA" }, total: 1 },
    { filtros: { vencidas: "true" }, total: 2 }, { filtros: { responsable: "sin-responsable" }, total: 2 },
    { filtros: { terminales: "true" }, total: 3 }, { filtros: { terminales: "todas" }, total: 6 },
    { filtros: { terminales: "true", estado: "CANCELADA", responsable: "sin-responsable", vencidas: "true" }, total: 0 },
    { filtros: { pagina: 20, porPagina: 1 }, total: 3 },
  ];
  it.each(filtros)("mantiene conteos independientes para $filtros", async ({ filtros, total }) => {
    const lista = await consultar(filtros);
    expect(lista.conteos).toEqual(esperados);
    expect(lista.total).toBe(total);
    if (filtros.pagina === 20) expect(lista.datos).toEqual([]);
  });

  it("filtra responsable asignado sin alterar conteos", async () => {
    const lista = await consultar({ responsable: entorno.sesiones.PRODUCCION.usuarioId });
    expect(lista.total).toBe(1);
    expect(lista.conteos).toEqual(esperados);
  });

  it("aplica q y cliente a todos los conteos y escapa comodines", async () => {
    expect((await consultar({ q: marca.toUpperCase() })).conteos).toEqual(esperados);
    const todas = await consultar({ cliente: undefined, q: marca });
    expect(todas.conteos).toEqual({ ...esperados, PENDIENTE: 4, activas: 7 });
    const individual = await consultar({ q: ordenes[3].numero, terminales: "todas" });
    expect(individual.total).toBe(1);
    expect(individual.conteos).toEqual({ PENDIENTE: 0, EN_PRODUCCION: 0, LISTA: 0, ENTREGADA: 1,
      CERRADA: 0, CANCELADA: 0, activas: 1, atrasadas: 1, sinResponsable: 1 });
    for (const filtros of [{ cliente: randomUUID() }, { q: "ListaX100Y" }, { q: randomUUID() }]) {
      const vacia = await consultar(filtros);
      expect(vacia.total).toBe(0);
      expect(Object.values(vacia.conteos).every((cantidad) => cantidad === 0)).toBe(true);
    }
  });

  it("busca el asunto con los mismos conteos que el cliente", async () => {
    expect((await consultar({ q: "Prueba panel" })).conteos).toEqual(esperados);
  });

  it.each(["estado:asc", "cliente:arriba", "numero:desc:extra", "numero;DROP TABLE:asc"])(
    "rechaza orden=%s con HTTP 422", async (orden) => {
      const respuesta = await invocar(entorno.ordenes.modulos.lista.GET,
        peticion("GET", `/api/v1/ordenes?orden=${encodeURIComponent(orden)}`, { cookie: entorno.sesiones.PRODUCCION.cookie }));
      expect(respuesta.status).toBe(422);
      expect(respuesta.error).toMatchObject({ codigo: "VALIDACION", campos: { orden: expect.any(String) } });
    },
  );
});
