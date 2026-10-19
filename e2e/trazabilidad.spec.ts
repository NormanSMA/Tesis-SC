import { expect, test, type Browser, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ListaBitacora, TrazabilidadOrden } from "../src/modules/trazabilidad/tipos";
import { PERFILES, VIEWPORTS, iniciarSesion, sinDesbordeHorizontal, violacionesGraves } from "./ayudas";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const ORIGEN = new URL(BASE).origin;
const MARCA = `E2E-${Date.now()}-trazabilidad-${randomUUID().slice(0, 8)}`;
const CODIGO = `E2E-TRA-${randomUUID().slice(0, 12)}`.toUpperCase();
const NOMBRE = `${MARCA}-material`;
const CAPTURAS = path.join("docs", "capturas", "trazabilidad");
type Perfil = (typeof PERFILES)[number];
type Registro = { id: string; actualizadoEn: string };
type Material = Registro & { codigo: string; activo: boolean; existencia: string };
type Cotizacion = Registro & { numero: string; asunto: string; archivada: boolean };
type Orden = Registro & { numero: string; estado: string; cotizacion: { asunto: string } };
const perfil = (codigo: string) => PERFILES.find((fila) => fila.codigo === codigo)!;
const ADMINISTRACION = perfil("ADMINISTRACION"), ATENCION_CLIENTE = perfil("ATENCION_CLIENTE"), GERENCIA = perfil("GERENCIA");
const OPERACIONES = perfil("OPERACIONES"), PRODUCCION = perfil("PRODUCCION"), ADMIN = perfil("ADMIN");
let material: Material, cotizacion: Cotizacion, orden: Orden;
let responsableId: string;
test.use({ baseURL: BASE, ...(process.env.E2E_BROWSER_CHANNEL
  ? { browserName: "chromium" as const, channel: process.env.E2E_BROWSER_CHANNEL } : {}) });

