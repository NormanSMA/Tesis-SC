import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { Actor } from "@/core/autorizacion";
import type { EstadoOrden } from "@/generated/prisma/client";
import { liberarClienteGlobal } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { capturar, conciliar, consumir, crearMaterial, devolver, nuevaOrden, prepararConsumo, registrarEntrada, trazaOrden,
  type EntornoConsumo } from "./inventario-consumo-ayudas";
import { ponerEstado } from "./ordenes-ayudas";

describeConBase("inventario: consumo y devolución por orden", () => {
  const db = crearClientePropietario();
  let entorno: EntornoConsumo;
  beforeAll(async () => { entorno = await prepararConsumo(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  function conCostos(actor: Actor): Actor {
    return { ...actor, permisos: [...actor.permisos, "cotizacion:ver"] };
  }

  for (const estado of ["PENDIENTE", "EN_PRODUCCION", "LISTA"] as EstadoOrden[]) {
    it(`admite consumo en ${estado}`, async () => {
      const orden = await nuevaOrden(entorno, estado);
      const material = await crearMaterial(entorno, { existencia: "10" });
      const respuesta = await consumir(entorno, { ordenId: orden.id, lineas: [{ materialId: material.id, cantidad: "2.5" }] });
      expect(respuesta.repetida).toBe(false);
      expect(respuesta.movimientos).toMatchObject([{ tipo: "CONSUMO", cantidad: "2.500", existenciaResultante: "7.500",
        material: { id: material.id, codigo: material.codigo } }]);
      expect(respuesta.resumen).toMatchObject([{ consumido: "2.500", devuelto: "0.000", neto: "2.500", existencia: "7.500",
        estimado: "0.000", excedeEstimado: true }]);
      expect(await conciliar(db, material.id)).toEqual({ existencia: "7.500", libro: "7.500" });
    });
  }

  for (const estado of ["ENTREGADA", "CERRADA", "CANCELADA"] as EstadoOrden[]) {
    it(`rechaza consumo en ${estado} sin tocar el libro ni guardar la clave`, async () => {
      const orden = await nuevaOrden(entorno, estado);
      const material = await crearMaterial(entorno, { existencia: "10" });
      const clave = randomUUID();
      const resultado = await capturar(consumir(entorno, { ordenId: orden.id, clave, lineas: [{ materialId: material.id, cantidad: "1" }] }));
      expect(resultado).toMatchObject({ ok: false, error: { codigo: "ORDEN_NO_ADMITE_CONSUMO", status: 409 } });
      expect(await db.movimientoInventario.count({ where: { materialId: material.id, tipo: "CONSUMO" } })).toBe(0);
      expect(await db.solicitudIdempotente.count({ where: { clave } })).toBe(0);
    });
  }

  for (const estado of ["PENDIENTE", "EN_PRODUCCION", "LISTA", "ENTREGADA", "CANCELADA"] as EstadoOrden[]) {
    it(`admite devolución en ${estado}`, async () => {
      const orden = await nuevaOrden(entorno);
      const material = await crearMaterial(entorno, { existencia: "10" });
      await consumir(entorno, { ordenId: orden.id, lineas: [{ materialId: material.id, cantidad: "4" }] });
      await ponerEstado(db, orden.id, estado);
      const respuesta = await devolver(entorno, { ordenId: orden.id, lineas: [{ materialId: material.id, cantidad: "1.25" }] });
      expect(respuesta.movimientos).toMatchObject([{ tipo: "DEVOLUCION", cantidad: "1.250", existenciaResultante: "7.250" }]);
      expect(respuesta.resumen[0]).toMatchObject({ consumido: "4.000", devuelto: "1.250", neto: "2.750" });
    });
  }

  it("rechaza devolución en CERRADA y una orden inexistente da 404", async () => {
    const orden = await nuevaOrden(entorno);
    const material = await crearMaterial(entorno, { existencia: "10" });
    await consumir(entorno, { ordenId: orden.id, lineas: [{ materialId: material.id, cantidad: "4" }] });
    await ponerEstado(db, orden.id, "CERRADA");
    expect(await capturar(devolver(entorno, { ordenId: orden.id, lineas: [{ materialId: material.id, cantidad: "1" }] })))
      .toMatchObject({ ok: false, error: { codigo: "ORDEN_NO_ADMITE_CONSUMO", status: 409 } });
    expect(await capturar(consumir(entorno, { ordenId: randomUUID(), lineas: [{ materialId: material.id, cantidad: "1" }] })))
      .toMatchObject({ ok: false, error: { codigo: "NO_ENCONTRADO", status: 404 } });
  });

  it("valida con valores exactos y reúne todos los errores por línea", async () => {
    const orden = await nuevaOrden(entorno);
    const archivado = await crearMaterial(entorno, { existencia: "3", activo: false });
    const escaso = await crearMaterial(entorno, { existencia: "5" });
    const otroEscaso = await crearMaterial(entorno, { existencia: "1.5" });
    const inexistente = randomUUID();
    const conInexistente = await capturar(consumir(entorno, { ordenId: orden.id, lineas: [
      { materialId: inexistente, cantidad: "1" }, { materialId: archivado.id, cantidad: "1" }, { materialId: escaso.id, cantidad: "5.001" },
    ] }));
    expect(conInexistente).toMatchObject({ ok: false, error: { codigo: "VALIDACION", status: 422 } });
    if (conInexistente.ok) return;
    expect(Object.keys(conInexistente.error.campos ?? {}).sort()).toEqual(["lineas.0.materialId", "lineas.1.materialId", "lineas.2.cantidad"]);
    const conArchivado = await capturar(consumir(entorno, { ordenId: orden.id, lineas: [
      { materialId: escaso.id, cantidad: "6" }, { materialId: archivado.id, cantidad: "1" },
    ] }));
    expect(conArchivado).toMatchObject({ ok: false, error: { codigo: "MATERIAL_ARCHIVADO", status: 409,
      campos: { "lineas.0.cantidad": expect.stringContaining("disponible 5.000"), "lineas.1.materialId": expect.any(String) } } });
    const insuficiente = await capturar(consumir(entorno, { ordenId: orden.id, lineas: [
      { materialId: escaso.id, cantidad: "5.001" }, { materialId: otroEscaso.id, cantidad: "2" },
    ] }));
    expect(insuficiente).toMatchObject({ ok: false, error: { codigo: "EXISTENCIA_INSUFICIENTE", status: 409, campos: {
      "lineas.0.cantidad": expect.stringMatching(/solicitado 5\.001, disponible 5\.000/),
      "lineas.1.cantidad": expect.stringMatching(/solicitado 2\.000, disponible 1\.500/) } } });
    const exacto = await consumir(entorno, { ordenId: orden.id, lineas: [{ materialId: escaso.id, cantidad: "5.000" }] });
    expect(exacto.resumen[0].existencia).toBe("0.000");
  });

  it("revierte todo ante una línea inválida y la misma clave se puede reintentar", async () => {
    const orden = await nuevaOrden(entorno);
    const suficiente = await crearMaterial(entorno, { existencia: "10" });
    const escaso = await crearMaterial(entorno, { existencia: "1" });
    const clave = randomUUID();
    const fallo = await capturar(consumir(entorno, { ordenId: orden.id, clave, lineas: [
      { materialId: suficiente.id, cantidad: "3" }, { materialId: escaso.id, cantidad: "2" },
    ] }));
    expect(fallo).toMatchObject({ ok: false, error: { codigo: "EXISTENCIA_INSUFICIENTE" } });
    expect(await conciliar(db, suficiente.id)).toEqual({ existencia: "10.000", libro: "10.000" });
    expect(await trazaOrden(db, orden.id)).toEqual({ movimientos: [], eventos: [] });
    expect(await db.solicitudIdempotente.count({ where: { clave } })).toBe(0);
    const reintento = await consumir(entorno, { ordenId: orden.id, clave, lineas: [{ materialId: suficiente.id, cantidad: "3" }] });
    expect(reintento.repetida).toBe(false);
  });

  it("rechaza el mismo UUID repetido con otra capitalización", async () => {
    const orden = await nuevaOrden(entorno);
    const material = await crearMaterial(entorno, { existencia: "10" });
    expect(await capturar(consumir(entorno, { ordenId: orden.id, lineas: [
      { materialId: material.id, cantidad: "1" }, { materialId: material.id.toUpperCase(), cantidad: "1" },
    ] }))).toMatchObject({ ok: false, error: { codigo: "VALIDACION", campos: { "lineas.1.materialId": "El material está repetido." } } });
  });

  it("limita la devolución a lo consumido neto con el máximo exacto por línea", async () => {
    const orden = await nuevaOrden(entorno);
    const material = await crearMaterial(entorno, { existencia: "10" });
    const nunca = await crearMaterial(entorno, { existencia: "10" });
    await consumir(entorno, { ordenId: orden.id, lineas: [{ materialId: material.id, cantidad: "4" }] });
    await devolver(entorno, { ordenId: orden.id, lineas: [{ materialId: material.id, cantidad: "1.5" }] });
    const exceso = await capturar(devolver(entorno, { ordenId: orden.id, lineas: [
      { materialId: material.id, cantidad: "2.501" }, { materialId: nunca.id, cantidad: "1" },
    ] }));
    expect(exceso).toMatchObject({ ok: false, error: { codigo: "DEVOLUCION_EXCEDE_CONSUMO", status: 409, campos: {
      "lineas.0.cantidad": expect.stringContaining("máximo devolvible 2.500"),
      "lineas.1.cantidad": expect.stringContaining("máximo devolvible 0.000") } } });
    const tope = await devolver(entorno, { ordenId: orden.id, lineas: [{ materialId: material.id, cantidad: "2.500" }] });
    expect(tope.resumen[0]).toMatchObject({ consumido: "4.000", devuelto: "4.000", neto: "0.000", existencia: "10.000" });
  });

  it("rechaza consumir y devolver un material archivado hasta reactivarlo", async () => {
    const orden = await nuevaOrden(entorno);
    const material = await crearMaterial(entorno, { existencia: "10" });
    await consumir(entorno, { ordenId: orden.id, lineas: [{ materialId: material.id, cantidad: "2" }] });
    await db.material.update({ where: { id: material.id }, data: { activo: false } });
    const linea = { ordenId: orden.id, lineas: [{ materialId: material.id, cantidad: "1" }] };
    expect(await capturar(consumir(entorno, linea))).toMatchObject({ ok: false, error: { codigo: "MATERIAL_ARCHIVADO" } });
    expect(await capturar(devolver(entorno, linea))).toMatchObject({ ok: false, error: { codigo: "MATERIAL_ARCHIVADO" } });
    await db.material.update({ where: { id: material.id }, data: { activo: true } });
    const devuelto = await devolver(entorno, { ordenId: orden.id, lineas: [{ materialId: material.id, cantidad: "2" }] });
    expect(devuelto.movimientos[0]).toMatchObject({ tipo: "DEVOLUCION", existenciaResultante: "10.000" });
  });

  it("aplica el permiso actual de costos a la respuesta repetida de un reintento", async () => {
    const orden = await nuevaOrden(entorno);
    const material = await crearMaterial(entorno, { existencia: "10" });
    const clave = randomUUID();
    const solicitud = { ordenId: orden.id, clave, lineas: [{ materialId: material.id, cantidad: "1" }] };
    const primera = await consumir(entorno, { ...solicitud, actor: conCostos(entorno.produccion) });
    expect(primera.movimientos[0]).toHaveProperty("costoUnitario");
    const reintento = await consumir(entorno, solicitud);
    expect(reintento.repetida).toBe(true);
    expect(reintento.movimientos[0]).not.toHaveProperty("costoUnitario");
    expect(reintento.movimientos[0]).not.toHaveProperty("costoPromedioResultante");
  });

  it("marca excedeEstimado según el neto contra el estimado de la orden", async () => {
    const orden = await nuevaOrden(entorno);
    const materialId = entorno.ordenes.cotizaciones.referencias.material.id;
    const estimado = await db.consumoEstimado.findUniqueOrThrow({ where: { ordenId_materialId: { ordenId: orden.id, materialId } } });
    await registrarEntrada(entorno, { materialId, cantidad: "100", costo: "2850" });
    const justo = await consumir(entorno, { ordenId: orden.id, lineas: [{ materialId, cantidad: estimado.cantidad.toFixed(3) }] });
    expect(justo.resumen[0]).toMatchObject({ estimado: estimado.cantidad.toFixed(3), excedeEstimado: false });
    const sobre = await consumir(entorno, { ordenId: orden.id, lineas: [{ materialId, cantidad: "0.001" }] });
    expect(sobre.resumen[0].excedeEstimado).toBe(true);
    await devolver(entorno, { ordenId: orden.id, lineas: [{ materialId, cantidad: "0.001" }] });
    const resumen = await entorno.modulos.resumen.obtenerResumenOrden(orden.id, entorno.produccion);
    expect(resumen.materiales.find((fila) => fila.material.id === materialId)).toMatchObject({ neto: estimado.cantidad.toFixed(3), excedeEstimado: false });
  });

  it("oculta los costos sin cotizacion:ver y los muestra con ese permiso", async () => {
    const orden = await nuevaOrden(entorno);
    const material = await crearMaterial(entorno, { existencia: "10", costo: "12.5" });
    const sinCosto = await consumir(entorno, { ordenId: orden.id, lineas: [{ materialId: material.id, cantidad: "1" }] });
    expect(sinCosto.movimientos[0]).not.toHaveProperty("costoUnitario");
    expect(sinCosto.movimientos[0]).not.toHaveProperty("costoPromedioResultante");
    const conCosto = await consumir(entorno, { ordenId: orden.id, actor: conCostos(entorno.produccion),
      lineas: [{ materialId: material.id, cantidad: "1" }] });
    expect(conCosto.movimientos[0]).toMatchObject({ costoUnitario: "12.5000", costoPromedioResultante: "12.5000" });
    const gerencia = await entorno.modulos.resumen.obtenerResumenOrden(orden.id, entorno.ordenes.sesiones.GERENCIA.actor);
    expect(gerencia.movimientos.every((fila) => fila.costoUnitario === "12.5000")).toBe(true);
    const produccion = await entorno.modulos.resumen.obtenerResumenOrden(orden.id, entorno.produccion);
    expect(produccion.movimientos.some((fila) => "costoUnitario" in fila || "costoPromedioResultante" in fila)).toBe(false);
  });

  it("escribe un evento de bitácora por movimiento con el detalle del libro", async () => {
    const orden = await nuevaOrden(entorno);
    const [a, b] = [await crearMaterial(entorno, { existencia: "5", costo: "3" }), await crearMaterial(entorno, { existencia: "5", costo: "4" })];
    const respuesta = await consumir(entorno, { ordenId: orden.id, lineas: [{ materialId: a.id, cantidad: "1" }, { materialId: b.id, cantidad: "2" }] });
    const eventos = await db.bitacora.findMany({ where: { ordenId: orden.id, entidad: "MOVIMIENTO_INVENTARIO" } });
    expect(eventos).toHaveLength(2);
    const deB = eventos.find((evento) => evento.entidadId === respuesta.movimientos.find((m) => m.material.id === b.id)?.id);
    expect(deB).toMatchObject({ accion: "CONSUMIR_MATERIAL", usuarioId: entorno.produccion.id,
      detalle: { materialId: b.id, cantidad: "2.000", costoUnitario: "4.0000", existenciaResultante: "3.000" } });
    const traza = await trazaOrden(db, orden.id);
    expect(traza.eventos).toEqual(traza.movimientos);
  });

  it("repite la respuesta con la misma clave y rechaza la clave con otro cuerpo u operación", async () => {
    const orden = await nuevaOrden(entorno);
    const material = await crearMaterial(entorno, { existencia: "10" });
    const clave = randomUUID();
    const lineas = [{ materialId: material.id, cantidad: "2" }];
    const primera = await consumir(entorno, { ordenId: orden.id, clave, lineas });
    const segunda = await consumir(entorno, { ordenId: orden.id, clave, lineas: [{ materialId: material.id, cantidad: "2.000" }] });
    expect(segunda).toEqual({ ...primera, repetida: true });
    expect(await db.movimientoInventario.count({ where: { materialId: material.id, tipo: "CONSUMO" } })).toBe(1);
    expect(await capturar(consumir(entorno, { ordenId: orden.id, clave, lineas: [{ materialId: material.id, cantidad: "3" }] })))
      .toMatchObject({ ok: false, error: { codigo: "CLAVE_REUTILIZADA", status: 422 } });
    expect(await capturar(devolver(entorno, { ordenId: orden.id, clave, lineas })))
      .toMatchObject({ ok: false, error: { codigo: "CLAVE_REUTILIZADA" } });
  });

  it("resume por material con movimientos recientes primero y lo admitido por estado", async () => {
    const orden = await nuevaOrden(entorno);
    const material = await crearMaterial(entorno, { existencia: "10" });
    const consumo = await consumir(entorno, { ordenId: orden.id, lineas: [{ materialId: material.id, cantidad: "3" }] });
    const devolucion = await devolver(entorno, { ordenId: orden.id, lineas: [{ materialId: material.id, cantidad: "1" }] });
    const resumen = await entorno.modulos.resumen.obtenerResumenOrden(orden.id, entorno.produccion);
    expect(resumen).toMatchObject({ ordenId: orden.id, estadoOrden: "PENDIENTE", admiteConsumo: true, admiteDevolucion: true });
    expect(resumen.movimientos.map((m) => m.id)).toEqual([devolucion.movimientos[0].id, consumo.movimientos[0].id]);
    expect(resumen.materiales.find((fila) => fila.material.id === material.id))
      .toMatchObject({ consumido: "3.000", devuelto: "1.000", neto: "2.000", existencia: "8.000", excedeEstimado: true });
    expect(resumen.materiales.some((fila) => fila.material.id === entorno.ordenes.cotizaciones.referencias.material.id)).toBe(true);
    await ponerEstado(db, orden.id, "CANCELADA");
    expect(await entorno.modulos.resumen.obtenerResumenOrden(orden.id, entorno.produccion))
      .toMatchObject({ estadoOrden: "CANCELADA", admiteConsumo: false, admiteDevolucion: true });
  });
});
