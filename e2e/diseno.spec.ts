import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
// Las pantallas autenticadas y la galería solo se prueban contra el servidor de desarrollo con SC_DEMO_SESION=1.
const conSesionDemo = process.env.E2E_DEMO === "1";

const TAMANOS = [
  { nombre: "escritorio", width: 1920, height: 1080 },
  { nombre: "portatil", width: 1366, height: 768 },
  { nombre: "tableta horizontal", width: 1024, height: 768 },
  { nombre: "tableta vertical", width: 768, height: 1024 },
];

async function violacionesGraves(page: Page) {
  const resultado = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return resultado.violations
    .filter((violacion) => violacion.impact === "critical" || violacion.impact === "serious")
    .map((violacion) => `${violacion.id}: ${violacion.nodes.map((nodo) => nodo.target.join(" ")).join(" | ")}`);
}

async function sinDesbordeHorizontal(page: Page) {
  const desborde = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(desborde).toBeLessThanOrEqual(0);
}

test.describe("login", () => {
  for (const tamano of TAMANOS.slice(1, 4)) {
    test(`axe sin violaciones graves en ${tamano.nombre}`, async ({ page }) => {
      await page.setViewportSize({ width: tamano.width, height: tamano.height });
      await page.goto(`${BASE}/login`);
      await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
      expect(await violacionesGraves(page)).toEqual([]);
      await sinDesbordeHorizontal(page);
    });
  }

  test("expone el enlace para saltar al contenido", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.keyboard.press("Tab");
    const enlace = page.getByRole("link", { name: "Saltar al contenido" });
    await expect(enlace).toBeFocused();
    await expect(enlace).toBeVisible();
  });

  test("asocia los errores de validación a cada campo", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByRole("button", { name: "Ingresar" }).click();
    const correo = page.getByLabel("Correo electrónico");
    await expect(correo).toHaveAttribute("aria-invalid", "true");
    const describedby = await correo.getAttribute("aria-describedby");
    expect(describedby).toBeTruthy();
    await expect(page.locator(`#${describedby}`)).toContainText("Ingrese su correo");
    await expect(correo).toBeFocused();
  });

  test("usa los autocomplete de autenticación y permite pegar", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.getByLabel("Correo electrónico")).toHaveAttribute("autocomplete", "username");
    await expect(page.locator("#contrasena")).toHaveAttribute("autocomplete", "current-password");
  });

  test("muestra el error del servidor en una región de alerta", async ({ page }) => {
    await page.route("**/api/v1/auth/login", (ruta) =>
      ruta.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: { codigo: "CREDENCIALES", mensaje: "Correo o contraseña incorrectos." } }),
      }),
    );
    await page.goto(`${BASE}/login`);
    await page.getByLabel("Correo electrónico").fill("alguien@ejemplo.test");
    await page.locator("#contrasena").fill("clave-de-prueba");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page.getByRole("form", { name: "Inicio de sesión" }).getByRole("alert")).toContainText("Correo o contraseña incorrectos.");
  });
});

test.describe("pantallas con sesión de demostración", () => {
  test.skip(!conSesionDemo, "Requiere E2E_DEMO=1 y un servidor de desarrollo con SC_DEMO_SESION=1");

  for (const ruta of ["/panel", "/diseno"]) {
    for (const tamano of TAMANOS.slice(1, 4).filter((_, indice) => indice !== 1)) {
      test(`axe sin violaciones graves en ${ruta} (${tamano.nombre})`, async ({ page }) => {
        await page.setViewportSize({ width: tamano.width, height: tamano.height });
        await page.goto(`${BASE}${ruta}`);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        expect(await violacionesGraves(page)).toEqual([]);
      });
    }
  }

  for (const tamano of TAMANOS) {
    test(`el panel no desborda horizontalmente en ${tamano.nombre}`, async ({ page }) => {
      await page.setViewportSize({ width: tamano.width, height: tamano.height });
      await page.goto(`${BASE}/panel`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await sinDesbordeHorizontal(page);
    });
  }

  test("menú lateral expandido desde 1280 px", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`${BASE}/panel`);
    const menu = page.locator("#menu-principal");
    expect((await menu.boundingBox())?.width).toBe(256);
    const navegacion = menu.getByRole("navigation", { name: "Principal" });
    await expect(navegacion.getByRole("link", { name: "Órdenes de trabajo" })).toBeVisible();
    await expect(navegacion.getByRole("link", { name: "Panel", exact: true })).toHaveAttribute("aria-current", "page");
  });

  test("riel de íconos entre 768 y 1279 px, expandible", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(`${BASE}/panel`);
    const menu = page.locator("#menu-principal");
    expect((await menu.boundingBox())?.width).toBe(64);
    await page.getByRole("button", { name: "Expandir menú de navegación" }).click();
    expect((await menu.boundingBox())?.width).toBe(256);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Expandir menú de navegación" }).waitFor();
    expect((await menu.boundingBox())?.width).toBe(64);
  });

  test("menú en panel lateral bajo 768 px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/panel`);
    await expect(page.locator("#menu-principal")).toBeHidden();
    await page.getByRole("button", { name: "Abrir menú de navegación" }).click();
    await expect(page.getByRole("dialog").getByRole("link", { name: "Clientes" })).toBeVisible();
  });

  test("la tarjeta de usuario del menú lateral ofrece el cierre de sesión", async ({ page }) => {
    await page.goto(`${BASE}/panel`);
    const tarjeta = page.locator("#menu-principal").getByRole("region", { name: "Sesión de usuario" });
    await expect(tarjeta.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
  });

  test("las tablas tienen encabezados con scope y nombre accesible", async ({ page }) => {
    await page.goto(`${BASE}/diseno`);
    const tabla = page.getByRole("table", { name: "Cotizaciones de ejemplo" });
    await expect(tabla).toBeVisible();
    expect(await tabla.locator("th[scope='col']").count()).toBeGreaterThan(5);
  });
});
