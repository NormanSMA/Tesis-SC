import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { sembrarReferencia } from "../../prisma/seed/referencia";
import { liberarClienteGlobal, peticion } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import type { ClienteDto } from "@/modules/clientes/tipos";
import {
  abrirSesion,
  cargarModuloClientes,
  cuerpoCliente,
  invocar,
  nombreUnico,
  type ModuloClientes,
  type Sesion,
} from "./clientes-ayudas";

describeConBase("clientes: crear, editar, archivar y reactivar con su bitácora", () => {
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

  const crear = (cuerpo: Record<string, unknown>) =>
    invocar<ClienteDto>(
      modulos.lista.POST,
      peticion("POST", "/api/v1/clientes", { cookie: ventas.cookie, cuerpo }),
    );

  const editar = (id: string, cuerpo: Record<string, unknown>) =>
    invocar<ClienteDto>(
      modulos.ficha.PATCH,
      peticion("PATCH", `/api/v1/clientes/${id}`, { cookie: ventas.cookie, cuerpo }),
      id,
    );

  const cambiarEstado = (accion: "archivar" | "reactivar", id: string, cuerpo?: Record<string, unknown> | null) =>
    invocar<ClienteDto>(
      modulos[accion].POST,
      peticion("POST", `/api/v1/clientes/${id}/${accion}`, { cookie: ventas.cookie, cuerpo: cuerpo ?? undefined }),
      id,
    );

  const eventos = (id: string) =>
    db.bitacora.findMany({ where: { entidad: "CLIENTE", entidadId: id }, orderBy: { creadoEn: "asc" } });

  describe("crear", () => {
    it("crea el cliente con 201, lo normaliza y escribe el evento CREAR del actor", async () => {
      const nombre = nombreUnico();
      const { status, datos } = await crear({
        nombre: `  ${nombre}  `,
        tipo: "PERSONA",
        ruc: ` j0310 ${randomUUID().slice(0, 6)} `,
        correo: " Contacto@Empresa.TEST ",
        telefono: "  ",
        contactoPrincipal: "Ana",
      });
      expect(status).toBe(201);
      expect(datos).toMatchObject({
        nombre,
        tipo: "PERSONA",
        correo: "contacto@empresa.test",
        telefono: null,
        direccion: null,
        notas: null,
        activo: true,
      });
      expect(datos.ruc).toMatch(/^J0310[0-9A-F]{6}$/);
      const [evento, ...resto] = await eventos(datos.id);
      expect(resto).toHaveLength(0);
      expect(evento).toMatchObject({
        accion: "CREAR",
        usuarioId: ventas.usuarioId,
        estadoNuevo: "ACTIVO",
        ordenId: null,
        cotizacionId: null,
      });
    });

    it("rechaza con 422 un cliente sin teléfono ni correo y señala ambos campos", async () => {
      const { status, error } = await crear({ nombre: nombreUnico(), tipo: "EMPRESA" });
      expect(status).toBe(422);
      expect(Object.keys(error?.campos ?? {}).sort()).toEqual(["correo", "telefono"]);
    });

    it("rechaza un teléfono vacío o de solo espacios sin correo", async () => {
      for (const telefono of ["", "   "]) {
        const { status, error } = await crear({ nombre: nombreUnico(), tipo: "EMPRESA", telefono });
        expect(status).toBe(422);
        expect(error?.campos?.telefono).toBeTruthy();
      }
    });

    it("acepta solo correo y guarda el teléfono vacío como nulo", async () => {
      const { status, datos } = await crear({ ...cuerpoCliente({ telefono: "", correo: "solo@correo.test" }) });
      expect(status).toBe(201);
      expect(datos.telefono).toBeNull();
    });

    it("rechaza un nombre vacío y un tipo ausente con error por campo", async () => {
      const { status, error } = await crear({ nombre: "   ", telefono: "8888" });
      expect(status).toBe(422);
      expect(Object.keys(error?.campos ?? {}).sort()).toEqual(["nombre", "tipo"]);
    });

    it("responde 400 si el cuerpo no es JSON", async () => {
      const solicitud = new Request("http://localhost/api/v1/clientes", {
        method: "POST",
        headers: { origin: "http://localhost", cookie: ventas.cookie },
        body: "{no es json",
      });
      expect((await invocar(modulos.lista.POST, solicitud)).status).toBe(400);
    });

    it("responde 409 DUPLICADO con el campo ruc si el RUC ya existe, sin importar mayúsculas ni espacios", async () => {
      const ruc = `R${randomUUID().slice(0, 8).toUpperCase()}`;
      const primero = await crear(cuerpoCliente({ ruc }));
      expect(primero.status).toBe(201);
      const repetido = await crear(cuerpoCliente({ ruc: ` ${ruc.toLowerCase().slice(0, 4)} ${ruc.toLowerCase().slice(4)} ` }));
      expect(repetido.status).toBe(409);
      expect(repetido.error?.codigo).toBe("DUPLICADO");
      expect(repetido.error?.campos?.ruc).toBeTruthy();
      expect(await db.cliente.count({ where: { ruc } })).toBe(1);
    });

    it("no deja evento de bitácora cuando la creación falla", async () => {
      const ruc = `R${randomUUID().slice(0, 8).toUpperCase()}`;
      await crear(cuerpoCliente({ ruc }));
      const antes = await db.bitacora.count({ where: { entidad: "CLIENTE" } });
      await crear(cuerpoCliente({ ruc }));
      expect(await db.bitacora.count({ where: { entidad: "CLIENTE" } })).toBe(antes);
    });
  });

  describe("editar", () => {
    async function clienteNuevo(extra: Record<string, unknown> = {}): Promise<ClienteDto> {
      return (await crear(cuerpoCliente(extra))).datos;
    }

    it("cambia solo los campos enviados y deja intactos los omitidos", async () => {
      const cliente = await clienteNuevo({ contactoPrincipal: "Ana", direccion: "Managua" });
      const { status, datos } = await editar(cliente.id, { version: cliente.actualizadoEn, notas: "Cliente frecuente" });
      expect(status).toBe(200);
      expect(datos).toMatchObject({ nombre: cliente.nombre, contactoPrincipal: "Ana", direccion: "Managua", notas: "Cliente frecuente" });
    });

    it("borra un campo con nulo o con cadena vacía", async () => {
      const cliente = await clienteNuevo({ contactoPrincipal: "Ana", direccion: "Managua", correo: "a@b.co" });
      const { datos } = await editar(cliente.id, { version: cliente.actualizadoEn, contactoPrincipal: null, direccion: "  " });
      expect(datos).toMatchObject({ contactoPrincipal: null, direccion: null, correo: "a@b.co" });
    });

    it("escribe un evento EDITAR con solo los campos cambiados, con valor anterior y nuevo", async () => {
      const cliente = await clienteNuevo({ contactoPrincipal: "Ana" });
      await editar(cliente.id, {
        version: cliente.actualizadoEn,
        nombre: `${cliente.nombre} SA`,
        contactoPrincipal: "Ana",
        direccion: "León",
      });
      const edicion = (await eventos(cliente.id)).find((evento) => evento.accion === "EDITAR");
      expect(edicion?.usuarioId).toBe(ventas.usuarioId);
      expect(edicion?.detalle).toEqual({
        cambios: {
          nombre: { anterior: cliente.nombre, nuevo: `${cliente.nombre} SA` },
          direccion: { anterior: null, nuevo: "León" },
        },
      });
    });

    it("cada cambio produce una versión estrictamente mayor", async () => {
      let cliente = await clienteNuevo();
      for (let i = 0; i < 5; i += 1) {
        const anterior = new Date(cliente.actualizadoEn).getTime();
        cliente = (await editar(cliente.id, { version: cliente.actualizadoEn, notas: `Nota ${i}` })).datos;
        expect(new Date(cliente.actualizadoEn).getTime()).toBeGreaterThan(anterior);
      }
    });

    it("una edición sin cambios reales no escribe evento ni cambia la versión", async () => {
      const cliente = await clienteNuevo();
      const { status, datos } = await editar(cliente.id, { version: cliente.actualizadoEn, nombre: cliente.nombre, ruc: null });
      expect(status).toBe(200);
      expect(datos.actualizadoEn).toBe(cliente.actualizadoEn);
      expect((await eventos(cliente.id)).map((evento) => evento.accion)).toEqual(["CREAR"]);
    });

    it("rechaza con 422 un PATCH que deja al cliente sin medio de contacto, y no cambia nada", async () => {
      const cliente = await clienteNuevo({ telefono: "8888 1111" });
      const { status, error } = await editar(cliente.id, { version: cliente.actualizadoEn, telefono: "", notas: "Ignorada" });
      expect(status).toBe(422);
      expect(Object.keys(error?.campos ?? {}).sort()).toEqual(["correo", "telefono"]);
      const guardado = await db.cliente.findUniqueOrThrow({ where: { id: cliente.id } });
      expect(guardado.telefono).toBe("8888 1111");
      expect(guardado.notas).toBeNull();
    });

    it("permite quitar el teléfono si queda el correo, y exige uno de los dos al quitar ambos", async () => {
      const cliente = await clienteNuevo({ correo: "dos@medios.test" });
      const sinTelefono = await editar(cliente.id, { version: cliente.actualizadoEn, telefono: null });
      expect(sinTelefono.status).toBe(200);
      const sinNada = await editar(cliente.id, { version: sinTelefono.datos.actualizadoEn, correo: null });
      expect(sinNada.status).toBe(422);
    });

    it("rechaza con 409 DUPLICADO un RUC ajeno y deja el cliente y la bitácora como estaban", async () => {
      const ruc = `D${randomUUID().slice(0, 8).toUpperCase()}`;
      await clienteNuevo({ ruc });
      const otro = await clienteNuevo();
      const { status, error } = await editar(otro.id, { version: otro.actualizadoEn, ruc: ruc.toLowerCase() });
      expect(status).toBe(409);
      expect(error?.codigo).toBe("DUPLICADO");
      expect(error?.campos?.ruc).toBeTruthy();
      expect((await db.cliente.findUniqueOrThrow({ where: { id: otro.id } })).ruc).toBeNull();
      expect(await eventos(otro.id)).toHaveLength(1);
    });

    it("no acepta activo, id ni marcas de tiempo", async () => {
      const cliente = await clienteNuevo();
      const { status, error } = await editar(cliente.id, {
        version: cliente.actualizadoEn,
        activo: false,
        id: randomUUID(),
        creadoEn: cliente.creadoEn,
        actualizadoEn: cliente.actualizadoEn,
      });
      expect(status).toBe(422);
      expect(Object.keys(error?.campos ?? {}).sort()).toEqual(["activo", "actualizadoEn", "creadoEn", "id"]);
      expect((await db.cliente.findUniqueOrThrow({ where: { id: cliente.id } })).activo).toBe(true);
    });

    it("exige la versión", async () => {
      const cliente = await clienteNuevo();
      const { status, error } = await editar(cliente.id, { notas: "x" });
      expect(status).toBe(422);
      expect(error?.campos?.version).toBeTruthy();
    });

    it("responde 409 CONFLICTO_EDICION con una versión obsoleta", async () => {
      const cliente = await clienteNuevo();
      await editar(cliente.id, { version: cliente.actualizadoEn, notas: "primera" });
      const { status, error } = await editar(cliente.id, { version: cliente.actualizadoEn, notas: "segunda" });
      expect(status).toBe(409);
      expect(error?.codigo).toBe("CONFLICTO_EDICION");
      expect(error?.mensaje).toMatch(/Recargue/);
    });

    it("acepta como versión el instante leído aunque la fila tenga microsegundos", async () => {
      const [{ id }] = await db.$queryRaw<{ id: string }[]>`
        INSERT INTO cliente (nombre, tipo, telefono, actualizado_en)
        VALUES (${nombreUnico()}, 'EMPRESA'::tipo_cliente, '8888', now()) RETURNING id`;
      const ficha = await invocarFicha(id);
      const { status } = await editar(id, { version: ficha.actualizadoEn, notas: "con microsegundos" });
      expect(status).toBe(200);
    });

    it("responde 404 si el cliente no existe o el identificador está mal formado", async () => {
      const version = new Date().toISOString();
      expect((await editar(randomUUID(), { version, notas: "x" })).status).toBe(404);
      expect((await editar("no-es-uuid", { version, notas: "x" })).status).toBe(404);
    });

    it("no permite editar un cliente archivado", async () => {
      const cliente = await clienteNuevo();
      const archivado = (await cambiarEstado("archivar", cliente.id, { version: cliente.actualizadoEn })).datos;
      const { status, error } = await editar(cliente.id, { version: archivado.actualizadoEn, notas: "x" });
      expect(status).toBe(409);
      expect(error?.codigo).toBe("CLIENTE_ARCHIVADO");
    });

    async function invocarFicha(id: string): Promise<ClienteDto> {
      return (
        await invocar<ClienteDto>(
          modulos.ficha.GET,
          peticion("GET", `/api/v1/clientes/${id}`, { cookie: ventas.cookie, origen: null }),
          id,
        )
      ).datos;
    }
  });

  describe("archivar y reactivar", () => {
    it("archiva y reactiva sin borrar nada, con un evento por cambio y estados anterior y nuevo", async () => {
      const cliente = (await crear(cuerpoCliente())).datos;
      const archivado = await cambiarEstado("archivar", cliente.id, { version: cliente.actualizadoEn });
      expect(archivado.status).toBe(200);
      expect(archivado.datos.activo).toBe(false);
      expect(new Date(archivado.datos.actualizadoEn).getTime()).toBeGreaterThan(new Date(cliente.actualizadoEn).getTime());
      const reactivado = await cambiarEstado("reactivar", cliente.id, { version: archivado.datos.actualizadoEn });
      expect(reactivado.datos.activo).toBe(true);
      const acciones = (await eventos(cliente.id)).map((e) => [e.accion, e.estadoAnterior, e.estadoNuevo, e.usuarioId]);
      expect(acciones).toEqual([
        ["CREAR", null, "ACTIVO", ventas.usuarioId],
        ["ARCHIVAR", "ACTIVO", "ARCHIVADO", ventas.usuarioId],
        ["REACTIVAR", "ARCHIVADO", "ACTIVO", ventas.usuarioId],
      ]);
    });

    it("exige la versión: sin ella responde 422 con campos.version y no cambia nada ni deja evento", async () => {
      const cliente = (await crear(cuerpoCliente())).datos;
      for (const cuerpo of [null, {}, { version: "ayer" }]) {
        const respuesta = await cambiarEstado("archivar", cliente.id, cuerpo);
        expect(respuesta.status).toBe(422);
        expect(respuesta.error?.codigo).toBe("VALIDACION");
        expect(respuesta.error?.campos?.version).toBeTruthy();
      }
      const guardado = await db.cliente.findUniqueOrThrow({ where: { id: cliente.id } });
      expect(guardado.activo).toBe(true);
      expect(guardado.actualizadoEn.toISOString()).toBe(cliente.actualizadoEn);
      expect((await eventos(cliente.id)).map((evento) => evento.accion)).toEqual(["CREAR"]);
      const archivado = (await cambiarEstado("archivar", cliente.id, { version: cliente.actualizadoEn })).datos;
      expect((await cambiarEstado("reactivar", cliente.id, {})).status).toBe(422);
      expect((await db.cliente.findUniqueOrThrow({ where: { id: cliente.id } })).activo).toBe(false);
      expect(archivado.activo).toBe(false);
    });

    it("responde 409 CLIENTE_ARCHIVADO al archivar de nuevo y CLIENTE_ACTIVO al reactivar uno activo", async () => {
      const cliente = (await crear(cuerpoCliente())).datos;
      expect((await cambiarEstado("reactivar", cliente.id, { version: cliente.actualizadoEn })).error?.codigo).toBe("CLIENTE_ACTIVO");
      const archivado = (await cambiarEstado("archivar", cliente.id, { version: cliente.actualizadoEn })).datos;
      const repetido = await cambiarEstado("archivar", cliente.id, { version: archivado.actualizadoEn });
      expect(repetido.error?.codigo).toBe("CLIENTE_ARCHIVADO");
    });

    it("responde 409 CONFLICTO_EDICION con una versión obsoleta", async () => {
      const cliente = (await crear(cuerpoCliente())).datos;
      await editar(cliente.id, { version: cliente.actualizadoEn, notas: "cambio" });
      const { status, error } = await cambiarEstado("archivar", cliente.id, { version: cliente.actualizadoEn });
      expect(status).toBe(409);
      expect(error?.codigo).toBe("CONFLICTO_EDICION");
      expect((await db.cliente.findUniqueOrThrow({ where: { id: cliente.id } })).activo).toBe(true);
    });

    it("responde 404 si el cliente no existe", async () => {
      expect((await cambiarEstado("archivar", randomUUID(), { version: new Date().toISOString() })).status).toBe(404);
    });
  });

  describe("reversión si falla la bitácora", () => {
    // Un actor que no existe en usuario rompe la clave foránea de la bitácora, ya dentro de la transacción.
    const actorFantasma = () => ({ ...ventas.actor, id: randomUUID() });

    it("no crea el cliente", async () => {
      const nombre = nombreUnico();
      const entrada = { nombre, tipo: "EMPRESA", telefono: "8888", ruc: null, contactoPrincipal: null, correo: null, direccion: null, notas: null } as const;
      await expect(modulos.servicio.crearCliente(entrada, actorFantasma())).rejects.toThrow();
      expect(await db.cliente.count({ where: { nombre } })).toBe(0);
    });

    it("no aplica la edición", async () => {
      const cliente = (await crear(cuerpoCliente())).datos;
      const entrada = { version: cliente.actualizadoEn, nombre: "Nombre que no debe quedar" };
      await expect(modulos.servicio.editarCliente(cliente.id, entrada, actorFantasma())).rejects.toThrow();
      const guardado = await db.cliente.findUniqueOrThrow({ where: { id: cliente.id } });
      expect(guardado.nombre).toBe(cliente.nombre);
      expect(guardado.actualizadoEn.toISOString()).toBe(cliente.actualizadoEn);
    });

    it("no archiva ni reactiva", async () => {
      const cliente = (await crear(cuerpoCliente())).datos;
      await expect(modulos.servicio.archivarCliente(cliente.id, cliente.actualizadoEn, actorFantasma())).rejects.toThrow();
      expect((await db.cliente.findUniqueOrThrow({ where: { id: cliente.id } })).activo).toBe(true);
      const archivado = (await cambiarEstado("archivar", cliente.id, { version: cliente.actualizadoEn })).datos;
      await expect(modulos.servicio.reactivarCliente(cliente.id, archivado.actualizadoEn, actorFantasma())).rejects.toThrow();
      expect((await db.cliente.findUniqueOrThrow({ where: { id: cliente.id } })).activo).toBe(false);
    });
  });
});
