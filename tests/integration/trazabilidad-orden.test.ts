import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";

import { liberarClienteGlobal, peticion } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { crearTrabajo, prepararTrazabilidad, type EntornoTrazabilidad } from "./trazabilidad-ayudas";

describeConBase("trazabilidad: orden de la bitácora global", () => {
  const db = crearClientePropietario();
  let entorno: EntornoTrazabilidad;
  let numero: string;
  let esperados: string[];
  beforeAll(async () => {
    entorno = await prepararTrazabilidad(db);
    const orden = await crearTrabajo(entorno);
    numero = orden.numero;
    const ids = [randomUUID(), randomUUID()].sort();
    const eventos = [[ids[1], "2000-01-01T00:00:00Z"], [ids[0], "2000-01-01T00:00:00Z"], [randomUUID(), "2000-01-03T00:00:00Z"]];
    for (const [id, fecha] of eventos) {
      await db.bitacora.create({ data: { id, entidad: "ORDEN_TRABAJO", entidadId: orden.id, ordenId: orden.id, accion: "EDITAR",
        usuarioId: entorno.sesiones.OPERACIONES.usuarioId, creadoEn: new Date(fecha) } });
    }
    // El filtro por número trae también eventos de etapas y movimientos: el esperado sale del mismo conjunto, ordenado aparte.
    const filas = (await (await consultar()).json()).datos as { id: string; creadoEn: string }[];
    esperados = [...filas].sort((a, b) => a.creadoEn.localeCompare(b.creadoEn) || a.id.localeCompare(b.id)).map((fila) => fila.id);
    expect(esperados).toEqual(expect.arrayContaining(eventos.map(([id]) => id)));
  });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  const consultar = (ordenar?: string) => entorno.rutas.global.GET(peticion("GET",
    `/api/v1/bitacora?${new URLSearchParams({ orden: numero, porPagina: "100", ...(ordenar ? { ordenar } : {}) })}`,
    { cookie: entorno.sesiones.GERENCIA.cookie }));
  const ids = async (ordenar?: string) => ((await (await consultar(ordenar)).json()).datos as { id: string }[]).map((fila) => fila.id);

  it("ordena descendente por defecto, con desempate por id", async () => {
    expect(await ids()).toEqual([...esperados].reverse());
    expect(await ids("creadoEn:desc")).toEqual([...esperados].reverse());
  });
  it("ordena ascendente con desempate por id", async () => {
    expect(await ids("creadoEn:asc")).toEqual(esperados);
  });
  it.each(["numero:asc", "creadoEn:arriba", "creadoEn:asc:x", "creadoEn; DROP TABLE bitacora;--"])(
    "responde 422 para ordenar=%s", async (ordenar) => {
      const respuesta = await consultar(ordenar);
      expect(respuesta.status).toBe(422);
      expect((await respuesta.json()).error.campos.ordenar).toBeTruthy();
    });
});
