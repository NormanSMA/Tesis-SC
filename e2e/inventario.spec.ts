import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

import { PERFILES, VIEWPORTS, iniciarSesion, sinDesbordeHorizontal, violacionesGraves } from "./ayudas";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const ORIGIN = new URL(BASE).origin;
const CAPTURAS = path.join("docs", "capturas", "inventario");
const SELLO = Date.now();
const MARCA = `E2E-${SELLO}-inventario-${Math.floor(Math.random() * 100000)}`;
// El prefijo evita limpiar materiales ajenos y mantiene códigos menores de 30 caracteres.
const PREFIJO_CODIGO = `E2E-${randomUUID().replaceAll("-", "").slice(0, 12)}-`.toUpperCase();
const NOMBRE = `${MARCA} material`;
const UNIDAD = "PLIEGO";
// La ficha muestra la unidad legible en minúscula, con espacio duro tras la cifra.
const UNIDAD_FICHA = "pliego";
type Perfil = (typeof PERFILES)[number];
type Material = { id: string; codigo: string; activo: boolean; existencia: string; actualizadoEn: string };
const PERFIL = (codigo: string) => PERFILES.find((perfil) => perfil.codigo === codigo)!;
const ADMINISTRACION = PERFIL("ADMINISTRACION");
const ATENCION_CLIENTE = PERFIL("ATENCION_CLIENTE");
const GERENCIA = PERFIL("GERENCIA");
const OPERACIONES = PERFIL("OPERACIONES");
const PRODUCCION = PERFIL("PRODUCCION");
const ADMIN = PERFIL("ADMIN");

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

function exacto(texto: string): RegExp {
  return new RegExp(`^${texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
}

async function abrir(page: Page, ruta: string, nombre: string): Promise<void> {
  await page.goto(ruta);
  await esperarFormulario(formulario(page, nombre));
}

async function esperarFormulario(form: Locator): Promise<void> {
  await expect(form).toBeVisible();
  await expect(form.locator("fieldset")).toBeEnabled();
  await expect(form.getByRole("button", { name: /^(Guardar material|Registrar entrada|Registrar ajuste)$/ })).toBeEnabled();
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

function libro(page: Page): Locator {
  return page.getByRole("table", { name: "Libro de movimientos del inventario" });
}

function listaMateriales(page: Page): Locator {
  return page.getByRole("region", { name: "Materiales del inventario" });
}

async function crearMaterial(page: Page): Promise<Material> {
  const codigo = `${PREFIJO_CODIGO}${randomUUID().replaceAll("-", "").slice(0, 12)}`.toUpperCase();
  await entrarComo(page, ADMINISTRACION);
  await abrir(page, "/inventario/nuevo", "Crear material");
  const form = formulario(page, "Crear material");
  await form.getByLabel("Código").fill(codigo);
  await form.getByLabel("Nombre").fill(NOMBRE);
  await form.getByLabel("Unidad").selectOption(UNIDAD);
  // El mínimo supera la existencia que alcanzará la prueba: así la alerta es esperable.
  await form.getByLabel("Stock mínimo").fill("100");
  await form.getByLabel("Costo promedio (C$)").fill("5");
  const creada = page.waitForResponse((r) => r.url().endsWith("/api/v1/materiales") && r.request().method() === "POST");
  await form.getByRole("button", { name: "Guardar material" }).click();
  const respuesta = await creada;
  expect(respuesta.status(), await respuesta.text()).toBe(201);
  const material = (await respuesta.json()).datos as Material;
  await expect(page).toHaveURL(/\/inventario$/);
  return material;
}

async function verFicha(page: Page, material: Material, esperado: { existencia: string; costo: string }): Promise<void> {
  await page.goto(`/inventario/${material.id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(NOMBRE);
  await expect(page.getByRole("definition").filter({ hasText: exacto(`${esperado.existencia} ${UNIDAD_FICHA}`) })).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: exacto(esperado.costo) })).toBeVisible();
}

async function registrarEntrada(page: Page, material: Material, entrada: { cantidad: string; costo: string; referencia: string }): Promise<void> {
  await page.goto(`/inventario/${material.id}`);
  await page.getByRole("link", { name: "Registrar entrada", exact: true }).click();
  const form = formulario(page, "Registrar entrada");
  await esperarFormulario(form);
  await form.getByLabel("Cantidad").fill(entrada.cantidad);
  await form.getByLabel("Costo unitario (C$)").fill(entrada.costo);
  await form.getByLabel("Referencia").fill(entrada.referencia);
  const enviada = page.waitForResponse((r) => r.url().endsWith("/api/v1/inventario/entradas") && r.request().method() === "POST");
  await form.getByRole("button", { name: "Registrar entrada" }).click();
  const respuesta = await enviada;
  expect(respuesta.status(), await respuesta.text()).toBe(201);
  await expect(page.getByText("Registro guardado").first()).toBeVisible();
}