async function entrarComo(page: Page, actor: Perfil) {
  const clave = process.env[actor.claveEnv];
  if (!clave) throw new Error(`Falta la variable ${actor.claveEnv}`);
  await page.context().clearCookies();
  await iniciarSesion(page, actor.correo, clave); await page.waitForURL(`**${actor.destino}`);
}
function soloPortatil(proyecto: string) {
  test.skip(proyecto !== "portatil", "Los efectos y las capturas corren únicamente en portatil.");
}
async function leer<T>(page: Page, ruta: string): Promise<T> {
  const respuesta = await page.request.get(`/api/v1${ruta}`);
  expect(respuesta.status(), await respuesta.text()).toBe(200);
  return (await respuesta.json()).datos as T;
}
async function escribir<T>(page: Page, ruta: string, opciones: { cuerpo: object; estado?: number; metodo?: "post" | "put"; idempotente?: boolean }): Promise<T> {
  const respuesta = await page.request[opciones.metodo ?? "post"](`/api/v1${ruta}`, {
    headers: { Origin: ORIGEN, ...(opciones.idempotente ? { "Idempotency-Key": randomUUID() } : {}) }, data: opciones.cuerpo,
  });
  expect(respuesta.status(), await respuesta.text()).toBe(opciones.estado ?? 200);
  return (await respuesta.json()).datos as T;
}
function comprobarSinDinero(valor: unknown): void {
  if (!valor || typeof valor !== "object") return;
  for (const [clave, dato] of Object.entries(valor)) {
    expect(clave).not.toMatch(/^(costo\w*|precio\w*|importe\w*|subtotal|descuento|impuesto|total\w*|totales|margen\w*|tasaImpuesto)$/i);
    comprobarSinDinero(dato);
  }
}
async function prepararMaterial(page: Page) {
  // El responsable de la orden es un usuario de Producción; el material lo crea Administración.
  await entrarComo(page, PRODUCCION);
  responsableId = (await leer<{ usuario: { id: string } }>(page, "/auth/yo")).usuario.id;
  await entrarComo(page, ADMINISTRACION);
  material = await escribir(page, "/materiales", { estado: 201,
    cuerpo: { codigo: CODIGO, nombre: NOMBRE, unidad: "PLIEGO", stockMinimo: "0", costoPromedio: "12.3456" } });
  await escribir(page, "/inventario/entradas", { estado: 201, idempotente: true,
    cuerpo: { materialId: material.id, cantidad: "10", costoUnitario: "12.3456", referencia: CODIGO } });
}
async function prepararCotizacion(page: Page) {
  await entrarComo(page, ATENCION_CLIENTE);
  const clientes = await leer<{ id: string; nombre: string }[]>(page, `/clientes?q=${encodeURIComponent("Agencia Viajes Tropical")}`);
  const categorias = await leer<{ id: string; nombre: string }[]>(page, "/categorias");
  const cliente = clientes.find((fila) => fila.nombre === "Agencia Viajes Tropical");
  const categoria = categorias.find((fila) => fila.nombre === "Rotulación y gran formato");
  expect(cliente).toBeTruthy(); expect(categoria).toBeTruthy();
  cotizacion = await escribir(page, "/cotizaciones", { estado: 201, cuerpo: { clienteId: cliente!.id, asunto: MARCA } });
  cotizacion = await escribir(page, `/cotizaciones/${cotizacion.id}/items`, { metodo: "put", cuerpo: {
    version: cotizacion.actualizadoEn, items: [{ tipo: "PERSONALIZADO", categoriaId: categoria!.id, descripcion: MARCA,
      cantidad: "1", unidadCobro: "UNIDAD", margenPct: "35", lineas: [{ tipo: "MATERIAL", materialId: material.id,
        descripcion: NOMBRE, unidad: "pliego", cantidad: "4", costoUnitario: "12.3456", mermaPct: "0" }] }],
  } });
  cotizacion = await escribir(page, `/cotizaciones/${cotizacion.id}/enviar`, { cuerpo: { version: cotizacion.actualizadoEn } });
  // Aprueba y crea la orden Operaciones; la aprobación exige referencia.
  await entrarComo(page, OPERACIONES);
  cotizacion = await escribir(page, `/cotizaciones/${cotizacion.id}/responder`, { cuerpo: {
    version: cotizacion.actualizadoEn, resultado: "APROBADA", referenciaAprobacion: `${MARCA}-aprobacion` } });
  orden = await escribir(page, "/ordenes", { estado: 201, cuerpo: { cotizacionId: cotizacion.id, categoriaId: categoria!.id,
    responsableId, fechaEntrega: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), especificaciones: MARCA } });
}
async function consumirMaterial(page: Page) {
  await entrarComo(page, ADMINISTRACION);
  await escribir(page, `/ordenes/${orden.id}/consumos`, { estado: 201, idempotente: true,
    cuerpo: { lineas: [{ materialId: material.id, cantidad: "3.333" }] } });
}
async function abrirTrabajo(page: Page) {
  await page.goto(`/trazabilidad/ordenes/${orden.id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Trazabilidad completa: ${orden.numero}`);
  await expect(page.getByRole("table", { name: "Materiales del trabajo" })).toContainText(NOMBRE);
  await expect(page.getByRole("list", { name: "Eventos del trabajo" })).toContainText("Registró un consumo de material");
}
async function comprobarFiltrosYEnlace(page: Page) {
  await page.goto("/trazabilidad");
  await expect(page.getByText("Registro de solo lectura", { exact: true })).toBeVisible();
  // El número de orden vive en "Más filtros" y se aplica con Enter.
  await page.getByRole("button", { name: /Más filtros/ }).click();
  await page.getByLabel("Número de orden", { exact: true }).fill(orden.numero);
  await page.getByLabel("Número de orden", { exact: true }).press("Enter");
  await expect(page).toHaveURL(new RegExp(`orden=${orden.numero}`));
  await page.keyboard.press("Escape");
  const tabla = page.getByRole("table", { name: "Bitácora global" });
  await expect(tabla).toContainText(orden.numero);
  const respuesta = await page.request.get(`/api/v1/bitacora?orden=${orden.numero}&porPagina=100`);
  expect(respuesta.status()).toBe(200);
  const lista = await respuesta.json() as ListaBitacora;
  expect(lista.total).toBeGreaterThan(0);
  expect(lista.datos.every((evento) => evento.registro.href === `/trazabilidad/ordenes/${orden.id}`)).toBe(true);
  await tabla.getByRole("link").first().click();
  await expect(page).toHaveURL(new RegExp(`/trazabilidad/ordenes/${orden.id}$`));
  await expect(page.getByRole("region", { name: "Cadena vinculada" })).toContainText(cotizacion.numero);
}
async function devolverNeto(page: Page, fila: Orden) {
  const resumen = await leer<{ materiales: { material: { id: string; codigo: string }; neto: string }[] }>(page, `/ordenes/${fila.id}/consumos`);
  for (const consumo of resumen.materiales.filter((registro) => registro.material.codigo === CODIGO && Number(registro.neto) > 0)) {
    await escribir(page, `/ordenes/${fila.id}/devoluciones`, { estado: 201, idempotente: true,
      cuerpo: { lineas: [{ materialId: consumo.material.id, cantidad: consumo.neto }] } });
  }
}
async function cancelarOrden(page: Page, fila: Orden) {
  const actual = await leer<Orden>(page, `/ordenes/${fila.id}`);
  expect(actual.cotizacion.asunto).toBe(MARCA);
  if (actual.estado !== "CANCELADA") await escribir(page, `/ordenes/${fila.id}/cancelar`,
    { cuerpo: { version: actual.actualizadoEn, motivo: `${MARCA}-limpieza` } });
}
async function vaciarMaterial(page: Page) {
  const lista = await leer<Material[]>(page, `/materiales?q=${CODIGO}&activo=todos&porPagina=100`);
  for (const fila of lista.filter((registro) => registro.codigo === CODIGO && registro.activo)) {
    let actual = await leer<Material>(page, `/materiales/${fila.id}`);
    if (Number(actual.existencia) > 0) await escribir(page, "/inventario/ajustes", { estado: 201, idempotente: true,
      cuerpo: { materialId: fila.id, direccion: "DISMINUIR", cantidad: actual.existencia, motivo: `${MARCA}-limpieza` } });
    actual = await leer<Material>(page, `/materiales/${fila.id}`);
    await escribir(page, `/materiales/${fila.id}/archivar`, { cuerpo: { version: actual.actualizadoEn } });
  }
}
async function archivarCotizacion(page: Page) {
  const lista = await leer<Cotizacion[]>(page, `/cotizaciones?q=${MARCA}&archivadas=false&porPagina=100`);
  for (const fila of lista.filter((registro) => registro.asunto === MARCA)) {
    await escribir(page, `/cotizaciones/${fila.id}/archivar`, { cuerpo: { version: fila.actualizadoEn } });
  }
}
async function limpiar(browser: Browser) {
  const contexto = await browser.newContext({ baseURL: BASE });
  const page = await contexto.newPage();
  const errores: unknown[] = [];
  let propias: Orden[] = [];
  const paso = async (actor: Perfil, accion: () => Promise<void>) => {
    try { await entrarComo(page, actor); await accion(); } catch (error) { errores.push(error); }
  };
  try {
    await paso(GERENCIA, async () => { propias = (await leer<Orden[]>(page, `/ordenes?q=${MARCA}&terminales=todas&porPagina=100`))
      .filter((fila) => fila.cotizacion.asunto === MARCA); });
    await paso(ADMINISTRACION, async () => { for (const fila of propias) await devolverNeto(page, fila); });
    await paso(OPERACIONES, async () => { for (const fila of propias) await cancelarOrden(page, fila); });
    await paso(ADMINISTRACION, () => vaciarMaterial(page));
    await paso(ATENCION_CLIENTE, () => archivarCotizacion(page));
  } finally { await contexto.close(); }
  if (errores.length) throw new AggregateError(errores, `Falló la limpieza de ${MARCA}`);
}

