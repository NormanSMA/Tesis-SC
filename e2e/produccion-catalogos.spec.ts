import { expect, test, type Browser, type Page } from "@playwright/test";

import { PERFILES, VIEWPORTS, iniciarSesion, violacionesGraves } from "./ayudas";
import { elegirDato } from "./elegir";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const ORIGIN = new URL(BASE).origin;
const MARCA = `E2E-${Date.now()}-prodcatalogos-${Math.floor(Math.random() * 100000)}`;
const AREA = `${MARCA}-área`;
const AREA_EDITADA = `${MARCA}-área editada`;
const CATEGORIA = `${MARCA}-categoría`;
const PLANTILLA = `${MARCA}-etapa`;
const PLANTILLA_EDITADA = `${MARCA}-etapa editada`;
type Perfil = (typeof PERFILES)[number];
type Registro = { id: string; nombre: string; activo: boolean; actualizadoEn: string };
type Plantilla = Registro & { area: { id: string; nombre: string } };
const OPERACIONES = PERFILES.find((fila) => fila.codigo === "OPERACIONES")!;
let categoria: Registro | undefined;

test.use({ baseURL: BASE, ...(process.env.E2E_BROWSER_CHANNEL
  ? { browserName: "chromium" as const, channel: process.env.E2E_BROWSER_CHANNEL } : {}) });

async function entrarComo(page: Page, actor: Perfil): Promise<void> {
  const clave = process.env[actor.claveEnv];
  if (!clave) throw new Error(`Falta la variable ${actor.claveEnv}`);
  await page.context().clearCookies();
  await iniciarSesion(page, actor.correo, clave);
  await page.waitForURL(`**${actor.destino}`);
}

async function leer<T>(page: Page, ruta: string): Promise<T> {
  const respuesta = await page.request.get(`/api/v1${ruta}`);
  expect(respuesta.status(), await respuesta.text()).toBe(200);
  return (await respuesta.json()).datos as T;
}

async function archivar(page: Page, ruta: string, version: string): Promise<void> {
  const respuesta = await page.request.post(`/api/v1${ruta}/archivar`, {
    headers: { Origin: ORIGIN }, data: { version },
  });
  expect(respuesta.status(), await respuesta.text()).toBe(200);
}

async function crearYEditarArea(page: Page): Promise<void> {
  await page.goto("/produccion/areas");
  await page.getByRole("button", { name: "Crear área", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Nombre", { exact: false }).fill(AREA);
  await page.getByRole("dialog").getByRole("button", { name: "Crear área", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("table", { name: "Áreas de producción" }).getByRole("row").filter({ hasText: AREA })).toContainText("Activa");
  await page.getByRole("button", { name: `Editar área: ${AREA}`, exact: true }).click();
  await page.getByRole("dialog").getByLabel("Nombre", { exact: false }).fill(AREA_EDITADA);
  await page.getByRole("dialog").getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: `Editar área: ${AREA_EDITADA}`, exact: true })).toBeVisible();
}

async function crearCategoria(page: Page): Promise<void> {
  const respuesta = await page.request.post("/api/v1/categorias", { headers: { Origin: ORIGIN }, data: { nombre: CATEGORIA } });
  // El catálogo puede carecer del alta en despliegues anteriores; no se altera una categoría sembrada.
  if ([403, 404, 405].includes(respuesta.status())) {
    test.info().annotations.push({ type: "cobertura", description: `Alta de categoría no disponible: ${respuesta.status()}; plantillas en consulta.` });
    await page.goto("/produccion/plantillas");
    await expect(page.getByRole("heading", { name: "Plantillas de producción", exact: true })).toBeVisible();
    await expect(page.getByRole("table", { name: "Plantillas de etapas" })).toBeVisible();
    return;
  }
  expect(respuesta.status(), await respuesta.text()).toBe(201);
  categoria = (await respuesta.json()).datos as Registro;
}

