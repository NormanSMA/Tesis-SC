import { expect, test, type Page } from "@playwright/test";
import "dotenv/config";

import { PERFILES, iniciarSesion, verificarMenuExacto } from "./ayudas";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const TIMEOUT = 10_000;

type Medicion = {
  tipo: "superposicion" | "desborde" | "texto-recortado" | "carga";
  selectores: [string, string];
  area: number;
  mensaje: string;
};
type Hallazgo = Medicion & { perfil: string; ruta: string; ancho: number };

test.use({ baseURL: BASE });

async function esperarPagina(page: Page): Promise<void> {
  await expect(page.locator("main")).toBeVisible({ timeout: TIMEOUT });
  await expect(page.locator('main [aria-busy="true"], main [role="progressbar"]')).toHaveCount(0);
  await expect(page.locator("main").getByText(/^Cargando(?:\s|\.|…|$)/i).first()).toBeHidden();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations()
      .filter((animacion) => animacion.effect?.getComputedTiming().iterations !== Infinity)
      .map((animacion) => animacion.finished.catch(() => undefined)));
  });
}

async function medirPagina(page: Page): Promise<Medicion[]> {
  return page.evaluate(() => {
    const hallazgos: Medicion[] = [];
    const controles = 'button, a, h1, h2, h3, h4, h5, h6, label, td, th, input, textarea, select, '
      + '[role="button"], [role="link"], [role="heading"], [role="cell"], [role="columnheader"]';
    const campos = 'input, textarea, select, [role="textbox"], [role="combobox"]';

    function selector(elemento: Element): string {
      const partes: string[] = [];
      let actual: Element | null = elemento;
      while (actual) {
        if (actual.id) {
          partes.unshift(`#${CSS.escape(actual.id)}`);
          if (document.querySelectorAll(partes.join(" > ")).length === 1) break;
        } else {
          const hermanos = actual.parentElement ? Array.from(actual.parentElement.children) : [actual];
          partes.unshift(`${actual.localName}:nth-child(${hermanos.indexOf(actual) + 1})`);
        }
        actual = actual.parentElement;
      }
      return partes.join(" > ");
    }

    function visible(elemento: HTMLElement): boolean {
      const caja = elemento.getBoundingClientRect();
      if (caja.width <= 0 || caja.height <= 0) return false;
      if (getComputedStyle(elemento).visibility !== "visible") return false;
      // Audita también contenido bajo el pliegue; excluye ocultación heredada y menús cerrados.
      for (let actual: HTMLElement | null = elemento; actual; actual = actual.parentElement) {
        const estilo = getComputedStyle(actual);
        if (Number(estilo.opacity) === 0 || estilo.display === "none"
          || actual.getAttribute("aria-hidden") === "true" || actual.hidden
          || actual.hasAttribute("inert")) return false;
        // El contenido de un <details> cerrado no se muestra, aunque conserve cajas medibles.
        if (actual instanceof HTMLDetailsElement && !actual.open && !elemento.closest("summary")) return false;
        if (actual.matches('[role="menu"], [role="listbox"], [role="dialog"], [popover]')
          && actual.getAttribute("data-state") === "closed") return false;
      }
      return true;
    }

    function superposicionDeliberada(elemento: HTMLElement): boolean {
      // El enlace de salto ocupa una capa independiente cuando recibe foco.
      if (elemento.closest("a")?.textContent?.trim() === "Saltar al contenido") return true;
      // Excluye controles posicionados y barras adhesivas (sticky) pensadas para superponerse al desplazar.
      for (let actual: HTMLElement | null = elemento; actual && actual.id !== "menu-principal" && actual.tagName !== "MAIN";
        actual = actual.parentElement) {
        if (["absolute", "fixed", "sticky"].includes(getComputedStyle(actual).position)) return true;
      }
      // Excluye contenido de capas flotantes; sus cajas no representan el flujo principal.
      const capa = elemento.closest('[role="menu"], [role="listbox"], [role="tooltip"], [role="dialog"], [popover]');
      return capa !== null && ["absolute", "fixed"].includes(getComputedStyle(capa).position);
    }

    function textoPropio(elemento: HTMLElement): boolean {
      if (elemento.matches(campos)) return true;
      if (elemento.matches(controles)) return Boolean(elemento.textContent?.trim());
      // Usa la caja del control; descarta sus spans decorativos para evitar hallazgos duplicados.
      if (elemento.parentElement?.closest(controles)) return false;
      return Array.from(elemento.childNodes).some((nodo) =>
        nodo.nodeType === Node.TEXT_NODE && Boolean(nodo.textContent?.trim()));
    }

    // Recorta la caja con los contenedores que ocultan o desplazan su desbordamiento (tablas con scroll,
    // listas con altura máxima). Lo que queda fuera del recorte no se ve y no se superpone con el resto.
    function cajaVisible(elemento: HTMLElement): DOMRect | null {
      let { left, right, top, bottom } = elemento.getBoundingClientRect();
      for (let actual = elemento.parentElement; actual && actual !== document.body; actual = actual.parentElement) {
        const estilo = getComputedStyle(actual);
        if (estilo.overflowX === "visible" && estilo.overflowY === "visible") continue;
        const marco = actual.getBoundingClientRect();
        if (estilo.overflowX !== "visible") { left = Math.max(left, marco.left); right = Math.min(right, marco.right); }
        if (estilo.overflowY !== "visible") { top = Math.max(top, marco.top); bottom = Math.min(bottom, marco.bottom); }
        if (right <= left || bottom <= top) return null;
      }
      return new DOMRect(left, top, right - left, bottom - top);
    }

    function contiene(caja: DOMRect, otra: DOMRect): boolean {
      return caja.left <= otra.left && caja.right >= otra.right
        && caja.top <= otra.top && caja.bottom >= otra.bottom;
    }

    function comparar(elementos: { elemento: HTMLElement; caja: DOMRect; selector: string }[]): void {
      for (let i = 0; i < elementos.length; i += 1) {
        const primero = elementos[i];
        for (let j = i + 1; j < elementos.length; j += 1) {
          const segundo = elementos[j];
          // Los pares ancestro-descendiente y las cajas contenidas expresan composición legítima.
          if (primero.elemento.contains(segundo.elemento) || segundo.elemento.contains(primero.elemento)
            || contiene(primero.caja, segundo.caja) || contiene(segundo.caja, primero.caja)) continue;
          const ancho = Math.max(0, Math.min(primero.caja.right, segundo.caja.right)
            - Math.max(primero.caja.left, segundo.caja.left));
          const alto = Math.max(0, Math.min(primero.caja.bottom, segundo.caja.bottom)
            - Math.max(primero.caja.top, segundo.caja.top));
          const area = ancho * alto;
          if (area > 4) hallazgos.push({
            tipo: "superposicion", selectores: [primero.selector, segundo.selector], area,
            mensaje: "Cajas superpuestas en más de 4 px²",
          });
        }
      }
    }

    // Una tabla ancha dentro de un contenedor con scroll horizontal propio no desborda la página.
    function dentroDeScrollHorizontal(elemento: HTMLElement): boolean {
      for (let actual = elemento.parentElement; actual && actual.tagName !== "MAIN"; actual = actual.parentElement) {
        if (["auto", "scroll", "hidden"].includes(getComputedStyle(actual).overflowX)) return true;
      }
      return false;
    }

    function comprobarDesborde(elemento: HTMLElement): void {
      if (dentroDeScrollHorizontal(elemento)) return;
      const caja = elemento.getBoundingClientRect();
      // Un contenedor con scroll propio se mide por su caja; su contenido interno se desplaza dentro de él.
      const conScroll = ["auto", "scroll"].includes(getComputedStyle(elemento).overflowX);
      const exceso = Math.max(conScroll ? 0 : elemento.scrollWidth - innerWidth, caja.right - innerWidth, -caja.left);
      if (exceso > 1) hallazgos.push({
        tipo: "desborde", selectores: [selector(elemento), "html"],
        area: exceso * caja.height,
        mensaje: `scrollWidth=${elemento.scrollWidth}, innerWidth=${innerWidth}, left=${caja.left}, right=${caja.right}`,
      });
    }

    function comprobarTexto(elemento: HTMLElement): void {
      if (!elemento.matches('button, label, [role="button"]') || !elemento.textContent?.trim()) return;
      // Revisa también el span que aplica overflow:hidden dentro del botón o etiqueta.
      for (const texto of [elemento, ...elemento.querySelectorAll<HTMLElement>("*")]) {
        if (!visible(texto) || !texto.textContent?.trim()) continue;
        if (getComputedStyle(texto).overflowX !== "hidden" || texto.scrollWidth <= texto.clientWidth + 1) continue;
        hallazgos.push({
          tipo: "texto-recortado", selectores: [selector(texto), selector(elemento)],
          area: (texto.scrollWidth - texto.clientWidth) * texto.getBoundingClientRect().height,
          mensaje: `scrollWidth=${texto.scrollWidth}, clientWidth=${texto.clientWidth}`,
        });
      }
    }

    const elementos = Array.from(document.querySelectorAll<HTMLElement>(
      "main, main *, #menu-principal, #menu-principal *",
    )).filter((elemento) => visible(elemento) && !superposicionDeliberada(elemento));
    comparar(elementos.filter(textoPropio).flatMap((elemento) => {
      const caja = cajaVisible(elemento);
      return caja ? [{ elemento, caja, selector: selector(elemento) }] : [];
    }));
    for (const elemento of elementos) {
      if (elemento.closest("main")) comprobarDesborde(elemento);
      comprobarTexto(elemento);
    }
    return hallazgos;
  });
}

