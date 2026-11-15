import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { liberarClienteGlobal, peticion } from "../helpers/auth";
import { clienteInventario, crearMaterial, entradaMaterial, prepararInventario, type EntornoInventario } from "./inventario-ayudas";

describe("INV-12: códigos automáticos y foto privada", () => {
  const db = clienteInventario(); let entorno: EntornoInventario; let foto: string;
  beforeAll(async () => {
    entorno = await prepararInventario(db);
    const imagen = await sharp({ create: { width: 30, height: 20, channels: 3, background: "#2d264f" } }).png().toBuffer();
    foto = `data:image/png;base64,${imagen.toString("base64")}`;
  });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });
  it("asigna consecutivos únicos aun con altas simultáneas y conserva códigos anteriores", async () => {
    const datos = await Promise.all(Array.from({ length: 8 }, () => crearMaterial(entorno, { areaProduccion: "TALLER" })));
    expect(new Set(datos.map(d => d.codigo)).size).toBe(8);
    expect(datos.every(d => /^TA-\d{3,}$/.test(d.codigo))).toBe(true);
    const numeros = datos.map(d => Number(d.codigo.split("-")[1])).sort((a,b) => a-b);
    expect(numeros.at(-1)! - numeros[0]).toBe(7);
    expect(datos.every(d => d.codigosAnteriores.length === 1)).toBe(true);
  });
  it("mantiene el código al cambiar el área y permite buscar por el código anterior", async () => {
    const material = await crearMaterial(entorno, { areaProduccion: "CORTE_LASER" });
    const editado = await entorno.modulos.servicio.editarMaterial(material.id, { version: material.actualizadoEn, areaProduccion: "ACABADO" }, entorno.sesiones.ADMINISTRACION.actor);
    expect(editado.codigo).toBe(material.codigo);
    const lista = await entorno.modulos.servicio.listarMateriales({ q: material.codigosAnteriores[0], pagina: 1, porPagina: 20, activo: "true", bajoMinimo: "false" }, entorno.sesiones.ADMINISTRACION.actor);
    expect(lista.datos.map(d => d.id)).toContain(material.id);
  });
  it("guarda, reemplaza y quita la foto junto con versión y auditoría", async () => {
    const material = await crearMaterial(entorno, { fotoBase64: foto });
    expect(material.fotoVersion).toBeTruthy();
    expect(material).not.toHaveProperty("foto");
    const guardada = await db.materialFoto.findUniqueOrThrow({ where: { materialId: material.id } });
    expect((await sharp(guardada.contenido).metadata()).format).toBe("webp");
    const editar = (version: string, fotoBase64: string | null) => entorno.modulos.servicio.editarMaterial(material.id, { version, fotoBase64 }, entorno.sesiones.ADMINISTRACION.actor);
    const nueva = await editar(material.actualizadoEn, foto);
    expect(nueva.actualizadoEn).not.toBe(material.actualizadoEn);
    await expect(editar(material.actualizadoEn, null)).rejects.toMatchObject({ codigo: "CONFLICTO_EDICION" });
    const quitada = await editar(nueva.actualizadoEn, null);
    expect(quitada.fotoVersion).toBeNull();
    expect(await db.materialFoto.count({ where: { materialId: material.id } })).toBe(0);
    expect(await db.bitacora.count({ where: { entidadId: material.id } })).toBe(3);
  });
  it("rechaza imágenes falsas y revierte material y foto si falla la auditoría", async () => {
    await expect(crearMaterial(entorno, { fotoBase64: "data:image/png;base64,YWJj" })).rejects.toMatchObject({ codigo: "FOTO_INVALIDA" });
    const entrada = entradaMaterial({ fotoBase64: foto });
    await expect(entorno.modulos.servicio.crearMaterial(entrada, { ...entorno.sesiones.ADMINISTRACION.actor, id: randomUUID() })).rejects.toThrow();
    expect(await db.material.count({ where: { codigosAnteriores: { has: entrada.codigo.toUpperCase() } } })).toBe(0);
  });
  it("protege la foto y la creación mediante los permisos del servidor", async () => {
    const { GET } = await import("@/app/api/v1/materiales/[id]/foto/route");
    const material = await crearMaterial(entorno, { fotoBase64: foto });
    const respuesta = await GET(peticion("GET", "/api/v1/materiales/foto", { cookie: entorno.sesiones.ATENCION_CLIENTE.cookie }), { params: Promise.resolve({ id: material.id }) });
    expect(respuesta.status).toBe(403);
    await expect(entorno.modulos.servicio.crearMaterial(entradaMaterial(), entorno.sesiones.PRODUCCION.actor)).rejects.toMatchObject({ status: 403 });
  });
});
