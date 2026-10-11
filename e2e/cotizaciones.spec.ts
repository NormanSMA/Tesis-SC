import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

import { PERFILES, VIEWPORTS, iniciarSesion, violacionesGraves } from "./ayudas";

dotenv.config();

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const CARPETA_CAPTURAS = path.join("docs", "capturas", "cotizaciones");
const CLIENTE_SEMBRADO = "Agencia Viajes Tropical";
const CATEGORIA = "Rotulación y gran formato";
const APROBADOR = "Karla Reyes";
const PLEGABLES = ["Condiciones y fechas", "Costos internos"];

test.use({ baseURL: BASE });
// Las pruebas comparten la cotización mixta: cada paso depende del anterior.
test.describe.configure({ mode: "serial" });

type Perfil = (typeof PERFILES)[number];
type Totales = { subtotal: number; impuesto: number; total: number };
type Cotizacion = { id: string; numero: string; asunto: string; actualizadoEn: string };

const GERENCIA = PERFILES.find((perfil) => perfil.codigo === "GERENCIA") as Perfil;
const OPERACIONES = PERFILES.find((perfil) => perfil.codigo === "OPERACIONES") as Perfil;
const ATENCION_CLIENTE = PERFILES.find((perfil) => perfil.codigo === "ATENCION_CLIENTE") as Perfil;
const PRODUCCION = PERFILES.find((perfil) => perfil.codigo === "PRODUCCION") as Perfil;
const ADMIN = PERFILES.find((perfil) => perfil.codigo === "ADMIN") as Perfil;

let mixta: { id: string; numero: string; totales: Totales } | null = null;
let referenciaAprobacion: string | null = null;
let conAjustes: { id: string } | null = null;

function claveDe(perfil: Perfil): string {
  const directa = process.env[perfil.claveEnv];
  if (directa) return directa;
  const ejemplo = fs.readFileSync(".env.example", "utf-8");
  const coincidencia = ejemplo.match(new RegExp(`^${perfil.claveEnv}=(.+)$`, "m"));
  if (!coincidencia) throw new Error(`No se encontró ${perfil.claveEnv}`);
  return coincidencia[1];
}

async function entrarComo(page: Page, perfil: Perfil): Promise<void> {
  await iniciarSesion(page, perfil.correo, claveDe(perfil));
  await page.waitForURL(`**${perfil.destino}`, { timeout: 15_000 });
}

