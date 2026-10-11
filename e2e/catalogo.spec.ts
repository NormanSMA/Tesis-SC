import { expect, test, type Browser, type Page } from "@playwright/test";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

import { PERFILES, VIEWPORTS, iniciarSesion, sinDesbordeHorizontal, violacionesGraves } from "./ayudas";

dotenv.config();

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const CARPETA_CAPTURAS = path.join("docs", "capturas", "catalogo");
const CATEGORIA = "Rotulación y gran formato";
const PRODUCTO_SEMBRADO = "ROT-VIN-001";
const MATERIAL_RECETA = "VIN-BLA-01";

test.use({ baseURL: BASE });

type Perfil = (typeof PERFILES)[number];

const GERENCIA = PERFILES.find((perfil) => perfil.codigo === "GERENCIA") as Perfil;
const ATENCION_CLIENTE = PERFILES.find((perfil) => perfil.codigo === "ATENCION_CLIENTE") as Perfil;
const PRODUCCION = PERFILES.find((perfil) => perfil.codigo === "PRODUCCION") as Perfil;
const ADMIN = PERFILES.find((perfil) => perfil.codigo === "ADMIN") as Perfil;

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

async function elegirOpcion(page: Page, campo: RegExp, opcion: string | RegExp): Promise<void> {
  await page.getByRole("combobox", { name: campo }).click();
  await page.getByRole("option", { name: opcion }).click();
}

async function archivarProductosE2E(browser: Browser): Promise<void> {
  const contexto = await browser.newContext({ baseURL: BASE });
  const page = await contexto.newPage();
  try {
    await entrarComo(page, GERENCIA);
    const lista = await page.request.get("/api/v1/productos?q=E2E-&activo=true&porPagina=100");
    const filas = ((await lista.json()).datos ?? []) as { id: string; codigo: string; actualizadoEn: string }[];
    for (const fila of filas.filter((producto) => producto.codigo.startsWith("E2E-"))) {
      const respuesta = await page.request.post(`/api/v1/productos/${fila.id}/archivar`, {
        headers: { Origin: BASE },
        data: { version: fila.actualizadoEn },
      });
      expect([200, 409]).toContain(respuesta.status());
    }
  } finally {
    await contexto.close();
  }
}

// Red de seguridad: si una prueba falla a medias, no deja productos E2E activos en el catálogo sembrado.
test.afterAll(async ({ browser }, info) => {
  if (info.project.name === "portatil") await archivarProductosE2E(browser);
});

