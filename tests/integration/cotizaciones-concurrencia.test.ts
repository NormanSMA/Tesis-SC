import { afterAll, beforeAll, expect, it } from "vitest";

import type { CotizacionDto } from "@/modules/cotizaciones/tipos";
import { liberarClienteGlobal, peticion } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import {
  crearBorrador, entradaExistente, invocar, itemPersonalizado, itemUnidad,
  prepararCotizaciones, type EntornoCotizaciones,
} from "./cotizaciones-ayudas";

const RONDAS = 12;

describeConBase("cotizaciones: escrituras concurrentes y versión optimista", () => {
  const db = crearClientePropietario();
  let entorno: EntornoCotizaciones;
  beforeAll(async () => { entorno = await prepararCotizaciones(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  function reemplazar(cotizacion: CotizacionDto, cantidad: string) {
    return invocar<CotizacionDto>(entorno.modulos.items.PUT, peticion("PUT", `/api/v1/cotizaciones/${cotizacion.id}/items`, {
      cookie: entorno.ventas.cookie,
      cuerpo: { version: cotizacion.actualizadoEn, items: [{ ...entradaExistente(cotizacion.items[0]), cantidad }] },
    }), cotizacion.id);
  }

  const eventos = (id: string, accion: "EDITAR" | "CAMBIAR_ESTADO") => db.bitacora.count({ where: { cotizacionId: id, accion } });

  it(`dos reemplazos con misma versión dejan solo el ganador (${RONDAS} rondas)`, async () => {
    for (let ronda = 0; ronda < RONDAS; ronda += 1) {
      const inicial = await crearBorrador(entorno, { items: [itemUnidad(entorno.referencias)] });
      const previos = await eventos(inicial.id, "EDITAR");
      const [a, b] = await Promise.all([reemplazar(inicial, "2"), reemplazar(inicial, "3")]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);
      const ganador = a.status === 200 ? a : b;
      const perdedor = a.status === 409 ? a : b;
      expect(perdedor.error?.codigo).toBe("CONFLICTO_EDICION");
      expect(await entorno.modulos.servicio.obtenerCotizacion(inicial.id)).toEqual(ganador.datos);
      expect(await eventos(inicial.id, "EDITAR")).toBe(previos + 1);
      expect(ganador.datos.items).toHaveLength(1);
      expect(ganador.datos.items[0].cantidad).toBe(a.status === 200 ? "2.000" : "3.000");
    }
  });

  it(`enviar frente a editar conserva estado, totales e ítems del ganador (${RONDAS} rondas)`, async () => {
    for (let ronda = 0; ronda < RONDAS; ronda += 1) {
      const inicial = await crearBorrador(entorno, { items: [itemPersonalizado(entorno.referencias)] });
      const previos = await eventos(inicial.id, "EDITAR");
      const [edicion, envio] = await Promise.all([
        reemplazar(inicial, "2"),
        invocar<CotizacionDto>(entorno.modulos.enviar.POST, peticion("POST", `/api/v1/cotizaciones/${inicial.id}/enviar`, {
          cookie: entorno.ventas.cookie, cuerpo: { version: inicial.actualizadoEn },
        }), inicial.id),
      ]);
      expect([edicion.status, envio.status].sort()).toEqual([200, 409]);
      expect((edicion.status === 409 ? edicion : envio).error?.codigo).toBe("CONFLICTO_EDICION");
      const ganoEdicion = edicion.status === 200;
      const guardada = await entorno.modulos.servicio.obtenerCotizacion(inicial.id);
      expect(guardada).toEqual(ganoEdicion ? edicion.datos : envio.datos);
      expect(guardada.estado).toBe(ganoEdicion ? "BORRADOR" : "ENVIADA");
      expect(guardada.items[0].cantidad).toBe(ganoEdicion ? "2.000" : "1.000");
      expect(guardada.items[0].costoTotal).toBe("17980.80");
      expect(await eventos(inicial.id, "EDITAR")).toBe(previos + (ganoEdicion ? 1 : 0));
      expect(await eventos(inicial.id, "CAMBIAR_ESTADO")).toBe(ganoEdicion ? 0 : 1);
    }
  });

  it("una versión anterior no permite editar, reemplazar ni archivar", async () => {
    const inicial = await crearBorrador(entorno, { items: [itemUnidad(entorno.referencias)] });
    const editada = await entorno.modulos.servicio.editarCotizacion(inicial.id, {
      version: inicial.actualizadoEn, asunto: "Versión nueva",
    }, entorno.ventas.actor);
    expect(editada.actualizadoEn).not.toBe(inicial.actualizadoEn);
    await expect(entorno.modulos.servicio.editarCotizacion(inicial.id, {
      version: inicial.actualizadoEn, asunto: "Versión vieja",
    }, entorno.ventas.actor)).rejects.toMatchObject({ status: 409, codigo: "CONFLICTO_EDICION" });
    expect((await reemplazar(inicial, "5")).status).toBe(409);
    await expect(entorno.modulos.servicio.archivarCotizacion(inicial.id, inicial.actualizadoEn, entorno.ventas.actor))
      .rejects.toMatchObject({ status: 409, codigo: "CONFLICTO_EDICION" });
    expect(await entorno.modulos.servicio.obtenerCotizacion(inicial.id)).toEqual(editada);
  });
});
