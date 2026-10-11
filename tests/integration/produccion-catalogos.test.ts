import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { liberarClienteGlobal } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { crearAprobada, entradaConversion, leerOrden } from "./ordenes-ayudas";
import { asignarEtapa, crearAreaLibre, nuevaOrden, prepararProduccion, type EntornoProduccion } from "./produccion-ayudas";

const db = crearClientePropietario();
let entorno: EntornoProduccion;

function registrarCicloArea() {
  it("área: crear, editar, archivar y reactivar con versiones y bitácora", async () => {
    const { servicio, operaciones } = entorno;
    const inicial = await crearAreaLibre(entorno);
    const editada = await servicio.editarArea(inicial.id, { version: inicial.actualizadoEn, nombre: `${inicial.nombre} nueva` }, operaciones);
    expect(new Date(editada.actualizadoEn).getTime()).toBeGreaterThan(new Date(inicial.actualizadoEn).getTime());
    const igual = await servicio.editarArea(editada.id, { version: editada.actualizadoEn, nombre: editada.nombre }, operaciones);
    expect(igual).toEqual(editada);
    await expect(servicio.archivarArea(inicial.id, { version: inicial.actualizadoEn }, operaciones)).rejects.toMatchObject({ codigo: "CONFLICTO_EDICION" });
    const archivada = await servicio.archivarArea(editada.id, { version: editada.actualizadoEn }, operaciones);
    expect(archivada.activo).toBe(false);
    expect(await servicio.archivarArea(archivada.id, { version: archivada.actualizadoEn }, operaciones)).toEqual(archivada);
    const reactivada = await servicio.reactivarArea(archivada.id, { version: archivada.actualizadoEn }, operaciones);
    expect(reactivada.activo).toBe(true);
    const eventos = await db.bitacora.findMany({ where: { entidad: "AREA", entidadId: inicial.id }, orderBy: { creadoEn: "asc" } });
    expect(eventos.map((evento) => evento.accion)).toEqual(["CREAR", "EDITAR", "ARCHIVAR", "REACTIVAR"]);
  });
}

function registrarDuplicadoArea() {
  it("área duplicada responde 409 sin evento extra", async () => {
    const area = await crearAreaLibre(entorno);
    await expect(entorno.servicio.crearArea({ nombre: area.nombre }, entorno.operaciones)).rejects.toMatchObject({ status: 409, codigo: "DUPLICADO" });
    expect(await db.area.count({ where: { nombre: area.nombre } })).toBe(1);
  });
}

function registrarPlantillasArea() {
  it("plantillas activas impiden archivar área", async () => {
    const categoriaId = entorno.ordenes.cotizaciones.referencias.categoria.id;
    const plantilla = (await entorno.servicio.listarPlantillas(categoriaId, entorno.actor))[0];
    const area = await db.area.findUniqueOrThrow({ where: { id: plantilla.area.id } });
    await expect(entorno.servicio.archivarArea(area.id, { version: area.actualizadoEn.toISOString() }, entorno.operaciones))
      .rejects.toMatchObject({ codigo: "AREA_EN_USO" });
  });
}

function registrarCargaArea() {
  it("etapas abiertas impiden archivo; terminales no cuentan como carga", async () => {
    const area = await crearAreaLibre(entorno);
    const orden = await nuevaOrden(entorno);
    const extra = await entorno.servicio.agregarEtapa(orden.id, { areaId: area.id, nombre: "Acabado adicional" }, entorno.planificador);
    await expect(entorno.servicio.archivarArea(area.id, { version: area.actualizadoEn }, entorno.operaciones))
      .rejects.toMatchObject({ codigo: "AREA_EN_USO" });
    const asignada = await asignarEtapa(entorno, extra);
    await entorno.servicio.iniciarEtapa(extra.id, { version: asignada.actualizadoEn }, entorno.actor);
    const actual = await leerOrden(entorno.ordenes, orden.id);
    await entorno.ordenes.modulos.servicio.cancelarOrden(orden.id, { version: actual.actualizadoEn, motivo: "Cancelada por cliente" }, entorno.operaciones);
    expect((await db.etapaOrden.findUniqueOrThrow({ where: { id: extra.id } })).estado).toBe("EN_CURSO");
    expect((await entorno.servicio.archivarArea(area.id, { version: area.actualizadoEn }, entorno.operaciones)).activo).toBe(false);
    expect((await entorno.servicio.obtenerTablero({ area: area.id }, entorno.actor)).datos).toEqual([]);
  });
}