async function rutasMenu(page: Page, perfil: (typeof PERFILES)[number]): Promise<string[]> {
  await verificarMenuExacto(page, perfil.items);
  const menu = page.locator("#menu-principal").getByRole("navigation", { name: "Principal" });
  await expect(menu).toBeVisible();
  const rutas = new Set<string>([perfil.destino]);
  for (const enlace of await menu.locator("a[href]").all()) {
    if (!await enlace.isVisible()) continue;
    const href = await enlace.getAttribute("href");
    if (!href) continue;
    const url = new URL(href, page.url());
    expect(url.origin, "El menú principal debe contener rutas locales").toBe(new URL(BASE).origin);
    rutas.add(`${url.pathname}${url.search}`);
  }
  expect(rutas.size, "El menú debe contener todas las rutas del perfil").toBe(perfil.items.length);
  return [...rutas];
}

for (const perfil of PERFILES) {
  test(`RNF-08: superposición y desborde de ${perfil.codigo}`, async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    const clave = process.env[perfil.claveEnv];
    if (!clave) throw new Error(`Falta la variable ${perfil.claveEnv}`);
    await iniciarSesion(page, perfil.correo, clave);
    await page.waitForURL(new URL(perfil.destino, BASE).href, { timeout: TIMEOUT });
    await esperarPagina(page);
    const rutas = await rutasMenu(page, perfil);
    const ancho = await page.evaluate(() => innerWidth);
    expect([768, 1024, 1366, 1920]).toContain(ancho);
    const hallazgos: Hallazgo[] = [];
    for (const ruta of rutas) {
      try {
        await page.goto(ruta, { waitUntil: "load", timeout: TIMEOUT });
        await expect(page).toHaveURL(new URL(ruta, BASE).href);
        await esperarPagina(page);
        for (const medicion of await medirPagina(page)) {
          hallazgos.push({ ...medicion, perfil: perfil.codigo, ruta, ancho });
        }
      } catch (error) {
        hallazgos.push({
          perfil: perfil.codigo, ruta, ancho, tipo: "carga", selectores: ["main", "#menu-principal"], area: 0,
          mensaje: error instanceof Error ? error.message : String(error),
        });
      }
    }
    await testInfo.attach("superposicion", {
      body: Buffer.from(JSON.stringify(hallazgos, null, 2)), contentType: "application/json",
    });
    const detalle = hallazgos.map((hallazgo) =>
      `[${hallazgo.perfil}] ${hallazgo.ruta} (${hallazgo.ancho}px): ${hallazgo.tipo}; `
      + `${hallazgo.selectores.join(" <> ")}; área=${hallazgo.area.toFixed(2)}px²; ${hallazgo.mensaje}`,
    ).join("\n");
    expect(hallazgos, `Hallazgos acumulados:\n${detalle}`).toEqual([]);
  });
}
