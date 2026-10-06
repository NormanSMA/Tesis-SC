import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";

import type { CotizacionDto } from "@/modules/cotizaciones/tipos";
import { liberarClienteGlobal } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import {
  crearBorrador, itemUnidad, nombreUnico, prepararCotizaciones, type EntornoCotizaciones,
} from "./cotizaciones-ayudas";

describeConBase("cotizaciones: consultas paginadas y archivo", () => {
  const db = crearClientePropietario();
  let entorno: EntornoCotizaciones;
  let cotizaciones: CotizacionDto[];
  const marca = nombreUnico("Filtro cotizaciones");
  beforeAll(async () => {
    entorno = await prepararCotizaciones(db);
    cotizaciones = [];
    for (let indice = 0; indice < 5; indice += 1) {
      cotizaciones.push(await crearBorrador(entorno, { asunto: `${marca} ${indice}`, items: [itemUnidad(entorno.referencias)] }));
    }
    cotizaciones[0] = await entorno.modulos.servicio.archivarCotizacion(cotizaciones[0].id, cotizaciones[0].actualizadoEn, entorno.ventas.actor);
    cotizaciones[1] = await entorno.modulos.servicio.enviarCotizacion(cotizaciones[1].id, cotizaciones[1].actualizadoEn, entorno.ventas.actor);
  });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  const consultar = (extra: Record<string, unknown> = {}) => entorno.modulos.servicio.listarCotizaciones({
    q: marca, archivadas: "false", pagina: 1, porPagina: 20, ...extra,
  });

  it("oculta archivadas por defecto y conserva su ficha e ítems", async () => {
    const lista = await consultar();
    expect(lista).toMatchObject({ total: 4, pagina: 1, porPagina: 20 });
    expect(lista.datos.map((fila) => fila.id)).not.toContain(cotizaciones[0].id);
    const ficha = await entorno.modulos.servicio.obtenerCotizacion(cotizaciones[0].id);
    expect(ficha.archivada).toBe(true);
    expect(ficha.items).toEqual(cotizaciones[0].items);
  });

  it("filtra solo archivadas y permite incluir todas", async () => {
    const archivadas = await consultar({ archivadas: "true" });
    expect(archivadas.total).toBe(1);
    expect(archivadas.datos.map((fila) => fila.id)).toEqual([cotizaciones[0].id]);
    expect((await consultar({ archivadas: "todas" })).total).toBe(5);
  });

  it("combina filtros estado, cliente y asunto sin distinguir mayúsculas", async () => {
    const lista = await consultar({ estado: "ENVIADA", cliente: entorno.referencias.cliente.id, q: marca.toUpperCase() });
    expect(lista.total).toBe(1);
    expect(lista.datos[0].id).toBe(cotizaciones[1].id);
    expect((await consultar({ cliente: randomUUID() })).total).toBe(0);
    expect((await consultar({ estado: "APROBADA" })).datos).toEqual([]);
  });

  it("busca por número y nombre vigente del cliente", async () => {
    const porNumero = await consultar({ q: cotizaciones[2].numero, cliente: entorno.referencias.cliente.id });
    expect(porNumero.datos.map((fila) => fila.id)).toEqual([cotizaciones[2].id]);
    const porCliente = await consultar({ q: entorno.referencias.cliente.nombre.toUpperCase() });
    expect(porCliente.total).toBe(4);
    expect(porCliente.datos.every((fila) => fila.cliente.id === entorno.referencias.cliente.id)).toBe(true);
  });

  it("pagina con orden estable sin repetir filas", async () => {
    const primera = await consultar({ porPagina: 2 });
    const segunda = await consultar({ porPagina: 2, pagina: 2 });
    const tercera = await consultar({ porPagina: 2, pagina: 3 });
    const esperado = await db.cotizacion.findMany({
      where: { clienteId: entorno.referencias.cliente.id, archivada: false },
      orderBy: [{ creadoEn: "desc" }, { id: "desc" }], select: { id: true },
    });
    expect(primera).toMatchObject({ total: 4, pagina: 1, porPagina: 2 });
    expect(segunda).toMatchObject({ total: 4, pagina: 2, porPagina: 2 });
    const ids = [...primera.datos, ...segunda.datos].map((fila) => fila.id);
    expect(ids).toEqual(esperado.map((fila) => fila.id));
    expect(new Set(ids).size).toBe(4);
    expect(tercera.datos).toEqual([]);
    expect(tercera.total).toBe(4);
  });

  it("muestra datos vigentes del cliente en la ficha", async () => {
    await db.cliente.update({ where: { id: entorno.referencias.cliente.id }, data: { direccion: "Dirección actualizada" } });
    const ficha = await entorno.modulos.servicio.obtenerCotizacion(cotizaciones[2].id);
    expect(ficha.cliente.direccion).toBe("Dirección actualizada");
    expect(ficha.total).toBe(cotizaciones[2].total);
  });

  it("rechaza rearchivar con versión anterior y conserva una sola bitácora ARCHIVAR", async () => {
    await expect(entorno.modulos.servicio.archivarCotizacion(cotizaciones[0].id, cotizaciones[0].creadoEn, entorno.ventas.actor))
      .rejects.toMatchObject({ status: 409, codigo: "CONFLICTO_EDICION" });
    expect(await db.bitacora.count({ where: { cotizacionId: cotizaciones[0].id, accion: "ARCHIVAR" } })).toBe(1);
  });
});
