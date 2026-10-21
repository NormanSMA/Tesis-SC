import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// RNF-08 (tesis v9): 768, 1024, 1366 y 1920 px.
export const VIEWPORTS = [
  { nombre: "escritorio", width: 1920, height: 1080 },
  { nombre: "portatil", width: 1366, height: 768 },
  { nombre: "tableta-horizontal", width: 1024, height: 768 },
  { nombre: "tableta", width: 768, height: 1024 },
];

// Menú exacto por perfil según la matriz de docs/modulos/09-perfiles-v9.md.
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
    codigo: "ADMINISTRACION",
    correo: "luis.mendoza@solucionescreativas.test",
    claveEnv: "SEED_PASSWORD_ADMINISTRACION",
    destino: "/panel",
    items: ["Panel", "Cotizaciones", "Órdenes de trabajo", "Producción", "Inventario", "Catálogo"],
    rutasProhibidas: ["/clientes", "/reportes", "/trazabilidad", "/admin/usuarios"],
  },
  {
    codigo: "OPERACIONES",
    correo: "karla.reyes@solucionescreativas.test",
    claveEnv: "SEED_PASSWORD_OPERACIONES",
    destino: "/panel",
    items: ["Panel", "Clientes", "Cotizaciones", "Órdenes de trabajo", "Producción", "Inventario", "Catálogo"],
    rutasProhibidas: ["/reportes", "/trazabilidad", "/admin/usuarios"],
  },
  {
    codigo: "ATENCION_CLIENTE",
    correo: "valentina.castro@solucionescreativas.test",
    claveEnv: "SEED_PASSWORD_ATENCION_CLIENTE",
    destino: "/panel",
    items: ["Panel", "Clientes", "Cotizaciones", "Órdenes de trabajo", "Producción", "Catálogo"],
    rutasProhibidas: ["/reportes", "/inventario", "/admin/permisos"],
  },
  {
    codigo: "PRODUCCION",
    correo: "marco.lopez@solucionescreativas.test",
    claveEnv: "SEED_PASSWORD_PRODUCCION",
    destino: "/panel",
    items: ["Panel", "Órdenes de trabajo", "Producción", "Catálogo"],
    rutasProhibidas: ["/clientes", "/cotizaciones", "/inventario"],
  },
  {
    codigo: "ADMIN",
    correo: "roberto.diaz@solucionescreativas.test",
    claveEnv: "SEED_PASSWORD_ADMIN",
    destino: "/admin/usuarios",
    items: ["Trazabilidad", "Usuarios", "Perfiles y permisos", "Configuración", "Estado del sistema"],
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

// Sesión guardada por perfil (e2e/autenticacion.setup.ts). Lleva cookies: vive en .next/, fuera de git.
const CARPETA_SESIONES = path.join(".next", "cache", "playwright-auth");
const archivoSesion = (codigo: string) => path.join(CARPETA_SESIONES, `${codigo}.json`);
type PerfilSesion = { codigo: string; correo: string; claveEnv: string; destino: string };

/** Clave del perfil: primero el entorno, luego .env.example (claves de la siembra de demostración). */
export function claveDePerfil(perfil: { claveEnv: string }): string {
  const directa = process.env[perfil.claveEnv];
  if (directa) return directa;
  const ejemplo = fs.existsSync(".env.example") ? fs.readFileSync(".env.example", "utf-8") : "";
  const coincidencia = ejemplo.match(new RegExp(`^${perfil.claveEnv}=(.+)$`, "m"));
  if (!coincidencia) throw new Error(`Falta la variable ${perfil.claveEnv}`);
  return coincidencia[1];
}

/** Inicia sesión por la interfaz, espera el destino del perfil y guarda las cookies para reutilizarlas. */
export async function entrarYGuardar(page: Page, perfil: PerfilSesion): Promise<void> {
  const clave = claveDePerfil(perfil);
  await page.context().clearCookies();
  await iniciarSesion(page, perfil.correo, clave);
  await page.waitForURL(`**${perfil.destino}`, { timeout: 15_000 });
  fs.mkdirSync(CARPETA_SESIONES, { recursive: true });
  await page.context().storageState({ path: archivoSesion(perfil.codigo) });
}

/**
 * Entra como el perfil con la sesión guardada y abre su destino, sin pagar el hash de la clave.
 * Si la sesión falta o venció (por ejemplo tras demo:reiniciar), inicia sesión de nuevo y la guarda.
 */
export async function usarSesion(page: Page, perfil: PerfilSesion): Promise<void> {
  const contexto = page.context();
  await contexto.clearCookies();
  const archivo = archivoSesion(perfil.codigo);
  if (fs.existsSync(archivo)) {
    const { cookies } = JSON.parse(fs.readFileSync(archivo, "utf8"));
    await contexto.addCookies(cookies);
    await page.goto(perfil.destino);
    if (!new URL(page.url()).pathname.startsWith("/login")) return;
  }
  await entrarYGuardar(page, perfil);
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
    // Texto sin las partes aria-hidden (contadores del menú): es lo que forma el nombre accesible.
    const texto = await enlace.evaluate((nodo) => {
      const copia = nodo.cloneNode(true) as HTMLElement;
      copia.querySelectorAll("[aria-hidden='true']").forEach((oculto) => oculto.remove());
      return copia.textContent;
    });
    const nombre = ariaLabel ?? texto?.trim();

    if (!nombre) {
      throw new Error("Enlace sin nombre accesible en #menu-principal");
    }

    nombresObtenidos.add(nombre);
  }

  const nombresEsperados = new Set(items);
  expect(nombresObtenidos).toEqual(nombresEsperados);
}

// Las entradas animadas (opacidad) alteran el color calculado y producen falsos positivos de contraste.
// Una animación dentro de una sección plegada no avanza nunca: se ignoran los elementos sin caja visible
// y la espera tiene un tope de 2 s (las animaciones de la interfaz duran como máximo 500 ms).
async function esperarAnimacionesFinitas(page: Page): Promise<void> {
  await page.evaluate(() => Promise.race([
    Promise.all(document.getAnimations()
      .filter((animacion) => animacion.effect?.getComputedTiming().iterations !== Infinity)
      .filter((animacion) => {
        const objetivo = (animacion.effect as KeyframeEffect | null)?.target;
        return !objetivo || objetivo.checkVisibility();
      })
      .map((animacion) => animacion.finished.catch(() => undefined))),
    new Promise((resolver) => setTimeout(resolver, 2000)),
  ]));
}

export async function violacionesGraves(page: Page): Promise<string[]> {
  await esperarAnimacionesFinitas(page);
  const resultado = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return resultado.violations
    .filter((violacion) => ["critical", "serious", "moderate", "minor"].includes(violacion.impact ?? ""))
    .map((violacion) => `${violacion.id}: ${violacion.nodes.map((nodo) => nodo.target.join(" ")).join(" | ")}`);
}

export async function sinDesbordeHorizontal(page: Page): Promise<void> {
  const desborde = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(desborde).toBeLessThanOrEqual(0);
}

