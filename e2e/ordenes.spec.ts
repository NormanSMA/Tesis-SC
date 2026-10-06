import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";

import { PERFILES, VIEWPORTS, iniciarSesion, sinDesbordeHorizontal, violacionesGraves } from "./ayudas";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const ORIGIN = new URL(BASE).origin;
const CAPTURAS = path.join("docs", "capturas", "ordenes");
const MARCA = `E2E-${Date.now()}-ordenes-${Math.floor(Math.random() * 100000)}`;
const CLIENTE = "Agencia Viajes Tropical";
const CATEGORIA = "Rotulación y gran formato";
const PERSONALIZADO = `${MARCA}-personalizado`;
const ESPECIFICACIONES = `${MARCA}-instalación según arte aprobado`;
const ETAPAS = ["Diseño y aprobación de arte", "Impresión", "Laminado y corte", "Armado de estructura", "Instalación"];
type Perfil = (typeof PERFILES)[number];
type Cotizacion = { id: string; numero: string; asunto: string | null; archivada: boolean; actualizadoEn: string };
type Orden = { id: string; numero: string; estado: string; actualizadoEn: string; cotizacion: { asunto: string | null } };
type Conversion = { cotizacionId: string; categoriaId: string; responsableId: string; fechaEntrega: string; especificaciones: string };
const VENTAS = PERFILES.find((perfil) => perfil.codigo === "VENTAS")!;
const GERENCIA = PERFILES.find((perfil) => perfil.codigo === "GERENCIA")!;
const PRODUCCION = PERFILES.find((perfil) => perfil.codigo === "PRODUCCION")!;
const ADMIN = PERFILES.find((perfil) => perfil.codigo === "ADMIN")!;
let cotizacion: Cotizacion | undefined;
let orden: Orden | undefined;
let conversion: Conversion | undefined;

test.use({ baseURL: BASE, ...(process.env.E2E_BROWSER_CHANNEL
  ? { browserName: "chromium" as const, channel: process.env.E2E_BROWSER_CHANNEL } : {}) });

async function entrarComo(page: Page, perfil: Perfil): Promise<void> {
  const clave = process.env[perfil.claveEnv];
  if (!clave) throw new Error(`Falta la variable ${perfil.claveEnv}`);
  await page.context().clearCookies();
  await iniciarSesion(page, perfil.correo, clave);
  await page.waitForURL(`**${perfil.destino}`);
}

function soloPortatil(proyecto: string): void {
  test.skip(proyecto !== "portatil", "Los efectos y las capturas corren únicamente en portatil.");
}

function fechaFutura(dias: number): string {
  return new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);
}