test.describe("Trazabilidad de un trabajo E2E propio", () => {
  test.describe.configure({ mode: "serial" });
  test.afterAll(async ({ browser }, info) => { if (info.project.name === "portatil") await limpiar(browser); });

  test("prepara cotización aprobada, orden y consumo con Idempotency-Key", async ({ page }, info) => {
    soloPortatil(info.project.name); test.setTimeout(180000);
    await prepararMaterial(page); await prepararCotizacion(page); await consumirMaterial(page);
  });
  test("Gerencia filtra una orden y abre su trazabilidad completa", async ({ page }, info) => {
    soloPortatil(info.project.name); await entrarComo(page, GERENCIA); await comprobarFiltrosYEnlace(page);
    await abrirTrabajo(page);
    const traza = await leer<TrazabilidadOrden>(page, `/ordenes/${orden.id}/trazabilidad`);
    expect(traza.costoRealTotal).toBe("41.1478848");
    await expect(page.getByRole("main")).toContainText("Costo real total");
  });
  test("la búsqueda por número de cotización abre el trabajo", async ({ page }, info) => {
    soloPortatil(info.project.name); await entrarComo(page, GERENCIA); await page.goto("/trazabilidad");
    await page.getByLabel("Número de orden o cotización", { exact: true }).fill(cotizacion.numero);
    await page.getByRole("button", { name: "Abrir trazabilidad completa" }).click();
    await expect(page).toHaveURL(new RegExp(`/trazabilidad/ordenes/${orden.id}$`));
  });
  test("ADMIN consulta global sin dinero y no accede a la orden", async ({ page }, info) => {
    soloPortatil(info.project.name); await entrarComo(page, ADMIN);
    await page.goto(`/trazabilidad?orden=${orden.numero}`);
    await expect(page.getByRole("table", { name: "Bitácora global" })).toContainText("Registró un consumo de material");
    const respuesta = await page.request.get(`/api/v1/bitacora?orden=${orden.numero}&porPagina=100`);
    expect(respuesta.status()).toBe(200); comprobarSinDinero((await respuesta.json()).datos);
    expect(await page.getByRole("main").innerText()).not.toMatch(/C\$|Costo unitario|Costo promedio/);
    expect((await page.request.get(`/api/v1/ordenes/${orden.id}/trazabilidad`)).status()).toBe(403);
  });
  // La bitácora global exige bitacora:ver (Gerencia y ADMIN). La cadena de un trabajo exige orden:ver, como la propia orden.
  test("Administración, Operaciones, Atención al cliente y Producción no ven la bitácora global y sí la cadena de su orden", async ({ page }, info) => {
    soloPortatil(info.project.name); test.setTimeout(120000);
    for (const actor of [ADMINISTRACION, OPERACIONES, ATENCION_CLIENTE, PRODUCCION]) {
      await entrarComo(page, actor);
      await page.goto("/trazabilidad");
      await expect(page).toHaveURL(/\/sin-acceso$/);
      expect((await page.request.get("/api/v1/bitacora")).status(), `${actor.codigo} /bitacora`).toBe(403);
      await page.goto(`/trazabilidad/ordenes/${orden.id}`);
      await expect(page).toHaveURL(new RegExp(`/trazabilidad/ordenes/${orden.id}$`));
      expect((await page.request.get(`/api/v1/ordenes/${orden.id}/trazabilidad`)).status(), `${actor.codigo} trazabilidad de la orden`).toBe(200);
    }
  });
  test("axe, desbordes y capturas CF-05 y CF-09 en cuatro tamaños", async ({ page }, info) => {
    soloPortatil(info.project.name); test.setTimeout(180000); await entrarComo(page, GERENCIA);
    fs.mkdirSync(CAPTURAS, { recursive: true });
    for (const vista of VIEWPORTS) {
      await page.setViewportSize({ width: vista.width, height: vista.height });
      for (const pantalla of ["global", "orden"] as const) {
        if (pantalla === "global") {
          await page.goto(`/trazabilidad?orden=${orden.numero}`);
          await expect(page.getByRole("table", { name: "Bitácora global" })).toBeVisible();
        } else await abrirTrabajo(page);
        await sinDesbordeHorizontal(page);
        if (["portatil", "tableta"].includes(vista.nombre)) expect.soft(await violacionesGraves(page), `${pantalla}: ${vista.nombre}`).toEqual([]);
        await page.evaluate(() => document.fonts.ready); await page.evaluate(() => window.scrollTo(0, 0));
        const criterio = pantalla === "global" ? "CF-05" : "CF-09";
        await page.screenshot({ path: path.join(CAPTURAS, `${criterio}-${pantalla}-${vista.width}x${vista.height}.png`), fullPage: true });
      }
    }
  });
});
