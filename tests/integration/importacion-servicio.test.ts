import { randomUUID } from "node:crypto";
import Papa from "papaparse";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";

import { sembrarReferencia } from "../../prisma/seed/referencia";
import { liberarClienteGlobal, peticion } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { abrirSesion, cargarModuloClientes, invocar, type Sesion } from "./clientes-ayudas";
import { COLUMNAS, type ResultadoImportacion, type TipoImportacion } from "@/modules/importacion/tipos";
import { esquemaCrearCliente } from "@/modules/clientes/schema";
import { esquemaCrearMaterial } from "@/modules/inventario/schema";

function csv(tipo: TipoImportacion, filas: Record<string, string>[]): string {
  return Papa.unparse({ fields: [...COLUMNAS[tipo]],
    data: filas.map((fila) => COLUMNAS[tipo].map((columna) => fila[columna] ?? "")) });
}

function cliente(extra: Record<string, string> = {}): Record<string, string> {
  return { nombre: `Piloto ${randomUUID()}`, tipo: "PERSONA", telefono: "8888 1111", ...extra };
}

function material(extra: Record<string, string> = {}): Record<string, string> {
  return { codigo: `P-${randomUUID().slice(0, 12)}`, nombre: "Material piloto", unidad: "UNIDAD", ...extra };
}

