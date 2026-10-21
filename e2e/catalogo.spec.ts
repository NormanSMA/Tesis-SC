import { expect, test, type Browser, type Page } from "@playwright/test";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

import { PERFILES, VIEWPORTS, usarSesion, sinDesbordeHorizontal, violacionesGraves } from "./ayudas";

dotenv.config();

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const CARPETA_CAPTURAS = path.join("docs", "capturas", "catalogo");
const CATEGORIA = "Rotulación y gran formato";
const PRODUCTO_SEMBRADO = "ROT-VIN-001";
const MATERIAL_RECETA = "VIN-BLA-01";

test.use({ baseURL: BASE });

type Perfil = (typeof PERFILES)[number];

const GERENCIA = PERFILES.find((perfil) => perfil.codigo === "GERENCIA") as Perfil;
const ADMINISTRACION = PERFILES.find((perfil) => perfil.codigo === "ADMINISTRACION") as Perfil;
const OPERACIONES = PERFILES.find((perfil) => perfil.codigo === "OPERACIONES") as Perfil;
const ATENCION_CLIENTE = PERFILES.find((perfil) => perfil.codigo === "ATENCION_CLIENTE") as Perfil;
const PRODUCCION = PERFILES.find((perfil) => perfil.codigo === "PRODUCCION") as Perfil;
const ADMIN = PERFILES.find((perfil) => perfil.codigo === "ADMIN") as Perfil;


async function entrarComo(page: Page, perfil: Perfil): Promise<void> {
  await usarSesion(page, perfil);
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

// Solo la pestaña activa está en el DOM: ábrala antes de buscar su contenido.
async function abrirPestana(page: Page, nombre: string): Promise<void> {
  const pestana = page.getByRole("tab", { name: nombre });
  await pestana.click();
  await expect(pestana).toHaveAttribute("aria-selected", "true");
}

async function archivarProductosE2E(browser: Browser): Promise<void> {
  const contexto = await browser.newContext({ baseURL: BASE });
  const page = await contexto.newPage();
  try {
    await entrarComo(page, OPERACIONES);
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

test.describe("Operaciones gestiona el catálogo", () => {
  test("crea, edita, agrega receta y archiva un producto", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    const codigo = marcaE2E();
    const nombreInicial = `${codigo} original`;
    const nombreFinal = `${codigo} editado`;
    await entrarComo(page, OPERACIONES);

    await crearProductoPorPantalla(page, { codigo, nombre: nombreInicial });
    await expect(page.getByRole("heading", { level: 1, name: nombreInicial })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Resumen" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText(codigo, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(CATEGORIA).first()).toBeVisible();
    await expect(page.getByText("m²", { exact: true })).toBeVisible();
    await expect(page.getByText("C$ 125.50")).toBeVisible();
    await abrirPestana(page, "Receta");
    await expect(page.getByText("Sin receta")).toBeVisible();

    await editarDatosPorPantalla(page, nombreFinal);
    await expect(page.getByRole("heading", { level: 1, name: nombreFinal })).toBeVisible();
    await expect(page.getByText("C$ 199.90")).toBeVisible();

    await agregarRecetaPorPantalla(page);
    await page.goto(page.url().replace(/\/editar$/, ""));
    await abrirPestana(page, "Receta");
    const filaMaterial = page.getByRole("row", { name: new RegExp(MATERIAL_RECETA) });
    await expect(filaMaterial).toBeVisible();
    // VIN-BLA-01 es ROLLO: 0.500 se muestra sin ceros sobrantes, sin redondear.
    await expect(filaMaterial.getByRole("cell")).toHaveText(["rollo", "0.5"]);

    await page.getByRole("button", { name: "Archivar" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Archivar" }).click();
    await expect(page.getByText("Producto archivado.")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Producto archivado" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Editar" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reactivar" })).toBeVisible();

    await page.goto(`/catalogo?q=${encodeURIComponent(codigo)}`);
    await expect(page.getByText("Sin resultados", { exact: true })).toBeVisible();
    await page.goto(`/catalogo?q=${encodeURIComponent(codigo)}&activo=false`);
    await expect(page.getByRole("link", { name: nombreFinal }).first()).toBeVisible();
  });
});

async function abrirFichaSembrada(page: Page): Promise<void> {
  await page.goto(`/catalogo?q=${PRODUCTO_SEMBRADO}`);
  await page.getByRole("heading", { level: 2 }).getByRole("link").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Resumen" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Receta" })).toBeVisible();
}

// veCosto: el costo de referencia vive en la ficha y exige cotizacion:ver.
async function verificarSoloLectura(page: Page, veCosto: boolean): Promise<void> {
  await page.goto("/catalogo");
  await expect(page.getByRole("heading", { level: 1, name: "Catálogo" })).toBeVisible();
  await expect(page.getByRole("img", { name: /^Producto: / }).first()).toBeVisible();
  await expect(page.getByText("Costo de referencia")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Nuevo producto" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^Editar/ })).toHaveCount(0);

  await abrirFichaSembrada(page);
  await expect(page.getByRole("img", { name: /^Producto: / })).toBeVisible();
  await expect(page.getByRole("link", { name: "Editar" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Archivar|Reactivar/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Nuevo producto" })).toHaveCount(0);
  if (veCosto) await expect(page.getByText("Costo de referencia").first()).toBeVisible();
  else await expect(page.getByText("Costo de referencia")).toHaveCount(0);

  await abrirPestana(page, "Receta");
  await expect(page.getByRole("tabpanel")).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(MATERIAL_RECETA) })).toBeVisible();
  await expect(page.getByRole("button", { name: /Agregar material|Guardar receta/ })).toHaveCount(0);
}

test.describe("Perfiles de consulta ven el catálogo sin gestión", () => {
  test("Gerencia ve tarjetas con imagen y una ficha sin botones de gestión", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    await entrarComo(page, GERENCIA);
    await verificarSoloLectura(page, true);
  });

  test("Atención al cliente ve tarjetas con imagen y una ficha sin botones de gestión", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    await entrarComo(page, ATENCION_CLIENTE);
    await verificarSoloLectura(page, true);
  });

  test("Administración ve el catálogo y no ve botones de gestión", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    await entrarComo(page, ADMINISTRACION);
    await verificarSoloLectura(page, true);
  });

  test("Producción ve el catálogo, sin botones de gestión ni costo de referencia", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    await entrarComo(page, PRODUCCION);
    await verificarSoloLectura(page, false);
  });

  test("Administración técnica termina en sin-acceso al abrir el catálogo", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    await entrarComo(page, ADMIN);
    await page.goto("/catalogo");
    await expect(page).toHaveURL(/\/sin-acceso$/);
    await expect(page.getByText("No tiene permiso para ver esta sección")).toBeVisible();
  });

  test("Gerencia no entra a las rutas de gestión", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    await entrarComo(page, GERENCIA);
    await page.goto("/catalogo/nuevo");
    await expect(page).toHaveURL(/\/sin-acceso$/);
  });

  for (const perfil of [GERENCIA, PRODUCCION]) {
    test(`${perfil.codigo} recibe 403 al crear un producto por la API`, async ({ page }, info) => {
      soloUnaVez(info.project.name);
      await entrarComo(page, perfil);
      const respuesta = await page.request.post("/api/v1/productos", {
        headers: { Origin: BASE },
        data: { codigo: "E2E-403", nombre: "No debe crearse" },
      });
      expect(respuesta.status()).toBe(403);
    });
  }
});

