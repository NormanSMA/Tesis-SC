import { expect, test } from "@playwright/test";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import {
  PERFILES,
  VIEWPORTS,
  iniciarSesion,
  verificarMenuExacto,
  violacionesGraves,
  sinDesbordeHorizontal,
} from "./ayudas";

dotenv.config();

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

function leerVariableDeEjemplo(claveEnv: string): string {
  const envContent = fs.readFileSync(".env.example", "utf-8");
  const patron = new RegExp(`^${claveEnv}=(.+)$`, "m");
  const coincidencia = envContent.match(patron);
  if (!coincidencia) {
    throw new Error(`No se encontró ${claveEnv} en .env.example`);
  }
  return coincidencia[1];
}

function obtenerClave(claveEnv: string): string {
  const clave = process.env[claveEnv] ?? leerVariableDeEjemplo(claveEnv);
  if (!clave) {
    throw new Error(`No se pudo obtener clave de ${claveEnv}`);
  }
  return clave;
}

function crearDirectorioCapturasEsNecesario(): void {
  const dir = path.join("docs", "capturas", "fase2");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

test.describe("autenticacion", () => {
  test("sin sesion redirige a login", async ({ page }) => {
    await page.goto(`${BASE}/panel`);
    await expect(page).toHaveURL(`${BASE}/login`);
  });
});

test.describe("login - contraseña incorrecta", () => {
  test("muestra alerta con error", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByLabel("Correo electrónico").fill("alguien@test.test");
    await page.locator("#contrasena").fill("contraseña-incorrecta-123456");
    await page.getByRole("button", { name: "Ingresar" }).click();

    const alerta = page.getByRole("form", { name: "Inicio de sesión" }).getByRole("alert");
    await expect(alerta).toContainText("Correo o contraseña incorrectos");
  });
});

test.describe("login - captura error", () => {
  test("captura error en 1366x768", async ({ page }) => {
    crearDirectorioCapturasEsNecesario();

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`${BASE}/login`);
    await page.getByLabel("Correo electrónico").fill("alguien@test.test");
    await page.locator("#contrasena").fill("contraseña-incorrecta-123456");
    await page.getByRole("button", { name: "Ingresar" }).click();

    await page.waitForSelector("[role='alert']", { timeout: 5000 });
    await page.screenshot({ path: "docs/capturas/fase2/login-error.png", fullPage: true });
  });
});

test.describe("acceso denegado", () => {
  test("captura sin-acceso en 1366x768", async ({ page }) => {
    crearDirectorioCapturasEsNecesario();

    const perfil = PERFILES[0];
    const clave = obtenerClave(perfil.claveEnv);

    await iniciarSesion(page, perfil.correo, clave);
    await page.waitForURL(`${BASE}${perfil.destino}`);

    await page.goto(`${BASE}/admin/usuarios`);
    await expect(page).toHaveURL(`${BASE}/sin-acceso`);
    await expect(page.getByText("No tiene permiso para ver esta sección")).toBeVisible();

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.screenshot({ path: "docs/capturas/fase2/sin-acceso.png", fullPage: true });
  });
});

