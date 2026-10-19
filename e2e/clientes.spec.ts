import { expect, test, type Browser, type Page } from "@playwright/test";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

import { PERFILES, VIEWPORTS, iniciarSesion, sinDesbordeHorizontal, violacionesGraves } from "./ayudas";

dotenv.config();

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const CARPETA_CAPTURAS = path.join("docs", "capturas", "clientes");
const CLIENTE_SEMBRADO = "Agencia Viajes Tropical";
const PESTANAS_FICHA = ["Resumen", "Cotizaciones", "Trabajos", "Actividad"];

test.use({ baseURL: BASE });

type Perfil = (typeof PERFILES)[number];

const GERENCIA = PERFILES.find((perfil) => perfil.codigo === "GERENCIA") as Perfil;
const ADMINISTRACION = PERFILES.find((perfil) => perfil.codigo === "ADMINISTRACION") as Perfil;
const OPERACIONES = PERFILES.find((perfil) => perfil.codigo === "OPERACIONES") as Perfil;
const ATENCION_CLIENTE = PERFILES.find((perfil) => perfil.codigo === "ATENCION_CLIENTE") as Perfil;
const PRODUCCION = PERFILES.find((perfil) => perfil.codigo === "PRODUCCION") as Perfil;

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

function nombreE2E(): string {
  return `E2E-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

// Las pruebas con efectos o con tamaño propio corren una sola vez: Playwright repite cada prueba por proyecto.
function soloUnaVez(proyecto: string) {
  test.skip(proyecto !== "portatil", "Esta prueba fija sus propios tamaños y corre solo en el proyecto portatil.");
}

type DatosApi = { id: string; actualizadoEn: string };

async function crearPorApi(page: Page, cuerpo: Record<string, unknown>): Promise<DatosApi> {
  const respuesta = await page.request.post("/api/v1/clientes", { headers: { Origin: BASE }, data: cuerpo });
  expect(respuesta.status()).toBe(201);
  return (await respuesta.json()).datos as DatosApi;
}

async function archivarPorApi(page: Page, id: string): Promise<void> {
  const actual = await page.request.get(`/api/v1/clientes/${id}`);
  const { activo, actualizadoEn } = (await actual.json()).datos as { activo: boolean; actualizadoEn: string };
  if (!activo) return;
  const respuesta = await page.request.post(`/api/v1/clientes/${id}/archivar`, {
    headers: { Origin: BASE },
    data: { version: actualizadoEn },
  });
  expect([200, 409]).toContain(respuesta.status());
}

async function llenarFormulario(page: Page, valores: Record<string, string>): Promise<void> {
  for (const [id, valor] of Object.entries(valores)) await page.locator(`#${id}`).fill(valor);
}

// Solo la pestaña activa está en el DOM: ábrala antes de buscar su contenido.
async function abrirPestana(page: Page, nombre: string): Promise<void> {
  const pestana = page.getByRole("tab", { name: nombre });
  await pestana.click();
  await expect(pestana).toHaveAttribute("aria-selected", "true");
}

// La fila completa de la lista es un enlace: puede haber más de un enlace con el nombre.
async function abrirFichaSembrada(page: Page): Promise<void> {
  await page.goto(`/clientes?q=${encodeURIComponent(CLIENTE_SEMBRADO)}`);
  await page.getByRole("link", { name: CLIENTE_SEMBRADO }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: CLIENTE_SEMBRADO })).toBeVisible();
}

// Red de seguridad: si una prueba falla a medias, no deja clientes E2E activos en la base sembrada.
async function archivarClientesE2E(browser: Browser): Promise<void> {
  const contexto = await browser.newContext({ baseURL: BASE });
  const page = await contexto.newPage();
  try {
    await entrarComo(page, ATENCION_CLIENTE);
    const lista = await page.request.get("/api/v1/clientes?q=E2E-&porPagina=100");
    const filas = ((await lista.json()).datos ?? []) as { id: string; nombre: string }[];
    for (const fila of filas.filter((cliente) => cliente.nombre.startsWith("E2E-"))) await archivarPorApi(page, fila.id);
  } finally {
    await contexto.close();
  }
}

test.afterAll(async ({ browser }, info) => {
  if (info.project.name === "portatil") await archivarClientesE2E(browser);
});

