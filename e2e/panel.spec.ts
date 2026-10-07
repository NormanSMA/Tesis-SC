import { expect, test, type Browser, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { hoyManagua } from "../src/modules/cotizaciones/fechas";
import { PERFILES, VIEWPORTS, iniciarSesion, sinDesbordeHorizontal, violacionesGraves } from "./ayudas";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const ORIGEN = new URL(BASE).origin;
const CAPTURAS = path.join("docs", "capturas", "panel");
const MARCA = `E2E-panel-${randomUUID()}`;
type Perfil = typeof PERFILES[number];
type Cotizacion = { id: string; asunto: string; actualizadoEn: string; archivada: boolean };
type Reporte = { filas: Record<string, string | number | null>[]; totales: Record<string, string | number | null> };
const gerencia = PERFILES.find((perfil) => perfil.codigo === "GERENCIA")!;
const ventas = PERFILES.find((perfil) => perfil.codigo === "VENTAS")!;
const perfilesPanel = PERFILES.filter((perfil) => perfil.codigo !== "ADMIN");
const REPORTES = [
  { nombre: "cotizaciones-por-estado", titulo: "Cotizaciones por estado", encabezado: "Estado", campos: ["estado", "cantidad", "importe"] },
  { nombre: "existencias", titulo: "Existencias", encabezado: "Código", campos: ["codigo", "material", "unidad", "existencia", "stockMinimo", "costoPromedio", "valorInventario", "alerta"] },
  { nombre: "carga-por-operario", titulo: "Carga por operario", encabezado: "Responsable", campos: ["responsable", "pendientes", "enCurso", "completadas", "atrasadas", "ordenes"] },
  { nombre: "ordenes-por-etapa", titulo: "Órdenes por etapa", encabezado: "Etapa actual", campos: ["etapa", "area", "cantidad", "atrasadas"] },
];

test.use({ baseURL: BASE, ...(process.env.E2E_BROWSER_CHANNEL
  ? { browserName: "chromium" as const, channel: process.env.E2E_BROWSER_CHANNEL } : {}) });

async function entrarComo(page: Page, perfil: Perfil) {
  const clave = process.env[perfil.claveEnv];
  if (!clave) throw new Error(`Falta ${perfil.claveEnv}.`);
  await page.context().clearCookies();
  await iniciarSesion(page, perfil.correo, clave);
  await page.waitForURL(`**${perfil.destino}`);
}
async function leer<T>(page: Page, ruta: string): Promise<T> {
  const respuesta = await page.request.get(`/api/v1${ruta}`);
  expect(respuesta.status(), await respuesta.text()).toBe(200);
  return (await respuesta.json()).datos as T;
}
async function prepararCotizacion(browser: Browser) {
  const contexto = await browser.newContext({ baseURL: BASE });
  try {
    const page = await contexto.newPage();
    await entrarComo(page, ventas);
    const clientes = await leer<{ id: string }[]>(page, `/clientes?q=${encodeURIComponent("Agencia Viajes Tropical")}`);
    const productos = await leer<{ id: string }[]>(page, "/productos?q=ROT-VIN-001");
    expect(clientes.length).toBeGreaterThan(0); expect(productos.length).toBeGreaterThan(0);
    const creada = await page.request.post("/api/v1/cotizaciones", { headers: { Origin: ORIGEN },
      data: { clienteId: clientes[0].id, asunto: MARCA } });
    expect(creada.status(), await creada.text()).toBe(201);
    const cotizacion = (await creada.json()).datos as Cotizacion;
    const items = await page.request.put(`/api/v1/cotizaciones/${cotizacion.id}/items`, { headers: { Origin: ORIGEN },
      data: { version: cotizacion.actualizadoEn, items: [{ tipo: "CATALOGO", productoId: productos[0].id,
        cantidad: "1", ancho: "1", alto: "1" }] } });
    expect(items.status(), await items.text()).toBe(200);
    const editada = (await items.json()).datos as Cotizacion;
    const enviada = await page.request.post(`/api/v1/cotizaciones/${cotizacion.id}/enviar`, {
      headers: { Origin: ORIGEN }, data: { version: editada.actualizadoEn } });
    expect(enviada.status(), await enviada.text()).toBe(200);
    expect((await enviada.json()).datos.estado).toBe("ENVIADA");
  } finally { await contexto.close(); }
}
async function limpiarCotizacion(browser: Browser) {
  const contexto = await browser.newContext({ baseURL: BASE });
  try {
    const page = await contexto.newPage();
    await entrarComo(page, ventas);
    const filas = await leer<Cotizacion[]>(page, `/cotizaciones?q=${MARCA}&archivadas=false&porPagina=100`);
    for (const fila of filas.filter((fila) => fila.asunto === MARCA)) {
      const actual = await leer<Cotizacion>(page, `/cotizaciones/${fila.id}`);
      expect(actual.asunto).toBe(MARCA);
      const respuesta = await page.request.post(`/api/v1/cotizaciones/${fila.id}/archivar`, {
        headers: { Origin: ORIGEN }, data: { version: actual.actualizadoEn } });
      expect(respuesta.status(), await respuesta.text()).toBe(200);
      expect((await respuesta.json()).datos.archivada).toBe(true);
    }
  } finally { await contexto.close(); }
}
async function abrirPanel(page: Page) {
  await page.goto("/panel");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Panel");
  await expect(page.getByRole("region", { name: "Materiales disponibles", exact: true })).toBeVisible();
}
async function verificarEnlaces(page: Page) {
  const enlaces = page.getByRole("main").locator("a");
  const destinos = await enlaces.evaluateAll((nodos) => nodos.map((nodo) => nodo.getAttribute("href")!));
  expect(destinos.length).toBeGreaterThan(0);
  const seleccionados = new Map<string, string>();
  for (const destino of destinos) {
    const tipo = destino.split("?")[0].split("/").filter(Boolean)[0];
    if (!seleccionados.has(tipo)) seleccionados.set(tipo, destino);
  }
  for (const destino of seleccionados.values()) {
    await abrirPanel(page);
    await page.getByRole("main").locator(`a[href="${destino}"]`).first().click();
    await expect(page).toHaveURL(new URL(destino, BASE).toString());
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page).not.toHaveURL(/\/(sin-acceso|login)$/);
  }
}
async function abrirReporte(page: Page, nombre: string) {
  await page.goto("/reportes");
  await page.getByLabel("Reporte", { exact: true }).selectOption(nombre);
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page.getByRole("region", { name: "Resultado del reporte", exact: true })).toBeVisible();
}
async function aplicarPeriodo(page: Page) {
  const hoy = hoyManagua();
  await page.getByLabel("Desde", { exact: true }).fill(`${hoy.slice(0, 4)}-01-01`);
  await page.getByLabel("Hasta", { exact: true }).fill(hoy);
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page).toHaveURL(new RegExp(`desde=${hoy.slice(0, 4)}-01-01`));
  await expect(page.getByRole("region", { name: "Resultado del reporte", exact: true })).toBeVisible();
}
function parsearCsv(texto: string) {
  const filas: string[][] = [];
  let fila: string[] = [], celda = "", comillas = false;
  for (let indice = texto.charCodeAt(0) === 0xfeff ? 1 : 0; indice < texto.length; indice++) {
    const caracter = texto[indice];
    if (caracter === '"' && comillas && texto[indice + 1] === '"') { celda += '"'; indice++; }
    else if (caracter === '"') comillas = !comillas;
    else if (!comillas && caracter === ",") { fila.push(celda); celda = ""; }
    else if (!comillas && caracter === "\r" && texto[indice + 1] === "\n") {
      fila.push(celda); filas.push(fila); fila = []; celda = ""; indice++;
    } else celda += caracter;
  }
  return filas;
}
function verificarContenidoCsv(entrada: { csv: string; reporte: Reporte; campos: string[] }) {
  const filas = parsearCsv(entrada.csv);
  const esperadas = entrada.reporte.filas.map((fila) => entrada.campos.map((campo) => {
    const texto = String(fila[campo] ?? "");
    return /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
  }));
  expect(filas.slice(1, esperadas.length + 1)).toEqual(esperadas);
  expect(filas[esperadas.length + 2]).toEqual(["Totales"]);
  expect(filas.slice(esperadas.length + 4).map((fila) => fila[1])).toEqual(Object.values(entrada.reporte.totales).map(String));
}
async function descargarReporte(page: Page, reporte: typeof REPORTES[number]) {
  const enlace = page.getByRole("link", { name: "Exportar CSV" });
  const destino = await enlace.getAttribute("href");
  expect(destino).toContain("formato=csv");
  const rutaJson = destino!.replace("formato=csv", "formato=json");
  const respuesta = await page.request.get(rutaJson);
  expect(respuesta.status()).toBe(200);
  const json = (await respuesta.json()).datos as Reporte;
  const pendiente = page.waitForEvent("download");
  await enlace.click();
  const descarga = await pendiente;
  expect(descarga.suggestedFilename()).toBe(`${reporte.nombre}-${hoyManagua().replaceAll("-", "")}.csv`);
  const archivo = await descarga.path();
  expect(archivo).not.toBeNull();
  const bytes = fs.readFileSync(archivo!);
  expect([...bytes.subarray(0, 3)]).toEqual([239, 187, 191]);
  const csv = bytes.toString("utf8");
  expect(csv).toContain(`"${reporte.encabezado}"`);
  expect(csv).toContain("\r\n");
  verificarContenidoCsv({ csv, reporte: json, campos: reporte.campos });
}
async function capturarPanel(page: Page, perfil: Perfil) {
  fs.mkdirSync(CAPTURAS, { recursive: true });
  await entrarComo(page, perfil); await abrirPanel(page);
  for (const vista of VIEWPORTS) {
    await page.setViewportSize({ width: vista.width, height: vista.height });
    await sinDesbordeHorizontal(page); await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(CAPTURAS, `CF-06-panel-${perfil.codigo.toLowerCase()}-${vista.width}x${vista.height}.png`), fullPage: true });
    if ([1366, 820].includes(vista.width)) expect(await violacionesGraves(page)).toEqual([]);
  }
}
async function capturarReporte(page: Page) {
  fs.mkdirSync(CAPTURAS, { recursive: true });
  await entrarComo(page, gerencia); await abrirReporte(page, "existencias");
  for (const vista of VIEWPORTS) {
    await page.setViewportSize({ width: vista.width, height: vista.height });
    await sinDesbordeHorizontal(page); await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(CAPTURAS, `CF-06-reporte-gerencia-${vista.width}x${vista.height}.png`), fullPage: true });
    if ([1366, 820].includes(vista.width)) expect(await violacionesGraves(page)).toEqual([]);
  }
}
function registrarPerfilesPanel() {
  for (const perfil of perfilesPanel) {
    test(`${perfil.codigo}: panel, permisos, actualización y enlaces`, async ({ page }) => {
      await entrarComo(page, perfil); await abrirPanel(page);
      const cotizaciones = page.getByRole("region", { name: "Cotizaciones pendientes", exact: true });
      await expect(cotizaciones).toHaveCount(perfil.codigo === "PRODUCCION" ? 0 : 1);
      if (perfil.codigo === "PRODUCCION") expect(await page.getByRole("main").innerText()).not.toContain("C$");
      const actualizada = page.waitForResponse((respuesta) => respuesta.url().endsWith("/api/v1/panel"));
      await page.getByRole("button", { name: "Actualizar", exact: true }).click();
      expect((await actualizada).status()).toBe(200);
      await expect(page.getByRole("status")).toContainText("Actualizado:");
      await verificarEnlaces(page);
    });
    test(`${perfil.codigo}: capturas CF-06, axe y cuatro tamaños`, async ({ page }) => {
      await capturarPanel(page, perfil);
    });
  }
}
function registrarReportes() {
  for (const reporte of REPORTES) test(`Gerencia: ${reporte.titulo}, filtros y descarga CSV`, async ({ page }) => {
    await entrarComo(page, gerencia); await abrirReporte(page, reporte.nombre);
    if (["cotizaciones-por-estado", "carga-por-operario"].includes(reporte.nombre)) await aplicarPeriodo(page);
    if (reporte.nombre === "existencias") {
      await page.getByLabel("Buscar material").fill("Vinil");
      await page.getByRole("button", { name: "Aplicar filtros" }).click();
    }
    if (reporte.nombre === "ordenes-por-etapa") {
      const opciones = page.getByLabel("Área", { exact: true }).locator("option");
      expect(await opciones.count()).toBeGreaterThan(1);
      const area = await opciones.nth(1).getAttribute("value");
      await page.getByLabel("Área", { exact: true }).selectOption(area!);
      await page.getByRole("button", { name: "Aplicar filtros" }).click();
    }
    await expect(page.getByRole("heading", { name: reporte.titulo, exact: true })).toBeVisible();
    await descargarReporte(page, reporte);
  });
  test("Gerencia: reporte pasa axe, cuatro tamaños y capturas CF-06", async ({ page }) => {
    await capturarReporte(page);
  });
}
function registrarAccesoYErrores() {
  for (const perfil of PERFILES.filter((perfil) => ["VENTAS", "PRODUCCION"].includes(perfil.codigo))) {
    test(`${perfil.codigo}: sin acceso a Reportes`, async ({ page }) => {
      await entrarComo(page, perfil);
      await expect(page.locator("#menu-principal").getByRole("link", { name: "Reportes", exact: true })).toHaveCount(0);
      await page.goto("/reportes"); await expect(page).toHaveURL(/\/sin-acceso$/);
      for (const reporte of REPORTES) expect((await page.request.get(`/api/v1/reportes/${reporte.nombre}`)).status()).toBe(403);
    });
  }
  test("Administración: sin acceso al panel", async ({ page }) => {
    await entrarComo(page, PERFILES.find((perfil) => perfil.codigo === "ADMIN")!);
    await page.goto("/panel"); await expect(page).toHaveURL(/\/sin-acceso$/);
    expect((await page.request.get("/api/v1/panel")).status()).toBe(403);
  });
  test("Gerencia: error accesible y recuperación del panel", async ({ page }) => {
    await entrarComo(page, gerencia); await abrirPanel(page);
    await page.route("**/api/v1/panel", (ruta) => ruta.fulfill({ status: 500, contentType: "application/json",
      body: JSON.stringify({ error: { codigo: "ERROR_INTERNO", mensaje: "No se pudo actualizar el panel." } }) }));
    await page.getByRole("button", { name: "Actualizar", exact: true }).click();
    await expect(page.locator("[role=alert]:not(#__next-route-announcer__)")).toHaveAttribute("aria-live", "assertive");
    await expect(page.locator("[role=alert]:not(#__next-route-announcer__)")).toContainText("No se pudo actualizar el panel.");
    await page.unroute("**/api/v1/panel");
    await page.getByRole("button", { name: "Actualizar", exact: true }).click();
    await expect(page.locator("[role=alert]:not(#__next-route-announcer__)")).toHaveCount(0);
  });
  test("Gerencia: periodo inválido informa el error sin exportación", async ({ page }) => {
    await entrarComo(page, gerencia);
    await page.goto("/reportes?desde=2034-05-02&hasta=2034-05-01");
    await expect(page.locator("[role=alert]:not(#__next-route-announcer__)")).toBeVisible();
    await expect(page.getByLabel("Hasta", { exact: true })).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("link", { name: "Exportar CSV" })).toHaveCount(0);
  });
}

test.describe("Panel y reportes CF-06", () => {
  test.setTimeout(120000);
  test.beforeEach(({ browserName }, info) => { void browserName; test.skip(info.project.name !== "portatil", "La suite comprueba los cuatro tamaños desde portatil."); });
  test.beforeAll(async ({ browser }, info) => { if (info.project.name === "portatil") await prepararCotizacion(browser); });
  test.afterAll(async ({ browser }, info) => { if (info.project.name === "portatil") await limpiarCotizacion(browser); });
  registrarPerfilesPanel(); registrarReportes(); registrarAccesoYErrores();
});
