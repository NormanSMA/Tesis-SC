import { expect, test, type Locator, type Page } from "@playwright/test";
import dotenv from "dotenv";
import { iniciarSesion, PERFILES } from "./ayudas";

dotenv.config();

const CLIENTE_SIEMBRA = "Academia de Danza Ritmo";
const CLIENTE_COTIZACION_SIEMBRA = "Restaurante La Ceiba";
const CLIENTE_ORDEN_SIEMBRA = "Hotel Gran Centrómera";

const FECHAS = new RegExp([
  "\\b\\d{4}-\\d{2}-\\d{2}\\b",
  "\\b\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}\\b",
  "\\b\\d{1,2}\\s+(?:de\\s+)?(?:ene(?:ro)?|feb(?:rero)?|mar(?:zo)?|abr(?:il)?|may(?:o)?|jun(?:io)?|jul(?:io)?|ago(?:sto)?|sep(?:tiembre)?|oct(?:ubre)?|nov(?:iembre)?|dic(?:iembre)?)\\.?\\s+(?:de\\s+)?\\d{4}\\b",
  "\\b\\d{1,2}:\\d{2}(?::\\d{2})?\\b",
  "\\b(?:hace|dentro de|en)\\s+(?:\\d+|un|una|unos|unas)\\s+(?:segundos?|minutos?|horas?|d[ií]as?|semanas?|mes(?:es)?|a[nñ]os?)\\b",
  "\\b(?:lun|mar|mi[eé]|jue|vie|s[aá]b|dom)\\s+\\d{1,2}\\b",
].join("|"), "i");

const IDENTIFICADORES = new RegExp([
  "\\b(?:CLI|COT|OT|FAC)-\\d+(?:-\\d+)*\\b",
  "\\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\\b",
  "\\bc[a-z0-9]{24}\\b",
  "\\b(?:id|identificador)\\s*[:#]\\s*\\d+\\b",
  "\\b[A-Z]\\d{10,}\\b",
  "\\b\\d{3}-\\d{6}-\\d{4}[A-Z]\\b",
].join("|"), "i");

function mascarasVariables(page: Page): Locator[] {
  return [
    page.locator("time, [datetime]"),
    page.getByText(FECHAS),
    page.getByText(IDENTIFICADORES),
    page.locator("header").getByRole("button"),
    page.getByText(/\b(?:e2e|prueba|test|usuario)[-_\s]+[^\n]*\d{4,}\b/i),
  ];
}