test.describe("Atención al cliente gestiona clientes", () => {
  test("crea, edita, busca y archiva un cliente", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    const nombre = nombreE2E();
    await entrarComo(page, ATENCION_CLIENTE);

    await page.goto("/clientes");
    await page.getByRole("button", { name: "Nuevo cliente" }).click();
    const modal = page.getByRole("dialog");
    await llenarFormulario(page, {
      "cliente-rapido-nombre": nombre, "cliente-rapido-ruc": ` e2e ${Date.now()} `,
      "cliente-rapido-telefono": "8888 0101", "cliente-rapido-correo": "Contacto@E2E.test",
    });
    await modal.getByRole("button", { name: "Guardar cliente" }).click();
    await page.getByRole("button", { name: "Abrir ficha" }).click();

    await expect(page).toHaveURL(/\/clientes\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: nombre })).toBeVisible();
    await expect(page.getByText(/CLI-\d{4}/).first()).toBeVisible();
    await expect(page.getByRole("tab", { name: "Resumen" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("contacto@e2e.test")).toBeVisible();
    await abrirPestana(page, "Actividad");
    await expect(page.getByText("creó el cliente")).toBeVisible();

    await page.getByRole("link", { name: "Editar" }).click();
    await expect(page.locator("#nombre")).toHaveValue(nombre);
    await page.locator("#notas").fill("Cliente de prueba E2E");
    await page.locator("#contactoPrincipal").fill("Ana E2E");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Cliente de prueba E2E", { exact: true })).toBeVisible();
    await abrirPestana(page, "Actividad");
    await expect(page.getByText("editó el cliente")).toBeVisible();

    await page.goto("/clientes");
    await page.getByLabel("Buscar clientes", { exact: true }).fill(nombre.toLowerCase());
    await expect(page).toHaveURL(/q=e2e-/);
    await expect(page.getByRole("link", { name: nombre }).first()).toBeVisible();
    await page.getByRole("link", { name: nombre }).first().click();

    await page.getByRole("button", { name: "Archivar" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Archivar" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Cliente archivado" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Editar" })).toHaveCount(0);
    await abrirPestana(page, "Actividad");
    await expect(page.getByText("archivó el cliente")).toBeVisible();

    await page.goto(`/clientes?q=${encodeURIComponent(nombre)}`);
    await expect(page.getByText("Sin resultados", { exact: true })).toBeVisible();
    await page.goto(`/clientes?q=${encodeURIComponent(nombre)}&activo=false`);
    await expect(page.getByRole("link", { name: nombre }).first()).toBeVisible();
  });

  test("la lista muestra las columnas de cliente y la fila enlaza a la ficha", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    await entrarComo(page, ATENCION_CLIENTE);
    await page.goto(`/clientes?q=${encodeURIComponent(CLIENTE_SEMBRADO)}`);
    // Teléfono y correo van dentro de Contacto para que la tabla quepa desde 768 px.
    for (const columna of ["Cliente", "Contacto", "Cotizaciones"]) {
      await expect(page.getByRole("columnheader", { name: columna })).toBeVisible();
    }
    for (const columna of ["Estado", "Teléfono", "Correo"]) {
      await expect(page.getByRole("columnheader", { name: columna })).toHaveCount(0);
    }
    await expect(page.getByRole("link", { name: CLIENTE_SEMBRADO }).first()).toHaveAttribute(
      "href",
      /\/clientes\/[0-9a-f-]{36}$/,
    );
  });

  test("reactiva un cliente archivado y vuelve a poder editarlo", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    await entrarComo(page, ATENCION_CLIENTE);
    const cliente = await crearPorApi(page, { nombre: nombreE2E(), tipo: "PERSONA", telefono: "8888 0202" });
    await archivarPorApi(page, cliente.id);

    await page.goto(`/clientes/${cliente.id}`);
    await page.getByRole("button", { name: "Reactivar" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Reactivar" }).click();
    await expect(page.getByRole("link", { name: "Editar" })).toBeVisible();
    await abrirPestana(page, "Actividad");
    await expect(page.getByText("reactivó el cliente")).toBeVisible();
    await archivarPorApi(page, cliente.id);
  });

  test("el formulario valida por campo y lleva el foco al primer error", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    await entrarComo(page, ATENCION_CLIENTE);
    await page.goto("/clientes/nuevo");
    await page.getByRole("button", { name: "Guardar cliente" }).click();

    await expect(page.locator("#nombre")).toBeFocused();
    await expect(page.locator("#nombre")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#nombre-error")).toContainText("Ingrese el nombre del cliente.");
    await expect(page.locator("#telefono-error")).toContainText("Indique un teléfono o un correo electrónico.");
    await expect(page.locator("#correo")).toHaveAttribute("aria-describedby", /correo-error/);

    await page.locator("#nombre").fill(nombreE2E());
    await page.locator("#correo").fill("no-es-correo");
    await page.getByRole("button", { name: "Guardar cliente" }).click();
    await expect(page.locator("#correo")).toBeFocused();
    await expect(page.locator("#correo-error")).toContainText("correo electrónico válido");
  });

  test("un RUC repetido se señala en el campo RUC", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    await entrarComo(page, ATENCION_CLIENTE);
    const ruc = `E2E${Date.now()}`;
    const existente = await crearPorApi(page, { nombre: nombreE2E(), tipo: "EMPRESA", telefono: "8888 0303", ruc });

    await page.goto("/clientes/nuevo");
    await llenarFormulario(page, { nombre: nombreE2E(), telefono: "8888 0304", ruc: ruc.toLowerCase() });
    await page.getByRole("button", { name: "Guardar cliente" }).click();
    await expect(page.locator("#ruc-error")).toContainText("Ya existe un cliente con ese RUC.");
    await expect(page.locator("#ruc")).toBeFocused();
    await expect(page).toHaveURL(/\/clientes\/nuevo$/);
    await archivarPorApi(page, existente.id);
  });

  test("un conflicto de edición ofrece recargar los datos", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    await entrarComo(page, ATENCION_CLIENTE);
    const cliente = await crearPorApi(page, { nombre: nombreE2E(), tipo: "EMPRESA", telefono: "8888 0404" });
    await page.goto(`/clientes/${cliente.id}/editar`);
    await expect(page.locator("#nombre")).toHaveValue(/^E2E-/);

    const ajeno = await page.request.patch(`/api/v1/clientes/${cliente.id}`, {
      headers: { Origin: BASE },
      data: { version: cliente.actualizadoEn, notas: "Cambio hecho por otra persona" },
    });
    expect(ajeno.status()).toBe(200);

    await page.locator("#direccion").fill("Mi dirección");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Otra persona modificó este cliente" })).toBeVisible();
    await page.getByRole("button", { name: "Recargar datos" }).click();
    await expect(page.locator("#notas")).toHaveValue("Cambio hecho por otra persona");
    await expect(page.locator("#direccion")).toHaveValue("");
    await archivarPorApi(page, cliente.id);
  });

  test("la ficha de un cliente archivado no ofrece editar y la edición redirige a la ficha", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    await entrarComo(page, ATENCION_CLIENTE);
    const cliente = await crearPorApi(page, { nombre: nombreE2E(), tipo: "EMPRESA", telefono: "8888 0505" });
    await archivarPorApi(page, cliente.id);
    await page.goto(`/clientes/${cliente.id}/editar`);
    await expect(page).toHaveURL(new RegExp(`/clientes/${cliente.id}$`));
  });

  test("un identificador inexistente muestra la pantalla de cliente no encontrado", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    await entrarComo(page, ATENCION_CLIENTE);
    await page.goto("/clientes/00000000-0000-4000-8000-000000000000");
    await expect(page.getByText("Este cliente no existe")).toBeVisible();
    await page.goto("/clientes/abc");
    await expect(page.getByText("Este cliente no existe")).toBeVisible();
  });
});

