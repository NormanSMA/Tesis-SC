import { afterAll, beforeAll, expect, it, vi } from "vitest";
import type { Tx } from "@/lib/db";
import { esquemaConsultaBitacora } from "@/modules/trazabilidad/schema";
import { liberarClienteGlobal } from "../helpers/auth";
import { crearClienteApp, crearClientePropietario, describeConBase } from "../helpers/db";
import { abrirSesion } from "./cotizaciones-ayudas";
import { crearTrabajo, comprobarSinCliente, comprobarSinDinero, inyectarDetalle, libroConCostos,
  prepararTrazabilidad, type EntornoTrazabilidad } from "./trazabilidad-ayudas";

describeConBase("trazabilidad: costos y protección de datos", () => {
  const db = crearClientePropietario();
  const app = crearClienteApp();
  let entorno: EntornoTrazabilidad;
  beforeAll(async () => { entorno = await prepararTrazabilidad(db); });
  const sesionDe = (perfil: "ADMINISTRACION" | "OPERACIONES") => abrirSesion(db, entorno.produccion.ordenes.cotizaciones.modulos, perfil);
  afterAll(async () => { await liberarClienteGlobal(); await Promise.all([db.$disconnect(), app.$disconnect()]); });

  it("concilia varios materiales con devolución y costo promedio cambiante contra SQL numeric", async () => {
    const { orden, primero, segundo } = await libroConCostos(entorno);
    const traza = await entorno.servicio.obtenerTrazabilidad(orden.id, entorno.sesiones.GERENCIA.actor);
    const libro = await db.$queryRaw<{ materialId: string; costo: string }[]>`
      SELECT c.material_id::text AS "materialId", SUM(-m.cantidad * m.costo_unitario)::text AS costo
        FROM consumo_orden c JOIN movimiento_inventario m ON m.id = c.movimiento_id
       WHERE c.orden_id = ${orden.id}::uuid GROUP BY c.material_id`;
    for (const fila of libro) expect(traza.materiales.find((material) => material.material.id === fila.materialId)?.costoReal).toBe(fila.costo);
    const [total] = await db.$queryRaw<{ costo: string }[]>`
      SELECT SUM(-m.cantidad * m.costo_unitario)::text AS costo FROM consumo_orden c
        JOIN movimiento_inventario m ON m.id = c.movimiento_id WHERE c.orden_id = ${orden.id}::uuid`;
    expect(traza.costoRealTotal).toBe(total.costo);
    expect(traza.materiales.find((fila) => fila.material.id === primero.id)).toMatchObject({ estimado: "4.000", consumido: "3.333", devuelto: "1.111", neto: "2.222" });
    expect(traza.materiales.find((fila) => fila.material.id === segundo.id)).toMatchObject({ estimado: "2.000", consumido: "2.001", devuelto: "0.000", neto: "2.001" });
    const movimientos = await db.consumoOrden.findMany({ where: { ordenId: orden.id, materialId: primero.id }, include: { movimiento: true } });
    expect(new Set(movimientos.map((fila) => fila.movimiento.costoUnitario.toFixed(4))).size).toBe(2);
    const eventos = await db.bitacora.findMany({ where: { ordenId: orden.id, entidad: "MOVIMIENTO_INVENTARIO" } });
    expect(eventos).toHaveLength(3);
    for (const evento of eventos) expect(traza.eventos.map((fila) => fila.id)).toContain(evento.id);
  });
  it("Producción recibe toda la respuesta sin dinero, RUC, dirección ni campos desconocidos", async () => {
    const { orden } = await libroConCostos(entorno);
    await db.cliente.update({ where: { id: orden.cliente.id }, data: { ruc: `TRA${Date.now()}`, direccion: "DIRECCION_PRIVADA" } });
    await inyectarDetalle(entorno, orden.id);
    const traza = await entorno.servicio.obtenerTrazabilidad(orden.id, entorno.sesiones.PRODUCCION.actor);
    comprobarSinDinero(traza); comprobarSinCliente(traza);
    expect(JSON.stringify(traza)).not.toMatch(/98765|34567|RUC_PRIVADO|DIRECCION_PRIVADA|NO_MOSTRAR/);
    expect(traza.cadena.cotizacion.href).toBeNull(); expect(traza.cadena.cliente.href).toBeNull();
    expect(traza.eventos.some((fila) => fila.resumen.includes("Detalle visible"))).toBe(true);
  });
  it("ADMIN consulta la bitácora global sin dinero ni datos del cliente", async () => {
    const { orden } = await libroConCostos(entorno);
    await inyectarDetalle(entorno, orden.id);
    const lista = await entorno.servicio.listarBitacora(esquemaConsultaBitacora.parse({ orden: orden.numero, porPagina: 100 }), entorno.sesiones.ADMIN.actor);
    expect(lista.total).toBeGreaterThan(0);
    comprobarSinDinero(lista.datos); comprobarSinCliente(lista.datos);
    expect(JSON.stringify(lista)).not.toMatch(/98765|34567|RUC_PRIVADO|DIRECCION_PRIVADA|NO_MOSTRAR/);
    expect(lista.datos.every((fila) => fila.registro.href === null)).toBe(true);
  });
  it.each(["ATENCION_CLIENTE", "GERENCIA", "OPERACIONES"] as const)("%s recibe costos exactos y datos permitidos del cliente", async (perfil) => {
    const { orden } = await libroConCostos(entorno);
    await db.cliente.update({ where: { id: orden.cliente.id }, data: { direccion: "Dirección permitida" } });
    const actor = perfil === "OPERACIONES" ? (await sesionDe(perfil)).actor : entorno.sesiones[perfil].actor;
    const traza = await entorno.servicio.obtenerTrazabilidad(orden.id, actor);
    expect(traza.costoRealTotal).toMatch(/^\d+\.\d{7}$/);
    expect(traza.cadena.cotizacion.total).toBe(orden.cotizacion.total);
    expect(traza.cadena.cliente.direccion).toBe("Dirección permitida");
    expect(traza.eventos.some((evento) => "costoUnitario" in evento.detalle)).toBe(true);
  });
  it("ADMINISTRACION recibe costos exactos pero no RUC ni dirección del cliente", async () => {
    const { orden } = await libroConCostos(entorno);
    await db.cliente.update({ where: { id: orden.cliente.id }, data: { ruc: `ADM${Date.now()}`, direccion: "DIRECCION_PRIVADA" } });
    const traza = await entorno.servicio.obtenerTrazabilidad(orden.id, (await sesionDe("ADMINISTRACION")).actor);
    expect(traza.costoRealTotal).toMatch(/^\d+\.\d{7}$/);
    expect(traza.cadena.cotizacion.total).toBe(orden.cotizacion.total);
    comprobarSinCliente(traza); expect(JSON.stringify(traza)).not.toContain("DIRECCION_PRIVADA");
    expect(traza.cadena.cliente.href).toBeNull();
  });
  it("cliente:ver se controla independientemente de cotizacion:ver", async () => {
    const orden = await crearTrabajo(entorno);
    await inyectarDetalle(entorno, orden.id);
    const actor = { ...entorno.sesiones.GERENCIA.actor, permisos: ["orden:ver", "cotizacion:ver"] };
    const traza = await entorno.servicio.obtenerTrazabilidad(orden.id, actor);
    comprobarSinCliente(traza); expect(traza).toHaveProperty("costoRealTotal");
  });
  it("responde materiales estimados sin movimientos y costo cero", async () => {
    const orden = await crearTrabajo(entorno);
    const traza = await entorno.servicio.obtenerTrazabilidad(orden.id, entorno.sesiones.GERENCIA.actor);
    expect(traza.costoRealTotal).toBe("0.0000000");
    expect(traza.materiales.every((fila) => fila.neto === "0.000" && fila.costoReal === "0.0000000")).toBe(true);
  });
  it("lee los costos mediante una sola consulta SQL real", async () => {
    const { orden } = await libroConCostos(entorno);
    const { leerCostos } = await import("@/modules/trazabilidad/costos");
    await db.$transaction(async (tx) => {
      const consulta = vi.fn((...argumentos: Parameters<Tx["$queryRaw"]>) => tx.$queryRaw(...argumentos));
      const costos = await leerCostos({ $queryRaw: consulta } as unknown as Tx, orden.id);
      expect(consulta).toHaveBeenCalledTimes(1);
      expect(costos.total).toMatch(/^\d+\.\d{7}$/);
    });
  });
  it("el rol de aplicación puede leer pero no modificar, borrar ni vaciar la bitácora", async () => {
    const orden = await crearTrabajo(entorno);
    const evento = await inyectarDetalle(entorno, orden.id);
    expect(await app.bitacora.findUnique({ where: { id: evento.id } })).not.toBeNull();
    await expect(app.$executeRaw`UPDATE bitacora SET detalle = '{}' WHERE id = ${evento.id}::uuid`).rejects.toThrow(/permission denied/);
    await expect(app.$executeRaw`DELETE FROM bitacora WHERE id = ${evento.id}::uuid`).rejects.toThrow(/permission denied/);
    await expect(app.$executeRaw`TRUNCATE bitacora`).rejects.toThrow(/permission denied/);
    expect(await db.bitacora.findUnique({ where: { id: evento.id } })).toEqual(evento);
  });
  it("el propietario tampoco altera eventos: trigger SC001", async () => {
    const orden = await crearTrabajo(entorno);
    const evento = await inyectarDetalle(entorno, orden.id);
    await expect(db.$executeRaw`UPDATE bitacora SET detalle = '{}' WHERE id = ${evento.id}::uuid`).rejects.toThrow(/SC001|solo insercion/);
    await expect(db.$executeRaw`DELETE FROM bitacora WHERE id = ${evento.id}::uuid`).rejects.toThrow(/SC001|solo insercion/);
  });
});
