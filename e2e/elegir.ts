import { expect, type Locator, type Page } from "@playwright/test";

export async function elegir(campo: Locator, opcion: string | RegExp, page: Page): Promise<void> {
  // La hidratación puede descartar el primer clic sobre un selector renderizado en el servidor.
  await expect(async () => {
    if (await campo.getAttribute("aria-expanded") !== "true") await campo.click();
    await expect(campo).toHaveAttribute("aria-expanded", "true", { timeout: 1000 });
  }).toPass({ timeout: 10000 });
  await page.getByRole("option", { name: opcion, exact: typeof opcion === "string" }).click();
}

/** Campo de datos que puede ser lista nativa (pocas opciones) o lista con búsqueda (7 o más). */
export async function elegirDato(campo: Locator, opcion: string, page: Page): Promise<void> {
  if (await campo.evaluate((elemento) => elemento.tagName === "SELECT")) await campo.selectOption({ label: opcion });
  else await elegir(campo, opcion, page);
}

export const PERSONAL_DE_PRUEBA: Record<string, string> = {
  "Diseño Gráfico": "Marco López",
  "Impresión Digital": "Gabriel Cortez",
  "Grabado y Corte Láser": "Alfonso Mejía",
  Taller: "Humberto Silva",
};

export async function elegirAreasDeOrden(page: Page, areas: string[]): Promise<void> {
  for (const area of areas) {
    const casilla = page.getByRole("checkbox", { name: new RegExp(`^${area}`) });
    const responsable = page.getByRole("combobox", { name: `Responsable de ${area}` });
    await expect(async () => {
      await casilla.check();
      await expect(responsable).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 10000 });
    const opcion = page.getByRole("option", { name: PERSONAL_DE_PRUEBA[area], exact: true });
    await expect(async () => {
      if (!await opcion.isVisible()) await responsable.click();
      await expect(opcion).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 10000 });
    await opcion.click();
    await page.getByRole("textbox", { name: `Instrucciones de ${area}` }).fill(`Trabajo de ${area}`);
  }
}
