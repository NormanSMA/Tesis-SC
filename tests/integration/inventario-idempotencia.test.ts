import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { liberarClienteGlobal } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { ejecutarIdempotente, huellaDe, leerClave } from "@/modules/inventario/idempotencia";
import { abrirSesion, prepararCotizaciones, type EntornoCotizaciones } from "./cotizaciones-ayudas";

describeConBase("inventario: idempotencia de escrituras del libro", () => {
  const db = crearClientePropietario();
  let entorno: EntornoCotizaciones;
  let otroUsuarioId: string;
  beforeAll(async () => {
    entorno = await prepararCotizaciones(db);
    otroUsuarioId = (await abrirSesion(db, entorno.modulos, "OPERACIONES")).usuarioId;
  });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  function solicitud(clave: string, cuerpo: unknown = { cantidad: "1.000" }, usuarioId = entorno.ventas.usuarioId) {
    return { clave, usuarioId, operacion: "consumo", cuerpo };
  }

  it("lee solo UUID válidos del encabezado", () => {
    expect(leerClave(" 3F2504E0-4F89-41D3-9A0C-0305E82C3301 ")).toBe("3f2504e0-4f89-41d3-9a0c-0305e82c3301");
    for (const mala of [null, "", "abc", "3f2504e0-4f89-41d3-9a0c"]) expect(() => leerClave(mala)).toThrow();
  });

  it("da la misma huella sin importar el orden de las claves", () => {
    expect(huellaDe({ a: 1, b: { c: 2, d: [1, 2] } })).toBe(huellaDe({ b: { d: [1, 2], c: 2 }, a: 1 }));
    expect(huellaDe({ a: 1 })).not.toBe(huellaDe({ a: 2 }));
  });

  it("ejecuta una vez y devuelve la respuesta guardada en el reintento", async () => {
    const clave = randomUUID();
    let ejecuciones = 0;
    const accion = async () => ({ movimiento: ++ejecuciones });
    const primera = await db.$transaction((tx) => ejecutarIdempotente(tx, solicitud(clave), accion));
    const segunda = await db.$transaction((tx) => ejecutarIdempotente(tx, solicitud(clave), accion));
    expect(primera).toEqual({ resultado: { movimiento: 1 }, repetida: false });
    expect(segunda).toEqual({ resultado: { movimiento: 1 }, repetida: true });
    expect(ejecuciones).toBe(1);
  });

  it("rechaza la misma clave con otro cuerpo o con otra operación", async () => {
    const clave = randomUUID();
    await db.$transaction((tx) => ejecutarIdempotente(tx, solicitud(clave), async () => ({ ok: true })));
    await expect(db.$transaction((tx) => ejecutarIdempotente(tx, solicitud(clave, { cantidad: "2.000" }), async () => ({ ok: true }))))
      .rejects.toMatchObject({ codigo: "CLAVE_REUTILIZADA", status: 422 });
    await expect(db.$transaction((tx) => ejecutarIdempotente(tx, { ...solicitud(clave), operacion: "devolucion" }, async () => ({ ok: true }))))
      .rejects.toMatchObject({ codigo: "CLAVE_REUTILIZADA" });
  });

  it("no revela la respuesta a otro usuario", async () => {
    const clave = randomUUID();
    await db.$transaction((tx) => ejecutarIdempotente(tx, solicitud(clave), async () => ({ secreto: "x" })));
    await expect(db.$transaction((tx) => ejecutarIdempotente(tx, solicitud(clave, undefined, otroUsuarioId), async () => ({ ok: true }))))
      .rejects.toMatchObject({ codigo: "CLAVE_EN_USO", status: 409 });
  });

  it("si la operación falla no guarda la clave y se puede reintentar", async () => {
    const clave = randomUUID();
    await expect(db.$transaction((tx) => ejecutarIdempotente(tx, solicitud(clave), async () => { throw new Error("falla de negocio"); })))
      .rejects.toThrow("falla de negocio");
    expect(await db.solicitudIdempotente.count({ where: { clave } })).toBe(0);
    const reintento = await db.$transaction((tx) => ejecutarIdempotente(tx, solicitud(clave), async () => ({ ok: 1 })));
    expect(reintento.repetida).toBe(false);
  });

  it("serializa solicitudes simultáneas con la misma clave: una ejecuta y las demás repiten", async () => {
    const clave = randomUUID();
    let ejecuciones = 0;
    const accion = async () => {
      ejecuciones += 1;
      await new Promise((resolver) => setTimeout(resolver, 150));
      return { orden: ejecuciones };
    };
    const resultados = await Promise.all(Array.from({ length: 5 }, () =>
      db.$transaction((tx) => ejecutarIdempotente(tx, solicitud(clave), accion))));
    expect(ejecuciones).toBe(1);
    expect(resultados.filter((r) => !r.repetida)).toHaveLength(1);
    expect(new Set(resultados.map((r) => JSON.stringify(r.resultado))).size).toBe(1);
  });

  it("la tabla es de solo inserción", async () => {
    const clave = randomUUID();
    await db.$transaction((tx) => ejecutarIdempotente(tx, solicitud(clave), async () => ({ ok: true })));
    await expect(db.solicitudIdempotente.update({ where: { clave }, data: { operacion: "otra" } })).rejects.toThrow();
    await expect(db.solicitudIdempotente.delete({ where: { clave } })).rejects.toThrow();
  });
});