async function crearProductoPorPantalla(page: Page, valores: { codigo: string; nombre: string }): Promise<void> {
  await page.goto("/catalogo");
  await page.getByRole("link", { name: "Nuevo producto" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Nuevo producto" })).toBeVisible();
  await page.locator("#codigo").fill(valores.codigo);
  await page.locator("#nombre").fill(valores.nombre);
  await elegirOpcion(page, /Categoría/, CATEGORIA);
  await elegirOpcion(page, /Unidad de cobro/, "m²");
  await page.locator("#precioBase").fill("125.50");
  await page.getByRole("button", { name: "Guardar producto" }).click();
  await expect(page).toHaveURL(/\/catalogo\/[0-9a-f-]{36}$/);
}

async function editarDatosPorPantalla(page: Page, nombre: string): Promise<void> {
  await page.getByRole("link", { name: "Editar" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Editar producto" })).toBeVisible();
  await expect(page.locator("#nombre")).toHaveValue(/^E2E-/);
  await page.locator("#nombre").fill(nombre);
  await page.locator("#precioBase").fill("199.90");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page).toHaveURL(/\/catalogo\/[0-9a-f-]{36}$/);
}

async function agregarRecetaPorPantalla(page: Page): Promise<void> {
  await page.getByRole("link", { name: "Editar" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Receta de materiales" })).toBeVisible();
  await expect(page.getByText("Sin materiales. La receta es opcional.")).toBeVisible();
  await page.getByRole("button", { name: "Agregar material" }).click();
  await elegirOpcion(page, /Material 1/, new RegExp(MATERIAL_RECETA));
  await page.locator("#cantidad-0").fill("0.500");
  await page.getByRole("button", { name: "Guardar receta" }).click();
  await expect(page.getByText("Receta guardada.")).toBeVisible();
}

test.describe("Gerencia gestiona el catálogo", () => {
  test("crea, edita, agrega receta y archiva un producto", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    const codigo = marcaE2E();
    const nombreInicial = `${codigo} original`;
    const nombreFinal = `${codigo} editado`;
    await entrarComo(page, GERENCIA);

    await crearProductoPorPantalla(page, { codigo, nombre: nombreInicial });
    await expect(page.getByRole("heading", { level: 1, name: nombreInicial })).toBeVisible();
    await expect(page.getByText(`${codigo} · ${CATEGORIA}`)).toBeVisible();
    await expect(page.getByText("m²", { exact: true })).toBeVisible();
    await expect(page.getByText("C$ 125.50")).toBeVisible();
    await expect(page.getByText("Sin receta")).toBeVisible();

    await editarDatosPorPantalla(page, nombreFinal);
    await expect(page.getByRole("heading", { level: 1, name: nombreFinal })).toBeVisible();
    await expect(page.getByText("C$ 199.90")).toBeVisible();

    await agregarRecetaPorPantalla(page);
    await page.goto(page.url().replace(/\/editar$/, ""));
    const filaMaterial = page.getByRole("row", { name: new RegExp(MATERIAL_RECETA) });
    await expect(filaMaterial).toBeVisible();
    await expect(filaMaterial).toContainText("0.500");

    await page.getByRole("button", { name: "Archivar" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Archivar" }).click();
    await expect(page.getByText("Producto archivado.")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Producto archivado" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Editar" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reactivar" })).toBeVisible();

    await page.goto(`/catalogo?q=${encodeURIComponent(codigo)}`);
    await expect(page.getByText("Sin resultados", { exact: true })).toBeVisible();
    await page.goto(`/catalogo?q=${encodeURIComponent(codigo)}&activo=false`);
    await expect(page.getByRole("link", { name: nombreFinal })).toBeVisible();
  });
});

async function abrirFichaSembrada(page: Page): Promise<void> {
  await page.goto(`/catalogo?q=${PRODUCTO_SEMBRADO}`);
  await page.getByRole("heading", { level: 2 }).getByRole("link").first().click();
  await expect(page.getByRole("heading", { level: 2, name: "Receta de materiales" })).toBeVisible();
}

async function verificarSoloLectura(page: Page): Promise<void> {
  await page.goto("/catalogo");
  await expect(page.getByRole("heading", { level: 1, name: "Catálogo" })).toBeVisible();
  await expect(page.getByRole("img", { name: /^Producto: / }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Nuevo producto" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^Editar/ })).toHaveCount(0);

  await abrirFichaSembrada(page);
  await expect(page.getByRole("img", { name: /^Producto: / })).toBeVisible();
  await expect(page.getByRole("link", { name: "Editar" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Archivar|Reactivar/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Nuevo producto" })).toHaveCount(0);
}

test.describe("Perfiles de consulta ven el catálogo sin gestión", () => {
  test("Ventas ve tarjetas con imagen y una ficha sin botones de gestión", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    await entrarComo(page, ATENCION_CLIENTE);
    await verificarSoloLectura(page);
  });

  test("Producción ve el catálogo y no ve botones de gestión", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    await entrarComo(page, PRODUCCION);
    await verificarSoloLectura(page);
  });

  test("Administración termina en sin-acceso al abrir el catálogo", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    await entrarComo(page, ADMIN);
    await page.goto("/catalogo");
    await expect(page).toHaveURL(/\/sin-acceso$/);
    await expect(page.getByText("No tiene permiso para ver esta sección")).toBeVisible();
  });

  test("Producción recibe 403 al crear un producto por la API", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    await entrarComo(page, PRODUCCION);
    const respuesta = await page.request.post("/api/v1/productos", {
      headers: { Origin: BASE },
      data: { codigo: "E2E-403", nombre: "No debe crearse" },
    });
    expect(respuesta.status()).toBe(403);
  });
});

test.describe("Accesibilidad (axe) y adaptabilidad", () => {
  const TAMANOS = VIEWPORTS.filter((vista) => vista.nombre === "portatil" || vista.nombre === "tableta");

  for (const vista of TAMANOS) {
    test(`lista y formulario sin violaciones graves en ${vista.nombre}`, async ({ page }, info) => {
      soloUnaVez(info.project.name);
      await page.setViewportSize({ width: vista.width, height: vista.height });
      await entrarComo(page, GERENCIA);

      await page.goto("/catalogo");
      await expect(page.getByRole("img", { name: /^Producto: / }).first()).toBeVisible();
      expect(await violacionesGraves(page), "lista").toEqual([]);

      await page.goto("/catalogo/nuevo");
      await expect(page.getByRole("heading", { level: 1, name: "Nuevo producto" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Guardar producto" })).toBeEnabled();
      expect(await violacionesGraves(page), "formulario nuevo producto").toEqual([]);
    });
  }

  test("la lista no desborda en horizontal", async ({ page }) => {
    await entrarComo(page, ATENCION_CLIENTE);
    await page.goto("/catalogo");
    await expect(page.getByRole("img", { name: /^Producto: / }).first()).toBeVisible();
    await sinDesbordeHorizontal(page);
  });
});

test.describe("Capturas del catálogo con Gerencia", () => {
  test("lista y ficha con receta en los 4 tamaños", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    test.setTimeout(120_000);
    fs.mkdirSync(CARPETA_CAPTURAS, { recursive: true });
    await entrarComo(page, GERENCIA);

    for (const vista of VIEWPORTS) {
      await page.setViewportSize({ width: vista.width, height: vista.height });
      await page.goto("/catalogo");
      await expect(page.getByRole("img", { name: /^Producto: / }).first()).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(CARPETA_CAPTURAS, `catalogo-lista-${vista.nombre}.png`), fullPage: true });

      await abrirFichaSembrada(page);
      await expect(page.getByRole("row", { name: new RegExp(MATERIAL_RECETA) })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(CARPETA_CAPTURAS, `catalogo-ficha-${vista.nombre}.png`), fullPage: true });
    }
  });
});
