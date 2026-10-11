import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PERMISOS_POR_PERFIL } from "@/core/permisos";
import type { ClienteDto, FichaCliente, ListaClientes } from "@/modules/clientes/tipos";

import { sembrarReferencia } from "../../prisma/seed/referencia";
import { crearUsuarioPrueba, liberarClienteGlobal, peticion } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import {
  abrirSesion,
  conPermisoRevocado,
  crearCategoriaPrueba,
  crearClienteDirecto,
  crearCotizacionPrueba,
  crearOrdenPrueba,
  invocar,
  cargarModuloClientes,
  type ModuloClientes,
  type Sesion,
} from "./clientes-ayudas";

const APROBADAS_A = 22;

describeConBase("clientes: historial de la ficha (CF-11) y secciones por permiso", () => {
  const db = crearClientePropietario();
  let modulos: ModuloClientes;
  let ventas: Sesion;
  let gerencia: Sesion;
  let categoriaId: string;
  let responsableId: string;
  let clienteA: { id: string; nombre: string };
  let clienteB: { id: string; nombre: string };
  const cotizacionesA: string[] = [];
  const cotizacionesB: string[] = [];
  const ordenesA: string[] = [];
  const ordenesB: string[] = [];

  async function aprobadaConOrden(clienteId: string, total: string, ids: { cotizaciones: string[]; ordenes: string[] }) {
    const cotizacion = await crearCotizacionPrueba(db, { clienteId, usuarioId: ventas.usuarioId, categoriaId, estado: "APROBADA", total });
    const orden = await crearOrdenPrueba(db, { cotizacionId: cotizacion.id, categoriaId, responsableId });
    ids.cotizaciones.push(cotizacion.id);
    ids.ordenes.push(orden.id);
  }

  async function otraCotizacion(clienteId: string, estado: "BORRADOR" | "ENVIADA" | "RECHAZADA" | "VENCIDA", ids: string[]) {
    const cotizacion = await crearCotizacionPrueba(db, { clienteId, usuarioId: ventas.usuarioId, categoriaId, estado, total: "500.00" });
    ids.push(cotizacion.id);
  }

  beforeAll(async () => {
    await sembrarReferencia(db);
    modulos = await cargarModuloClientes();
    ventas = await abrirSesion(db, modulos, "ATENCION_CLIENTE");
    gerencia = await abrirSesion(db, modulos, "GERENCIA");
    categoriaId = await crearCategoriaPrueba(db);
    responsableId = (await crearUsuarioPrueba(db, { perfil: "PRODUCCION" })).id;
    clienteA = await crearClienteDirecto(db);
    clienteB = await crearClienteDirecto(db);

    const idsA = { cotizaciones: cotizacionesA, ordenes: ordenesA };
    for (let i = 0; i < APROBADAS_A; i += 1) await aprobadaConOrden(clienteA.id, "10.25", idsA);
    await otraCotizacion(clienteA.id, "RECHAZADA", cotizacionesA);
    await otraCotizacion(clienteA.id, "VENCIDA", cotizacionesA);
    await otraCotizacion(clienteA.id, "ENVIADA", cotizacionesA);
    await otraCotizacion(clienteA.id, "ENVIADA", cotizacionesA);
    await otraCotizacion(clienteA.id, "BORRADOR", cotizacionesA);

    await aprobadaConOrden(clienteB.id, "999.99", { cotizaciones: cotizacionesB, ordenes: ordenesB });
    await otraCotizacion(clienteB.id, "BORRADOR", cotizacionesB);
  });

  afterAll(async () => {
    await liberarClienteGlobal();
    await db.$disconnect();
  });

  const ficha = (id: string, sesion: Sesion = ventas) =>
    invocar<FichaCliente>(
      modulos.ficha.GET,
      peticion("GET", `/api/v1/clientes/${id}`, { cookie: sesion.cookie, origen: null }),
      id,
    );

  const lista = (consulta: string, sesion: Sesion = ventas) =>
    invocar<ListaClientes["datos"]>(
      modulos.lista.GET,
      peticion("GET", `/api/v1/clientes?${consulta}`, { cookie: sesion.cookie, origen: null }),
    );

  describe("CF-11: cada ficha muestra solo lo suyo", () => {
    it("el cliente A ve sus 27 cotizaciones y 22 órdenes, nunca las del cliente B", async () => {
      const { status, datos } = await ficha(clienteA.id);
      expect(status).toBe(200);
      expect(datos.cotizaciones?.total).toBe(cotizacionesA.length);
      expect(datos.trabajos?.total).toBe(ordenesA.length);
      for (const item of datos.cotizaciones?.items ?? []) {
        expect(cotizacionesA).toContain(item.id);
        expect(cotizacionesB).not.toContain(item.id);
      }
      for (const item of datos.trabajos?.items ?? []) {
        expect(ordenesA).toContain(item.id);
        expect(ordenesB).not.toContain(item.id);
      }
    });

    it("el cliente B ve solo sus 2 cotizaciones y su orden", async () => {
      const { datos } = await ficha(clienteB.id);
      expect(datos.cotizaciones?.items.map((c) => c.id).sort()).toEqual([...cotizacionesB].sort());
      expect(datos.trabajos?.items.map((o) => o.id)).toEqual(ordenesB);
      expect(datos.resumen).toMatchObject({ cotizaciones: 2, totalAprobado: "999.99" });
    });

    it("devuelve las 20 más recientes con el total real para 'mostrando N de M'", async () => {
      const { datos } = await ficha(clienteA.id);
      expect(datos.cotizaciones?.items).toHaveLength(20);
      expect(datos.cotizaciones?.total).toBe(27);
      expect(datos.trabajos?.items).toHaveLength(20);
      expect(datos.trabajos?.total).toBe(22);
      const recientes = await db.cotizacion.findMany({
        where: { clienteId: clienteA.id },
        orderBy: [{ creadoEn: "desc" }, { id: "desc" }],
        take: 20,
        select: { id: true },
      });
      expect(datos.cotizaciones?.items.map((c) => c.id)).toEqual(recientes.map((c) => c.id));
    });

    it("los totales y el conteo por estado cubren todo el historial, no las 20 mostradas", async () => {
      const { datos } = await ficha(clienteA.id);
      expect(datos.resumen).toEqual({
        cotizaciones: 27,
        porEstado: { BORRADOR: 1, ENVIADA: 2, APROBADA: 22, RECHAZADA: 1, VENCIDA: 1, AJUSTE_SOLICITADO: 0 },
        totalAprobado: "225.50",
      });
    });

    it("la fecha es fechaEmision y, en BORRADOR, la fecha de creación", async () => {
      const { datos } = await ficha(clienteA.id);
      const items = datos.cotizaciones?.items ?? [];
      const borrador = items.find((c) => c.estado === "BORRADOR");
      const emitida = items.find((c) => c.estado === "ENVIADA");
      const creada = await db.cotizacion.findUniqueOrThrow({ where: { id: borrador?.id } });
      const emitidaBd = await db.cotizacion.findUniqueOrThrow({ where: { id: emitida?.id } });
      expect(borrador?.fecha).toBe(
        new Intl.DateTimeFormat("en-CA", { timeZone: "America/Managua" }).format(creada.creadoEn),
      );
      expect(emitida?.fecha).toBe(emitidaBd.fechaEmision?.toISOString().slice(0, 10));
    });

    it("las cotizaciones llevan id, número, asunto, estado y total decimal en cadena", async () => {
      const { datos } = await ficha(clienteB.id);
      const aprobada = datos.cotizaciones?.items.find((c) => c.estado === "APROBADA");
      expect(aprobada).toMatchObject({ asunto: "Trabajo de prueba", total: "999.99" });
      expect(aprobada?.numero).toMatch(/^COT-\d{4}-\d{4,}$/);
      expect(datos.trabajos?.items[0].numero).toMatch(/^OT-\d{4}-\d{4,}$/);
      expect(datos.trabajos?.items[0].fechaEntrega).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("el historial se conserva tras archivar el cliente", async () => {
      const antes = (await ficha(clienteB.id)).datos;
      const archivado = await invocar<ClienteDto>(
        modulos.archivar.POST,
        peticion("POST", `/api/v1/clientes/${clienteB.id}/archivar`, { cookie: ventas.cookie, cuerpo: { version: antes.actualizadoEn } }),
        clienteB.id,
      );
      expect(archivado.status).toBe(200);
      const despues = (await ficha(clienteB.id)).datos;
      expect(despues.activo).toBe(false);
      expect(despues.cotizaciones).toEqual(antes.cotizaciones);
      expect(despues.trabajos).toEqual(antes.trabajos);
      expect(despues.resumen).toEqual(antes.resumen);
    });

    it("la actividad lista solo eventos del propio cliente, con el actor", async () => {
      const { datos } = await ficha(clienteB.id);
      expect(datos.actividad.map((e) => e.accion)).toEqual(["ARCHIVAR"]);
      expect(datos.actividad[0].actor).toBe(
        (await db.usuario.findUniqueOrThrow({ where: { id: ventas.usuarioId } })).nombre,
      );
    });

    it("la actividad se limita a los 20 eventos más recientes", async () => {
      const cliente = await crearClienteDirecto(db);
      let version = cliente.actualizadoEn.toISOString();
      for (let i = 0; i < 22; i += 1) {
        const respuesta = await invocar<ClienteDto>(
          modulos.ficha.PATCH,
          peticion("PATCH", `/api/v1/clientes/${cliente.id}`, { cookie: ventas.cookie, cuerpo: { version, notas: `n${i}` } }),
          cliente.id,
        );
        version = respuesta.datos.actualizadoEn;
      }
      const { datos } = await ficha(cliente.id);
      expect(datos.actividad).toHaveLength(20);
      expect(datos.actividad[0].detalle).toMatchObject({ cambios: { notas: { nuevo: "n21" } } });
    });

    it("el conteo de cotizaciones de la lista corresponde a cada cliente", async () => {
      const { datos } = await lista(`q=${encodeURIComponent(clienteA.nombre)}`);
      expect(datos).toHaveLength(1);
      expect(datos[0]).toMatchObject({ id: clienteA.id, cotizaciones: 27 });
    });
  });

  describe("secciones por permiso", () => {
    const sinCotizaciones = { perfil: "ATENCION_CLIENTE", permiso: "cotizacion:ver" } as const;
    const sinOrdenes = { perfil: "ATENCION_CLIENTE", permiso: "orden:ver" } as const;

    it("con la matriz por defecto Ventas y Gerencia ven todas las secciones", async () => {
      for (const sesion of [ventas, gerencia]) {
        const { datos } = await ficha(clienteA.id, sesion);
        expect(datos).toHaveProperty("resumen");
        expect(datos).toHaveProperty("cotizaciones");
        expect(datos).toHaveProperty("trabajos");
        expect(datos).toHaveProperty("actividad");
      }
    });

    it("sin cotizacion:ver no se devuelven cotizaciones ni resumen, pero sí trabajos y actividad", async () => {
      await conPermisoRevocado(db, sinCotizaciones, async () => {
        const { status, datos } = await ficha(clienteA.id);
        expect(status).toBe(200);
        expect(datos).not.toHaveProperty("cotizaciones");
        expect(datos).not.toHaveProperty("resumen");
        expect(datos.trabajos?.total).toBe(22);
        expect(datos.actividad).toBeDefined();
      });
    });

    it("sin orden:ver no se devuelven los trabajos, pero sí cotizaciones y resumen", async () => {
      await conPermisoRevocado(db, sinOrdenes, async () => {
        const { datos } = await ficha(clienteA.id);
        expect(datos).not.toHaveProperty("trabajos");
        expect(datos.cotizaciones?.total).toBe(27);
        expect(datos.resumen?.totalAprobado).toBe("225.50");
      });
    });

    it("sin cotizacion:ver la lista no trae el conteo de cotizaciones", async () => {
      await conPermisoRevocado(db, sinCotizaciones, async () => {
        const { datos } = await lista(`q=${encodeURIComponent(clienteA.nombre)}`);
        expect(datos).toHaveLength(1);
        expect(datos[0]).not.toHaveProperty("cotizaciones");
      });
    });

    it("sin cliente:ver la ficha y la lista responden 403 aunque tenga otros permisos", async () => {
      await conPermisoRevocado(db, { perfil: "ATENCION_CLIENTE", permiso: "cliente:ver" }, async () => {
        expect((await ficha(clienteA.id)).status).toBe(403);
        expect((await lista("")).status).toBe(403);
      });
    });

    it("la matriz queda restaurada después de cada revocación", async () => {
      const perfil = await db.perfil.findUniqueOrThrow({
        where: { codigo: "ATENCION_CLIENTE" },
        include: { permisos: { include: { permiso: true } } },
      });
      const vigentes = perfil.permisos.map(({ permiso }) => `${permiso.recurso}:${permiso.accion}`).sort();
      expect(vigentes).toEqual([...PERMISOS_POR_PERFIL.ATENCION_CLIENTE].sort());
    });
  });
});