function fechaVisible(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-");
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${dia} ${meses[Number(mes) - 1]} ${anio}`;
}

async function elegir(campo: Locator, opcion: string | RegExp, page: Page): Promise<void> {
  // La hidratación puede descartar el primer clic sobre un selector renderizado en el servidor.
  await expect(async () => {
    if (await campo.getAttribute("aria-expanded") !== "true") await campo.click();
    await expect(campo).toHaveAttribute("aria-expanded", "true", { timeout: 1000 });
  }).toPass({ timeout: 10000 });
  await page.getByRole("option", { name: opcion, exact: typeof opcion === "string" }).click();
}

async function crearMixta(page: Page): Promise<void> {
  await page.goto("/cotizaciones");
  await page.getByRole("link", { name: "Nueva cotización" }).first().click();
  await elegir(page.getByLabel("Cliente", { exact: false }), CLIENTE, page);
  await page.getByLabel("Asunto").fill(MARCA);
  const creada = page.waitForResponse((respuesta) => respuesta.url().endsWith("/api/v1/cotizaciones") && respuesta.request().method() === "POST");
  await page.getByRole("button", { name: "Crear cotización" }).click();
  const respuesta = await creada;
  expect(respuesta.status()).toBe(201);
  cotizacion = (await respuesta.json()).datos as Cotizacion;
  await expect(page).toHaveURL(new RegExp(`/cotizaciones/${cotizacion.id}/editar$`));
  await page.getByRole("button", { name: "Agregar catálogo" }).click();
  await elegir(page.getByLabel("Producto", { exact: false }), /ROT-VIN-001/, page);
  await page.getByLabel("Ancho (m)").fill("2");
  await page.getByLabel("Alto (m)").fill("1.5");
  await page.getByRole("button", { name: "Agregar personalizado" }).click();
  await elegir(page.getByLabel("Categoría", { exact: false }), CATEGORIA, page);
  await page.getByLabel("Descripción del trabajo").fill(PERSONALIZADO);
  await page.getByRole("button", { name: "Agregar material", exact: true }).click();
  const linea = page.getByRole("group", { name: "Línea 1: Material" });
  await elegir(linea.getByLabel("Material registrado"), /VIN-BLA-01/, page);
  await linea.getByLabel("Descripción de costo").fill(`${MARCA}-vinil`);
  await linea.getByLabel("Cantidad total consumida").fill("2");
  await linea.getByLabel("Costo unitario (C$)").fill("10");
  await linea.getByLabel("Merma (%)").fill("10");
  await page.getByRole("button", { name: "Guardar ítems" }).click();
  await expect(page).toHaveURL(new RegExp(`/cotizaciones/${cotizacion.id}$`));
  await expect(page.getByRole("main")).toContainText(CLIENTE);
  await page.getByRole("button", { name: "Enviar cotización" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByRole("main")).toContainText("Enviada");
}

async function aprobarMixta(page: Page): Promise<void> {
  if (!cotizacion) throw new Error("Falta la cotización mixta.");
  await entrarComo(page, GERENCIA);
  await page.goto(`/cotizaciones/${cotizacion.id}`);
  await page.getByRole("button", { name: "Aprobar", exact: true }).click();
  const peticion = page.waitForRequest((solicitud) => solicitud.url().endsWith(`/cotizaciones/${cotizacion!.id}/responder`));
  await page.getByRole("dialog").getByRole("button", { name: "Aprobar cotización" }).click();
  expect((await peticion).postDataJSON()).toMatchObject({ resultado: "APROBADA", version: expect.any(String) });
  await expect(page.getByRole("main")).toContainText("Aprobada");
}

async function abrirConversion(page: Page): Promise<void> {
  if (!cotizacion) throw new Error("Falta la cotización aprobada.");
  await page.goto(`/cotizaciones/${cotizacion.id}`);
  await page.getByRole("link", { name: "Convertir en orden", exact: true }).click();
  await expect(page.getByRole("form", { name: "Convertir cotización en orden" })).toBeVisible();
  await expect(page.getByLabel("Especificaciones")).toHaveValue(MARCA);
  await expect(page.getByLabel("Categoría principal")).toContainText(CATEGORIA);
  await expect(page.getByRole("main")).toContainText(CLIENTE);
  await expect(page.getByRole("form").getByLabel("Cliente")).toHaveCount(0);
  await expect(page.getByRole("form").getByLabel("Producto")).toHaveCount(0);
}

async function convertirMixta(page: Page): Promise<void> {
  await abrirConversion(page);
  await elegir(page.getByLabel("Responsable"), "Marco López", page);
  await page.getByLabel("Fecha de entrega").fill(fechaFutura(14));
  await page.getByLabel("Especificaciones").fill(ESPECIFICACIONES);
  const respuestaPendiente = page.waitForResponse((respuesta) => respuesta.url().endsWith("/api/v1/ordenes") && respuesta.request().method() === "POST");
  await page.getByRole("button", { name: "Convertir en orden", exact: true }).click();
  const respuesta = await respuestaPendiente;
  conversion = respuesta.request().postDataJSON() as Conversion;
  expect(respuesta.status(), await respuesta.text()).toBe(201);
  orden = (await respuesta.json()).datos as Orden;
  await expect(page).toHaveURL(new RegExp(`/ordenes/${orden.id}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^OT-\d{4}-\d{4}$/);
  await expect(page.getByRole("definition").filter({ hasText: /^Pendiente$/ })).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: /^Marco López$/ })).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: fechaVisible(conversion.fechaEntrega) })).toBeVisible();
  await expect(page.getByRole("main")).toContainText(ESPECIFICACIONES);
  await expect(page.getByRole("link", { name: CLIENTE, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: cotizacion!.numero, exact: true })).toBeVisible();
  const items = page.getByRole("region", { name: "Ítems", exact: true });
  await expect(items.getByRole("heading", { level: 3 })).toHaveCount(2);
  await expect(items).toContainText("Rótulo vinil adhesivo personalizado");
  await expect(items).toContainText(PERSONALIZADO);
  await expect(items).toContainText("Cantidad: 1.000");
  await expect(items).toContainText("Medidas: 2.000 × 1.500 m");
  await verificarEtapasYEstimado(page);
}