test.describe("Accesibilidad (axe) y adaptabilidad", () => {
  for (const vista of VIEWPORTS) {
    test(`lista, formulario y ficha sin violaciones graves en ${vista.nombre} (${vista.width} px)`, async ({ page }, info) => {
      soloUnaVez(info.project.name);
      test.setTimeout(90_000);
      await page.setViewportSize({ width: vista.width, height: vista.height });
      await entrarComo(page, OPERACIONES);

      await page.goto("/catalogo");
      await expect(page.getByRole("img", { name: /^Producto: / }).first()).toBeVisible();
      expect(await violacionesGraves(page), "lista").toEqual([]);

      await page.goto("/catalogo/nuevo");
      await expect(page.getByRole("heading", { level: 1, name: "Nuevo producto" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Guardar producto" })).toBeEnabled();
      expect(await violacionesGraves(page), "formulario nuevo producto").toEqual([]);

      await abrirFichaSembrada(page);
      for (const pestana of ["Resumen", "Receta"]) {
        await abrirPestana(page, pestana);
        expect(await violacionesGraves(page), `ficha, pestaña ${pestana}`).toEqual([]);
      }
    });
  }

  test("la lista y la ficha no desbordan en horizontal", async ({ page }) => {
    await entrarComo(page, ATENCION_CLIENTE);
    await page.goto("/catalogo");
    await expect(page.getByRole("img", { name: /^Producto: / }).first()).toBeVisible();
    await sinDesbordeHorizontal(page);
    await abrirFichaSembrada(page);
    for (const pestana of ["Resumen", "Receta"]) {
      await abrirPestana(page, pestana);
      await sinDesbordeHorizontal(page);
    }
  });
});

test.describe("Capturas del catálogo con Gerencia", () => {
  test("lista y ficha con receta en los 4 anchos", async ({ page }, info) => {
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
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: path.join(CARPETA_CAPTURAS, `catalogo-ficha-resumen-${vista.nombre}.png`),
        fullPage: true,
      });

      await abrirPestana(page, "Receta");
      await expect(page.getByRole("row", { name: new RegExp(MATERIAL_RECETA) })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(CARPETA_CAPTURAS, `catalogo-ficha-${vista.nombre}.png`), fullPage: true });
    }
  });
});
