import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Request } from "@playwright/test";
import { randomUUID } from "node:crypto";
import "dotenv/config";

import { PERFILES, iniciarSesion, verificarMenuExacto } from "./ayudas";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const TIMEOUT = 10_000;
const PATRONES_DETALLE: Record<string, RegExp> = {
  "/clientes": /^\/clientes\/[^/]+\/?$/,
  "/cotizaciones": /^\/cotizaciones\/[^/]+\/?$/,
  "/ordenes": /^\/ordenes\/[^/]+\/?$/,
  "/inventario": /^\/(?:inventario\/(?:materiales\/)?|materiales\/)[^/]+\/?$/,
  "/admin/usuarios": /^\/admin\/usuarios\/[^/]+\/?$/,
};
const SEGMENTOS_LISTA = new Set([
  "nuevo", "nueva", "crear", "editar", "materiales", "movimientos",
  "entradas", "consumos", "ajustes", "existencias",
]);

type Hallazgo = { perfil: string; ruta: string; mensaje: string };
type Auditoria = {
  page: Page;
  perfil: (typeof PERFILES)[number];
  ruta: string;
  hallazgos: Hallazgo[];
};
type ViolacionCsp = { ruta: string; directiva: string; uri: string; disposicion: string };

test.use({ baseURL: BASE });

function registrar(auditoria: Auditoria, mensaje: string, ruta = rutaActual(auditoria)): void {
  auditoria.hallazgos.push({ perfil: auditoria.perfil.codigo, ruta, mensaje });
}

function rutaActual(auditoria: Auditoria): string {
  const url = new URL(auditoria.page.url());
  return url.protocol === "about:" ? auditoria.ruta : `${url.pathname}${url.search}`;
}