async function verificarEtapasYEstimado(page: Page): Promise<void> {
  const etapas = page.getByRole("table", { name: "Etapas de la orden" });
  await expect(etapas.getByRole("row")).toHaveCount(6);
  for (const nombre of ETAPAS) {
    const fila = etapas.getByRole("row").filter({ hasText: nombre });
    await expect(fila).toContainText("Pendiente");
    await expect(fila).toContainText("Sin responsable");
  }
  const consumo = page.getByRole("table", { name: "Consumo estimado de materiales" });
  await expect(consumo.getByRole("row")).toHaveCount(3);
  const vinil = consumo.getByRole("row", { name: /Vinil adhesivo blanco brillo/ });
  await expect(vinil).toContainText("3.700");
  await expect(vinil).toContainText("ROLLO");
  const laminado = consumo.getByRole("row", { name: /Laminado mate 150 micras/ });
  await expect(laminado).toContainText("1.500");
  await expect(laminado).toContainText("M2");
}

async function consultarSembradas(page: Page, estado?: string): Promise<Orden[]> {
  const consulta = new URLSearchParams({ terminales: "todas", porPagina: "100" });
  if (estado) consulta.set("estado", estado);
  const respuesta = await page.request.get(`/api/v1/ordenes?${consulta}`);
  expect(respuesta.status()).toBe(200);
  const filas = (await respuesta.json()).datos as Orden[];
  return filas.filter((fila) => fila.cotizacion.asunto && !fila.cotizacion.asunto.startsWith("E2E-"));
}

