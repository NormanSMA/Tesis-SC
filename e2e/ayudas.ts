import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const VIEWPORTS = [
  { nombre: "escritorio", width: 1920, height: 1080 },
  { nombre: "portatil", width: 1366, height: 768 },
  { nombre: "tableta-horizontal", width: 1024, height: 768 },
  { nombre: "tableta", width: 820, height: 1180 },
];

export const PERFILES = [
  {
    codigo: "GERENCIA",
    correo: "gerardo.jimenez@solucionescreativas.test",
    claveEnv: "SEED_PASSWORD_GERENCIA",
    destino: "/panel",
    items: [
      "Panel",
      "Clientes",
      "Cotizaciones",
      "Órdenes de trabajo",
      "Producción",
      "Inventario",
      "Catálogo",
      "Trazabilidad",
      "Reportes",
    ],
    rutasProhibidas: ["/admin/usuarios"],
  },
  {
    codigo: "ATENCION_CLIENTE",
    correo: "valentina.castro@solucionescreativas.test",
    claveEnv: "SEED_PASSWORD_ATENCION_CLIENTE",
    destino: "/panel",
    items: ["Panel", "Clientes", "Cotizaciones", "Órdenes de trabajo", "Producción", "Inventario", "Catálogo"],
    rutasProhibidas: ["/reportes", "/admin/permisos"],
  },
  {
    codigo: "PRODUCCION",
    correo: "marco.lopez@solucionescreativas.test",
    claveEnv: "SEED_PASSWORD_PRODUCCION",
    destino: "/panel",
    items: ["Panel", "Órdenes de trabajo", "Producción", "Inventario", "Catálogo"],
    rutasProhibidas: ["/clientes", "/cotizaciones"],
  },
  {
    codigo: "ADMIN",
    correo: "roberto.diaz@solucionescreativas.test",
    claveEnv: "SEED_PASSWORD_ADMIN",
    destino: "/admin/usuarios",
    items: ["Trazabilidad", "Usuarios", "Perfiles y permisos", "Configuración"],
    rutasProhibidas: ["/panel", "/clientes"],
  },
];

export async function iniciarSesion(
  page: Page,
  correo: string,
  clave: string,
): Promise<void> {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
  await page.getByLabel("Correo electrónico").fill(correo);
  await page.locator("#contrasena").fill(clave);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

export async function verificarMenuExacto(
  page: Page,
  items: string[],
): Promise<void> {
  const menu = page.locator("#menu-principal");

  const enlaces = await menu.getByRole("navigation", { name: "Principal" }).locator("a").all();
  const nombresObtenidos = new Set<string>();

  for (const enlace of enlaces) {
    const ariaLabel = await enlace.getAttribute("aria-label");
    const texto = await enlace.textContent();
    const nombre = ariaLabel ?? texto?.trim();

    if (!nombre) {
      throw new Error("Enlace sin nombre accesible en #menu-principal");
    }

    nombresObtenidos.add(nombre);
  }

  const nombresEsperados = new Set(items);
  expect(nombresObtenidos).toEqual(nombresEsperados);
}

export async function violacionesGraves(page: Page): Promise<string[]> {
  const resultado = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return resultado.violations
    .filter((violacion) => violacion.impact === "critical" || violacion.impact === "serious")
    .map((violacion) => `${violacion.id}: ${violacion.nodes.map((nodo) => nodo.target.join(" ")).join(" | ")}`);
}

export async function sinDesbordeHorizontal(page: Page): Promise<void> {
  const desborde = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(desborde).toBeLessThanOrEqual(0);
}

export async function obtenerNombreArchivoCaptura(
  perfil: string,
  viewport: string,
): Promise<string> {
  return `${perfil.toLowerCase()}-${viewport}.png`;
}
