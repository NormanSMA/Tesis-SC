import { afterAll, beforeAll, expect, it } from "vitest";

import { sembrarReferencia } from "../../prisma/seed/referencia";
import { liberarClienteGlobal, peticion } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import type { ClienteDto } from "@/modules/clientes/tipos";
import {
  abrirSesion,
  cargarModuloClientes,
  cuerpoCliente,
  invocar,
  type ModuloClientes,
  type Sesion,
} from "./clientes-ayudas";

const RONDAS = 12;

describeConBase("clientes: concurrencia de escrituras", () => {
  const db = crearClientePropietario();
  let modulos: ModuloClientes;
  let ventas: Sesion;

  beforeAll(async () => {
    await sembrarReferencia(db);
    modulos = await cargarModuloClientes();
    ventas = await abrirSesion(db, modulos, "VENTAS");
  });

  afterAll(async () => {
    await liberarClienteGlobal();
    await db.$disconnect();
  });

  async function clienteNuevo(): Promise<ClienteDto> {
    const respuesta = await invocar<ClienteDto>(
      modulos.lista.POST,
      peticion("POST", "/api/v1/clientes", { cookie: ventas.cookie, cuerpo: cuerpoCliente() }),
    );
    return respuesta.datos;
  }

  const editar = (id: string, cuerpo: Record<string, unknown>) =>
    invocar<ClienteDto>(
      modulos.ficha.PATCH,
      peticion("PATCH", `/api/v1/clientes/${id}`, { cookie: ventas.cookie, cuerpo }),
      id,
    );

  const archivar = (id: string, version: string) =>
    invocar<ClienteDto>(
      modulos.archivar.POST,
      peticion("POST", `/api/v1/clientes/${id}/archivar`, { cookie: ventas.cookie, cuerpo: { version } }),
      id,
    );

  const eventos = (id: string, accion: string) =>
    db.bitacora.count({ where: { entidad: "CLIENTE", entidadId: id, accion: accion as "EDITAR" } });

  it(`dos PATCH simultáneos con la misma versión: uno gana y el otro recibe 409 (${RONDAS} rondas)`, async () => {
    for (let ronda = 0; ronda < RONDAS; ronda += 1) {
      const cliente = await clienteNuevo();
      const [a, b] = await Promise.all([
        editar(cliente.id, { version: cliente.actualizadoEn, notas: "desde A" }),
        editar(cliente.id, { version: cliente.actualizadoEn, direccion: "desde B" }),
      ]);
      const estados = [a.status, b.status].sort();
      expect(estados).toEqual([200, 409]);
      const perdedor = a.status === 409 ? a : b;
      expect(perdedor.error?.codigo).toBe("CONFLICTO_EDICION");

      const guardado = await db.cliente.findUniqueOrThrow({ where: { id: cliente.id } });
      const ganoA = a.status === 200;
      expect(guardado.notas).toBe(ganoA ? "desde A" : null);
      expect(guardado.direccion).toBe(ganoA ? null : "desde B");
      expect(await eventos(cliente.id, "EDITAR")).toBe(1);
    }
  });

  it("dos PATCH simultáneos sobre el mismo campo dejan exactamente el valor del ganador", async () => {
    const cliente = await clienteNuevo();
    const [a, b] = await Promise.all([
      editar(cliente.id, { version: cliente.actualizadoEn, notas: "uno" }),
      editar(cliente.id, { version: cliente.actualizadoEn, notas: "dos" }),
    ]);
    const ganador = a.status === 200 ? a : b;
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const guardado = await db.cliente.findUniqueOrThrow({ where: { id: cliente.id } });
    expect(guardado.notas).toBe(ganador.datos.notas);
    expect(guardado.actualizadoEn.toISOString()).toBe(ganador.datos.actualizadoEn);
  });

  it(`editar frente a archivar con la misma versión: uno gana y el otro recibe 409 (${RONDAS} rondas)`, async () => {
    let ganaronEdicion = 0;
    let ganaronArchivo = 0;
    for (let ronda = 0; ronda < RONDAS; ronda += 1) {
      const cliente = await clienteNuevo();
      const [edicion, archivo] = await Promise.all([
        editar(cliente.id, { version: cliente.actualizadoEn, notas: "edición" }),
        archivar(cliente.id, cliente.actualizadoEn),
      ]);
      expect([edicion.status, archivo.status].sort()).toEqual([200, 409]);
      const perdedor = edicion.status === 409 ? edicion : archivo;
      expect(perdedor.error?.codigo).toBe("CONFLICTO_EDICION");

      const guardado = await db.cliente.findUniqueOrThrow({ where: { id: cliente.id } });
      if (edicion.status === 200) {
        ganaronEdicion += 1;
        expect(guardado).toMatchObject({ notas: "edición", activo: true });
        expect(await eventos(cliente.id, "ARCHIVAR")).toBe(0);
      } else {
        ganaronArchivo += 1;
        expect(guardado).toMatchObject({ notas: null, activo: false });
        expect(await eventos(cliente.id, "EDITAR")).toBe(0);
      }
    }
    expect(ganaronEdicion + ganaronArchivo).toBe(RONDAS);
  });

  it("dos archivados simultáneos: uno gana y el otro recibe 409", async () => {
    const cliente = await clienteNuevo();
    const [a, b] = await Promise.all([
      archivar(cliente.id, cliente.actualizadoEn),
      archivar(cliente.id, cliente.actualizadoEn),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await eventos(cliente.id, "ARCHIVAR")).toBe(1);
  });

  it("el UPDATE condicionado se reevalúa tras esperar el bloqueo de fila: el segundo escritor no pisa al primero", async () => {
    const { prisma } = await import("@/lib/db");
    const { actualizarCondicionado } = await import("@/modules/clientes/repo");
    const cliente = await clienteNuevo();
    const condicion = { id: cliente.id, activo: true, version: cliente.actualizadoEn };
    const pausa = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

    const primero = prisma.$transaction(async (tx) => {
      const aplicado = await actualizarCondicionado(tx, condicion, { notas: "primero" });
      await pausa(400);
      return aplicado;
    });
    await pausa(100);
    const segundo = prisma.$transaction((tx) => actualizarCondicionado(tx, condicion, { notas: "segundo" }));

    expect(await primero).toBe(true);
    expect(await segundo).toBe(false);
    expect((await db.cliente.findUniqueOrThrow({ where: { id: cliente.id } })).notas).toBe("primero");
  });
});
