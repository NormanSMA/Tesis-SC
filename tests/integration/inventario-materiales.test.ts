import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { esquemaConsultaMateriales } from "@/modules/inventario/schema";
import { liberarClienteGlobal } from "../helpers/auth";
import { clienteInventario, crearMaterial, entradaMaterial, prepararInventario, recibir, type EntornoInventario } from "./inventario-ayudas";

describe("inventario: materiales y bloqueo de archivo", () => {
  const db = clienteInventario();
  let entorno: EntornoInventario;
  beforeAll(async () => { entorno = await prepararInventario(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  it("crea con existencia cero y bitácora MATERIAL en la misma transacción", async () => {
    const material = await crearMaterial(entorno);
    expect(material.existencia).toBe("0.000");
    expect(material.costoPromedio).toBe("5.1234");
    expect(material.alerta).toBe("Sin existencia");
    expect(await db.bitacora.findFirst({ where: { entidadId: material.id, entidad: "MATERIAL" } }))
      .toMatchObject({ accion: "CREAR", usuarioId: entorno.sesiones.PRODUCCION.usuarioId, estadoNuevo: "ACTIVO" });
  });
  it("edita costo con existencia cero y registra antes y después", async () => {
    const material = await crearMaterial(entorno);
    const nuevo = await entorno.modulos.servicio.editarMaterial(material.id, { version: material.actualizadoEn,
      nombre: "Material editado", descripcion: "Descripción", stockMinimo: "3.001", costoPromedio: "7.1234" }, entorno.sesiones.GERENCIA.actor);
    expect(nuevo).toMatchObject({ nombre: "Material editado", stockMinimo: "3.001", costoPromedio: "7.1234", unidad: "METRO" });
    expect(nuevo.actualizadoEn).not.toBe(material.actualizadoEn);
    const evento = await db.bitacora.findFirstOrThrow({ where: { entidadId: material.id, accion: "EDITAR" } });
    expect(evento.detalle).toMatchObject({ antes: { costoPromedio: "5.1234" }, despues: { costoPromedio: "7.1234" } });
  });
  it("rechaza costo con existencia y conserva los otros campos", async () => {
    const material = await crearMaterial(entorno); await recibir(entorno, material.id);
    await expect(entorno.modulos.servicio.editarMaterial(material.id, { version: material.actualizadoEn,
      costoPromedio: "50", nombre: "No persistir" }, entorno.sesiones.GERENCIA.actor))
      .rejects.toMatchObject({ codigo: "MATERIAL_CON_EXISTENCIA", status: 409 });
    expect((await db.material.findUniqueOrThrow({ where: { id: material.id } })).nombre).toBe(material.nombre);
  });
  it("permite editar stock y nombre con existencia sin cambiar costo", async () => {
    const material = await crearMaterial(entorno); await recibir(entorno, material.id);
    const nuevo = await entorno.modulos.servicio.editarMaterial(material.id,
      { version: material.actualizadoEn, nombre: "Con existencia", stockMinimo: "20", costoPromedio: "10.0000" }, entorno.sesiones.PRODUCCION.actor);
    expect(nuevo).toMatchObject({ nombre: "Con existencia", existencia: "10.000", costoPromedio: "10.0000", alerta: "Stock bajo" });
  });
  it("rechaza versión vieja incluso sin cambios", async () => {
    const material = await crearMaterial(entorno);
    await entorno.modulos.servicio.editarMaterial(material.id, { version: material.actualizadoEn, nombre: "Nuevo nombre" }, entorno.sesiones.PRODUCCION.actor);
    await expect(entorno.modulos.servicio.editarMaterial(material.id, { version: material.actualizadoEn }, entorno.sesiones.PRODUCCION.actor))
      .rejects.toMatchObject({ codigo: "CONFLICTO_EDICION", status: 409 });
  });
  it("PATCH sin cambios conserva versión y bitácora", async () => {
    const material = await crearMaterial(entorno);
    expect(await entorno.modulos.servicio.editarMaterial(material.id, { version: material.actualizadoEn, costoPromedio: "5.1234" }, entorno.sesiones.PRODUCCION.actor)).toEqual(material);
    expect(await db.bitacora.count({ where: { entidadId: material.id } })).toBe(1);
  });
  it("archiva sin existencia y reactiva con versión y eventos", async () => {
    const material = await crearMaterial(entorno);
    const archivado = await entorno.modulos.servicio.cambiarActivoMaterial({ id: material.id, version: material.actualizadoEn, activo: false }, entorno.sesiones.GERENCIA.actor);
    expect(archivado).toMatchObject({ activo: false, alerta: null });
    await expect(entorno.modulos.servicio.cambiarActivoMaterial({ id: material.id, version: material.actualizadoEn, activo: true }, entorno.sesiones.GERENCIA.actor))
      .rejects.toMatchObject({ codigo: "CONFLICTO_EDICION" });
    const reactivado = await entorno.modulos.servicio.cambiarActivoMaterial({ id: material.id, version: archivado.actualizadoEn, activo: true }, entorno.sesiones.PRODUCCION.actor);
    expect(reactivado).toMatchObject({ activo: true, alerta: "Sin existencia" });
    expect(await db.bitacora.count({ where: { entidadId: material.id, accion: { in: ["ARCHIVAR", "REACTIVAR"] } } })).toBe(2);
  });
  it("archivar relee existencia aunque el movimiento conserve actualizadoEn", async () => {
    const material = await crearMaterial(entorno); await recibir(entorno, material.id);
    expect((await db.material.findUniqueOrThrow({ where: { id: material.id } })).actualizadoEn.toISOString()).toBe(material.actualizadoEn);
    await expect(entorno.modulos.servicio.cambiarActivoMaterial({ id: material.id, version: material.actualizadoEn, activo: false }, entorno.sesiones.PRODUCCION.actor))
      .rejects.toMatchObject({ codigo: "MATERIAL_CON_EXISTENCIA", status: 409 });
    expect(await db.bitacora.count({ where: { entidadId: material.id, accion: "ARCHIVAR" } })).toBe(0);
  });
  it("archivar contra entrada concurrente nunca deja archivado con existencia", async () => {
    for (let intento = 0; intento < 5; intento++) {
      const material = await crearMaterial(entorno);
      const operaciones = [() => recibir(entorno, material.id), () => entorno.modulos.servicio.cambiarActivoMaterial(
        { id: material.id, version: material.actualizadoEn, activo: false }, entorno.sesiones.GERENCIA.actor)];
      if (intento % 2) operaciones.reverse();
      const resultados = await Promise.allSettled(operaciones.map((ejecutar) => ejecutar()));
      expect(resultados.filter((resultado) => resultado.status === "fulfilled")).toHaveLength(1);
      const actual = await db.material.findUniqueOrThrow({ where: { id: material.id } });
      expect(actual.activo || actual.existencia.isZero()).toBe(true);
      const rechazo = resultados.find((resultado) => resultado.status === "rejected");
      if (rechazo?.status === "rejected") expect(["MATERIAL_CON_EXISTENCIA", "MATERIAL_ARCHIVADO"]).toContain(rechazo.reason.codigo);
    }
  });
  it("dos ediciones simultáneas producen un ganador y una bitácora", async () => {
    const material = await crearMaterial(entorno);
    const resultados = await Promise.allSettled(["A", "B"].map((nombre) => entorno.modulos.servicio.editarMaterial(material.id,
      { version: material.actualizadoEn, nombre }, entorno.sesiones.GERENCIA.actor)));
    expect(resultados.filter((resultado) => resultado.status === "fulfilled")).toHaveLength(1);
    expect(await db.bitacora.count({ where: { entidadId: material.id, accion: "EDITAR" } })).toBe(1);
  });
  it("revierte alta cuando falla bitácora", async () => {
    const entrada = entradaMaterial();
    await expect(entorno.modulos.servicio.crearMaterial(entrada, { ...entorno.sesiones.PRODUCCION.actor, id: randomUUID() })).rejects.toThrow();
    expect(await db.material.count({ where: { codigo: entrada.codigo } })).toBe(0);
  });
  it("revierte edición y archivo cuando falla bitácora", async () => {
    const material = await crearMaterial(entorno);
    const actor = { ...entorno.sesiones.GERENCIA.actor, id: randomUUID() };
    await expect(entorno.modulos.servicio.editarMaterial(material.id, { version: material.actualizadoEn, nombre: "No persistir" }, actor)).rejects.toThrow();
    await expect(entorno.modulos.servicio.cambiarActivoMaterial({ id: material.id, version: material.actualizadoEn, activo: false }, actor)).rejects.toThrow();
    expect(await entorno.modulos.servicio.obtenerMaterial(material.id, entorno.sesiones.VENTAS.actor)).toMatchObject(material);
  });
  it("traduce duplicados y rechaza registros inexistentes", async () => {
    const material = await crearMaterial(entorno);
    await expect(crearMaterial(entorno, { codigo: material.codigo })).rejects.toMatchObject({ codigo: "DUPLICADO", status: 409 });
    await expect(entorno.modulos.servicio.obtenerMaterial(randomUUID(), entorno.sesiones.VENTAS.actor)).rejects.toMatchObject({ status: 404 });
  });
  it("filtra texto, archivo y alerta solo de materiales activos", async () => {
    const prefijo = `Filtro-${randomUUID().slice(0, 8)}`;
    const activo = await crearMaterial(entorno, { nombre: `${prefijo} A` });
    const archivado = await crearMaterial(entorno, { nombre: `${prefijo} B` });
    const sinMinimo = await crearMaterial(entorno, { nombre: `${prefijo} C`, stockMinimo: "0" });
    await entorno.modulos.servicio.cambiarActivoMaterial({ id: archivado.id, version: archivado.actualizadoEn, activo: false }, entorno.sesiones.GERENCIA.actor);
    const consulta = esquemaConsultaMateriales.parse({ q: prefijo, activo: "todos", bajoMinimo: "true" });
    const alerta = await entorno.modulos.servicio.listarMateriales(consulta, entorno.sesiones.VENTAS.actor);
    expect(alerta.datos.map((fila) => fila.id)).toEqual([activo.id]);
    expect(alerta.resumen.enAlerta).toBe(await db.material.count({ where: { activo: true, stockMinimo: { gt: 0 }, existencia: { lte: db.material.fields.stockMinimo } } }));
    const todas = await entorno.modulos.servicio.listarMateriales({ ...consulta, bajoMinimo: "false", porPagina: 1, pagina: 2 }, entorno.sesiones.VENTAS.actor);
    expect(todas.total).toBe(3); expect(todas.datos[0].id).toBe(archivado.id);
    expect(sinMinimo.alerta).toBeNull();
  });
});
