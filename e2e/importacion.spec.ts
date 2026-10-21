import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import dotenv from "dotenv";

import { COLUMNAS } from "@/modules/importacion/tipos";
import { PERFILES, usarSesion } from "./ayudas";

dotenv.config();
test.use({ baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000" });

test("importa el cliente válido e informa la fila inválida", async ({ page }, info) => {
  test.skip(info.project.name !== "portatil", "La importación con escritura corre una vez.");
  const perfil = PERFILES.find(({ codigo }) => codigo === "ATENCION_CLIENTE");
  if (!perfil) throw new Error("Falta el perfil con permiso cliente:gestionar.");
  const clave = process.env[perfil.claveEnv];
  if (!clave) throw new Error(`Configure ${perfil.claveEnv} para ejecutar la prueba.`);
  const nombre = `Importación ${randomUUID()}`;
  const texto = [COLUMNAS.clientes.join(","),
    `${nombre},PERSONA,,,8888 0101,,,`,
    `${nombre} inválido,PERSONA,,,,,,`,
  ].join("\n");

  await usarSesion(page, perfil);
  await page.goto("/importar");
  await page.getByLabel("Tipo de datos").selectOption("clientes");
  await page.getByLabel("Archivo CSV").setInputFiles({
    name: "clientes.csv", mimeType: "text/csv", buffer: Buffer.from(texto, "utf8"),
  });
  await page.getByRole("button", { name: "Validar", exact: true }).click();
  const filaError = page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "3", exact: true }) });
  await expect(filaError).toContainText("Indique un teléfono o un correo electrónico.");
  await expect(page.getByRole("button", { name: "Importar 1 fila", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Importar 1 fila", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Importación completada" }))
    .toHaveText("Importación completada: 1 filas importadas, 0 omitidas, 1 con error");
  await page.goto(`/clientes?q=${encodeURIComponent(nombre)}`);
  await expect(page.getByRole("link", { name: nombre, exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: `${nombre} inválido`, exact: true })).toHaveCount(0);
});