async function leerFicha(page: Page, material: Material): Promise<Material> {
  const respuesta = await page.request.get(`/api/v1/materiales/${material.id}`);
  expect(respuesta.status()).toBe(200);
  return (await respuesta.json()).datos as Material;
}

async function ajustarACero(page: Page, material: Material): Promise<void> {
  const { existencia } = await leerFicha(page, material);
  await abrir(page, `/inventario/ajuste?materialId=${material.id}`, "Ajustar inventario");
  const form = formulario(page, "Ajustar inventario");
  await form.getByLabel("Dirección").selectOption("DISMINUIR");
  await form.getByLabel("Cantidad").fill(existencia);
  await form.getByLabel("Motivo").fill(`${MARCA}-limpieza de existencia`);
  const enviada = page.waitForResponse((r) => r.url().endsWith("/api/v1/inventario/ajustes") && r.request().method() === "POST");
  await form.getByRole("button", { name: "Registrar ajuste" }).click();
  const respuesta = await enviada;
  expect(respuesta.status(), await respuesta.text()).toBe(201);
  await expect(page.getByText("Registro guardado").first()).toBeVisible();
}

async function archivarDesdeFicha(page: Page, material: Material): Promise<void> {
  await page.goto(`/inventario/${material.id}`);
  await page.getByRole("button", { name: "Archivar", exact: true }).click();
  const enviada = page.waitForResponse((r) => r.url().endsWith("/archivar") && r.request().method() === "POST");
  await page.getByRole("dialog").getByRole("button", { name: "Archivar", exact: true }).click();
  await enviada;
}

async function archivarYVaciar(page: Page): Promise<void> {
  await entrarComo(page, ADMINISTRACION);
  const lista = await page.request.get(`/api/v1/materiales?q=${PREFIJO_CODIGO}&activo=todos&porPagina=100`);
  expect(lista.status()).toBe(200);
  for (const fila of ((await lista.json()).datos as Material[]).filter((fila) => fila.codigo.startsWith(PREFIJO_CODIGO) && fila.activo)) {
    const ficha = await leerFicha(page, fila);
    if (Number(ficha.existencia) > 0) {
      const ajuste = await page.request.post("/api/v1/inventario/ajustes", {
        headers: { Origin: ORIGIN, "Idempotency-Key": randomUUID() },
        data: { materialId: fila.id, direccion: "DISMINUIR", cantidad: ficha.existencia, motivo: `${MARCA}-limpieza` },
      });
      expect(ajuste.status(), await ajuste.text()).toBe(201);
    }
    const vigente = await leerFicha(page, fila);
    const archivada = await page.request.post(`/api/v1/materiales/${fila.id}/archivar`, {
      headers: { Origin: ORIGIN }, data: { version: vigente.actualizadoEn },
    });
    expect(archivada.status(), await archivada.text()).toBe(200);
  }
}

async function limpiarCreadas(browser: Browser): Promise<void> {
  const contexto = await browser.newContext({ baseURL: BASE });
  try { await archivarYVaciar(await contexto.newPage()); } finally { await contexto.close(); }
}

async function sembradoConMovimientos(page: Page): Promise<string> {
  for (let pagina = 1; pagina <= 5; pagina += 1) {
    const respuesta = await page.request.get(`/api/v1/movimientos?porPagina=100&pagina=${pagina}`);
    expect(respuesta.status()).toBe(200);
    const filas = (await respuesta.json()).datos as { material: { id: string; codigo: string } }[];
    const fila = filas.find((candidata) => !candidata.material.codigo.startsWith("E2E-"));
    if (fila) return fila.material.id;
  }
  throw new Error("Debe existir un material sembrado con movimientos.");
}

async function capturar(page: Page, captura: { ruta: string; listo: Locator; archivo: string }): Promise<void> {
  await page.goto(captura.ruta);
  await expect(captura.listo).toBeVisible();
  await expect(page.getByRole("main")).toContainText(/Conciliado|En alerta/);
  await sinDesbordeHorizontal(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(CAPTURAS, captura.archivo), fullPage: true });
}

async function capturarTodo(page: Page): Promise<void> {
  fs.mkdirSync(CAPTURAS, { recursive: true });
  await entrarComo(page, GERENCIA);
  const sembrado = await sembradoConMovimientos(page);
  for (const vista of VIEWPORTS) {
    await page.setViewportSize({ width: vista.width, height: vista.height });
    await capturar(page, { ruta: "/inventario?bajoMinimo=true", archivo: `CF-04-lista-${vista.nombre}.png`, listo: listaMateriales(page) });
    await capturar(page, { ruta: `/inventario/${sembrado}`, archivo: `CF-04-ficha-${vista.nombre}.png`, listo: libro(page) });
  }
}