test.describe("Gerencia y Operaciones consultan sin modificar", () => {
  for (const perfil of [GERENCIA, OPERACIONES]) {
    test(`${perfil.codigo} ve la lista y la ficha sin botones de gestión`, async ({ page }, info) => {
      soloUnaVez(info.project.name);
      await entrarComo(page, perfil);
      await page.goto("/clientes");
      await expect(page.getByRole("heading", { level: 1, name: "Clientes" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Nuevo cliente" })).toHaveCount(0);

      await abrirFichaSembrada(page);
      await expect(page.getByText(/CLI-\d{4}/).first()).toBeVisible();
      await expect(page.getByRole("link", { name: "Editar" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /Archivar|Reactivar/ })).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Nueva cotización" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Nueva cotización" })).toHaveCount(0);
      await abrirPestana(page, "Cotizaciones");
      await expect(page.getByRole("tabpanel")).toContainText(/COT-/);
      await abrirPestana(page, "Trabajos");
      await expect(page.getByRole("tabpanel")).toBeVisible();
    });
  }

  test("las rutas de gestión redirigen a sin-acceso y la API responde 403", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    await entrarComo(page, GERENCIA);
    await page.goto("/clientes/nuevo");
    await expect(page).toHaveURL(/\/sin-acceso$/);

    await abrirFichaSembrada(page);
    const id = new URL(page.url()).pathname.split("/").pop();
    await page.goto(`/clientes/${id}/editar`);
    await expect(page).toHaveURL(/\/sin-acceso$/);

    const respuesta = await page.request.patch(`/api/v1/clientes/${id}`, {
      headers: { Origin: BASE },
      data: { version: new Date().toISOString(), notas: "no debe guardarse" },
    });
    expect(respuesta.status()).toBe(403);
  });
});

