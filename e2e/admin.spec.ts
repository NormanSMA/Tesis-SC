import { expect, test, type Browser, type Page } from "@playwright/test";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

import {
  PERFILES,
  VIEWPORTS,
  iniciarSesion,
  sinDesbordeHorizontal,
  verificarMenuExacto,
  violacionesGraves,
} from "./ayudas";

dotenv.config();

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const CARPETA_CAPTURAS = path.join("docs", "capturas", "admin");
const RUTAS_ADMIN = ["/admin/usuarios", "/admin/permisos", "/admin/configuracion"];
const PREFIJO_CORREO = "e2e-admin-";

test.use({ baseURL: BASE });

type Perfil = (typeof PERFILES)[number];

function perfilDe(codigo: string): Perfil {
  const perfil = PERFILES.find((valor) => valor.codigo === codigo);
  if (!perfil) throw new Error(`Perfil ${codigo} no existe en ayudas`);
  return perfil;
}

const ADMIN = perfilDe("ADMIN");
const OPERACIONES = perfilDe("OPERACIONES");
const OTROS_PERFILES = PERFILES.filter((perfil) => perfil.codigo !== "ADMIN");

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

// Las pruebas con efectos o con tamaño propio corren una sola vez: Playwright repite cada prueba por proyecto.
function soloUnaVez(proyecto: string) {
  test.skip(proyecto !== "portatil", "Esta prueba fija sus propios tamaños y corre solo en el proyecto portatil.");
}

function datosUsuarioE2E(): { nombre: string; correo: string } {
  const marca = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return { nombre: `E2E Admin ${marca}`, correo: `${PREFIJO_CORREO}${marca}@solucionescreativas.test` };
}

type UsuarioCreado = { id: string; correo: string; claveTemporal: string };

async function crearUsuarioPorApi(page: Page, perfiles: string[]): Promise<UsuarioCreado> {
  const datos = datosUsuarioE2E();
  const respuesta = await page.request.post("/api/v1/usuarios", { headers: { Origin: BASE }, data: { ...datos, perfiles } });
  expect(respuesta.status()).toBe(201);
  const cuerpo = (await respuesta.json()).datos as { usuario: { id: string; correo: string }; claveTemporal: string };
  return { id: cuerpo.usuario.id, correo: cuerpo.usuario.correo, claveTemporal: cuerpo.claveTemporal };
}

async function desactivarPorApi(page: Page, id: string): Promise<void> {
  const respuesta = await page.request.post(`/api/v1/usuarios/${id}/desactivar`, { headers: { Origin: BASE } });
  expect([200, 409]).toContain(respuesta.status());
}

// Red de seguridad: si una prueba falla a medias, no deja usuarios E2E activos en la base sembrada.
async function desactivarUsuariosE2E(browser: Browser): Promise<void> {
  const contexto = await browser.newContext({ baseURL: BASE });
  const page = await contexto.newPage();
  try {
    await entrarComo(page, ADMIN);
    const lista = await page.request.get(`/api/v1/usuarios?q=${PREFIJO_CORREO}`);
    const filas = ((await lista.json()).datos ?? []) as { id: string; correo: string; activo: boolean }[];
    for (const fila of filas.filter((usuario) => usuario.correo.startsWith(PREFIJO_CORREO) && usuario.activo)) {
      await desactivarPorApi(page, fila.id);
    }
  } finally {
    await contexto.close();
  }
}

test.afterAll(async ({ browser }, info) => {
  if (info.project.name === "portatil") await desactivarUsuariosE2E(browser);
});

async function intentarSesionEnContextoAparte(
  browser: Browser,
  correo: string,
  clave: string,
): Promise<{ contexto: Awaited<ReturnType<Browser["newContext"]>>; page: Page }> {
  const contexto = await browser.newContext({ baseURL: BASE });
  const page = await contexto.newPage();
  await iniciarSesion(page, correo, clave);
  return { contexto, page };
}