function registrarAltaAreaArchivada() {
  it("etapa manual y retrabajo rechazan área archivada", async () => {
    const area = await crearAreaLibre(entorno);
    await entorno.servicio.archivarArea(area.id, { version: area.actualizadoEn }, entorno.operaciones);
    const orden = await nuevaOrden(entorno);
    await expect(entorno.servicio.agregarEtapa(orden.id, { areaId: area.id, nombre: "Extra" }, entorno.planificador)).rejects.toMatchObject({ status: 422 });
  });
}

function registrarRestauracionAreaArchivada() {
  it("restaurar rechaza un área archivada y conserva la etapa omitida", async () => {
    const area = await crearAreaLibre(entorno);
    const orden = await nuevaOrden(entorno);
    const etapa = await entorno.servicio.agregarEtapa(orden.id, { nombre: "Extra", areaId: area.id }, entorno.planificador);
    const omitida = await entorno.servicio.omitirEtapa(etapa.id, { version: etapa.actualizadoEn, motivo: "No corresponde" }, entorno.planificador);
    await entorno.servicio.archivarArea(area.id, { version: area.actualizadoEn }, entorno.operaciones);
    await expect(entorno.servicio.restaurarEtapa(omitida.id, { version: omitida.actualizadoEn }, entorno.planificador)).rejects.toMatchObject({ status: 422 });
    expect((await db.etapaOrden.findUniqueOrThrow({ where: { id: etapa.id } })).estado).toBe("OMITIDA");
  });
}

function registrarReordenamiento() {
  it("reordenar usa posiciones temporales y conserva copias existentes", async () => {
    const { servicio, actor, operaciones } = entorno;
    const orden = await nuevaOrden(entorno);
    const anteriores = await servicio.listarPlantillas(orden.categoria.id, actor);
    const elegida = anteriores[1];
    const editada = await servicio.editarPlantilla(elegida.id, { version: elegida.actualizadoEn, secuencia: 1, nombre: "Impresión revisada" }, operaciones);
    expect(editada.secuencia).toBe(1);
    const nuevas = await servicio.listarPlantillas(orden.categoria.id, actor);
    expect(nuevas.map((plantilla) => plantilla.secuencia)).toEqual([1, 2, 3]);
    expect(new Set(nuevas.map((plantilla) => plantilla.secuencia)).size).toBe(3);
    expect(nuevas[1].actualizadoEn).not.toBe(anteriores[0].actualizadoEn);
    expect((await leerOrden(entorno.ordenes, orden.id)).etapas).toEqual(orden.etapas);
    await expect(servicio.editarPlantilla(elegida.id, { version: elegida.actualizadoEn, nombre: "Versión vieja" }, operaciones))
      .rejects.toMatchObject({ codigo: "CONFLICTO_EDICION" });
    const cotizacion = await crearAprobada(entorno.ordenes);
    const convertida = await entorno.ordenes.modulos.servicio.crearOrden(entradaConversion(entorno.ordenes, cotizacion.id), entorno.ordenes.sesiones.OPERACIONES.actor);
    expect(convertida.etapas[0].nombre).toBe("Impresión revisada");
    const eventos = await db.bitacora.findMany({ where: { entidad: "CATEGORIA", entidadId: orden.categoria.id } });
    expect(eventos.filter((evento) => (evento.detalle as { operacion?: string }).operacion === "REORDENAR")).toHaveLength(2);
  });
}

function registrarAltaPlantilla() {
  it("alta insertada al inicio reordena sin 23505 y archivo no archiva categoría", async () => {
    const categoria = await db.categoria.create({ data: { nombre: `Categoría producción ${randomUUID().slice(0, 8)}` } });
    const area = await crearAreaLibre(entorno);
    const primera = await entorno.servicio.crearPlantilla(categoria.id, { areaId: area.id, nombre: "Primera" }, entorno.operaciones);
    const segunda = await entorno.servicio.crearPlantilla(categoria.id, { areaId: area.id, nombre: "Segunda", secuencia: 1 }, entorno.operaciones);
    expect((await entorno.servicio.listarPlantillas(categoria.id, entorno.actor)).map((fila) => fila.nombre)).toEqual(["Segunda", "Primera"]);
    const archivada = await entorno.servicio.archivarPlantilla(segunda.id, { version: segunda.actualizadoEn }, entorno.operaciones);
    expect(archivada.activo).toBe(false);
    expect((await db.categoria.findUniqueOrThrow({ where: { id: categoria.id } })).activo).toBe(true);
    const eventos = await db.bitacora.findMany({ where: { entidadId: categoria.id } });
    expect(eventos.every((evento) => evento.entidad === "CATEGORIA" && evento.accion === "EDITAR")).toBe(true);
    expect(eventos).toHaveLength(4);
    expect(primera.secuencia).toBe(1);
  });
}