function registrarAxe(): void {
  for (const vista of VIEWPORTS.filter((candidata) => ["portatil", "tableta"].includes(candidata.nombre))) {
    test(`lista y ficha de inventario pasan axe en ${vista.nombre}`, async ({ page }, info) => {
      soloPortatil(info.project.name);
      test.setTimeout(120000);
      await page.setViewportSize({ width: vista.width, height: vista.height });
      const material = await crearMaterial(page);
      // Sin movimientos la ficha muestra el estado vacío y no la tabla del libro.
      await registrarEntrada(page, material, { cantidad: "10", costo: "10", referencia: `${MARCA}-FAC-axe-${vista.nombre}` });
      await page.goto("/inventario");
      await expect(listaMateriales(page)).toBeVisible();
      expect.soft(await violacionesGraves(page), "lista").toEqual([]);
      await page.goto(`/inventario/${material.id}`);
      await expect(libro(page)).toBeVisible();
      expect.soft(await violacionesGraves(page), "ficha").toEqual([]);
    });
  }
}

test.describe("Inventario con un material propio", () => {
  test.afterAll(async ({ browser }, info) => {
    if (info.project.name === "portatil") await limpiarCreadas(browser);
  });

  test("Administración crea un material y lo ve con existencia cero", async ({ page }, info) => {
    soloPortatil(info.project.name);
    const material = await crearMaterial(page);
    await verFicha(page, material, { existencia: "0", costo: "5.0000" });
    await expect(page.getByRole("main")).toContainText("Sin existencia");
  });

  test("Administración registra una entrada y ve existencia, alerta, libro y conciliación", async ({ page }, info) => {
    soloPortatil(info.project.name);
    test.setTimeout(90000);
    const material = await crearMaterial(page);
    await registrarEntrada(page, material, { cantidad: "10", costo: "10", referencia: `${MARCA}-FAC-1` });
    await verFicha(page, material, { existencia: "10", costo: "10.0000" });
    await expect(page.getByRole("status").filter({ hasText: /^Bajo mínimo$/ })).toBeVisible();
    // El libro vive en una sección details abierta con el total de registros.
    await expect(page.getByRole("heading", { level: 2, name: "Movimientos", exact: true })).toBeVisible();
    await expect(page.getByText(/^\(\d+ registros?\)$/)).toBeVisible();
    await expect(page.locator("details[open]").filter({ has: libro(page) })).toHaveCount(1);
    await expect(filaLibro(page, "ENTRADA")).toContainText(`${MARCA}-FAC-1`);
    await expect(filaLibro(page, "ENTRADA")).toContainText("Unitario: 10.0000");
    await expect(page.getByRole("main")).toContainText("Conciliado");
  });

  test("una segunda entrada con otro costo cambia el costo promedio ponderado", async ({ page }, info) => {
    soloPortatil(info.project.name);
    test.setTimeout(90000);
    const material = await crearMaterial(page);
    await registrarEntrada(page, material, { cantidad: "10", costo: "10", referencia: `${MARCA}-FAC-1` });
    await registrarEntrada(page, material, { cantidad: "3", costo: "20", referencia: `${MARCA}-FAC-2` });
    // (10 x 10 + 3 x 20) / 13 = 12.30769...
    await verFicha(page, material, { existencia: "13", costo: "12.3077" });
    await expect(filaLibro(page, "ENTRADA")).toHaveCount(2);
    await expect(page.getByRole("main")).toContainText("Conciliado");
  });

  registrarAxe();

  test("capturas CF-04 de la lista y la ficha con Gerencia", async ({ page }, info) => {
    soloPortatil(info.project.name);
    test.setTimeout(150000);
    await capturarTodo(page);
  });

  test("Administración no archiva con existencia, ajusta a cero, archiva y el material sale de la lista", async ({ page }, info) => {
    soloPortatil(info.project.name);
    test.setTimeout(120000);
    const material = await crearMaterial(page);
    await registrarEntrada(page, material, { cantidad: "13", costo: "10", referencia: `${MARCA}-FAC-archivo` });
    await archivarDesdeFicha(page, material);
    await expect(page.getByText("El material tiene existencia").first()).toBeVisible();
    await page.keyboard.press("Escape");
    // Con 13 unidades y mínimo 100 el estado es "Bajo mínimo"; el material sigue activo.
    await expect(page.getByText("Archivado", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Bajo mínimo", { exact: true }).first()).toBeVisible();
    await ajustarACero(page, material);
    await page.goto(`/inventario/${material.id}`);
    await expect(page.getByRole("definition").filter({ hasText: exacto(`0 ${UNIDAD_FICHA}`) })).toBeVisible();
    await expect(filaLibro(page, "AJUSTE")).toContainText(`${MARCA}-limpieza de existencia`);
    await archivarDesdeFicha(page, material);
    await expect(page.getByText("Archivado", { exact: true })).toBeVisible();
    await page.goto(`/inventario?q=${material.codigo}`);
    await expect(page.getByRole("main").getByText("Sin resultados", { exact: true })).toBeVisible();
    await page.goto(`/inventario?q=${material.codigo}&activo=false`);
    await expect(page.getByRole("link", { name: NOMBRE })).toBeVisible();
  });
});

// El código va bajo el nombre y el mínimo en la barra de existencia: tres columnas.
const COLUMNAS_LISTA = ["Material", "Existencia frente al mínimo", "Estado"];

test("Gerencia y Operaciones consultan inventario sin acciones de gestión", async ({ page }) => {
  for (const perfil of [GERENCIA, OPERACIONES]) {
    await entrarComo(page, perfil);
    await page.goto("/inventario");
    await expect(listaMateriales(page)).toBeVisible();
    await expect(page.getByRole("link", { name: /^(Nuevo material|Registrar entrada|Ajustar)$/ })).toHaveCount(0);
    await page.goto(`/inventario/${await sembradoConMovimientos(page)}`);
    await expect(libro(page)).toBeVisible();
    await expect(page.getByRole("link", { name: /^(Registrar entrada|Ajustar|Editar)$/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^(Archivar|Reactivar)$/ })).toHaveCount(0);
    await expect(page.getByRole("main")).toContainText("Conciliado");
    for (const ruta of ["/inventario/nuevo", "/inventario/ajuste"]) {
      await page.goto(ruta);
      await expect(page).toHaveURL(/\/sin-acceso$/);
    }
  }
});

test("Administración gestiona, registra entradas y ajusta", async ({ page }) => {
  await entrarComo(page, ADMINISTRACION);
  await page.goto("/inventario");
  await expect(page.getByRole("link", { name: "Nuevo material", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Registrar entrada", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ajustar", exact: true })).toBeVisible();
  await page.goto(`/inventario/${await sembradoConMovimientos(page)}`);
  await expect(page.getByRole("link", { name: "Ajustar", exact: true })).toBeVisible();
  await abrir(page, "/inventario/ajuste", "Ajustar inventario");
  await expect(formulario(page, "Ajustar inventario")).toBeVisible();
});

test("la lista de materiales tiene tres columnas y el costo promedio queda en la ficha", async ({ page }) => {
  await entrarComo(page, ADMINISTRACION);
  await page.goto("/inventario");
  await expect(listaMateriales(page)).toBeVisible();
  for (const nombre of COLUMNAS_LISTA) {
    await expect(listaMateriales(page).getByRole("columnheader", { name: nombre, exact: true })).toBeVisible();
  }
  await expect(listaMateriales(page).getByRole("columnheader", { name: "Costo promedio (C$)" })).toHaveCount(0);
  await expect(listaMateriales(page).getByText(/^(Activo|Stock bajo)$/)).toHaveCount(0);
  await page.goto(`/inventario/${await sembradoConMovimientos(page)}`);
  await expect(page.getByText("Costo promedio (C$)").first()).toBeVisible();
});

test("Atención al cliente y Producción no ven inventario y terminan en sin-acceso", async ({ page }) => {
  for (const perfil of [ATENCION_CLIENTE, PRODUCCION]) {
    await entrarComo(page, perfil);
    for (const ruta of ["/inventario", "/inventario/nuevo", "/inventario/ajuste"]) {
      await page.goto(ruta);
      await expect(page).toHaveURL(/\/sin-acceso$/);
    }
    expect((await page.request.get("/api/v1/materiales")).status()).toBe(403);
  }
});

test("ADMIN (administración técnica) termina en sin-acceso al abrir inventario", async ({ page }) => {
  await entrarComo(page, ADMIN);
  await page.goto("/inventario");
  await expect(page).toHaveURL(/\/sin-acceso$/);
});

test("lista y ficha de inventario no desbordan horizontalmente en el tamaño del proyecto", async ({ page }, info) => {
  const vista = VIEWPORTS.find((candidata) => candidata.nombre === info.project.name)!;
  await page.setViewportSize({ width: vista.width, height: vista.height });
  await entrarComo(page, GERENCIA);
  await page.goto("/inventario");
  await expect(listaMateriales(page)).toBeVisible();
  await sinDesbordeHorizontal(page);
  await page.goto(`/inventario/${await sembradoConMovimientos(page)}`);
  await expect(libro(page)).toBeVisible();
  await sinDesbordeHorizontal(page);
});
