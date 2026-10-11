import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

import { PERFILES, VIEWPORTS, iniciarSesion, sinDesbordeHorizontal, violacionesGraves } from "./ayudas";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const ORIGIN = new URL(BASE).origin;
const CAPTURAS = path.join("docs", "capturas", "inventario");
const SELLO = Date.now();
const MARCA = `E2E-${SELLO}-invorden-${Math.floor(Math.random() * 100000)}`;
// El código admite 30 caracteres: el sello viaja en base 36.
const CODIGO = `E2E-${SELLO.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`.toUpperCase();
const NOMBRE = `${MARCA} material`;
const UNIDAD = "PLIEGO";
const CLIENTE = "Agencia Viajes Tropical";
const CATEGORIA = "Rotulación y gran formato";
type Perfil = (typeof PERFILES)[number];
type Material = { id: string; codigo: string; activo: boolean; existencia: string; actualizadoEn: string };
type Cotizacion = { id: string; asunto: string | null; actualizadoEn: string };
type Orden = { id: string; numero: string; estado: string; actualizadoEn: string; cotizacion: { asunto: string | null } };
type Fila = { tipo: string; costoUnitario?: string };
type Consumos = { movimientos: Fila[]; materiales: { neto: string; material: { codigo: string; id: string } }[] };
const PERFIL = (codigo: string) => PERFILES.find((perfil) => perfil.codigo === codigo)!;
const ADMINISTRACION = PERFIL("ADMINISTRACION");
const ATENCION_CLIENTE = PERFIL("ATENCION_CLIENTE");
const GERENCIA = PERFIL("GERENCIA");
const OPERACIONES = PERFIL("OPERACIONES");
const PRODUCCION = PERFIL("PRODUCCION");
let material: Material | undefined;
let cotizacion: Cotizacion | undefined;
let orden: Orden | undefined;

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

function datos<T>(valor: T | undefined, nombre: string): T {
  if (!valor) throw new Error(`Falta ${nombre}: falló una prueba previa.`);
  return valor;
}

