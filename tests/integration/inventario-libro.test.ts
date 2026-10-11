import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { liberarClienteGlobal } from "../helpers/auth";
import { abrirSesion } from "./cotizaciones-ayudas";
import { clienteInventario, crearMaterial, prepararInventario, recibir, type EntornoInventario } from "./inventario-ayudas";

describe("inventario: entradas y ajustes idempotentes", () => {
  const db = clienteInventario();
  let entorno: EntornoInventario;
  beforeAll(async () => { entorno = await prepararInventario(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });
  function ajustar(materialId: string, opciones: { direccion?: "AUMENTAR" | "DISMINUIR"; cantidad?: string; clave?: string } = {}) {
    return entorno.modulos.servicio.registrarAjuste({ materialId, direccion: opciones.direccion ?? "AUMENTAR", cantidad: opciones.cantidad ?? "2.001", motivo: "Conteo físico" },
      entorno.sesiones.ADMINISTRACION.actor, opciones.clave ?? randomUUID());
  }
  it("calcula costo promedio ponderado exacto con cuatro decimales", async () => {
    const material = await crearMaterial(entorno);
    await recibir(entorno, material.id, { cantidad: "3.000", costo: "1.2345" });
    const segunda = await recibir(entorno, material.id, { cantidad: "2.000", costo: "2.3456" });
    expect(segunda).toMatchObject({ cantidad: "2.000", existenciaResultante: "5.000", costoPromedioResultante: "1.6789" });
    expect((await db.material.findUniqueOrThrow({ where: { id: material.id } })).costoPromedio.toFixed(4)).toBe("1.6789");
  });
  it("entrada registra referencia, usuario y detalle de bitácora", async () => {
    const material = await crearMaterial(entorno);
    const datos = await entorno.modulos.servicio.registrarEntrada({ materialId: material.id, cantidad: "2.001", costoUnitario: "0", referencia: "Factura 01" },
      entorno.sesiones.ADMINISTRACION.actor, randomUUID());
    const evento = await db.bitacora.findFirstOrThrow({ where: { entidadId: datos.id, entidad: "MOVIMIENTO_INVENTARIO" } });
    expect(evento).toMatchObject({ accion: "REGISTRAR_ENTRADA", usuarioId: entorno.sesiones.ADMINISTRACION.usuarioId });
    expect(evento.detalle).toMatchObject({ cantidad: "2.001", costoUnitario: "0.0000", existenciaResultante: "2.001", referencia: "Factura 01" });
  });
  for (const operacion of ["entrada", "ajuste"] as const) {
    it(`${operacion}: reintento en serie conserva movimiento y bitácora`, async () => {
      const material = await crearMaterial(entorno); const clave = randomUUID();
      const escribir = () => operacion === "entrada" ? recibir(entorno, material.id, { clave }) : ajustar(material.id, { clave });
      const primera = await escribir(); const segunda = await escribir();
      expect(primera.repetida).toBe(false); expect(segunda).toEqual({ ...primera, repetida: true });
      expect(await db.movimientoInventario.count({ where: { materialId: material.id } })).toBe(1);
      expect(await db.bitacora.count({ where: { entidadId: primera.id } })).toBe(1);
    });
    it(`${operacion}: reintento paralelo ejecuta exactamente una vez`, async () => {
      const material = await crearMaterial(entorno); const clave = randomUUID();
      const resultados = await Promise.all(Array.from({ length: 5 }, () => operacion === "entrada"
        ? recibir(entorno, material.id, { clave }) : ajustar(material.id, { clave })));
      expect(resultados.filter((fila) => !fila.repetida)).toHaveLength(1);
      expect(new Set(resultados.map((fila) => fila.id)).size).toBe(1);
      expect(await db.movimientoInventario.count({ where: { materialId: material.id } })).toBe(1);
      expect(await db.bitacora.count({ where: { entidadId: resultados[0].id } })).toBe(1);
    });
  }
  it("rechaza clave reutilizada con otra cantidad u operación", async () => {
    const material = await crearMaterial(entorno); const clave = randomUUID();
    await recibir(entorno, material.id, { clave });
    await expect(recibir(entorno, material.id, { clave, cantidad: "11" })).rejects.toMatchObject({ codigo: "CLAVE_REUTILIZADA", status: 422 });
    await expect(ajustar(material.id, { clave })).rejects.toMatchObject({ codigo: "CLAVE_REUTILIZADA", status: 422 });
    const otra = await abrirSesion(db, entorno.cotizaciones.modulos, "ADMINISTRACION");
    await expect(entorno.modulos.servicio.registrarAjuste({ materialId: material.id, direccion: "AUMENTAR", cantidad: "2.001", motivo: "Conteo físico" },
      otra.actor, clave)).rejects.toMatchObject({ codigo: "CLAVE_EN_USO", status: 409 });
    await expect(entorno.modulos.servicio.registrarEntrada({ materialId: material.id, cantidad: "10.000", costoUnitario: "10.0000" },
      entorno.sesiones.ADMINISTRACION.actor, "no-uuid")).rejects.toMatchObject({ status: 422 });
  });
  it("ajusta en ambas direcciones y usa el costo fijado por la base", async () => {
    const material = await crearMaterial(entorno); await recibir(entorno, material.id);
    const aumentar = await ajustar(material.id);
    const disminuir = await ajustar(material.id, { direccion: "DISMINUIR", cantidad: "1.001" });
    expect(aumentar).toMatchObject({ cantidad: "2.001", costoUnitario: "10.0000", existenciaResultante: "12.001" });
    expect(disminuir).toMatchObject({ cantidad: "-1.001", costoUnitario: "10.0000", existenciaResultante: "11.000", motivo: "Conteo físico" });
    expect(await db.bitacora.count({ where: { entidadId: { in: [aumentar.id, disminuir.id] }, accion: "AJUSTAR_INVENTARIO" } })).toBe(2);
  });
  it("DISMINUIR rechaza sobregiro con disponibilidad exacta y sin reservar clave", async () => {
    const material = await crearMaterial(entorno); const clave = randomUUID();
    await expect(ajustar(material.id, { direccion: "DISMINUIR", cantidad: "1.000", clave }))
      .rejects.toMatchObject({ codigo: "EXISTENCIA_INSUFICIENTE", status: 409,
        mensaje: `La existencia de ${material.nombre} no alcanza: solicitado 1.000, disponible 0.000.` });
    expect(await db.solicitudIdempotente.count({ where: { clave } })).toBe(0);
    await recibir(entorno, material.id);
    expect((await ajustar(material.id, { direccion: "DISMINUIR", cantidad: "1.000", clave })).repetida).toBe(false);
  });
  it("dos disminuciones simultáneas no dejan existencia negativa", async () => {
    const material = await crearMaterial(entorno); await recibir(entorno, material.id, { cantidad: "1" });
    const resultados = await Promise.allSettled([1, 2].map(() => ajustar(material.id, { direccion: "DISMINUIR", cantidad: "1" })));
    expect(resultados.filter((resultado) => resultado.status === "fulfilled")).toHaveLength(1);
    expect((await db.material.findUniqueOrThrow({ where: { id: material.id } })).existencia.toFixed(3)).toBe("0.000");
    expect(await db.movimientoInventario.count({ where: { materialId: material.id } })).toBe(2);
  });
  it("archivado rechaza entradas y ajustes sin movimientos ni claves", async () => {
    const material = await crearMaterial(entorno);
    await entorno.modulos.servicio.cambiarActivoMaterial({ id: material.id, version: material.actualizadoEn, activo: false }, entorno.sesiones.ADMINISTRACION.actor);
    await expect(recibir(entorno, material.id)).rejects.toMatchObject({ codigo: "MATERIAL_ARCHIVADO", status: 409 });
    await expect(ajustar(material.id)).rejects.toMatchObject({ codigo: "MATERIAL_ARCHIVADO", status: 409 });
    expect(await db.movimientoInventario.count({ where: { materialId: material.id } })).toBe(0);
  });
  it("revierte libro, saldo y clave si falla bitácora en entrada o ajuste", async () => {
    const material = await crearMaterial(entorno);
    const bitacora = await import("@/lib/bitacora");
    const espia = vi.spyOn(bitacora, "registrarEvento").mockRejectedValue(new Error("Fallo de bitácora"));
    const claves = [randomUUID(), randomUUID()];
    try {
      await expect(recibir(entorno, material.id, { clave: claves[0] })).rejects.toThrow("Fallo de bitácora");
      await expect(ajustar(material.id, { clave: claves[1] })).rejects.toThrow("Fallo de bitácora");
    } finally { espia.mockRestore(); }
    expect(await db.movimientoInventario.count({ where: { materialId: material.id } })).toBe(0);
    expect(await db.solicitudIdempotente.count({ where: { clave: { in: claves } } })).toBe(0);
    expect((await db.material.findUniqueOrThrow({ where: { id: material.id } })).existencia.toFixed(3)).toBe("0.000");
  });
});