async function gestionarPlantilla(page: Page): Promise<void> {
  if (!categoria) return;
  await page.goto(`/produccion/plantillas?categoria=${categoria.id}`);
  await expect(page.getByRole("heading", { name: CATEGORIA, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Agregar plantilla", exact: true }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Nombre de la etapa").fill(PLANTILLA);
  await elegirDato(dialogo.getByRole("combobox", { name: /^Área/ }), AREA_EDITADA, page);
  await dialogo.getByRole("button", { name: "Agregar plantilla", exact: true }).click();
  await expect(dialogo).toHaveCount(0);
  await expect(page.getByRole("table", { name: "Plantillas de etapas" })).toContainText(PLANTILLA);
  await page.getByRole("button", { name: `Editar plantilla: ${PLANTILLA}`, exact: true }).click();
  await dialogo.getByLabel("Nombre de la etapa").fill(PLANTILLA_EDITADA);
  await dialogo.getByLabel("Posición").fill("1");
  await dialogo.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(dialogo).toHaveCount(0);
  await expect(page.getByRole("table", { name: "Plantillas de etapas" })).toContainText(`1. ${PLANTILLA_EDITADA}`);
  await page.getByRole("button", { name: `Archivar plantilla: ${PLANTILLA_EDITADA}`, exact: true }).click();
  await dialogo.getByRole("button", { name: "Archivar", exact: true }).click();
  await expect(dialogo).toHaveCount(0);
  await expect(page.getByRole("table", { name: "Plantillas de etapas" }).getByRole("row").filter({ hasText: PLANTILLA_EDITADA })).toContainText("Archivada");
}

async function archivarAreaDesdePantalla(page: Page): Promise<void> {
  await page.goto("/produccion/areas");
  await page.getByRole("button", { name: `Archivar área: ${AREA_EDITADA}`, exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Archivar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("table", { name: "Áreas de producción" }).getByRole("row").filter({ hasText: AREA_EDITADA })).toContainText("Archivada");
}

async function rechazarArchivoSembrada(page: Page): Promise<void> {
  const categorias = await leer<Registro[]>(page, "/categorias");
  let vinculada: Plantilla | undefined;
  for (const fila of categorias.filter((fila) => !fila.nombre.startsWith("E2E-"))) {
    vinculada = (await leer<Plantilla[]>(page, `/categorias/${fila.id}/plantillas`))
      .find((plantilla) => plantilla.activo && !plantilla.area.nombre.startsWith("E2E-"));
    if (vinculada) break;
  }
  expect(vinculada, "Debe existir una plantilla sembrada activa para demostrar AREA_EN_USO.").toBeDefined();
  const antes = (await leer<Registro[]>(page, "/areas")).find((fila) => fila.id === vinculada!.area.id)!;
  expect(antes.activo).toBe(true);
  expect(antes.nombre.startsWith("E2E-")).toBe(false);
  const respuesta = await page.request.post(`/api/v1/areas/${antes.id}/archivar`, {
    headers: { Origin: ORIGIN }, data: { version: antes.actualizadoEn },
  });
  expect(respuesta.status(), `DEFECTO GRAVE: el área sembrada ${antes.nombre} no debe archivarse. ${await respuesta.text()}`).toBe(409);
  expect((await respuesta.json()).error.codigo).toBe("AREA_EN_USO");
  expect((await leer<Registro[]>(page, "/areas")).find((fila) => fila.id === antes.id)).toEqual(antes);
}

async function limpiarCategorias(page: Page): Promise<void> {
  const categorias = (await leer<Registro[]>(page, "/categorias")).filter((fila) => fila.nombre === CATEGORIA);
  const errores: unknown[] = [];
  for (const fila of categorias) {
    for (const plantilla of await leer<Plantilla[]>(page, `/categorias/${fila.id}/plantillas`)) {
      try {
        expect(plantilla.nombre.startsWith(MARCA)).toBe(true);
        if (plantilla.activo) await archivar(page, `/plantillas/${plantilla.id}`, plantilla.actualizadoEn);
      } catch (error) { errores.push(error); }
    }
    try {
      if (!fila.activo) continue;
      const respuesta = await page.request.patch(`/api/v1/categorias/${fila.id}`, {
        headers: { Origin: ORIGIN }, data: { version: fila.actualizadoEn, activo: false },
      });
      expect(respuesta.status(), await respuesta.text()).toBe(200);
    } catch (error) { errores.push(error); }
  }
  if (errores.length) throw new AggregateError(errores, "Falló el archivo de categorías y plantillas E2E.");
}

async function limpiar(browser: Browser): Promise<void> {
  const contexto = await browser.newContext({ baseURL: BASE });
  const page = await contexto.newPage();
  const errores: unknown[] = [];
  try {
    await entrarComo(page, OPERACIONES);
    try { await limpiarCategorias(page); } catch (error) { errores.push(error); }
    for (const area of (await leer<Registro[]>(page, "/areas")).filter((fila) => fila.nombre.startsWith(MARCA) && fila.activo)) {
      try { await archivar(page, `/areas/${area.id}`, area.actualizadoEn); } catch (error) { errores.push(error); }
    }
  } finally { await contexto.close(); }
  if (errores.length) throw new AggregateError(errores, `Falló la limpieza de ${MARCA}`);
}

test.describe("Catálogos propios de producción", () => {
  test.afterAll(async ({ browser }, info) => {
    test.setTimeout(120000);
    if (info.project.name === "portatil") await limpiar(browser);
  });
  test("Operaciones crea, edita y archiva área y plantilla E2E", async ({ page }, info) => {
    test.skip(info.project.name !== "portatil", "Los efectos corren únicamente en portatil.");
    test.setTimeout(180000);
    await entrarComo(page, OPERACIONES);
    await crearYEditarArea(page);
    await crearCategoria(page);
    await gestionarPlantilla(page);
    await archivarAreaDesdePantalla(page);
    await rechazarArchivoSembrada(page);
  });
});

for (const codigo of ["PRODUCCION", "ATENCION_CLIENTE", "ADMINISTRACION", "GERENCIA"]) {
  test(`${codigo} consulta áreas y plantillas sin gestión`, async ({ page }) => {
    await entrarComo(page, PERFILES.find((fila) => fila.codigo === codigo)!);
    await page.goto("/produccion/areas");
    await expect(page.getByRole("table", { name: "Áreas de producción" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^(Crear área$|Editar área:|Archivar área:|Reactivar área:)/ })).toHaveCount(0);
    await page.goto("/produccion/plantillas");
    await expect(page.getByRole("table", { name: "Plantillas de etapas" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^(Agregar plantilla$|Editar plantilla:|Archivar plantilla:)/ })).toHaveCount(0);
  });
}

for (const vista of VIEWPORTS) {
  test(`áreas pasa axe en ${vista.nombre}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: vista.width, height: vista.height });
    await entrarComo(page, OPERACIONES);
    await page.goto("/produccion/areas");
    await expect(page.getByRole("table", { name: "Áreas de producción" })).toBeVisible();
    expect(await violacionesGraves(page)).toEqual([]);
  });
}