test.describe("ADMIN gestiona usuarios", () => {
  test("la lista muestra el título con conteos, filtros y columnas", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    await entrarComo(page, ADMIN);
    await page.goto("/admin/usuarios");

    await expect(page.getByRole("heading", { level: 1, name: /^\d+ usuarios activos, \d+ bloqueados$/ })).toBeVisible();
    await expect(page.locator("#usuarios-q")).toBeVisible();
    await expect(page.locator("#usuarios-perfil")).toBeVisible();
    await expect(page.locator("#usuarios-estado")).toBeVisible();
    const tabla = page.getByRole("region", { name: "Lista de usuarios" });
    for (const columna of ["Nombre", "Correo", "Perfiles", "Estado"]) {
      await expect(tabla.getByRole("columnheader", { name: columna, exact: true })).toBeVisible();
    }
    await expect(tabla.getByRole("row").filter({ hasText: ADMIN.correo })).toBeVisible();

    await page.locator("#usuarios-perfil").selectOption("ADMIN");
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await expect(page).toHaveURL(/perfil=ADMIN/);
    await expect(tabla.getByRole("row").filter({ hasText: ADMIN.correo })).toBeVisible();
  });

  test("crea un usuario con dos perfiles, muestra la clave una sola vez y el usuario inicia sesión", async ({ page, browser }, info) => {
    soloUnaVez(info.project.name);
    test.setTimeout(90_000);
    await entrarComo(page, ADMIN);
    const { nombre, correo } = datosUsuarioE2E();
    let id = "";
    try {
      await page.goto("/admin/usuarios/nuevo");
      await expect(page.getByRole("heading", { level: 1, name: "Nuevo usuario" })).toBeVisible();
      await page.locator("#usuario-nombre").fill(nombre);
      await page.locator("#usuario-correo").fill(correo);
      await page.locator("#perfil-OPERACIONES").click();
      await page.locator("#perfil-PRODUCCION").click();
      await page.getByRole("button", { name: "Crear usuario" }).click();

      await expect(page.getByRole("status").filter({ hasText: `Usuario creado: ${nombre}.` })).toBeVisible();
      const cuadro = page.getByRole("region", { name: "Clave temporal" });
      await expect(cuadro).toBeVisible();
      await expect(cuadro.getByText("No se vuelve a mostrar.")).toBeVisible();
      const clave = ((await cuadro.locator("code").textContent()) ?? "").trim();
      expect(clave.length).toBeGreaterThanOrEqual(14);

      await page.getByRole("link", { name: "Ver usuario" }).click();
      await expect(page).toHaveURL(/\/admin\/usuarios\/[0-9a-f-]{36}$/);
      id = page.url().split("/").pop() ?? "";
      await expect(page.getByRole("heading", { level: 1, name: "Ficha de usuario" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Clave temporal" })).toHaveCount(0);
      await page.reload();
      await expect(page.getByRole("heading", { level: 1, name: "Ficha de usuario" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Clave temporal" })).toHaveCount(0);
      await expect(page.getByText(clave)).toHaveCount(0);

      const { contexto, page: paginaNueva } = await intentarSesionEnContextoAparte(browser, correo, clave);
      try {
        await paginaNueva.waitForURL("**/panel", { timeout: 15_000 });
        await verificarMenuExacto(paginaNueva, OPERACIONES.items);
      } finally {
        await contexto.close();
      }
    } finally {
      if (id) await desactivarPorApi(page, id);
    }
  });

  test("desactiva a un usuario, no puede iniciar sesión y lo reactiva", async ({ page, browser }, info) => {
    soloUnaVez(info.project.name);
    test.setTimeout(90_000);
    await entrarComo(page, ADMIN);
    const usuario = await crearUsuarioPorApi(page, ["OPERACIONES"]);
    try {
      await page.goto(`/admin/usuarios/${usuario.id}`);
      await expect(page.getByRole("heading", { level: 1, name: "Ficha de usuario" })).toBeVisible();

      await page.getByRole("button", { name: "Desactivar", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Desactivar", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "Cambios guardados." })).toBeVisible();
      await expect(page.getByRole("button", { name: "Reactivar", exact: true })).toBeVisible();

      const inactivo = await intentarSesionEnContextoAparte(browser, usuario.correo, usuario.claveTemporal);
      try {
        await expect(inactivo.page.getByRole("alert").filter({ hasText: /\S/ })).toBeVisible();
        await expect(inactivo.page).toHaveURL(/\/login/);
      } finally {
        await inactivo.contexto.close();
      }

      await page.getByRole("button", { name: "Reactivar", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Reactivar", exact: true }).click();
      await expect(page.getByRole("button", { name: "Desactivar", exact: true })).toBeVisible();

      const activo = await intentarSesionEnContextoAparte(browser, usuario.correo, usuario.claveTemporal);
      try {
        await activo.page.waitForURL("**/panel", { timeout: 15_000 });
      } finally {
        await activo.contexto.close();
      }
    } finally {
      await desactivarPorApi(page, usuario.id);
    }
  });

  test("un ADMIN no puede desactivarse ni quitarse su perfil ADMIN", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    await entrarComo(page, ADMIN);
    await page.goto(`/admin/usuarios?q=${encodeURIComponent(ADMIN.correo)}`);
    await page.getByRole("row").filter({ hasText: ADMIN.correo }).getByRole("link").click();
    await expect(page).toHaveURL(/\/admin\/usuarios\/[0-9a-f-]{36}$/);
    const id = page.url().split("/").pop() ?? "";

    await page.getByRole("button", { name: "Desactivar", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Desactivar", exact: true }).click();
    const acciones = page.getByRole("region", { name: "Acciones del usuario" });
    await expect(acciones.getByRole("alert").filter({ hasText: "No se pudo completar la acción" })).toBeVisible();

    const formulario = page.getByRole("form", { name: "Editar usuario" });
    await page.locator("#perfil-OPERACIONES").click();
    await page.locator("#perfil-ADMIN").click();
    await formulario.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(formulario.getByRole("alert").filter({ hasText: "No se pudo completar la acción" })).toBeVisible();

    const respuesta = await page.request.get(`/api/v1/usuarios/${id}`);
    const usuario = (await respuesta.json()).datos as { activo: boolean; perfiles: string[] };
    expect(usuario.activo).toBe(true);
    expect(usuario.perfiles).toEqual(["ADMIN"]);
  });
});

test.describe("ADMIN gestiona permisos", () => {
  test("la matriz muestra 6 perfiles y las casillas protegidas de ADMIN están deshabilitadas", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    await entrarComo(page, ADMIN);
    await page.goto("/admin/permisos");
    const matriz = page.getByRole("region", { name: "Matriz de perfiles y permisos" });
    await expect(matriz).toBeVisible();

    const encabezados = matriz.getByRole("columnheader");
    await expect(encabezados).toHaveCount(7);
    for (const nombre of ["Gerencia", "Administración", "Operaciones", "Atención al cliente", "Producción", "Administración técnica"]) {
      await expect(encabezados.filter({ hasText: nombre }).first()).toBeVisible();
    }

    for (const permiso of ["usuario:gestionar", "permiso:gestionar", "configuracion:gestionar"]) {
      const casilla = matriz.getByRole("checkbox", { name: `Perfil ADMIN: permiso ${permiso}` });
      await expect(casilla).toBeDisabled();
      await expect(casilla).toBeChecked();
    }
  });

  test("otorga un permiso a un perfil y lo revoca de nuevo", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    test.setTimeout(90_000);
    await entrarComo(page, ADMIN);
    const original = await page.request.get("/api/v1/permisos");
    const matrizOriginal = ((await original.json()).datos.matriz ?? []) as { perfil: string; permisos: string[] }[];
    const permisosOriginales = matrizOriginal.find((fila) => fila.perfil === "GERENCIA")?.permisos;
    if (!permisosOriginales) throw new Error("No se encontró GERENCIA en la matriz");

    try {
      await page.goto("/admin/permisos");
      const matriz = page.getByRole("region", { name: "Matriz de perfiles y permisos" });
      await expect(matriz).toBeVisible();
      const candidata = matriz.locator('[role="checkbox"][aria-label^="Perfil GERENCIA: permiso "]:not([disabled])[aria-checked="false"]').first();
      const etiqueta = await candidata.getAttribute("aria-label");
      if (!etiqueta) throw new Error("GERENCIA ya tiene todos los permisos");
      const casilla = matriz.getByRole("checkbox", { name: etiqueta, exact: true });
      const guardar = page.getByRole("button", { name: "Guardar cambios", exact: true });
      const estado = page.getByRole("status").filter({ hasText: "Permisos de GERENCIA guardados." });

      await casilla.click();
      await expect(casilla).toBeChecked();
      await guardar.click();
      await page.getByRole("dialog").getByRole("button", { name: "Guardar cambios", exact: true }).click();
      await expect(estado).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);

      await page.reload();
      await expect(page.getByRole("checkbox", { name: etiqueta, exact: true })).toBeChecked();

      await page.getByRole("checkbox", { name: etiqueta, exact: true }).click();
      await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Guardar cambios", exact: true }).click();
      await expect(estado).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);

      await page.reload();
      await expect(page.getByRole("checkbox", { name: etiqueta, exact: true })).not.toBeChecked();
    } finally {
      const restaurar = await page.request.put("/api/v1/permisos/GERENCIA", {
        headers: { Origin: BASE },
        data: { permisos: permisosOriginales },
      });
      expect(restaurar.status()).toBe(200);
    }
  });
});

test.describe("ADMIN gestiona la configuración", () => {
  async function valorEmpresa(page: Page): Promise<string> {
    await page.goto("/admin/configuracion");
    await expect(page.locator("#config-empresa_nombre")).toBeVisible();
    return page.locator("#config-empresa_nombre").inputValue();
  }

  async function guardarEmpresa(page: Page, valor: string): Promise<void> {
    const formulario = page.getByRole("form", { name: "Parámetro Nombre de empresa" });
    await page.locator("#config-empresa_nombre").fill(valor);
    await formulario.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(formulario.getByRole("status").filter({ hasText: "Cambios guardados." })).toBeVisible();
  }

  test("cambia el nombre de empresa y lo restaura", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    await entrarComo(page, ADMIN);
    const original = await valorEmpresa(page);
    const nuevo = `Empresa E2E ${Date.now()}`;
    try {
      await guardarEmpresa(page, nuevo);
      await page.reload();
      await expect(page.locator("#config-empresa_nombre")).toHaveValue(nuevo);
    } finally {
      if ((await valorEmpresa(page)) !== original) await guardarEmpresa(page, original);
    }
    await page.reload();
    await expect(page.locator("#config-empresa_nombre")).toHaveValue(original);
  });

  test("un IVA fuera de rango muestra error por campo y la zona horaria es de solo lectura", async ({ page }, info) => {
    soloUnaVez(info.project.name);
    await entrarComo(page, ADMIN);
    await page.goto("/admin/configuracion");
    const formulario = page.getByRole("form", { name: "Parámetro IVA (%)" });
    await page.locator("#config-iva_porcentaje").fill("150");
    await formulario.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.locator("#config-iva_porcentaje-error")).toContainText("Indique un IVA entre 0 y 100.");
    await expect(page.locator("#config-iva_porcentaje")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#config-iva_porcentaje")).toBeFocused();

    const zona = page.locator("#config-zona_horaria");
    await expect(zona).toHaveAttribute("readonly", "");
    const formularioZona = page.getByRole("form", { name: "Parámetro Zona horaria" });
    await expect(formularioZona.getByText("La zona horaria es de solo lectura.")).toBeVisible();
    await expect(formularioZona.getByRole("button", { name: "Guardar" })).toHaveCount(0);
  });
});

test.describe("Los demás perfiles no acceden a Administración técnica", () => {
  for (const perfil of OTROS_PERFILES) {
    test(`${perfil.codigo} termina en sin-acceso en las tres rutas`, async ({ page }, info) => {
      soloUnaVez(info.project.name);
      await entrarComo(page, perfil);
      for (const ruta of RUTAS_ADMIN) {
        await page.goto(ruta);
        await expect(page).toHaveURL(/\/sin-acceso$/);
        await expect(page.getByText("No tiene permiso para ver esta sección")).toBeVisible();
      }
    });
  }
});

test.describe("Accesibilidad (axe), adaptabilidad y capturas", () => {
  const PANTALLAS = [
    { nombre: "usuarios", ruta: "/admin/usuarios", listo: (page: Page) => page.getByRole("region", { name: "Lista de usuarios" }) },
    { nombre: "permisos", ruta: "/admin/permisos", listo: (page: Page) => page.getByRole("region", { name: "Matriz de perfiles y permisos" }) },
    { nombre: "configuracion", ruta: "/admin/configuracion", listo: (page: Page) => page.locator("#config-iva_porcentaje") },
  ];

  for (const vista of VIEWPORTS) {
    test(`las tres pantallas cumplen axe y no desbordan en ${vista.nombre} (${vista.width} px)`, async ({ page }, info) => {
      soloUnaVez(info.project.name);
      test.setTimeout(120_000);
      fs.mkdirSync(CARPETA_CAPTURAS, { recursive: true });
      await page.setViewportSize({ width: vista.width, height: vista.height });
      await entrarComo(page, ADMIN);

      for (const pantalla of PANTALLAS) {
        await page.goto(pantalla.ruta);
        await expect(pantalla.listo(page)).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        expect(await violacionesGraves(page), `${pantalla.nombre} en ${vista.width}`).toEqual([]);
        await sinDesbordeHorizontal(page);
        await page.screenshot({
          path: path.join(CARPETA_CAPTURAS, `${pantalla.nombre}-${vista.nombre}.png`),
          fullPage: true,
        });
      }
    });
  }
});