async function ejecutar(auditoria: Auditoria, nombre: string, accion: () => Promise<void>): Promise<boolean> {
  try {
    await accion();
    return true;
  } catch (error) {
    registrar(auditoria, `${nombre}: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function registrarEventos(auditoria: Auditoria): Promise<void> {
  const { page } = auditoria;
  const rutasPeticiones = new WeakMap<Request, string>();
  page.on("request", (peticion) => {
    const url = new URL(peticion.url());
    rutasPeticiones.set(peticion, peticion.isNavigationRequest()
      ? `${url.pathname}${url.search}` : rutaActual(auditoria));
  });
  page.on("console", (mensaje) => {
    const texto = mensaje.text();
    const csp = /Content[ -]Security[ -]Policy/i.test(texto);
    if (!csp && !["error", "warning"].includes(mensaje.type())) return;
    registrar(auditoria, `${csp ? "CSP" : `console.${mensaje.type()}`}: ${texto}`);
  });
  page.on("pageerror", (error) => registrar(auditoria, `pageerror: ${error.message}`));
  page.on("requestfailed", (peticion) => {
    // Next cancela normalmente el prefetch RSC al navegar.
    if (peticion.url().includes("_rsc=") && peticion.failure()?.errorText === "net::ERR_ABORTED") return;
    registrar(auditoria, `requestfailed: ${peticion.method()} ${peticion.url()} ${peticion.failure()?.errorText}`,
      rutasPeticiones.get(peticion));
  });
  page.on("response", (respuesta) => {
    const peticion = respuesta.request();
    const tipo = peticion.resourceType();
    const ruta = rutasPeticiones.get(peticion);
    if (respuesta.status() >= 400) {
      registrar(auditoria, `HTTP ${respuesta.status()}: ${peticion.method()} ${respuesta.url()}`, ruta);
    }
    if (tipo === "document" && peticion.frame() === page.mainFrame() && respuesta.ok()) {
      if (!respuesta.headers()["content-security-policy"]?.trim()) {
        registrar(auditoria, `CSP obligatoria ausente: ${respuesta.url()}`, ruta);
      }
    }
  });
  await page.exposeBinding("registrarCspAuditoria", (_origen, violacion: ViolacionCsp) => {
    registrar(auditoria, `CSP (${violacion.disposicion}): ${violacion.directiva}, recurso ${violacion.uri}`,
      violacion.ruta);
  });
  await instalarDetectorCsp(page);
}

async function instalarDetectorCsp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const ventana = window as typeof window & {
      registrarCspAuditoria: (violacion: ViolacionCsp) => Promise<void>;
    };
    document.addEventListener("securitypolicyviolation", (evento) => {
      void ventana.registrarCspAuditoria({
        ruta: `${location.pathname}${location.search}`,
        directiva: evento.effectiveDirective,
        uri: evento.blockedURI,
        disposicion: evento.disposition,
      });
    });
  });
}

async function esperarPagina(page: Page): Promise<void> {
  await page.waitForLoadState("load");
  await expect(page.locator("main")).toBeVisible({ timeout: TIMEOUT });
  await expect(page.locator('main [aria-busy="true"], main [role="progressbar"]')).toHaveCount(0);
  await expect(page.locator("main").getByText(/^Cargando(?:\s|\.|…|$)/i).first()).toBeHidden();
  await page.evaluate(() => Promise.all(
    document.getAnimations()
      .filter((animacion) => animacion.effect?.getComputedTiming().iterations !== Infinity)
      .map((animacion) => animacion.finished.catch(() => undefined)),
  ));
}

async function auditarAxe(auditoria: Auditoria): Promise<void> {
  const resultado = await new AxeBuilder({ page: auditoria.page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  for (const violacion of resultado.violations) {
    if (!["serious", "critical"].includes(violacion.impact ?? "")) continue;
    for (const nodo of violacion.nodes) {
      registrar(auditoria, `axe ${violacion.impact}: ${violacion.id}, selector ${JSON.stringify(nodo.target)}`);
    }
  }
}

async function auditarTeclado(auditoria: Auditoria): Promise<void> {
  const { page } = auditoria;
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    const anterior = document.body.getAttribute("tabindex");
    document.body.setAttribute("tabindex", "-1");
    document.body.focus({ preventScroll: true });
    if (anterior === null) document.body.removeAttribute("tabindex");
    else document.body.setAttribute("tabindex", anterior);
  });
  for (let pulsacion = 0; pulsacion < 3; pulsacion += 1) {
    await page.keyboard.press("Tab");
    const visible = await page.evaluate(() => {
      const elemento = document.activeElement;
      if (!(elemento instanceof HTMLElement) || elemento === document.body) return false;
      if (elemento.tabIndex < 0 || elemento.matches(":disabled") || elemento.closest("[inert]")) return false;
      const estilo = getComputedStyle(elemento);
      const caja = elemento.getBoundingClientRect();
      return estilo.visibility === "visible" && Number(estilo.opacity) > 0
        && caja.width > 0 && caja.height > 0 && caja.bottom > 0 && caja.top < innerHeight
        && caja.right > 0 && caja.left < innerWidth;
    });
    if (visible) return;
  }
  registrar(auditoria, "Teclado: ningún elemento enfocable visible dentro de los primeros tres Tab");
}

async function auditarDesborde(auditoria: Auditoria): Promise<void> {
  const medidas = await auditoria.page.evaluate(() => ({
    pagina: document.documentElement.scrollWidth,
    ventana: innerWidth,
  }));
  if (medidas.pagina > medidas.ventana) {
    registrar(auditoria, `Desborde horizontal: scrollWidth=${medidas.pagina}, innerWidth=${medidas.ventana}`);
  }
}

async function auditarPagina(auditoria: Auditoria): Promise<void> {
  await ejecutar(auditoria, "Carga de página", () => esperarPagina(auditoria.page));
  await ejecutar(auditoria, "Accesibilidad", () => auditarAxe(auditoria));
  await ejecutar(auditoria, "Teclado", () => auditarTeclado(auditoria));
  await ejecutar(auditoria, "Desborde", () => auditarDesborde(auditoria));
}

async function visitar(auditoria: Auditoria, visita: { ruta: string; destino?: string }): Promise<void> {
  auditoria.ruta = visita.ruta;
  await ejecutar(auditoria, `Visita ${visita.ruta}`, async () => {
    await auditoria.page.goto(visita.ruta, { waitUntil: "load", timeout: TIMEOUT });
    await expect(auditoria.page).toHaveURL(new URL(visita.destino ?? visita.ruta, BASE).href);
  });
  await auditarPagina(auditoria);
}

async function primeraFicha(page: Page, lista: string): Promise<string | undefined> {
  const patron = PATRONES_DETALLE[lista];
  if (!patron) return;
  const enlaces = page.locator("main a[href]");
  for (const enlace of await enlaces.all()) {
    if (!await enlace.isVisible()) continue;
    const href = await enlace.getAttribute("href");
    if (!href) continue;
    const url = new URL(href, page.url());
    const segmento = url.pathname.split("/").filter(Boolean).at(-1) ?? "";
    if (url.origin === new URL(BASE).origin && patron.test(url.pathname) && !SEGMENTOS_LISTA.has(segmento)) {
      return `${url.pathname}${url.search}`;
    }
  }
}

async function recorrerMenu(auditoria: Auditoria): Promise<string[]> {
  const { page, perfil } = auditoria;
  await ejecutar(auditoria, "Menú por perfil", () => verificarMenuExacto(page, perfil.items));
  const rutas: string[] = [];
  await ejecutar(auditoria, "Entradas visibles del menú", async () => {
    const menu = page.locator("#menu-principal").getByRole("navigation", { name: "Principal" });
    await expect(menu).toBeVisible();
    for (const enlace of await menu.locator("a[href]").all()) {
      if (!await enlace.isVisible()) continue;
      const href = await enlace.getAttribute("href");
      if (href) rutas.push(new URL(href, page.url()).pathname);
    }
    expect(rutas.length, "El menú debe tener entradas visibles").toBeGreaterThan(0);
  });
  for (const ruta of new Set(rutas)) {
    await visitar(auditoria, { ruta });
    await ejecutar(auditoria, `Primera ficha de ${ruta}`, async () => {
      const ficha = await primeraFicha(page, ruta);
      if (ficha) await visitar(auditoria, { ruta: ficha });
    });
  }
  return rutas;
}

async function buscarClientes(auditoria: Auditoria, busqueda: { termino: string; nombre?: string }): Promise<void> {
  const principal = auditoria.page.locator("main");
  const buscador = principal.getByRole("searchbox")
    .or(principal.getByRole("textbox", { name: /buscar/i }))
    .or(principal.getByPlaceholder(/buscar/i)).first();
  await expect(buscador).toBeVisible();
  // Repite la interacción si la hidratación descarta el primer cambio del buscador.
  await expect(async () => {
    await buscador.fill(busqueda.termino);
    await expect(buscador).toHaveValue(busqueda.termino);
    // Las listas buscan en vivo; solo las pantallas que aún tienen botón lo pulsan.
    const boton = principal.getByRole("button", { name: "Buscar", exact: true });
    if (await boton.count()) await boton.click();
    const resultado = busqueda.nombre
      ? principal.getByText(busqueda.nombre, { exact: true }).first()
      : principal.getByText("Sin resultados", { exact: true });
    await expect(resultado).toBeVisible({ timeout: 1500 });
    if (!busqueda.nombre) expect(await primeraFicha(auditoria.page, "/clientes")).toBeUndefined();
  }).toPass({ timeout: TIMEOUT });
}

async function auditarEstadoVacio(auditoria: Auditoria): Promise<void> {
  await visitar(auditoria, { ruta: "/clientes" });
  await ejecutar(auditoria, "Búsqueda sin resultados", () => buscarClientes(auditoria, {
    termino: `sin-resultados-${randomUUID()}`,
  }));
  await auditarPagina(auditoria);
}

async function crearClienteLargo(auditoria: Auditoria): Promise<{ id: string; nombre: string }> {
  const prefijo = `Auditoria-${randomUUID()}-`;
  const nombre = prefijo.padEnd(190, "A");
  const creador = PERFILES.find((perfil) => perfil.codigo === "ATENCION_CLIENTE");
  if (!creador) throw new Error("No existe el perfil creador de clientes");
  const clave = process.env[creador.claveEnv];
  if (!clave) throw new Error(`Falta la variable ${creador.claveEnv}`);
  const browser = auditoria.page.context().browser();
  if (!browser) throw new Error("No existe navegador para preparar el cliente");
  // Usa una sesión independiente: los perfiles de consulta no pueden crear clientes.
  const contexto = await browser.newContext({ baseURL: BASE, viewport: auditoria.page.viewportSize() });
  let pagina: Page | undefined;
  try {
    pagina = await contexto.newPage();
    await registrarEventos({ ...auditoria, page: pagina, ruta: "/login" });
    await iniciarSesion(pagina, creador.correo, clave);
    await pagina.waitForURL(new URL(creador.destino, BASE).href, { timeout: TIMEOUT });
    const respuesta = await contexto.request.post("/api/v1/clientes", {
      headers: { Origin: new URL(BASE).origin },
      data: { nombre, tipo: "PERSONA", telefono: "8888 0101" },
      timeout: TIMEOUT,
    });
    if (!respuesta.ok()) {
      throw new Error(`POST /api/v1/clientes: HTTP ${respuesta.status()}, ${await respuesta.text()}`);
    }
    const cuerpo = await respuesta.json() as { datos?: { id?: unknown } };
    if (typeof cuerpo.datos?.id !== "string") throw new Error("La creación no devolvió datos.id");
    return { id: cuerpo.datos.id, nombre };
  } finally {
    pagina?.removeAllListeners();
    await contexto.close();
  }
}

async function auditarClienteLargo(auditoria: Auditoria): Promise<void> {
  await ejecutar(auditoria, "Cliente con nombre de 190 caracteres", async () => {
    const cliente = await crearClienteLargo(auditoria);
    await visitar(auditoria, { ruta: "/clientes" });
    await ejecutar(auditoria, "Cliente largo visible en lista", () => buscarClientes(auditoria, {
      termino: cliente.nombre.slice(0, 46),
      nombre: cliente.nombre,
    }));
    await auditarPagina(auditoria);
    await visitar(auditoria, { ruta: `/clientes/${encodeURIComponent(cliente.id)}` });
    await ejecutar(auditoria, "Nombre largo visible en ficha", async () => {
      await expect(auditoria.page.locator("main").getByText(cliente.nombre, { exact: true }).first()).toBeVisible();
    });
  });
}

async function auditarRutaProhibida(auditoria: Auditoria): Promise<void> {
  const ruta = auditoria.perfil.codigo === "PRODUCCION"
    ? "/admin/usuarios"
    : auditoria.perfil.rutasProhibidas[0];
  await visitar(auditoria, { ruta, destino: "/sin-acceso" });
  await ejecutar(auditoria, "Mensaje de acceso denegado", async () => {
    await expect(auditoria.page.getByText("No tiene permiso para ver esta sección")).toBeVisible();
  });
}

for (const perfil of PERFILES) {
  test(`auditoría de frontend: ${perfil.codigo}`, async ({ page }, testInfo) => {
    test.skip(!["portatil", "tableta"].includes(testInfo.project.name), "Auditoría limitada a portátil y tableta");
    test.setTimeout(240_000);
    const auditoria: Auditoria = { page, perfil, ruta: "/login", hallazgos: [] };
    await registrarEventos(auditoria);
    try {
      const sesion = await ejecutar(auditoria, "Inicio de sesión", async () => {
        const clave = process.env[perfil.claveEnv];
        if (!clave) throw new Error(`Falta la variable ${perfil.claveEnv}`);
        await iniciarSesion(page, perfil.correo, clave);
        await page.waitForURL(new URL(perfil.destino, BASE).href, { timeout: TIMEOUT });
      });
      if (sesion) {
        await auditarPagina(auditoria);
        const rutas = await recorrerMenu(auditoria);
        if (rutas.includes("/clientes")) {
          await auditarEstadoVacio(auditoria);
          await auditarClienteLargo(auditoria);
        }
        await auditarRutaProhibida(auditoria);
      }
    } catch (error) {
      registrar(auditoria, `Auditoría interrumpida: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await testInfo.attach("auditoria-frontend", {
        body: Buffer.from(JSON.stringify(auditoria.hallazgos, null, 2)),
        contentType: "application/json",
      });
    }
    const detalle = auditoria.hallazgos.map(({ perfil: codigo, ruta, mensaje }) =>
      `[${codigo}] ${ruta}: ${mensaje}`).join("\n");
    expect(auditoria.hallazgos, `Hallazgos acumulados:\n${detalle}`).toEqual([]);
  });
}
