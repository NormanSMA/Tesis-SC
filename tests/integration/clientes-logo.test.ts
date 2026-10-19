import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, expect, it } from "vitest";

import type { PerfilCodigo } from "@/core/permisos";
import type { ClienteDto, ClienteFila } from "@/modules/clientes/tipos";

import { sembrarReferencia } from "../../prisma/seed/referencia";
import { liberarClienteGlobal, peticion } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import {
  abrirSesion,
  cargarModuloClientes,
  crearClienteDirecto,
  invocar,
  type ModuloClientes,
  type Sesion,
} from "./clientes-ayudas";

type ModuloLogo = typeof import("@/app/api/v1/clientes/[id]/logo/route");
type ServicioLogo = typeof import("@/modules/clientes/logo");
type Metodo = "GET" | "PUT" | "DELETE";
type Opciones = { cookie?: string; contenido?: Uint8Array; tipo?: string; longitud?: string };

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

describeConBase("clientes: logo binario", () => {
  const db = crearClientePropietario();
  let modulos: ModuloClientes;
  let logo: ModuloLogo;
  let servicio: ServicioLogo;
  const sesiones = {} as Record<PerfilCodigo, Sesion>;

  beforeAll(async () => {
    await sembrarReferencia(db);
    modulos = await cargarModuloClientes();
    logo = await import("@/app/api/v1/clientes/[id]/logo/route");
    servicio = await import("@/modules/clientes/logo");
    for (const perfil of ["ATENCION_CLIENTE", "GERENCIA", "PRODUCCION"] as const) {
      sesiones[perfil] = await abrirSesion(db, modulos, perfil);
    }
  });

  afterAll(async () => {
    await liberarClienteGlobal();
    await db.$disconnect();
  });

  function llamar(metodo: Metodo, id: string, opciones: Opciones = {}) {
    const base = peticion(metodo, `/api/v1/clientes/${id}/logo?v=prueba`, {
      cookie: opciones.cookie ?? sesiones.ATENCION_CLIENTE.cookie,
    });
    const headers = new Headers(base.headers);
    if (opciones.tipo) headers.set("content-type", opciones.tipo);
    if (opciones.longitud) headers.set("content-length", opciones.longitud);
    const req = new Request(base.url, {
      method: metodo, headers,
      body: metodo === "PUT" ? new Uint8Array(opciones.contenido ?? PNG) : undefined,
    });
    return logo[metodo](req, { params: Promise.resolve({ id }) });
  }

  async function subir(id: string, contenido = PNG) {
    const respuesta = await llamar("PUT", id, { contenido });
    expect(respuesta.status).toBe(200);
    const cuerpo = await respuesta.json() as { datos: { logoVersion: string } };
    expect(new Date(cuerpo.datos.logoVersion).toISOString()).toBe(cuerpo.datos.logoVersion);
    return cuerpo.datos.logoVersion;
  }

  it.each([[PNG, "image/png"], [JPEG, "image/jpeg"], [WEBP, "image/webp"]] as const)(
    "sube %j y devuelve bytes y cabeceras de %s", async (contenido, tipo) => {
      const cliente = await crearClienteDirecto(db);
      const version = await subir(cliente.id, contenido);
      const respuesta = await llamar("GET", cliente.id);
      expect(respuesta.status).toBe(200);
      expect(new Uint8Array(await respuesta.arrayBuffer())).toEqual(contenido);
      expect(respuesta.headers.get("content-type")).toBe(tipo);
      expect(respuesta.headers.get("cache-control")).toBe("private, max-age=31536000, immutable");
      expect(respuesta.headers.get("x-content-type-options")).toBe("nosniff");
      expect(respuesta.headers.get("content-disposition")).toBe("inline");
      const guardado = await db.clienteLogo.findUniqueOrThrow({ where: { clienteId: cliente.id } });
      expect(guardado.tamano).toBe(contenido.byteLength);
      expect(guardado.tipo).toBe(tipo);
      expect(guardado.actualizadoEn.toISOString()).toBe(version);
    },
  );

  it("detecta la firma aunque Content-Type declare otro tipo", async () => {
    const cliente = await crearClienteDirecto(db);
    expect((await llamar("PUT", cliente.id, { tipo: "image/svg+xml" })).status).toBe(200);
    expect((await llamar("GET", cliente.id)).headers.get("content-type")).toBe("image/png");
  });

  it.each([new Uint8Array(), new TextEncoder().encode("<svg></svg>"), PNG.slice(0, 3)])(
    "rechaza %j con 415 sin cambiar el logo", async (contenido) => {
      const cliente = await crearClienteDirecto(db);
      const version = await subir(cliente.id);
      expect((await llamar("PUT", cliente.id, { contenido, tipo: "image/png" })).status).toBe(415);
      const guardado = await db.clienteLogo.findUniqueOrThrow({ where: { clienteId: cliente.id } });
      expect(guardado.actualizadoEn.toISOString()).toBe(version);
      expect(await db.bitacora.count({ where: { entidadId: cliente.id } })).toBe(1);
    },
  );

  it("acepta 512 KB y rechaza 512 KB más un byte sin Content-Length", async () => {
    const cliente = await crearClienteDirecto(db);
    const contenido = new Uint8Array(524288);
    contenido.set(PNG);
    await subir(cliente.id, contenido);
    expect((await llamar("PUT", cliente.id, { contenido: new Uint8Array(524289) })).status).toBe(413);
    expect((await db.clienteLogo.findUniqueOrThrow({ where: { clienteId: cliente.id } })).tamano).toBe(524288);
    expect(await db.bitacora.count({ where: { entidadId: cliente.id } })).toBe(1);
  });

  it("rechaza Content-Length excesivo con 413", async () => {
    const cliente = await crearClienteDirecto(db);
    expect((await llamar("PUT", cliente.id, { longitud: "524289" })).status).toBe(413);
    expect(await db.clienteLogo.count({ where: { clienteId: cliente.id } })).toBe(0);
  });

  it.each([
    ["ATENCION_CLIENTE", "GET", 200], ["ATENCION_CLIENTE", "PUT", 200], ["ATENCION_CLIENTE", "DELETE", 204],
    ["GERENCIA", "GET", 200], ["GERENCIA", "PUT", 403], ["GERENCIA", "DELETE", 403],
    ["PRODUCCION", "GET", 403], ["PRODUCCION", "PUT", 403], ["PRODUCCION", "DELETE", 403],
  ] as const)("%s: %s responde %i", async (perfil, metodo, status) => {
    const cliente = await crearClienteDirecto(db);
    const version = await subir(cliente.id);
    const respuesta = await llamar(metodo, cliente.id, { cookie: sesiones[perfil].cookie });
    expect(respuesta.status).toBe(status);
    if (status === 403) {
      expect((await respuesta.json()).error.codigo).toBe("SIN_PERMISO");
      const guardado = await db.clienteLogo.findUniqueOrThrow({ where: { clienteId: cliente.id } });
      expect(guardado.actualizadoEn.toISOString()).toBe(version);
      expect(await db.bitacora.count({ where: { entidadId: cliente.id } })).toBe(1);
    }
  });

  it.each(["GET", "PUT", "DELETE"] as const)("%s exige sesión", async (metodo) => {
    expect((await llamar(metodo, randomUUID(), { cookie: "" })).status).toBe(401);
  });

  it("actualiza mediante upsert y registra las versiones sin bytes", async () => {
    const cliente = await crearClienteDirecto(db);
    const primera = await subir(cliente.id);
    const segunda = await subir(cliente.id, JPEG);
    expect(new Date(segunda).getTime()).toBeGreaterThan(new Date(primera).getTime());
    expect(await db.clienteLogo.count({ where: { clienteId: cliente.id } })).toBe(1);
    const eventos = await db.bitacora.findMany({ where: { entidadId: cliente.id }, orderBy: { creadoEn: "asc" } });
    expect(eventos).toHaveLength(2);
    expect(eventos[1]).toMatchObject({ entidad: "CLIENTE", accion: "EDITAR", usuarioId: sesiones.ATENCION_CLIENTE.usuarioId });
    expect(eventos[0].detalle).toEqual({ cambios: { logoVersion: { anterior: null, nuevo: primera } } });
    expect(eventos[1].detalle).toEqual({ cambios: { logoVersion: { anterior: primera, nuevo: segunda } } });
    expect(new Uint8Array(await (await llamar("GET", cliente.id)).arrayBuffer())).toEqual(JPEG);
  });

  it("devuelve logoVersion en lista y ficha sin exponer bytes", async () => {
    const cliente = await crearClienteDirecto(db);
    const listaSinLogo = await invocar<ClienteFila[]>(modulos.lista.GET,
      peticion("GET", `/api/v1/clientes?q=${cliente.codigoCliente}`, { cookie: sesiones.ATENCION_CLIENTE.cookie }));
    expect(listaSinLogo.datos[0].logoVersion).toBeNull();
    const version = await subir(cliente.id);
    const lista = await invocar<ClienteFila[]>(modulos.lista.GET,
      peticion("GET", `/api/v1/clientes?q=${cliente.codigoCliente}`, { cookie: sesiones.ATENCION_CLIENTE.cookie }));
    const ficha = await invocar<ClienteDto>(modulos.ficha.GET,
      peticion("GET", `/api/v1/clientes/${cliente.id}`, { cookie: sesiones.ATENCION_CLIENTE.cookie }), cliente.id);
    expect(lista.status).toBe(200);
    expect(ficha.status).toBe(200);
    for (const datos of [lista.datos[0], ficha.datos]) {
      expect(datos.logoVersion).toBe(version);
      expect(datos).not.toHaveProperty("logo");
      expect(datos).not.toHaveProperty("contenido");
      expect(datos).not.toHaveProperty("tipoLogo");
    }
  });

  it("quita el logo con 204 y registra solamente el primer borrado", async () => {
    const cliente = await crearClienteDirecto(db);
    const version = await subir(cliente.id);
    const respuesta = await llamar("DELETE", cliente.id);
    expect(respuesta.status).toBe(204);
    expect(await respuesta.text()).toBe("");
    expect(await db.clienteLogo.count({ where: { clienteId: cliente.id } })).toBe(0);
    expect((await llamar("GET", cliente.id)).status).toBe(404);
    expect((await llamar("DELETE", cliente.id)).status).toBe(204);
    const eventos = await db.bitacora.findMany({ where: { entidadId: cliente.id }, orderBy: { creadoEn: "asc" } });
    expect(eventos).toHaveLength(2);
    expect(eventos[1].detalle).toEqual({ cambios: { logoVersion: { anterior: version, nuevo: null } } });
    expect((await modulos.servicio.obtenerCliente(cliente.id)).logoVersion).toBeNull();
  });

  it.each(["GET", "PUT", "DELETE"] as const)("%s devuelve el error existente para clientes inexistentes", async (metodo) => {
    for (const id of [randomUUID(), "invalido"]) {
      const respuesta = await llamar(metodo, id);
      expect(respuesta.status).toBe(404);
      expect((await respuesta.json()).error).toEqual({ codigo: "NO_ENCONTRADO", mensaje: "El cliente no existe." });
    }
  });

  it("devuelve 404 sin logo y conserva la consulta del cliente archivado", async () => {
    const cliente = await crearClienteDirecto(db);
    expect((await llamar("GET", cliente.id)).status).toBe(404);
    await subir(cliente.id);
    await db.cliente.update({ where: { id: cliente.id }, data: { activo: false } });
    expect((await llamar("GET", cliente.id)).status).toBe(200);
    for (const metodo of ["PUT", "DELETE"] as const) {
      const respuesta = await llamar(metodo, cliente.id);
      expect(respuesta.status).toBe(409);
      expect((await respuesta.json()).error).toEqual({
        codigo: "CLIENTE_ARCHIVADO", mensaje: "Un cliente archivado no se puede editar. Reactívelo primero.",
      });
    }
    expect(await db.clienteLogo.count({ where: { clienteId: cliente.id } })).toBe(1);
    expect(await db.bitacora.count({ where: { entidadId: cliente.id } })).toBe(1);
  });

  it("revierte alta, sustitución y borrado cuando falla la bitácora", async () => {
    const cliente = await crearClienteDirecto(db);
    const actor = { ...sesiones.ATENCION_CLIENTE.actor, id: randomUUID() };
    await expect(servicio.subirLogo(cliente.id, PNG, actor)).rejects.toThrow();
    expect(await db.clienteLogo.count({ where: { clienteId: cliente.id } })).toBe(0);
    const version = await subir(cliente.id);
    await expect(servicio.subirLogo(cliente.id, JPEG, actor)).rejects.toThrow();
    await expect(servicio.quitarLogo(cliente.id, actor)).rejects.toThrow();
    const guardado = await db.clienteLogo.findUniqueOrThrow({ where: { clienteId: cliente.id } });
    expect(guardado.actualizadoEn.toISOString()).toBe(version);
    expect(new Uint8Array(guardado.contenido)).toEqual(PNG);
    expect(await db.bitacora.count({ where: { entidadId: cliente.id } })).toBe(1);
  });

  it("aplica CHECK de tipo y tamaño y ON DELETE CASCADE", async () => {
    const cliente = await crearClienteDirecto(db);
    const datos = { clienteId: cliente.id, contenido: PNG, tipo: "image/png", tamano: PNG.length };
    await expect(db.clienteLogo.create({ data: { ...datos, tipo: "image/svg+xml" } })).rejects.toThrow();
    await expect(db.clienteLogo.create({ data: { ...datos, tamano: 524289 } })).rejects.toThrow();
    await expect(db.clienteLogo.create({ data: { ...datos, contenido: new Uint8Array(524289) } })).rejects.toThrow();
    await subir(cliente.id);
    await db.cliente.delete({ where: { id: cliente.id } });
    expect(await db.clienteLogo.count({ where: { clienteId: cliente.id } })).toBe(0);
  });
});
