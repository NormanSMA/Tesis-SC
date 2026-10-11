import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { hoyManagua } from "../src/modules/cotizaciones/fechas";
import { PERFILES, VIEWPORTS, iniciarSesion, sinDesbordeHorizontal, violacionesGraves } from "./ayudas";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const CAPTURAS = path.join("docs", "capturas", "panel");
type Perfil = typeof PERFILES[number];
type Reporte = { filas: Record<string, string | number | null>[]; totales: Record<string, string | number | null> };
type PanelEsperado = { pregunta: string; indicadores: string[]; grafico: string };
const gerencia = PERFILES.find((perfil) => perfil.codigo === "GERENCIA")!;
const admin = PERFILES.find((perfil) => perfil.codigo === "ADMIN")!;
const perfilesPanel = PERFILES.filter((perfil) => perfil.codigo !== "ADMIN");
// Textos fijos de cada panel (src/modules/panel/paneles.ts). Las cifras y la conclusión del título dependen de la siembra.
const PANELES: Record<string, PanelEsperado> = {
  GERENCIA: { pregunta: "¿Cómo va el negocio este mes?", grafico: "Monto aprobado por mes",
    indicadores: ["Monto aprobado", "Tasa de aprobación", "Órdenes en producción", "Órdenes atrasadas"] },
  OPERACIONES: { pregunta: "¿Qué órdenes necesitan mi acción?", grafico: "Órdenes por estado",
    indicadores: ["Por iniciar", "Sin responsable", "En producción", "Entregas próximas"] },
  ATENCION_CLIENTE: { pregunta: "¿Qué clientes esperan respuesta?", grafico: "Cotizaciones por estado",
    indicadores: ["Enviadas sin respuesta", "Por vencer", "Aprobadas del mes", "Clientes nuevos"] },
  PRODUCCION: { pregunta: "¿Qué hago hoy?", grafico: "Etapas que completé",
    indicadores: ["Mis etapas en curso", "Mis etapas pendientes", "Completadas hoy por mí", "Mis etapas atrasadas"] },
  ADMINISTRACION: { pregunta: "¿Está sano el inventario?", grafico: "Consumos por semana",
    indicadores: ["Materiales bajo el mínimo", "Consumos de hoy", "Valor del inventario", "Movimientos de la semana"] },
};
const REPORTES = [
  { nombre: "cotizaciones-por-estado", titulo: "Cotizaciones por estado", encabezado: "Estado", campos: ["estado", "cantidad", "importe"] },
  { nombre: "existencias", titulo: "Existencias", encabezado: "Código", campos: ["codigo", "material", "unidad", "existencia", "stockMinimo", "costoPromedio", "valorInventario", "alerta"] },
  { nombre: "carga-por-operario", titulo: "Carga por operario", encabezado: "Responsable", campos: ["responsable", "pendientes", "enCurso", "completadas", "atrasadas", "ordenes"] },
  { nombre: "ordenes-por-etapa", titulo: "Órdenes por etapa", encabezado: "Etapa actual", campos: ["etapa", "area", "cantidad", "atrasadas"] },
];

test.use({ baseURL: BASE, ...(process.env.E2E_BROWSER_CHANNEL
  ? { browserName: "chromium" as const, channel: process.env.E2E_BROWSER_CHANNEL } : {}) });

const esRespuestaPanel = (url: string) => new URL(url).pathname === "/api/v1/panel";

