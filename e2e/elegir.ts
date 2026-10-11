import { expect, type Locator, type Page } from "@playwright/test";

export async function elegir(campo: Locator, opcion: string | RegExp, page: Page): Promise<void> {
  // La hidratación puede descartar el primer clic sobre un selector renderizado en el servidor.
  await expect(async () => {
    if (await campo.getAttribute("aria-expanded") !== "true") await campo.click();
    await expect(campo).toHaveAttribute("aria-expanded", "true", { timeout: 1000 });
  }).toPass({ timeout: 10000 });
  await page.getByRole("option", { name: opcion, exact: typeof opcion === "string" }).click();
}