describeConBase("importación piloto: servicio y bitácora", () => {
  const db = crearClientePropietario();
  let servicio: typeof import("@/modules/importacion/service");
  let clientes: typeof import("@/modules/clientes/service");
  let inventario: typeof import("@/modules/inventario/service");
  let bitacora: typeof import("@/lib/bitacora");
  let errores: typeof import("@/lib/errores");
  let rutas: Record<TipoImportacion, typeof import("@/app/api/v1/importaciones/clientes/route")>;
  let ventas: Sesion;
  let administracion: Sesion;
  let gerencia: Sesion;

  beforeAll(async () => {
    await sembrarReferencia(db);
    const modulos = await cargarModuloClientes();
    servicio = await import("@/modules/importacion/service");
    clientes = await import("@/modules/clientes/service");
    inventario = await import("@/modules/inventario/service");
    bitacora = await import("@/lib/bitacora");
    errores = await import("@/lib/errores");
    rutas = {
      clientes: await import("@/app/api/v1/importaciones/clientes/route"),
      materiales: await import("@/app/api/v1/importaciones/materiales/route"),
    };
    ventas = await abrirSesion(db, modulos, "ATENCION_CLIENTE");
    administracion = await abrirSesion(db, modulos, "ADMINISTRACION");
    gerencia = await abrirSesion(db, modulos, "GERENCIA");
  });

  afterAll(async () => {
    await liberarClienteGlobal();
    await db.$disconnect();
  });

  afterEach(() => vi.restoreAllMocks());

  function enviar(tipo: TipoImportacion, sesion: Sesion, cuerpo: unknown) {
    return invocar<ResultadoImportacion>(rutas[tipo].POST,
      peticion("POST", `/api/v1/importaciones/${tipo}`, { cookie: sesion.cookie, cuerpo }));
  }

  it("valida clientes en seco sin crear clientes ni eventos", async () => {
    const fila = cliente();
    const eventos = await db.bitacora.count({ where: { usuarioId: ventas.actor.id } });
    const respuesta = await enviar("clientes", ventas, { texto: csv("clientes", [fila]), confirmar: false });
    expect(respuesta.status).toBe(200);
    const resultado = respuesta.datos;
    expect(resultado).toMatchObject({ total: 1, creadas: 0, omitidasDuplicadas: 0, conError: 0,
      confirmado: false, errores: [], duplicados: [], filas: [{ fila: 2, estado: "VALIDA" }] });
    expect(resultado.validas).toHaveLength(1);
    expect(await db.cliente.count({ where: { nombre: fila.nombre } })).toBe(0);
    expect(await db.bitacora.count({ where: { usuarioId: ventas.actor.id } })).toBe(eventos);
  });

  it("valida materiales en seco y reutiliza los valores por defecto del alta", async () => {
    const fila = material();
    const eventos = await db.bitacora.count({ where: { usuarioId: administracion.actor.id } });
    const respuesta = await enviar("materiales", administracion, { texto: csv("materiales", [fila]), confirmar: false });
    expect(respuesta.status).toBe(200);
    const resultado = respuesta.datos;
    expect(resultado.validas).toHaveLength(1);
    expect(resultado.errores).toEqual([]);
    expect(await db.material.count({ where: { codigo: fila.codigo } })).toBe(0);
    expect(await db.bitacora.count({ where: { usuarioId: administracion.actor.id } })).toBe(eventos);
  });

  it("confirma clientes y registra un evento CREAR por cada fila", async () => {
    const filas = [cliente(), cliente()];
    const respuesta = await enviar("clientes", ventas, { texto: csv("clientes", filas), confirmar: true });
    expect(respuesta.status).toBe(200);
    expect(respuesta.datos).toMatchObject({ creadas: 2, omitidasDuplicadas: 0, conError: 0, confirmado: true,
      filas: [{ fila: 2, estado: "CREADA" }, { fila: 3, estado: "CREADA" }] });
    const guardados = await db.cliente.findMany({ where: { nombre: { in: filas.map(({ nombre }) => nombre) } } });
    expect(guardados).toHaveLength(2);
    for (const guardado of guardados) {
      expect(await db.bitacora.count({ where: { entidad: "CLIENTE", entidadId: guardado.id,
        accion: "CREAR", usuarioId: ventas.actor.id } })).toBe(1);
    }
  });

  it("confirma materiales con valores por defecto y evento CREAR", async () => {
    const fila = material();
    const respuesta = await enviar("materiales", administracion, { texto: csv("materiales", [fila]), confirmar: true });
    expect(respuesta.status).toBe(200);
    expect(respuesta.datos).toMatchObject({ creadas: 1, omitidasDuplicadas: 0, conError: 0, confirmado: true });
    const guardado = await db.material.findUniqueOrThrow({ where: { codigo: fila.codigo } });
    expect(guardado.stockMinimo.toString()).toBe("0");
    expect(guardado.costoPromedio.toString()).toBe("0");
    expect(await db.bitacora.count({ where: { entidad: "MATERIAL", entidadId: guardado.id,
      accion: "CREAR", usuarioId: administracion.actor.id } })).toBe(1);
  });

  it("omite clientes existentes por RUC o nombre normalizado y repetidos dentro del CSV", async () => {
    const existente = cliente({ ruc: `R${randomUUID().slice(0, 12).toUpperCase()}` });
    await clientes.crearCliente(esquemaCrearCliente.parse(existente), ventas.actor);
    const nueva = cliente();
    const filas = [cliente({ ruc: existente.ruc.toLowerCase() }),
      cliente({ nombre: `  ${existente.nombre.toUpperCase().replace(/ /g, "   ")}  ` }), nueva, { ...nueva }];
    const resultado = await servicio.importarClientes(csv("clientes", filas), ventas.actor);
    expect(resultado.validas.map(({ fila }) => fila)).toEqual([4]);
    expect(resultado.duplicados.map(({ fila }) => fila)).toEqual([2, 3, 5]);
    expect(resultado).toMatchObject({ creadas: 1, omitidasDuplicadas: 3, conError: 0 });
    expect(await db.cliente.count({ where: { nombre: nueva.nombre } })).toBe(1);
  });

  it("omite materiales existentes y códigos repetidos dentro del CSV", async () => {
    const existente = material({ stockMinimo: "0", costoPromedio: "0" });
    await inventario.crearMaterial(esquemaCrearMaterial.parse(existente), administracion.actor);
    const nueva = material();
    const resultado = await servicio.importarMateriales(csv("materiales", [existente, nueva, { ...nueva }]), administracion.actor);
    expect(resultado.validas).toHaveLength(1);
    expect(resultado.duplicados.map(({ fila }) => fila)).toEqual([2, 4]);
    expect(resultado).toMatchObject({ creadas: 1, omitidasDuplicadas: 2, conError: 0 });
    expect(await db.material.count({ where: { codigo: nueva.codigo } })).toBe(1);
  });

  it("rechaza el perfil sin permiso antes de validar el CSV", async () => {
    await expect(servicio.validarClientes("", gerencia.actor)).rejects.toMatchObject({ status: 403 });
    await expect(servicio.validarMateriales("", gerencia.actor)).rejects.toMatchObject({ status: 403 });
    await expect(servicio.importarClientes("", gerencia.actor)).rejects.toMatchObject({ status: 403 });
    await expect(servicio.importarMateriales("", gerencia.actor)).rejects.toMatchObject({ status: 403 });
  });

  it("responde 403 sin permiso en ambas rutas y no escribe", async () => {
    const filas = { clientes: cliente(), materiales: material() };
    const eventos = await db.bitacora.count({ where: { usuarioId: gerencia.actor.id } });
    for (const tipo of ["clientes", "materiales"] as const) {
      for (const confirmar of [false, true]) {
        const respuesta = await enviar(tipo, gerencia, { texto: csv(tipo, [filas[tipo]]), confirmar });
        expect(respuesta.status).toBe(403);
        expect(respuesta.error?.codigo).toBe("SIN_PERMISO");
      }
    }
    expect(await db.cliente.count({ where: { nombre: filas.clientes.nombre } })).toBe(0);
    expect(await db.material.count({ where: { codigo: filas.materiales.codigo } })).toBe(0);
    expect(await db.bitacora.count({ where: { usuarioId: gerencia.actor.id } })).toBe(eventos);
  });

  it("rechaza el origen ajeno antes de importar", async () => {
    for (const tipo of ["clientes", "materiales"] as const) {
      const sesion = tipo === "clientes" ? ventas : administracion;
      const respuesta = await invocar(rutas[tipo].POST, peticion("POST", `/api/v1/importaciones/${tipo}`, {
        cookie: sesion.cookie, origen: "http://ajeno.test", cuerpo: { texto: "", confirmar: true },
      }));
      expect(respuesta.status).toBe(403);
      expect(respuesta.error?.codigo).toBe("ORIGEN_NO_PERMITIDO");
    }
  });

  it("valida el cuerpo JSON y exige confirmar explícito", async () => {
    for (const tipo of ["clientes", "materiales"] as const) {
      const sesion = tipo === "clientes" ? ventas : administracion;
      for (const cuerpo of [{ texto: "" }, { texto: "", confirmar: "true" }, { texto: 1, confirmar: true }]) {
        expect((await enviar(tipo, sesion, cuerpo)).status).toBe(422);
      }
    }
  });

  it("informa errores de campos con su fila de origen", async () => {
    const invalida = cliente({ telefono: "", correo: "" });
    const valida = cliente();
    const respuesta = await enviar("clientes", ventas, { texto: csv("clientes", [invalida, valida]), confirmar: true });
    expect(respuesta.status).toBe(200);
    const resultado = respuesta.datos;
    expect(resultado.validas.map(({ fila }) => fila)).toEqual([3]);
    expect(resultado.errores).toEqual([expect.objectContaining({ fila: 2, mensaje: expect.stringContaining("telefono") })]);
    expect(resultado).toMatchObject({ creadas: 1, omitidasDuplicadas: 0, conError: 1,
      filas: [expect.objectContaining({ fila: 2, estado: "ERROR" }), { fila: 3, estado: "CREADA" }] });
    expect(await db.cliente.count({ where: { nombre: invalida.nombre } })).toBe(0);
    expect(await db.cliente.count({ where: { nombre: valida.nombre } })).toBe(1);
  });

  it("importa únicamente los materiales válidos cuando el CSV tiene errores", async () => {
    const invalida = material({ unidad: "DESCONOCIDA" });
    const valida = material();
    const resultado = await servicio.importarMateriales(csv("materiales", [invalida, valida]), administracion.actor);
    expect(resultado).toMatchObject({ creadas: 1, omitidasDuplicadas: 0, conError: 1 });
    expect(resultado.errores[0].fila).toBe(2);
    expect(await db.material.count({ where: { codigo: invalida.codigo } })).toBe(0);
    expect(await db.material.count({ where: { codigo: valida.codigo } })).toBe(1);
  });

  it("revierte solamente la fila cuyo evento falla y continúa con las siguientes", async () => {
    const filas = [cliente(), cliente(), cliente()];
    const eventos = await db.bitacora.count({ where: { usuarioId: ventas.actor.id, entidad: "CLIENTE" } });
    const fallo = new errores.AppError({ codigo: "REGLA_PRUEBA", mensaje: "Evento rechazado.", status: 409 });
    const registrarOriginal = bitacora.registrarEvento;
    const registrar = vi.spyOn(bitacora, "registrarEvento");
    registrar.mockImplementationOnce(registrarOriginal);
    registrar.mockRejectedValueOnce(fallo);
    const resultado = await servicio.importarClientes(csv("clientes", filas), ventas.actor);
    expect(resultado).toMatchObject({ creadas: 2, omitidasDuplicadas: 0, conError: 1,
      errores: [{ fila: 3, mensaje: "Evento rechazado." }] });
    expect(await db.cliente.count({ where: { nombre: filas[0].nombre } })).toBe(1);
    expect(await db.cliente.count({ where: { nombre: filas[1].nombre } })).toBe(0);
    expect(await db.cliente.count({ where: { nombre: filas[2].nombre } })).toBe(1);
    expect(await db.bitacora.count({ where: { usuarioId: ventas.actor.id, entidad: "CLIENTE" } })).toBe(eventos + 2);
  });

  it("omite un duplicado ocurrido durante el alta y continúa con las siguientes filas", async () => {
    const filas = [material(), material()];
    vi.spyOn(inventario, "crearMaterial").mockRejectedValueOnce(new errores.AppError({
      codigo: "DUPLICADO", mensaje: "Ya existe un material con ese código.", status: 409,
    }));
    const resultado = await servicio.importarMateriales(csv("materiales", filas), administracion.actor);
    expect(resultado).toMatchObject({ creadas: 1, omitidasDuplicadas: 1, conError: 0 });
    expect(resultado.duplicados).toEqual([{ fila: 2, mensaje: "Ya existe un material con ese código." }]);
    expect(await db.material.count({ where: { codigo: filas[0].codigo } })).toBe(0);
    expect(await db.material.count({ where: { codigo: filas[1].codigo } })).toBe(1);
  });
});