function marcaE2E(): string {
  return `E2E-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

// Las pruebas con efectos o con tamaño propio corren una sola vez: Playwright repite cada prueba por proyecto.
function soloUnaVez(proyecto: string) {
  test.skip(proyecto !== "portatil", "Esta prueba fija sus propios tamaños y corre solo en el proyecto portatil.");
}

function datosMixta(): { id: string; numero: string; totales: Totales } {
  if (!mixta) throw new Error("La cotización mixta no se creó: falló la primera prueba.");
  return mixta;
}

function datosAprobacion(): string {
  if (!referenciaAprobacion) throw new Error("La cotización mixta no se aprobó: falló la prueba de aprobación.");
  return referenciaAprobacion;
}

function datosConAjustes(): { id: string } {
  if (!conAjustes) throw new Error("No hay cotización con ajustes solicitados: falló la prueba anterior.");
  return conAjustes;
}

function porId(page: Page, id: string): Locator {
  return page.locator(`[id="${id}"]`);
}

async function elegirEn(page: Page, id: string, opcion: string | RegExp): Promise<void> {
  await porId(page, id).click();
  await page.getByRole("option", { name: opcion }).click();
}

// Los plegables de la ficha vienen cerrados: ábralos antes de leer su contenido.
async function abrirPlegable(page: Page, nombre: string): Promise<void> {
  const detalle = page.locator("details").filter({ has: page.locator("summary", { hasText: nombre }) }).first();
  await expect(detalle).toBeVisible();
  const abierto = await detalle.evaluate((elemento) => (elemento as HTMLDetailsElement).open);
  if (!abierto) await detalle.locator("summary").first().click();
  await expect(detalle).toHaveJSProperty("open", true);
}

function aNumero(texto: string | null): number {
  return Number((texto ?? "").replace(/[^0-9.]/g, ""));
}

async function leerTotales(page: Page): Promise<Totales> {
  const tarjeta = page.getByLabel("Totales de cotización");
  await expect(tarjeta).toBeVisible();
  const valorDe = async (etiqueta: RegExp) =>
    aNumero(await tarjeta.getByText(etiqueta).locator("xpath=following-sibling::dd").first().textContent());
  return {
    subtotal: await valorDe(/^Subtotal$/),
    impuesto: await valorDe(/^IVA \(15(\.0+)? %\)$/),
    total: await valorDe(/^Total$/),
  };
}

function verificarAritmetica(totales: Totales): void {
  expect(totales.subtotal).toBeGreaterThan(0);
  expect(Math.abs(totales.impuesto - totales.subtotal * 0.15)).toBeLessThanOrEqual(0.01);
  expect(Math.abs(totales.total - (totales.subtotal + totales.impuesto))).toBeLessThanOrEqual(0.01);
}

async function archivarPorApi(page: Page, id: string): Promise<void> {
  const actual = await page.request.get(`/api/v1/cotizaciones/${id}`);
  const { archivada, actualizadoEn } = (await actual.json()).datos as { archivada: boolean; actualizadoEn: string };
  if (archivada) return;
  const respuesta = await page.request.post(`/api/v1/cotizaciones/${id}/archivar`, {
    headers: { Origin: BASE },
    data: { version: actualizadoEn },
  });
  expect([200, 409]).toContain(respuesta.status());
}

// Red de seguridad: si una prueba falla a medias, no deja cotizaciones E2E sin archivar.
async function archivarCotizacionesE2E(browser: Browser): Promise<void> {
  const contexto = await browser.newContext({ baseURL: BASE });
  const page = await contexto.newPage();
  try {
    await entrarComo(page, ATENCION_CLIENTE);
    const lista = await page.request.get("/api/v1/cotizaciones?q=E2E-&archivadas=false&porPagina=100");
    const filas = ((await lista.json()).datos ?? []) as { id: string; asunto: string | null }[];
    for (const fila of filas.filter((cotizacion) => cotizacion.asunto?.startsWith("E2E-"))) await archivarPorApi(page, fila.id);
  } finally {
    await contexto.close();
  }
}

test.afterAll(async ({ browser }, info) => {
  if (info.project.name === "portatil") await archivarCotizacionesE2E(browser);
});

async function crearCabecera(page: Page, asunto: string): Promise<void> {
  await page.goto("/cotizaciones");
  await page.getByRole("link", { name: "Nueva cotización" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Nueva cotización" })).toBeVisible();
  await elegirEn(page, "clienteId", CLIENTE_SEMBRADO);
  await page.locator("#asunto").fill(asunto);
  await page.getByRole("button", { name: "Crear cotización" }).click();
  await expect(page).toHaveURL(/\/cotizaciones\/[0-9a-f-]{36}\/editar$/);
}

async function agregarItemPorM2(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Agregar catálogo" }).click();
  await elegirEn(page, "items.0.productoId", /ROT-VIN-001/);
  await porId(page, "items.0.ancho").fill("2");
  await porId(page, "items.0.alto").fill("1.5");
  await expect(page.getByText("Cobro: m².")).toBeVisible();
}

async function agregarItemPorUnidad(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Agregar catálogo" }).click();
  await elegirEn(page, "items.1.productoId", /ROT-ACM-001/);
  await porId(page, "items.1.cantidad").fill("2");
  await expect(page.getByText("Cobro: unidad.")).toBeVisible();
}

async function agregarItemPersonalizado(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Agregar personalizado" }).click();
  await elegirEn(page, "items.2.categoriaId", CATEGORIA);
  await porId(page, "items.2.descripcion").fill("Trabajo personalizado E2E");

  await page.getByRole("button", { name: "Agregar material" }).click();
  await porId(page, "items.2.lineas.0.descripcion").fill("Vinil E2E");
  await porId(page, "items.2.lineas.0.cantidad").fill("2");
  await porId(page, "items.2.lineas.0.costoUnitario").fill("10");

  await page.getByRole("button", { name: "Agregar mano de obra" }).click();
  await porId(page, "items.2.lineas.1.horas").fill("3");
  await porId(page, "items.2.lineas.1.tarifa").fill("50");

  await page.getByRole("button", { name: "Agregar tercero" }).click();
  await porId(page, "items.2.lineas.2.costo").fill("100");
  await expect(page.getByRole("group", { name: /Línea 3: Tercero/ })).toBeVisible();
}

async function guardarItemsYComparar(page: Page): Promise<Totales> {
  await expect(page.getByLabel("Totales de cotización")).toBeVisible();
  const enEditor = await leerTotales(page);
  verificarAritmetica(enEditor);
  await page.getByRole("button", { name: "Guardar ítems" }).click();
  await expect(page).toHaveURL(/\/cotizaciones\/[0-9a-f-]{36}$/);
  const enDetalle = await leerTotales(page);
  expect(enDetalle).toEqual(enEditor);
  return enDetalle;
}

async function verificarItemsDelDetalle(page: Page): Promise<void> {
  const vinil = page.getByRole("row", { name: /Rótulo vinil adhesivo personalizado/ });
  await expect(vinil).toContainText("m²");
  await expect(vinil).toContainText("C$ 4,950.00");
  await expect(page.getByRole("row", { name: /Panel ACM con vinil/ })).toContainText("C$ 9,200.00");
  await expect(page.getByRole("row", { name: /Trabajo personalizado E2E/ }).first()).toBeVisible();
  await abrirPlegable(page, "Costos internos");
  await expect(page.getByText("Costos del ítem 3: Trabajo personalizado E2E")).toBeVisible();
}

async function enviarDesdeDetalle(page: Page): Promise<void> {
  await expect(page.getByText(/Siguiente paso:/).first()).toBeVisible();
  await page.getByRole("button", { name: "Enviar cotización" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText("Enviada", { exact: true })).toBeVisible();
  await expect(page.getByText(/Siguiente paso:/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar cotización" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Editar" })).toHaveCount(0);
}

test.describe("Atención al cliente cotiza y Operaciones aprueba", () => {
  test("Atención al cliente crea una cotización mixta, compara totales y la envía", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    test.setTimeout(120_000);
    const asunto = marcaE2E();
    await entrarComo(page, ATENCION_CLIENTE);

    await crearCabecera(page, asunto);
    await expect(page.getByRole("heading", { level: 1, name: /^Editar COT-/ })).toBeVisible();
    await agregarItemPorM2(page);
    await agregarItemPorUnidad(page);
    await agregarItemPersonalizado(page);
    const totales = await guardarItemsYComparar(page);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^COT-/);
    const numero = (await page.getByRole("heading", { level: 1 }).textContent()) ?? "";
    await expect(page.getByText(asunto, { exact: true })).toBeVisible();
    for (const plegable of PLEGABLES) {
      const detalle = page.locator("details").filter({ has: page.locator("summary", { hasText: plegable }) }).first();
      await expect(detalle).toHaveJSProperty("open", false);
    }
    await verificarItemsDelDetalle(page);
    await enviarDesdeDetalle(page);
    mixta = { id: page.url().split("/").pop() as string, numero, totales };
  });

  test("Operaciones exige la referencia y aprueba la cotización enviada con su versión", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    const { id } = datosMixta();
    const referencia = `OC-${marcaE2E()}`;
    await entrarComo(page, OPERACIONES);
    await page.goto(`/cotizaciones/${id}`);
    await expect(page.getByText("Enviada", { exact: true })).toBeVisible();
    await expect(page.getByText(/Siguiente paso:/).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Editar" })).toHaveCount(0);

    await page.getByRole("button", { name: "Aprobar", exact: true }).click();
    const dialogo = page.getByRole("dialog");
    const confirmar = dialogo.getByRole("button", { name: "Aprobar cotización" });
    const campo = dialogo.getByLabel("Referencia de aprobación");
    await expect(campo).toBeVisible();

    // Sin referencia, o con menos de 3 caracteres, la aprobación no se registra.
    for (const invalida of ["", "ab"]) {
      await campo.fill(invalida);
      if (await confirmar.isEnabled()) await confirmar.click();
      await expect(dialogo).toBeVisible();
    }

    await campo.fill(referencia);
    const peticion = page.waitForRequest((req) => req.url().includes(`/cotizaciones/${id}/responder`));
    await confirmar.click();
    const cuerpo = (await peticion).postDataJSON() as { version?: string; resultado?: string };
    expect(cuerpo.version).toBeTruthy();
    expect(cuerpo.resultado).toBe("APROBADA");
    expect(JSON.stringify(cuerpo)).toContain(referencia);

    await expect(page.getByText("Aprobada", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Aprobar", exact: true })).toHaveCount(0);
    expect(await leerTotales(page)).toEqual(datosMixta().totales);

    await abrirPlegable(page, "Condiciones y fechas");
    await expect(page.getByText(referencia).first()).toBeVisible();
    await expect(page.getByText(APROBADOR).first()).toBeVisible();
    await expect(page.getByText("Emisión").first()).toBeVisible();
    await expect(page.getByText("Vigencia").first()).toBeVisible();
    referenciaAprobacion = referencia;
  });

  test("Gerencia ve la aprobación y quién la registró sin botones de gestión", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    const { id } = datosMixta();
    const referencia = datosAprobacion();
    await entrarComo(page, GERENCIA);
    await page.goto(`/cotizaciones/${id}`);
    await expect(page.getByText("Aprobada", { exact: true })).toBeVisible();
    await abrirPlegable(page, "Condiciones y fechas");
    await expect(page.getByText(referencia).first()).toBeVisible();
    await expect(page.getByText(APROBADOR).first()).toBeVisible();
    for (const nombre of ["Aprobar", "Solicitar ajustes", "Crear versión corregida", "Editar"]) {
      await expect(page.getByRole("button", { name: nombre, exact: true })).toHaveCount(0);
      await expect(page.getByRole("link", { name: nombre, exact: true })).toHaveCount(0);
    }

    const respuesta = await page.request.post(`/api/v1/cotizaciones/${id}/responder`, {
      headers: { Origin: BASE },
      data: { version: new Date().toISOString(), resultado: "APROBADA", referencia: "E2E-sin-permiso" },
    });
    expect(respuesta.status()).toBe(403);
  });

  test("la vista de impresión muestra el número y el total", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    const { id, numero, totales } = datosMixta();
    await entrarComo(page, ATENCION_CLIENTE);
    await page.goto(`/cotizaciones/${id}/imprimir`);
    await expect(page.getByRole("heading", { level: 1, name: "Proforma imprimible" })).toBeVisible();
    const proforma = page.locator("#proforma");
    await expect(proforma).toContainText(`Proforma ${numero}`);
    const total = totales.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    await expect(proforma).toContainText(`C$ ${total}`);
    await expect(proforma).toContainText(CLIENTE_SEMBRADO);
  });
});

async function crearBorradorPorApi(page: Page): Promise<Cotizacion> {
  const origen = datosMixta().id;
  const respuesta = await page.request.post(`/api/v1/cotizaciones/${origen}/duplicar`, { headers: { Origin: BASE }, data: {} });
  expect(respuesta.status()).toBe(201);
  const borrador = (await respuesta.json()).datos as Cotizacion & { estado: string };
  expect(borrador.estado).toBe("BORRADOR");
  return borrador;
}

test.describe("Ajustes solicitados y versión corregida", () => {
  test("Atención al cliente solicita ajustes con motivo a una cotización enviada", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    test.setTimeout(90_000);
    await entrarComo(page, ATENCION_CLIENTE);
    const borrador = await crearBorradorPorApi(page);
    await page.goto(`/cotizaciones/${borrador.id}`);
    await enviarDesdeDetalle(page);

    const motivo = `Ajustar medidas ${marcaE2E()}`;
    await page.getByRole("button", { name: "Solicitar ajustes" }).click();
    const dialogo = page.getByRole("dialog");
    const confirmar = dialogo.getByRole("button", { name: "Solicitar ajustes" });
    const campo = dialogo.getByLabel(/Motivo/);

    // Con menos de 3 caracteres el motivo no se registra.
    await campo.fill("ab");
    if (await confirmar.isEnabled()) await confirmar.click();
    await expect(dialogo).toBeVisible();

    await campo.fill(motivo);
    await confirmar.click();
    await expect(page.getByText("Ajustes solicitados", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Solicitar ajustes" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Aprobar", exact: true })).toHaveCount(0);
    await abrirPlegable(page, "Condiciones y fechas");
    await expect(page.getByText(motivo).first()).toBeVisible();
    conAjustes = { id: borrador.id };
  });

  test("Atención al cliente crea la versión corregida (Versión 2) como borrador", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    test.setTimeout(90_000);
    const { id } = datosConAjustes();
    await entrarComo(page, ATENCION_CLIENTE);
    await page.goto(`/cotizaciones/${id}`);
    await expect(page.getByText("Ajustes solicitados", { exact: true })).toBeVisible();
    await expect(page.getByText(/Siguiente paso:/).first()).toBeVisible();

    await page.getByRole("button", { name: "Crear versión corregida" }).click();
    await page.getByRole("dialog").getByRole("button", { name: /^Crear versión/ }).click();
    await expect.poll(() => page.url().match(/cotizaciones\/([0-9a-f-]{36})/)?.[1]).not.toBe(id);
    const nuevoId = page.url().match(/cotizaciones\/([0-9a-f-]{36})/)?.[1] as string;
    expect(nuevoId).toMatch(/^[0-9a-f-]{36}$/);

    await page.goto(`/cotizaciones/${nuevoId}`);
    await expect(page.getByText(/Versión 2/).first()).toBeVisible();
    await expect(page.getByText("Borrador", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Editar" })).toBeVisible();
  });
});

test.describe("Lista, borradores y permisos", () => {
  test("la lista no muestra las columnas Asunto ni Emisión y la fila enlaza a la ficha", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    await entrarComo(page, ATENCION_CLIENTE);
    await page.goto("/cotizaciones");
    await expect(page.getByRole("region", { name: "Listado de cotizaciones" })).toBeVisible();
    for (const columna of ["Asunto", "Emisión"]) {
      await expect(page.getByRole("columnheader", { name: columna })).toHaveCount(0);
    }
    await expect(page.getByRole("link", { name: /COT-/ }).first()).toHaveAttribute("href", /\/cotizaciones\/[0-9a-f-]{36}$/);
  });

  test("Atención al cliente duplica un borrador y la copia es otro borrador", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    await entrarComo(page, ATENCION_CLIENTE);
    const borrador = await crearBorradorPorApi(page);

    await page.goto(`/cotizaciones/${borrador.id}`);
    await expect(page.getByText("Borrador", { exact: true })).toBeVisible();
    await expect(page.getByText(/Siguiente paso:/).first()).toBeVisible();
    await page.getByRole("button", { name: "Duplicar" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Duplicar" }).click();
    await expect(page).toHaveURL(/\/cotizaciones\/[0-9a-f-]{36}\/editar$/);
    const idCopia = page.url().split("/").slice(-2)[0];
    expect(idCopia).not.toBe(borrador.id);

    await page.goto(`/cotizaciones/${idCopia}`);
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(borrador.numero);
    await expect(page.getByText("Borrador", { exact: true })).toBeVisible();
    await abrirPlegable(page, "Condiciones y fechas");
    await expect(page.getByRole("link", { name: "Ver cotización original" })).toHaveAttribute("href", `/cotizaciones/${borrador.id}`);
    await expect(page.getByRole("link", { name: "Editar" })).toBeVisible();
  });

  test("Gerencia no ve Nueva cotización ni Editar", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    await entrarComo(page, ATENCION_CLIENTE);
    const borrador = await crearBorradorPorApi(page);
    await page.context().clearCookies();

    await entrarComo(page, GERENCIA);
    await page.goto("/cotizaciones");
    await expect(page.getByRole("heading", { level: 1, name: "Cotizaciones" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Nueva cotización" })).toHaveCount(0);

    await page.goto(`/cotizaciones/${borrador.id}`);
    await expect(page.getByText("Borrador", { exact: true })).toBeVisible();
    for (const nombre of ["Editar", "Duplicar", "Archivar", "Enviar cotización"]) {
      await expect(page.getByRole("link", { name: nombre })).toHaveCount(0);
      await expect(page.getByRole("button", { name: nombre })).toHaveCount(0);
    }
    await expect(page.getByRole("link", { name: "Ver proforma" })).toBeVisible();

    await page.goto("/cotizaciones/nueva");
    await expect(page).toHaveURL(/\/sin-acceso$/);
    await page.goto(`/cotizaciones/${borrador.id}/editar`);
    await expect(page).toHaveURL(/\/sin-acceso$/);
  });

  for (const perfil of [PRODUCCION, ADMIN]) {
    test(`${perfil.codigo} termina en sin-acceso al abrir cotizaciones`, async ({ page }, info) => {
      soloUnaVez(info.project.name);
      await entrarComo(page, perfil);
      await page.goto("/cotizaciones");
      await expect(page).toHaveURL(/\/sin-acceso$/);
      await expect(page.getByText("No tiene permiso para ver esta sección")).toBeVisible();
      await page.goto(`/cotizaciones/${datosMixta().id}`);
      await expect(page).toHaveURL(/\/sin-acceso$/);
    });
  }
});

test.describe("Accesibilidad (axe)", () => {
  for (const vista of VIEWPORTS) {
    test(`lista, editor y detalle sin violaciones graves en ${vista.nombre} (${vista.width} px)`, async ({ page }, info) => {
      soloUnaVez(info.project.name);
      test.setTimeout(120_000);
      await page.setViewportSize({ width: vista.width, height: vista.height });
      await entrarComo(page, ATENCION_CLIENTE);

      await page.goto("/cotizaciones");
      await expect(page.getByRole("region", { name: "Listado de cotizaciones" })).toBeVisible();
      expect(await violacionesGraves(page), "lista").toEqual([]);

      const borrador = await crearBorradorPorApi(page);
      await page.goto(`/cotizaciones/${borrador.id}/editar`);
      await expect(page.getByRole("button", { name: "Guardar ítems" })).toBeEnabled();
      await expect(page.getByRole("heading", { level: 2, name: "Ítem 3: Personalizado" })).toBeVisible();
      expect(await violacionesGraves(page), "editor").toEqual([]);

      await page.goto(`/cotizaciones/${datosMixta().id}`);
      await expect(page.getByLabel("Totales de cotización")).toBeVisible();
      expect(await violacionesGraves(page), "detalle").toEqual([]);
      for (const plegable of PLEGABLES) await abrirPlegable(page, plegable);
      expect(await violacionesGraves(page), "detalle con secciones abiertas").toEqual([]);
    });
  }
});

async function capturar(page: Page, archivo: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(CARPETA_CAPTURAS, archivo), fullPage: true });
}

test.describe("CF-10: capturas de la cotización mixta aprobada", () => {
  for (const perfil of [ATENCION_CLIENTE, GERENCIA]) {
    test(`detalle visto por ${perfil.codigo} en los 4 anchos`, async ({ page }, info) => {
      soloUnaVez(info.project.name);
      test.setTimeout(120_000);
      fs.mkdirSync(CARPETA_CAPTURAS, { recursive: true });
      await entrarComo(page, perfil);
      await page.goto(`/cotizaciones/${datosMixta().id}`);
      await expect(page.getByText("Aprobada", { exact: true })).toBeVisible();
      // Abrir con script evita que el clic desplace el contenedor y deje el encabezado fuera de la captura.
      await page.evaluate(() => document.querySelectorAll("details").forEach((detalle) => { detalle.open = true; }));
      await expect(page.getByRole("row", { name: /Servicio de tercero/ })).toBeVisible();
      for (const vista of VIEWPORTS) {
        await page.setViewportSize({ width: vista.width, height: vista.height });
        await expect(page.getByLabel("Totales de cotización")).toBeVisible();
        await capturar(page, `CF-10-${perfil.codigo.toLowerCase()}-${vista.nombre}.png`);
      }
    });
  }

  test("editor de la cotización mixta", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    fs.mkdirSync(CARPETA_CAPTURAS, { recursive: true });
    await entrarComo(page, ATENCION_CLIENTE);
    const borrador = await crearBorradorPorApi(page);
    await page.goto(`/cotizaciones/${borrador.id}/editar`);
    await expect(page.getByRole("heading", { level: 2, name: "Ítem 3: Personalizado" })).toBeVisible();
    await expect(page.getByLabel("Totales de cotización")).toBeVisible();
    await capturar(page, "CF-10-editor-ventas-portatil.png");
  });
});
