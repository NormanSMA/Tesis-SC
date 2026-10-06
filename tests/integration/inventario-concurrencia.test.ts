import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { Tx } from "@/lib/db";
import { liberarClienteGlobal } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { capturar, conciliar, consumir, crearMaterial, devolver, nuevaOrden, prepararConsumo, registrarEntrada, trazaOrden,
  type EntornoConsumo, type Resultado } from "./inventario-consumo-ayudas";

// Varias rondas por prueba: una intermitencia aquí es un defecto del diseño de bloqueos, no de la prueba.
const RONDAS = 5;

function demorar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

function codigos<T>(resultados: Resultado<T>[]): string[] {
  return resultados.filter((r) => !r.ok).map((r) => (r.ok ? "" : r.error.codigo ?? `sin código: ${String(r.error)}`));
}

describeConBase("inventario: concurrencia del consumo y la devolución", () => {
  const db = crearClientePropietario();
  let entorno: EntornoConsumo;
  beforeAll(async () => { entorno = await prepararConsumo(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  // Abre una transacción del propietario que toma un bloqueo y lo retiene hasta liberar().
  function retener(tomar: (tx: Tx) => Promise<unknown>) {
    let liberar = () => {};
    let marcar = () => {};
    const espera = new Promise<void>((resolver) => { liberar = resolver; });
    const tomado = new Promise<void>((resolver) => { marcar = resolver; });
    const fin = db.$transaction(async (tx) => { await tomar(tx); marcar(); await espera; });
    return { tomado, liberar: () => liberar(), fin };
  }

  async function exigirTrazaCompleta(ordenIds: string[]) {
    for (const ordenId of ordenIds) {
      const traza = await trazaOrden(db, ordenId);
      expect(traza.eventos).toEqual(traza.movimientos);
    }
  }

  it("N consumidores del mismo material nunca superan la existencia", async () => {
    for (let ronda = 0; ronda < RONDAS; ronda++) {
      const ordenes = [await nuevaOrden(entorno), await nuevaOrden(entorno, "EN_PRODUCCION")];
      const material = await crearMaterial(entorno, { existencia: "10" });
      const resultados = await Promise.all(Array.from({ length: 12 }, (_, i) => capturar(consumir(entorno, {
        ordenId: ordenes[i % 2].id, lineas: [{ materialId: material.id, cantidad: "1.5" }] }))));
      expect(resultados.filter((r) => r.ok)).toHaveLength(6);
      expect(new Set(codigos(resultados))).toEqual(new Set(["EXISTENCIA_INSUFICIENTE"]));
      expect(await conciliar(db, material.id)).toEqual({ existencia: "1.000", libro: "1.000" });
      const negativos = await db.movimientoInventario.count({ where: { materialId: material.id, existenciaResultante: { lt: 0 } } });
      expect(negativos).toBe(0);
      await exigirTrazaCompleta(ordenes.map((o) => o.id));
      expect(await db.bitacora.count({ where: { ordenId: { in: ordenes.map((o) => o.id) }, accion: "CONSUMIR_MATERIAL" } })).toBe(6);
    }
  });

  it("consumos cruzados de dos materiales en orden opuesto no se interbloquean", async () => {
    for (let ronda = 0; ronda < RONDAS * 4; ronda++) {
      const orden = await nuevaOrden(entorno);
      const a = await crearMaterial(entorno, { existencia: "100" });
      const b = await crearMaterial(entorno, { existencia: "100" });
      const resultados = await Promise.all(Array.from({ length: 8 }, (_, i) => capturar(consumir(entorno, {
        ordenId: orden.id, lineas: i % 2 ? [{ materialId: a.id, cantidad: "1" }, { materialId: b.id, cantidad: "2" }]
          : [{ materialId: b.id, cantidad: "2" }, { materialId: a.id, cantidad: "1" }] }))));
      expect(codigos(resultados)).toEqual([]);
      expect(await conciliar(db, a.id)).toEqual({ existencia: "92.000", libro: "92.000" });
      expect(await conciliar(db, b.id)).toEqual({ existencia: "84.000", libro: "84.000" });
      await exigirTrazaCompleta([orden.id]);
    }
  });

  it("consumo contra cancelación: nunca queda un consumo confirmado después de cancelar", async () => {
    const { servicio } = entorno.ordenes.modulos;
    const gerencia = entorno.ordenes.sesiones.GERENCIA.actor;
    for (let ronda = 0; ronda < RONDAS * 4; ronda++) {
      const orden = await nuevaOrden(entorno);
      const material = await crearMaterial(entorno, { existencia: "10" });
      // Retraso escalonado del consumo para recorrer los dos órdenes secuenciales.
      const retraso = (ronda % 10) * 8;
      const [consumo, cancelacion] = await Promise.all([
        demorar(retraso).then(() => capturar(consumir(entorno, { ordenId: orden.id, lineas: [{ materialId: material.id, cantidad: "1" }] }))),
        capturar(servicio.cancelarOrden(orden.id, { version: orden.actualizadoEn, motivo: "Cancelación concurrente" }, gerencia)),
      ]);
      expect(cancelacion.ok).toBe(true);
      const final = await db.ordenTrabajo.findUniqueOrThrow({ where: { id: orden.id } });
      expect(final.estado).toBe("CANCELADA");
      const movimientos = await db.movimientoInventario.findMany({ where: { consumo: { ordenId: orden.id } } });
      // Consumo confirmado: tomó la orden antes que el UPDATE de la cancelación, que esperó su COMMIT.
      // El orden inverso (consumo esperando a la cancelación) lo fija la prueba determinista siguiente.
      if (consumo.ok) {
        expect(movimientos).toHaveLength(1);
      } else {
        expect(consumo.error.codigo).toBe("ORDEN_NO_ADMITE_CONSUMO");
        expect(movimientos).toHaveLength(0);
      }
      await exigirTrazaCompleta([orden.id]);
    }
  });

  it("un consumo que espera a una cancelación en curso revalida el estado y se rechaza", async () => {
    const orden = await nuevaOrden(entorno);
    const material = await crearMaterial(entorno, { existencia: "10" });
    // Cancelación retenida: su UPDATE ya tomó la fila de la orden y aún no confirma.
    const cancelacion = retener((tx) => tx.$executeRaw`UPDATE orden_trabajo
      SET estado = 'CANCELADA', motivo_cancelacion = 'Cancelación retenida' WHERE id = ${orden.id}::uuid`);
    await cancelacion.tomado;
    let resuelto = false;
    const consumo = capturar(consumir(entorno, { ordenId: orden.id, lineas: [{ materialId: material.id, cantidad: "1" }] }))
      .finally(() => { resuelto = true; });
    await demorar(400);
    expect(resuelto).toBe(false);
    cancelacion.liberar();
    await cancelacion.fin;
    expect(await consumo).toMatchObject({ ok: false, error: { codigo: "ORDEN_NO_ADMITE_CONSUMO" } });
    expect(await conciliar(db, material.id)).toEqual({ existencia: "10.000", libro: "10.000" });
  });

  it("una cancelación que llega con un consumo en curso espera su COMMIT y ambos proceden", async () => {
    const orden = await nuevaOrden(entorno);
    const material = await crearMaterial(entorno, { existencia: "10" });
    const retencion = retener((tx) => tx.$queryRaw`SELECT id FROM material WHERE id = ${material.id}::uuid FOR UPDATE`);
    await retencion.tomado;
    const pendientes = { consumo: true, cancelacion: true };
    // El consumo toma la orden con FOR SHARE y queda esperando el material retenido.
    const consumo = capturar(consumir(entorno, { ordenId: orden.id, lineas: [{ materialId: material.id, cantidad: "1" }] }))
      .finally(() => { pendientes.consumo = false; });
    await demorar(300);
    const cancelacion = capturar(entorno.ordenes.modulos.servicio.cancelarOrden(orden.id,
      { version: orden.actualizadoEn, motivo: "Cancelación con consumo en curso" }, entorno.ordenes.sesiones.GERENCIA.actor))
      .finally(() => { pendientes.cancelacion = false; });
    await demorar(400);
    expect(pendientes).toEqual({ consumo: true, cancelacion: true });
    retencion.liberar();
    await retencion.fin;
    expect(await consumo).toMatchObject({ ok: true });
    expect(await cancelacion).toMatchObject({ ok: true });
    expect(await db.consumoOrden.count({ where: { ordenId: orden.id } })).toBe(1);
    expect(await conciliar(db, material.id)).toEqual({ existencia: "9.000", libro: "9.000" });
  });

  it("consumo confirmado y luego cancelación: ambos proceden y el consumo se conserva", async () => {
    const orden = await nuevaOrden(entorno);
    const material = await crearMaterial(entorno, { existencia: "10" });
    await consumir(entorno, { ordenId: orden.id, lineas: [{ materialId: material.id, cantidad: "3" }] });
    const actual = await db.ordenTrabajo.findUniqueOrThrow({ where: { id: orden.id } });
    await entorno.ordenes.modulos.servicio.cancelarOrden(orden.id, { version: actual.actualizadoEn.toISOString(),
      motivo: "Cancelación posterior" }, entorno.ordenes.sesiones.GERENCIA.actor);
    expect(await conciliar(db, material.id)).toEqual({ existencia: "7.000", libro: "7.000" });
    const devolucion = await devolver(entorno, { ordenId: orden.id, lineas: [{ materialId: material.id, cantidad: "3" }] });
    expect(devolucion.resumen[0]).toMatchObject({ neto: "0.000", existencia: "10.000" });
  });

  it("dos devoluciones simultáneas que juntas superan lo consumido: solo cabe una", async () => {
    for (let ronda = 0; ronda < RONDAS * 2; ronda++) {
      const orden = await nuevaOrden(entorno);
      const material = await crearMaterial(entorno, { existencia: "20" });
      await consumir(entorno, { ordenId: orden.id, lineas: [{ materialId: material.id, cantidad: "10" }] });
      const resultados = await Promise.all([1, 2].map(() => capturar(devolver(entorno, {
        ordenId: orden.id, lineas: [{ materialId: material.id, cantidad: "6" }] }))));
      expect(resultados.filter((r) => r.ok)).toHaveLength(1);
      const rechazo = resultados.find((r) => !r.ok);
      expect(rechazo).toMatchObject({ ok: false, error: { codigo: "DEVOLUCION_EXCEDE_CONSUMO",
        campos: { "lineas.0.cantidad": expect.stringContaining("máximo devolvible 4.000") } } });
      expect(await conciliar(db, material.id)).toEqual({ existencia: "16.000", libro: "16.000" });
      await exigirTrazaCompleta([orden.id]);
    }
  });

  it("la misma Idempotency-Key en serie y en paralelo deja un solo movimiento", async () => {
    for (let ronda = 0; ronda < RONDAS; ronda++) {
      const orden = await nuevaOrden(entorno);
      const material = await crearMaterial(entorno, { existencia: "10" });
      const clave = randomUUID();
      const datos = { ordenId: orden.id, clave, lineas: [{ materialId: material.id, cantidad: "1" }] };
      const paralelas = await Promise.all(Array.from({ length: 6 }, () => consumir(entorno, datos)));
      const serie = await consumir(entorno, datos);
      expect(paralelas.filter((r) => !r.repetida)).toHaveLength(1);
      expect(serie.repetida).toBe(true);
      const ids = new Set([...paralelas, serie].map((r) => r.movimientos[0].id));
      expect(ids.size).toBe(1);
      expect(await conciliar(db, material.id)).toEqual({ existencia: "9.000", libro: "9.000" });
      await exigirTrazaCompleta([orden.id]);
    }
  });

  it("entradas concurrentes con consumos dejan un saldo coherente", async () => {
    for (let ronda = 0; ronda < RONDAS; ronda++) {
      const orden = await nuevaOrden(entorno);
      const material = await crearMaterial(entorno, { existencia: "2" });
      const entradas = Array.from({ length: 4 }, () => capturar(registrarEntrada(entorno, { materialId: material.id, cantidad: "2", costo: "15" })));
      const consumos = Array.from({ length: 8 }, () => capturar(consumir(entorno, {
        ordenId: orden.id, lineas: [{ materialId: material.id, cantidad: "1.25" }] })));
      const [resEntradas, resConsumos] = await Promise.all([Promise.all(entradas), Promise.all(consumos)]);
      expect(resEntradas.every((r) => r.ok)).toBe(true);
      expect(codigos(resConsumos).every((codigo) => codigo === "EXISTENCIA_INSUFICIENTE")).toBe(true);
      const confirmados = resConsumos.filter((r) => r.ok).length;
      const esperado = (10 - confirmados * 1.25).toFixed(3);
      expect(await conciliar(db, material.id)).toEqual({ existencia: esperado, libro: esperado });
      expect(Number(esperado)).toBeGreaterThanOrEqual(0);
      await exigirTrazaCompleta([orden.id]);
    }
  });
});