function exacto(texto: string): RegExp {
  return new RegExp(`^${texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
}

function fechaFutura(dias: number): string {
  return new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);
}

// La hidratación puede descartar el primer clic sobre un selector renderizado en el servidor.
async function elegir(campo: Locator, opcion: string | RegExp, page: Page): Promise<void> {
  await expect(async () => {
    if (await campo.getAttribute("aria-expanded") !== "true") await campo.click();
    await expect(campo).toHaveAttribute("aria-expanded", "true", { timeout: 1000 });
  }).toPass({ timeout: 10000 });
  await page.getByRole("option", { name: opcion, exact: typeof opcion === "string" }).click();
}

function formulario(page: Page, nombre: string): Locator {
  return page.getByRole("form", { name: nombre });
}

// El libro muestra el tipo con su etiqueta legible, no con el valor del enum.
const ETIQUETA_TIPO: Record<string, string> = { ENTRADA: "Entrada", CONSUMO: "Consumo", DEVOLUCION: "Devolución", AJUSTE: "Ajuste" };

function filaLibro(page: Page, tipo: string): Locator {
  return page.getByRole("table", { name: "Libro de movimientos del inventario" }).getByRole("row")
    .filter({ has: page.getByText(ETIQUETA_TIPO[tipo] ?? tipo, { exact: true }) });
}

// El material nace por API: la interfaz de alta y de entradas ya se prueba en inventario.spec.ts.
async function prepararMaterial(page: Page): Promise<void> {
  await entrarComo(page, ADMINISTRACION);
  const alta = await page.request.post("/api/v1/materiales", { headers: { Origin: ORIGIN },
    data: { codigo: CODIGO, nombre: NOMBRE, unidad: UNIDAD, stockMinimo: "100", costoPromedio: "5" } });
  expect(alta.status(), await alta.text()).toBe(201);
  material = (await alta.json()).datos as Material;
  for (const [cantidad, costoUnitario] of [["10", "10"], ["3", "20"]]) {
    const entrada = await page.request.post("/api/v1/inventario/entradas", {
      headers: { Origin: ORIGIN, "Idempotency-Key": randomUUID() },
      data: { materialId: material.id, cantidad, costoUnitario, referencia: `${MARCA}-FAC` },
    });
    expect(entrada.status(), await entrada.text()).toBe(201);
  }
}

async function crearCotizacion(page: Page): Promise<void> {
  await page.goto("/cotizaciones");
  await page.getByRole("link", { name: "Nueva cotización" }).first().click();
  await elegir(page.getByLabel("Cliente", { exact: false }), CLIENTE, page);
  await page.getByLabel("Asunto").fill(MARCA);
  const creada = page.waitForResponse((r) => r.url().endsWith("/api/v1/cotizaciones") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Crear cotización" }).click();
  const respuesta = await creada;
  expect(respuesta.status()).toBe(201);
  cotizacion = (await respuesta.json()).datos as Cotizacion;
  await expect(page).toHaveURL(new RegExp(`/cotizaciones/${cotizacion.id}/editar$`));
  await page.getByRole("button", { name: "Agregar personalizado" }).click();
  await elegir(page.getByLabel("Categoría", { exact: false }), CATEGORIA, page);
  await page.getByLabel("Descripción del trabajo").fill(`${MARCA}-personalizado`);
  await page.getByRole("button", { name: "Agregar material", exact: true }).click();
  const linea = page.getByRole("group", { name: "Línea 1: Material" });
  await elegir(linea.getByLabel("Material registrado"), new RegExp(CODIGO), page);
  await expect(linea.getByLabel("Unidad de costo")).toHaveValue(UNIDAD);
  await linea.getByLabel("Descripción de costo").fill(`${MARCA}-material`);
  await linea.getByLabel("Cantidad total consumida").fill("4");
  await linea.getByLabel("Costo unitario (C$)").fill("10");
  await linea.getByLabel("Merma (%)").fill("0");
  await page.getByRole("button", { name: "Guardar ítems" }).click();
  await expect(page).toHaveURL(new RegExp(`/cotizaciones/${cotizacion.id}$`));
  await page.getByRole("button", { name: "Enviar cotización" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByRole("main")).toContainText("Enviada");
}

// Aprueba Operaciones (cotizacion:responder); la aprobación exige una referencia de 3 a 200 caracteres.
async function aprobarCotizacion(page: Page): Promise<void> {
  await entrarComo(page, OPERACIONES);
  await page.goto(`/cotizaciones/${datos(cotizacion, "la cotización").id}`);
  await page.getByRole("button", { name: "Aprobar", exact: true }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Referencia de aprobación").fill(`${MARCA}-aprobacion`);
  await dialogo.getByRole("button", { name: "Aprobar cotización" }).click();
  await expect(page.getByRole("main")).toContainText("Aprobada");
}

async function convertirEnOrden(page: Page): Promise<void> {
  await page.goto(`/cotizaciones/${datos(cotizacion, "la cotización").id}`);
  await page.getByRole("link", { name: "Convertir en orden", exact: true }).click();
  await expect(page.getByRole("form", { name: "Convertir cotización en orden" })).toBeVisible();
  await elegir(page.getByLabel("Responsable"), "Marco López", page);
  await page.getByLabel("Fecha de entrega").fill(fechaFutura(14));
  await page.getByLabel("Especificaciones").fill(`${MARCA}-especificaciones`);
  const creada = page.waitForResponse((r) => r.url().endsWith("/api/v1/ordenes") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Convertir en orden", exact: true }).click();
  const respuesta = await creada;
  expect(respuesta.status(), await respuesta.text()).toBe(201);
  orden = (await respuesta.json()).datos as Orden;
  await expect(page).toHaveURL(new RegExp(`/ordenes/${orden.id}$`));
}

// La ficha de la orden usa pestañas: la tabla de materiales vive en "Materiales consumidos".
async function abrirPestana(page: Page, nombre: string): Promise<void> {
  const pestana = page.getByRole("tab", { name: nombre, exact: true });
  await expect(async () => {
    if (await pestana.getAttribute("aria-selected") !== "true") await pestana.click();
    await expect(pestana).toHaveAttribute("aria-selected", "true", { timeout: 1000 });
  }).toPass({ timeout: 10000 });
}

// Cuatro cantidades en el orden de la tabla: estimado, consumido, devuelto y neto.
async function verResumen(page: Page, cantidades: string[]): Promise<void> {
  await abrirPestana(page, "Materiales consumidos");
  const fila = page.getByRole("table", { name: "Materiales de la orden" }).getByRole("row").filter({ hasText: NOMBRE });
  await expect(fila.getByRole("cell")).toHaveText([NOMBRE, ...cantidades.map((valor) => `${valor} ${UNIDAD}`)]);
}

async function abrirOrden(page: Page): Promise<void> {
  await page.goto(`/ordenes/${datos(orden, "la orden").id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(datos(orden, "la orden").numero);
}

async function abrirMovimiento(page: Page, tipo: "consumo" | "devolucion"): Promise<Locator> {
  await abrirOrden(page);
  await abrirPestana(page, "Materiales consumidos");
  await page.getByRole("link", { name: tipo === "consumo" ? "Registrar consumo" : "Devolver sobrante", exact: true }).click();
  const form = formulario(page, tipo === "consumo" ? "Registrar consumo" : "Devolver sobrante");
  await expect(form.getByLabel("Cantidad")).toBeVisible();
  return form;
}

async function enviarMovimiento(page: Page, form: Locator, estado: number): Promise<void> {
  const enviada = page.waitForResponse((r) => /\/api\/v1\/ordenes\/[^/]+\/(consumos|devoluciones)$/.test(r.url()) && r.request().method() === "POST");
  await form.getByRole("button", { name: /^(Registrar consumo|Devolver sobrante)$/ }).click();
  expect((await enviada).status()).toBe(estado);
}

async function verExistenciaEnFicha(page: Page, existencia: string): Promise<void> {
  await page.goto(`/inventario/${datos(material, "el material").id}`);
  await expect(page.getByRole("definition").filter({ hasText: exacto(`${existencia} ${UNIDAD}`) })).toBeVisible();
}

async function consumirDesdeFormulario(page: Page): Promise<void> {
  const form = await abrirMovimiento(page, "consumo");
  await expect(form.getByLabel("Cantidad")).toHaveValue("4.000");
  await expect(form).toContainText(`Existencia disponible: 13.000 ${UNIDAD}`);
  await form.getByLabel("Cantidad").fill("3");
  await enviarMovimiento(page, form, 201);
  await expect(form).toContainText(`Existencia disponible: 10.000 ${UNIDAD}`);
  await abrirOrden(page);
  await verResumen(page, ["4.000", "3.000", "0.000", "3.000"]);
  await verExistenciaEnFicha(page, "10.000");
}

async function rechazarExceso(page: Page): Promise<void> {
  const form = await abrirMovimiento(page, "consumo");
  await form.getByLabel("Cantidad").fill("100");
  await enviarMovimiento(page, form, 409);
  await expect(page.locator('[id="lineas.0.cantidad-error"]')).toContainText(/Existencia insuficiente.*solicitado 100\.000, disponible 10\.000/);
  await expect(form.getByRole("alert").filter({ hasText: "Existencia insuficiente" }).first()).toBeVisible();
  await expect(form).toContainText(`Existencia disponible: 10.000 ${UNIDAD}`);
  await verExistenciaEnFicha(page, "10.000");
}

async function devolverParcial(page: Page): Promise<void> {
  const form = await abrirMovimiento(page, "devolucion");
  await expect(form.getByLabel("Cantidad")).toHaveValue("3.000");
  await form.getByLabel("Cantidad").fill("1");
  await enviarMovimiento(page, form, 201);
  await expect(form).toContainText(`Existencia disponible: 11.000 ${UNIDAD}`);
  await abrirOrden(page);
  await verResumen(page, ["4.000", "3.000", "1.000", "2.000"]);
  await verExistenciaEnFicha(page, "11.000");
}

async function rechazarDevolucionExcesiva(page: Page): Promise<void> {
  const form = await abrirMovimiento(page, "devolucion");
  await form.getByLabel("Cantidad").fill("5");
  await enviarMovimiento(page, form, 409);
  await expect(page.locator('[id="lineas.0.cantidad-error"]')).toContainText(/supera lo consumido.*solicitado 5\.000, máximo devolvible 2\.000/);
  await verExistenciaEnFicha(page, "11.000");
}

async function totalMovimientos(page: Page): Promise<number> {
  const respuesta = await page.request.get(`/api/v1/materiales/${datos(material, "el material").id}/movimientos?porPagina=1`);
  expect(respuesta.status()).toBe(200);
  return (await respuesta.json()).total as number;
}

async function consultarConsumos(page: Page, ordenId: string): Promise<Consumos> {
  const respuesta = await page.request.get(`/api/v1/ordenes/${ordenId}/consumos`);
  expect(respuesta.status()).toBe(200);
  return (await respuesta.json()).datos as Consumos;
}

async function repetirConsumo(page: Page): Promise<void> {
  const ordenId = datos(orden, "la orden").id;
  const cuerpo = { lineas: [{ materialId: datos(material, "el material").id, cantidad: "1.000" }] };
  const encabezados = { Origin: ORIGIN, "Idempotency-Key": randomUUID() };
  const antes = await totalMovimientos(page);
  const primera = await page.request.post(`/api/v1/ordenes/${ordenId}/consumos`, { headers: encabezados, data: cuerpo });
  expect(primera.status(), await primera.text()).toBe(201);
  expect((await primera.json()).datos.repetida).toBe(false);
  const segunda = await page.request.post(`/api/v1/ordenes/${ordenId}/consumos`, { headers: encabezados, data: cuerpo });
  expect(segunda.status(), await segunda.text()).toBe(200);
  expect((await segunda.json()).datos.repetida).toBe(true);
  expect(await totalMovimientos(page)).toBe(antes + 1);
  expect((await consultarConsumos(page, ordenId)).materiales.map((fila) => fila.neto)).toEqual(["3.000"]);
}

// Producción ve la orden pero no el inventario ni los costos: ninguna pantalla ni respuesta lleva dinero.
async function verSinCostosComoProduccion(page: Page): Promise<void> {
  await entrarComo(page, PRODUCCION);
  await page.goto(`/inventario/${datos(material, "el material").id}`);
  await expect(page).toHaveURL(/\/sin-acceso$/);
  expect((await page.request.get(`/api/v1/materiales/${datos(material, "el material").id}/movimientos?porPagina=100`)).status()).toBe(403);
  const consumos = await page.request.get(`/api/v1/ordenes/${datos(orden, "la orden").id}/consumos`);
  if (consumos.status() === 200) {
    expect(((await consumos.json()).datos as Consumos).movimientos.every((fila) => fila.costoUnitario === undefined)).toBe(true);
  } else expect(consumos.status()).toBe(403);
  await abrirOrden(page);
  if (consumos.status() === 200) await verResumen(page, ["4.000", "4.000", "1.000", "3.000"]);
  expect(await page.evaluate(() => document.body.innerText)).not.toMatch(/C\$|Unitario/);
}

// Gerencia, Administración y Operaciones tienen inventario:ver y cotizacion:ver: ven el costo del consumo.
async function verCostos(page: Page, perfil: Perfil): Promise<void> {
  await entrarComo(page, perfil);
  await page.goto(`/inventario/${datos(material, "el material").id}`);
  await expect(filaLibro(page, "CONSUMO").first()).toContainText("Unitario: 12.3077");
  await expect(filaLibro(page, "DEVOLUCION").first()).toContainText("Unitario: 12.3077");
  const movimientos = (await consultarConsumos(page, datos(orden, "la orden").id)).movimientos;
  expect(movimientos.length).toBeGreaterThan(0);
  expect(movimientos.every((fila) => fila.costoUnitario === "12.3077")).toBe(true);
}

async function devolverNeto(page: Page, ordenId: string): Promise<void> {
  for (const fila of (await consultarConsumos(page, ordenId)).materiales.filter((fila) => fila.material.codigo === CODIGO && Number(fila.neto) > 0)) {
    const respuesta = await page.request.post(`/api/v1/ordenes/${ordenId}/devoluciones`, {
      headers: { Origin: ORIGIN, "Idempotency-Key": randomUUID() },
      data: { lineas: [{ materialId: fila.material.id, cantidad: fila.neto }] },
    });
    expect(respuesta.status(), await respuesta.text()).toBe(201);
  }
}

async function cancelarPorApi(page: Page, fila: Orden): Promise<void> {
  const lectura = await page.request.get(`/api/v1/ordenes/${fila.id}`);
  expect(lectura.status()).toBe(200);
  const vigente = (await lectura.json()).datos as Orden;
  expect(vigente.cotizacion.asunto?.startsWith(MARCA)).toBe(true);
  if (vigente.estado === "CANCELADA") return;
  const respuesta = await page.request.post(`/api/v1/ordenes/${fila.id}/cancelar`, {
    headers: { Origin: ORIGIN }, data: { version: vigente.actualizadoEn, motivo: `${MARCA}-limpieza` },
  });
  expect(respuesta.status(), await respuesta.text()).toBe(200);
}

async function archivarYVaciarMaterial(page: Page): Promise<void> {
  const lista = await page.request.get(`/api/v1/materiales?q=${CODIGO}&activo=todos&porPagina=100`);
  expect(lista.status()).toBe(200);
  for (const fila of ((await lista.json()).datos as Material[]).filter((fila) => fila.codigo === CODIGO && fila.activo)) {
    const ficha = (await (await page.request.get(`/api/v1/materiales/${fila.id}`)).json()).datos as Material;
    if (Number(ficha.existencia) > 0) {
      const ajuste = await page.request.post("/api/v1/inventario/ajustes", {
        headers: { Origin: ORIGIN, "Idempotency-Key": randomUUID() },
        data: { materialId: fila.id, direccion: "DISMINUIR", cantidad: ficha.existencia, motivo: `${MARCA}-limpieza` },
      });
      expect(ajuste.status(), await ajuste.text()).toBe(201);
    }
    const archivada = await page.request.post(`/api/v1/materiales/${fila.id}/archivar`, {
      headers: { Origin: ORIGIN }, data: { version: ficha.actualizadoEn },
    });
    expect(archivada.status(), await archivada.text()).toBe(200);
  }
}

async function archivarCotizaciones(page: Page): Promise<void> {
  const respuesta = await page.request.get(`/api/v1/cotizaciones?q=${MARCA}&archivadas=false&porPagina=100`);
  expect(respuesta.status()).toBe(200);
  for (const fila of ((await respuesta.json()).datos as Cotizacion[]).filter((fila) => fila.asunto?.startsWith(MARCA))) {
    const archivada = await page.request.post(`/api/v1/cotizaciones/${fila.id}/archivar`, {
      headers: { Origin: ORIGIN }, data: { version: fila.actualizadoEn },
    });
    expect(archivada.status(), await archivada.text()).toBe(200);
  }
}

// Cada paso corre aunque otro falle: devolver el neto, cancelar, vaciar y archivar el material, archivar la cotización.
async function limpiarCreadas(browser: Browser): Promise<void> {
  const contexto = await browser.newContext({ baseURL: BASE });
  const page = await contexto.newPage();
  const errores: unknown[] = [];
  let ordenes: Orden[] = [];
  const paso = async (perfil: Perfil, accion: () => Promise<void>) => {
    try { await entrarComo(page, perfil); await accion(); } catch (error) { errores.push(error); }
  };
  await paso(GERENCIA, async () => {
    const respuesta = await page.request.get(`/api/v1/ordenes?q=${MARCA}&terminales=todas&porPagina=100`);
    expect(respuesta.status()).toBe(200);
    ordenes = ((await respuesta.json()).datos as Orden[]).filter((fila) => fila.cotizacion.asunto?.startsWith(MARCA));
  });
  await paso(ADMINISTRACION, async () => { for (const fila of ordenes) await devolverNeto(page, fila.id); });
  await paso(OPERACIONES, async () => { for (const fila of ordenes) await cancelarPorApi(page, fila); });
  await paso(ADMINISTRACION, () => archivarYVaciarMaterial(page));
  await paso(ATENCION_CLIENTE, () => archivarCotizaciones(page));
  await contexto.close();
  if (errores.length) throw new AggregateError(errores, `Falló la limpieza de ${MARCA}`);
}

async function capturarOrden(page: Page): Promise<void> {
  fs.mkdirSync(CAPTURAS, { recursive: true });
  await entrarComo(page, GERENCIA);
  for (const vista of VIEWPORTS) {
    await page.setViewportSize({ width: vista.width, height: vista.height });
    await abrirOrden(page);
    await verResumen(page, ["4.000", "4.000", "1.000", "3.000"]);
    await sinDesbordeHorizontal(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(CAPTURAS, `CF-03-orden-${vista.nombre}.png`), fullPage: true });
  }
}

function registrarAxe(): void {
  for (const vista of VIEWPORTS.filter((candidata) => ["portatil", "tableta"].includes(candidata.nombre))) {
    test(`el formulario de consumo pasa axe en ${vista.nombre}`, async ({ page }, info) => {
      soloPortatil(info.project.name);
      await page.setViewportSize({ width: vista.width, height: vista.height });
      await entrarComo(page, ADMINISTRACION);
      await page.goto(`/inventario/consumo?ordenId=${datos(orden, "la orden").id}`);
      await expect(formulario(page, "Registrar consumo").getByLabel("Cantidad")).toBeVisible();
      expect.soft(await violacionesGraves(page), "formulario de consumo").toEqual([]);
      await sinDesbordeHorizontal(page);
    });
  }
}

test.describe("Consumo y devolución sobre una orden propia", () => {
  // Cada paso usa el material y la orden E2E para conservar los datos sembrados.
  test.describe.configure({ mode: "serial" });
  test.afterAll(async ({ browser }, info) => {
    if (info.project.name === "portatil") await limpiarCreadas(browser);
  });

  test("Atención al cliente cotiza el material, Operaciones aprueba y convierte en orden con estimado", async ({ page }, info) => {
    soloPortatil(info.project.name);
    test.setTimeout(180000);
    await prepararMaterial(page);
    await entrarComo(page, ATENCION_CLIENTE);
    await crearCotizacion(page);
    await aprobarCotizacion(page);
    await convertirEnOrden(page);
    await verResumen(page, ["4.000", "0.000", "0.000", "0.000"]);
  });

  registrarAxe();

  test("Administración consume desde la orden y ve consumido, neto y existencia", async ({ page }, info) => {
    soloPortatil(info.project.name);
    test.setTimeout(90000);
    await entrarComo(page, ADMINISTRACION);
    await consumirDesdeFormulario(page);
  });

  test("un consumo mayor que la existencia muestra el error por línea y no cambia la existencia", async ({ page }, info) => {
    soloPortatil(info.project.name);
    test.setTimeout(90000);
    await entrarComo(page, ADMINISTRACION);
    await rechazarExceso(page);
  });

  test("Administración devuelve parte del sobrante y una devolución excesiva se rechaza", async ({ page }, info) => {
    soloPortatil(info.project.name);
    test.setTimeout(120000);
    await entrarComo(page, ADMINISTRACION);
    await devolverParcial(page);
    await rechazarDevolucionExcesiva(page);
  });

  test("la misma Idempotency-Key no duplica el consumo", async ({ page }, info) => {
    soloPortatil(info.project.name);
    await entrarComo(page, ADMINISTRACION);
    await repetirConsumo(page);
  });

  test("Producción no ve inventario ni costos; Gerencia, Administración y Operaciones sí", async ({ page }, info) => {
    soloPortatil(info.project.name);
    test.setTimeout(120000);
    await verSinCostosComoProduccion(page);
    for (const perfil of [GERENCIA, ADMINISTRACION, OPERACIONES]) await verCostos(page, perfil);
  });

  test("Gerencia, Operaciones, Atención al cliente y Producción no registran consumos ni devoluciones", async ({ page }, info) => {
    soloPortatil(info.project.name);
    test.setTimeout(120000);
    const ordenId = datos(orden, "la orden").id;
    for (const perfil of [GERENCIA, OPERACIONES, ATENCION_CLIENTE, PRODUCCION]) {
      await entrarComo(page, perfil);
      await abrirOrden(page);
      if (await page.getByRole("tab", { name: "Materiales consumidos", exact: true }).count() > 0) {
        await verResumen(page, ["4.000", "4.000", "1.000", "3.000"]);
      }
      await expect(page.getByRole("link", { name: /^(Registrar consumo|Devolver sobrante)$/ })).toHaveCount(0);
      await page.goto(`/inventario/consumo?ordenId=${ordenId}`);
      await expect(page).toHaveURL(/\/sin-acceso$/);
      const consumo = await page.request.post(`/api/v1/ordenes/${ordenId}/consumos`, {
        headers: { Origin: ORIGIN, "Idempotency-Key": randomUUID() },
        data: { lineas: [{ materialId: datos(material, "el material").id, cantidad: "1.000" }] },
      });
      expect(consumo.status(), `${perfil.codigo}: ${await consumo.text()}`).toBe(403);
    }
  });

  test("captura CF-03 de la orden con consumo y devolución con Gerencia", async ({ page }, info) => {
    soloPortatil(info.project.name);
    test.setTimeout(120000);
    await capturarOrden(page);
  });
});