async function entrarComo(page: Page, perfil: Perfil) {
  const clave = process.env[perfil.claveEnv];
  if (!clave) throw new Error(`Falta ${perfil.claveEnv}.`);
  await page.context().clearCookies();
  await iniciarSesion(page, perfil.correo, clave);
  await page.waitForURL(`**${perfil.destino}`);
}
function regionPanel(page: Page) {
  return page.getByRole("region", { name: "Panel", exact: true });
}
async function abrirPanel(page: Page) {
  await page.goto("/panel");
  await expect(regionPanel(page)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}
async function verificarEstructuraPanel(page: Page, perfil: Perfil) {
  const esperado = PANELES[perfil.codigo];
  const panel = regionPanel(page);
  await expect(page.getByText(esperado.pregunta, { exact: true })).toBeVisible();
  const titulo = page.getByRole("heading", { level: 1 });
  await expect(titulo).not.toHaveText(/^\s*$/);
  await expect(titulo).not.toHaveText("No hay datos disponibles con sus permisos");
  for (const etiqueta of esperado.indicadores) {
    await expect(panel.getByRole("link", { name: new RegExp(`^${etiqueta}`) })).toHaveCount(1);
  }
  await expect(panel.getByRole("link", { name: new RegExp(`^(${esperado.indicadores.join("|")})`) })).toHaveCount(4);
  await expect(panel.getByRole("heading", { level: 2, name: esperado.grafico, exact: true })).toBeVisible();
  await expect(panel.getByRole("img", { name: new RegExp(`^${esperado.grafico}`) })).toBeVisible();
  await expect(panel.getByRole("heading", { level: 2, name: "Requiere atención", exact: true })).toBeVisible();
  await expect(panel.locator("aside[aria-label='Requiere atención']")).toBeVisible();
  await expect(panel.getByRole("group", { name: "Perfil del panel" })).toHaveCount(0);
}
async function verificarEnlaces(page: Page) {
  const enlaces = regionPanel(page).locator("a");
  const destinos = await enlaces.evaluateAll((nodos) => nodos.map((nodo) => nodo.getAttribute("href")!));
  expect(destinos.length).toBeGreaterThan(0);
  const seleccionados = new Map<string, string>();
  for (const destino of destinos) {
    const tipo = destino.split("?")[0].split("/").filter(Boolean)[0];
    if (!seleccionados.has(tipo)) seleccionados.set(tipo, destino);
  }
  for (const destino of seleccionados.values()) {
    await abrirPanel(page);
    await regionPanel(page).locator(`a[href="${destino}"]`).first().click();
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
    if ([1366, 768].includes(vista.width)) expect(await violacionesGraves(page)).toEqual([]);
  }
}
async function capturarReporte(page: Page) {
  fs.mkdirSync(CAPTURAS, { recursive: true });
  await entrarComo(page, gerencia); await abrirReporte(page, "existencias");
  for (const vista of VIEWPORTS) {
    await page.setViewportSize({ width: vista.width, height: vista.height });
    await sinDesbordeHorizontal(page); await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(CAPTURAS, `CF-06-reporte-gerencia-${vista.width}x${vista.height}.png`), fullPage: true });
    if ([1366, 768].includes(vista.width)) expect(await violacionesGraves(page)).toEqual([]);
  }
}
function registrarPerfilesPanel() {
  for (const perfil of perfilesPanel) {
    test(`${perfil.codigo}: panel con pregunta, 4 indicadores, gráfico y requiere atención`, async ({ page }) => {
      await entrarComo(page, perfil); await abrirPanel(page);
      await verificarEstructuraPanel(page, perfil);
      if (perfil.codigo === "PRODUCCION") expect(await page.getByRole("main").innerText()).not.toContain("C$");
    });
    test(`${perfil.codigo}: actualización y enlaces`, async ({ page }) => {
      await entrarComo(page, perfil); await abrirPanel(page);
      const actualizada = page.waitForResponse((respuesta) => esRespuestaPanel(respuesta.url()));
      await page.getByRole("button", { name: "Actualizar", exact: true }).click();
      expect((await actualizada).status()).toBe(200);
      await expect(page.getByRole("status").filter({ hasText: "Actualizado:" })).toBeVisible();
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
  for (const perfil of perfilesPanel.filter((perfil) => perfil.codigo !== "GERENCIA")) {
    test(`${perfil.codigo}: sin acceso a Reportes`, async ({ page }) => {
      await entrarComo(page, perfil);
      await expect(page.locator("#menu-principal").getByRole("link", { name: "Reportes", exact: true })).toHaveCount(0);
      await page.goto("/reportes"); await expect(page).toHaveURL(/\/sin-acceso$/);
      for (const reporte of REPORTES) expect((await page.request.get(`/api/v1/reportes/${reporte.nombre}`)).status()).toBe(403);
    });
  }
  test("ADMIN: sin acceso al panel", async ({ page }) => {
    await entrarComo(page, admin);
    await expect(page.locator("#menu-principal").getByRole("link", { name: "Panel", exact: true })).toHaveCount(0);
    await page.goto("/panel"); await expect(page).toHaveURL(/\/sin-acceso$/);
    expect((await page.request.get("/api/v1/panel")).status()).toBe(403);
  });
  test("Gerencia: error accesible y recuperación del panel", async ({ page }) => {
    await entrarComo(page, gerencia); await abrirPanel(page);
    const rutaPanel = /\/api\/v1\/panel(\?|$)/;
    await page.route(rutaPanel, (ruta) => ruta.fulfill({ status: 500, contentType: "application/json",
      body: JSON.stringify({ error: { codigo: "ERROR_INTERNO", mensaje: "No se pudo actualizar el panel." } }) }));
    await page.getByRole("button", { name: "Actualizar", exact: true }).click();
    await expect(page.locator("[role=alert]:not(#__next-route-announcer__)")).toHaveAttribute("aria-live", "assertive");
    await expect(page.locator("[role=alert]:not(#__next-route-announcer__)")).toContainText("No se pudo actualizar el panel.");
    await page.unroute(rutaPanel);
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
  registrarPerfilesPanel(); registrarReportes(); registrarAccesoYErrores();
});