function registrarPlantillaSinCambios() {
  it("plantilla sin cambios no avanza versión ni bitácora", async () => {
    const categoriaId = entorno.ordenes.cotizaciones.referencias.categoria.id;
    const plantilla = (await entorno.servicio.listarPlantillas(categoriaId, entorno.actor))[0];
    const cantidad = await db.bitacora.count({ where: { entidadId: categoriaId } });
    expect(await entorno.servicio.editarPlantilla(plantilla.id, { version: plantilla.actualizadoEn, nombre: plantilla.nombre,
      areaId: plantilla.area.id, secuencia: plantilla.secuencia }, entorno.operaciones)).toEqual(plantilla);
    expect(await db.bitacora.count({ where: { entidadId: categoriaId } })).toBe(cantidad);
  });
}

function registrarValidacionPlantillas() {
  it("rechaza posiciones fuera del rango y áreas inactivas", async () => {
    const categoria = await db.categoria.create({ data: { nombre: `Categoría validación ${randomUUID().slice(0, 8)}` } });
    const area = await crearAreaLibre(entorno);
    const plantilla = await entorno.servicio.crearPlantilla(categoria.id, { areaId: area.id, nombre: "Diseño" }, entorno.operaciones);
    await expect(entorno.servicio.editarPlantilla(plantilla.id, { version: plantilla.actualizadoEn, secuencia: 2 }, entorno.operaciones))
      .rejects.toMatchObject({ status: 422 });
    const inactiva = await crearAreaLibre(entorno);
    await entorno.servicio.archivarArea(inactiva.id, { version: inactiva.actualizadoEn }, entorno.operaciones);
    await expect(entorno.servicio.crearPlantilla(categoria.id, { areaId: inactiva.id, nombre: "Inválida" }, entorno.operaciones))
      .rejects.toMatchObject({ status: 422 });
  });
}

function registrarConversionAreaArchivada() {
  it("conversión rechaza área archivada y revierte orden, etapas y eventos", async () => {
    const categoria = await db.categoria.create({ data: { nombre: `Categoría archivada ${randomUUID().slice(0, 8)}` } });
    const area = await crearAreaLibre(entorno);
    await entorno.servicio.crearPlantilla(categoria.id, { areaId: area.id, nombre: "Diseño" }, entorno.operaciones);
    await db.area.update({ where: { id: area.id }, data: { activo: false } });
    const cotizacion = await crearAprobada(entorno.ordenes);
    await expect(entorno.ordenes.modulos.servicio.crearOrden({ ...entradaConversion(entorno.ordenes, cotizacion.id), categoriaId: categoria.id },
      entorno.ordenes.sesiones.OPERACIONES.actor)).rejects.toMatchObject({ status: 409, codigo: "AREA_ARCHIVADA" });
    expect(await db.ordenTrabajo.count({ where: { cotizacionId: cotizacion.id } })).toBe(0);
    expect(await db.bitacora.count({ where: { cotizacionId: cotizacion.id, accion: "CONVERTIR_EN_ORDEN" } })).toBe(0);
  });
}

function registrarRollbackCatalogo() {
  it("un fallo de bitácora revierte cambios de área y secuencias de plantillas", async () => {
    const area = await crearAreaLibre(entorno);
    const actor = { ...entorno.operaciones, id: randomUUID() };
    await expect(entorno.servicio.editarArea(area.id, { version: area.actualizadoEn, nombre: `${area.nombre} fallida` }, actor)).rejects.toThrow();
    expect((await db.area.findUniqueOrThrow({ where: { id: area.id } })).nombre).toBe(area.nombre);
    const categoriaId = entorno.ordenes.cotizaciones.referencias.categoria.id;
    const anteriores = await entorno.servicio.listarPlantillas(categoriaId, entorno.actor);
    await expect(entorno.servicio.editarPlantilla(anteriores[1].id, { version: anteriores[1].actualizadoEn, secuencia: 1 }, actor)).rejects.toThrow();
    expect(await entorno.servicio.listarPlantillas(categoriaId, entorno.actor)).toEqual(anteriores);
  });
}

describeConBase("producción: áreas y plantillas", () => {
  beforeAll(async () => { entorno = await prepararProduccion(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });
  registrarCicloArea();
  registrarDuplicadoArea();
  registrarPlantillasArea();
  registrarCargaArea();
  registrarAltaAreaArchivada();
  registrarRestauracionAreaArchivada();
  registrarReordenamiento();
  registrarAltaPlantilla();
  registrarPlantillaSinCambios();
  registrarValidacionPlantillas();
  registrarConversionAreaArchivada();
  registrarRollbackCatalogo();
});