function mascarasPanel(page: Page): Locator[] {
  return [
    ...mascarasVariables(page),
    // El servidor calcula estos valores con su fecha, independiente del reloj del navegador.
    page.locator("main h1"),
    page.getByText(/^(?:C\$\s*)?\d[\d.,\s]*(?:%|pts)?$/),
    page.getByText(/\b(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i),
    page.getByText("Monto aprobado por mes", { exact: true }).locator(".."),
    page.getByText("Etapas que completé", { exact: true }).locator(".."),
  ];
}

async function autenticar(page: Page, codigo: string): Promise<void> {
  const perfil = PERFILES.find((candidato) => candidato.codigo === codigo);
  if (!perfil) throw new Error(`Perfil desconocido: ${codigo}`);

  const clave = process.env[perfil.claveEnv];
  if (!clave) throw new Error(`Falta la variable ${perfil.claveEnv}`);

  await iniciarSesion(page, perfil.correo, clave);
  await page.waitForURL((url) => url.pathname === perfil.destino);
  await expect(page.locator("main h1")).toBeVisible();
}

async function abrirPantalla(
  page: Page,
  opciones: { perfil: string; ruta: string; titulo: string },
): Promise<void> {
  await autenticar(page, opciones.perfil);
  await page.goto(opciones.ruta);
  await expect(page.locator("main").getByRole("heading", {
    name: opciones.titulo,
    exact: true,
    level: 1,
  })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

test.describe("regresión visual", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "portatil", "Líneas base exclusivas del proyecto portatil");
    // Fija Date sin detener temporizadores, navegación ni animaciones.
    await page.clock.setFixedTime(new Date("2026-10-11T18:00:00.000Z"));
  });

  test("login", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("login.png", {
      mask: [...mascarasVariables(page)],
      caret: "hide",
      fullPage: false,
    });
  });

  test("panel de GERENCIA", async ({ page }) => {
    await autenticar(page, "GERENCIA");
    await expect(page.getByText("Monto aprobado por mes", { exact: true })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("gerencia-panel.png", {
      mask: [...mascarasPanel(page)],
      caret: "hide",
      fullPage: false,
    });
  });

  test("panel de PRODUCCION", async ({ page }) => {
    await autenticar(page, "PRODUCCION");
    await expect(page.getByText("Mis etapas en curso", { exact: true })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("produccion-panel.png", {
      mask: [...mascarasPanel(page)],
      caret: "hide",
      fullPage: false,
    });
  });

  test("lista de clientes de ATENCION_CLIENTE", async ({ page }) => {
    await abrirPantalla(page, {
      perfil: "ATENCION_CLIENTE", ruta: "/clientes", titulo: "Clientes",
    });
    await expect(page.getByRole("row").filter({ hasText: CLIENTE_SIEMBRA })).toBeVisible();
    await expect(page).toHaveScreenshot("atencion_cliente-clientes.png", {
      mask: [...mascarasVariables(page)],
      caret: "hide",
      fullPage: false,
    });
  });

  test("ficha de cliente de siembra", async ({ page }) => {
    await abrirPantalla(page, {
      perfil: "ATENCION_CLIENTE", ruta: "/clientes", titulo: "Clientes",
    });
    await page.locator("main").getByRole("link", { name: CLIENTE_SIEMBRA, exact: true }).click();
    await expect(page.locator("main h1")).toHaveText(CLIENTE_SIEMBRA);
    await expect(page.getByText("Datos del cliente", { exact: true })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("atencion_cliente-ficha-clientes.png", {
      mask: [...mascarasVariables(page)],
      caret: "hide",
      fullPage: false,
    });
  });

  test("lista de cotizaciones", async ({ page }) => {
    await abrirPantalla(page, {
      perfil: "ATENCION_CLIENTE", ruta: "/cotizaciones", titulo: "Cotizaciones",
    });
    await expect(page.getByRole("row").filter({ hasText: CLIENTE_COTIZACION_SIEMBRA })).toBeVisible();
    await expect(page).toHaveScreenshot("atencion_cliente-cotizaciones.png", {
      mask: [...mascarasVariables(page)],
      caret: "hide",
      fullPage: false,
    });
  });

  test("ficha de cotización enviada de siembra", async ({ page }) => {
    await abrirPantalla(page, {
      perfil: "ATENCION_CLIENTE", ruta: "/cotizaciones", titulo: "Cotizaciones",
    });
    const fila = page.getByRole("row")
      .filter({ has: page.getByText(CLIENTE_COTIZACION_SIEMBRA, { exact: true }) })
      .filter({ has: page.getByText("Enviada", { exact: true }) });
    await expect(fila).toHaveCount(1);
    await fila.getByRole("link", { name: /COT-\d{4}-\d+/ }).click();
    await expect(page.locator("main h1")).toHaveText(/COT-\d{4}-\d+/);
    await expect(page.locator("main").getByText("Enviada", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ítems de cotización" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("atencion_cliente-ficha-cotizacion-enviada.png", {
      mask: [...mascarasVariables(page)],
      caret: "hide",
      fullPage: false,
    });
  });

  test("lista de órdenes", async ({ page }) => {
    await abrirPantalla(page, {
      perfil: "GERENCIA", ruta: "/ordenes", titulo: "Órdenes de trabajo",
    });
    await expect(page.getByRole("row").filter({ hasText: CLIENTE_ORDEN_SIEMBRA })).toBeVisible();
    await expect(page).toHaveScreenshot("gerencia-ordenes.png", {
      mask: [...mascarasVariables(page)],
      caret: "hide",
      fullPage: false,
    });
  });

  test("ficha de orden de siembra", async ({ page }) => {
    await abrirPantalla(page, {
      perfil: "GERENCIA", ruta: "/ordenes", titulo: "Órdenes de trabajo",
    });
    const fila = page.getByRole("row").filter({ hasText: CLIENTE_ORDEN_SIEMBRA });
    await expect(fila).toHaveCount(1);
    await fila.getByRole("link", { name: /OT-\d{4}-\d+/ }).click();
    await expect(page.locator("main h1")).toHaveText(/OT-\d{4}-\d+/);
    await expect(page.getByRole("heading", { name: "Etapas", exact: true })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("gerencia-ficha-ordenes.png", {
      mask: [...mascarasVariables(page)],
      caret: "hide",
      fullPage: false,
    });
  });

  test("inventario de ADMINISTRACION", async ({ page }) => {
    await abrirPantalla(page, {
      perfil: "ADMINISTRACION", ruta: "/inventario", titulo: "Inventario",
    });
    await expect(page.getByRole("link", { name: "Acrílico opaco blanco 3mm", exact: true })).toBeVisible();
    await expect(page).toHaveScreenshot("administracion-inventario.png", {
      mask: [...mascarasVariables(page)],
      caret: "hide",
      fullPage: false,
    });
  });
});