async function abrirSembrada(page: Page): Promise<void> {
  const filas = await consultarSembradas(page, "PENDIENTE");
  expect(filas.length, "Debe existir una orden sembrada pendiente.").toBeGreaterThan(0);
  await page.goto("/ordenes");
  await expect(page.getByRole("region", { name: "Listado de órdenes de trabajo" })).toBeVisible();
  await page.getByLabel("Buscar", { exact: true }).fill(filas[0].numero);
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await page.getByRole("link", { name: filas[0].numero, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(filas[0].numero);
}

async function cancelarPorApi(page: Page, fila: Orden): Promise<void> {
  const lectura = await page.request.get(`/api/v1/ordenes/${fila.id}`);
  expect(lectura.status()).toBe(200);
  const actual = (await lectura.json()).datos as Orden;
  expect(actual.cotizacion.asunto?.startsWith(MARCA)).toBe(true);
  if (actual.estado === "CANCELADA") return;
  const respuesta = await page.request.post(`/api/v1/ordenes/${fila.id}/cancelar`, {
    headers: { Origin: ORIGIN }, data: { version: actual.actualizadoEn, motivo: `${MARCA}-limpieza` },
  });
  expect(respuesta.status(), await respuesta.text()).toBe(200);
  expect((await respuesta.json()).datos.estado).toBe("CANCELADA");
}

async function archivarPorApi(page: Page, fila: Cotizacion): Promise<void> {
  const lectura = await page.request.get(`/api/v1/cotizaciones/${fila.id}`);
  expect(lectura.status()).toBe(200);
  const actual = (await lectura.json()).datos as Cotizacion;
  expect(actual.asunto?.startsWith(MARCA)).toBe(true);
  if (actual.archivada) return;
  const respuesta = await page.request.post(`/api/v1/cotizaciones/${fila.id}/archivar`, {
    headers: { Origin: ORIGIN }, data: { version: actual.actualizadoEn },
  });
  expect(respuesta.status(), await respuesta.text()).toBe(200);
  expect((await respuesta.json()).datos.archivada).toBe(true);
}

async function limpiarCreadas(browser: Browser): Promise<void> {
  const contexto = await browser.newContext({ baseURL: BASE });
  const page = await contexto.newPage();
  const errores: unknown[] = [];
  try {
    await entrarComo(page, GERENCIA);
    const respuesta = await page.request.get(`/api/v1/ordenes?q=${MARCA}&terminales=todas&porPagina=100`);
    expect(respuesta.status()).toBe(200);
    const filas = (await respuesta.json()).datos as Orden[];
    for (const fila of filas.filter((fila) => fila.cotizacion.asunto?.startsWith(MARCA))) {
      try { await cancelarPorApi(page, fila); } catch (error) { errores.push(error); }
    }
  } catch (error) { errores.push(error); }
  try {
    await entrarComo(page, VENTAS);
    const respuesta = await page.request.get(`/api/v1/cotizaciones?q=${MARCA}&archivadas=false&porPagina=100`);
    expect(respuesta.status()).toBe(200);
    const filas = (await respuesta.json()).datos as Cotizacion[];
    for (const fila of filas.filter((fila) => fila.asunto?.startsWith(MARCA))) {
      try { await archivarPorApi(page, fila); } catch (error) { errores.push(error); }
    }
  } catch (error) { errores.push(error); }
  finally { await contexto.close(); }
  if (errores.length) throw new AggregateError(errores, `Falló la limpieza de ${MARCA}`);
}

async function capturarFicha(page: Page, perfil: Perfil): Promise<void> {
  if (!orden) throw new Error("Falta la orden convertida.");
  fs.mkdirSync(CAPTURAS, { recursive: true });
  await entrarComo(page, perfil);
  await page.goto(`/ordenes/${orden.id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(orden.numero);
  await expect(page.getByRole("region", { name: "Ítems", exact: true })).toContainText("C$");
  for (const vista of VIEWPORTS) {
    await page.setViewportSize({ width: vista.width, height: vista.height });
    await verificarEtapasYEstimado(page);
    await sinDesbordeHorizontal(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(CAPTURAS, `CF-01-${perfil.codigo.toLowerCase()}-${vista.nombre}.png`), fullPage: true });
    if (perfil.codigo === "GERENCIA") {
      await page.getByRole("region", { name: "Etapas", exact: true }).screenshot({
        path: path.join(CAPTURAS, `CF-02-gerencia-${vista.nombre}.png`),
      });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(CAPTURAS, `CF-09-gerencia-${vista.nombre}.png`), fullPage: true });
    }
  }
}

function registrarPruebasAxe(): void {
  for (const vista of VIEWPORTS.filter((vista) => ["portatil", "tableta"].includes(vista.nombre))) {
    test(`lista, ficha y conversión pasan axe en ${vista.nombre}`, async ({ page }, info) => {
      soloPortatil(info.project.name);
      test.setTimeout(120000);
      await page.setViewportSize({ width: vista.width, height: vista.height });
      await entrarComo(page, VENTAS);
      await page.goto("/ordenes");
      await expect(page.getByRole("region", { name: "Listado de órdenes de trabajo" })).toBeVisible();
      expect.soft(await violacionesGraves(page), "lista").toEqual([]);
      await abrirSembrada(page);
      await expect(page.getByRole("region", { name: "Etapas", exact: true })).toBeVisible();
      expect.soft(await violacionesGraves(page), "ficha").toEqual([]);
      await abrirConversion(page);
      expect.soft(await violacionesGraves(page), "formulario de conversión").toEqual([]);
    });
  }
}

function registrarCapturas(): void {
  for (const perfil of [VENTAS, GERENCIA]) {
    test(`captura CF-01, CF-02 y CF-09 con ${perfil.codigo}`, async ({ page }, info) => {
      soloPortatil(info.project.name);
      test.setTimeout(120000);
      await capturarFicha(page, perfil);
    });
  }
}

function registrarGestion(): void {
  test("Gerencia cambia responsable y fecha; registra eventos y cancela con motivo", async ({ page }, info) => {
    soloPortatil(info.project.name);
    if (!orden || !conversion) throw new Error("Falta la orden convertida.");
    await entrarComo(page, GERENCIA);
    await page.goto(`/ordenes/${orden.id}`);
    await page.getByRole("link", { name: "Editar", exact: true }).click();
    await elegir(page.getByLabel("Responsable"), "Gabriel Cortez", page);
    const nuevaFecha = fechaFutura(21);
    await page.getByLabel("Fecha de entrega").fill(nuevaFecha);
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page).toHaveURL(new RegExp(`/ordenes/${orden.id}$`));
    await expect(page.getByRole("definition").filter({ hasText: /^Gabriel Cortez$/ })).toBeVisible();
    await expect(page.getByRole("definition").filter({ hasText: fechaVisible(nuevaFecha) })).toBeVisible();
    const historial = page.getByRole("list", { name: "Historial de la orden" });
    await expect(historial).toContainText("asignó el responsable");
    await expect(historial).toContainText("editó la orden");
    await expect(historial).toContainText(`Fecha de entrega: ${conversion.fechaEntrega} → ${nuevaFecha}`);
    await page.getByRole("button", { name: "Cancelar orden", exact: true }).click();
    const motivo = `${MARCA}-cancelación de prueba`;
    await page.getByRole("dialog").getByLabel("Motivo").fill(motivo);
    await page.getByRole("dialog").getByRole("button", { name: "Cancelar orden", exact: true }).click();
    await expect(page.getByRole("definition").filter({ hasText: /^Cancelada$/ })).toBeVisible();
    await expect(page.getByRole("main")).toContainText(motivo);
    const etapas = page.getByRole("table", { name: "Etapas de la orden" });
    for (const nombre of ETAPAS) await expect(etapas.getByRole("row").filter({ hasText: nombre })).toContainText("Omitida");
    await expect(etapas).not.toContainText("Pendiente");
    await expect(historial).toContainText("Pendiente → Cancelada");
    await expect(page.getByRole("link", { name: "Editar", exact: true })).toHaveCount(0);
  });
}

test.describe("Conversión y gestión de una orden propia", () => {
  // Cada paso usa la cotización propia para conservar los datos sembrados.
  test.describe.configure({ mode: "serial" });
  test.afterAll(async ({ browser }, info) => {
    if (info.project.name === "portatil") await limpiarCreadas(browser);
  });

  test("Ventas crea y envía una cotización mixta; Gerencia la aprueba", async ({ page }, info) => {
    soloPortatil(info.project.name);
    test.setTimeout(120000);
    await entrarComo(page, VENTAS);
    await crearMixta(page);
    await aprobarMixta(page);
  });

  registrarPruebasAxe();

  test("Ventas convierte sin reingresar ítems y ve etapas y consumo estimado", async ({ page }, info) => {
    soloPortatil(info.project.name);
    test.setTimeout(90000);
    await entrarComo(page, VENTAS);
    await convertirMixta(page);
  });

  test("la segunda conversión desaparece y la API responde 409", async ({ page }, info) => {
    soloPortatil(info.project.name);
    if (!cotizacion || !orden || !conversion) throw new Error("Falta la conversión.");
    await entrarComo(page, VENTAS);
    await page.goto(`/cotizaciones/${cotizacion.id}`);
    await expect(page.getByRole("link", { name: "Convertir en orden" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Convertir en orden" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: `Ver orden ${orden.numero}` })).toHaveAttribute("href", `/ordenes/${orden.id}`);
    const respuesta = await page.request.post("/api/v1/ordenes", { headers: { Origin: ORIGIN }, data: conversion });
    expect(respuesta.status()).toBe(409);
    expect((await respuesta.json()).error).toMatchObject({ codigo: "ORDEN_EXISTENTE", mensaje: expect.stringContaining(orden.numero) });
  });

  registrarCapturas();

  registrarGestion();

});

test("Producción consulta lista y ficha sin gestión ni dinero", async ({ page }) => {
  await entrarComo(page, PRODUCCION);
  await page.goto("/ordenes");
  await expect(page.getByRole("region", { name: "Listado de órdenes de trabajo" })).toBeVisible();
  expect(await page.evaluate(() => document.body.innerText)).not.toContain("C$");
  await abrirSembrada(page);
  expect(await page.evaluate(() => document.body.innerText)).not.toContain("C$");
  await expect(page.getByRole("link", { name: "Editar", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Cancelar orden|Cerrar|Entregar|Convertir en orden/ })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Ítems", exact: true })).toContainText("Cantidad:");
  await expect(page.getByRole("table", { name: "Etapas de la orden" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Consumo estimado de materiales" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^COT-/ })).toHaveCount(0);
});

test("Administración termina en sin-acceso al abrir órdenes", async ({ page }) => {
  await entrarComo(page, ADMIN);
  await page.goto("/ordenes");
  await expect(page).toHaveURL(/\/sin-acceso$/);
});

for (const perfil of [VENTAS, GERENCIA]) {
  test(`${perfil.codigo} ve importes en la ficha sembrada`, async ({ page }) => {
    await entrarComo(page, perfil);
    await abrirSembrada(page);
    await expect(page.getByRole("region", { name: "Ítems", exact: true })).toContainText("C$");
    await expect(page.getByRole("main")).toContainText("Total");
  });
}

for (const perfil of [VENTAS, GERENCIA, PRODUCCION]) {
  for (const estado of ["LISTA", "ENTREGADA"]) {
    test(`${perfil.codigo} muestra acciones permitidas en una orden ${estado} sin modificarla`, async ({ page }) => {
      await entrarComo(page, perfil);
      const filas = await consultarSembradas(page, estado);
      test.skip(filas.length === 0, `No existe una orden sembrada ${estado}.`);
      await page.goto(`/ordenes/${filas[0].id}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(filas[0].numero);
      const entregar = estado === "LISTA" && perfil.codigo !== "GERENCIA";
      const cerrar = estado === "ENTREGADA" && perfil.codigo !== "PRODUCCION";
      await expect(page.getByRole("button", { name: "Entregar", exact: true })).toHaveCount(entregar ? 1 : 0);
      await expect(page.getByRole("button", { name: "Cerrar", exact: true })).toHaveCount(cerrar ? 1 : 0);
    });
  }
}

test("lista y ficha no desbordan horizontalmente en el tamaño del proyecto", async ({ page }, info) => {
  const vista = VIEWPORTS.find((vista) => vista.nombre === info.project.name)!;
  await page.setViewportSize({ width: vista.width, height: vista.height });
  await entrarComo(page, VENTAS);
  await page.goto("/ordenes");
  await expect(page.getByRole("region", { name: "Listado de órdenes de trabajo" })).toBeVisible();
  await sinDesbordeHorizontal(page);
  await abrirSembrada(page);
  await expect(page.getByRole("region", { name: "Etapas", exact: true })).toBeVisible();
  await sinDesbordeHorizontal(page);
});