test.describe("Producción y Administración no ven el módulo", () => {
  for (const perfil of [PRODUCCION, ADMINISTRACION]) {
    test(`${perfil.codigo} termina en sin-acceso al abrir clientes`, async ({ page }, info) => {
      soloUnaVez(info.project.name);
      await entrarComo(page, perfil);
      for (const ruta of ["/clientes", "/clientes/nuevo"]) {
        await page.goto(ruta);
        await expect(page).toHaveURL(/\/sin-acceso$/);
        await expect(page.getByText("No tiene permiso para ver esta sección")).toBeVisible();
      }
      expect((await page.request.get("/api/v1/clientes")).status()).toBe(403);
    });
  }
});

test.describe("Accesibilidad (axe) y adaptabilidad", () => {
  for (const vista of VIEWPORTS) {
    test(`lista, formulario y ficha sin violaciones graves en ${vista.nombre} (${vista.width} px)`, async ({ page }, info) => {
      soloUnaVez(info.project.name);
      test.setTimeout(90_000);
      await page.setViewportSize({ width: vista.width, height: vista.height });
      await entrarComo(page, ATENCION_CLIENTE);

      await page.goto("/clientes");
      await expect(page.getByRole("region", { name: "Listado de clientes" })).toBeVisible();
      expect(await violacionesGraves(page), "lista").toEqual([]);

      await page.goto("/clientes/nuevo");
      await expect(page.getByRole("heading", { level: 1, name: "Nuevo cliente" })).toBeVisible();
      expect(await violacionesGraves(page), "formulario").toEqual([]);
      await page.getByRole("button", { name: "Guardar cliente" }).click();
      await expect(page.locator("#nombre-error")).toBeVisible();
      expect(await violacionesGraves(page), "formulario con errores").toEqual([]);

      await abrirFichaSembrada(page);
      for (const pestana of PESTANAS_FICHA) {
        await abrirPestana(page, pestana);
        expect(await violacionesGraves(page), `ficha, pestaña ${pestana}`).toEqual([]);
      }
    });
  }

  test("lista y ficha no desbordan en horizontal", async ({ page }) => {
    await entrarComo(page, ATENCION_CLIENTE);
    await page.goto("/clientes");
    await expect(page.getByRole("region", { name: "Listado de clientes" })).toBeVisible();
    await sinDesbordeHorizontal(page);
    await abrirFichaSembrada(page);
    for (const pestana of PESTANAS_FICHA) {
      await abrirPestana(page, pestana);
      await sinDesbordeHorizontal(page);
    }
  });
});

test.describe("CF-11: capturas de la ficha con cotizaciones y trabajos", () => {
  for (const perfil of [GERENCIA, ATENCION_CLIENTE]) {
    test(`ficha de ${perfil.codigo} en los 4 anchos`, async ({ page }, info) => {
      soloUnaVez(info.project.name);
      test.setTimeout(120_000);
      fs.mkdirSync(CARPETA_CAPTURAS, { recursive: true });
      await entrarComo(page, perfil);
      await abrirFichaSembrada(page);
      for (const vista of VIEWPORTS) {
        await page.setViewportSize({ width: vista.width, height: vista.height });
        // Una captura por pestaña: la de Cotizaciones conserva el nombre anterior.
        for (const [pestana, sufijo] of [
          ["Cotizaciones", ""],
          ["Trabajos", "-trabajos"],
        ]) {
          await abrirPestana(page, pestana);
          await expect(page.getByRole("tabpanel")).toBeVisible();
          await page.evaluate(() => document.fonts.ready);
          await page.screenshot({
            path: path.join(CARPETA_CAPTURAS, `CF-11-${perfil.codigo.toLowerCase()}${sufijo}-${vista.nombre}.png`),
            fullPage: true,
          });
        }
      }
    });
  }
});