for (const perfil of PERFILES) {
  test.describe(`perfil ${perfil.codigo}`, () => {
    test.describe("login", () => {
      test(`login lleva a ${perfil.destino}`, async ({ page }) => {
        const clave = obtenerClave(perfil.claveEnv);

        await iniciarSesion(page, perfil.correo, clave);
        await page.waitForURL(`${BASE}${perfil.destino}`, { timeout: 10000 });
      });
    });

    test.describe("menú", () => {
      for (const viewport of VIEWPORTS) {
        test(`menú exacto en ${viewport.nombre}`, async ({ page }) => {
          const clave = obtenerClave(perfil.claveEnv);

          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await iniciarSesion(page, perfil.correo, clave);
          await page.waitForURL(`${BASE}${perfil.destino}`, { timeout: 10000 });

          await verificarMenuExacto(page, perfil.items);
        });
      }
    });

    test.describe("API", () => {
      test(`GET /api/v1/auth/yo devuelve perfil ${perfil.codigo}`, async ({ page }) => {
        const clave = obtenerClave(perfil.claveEnv);

        await iniciarSesion(page, perfil.correo, clave);
        await page.waitForURL(`${BASE}${perfil.destino}`, { timeout: 10000 });

        const respuesta = await page.request.get(`${BASE}/api/v1/auth/yo`);
        expect(respuesta.status()).toBe(200);

        const datos = await respuesta.json();
        expect(datos.datos.usuario.perfil).toBe(perfil.codigo);
      });

      test("POST /api/v1/auth/logout cierra sesión", async ({ page }) => {
        const clave = obtenerClave(perfil.claveEnv);

        await iniciarSesion(page, perfil.correo, clave);
        await page.waitForURL(`${BASE}${perfil.destino}`, { timeout: 10000 });

        const respuesta = await page.request.post(`${BASE}/api/v1/auth/logout`, {
          headers: {
            Origin: `http://127.0.0.1:3000`,
          },
        });
        expect(respuesta.status()).toBe(200);

        const respuestaYo = await page.request.get(`${BASE}/api/v1/auth/yo`);
        expect(respuestaYo.status()).toBe(401);
      });

      test("POST logout sin Origin devuelve 403", async ({ page }) => {
        const clave = obtenerClave(perfil.claveEnv);

        await iniciarSesion(page, perfil.correo, clave);
        await page.waitForURL(`${BASE}${perfil.destino}`, { timeout: 10000 });

        const respuesta = await page.request.post(`${BASE}/api/v1/auth/logout`);
        expect(respuesta.status()).toBe(403);
      });
    });

    for (const viewport of VIEWPORTS) {
      test.describe(`viewport ${viewport.nombre}`, () => {
        test(`captura ${viewport.nombre}`, async ({ page }) => {
          crearDirectorioCapturasEsNecesario();

          const clave = obtenerClave(perfil.claveEnv);

          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await iniciarSesion(page, perfil.correo, clave);
          await page.waitForURL(`${BASE}${perfil.destino}`, { timeout: 10000 });

          await expect(page.locator("main h1")).toBeVisible();

          await page.screenshot({
            path: `docs/capturas/fase2/${perfil.codigo.toLowerCase()}-${viewport.nombre}.png`,
            fullPage: true,
          });
        });
      });
    }

    for (const ruta of perfil.rutasProhibidas) {
      test(`ruta prohibida ${ruta} redirige a sin-acceso`, async ({ page }) => {
        const clave = obtenerClave(perfil.claveEnv);

        await iniciarSesion(page, perfil.correo, clave);
        await page.waitForURL(`${BASE}${perfil.destino}`, { timeout: 10000 });

        await page.goto(`${BASE}${ruta}`);
        await expect(page).toHaveURL(`${BASE}/sin-acceso`);
        await expect(page.getByText("No tiene permiso para ver esta sección")).toBeVisible();
      });
    }
  });
}

test.describe("accesibilidad axe", () => {
  const viewportsAxe = VIEWPORTS.filter((v) => v.nombre === "portatil" || v.nombre === "tableta");

  for (const perfil of PERFILES) {
    for (const viewport of viewportsAxe) {
      test(`${perfil.codigo} sin violaciones graves en ${viewport.nombre}`, async ({ page }) => {
        const clave = obtenerClave(perfil.claveEnv);

        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await iniciarSesion(page, perfil.correo, clave);
        await page.waitForURL(`${BASE}${perfil.destino}`, { timeout: 10000 });

        const graves = await violacionesGraves(page);
        expect(graves).toEqual([]);
      });
    }
  }
});

test.describe("desbordes", () => {
  for (const perfil of PERFILES) {
    for (const viewport of VIEWPORTS) {
      test(`${perfil.codigo} sin desborde en ${viewport.nombre}`, async ({ page }) => {
        const clave = obtenerClave(perfil.claveEnv);

        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await iniciarSesion(page, perfil.correo, clave);
        await page.waitForURL(`${BASE}${perfil.destino}`, { timeout: 10000 });

        await sinDesbordeHorizontal(page);
      });
    }
  }
});

test.describe("API sin sesión", () => {
  test("GET /api/v1/auth/yo sin sesión devuelve 401", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    const respuesta = await page.request.get(`${BASE}/api/v1/auth/yo`);
    expect(respuesta.status()).toBe(401);
  });
});
