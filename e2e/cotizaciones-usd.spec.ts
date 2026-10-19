import { expect, test, type Page } from "@playwright/test";
import dotenv from "dotenv";
import fs from "fs";

import { PERFILES, iniciarSesion } from "./ayudas";

dotenv.config();

// El tipo de cambio se muestra como «C$ 36.6243 por US$ 1»: es el único uso legítimo de C$ en un documento en dólares.
const C_FUERA_DEL_TIPO_DE_CAMBIO = /C\$(?!\s*\d+(\.\d+)?\s*por US\$)/;

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const CLIENTE_SEMBRADO = "Agencia Viajes Tropical";

test.use({ baseURL: BASE });

const ATENCION_CLIENTE = PERFILES.find((perfil) => perfil.codigo === "ATENCION_CLIENTE") as (typeof PERFILES)[number];

function claveDe(perfil: (typeof PERFILES)[number]): string {
  const directa = process.env[perfil.claveEnv];
  if (directa) return directa;
  const ejemplo = fs.readFileSync(".env.example", "utf-8");
  const coincidencia = ejemplo.match(new RegExp(`^${perfil.claveEnv}=(.+)$`, "m"));
  if (!coincidencia) throw new Error(`No se encontró ${perfil.claveEnv}`);
  return coincidencia[1];
}

async function elegirEn(page: Page, id: string, opcion: string | RegExp): Promise<void> {
  await page.locator(`[id="${id}"]`).click();
  await page.getByRole("option", { name: opcion }).click();
}

async function archivarPorApi(page: Page, id: string): Promise<void> {
  const actual = await page.request.get(`/api/v1/cotizaciones/${id}`);
  const { archivada, actualizadoEn } = (await actual.json()).datos as { archivada: boolean; actualizadoEn: string };
  if (archivada) return;
  const respuesta = await page.request.post(`/api/v1/cotizaciones/${id}/archivar`, {
    headers: { Origin: BASE },
    data: { version: actualizadoEn },
  });
  expect([200, 409]).toContain(respuesta.status());
}

test("Atención al cliente cotiza en dólares: encabezado, editor, proforma y lista usan US$", async ({ page }, info) => {
  test.skip(info.project.name !== "portatil", "Esta prueba tiene efectos y corre solo en el proyecto portatil.");
  test.setTimeout(120_000);
  const asunto = `E2E-USD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  let id: string | null = null;

  await iniciarSesion(page, ATENCION_CLIENTE.correo, claveDe(ATENCION_CLIENTE));
  await page.waitForURL(`**${ATENCION_CLIENTE.destino}`, { timeout: 15_000 });

  try {
    await page.goto("/cotizaciones");
    await page.goto("/cotizaciones/nueva"); // El botón de la lista abre el drawer; aquí se usa la página completa.
    await expect(page.getByRole("heading", { level: 1, name: "Nueva cotización" })).toBeVisible();
    await elegirEn(page, "clienteId", CLIENTE_SEMBRADO);
    await elegirEn(page, "moneda", "Dólares (USD)");
    await page.locator("#asunto").fill(asunto);
    await page.getByRole("button", { name: "Crear cotización" }).click();
    await expect(page).toHaveURL(/\/cotizaciones\/[0-9a-f-]{36}\/editar$/);
    id = page.url().split("/").slice(-2)[0];

    // Editor: ítem de catálogo por m², importes en dólares.
    await page.getByRole("button", { name: "Agregar catálogo" }).click();
    await elegirEn(page, "items.0.productoId", /ROT-VIN-001/);
    await page.locator('[id="items.0.ancho"]').fill("2");
    await page.locator('[id="items.0.alto"]').fill("1.5");
    await expect(page.getByText("Cobro: m².")).toBeVisible();
    const totalesEditor = page.getByLabel("Totales de cotización");
    await expect(totalesEditor).toContainText("US$");
    await expect(totalesEditor).not.toContainText("C$");
    const editor = page.getByRole("form", { name: "Ítems de cotización" });
    await expect(editor).toContainText(/Moneda:\s*Dólares \(USD\)/);
    await expect(editor).not.toContainText(C_FUERA_DEL_TIPO_DE_CAMBIO);

    await page.getByRole("button", { name: "Guardar ítems" }).click();
    await expect(page).toHaveURL(/\/cotizaciones\/[0-9a-f-]{36}$/);

    // Ficha: moneda, tipo de cambio e importes.
    const numero = ((await page.getByRole("heading", { level: 1 }).textContent()) ?? "").trim();
    expect(numero).toMatch(/^COT-/);
    const resumen = page.getByLabel("Resumen de la cotización");
    await expect(resumen).toContainText(/Moneda:\s*Dólares \(USD\)/);
    await expect(resumen).toContainText(/Tipo de cambio:?\s*(C\$\s*)?\d+(\.\d+)?/i);
    const totalesDetalle = page.getByLabel("Totales de cotización");
    await expect(totalesDetalle).toContainText("US$");
    await expect(totalesDetalle).not.toContainText("C$");
    const fila = page.getByRole("row", { name: /Rótulo vinil adhesivo personalizado/ });
    await expect(fila).toContainText("US$");
    await expect(fila).not.toContainText("C$");

    // Proforma imprimible.
    await page.goto(`/cotizaciones/${id}/imprimir`);
    const proforma = page.locator("#proforma");
    await expect(proforma).toContainText(`Proforma ${numero}`);
    await expect(proforma).toContainText(/Moneda:\s*Dólares \(USD\)/);
    await expect(proforma).toContainText("US$");
    await expect(proforma).not.toContainText(C_FUERA_DEL_TIPO_DE_CAMBIO);

    // Lista: el total conserva la moneda original.
    await page.goto(`/cotizaciones?q=${encodeURIComponent(asunto)}`);
    const filaLista = page.getByRole("row", { name: new RegExp(numero) });
    await expect(filaLista).toBeVisible();
    await expect(filaLista).toContainText("US$");
    await expect(filaLista).not.toContainText("C$");
  } finally {
    if (id) await archivarPorApi(page, id);
  }
});
