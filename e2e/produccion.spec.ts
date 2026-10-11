import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

import { PERFILES, VIEWPORTS, iniciarSesion, sinDesbordeHorizontal, violacionesGraves } from "./ayudas";
import { elegir } from "./elegir";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const ORIGIN = new URL(BASE).origin;
const CAPTURAS = path.join("docs", "capturas", "produccion");
const SELLO = Date.now();
const MARCA = `E2E-${SELLO}-produccion-${Math.floor(Math.random() * 100000)}`;
const CODIGO = `E2E-${SELLO.toString(36)}-${Math.floor(Math.random() * 100000).toString(36)}`.toUpperCase();
const MATERIAL = `${MARCA}-material`;
const PERSONALIZADO = `${MARCA}-personalizado`;
const MANUAL = `${MARCA}-manual`;
const RETRABAJO = `${MARCA}-retrabajo`;
const CLIENTE = "Agencia Viajes Tropical";
const CATEGORIA = "Rotulación y gran formato";
const ETAPAS = ["Diseño y aprobación de arte", "Impresión", "Laminado y corte", "Armado de estructura", "Instalación"];
type Perfil = (typeof PERFILES)[number];
type Registro = { id: string; actualizadoEn: string };
type Cotizacion = Registro & { numero: string; asunto: string | null; archivada: boolean };
type Material = Registro & { codigo: string; activo: boolean; existencia: string };
type Etapa = Registro & { nombre: string; estado: string; area: { id: string; nombre: string } };
type Orden = Registro & { numero: string; estado: string; cotizacion: { asunto: string | null }; etapas: Etapa[] };
const perfil = (codigo: string) => PERFILES.find((fila) => fila.codigo === codigo)!;
const ATENCION_CLIENTE = perfil("ATENCION_CLIENTE"), GERENCIA = perfil("GERENCIA"), PRODUCCION = perfil("PRODUCCION");
const OPERACIONES = perfil("OPERACIONES"), ADMINISTRACION = perfil("ADMINISTRACION");
let material: Material;
let cotizacion: Cotizacion;
let orden: Orden;

test.use({ baseURL: BASE, ...(process.env.E2E_BROWSER_CHANNEL
  ? { browserName: "chromium" as const, channel: process.env.E2E_BROWSER_CHANNEL } : {}) });

async function entrarComo(page: Page, actor: Perfil): Promise<void> {
  const clave = process.env[actor.claveEnv];
  if (!clave) throw new Error(`Falta la variable ${actor.claveEnv}`);
  await page.context().clearCookies();
  await iniciarSesion(page, actor.correo, clave);
  await page.waitForURL(`**${actor.destino}`);
}

function soloPortatil(proyecto: string): void {
  test.skip(proyecto !== "portatil", "Los efectos y las capturas corren únicamente en portatil.");
}

function fechaFutura(dias: number): string {
  return new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);
}

function fechaVisible(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-");
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${dia} ${meses[Number(mes) - 1]} ${anio}`;
}

// El estado de la orden va en la insignia del encabezado de la ficha, junto al número.
function estadoOrden(page: Page, estado: string): Locator {
  return page.getByRole("heading", { level: 1 }).locator("xpath=../..").getByText(estado, { exact: true });
}

async function abrirPestana(page: Page, nombre: string): Promise<void> {
  // Solo la pestaña activa está en el DOM: se abre antes de buscar su contenido.
  const pestana = page.getByRole("tab", { name: nombre, exact: true });
  await pestana.click();
  await expect(pestana).toHaveAttribute("aria-selected", "true");
}

async function leer<T>(page: Page, ruta: string): Promise<T> {
  const respuesta = await page.request.get(`/api/v1${ruta}`);
  expect(respuesta.status(), await respuesta.text()).toBe(200);
  return (await respuesta.json()).datos as T;
}

async function escribir(page: Page, ruta: string, entrada: { cuerpo: object; estado?: number; idempotente?: boolean }): Promise<unknown> {
  const respuesta = await page.request.post(`/api/v1${ruta}`, {
    headers: { Origin: ORIGIN, ...(entrada.idempotente ? { "Idempotency-Key": randomUUID() } : {}) }, data: entrada.cuerpo,
  });
  expect(respuesta.status(), await respuesta.text()).toBe(entrada.estado ?? 200);
  return (await respuesta.json()).datos;
}

async function prepararMaterial(page: Page): Promise<void> {
  // Alta de material y entrada de inventario: Administración.
  await entrarComo(page, ADMINISTRACION);
  material = await escribir(page, "/materiales", { estado: 201,
    cuerpo: { codigo: CODIGO, nombre: MATERIAL, unidad: "PLIEGO", stockMinimo: "0", costoPromedio: "10" } }) as Material;
  await escribir(page, "/inventario/entradas", { estado: 201, idempotente: true,
    cuerpo: { materialId: material.id, cantidad: "10", costoUnitario: "10", referencia: `${MARCA}-entrada` } });
}

async function crearCotizacion(page: Page): Promise<void> {
  await page.goto("/cotizaciones");
  await page.getByRole("link", { name: "Nueva cotización" }).first().click();
  await elegir(page.getByLabel("Cliente", { exact: false }), CLIENTE, page);
  await page.getByLabel("Asunto").fill(MARCA);
  const creada = page.waitForResponse((r) => r.url().endsWith("/api/v1/cotizaciones") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Crear cotización" }).click();
  const respuesta = await creada;
  expect(respuesta.status(), await respuesta.text()).toBe(201);
  cotizacion = (await respuesta.json()).datos as Cotizacion;
  await expect(page).toHaveURL(new RegExp(`/cotizaciones/${cotizacion.id}/editar$`));
  await page.getByRole("button", { name: "Agregar catálogo" }).click();
  await elegir(page.getByRole("combobox", { name: /^Producto\b/, includeHidden: true }), /ROT-VIN-001/, page);
  await page.getByLabel("Ancho (m)").fill("2");
  await page.getByLabel("Alto (m)").fill("1.5");
  await page.getByRole("button", { name: "Agregar personalizado" }).click();
  await elegir(page.getByLabel("Categoría", { exact: false }), CATEGORIA, page);
  await page.getByLabel("Descripción del trabajo").fill(PERSONALIZADO);
  await page.getByRole("button", { name: "Agregar material", exact: true }).click();
  const linea = page.getByRole("group", { name: "Línea 1: Material" });
  await elegir(linea.getByLabel("Material registrado"), new RegExp(CODIGO), page);
  await linea.getByLabel("Descripción de costo").fill(MATERIAL);
  await linea.getByLabel("Cantidad total consumida").fill("4");
  await linea.getByLabel("Costo unitario (C$)").fill("10");
  await linea.getByLabel("Merma (%)").fill("0");
  await page.getByRole("button", { name: "Guardar ítems" }).click();
  await expect(page).toHaveURL(new RegExp(`/cotizaciones/${cotizacion.id}$`));
  await page.getByRole("button", { name: "Enviar cotización" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByRole("main")).toContainText("Enviada");
}

async function aprobarYConvertir(page: Page): Promise<void> {
  await entrarComo(page, GERENCIA);
  await page.goto(`/cotizaciones/${cotizacion.id}`);
  await expect(page.getByRole("main")).toContainText("Enviada");
  await expect(page.getByRole("button", { name: "Aprobar", exact: true })).toHaveCount(0);
  await entrarComo(page, OPERACIONES);
  await page.goto(`/cotizaciones/${cotizacion.id}`);
  await page.getByRole("button", { name: "Aprobar", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Referencia de aprobación").fill(`${MARCA}-referencia`);
  await page.getByRole("dialog").getByRole("button", { name: "Aprobar cotización" }).click();
  await expect(page.getByRole("main")).toContainText("Aprobada");
  // Atención al cliente registra la aprobación pero no crea la orden.
  await entrarComo(page, ATENCION_CLIENTE);
  await page.goto(`/cotizaciones/${cotizacion.id}`);
  await expect(page.getByRole("link", { name: "Convertir en orden", exact: true })).toHaveCount(0);
  await entrarComo(page, OPERACIONES);
  await page.goto(`/cotizaciones/${cotizacion.id}`);
  await page.getByRole("link", { name: "Convertir en orden", exact: true }).click();
  await expect(page.getByRole("form", { name: "Convertir cotización en orden" })).toBeVisible();
  await elegir(page.getByLabel("Responsable", { exact: true }), "Marco López", page);
  await page.getByLabel("Fecha de entrega").fill(fechaFutura(14));
  await page.getByLabel("Especificaciones").fill(`${MARCA}-especificaciones`);
  const creada = page.waitForResponse((r) => r.url().endsWith("/api/v1/ordenes") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Convertir en orden", exact: true }).click();
  const respuesta = await creada;
  expect(respuesta.status(), await respuesta.text()).toBe(201);
  orden = (await respuesta.json()).datos as Orden;
  await expect(page).toHaveURL(new RegExp(`/ordenes/${orden.id}$`));
  for (const nombre of ETAPAS) {
    await expect(filaEtapa(page, nombre)).toContainText("Pendiente");
    await expect(filaEtapa(page, nombre)).toContainText("Sin responsable");
  }
  await verificarCadena(page);
}

function filaEtapa(page: Page, nombre: string): Locator {
  return page.getByRole("table", { name: "Etapas de la orden" }).getByRole("row").filter({ hasText: nombre });
}

async function abrirOrden(page: Page): Promise<void> {
  await page.goto(`/ordenes/${orden.id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(orden.numero);
}

async function verificarHistorialEtapa(page: Page, actor: string): Promise<void> {
  // Cada transición muestra al actor y la fecha-hora.
  await abrirPestana(page, "Historial");
  const historial = page.getByRole("list", { name: "Historial de la orden" });
  for (const transicion of ["Pendiente → En curso", "En curso → Completada"]) {
    const entrada = historial.getByRole("listitem").filter({ hasText: transicion });
    await expect(entrada).toHaveCount(1);
    await expect(entrada).toContainText(actor);
    await expect(entrada).toContainText(/\d{1,2} (ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic) \d{4}/);
    await expect(entrada).toContainText(/\d{1,2}:\d{2}/);
  }
}

async function guardarDialogo(page: Page): Promise<void> {
  await page.getByRole("dialog").getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

async function asignar(page: Page, nombre: string): Promise<void> {
  await page.getByRole("button", { name: `Asignar responsable: ${nombre}`, exact: true }).click();
  await page.getByRole("dialog").getByLabel("Responsable", { exact: true }).selectOption({ label: "Marco López" });
  await guardarDialogo(page);
  await expect(filaEtapa(page, nombre)).toContainText("Marco López");
}

async function planificar(page: Page): Promise<void> {
  await asignar(page, ETAPAS[0]);
  await page.getByRole("button", { name: `Planificar fechas: ${ETAPAS[0]}`, exact: true }).click();
  await page.getByRole("dialog").getByLabel("Inicio planificado").fill(fechaFutura(1));
  await page.getByRole("dialog").getByLabel("Fin planificado").fill(fechaFutura(2));
  await guardarDialogo(page);
  for (const dias of [1, 2]) await expect(filaEtapa(page, ETAPAS[0])).toContainText(fechaVisible(fechaFutura(dias)));
}

async function ejecutarPrimera(page: Page): Promise<void> {
  const rechazo = page.waitForResponse((r) => /\/etapas\/[^/]+\/iniciar$/.test(r.url()));
  await page.getByRole("button", { name: `Iniciar: ${ETAPAS[1]}`, exact: true }).click();
  expect((await rechazo).status()).toBe(409);
  await expect(filaEtapa(page, ETAPAS[1]).getByRole("alert")).toContainText("Asigne un responsable antes de iniciar la etapa.");
  await expect(filaEtapa(page, ETAPAS[1])).toContainText("Pendiente");
  await page.getByRole("button", { name: `Iniciar: ${ETAPAS[0]}`, exact: true }).click();
  await expect(filaEtapa(page, ETAPAS[0])).toContainText("En curso");
  await expect(estadoOrden(page, "En producción")).toBeVisible();
  await page.getByRole("button", { name: `Completar: ${ETAPAS[0]}`, exact: true }).click();
  await expect(filaEtapa(page, ETAPAS[0])).toContainText("Completada");
  await verificarHistorialEtapa(page, "Marco López");
}

async function omitir(page: Page, nombre: string): Promise<void> {
  await page.getByRole("button", { name: `Omitir: ${nombre}`, exact: true }).click();
  await page.getByRole("dialog").getByLabel("Motivo").fill(`${MARCA}-omisión`);
  await page.getByRole("dialog").getByRole("button", { name: "Omitir etapa", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(filaEtapa(page, nombre)).toContainText("Omitida");
  await expect(filaEtapa(page, nombre)).toContainText(`${MARCA}-omisión`);
}

async function agregar(page: Page, retrabajo = false): Promise<void> {
  const titulo = retrabajo ? "Reabrir por retrabajo" : "Agregar etapa";
  const nombre = retrabajo ? RETRABAJO : MANUAL;
  await page.getByRole("button", { name: titulo, exact: true }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Área", { exact: false }).selectOption({ label: orden.etapas[0].area.nombre });
  await dialogo.getByLabel("Nombre de la etapa").fill(nombre);
  if (retrabajo) await dialogo.getByLabel("Motivo").fill(`${MARCA}-corregir arte`);
  await dialogo.getByRole("button", { name: titulo, exact: true }).click();
  await expect(dialogo).toHaveCount(0);
  await expect(filaEtapa(page, nombre)).toContainText("Pendiente");
  await expect(filaEtapa(page, nombre)).toContainText(orden.etapas[0].area.nombre);
}

async function cerrarYReabrir(page: Page): Promise<void> {
  await omitir(page, ETAPAS[1]);
  await page.getByRole("button", { name: `Restaurar: ${ETAPAS[1]}`, exact: true }).click();
  await expect(filaEtapa(page, ETAPAS[1])).toContainText("Pendiente");
  await expect(filaEtapa(page, ETAPAS[1])).not.toContainText(`${MARCA}-omisión`);
  await agregar(page);
  await expect(page.getByRole("button", { name: "Marcar lista", exact: true })).toBeDisabled();
  for (const nombre of [...ETAPAS.slice(1), MANUAL]) await omitir(page, nombre);
  await page.getByRole("button", { name: "Marcar lista", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Marcar lista", exact: true }).click();
  await expect(estadoOrden(page, "Lista")).toBeVisible();
  await agregar(page, true);
  await expect(estadoOrden(page, "En producción")).toBeVisible();
  await expect(page.getByRole("table", { name: "Etapas de la orden" }).getByRole("row")).toHaveCount(8);
  await asignar(page, RETRABAJO);
  await verificarHistorial(page);
}

async function verificarHistorial(page: Page): Promise<void> {
  await abrirPestana(page, "Historial");
  const historial = page.getByRole("list", { name: "Historial de la orden" });
  for (const texto of ["convirtió la cotización en orden", "asignó el responsable", "editó la orden", "creó una etapa",
    "Pendiente → En curso", "En curso → Completada", "Pendiente → Omitida", "Omitida → Pendiente",
    "En producción → Lista", "Lista → En producción", `${MARCA}-corregir arte`]) {
    await expect(historial).toContainText(texto);
  }
  await expect(historial).not.toContainText(/EN_PRODUCCION|EN_CURSO|CAMBIAR_ESTADO|ASIGNAR_RESPONSABLE/);
}

async function verificarCadena(page: Page): Promise<void> {
  await abrirPestana(page, "Cliente y cotización");
  await expect(page.getByRole("link", { name: CLIENTE, exact: true })).toHaveAttribute("href", /\/clientes\//);
  await expect(page.getByRole("link", { name: cotizacion.numero, exact: true })).toHaveAttribute("href", `/cotizaciones/${cotizacion.id}`);
  await abrirPestana(page, "Especificaciones");
  const items = page.getByRole("region", { name: "Ítems", exact: true });
  await expect(items.getByRole("heading", { level: 3 })).toHaveCount(2);
  await expect(items).toContainText("Rótulo vinil adhesivo personalizado");
  await expect(items).toContainText(PERSONALIZADO);
  await abrirPestana(page, "Consumo estimado");
  const estimado = page.getByRole("table", { name: "Consumo estimado de materiales" });
  await expect(estimado.getByRole("row").filter({ hasText: MATERIAL })).toContainText("4.000");
  await expect(estimado).toContainText("Vinil adhesivo blanco brillo");
  await expect(estimado).toContainText("Laminado mate 150 micras");
}

async function consumir(page: Page): Promise<void> {
  await escribir(page, `/ordenes/${orden.id}/consumos`, { estado: 201, idempotente: true,
    cuerpo: { lineas: [{ materialId: material.id, cantidad: "2" }] } });
  await abrirOrden(page);
  await abrirPestana(page, "Materiales consumidos");
  await expect(page.getByRole("link", { name: "Registrar consumo", exact: true })).toBeVisible();
  const fila = page.getByRole("table", { name: "Materiales de la orden" }).getByRole("row").filter({ hasText: MATERIAL });
  await expect(fila.getByRole("rowheader")).toHaveText(MATERIAL);
  await expect(fila.getByRole("cell")).toHaveText(["4.000 PLIEGO", "2.000 PLIEGO", "0.000 PLIEGO", "2.000 PLIEGO"]);
  await abrirPestana(page, "Historial");
  await expect(page.getByRole("list", { name: "Historial de la orden" })).toContainText("registró un consumo de material");
}

async function verificarTablero(page: Page): Promise<void> {
  await page.goto("/produccion");
  await page.getByRole("link", { name: "Mis etapas", exact: true }).click();
  await expect(page.getByLabel("Responsable", { exact: true })).not.toHaveValue("");
  await page.getByLabel("Buscar orden").fill(orden.numero);
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await expect(page.getByRole("columnheader", { name: "Fechas planificadas" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: orden.numero, exact: true })).toHaveCount(1);
  await expect(page.getByRole("main")).toContainText(RETRABAJO);
  for (const vista of ["Por área", "Por responsable"]) {
    await page.getByRole("button", { name: vista, exact: true }).click();
    await expect(page.getByRole("button", { name: vista, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("link", { name: orden.numero, exact: true })).toBeVisible();
    const grupo = vista === "Por área" ? orden.etapas[0].area.nombre : "Marco López";
    await expect(page.getByRole("heading", { name: `${grupo} (1)`, exact: true })).toBeVisible();
  }
}

async function capturar(page: Page, prefijo: string): Promise<void> {
  fs.mkdirSync(CAPTURAS, { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(CAPTURAS, `${prefijo}.png`), fullPage: true });
}

async function capturasProduccion(page: Page): Promise<void> {
  for (const vista of VIEWPORTS) {
    await page.setViewportSize({ width: vista.width, height: vista.height });
    await page.goto(`/produccion?q=${orden.numero}`);
    await expect(page.getByRole("link", { name: orden.numero, exact: true })).toBeVisible();
    await sinDesbordeHorizontal(page);
    await capturar(page, `CF-02-tablero-${vista.nombre}`);
    expect.soft(await violacionesGraves(page), `tablero ${vista.nombre}`).toEqual([]);
    await abrirOrden(page);
    await expect(page.getByRole("button", { name: `Iniciar: ${RETRABAJO}`, exact: true })).toBeVisible();
    await abrirPestana(page, "Materiales consumidos");
    await expect(page.getByRole("table", { name: "Materiales de la orden" })).toContainText(MATERIAL);
    await sinDesbordeHorizontal(page);
    await page.getByRole("region", { name: "Etapas de la orden", exact: true }).evaluate((elemento) => { elemento.scrollTop = elemento.scrollHeight; });
    await capturar(page, `CF-02-etapas-${vista.nombre}`);
    const resultado = await new AxeBuilder({ page }).include('section[aria-labelledby="titulo-etapas"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect.soft(resultado.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? "")), `etapas ${vista.nombre}`).toEqual([]);
    expect.soft(await violacionesGraves(page), `ficha ${vista.nombre}`).toEqual([]);
  }
}

async function consultarSinAcciones(page: Page, actor: Perfil): Promise<void> {
  await entrarComo(page, actor);
  await abrirOrden(page);
  await verificarCadena(page);
  await expect(filaEtapa(page, ETAPAS[0])).toContainText("Completada");
  await expect(filaEtapa(page, RETRABAJO)).toContainText("Pendiente");
  await expect(page.getByRole("button", { name: /^(Iniciar:|Completar:|Asignar responsable:|Planificar fechas:|Omitir:|Restaurar:|Agregar etapa$|Marcar lista$|Reabrir por retrabajo$|Asignar$)/ })).toHaveCount(0);
  const materiales = page.getByRole("tab", { name: "Materiales consumidos", exact: true });
  if (await materiales.count()) await abrirPestana(page, "Materiales consumidos");
  await expect(page.getByRole("link", { name: "Registrar consumo", exact: true })).toHaveCount(0);
  await page.goto(`/produccion?q=${orden.numero}`);
  await expect(page.getByRole("link", { name: orden.numero, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^(Iniciar:|Completar:)/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Mis etapas", exact: true })).toHaveCount(0);
}

async function cancelar(page: Page, fila: Orden): Promise<void> {
  const actual = await leer<Orden>(page, `/ordenes/${fila.id}`);
  expect(actual.cotizacion.asunto?.startsWith(MARCA)).toBe(true);
  if (actual.estado !== "CANCELADA") await escribir(page, `/ordenes/${fila.id}/cancelar`, {
    cuerpo: { version: actual.actualizadoEn, motivo: `${MARCA}-limpieza` } });
}

async function devolverNeto(page: Page, ordenId: string): Promise<void> {
  const consumo = await leer<{ materiales: { neto: string; material: { id: string; codigo: string } }[] }>(page, `/ordenes/${ordenId}/consumos`);
  for (const fila of consumo.materiales.filter((fila) => fila.material.codigo === CODIGO && Number(fila.neto) > 0)) {
    await escribir(page, `/ordenes/${ordenId}/devoluciones`, { estado: 201, idempotente: true,
      cuerpo: { lineas: [{ materialId: fila.material.id, cantidad: fila.neto }] } });
  }
}

async function vaciarMaterial(page: Page): Promise<void> {
  const filas = await leer<Material[]>(page, `/materiales?q=${CODIGO}&activo=todos&porPagina=100`);
  for (const fila of filas.filter((fila) => fila.codigo === CODIGO && fila.activo)) {
    const ficha = await leer<Material>(page, `/materiales/${fila.id}`);
    if (Number(ficha.existencia) > 0) await escribir(page, "/inventario/ajustes", { estado: 201, idempotente: true,
      cuerpo: { materialId: fila.id, direccion: "DISMINUIR", cantidad: ficha.existencia, motivo: `${MARCA}-limpieza` } });
    const vigente = await leer<Material>(page, `/materiales/${fila.id}`);
    await escribir(page, `/materiales/${fila.id}/archivar`, { cuerpo: { version: vigente.actualizadoEn } });
    const archivado = await leer<Material>(page, `/materiales/${fila.id}`);
    expect(archivado.existencia).toBe("0.000");
    expect(archivado.activo).toBe(false);
  }
}

async function limpiar(browser: Browser): Promise<void> {
  const contexto = await browser.newContext({ baseURL: BASE });
  const page = await contexto.newPage();
  const errores: unknown[] = [];
  let filas: Orden[] = [];
  const paso = async (actor: Perfil, accion: () => Promise<void>) => {
    try { await entrarComo(page, actor); await accion(); } catch (error) { errores.push(error); }
  };
  await paso(GERENCIA, async () => {
    filas = (await leer<Orden[]>(page, `/ordenes?q=${MARCA}&terminales=todas&porPagina=100`))
      .filter((fila) => fila.cotizacion.asunto?.startsWith(MARCA));
  });
  await paso(ADMINISTRACION, async () => { for (const fila of filas) await devolverNeto(page, fila.id); });
  await paso(OPERACIONES, async () => { for (const fila of filas) await cancelar(page, fila); });
  await paso(ADMINISTRACION, () => vaciarMaterial(page));
  await paso(ATENCION_CLIENTE, async () => {
    const cotizaciones = await leer<Cotizacion[]>(page, `/cotizaciones?q=${MARCA}&archivadas=false&porPagina=100`);
    for (const fila of cotizaciones.filter((fila) => fila.asunto?.startsWith(MARCA))) {
      const actual = await leer<Cotizacion>(page, `/cotizaciones/${fila.id}`);
      await escribir(page, `/cotizaciones/${fila.id}/archivar`, { cuerpo: { version: actual.actualizadoEn } });
    }
  });
  await contexto.close();
  if (errores.length) throw new AggregateError(errores, `Falló la limpieza de ${MARCA}`);
}

function registrarFlujo(): void {
  test("Atención al cliente cotiza y envía; Operaciones aprueba y convierte con etapas; Gerencia solo consulta", async ({ page }, info) => {
    soloPortatil(info.project.name);
    test.setTimeout(180000);
    await prepararMaterial(page);
    await entrarComo(page, ATENCION_CLIENTE);
    await crearCotizacion(page);
    await aprobarYConvertir(page);
  });

  test("Operaciones planifica, Producción ejecuta, Administración omite, restaura, reabre y consume", async ({ page }, info) => {
    soloPortatil(info.project.name);
    test.setTimeout(240000);
    await entrarComo(page, OPERACIONES);
    await abrirOrden(page);
    await planificar(page);
    // Operaciones planifica y asigna, pero no ejecuta etapas.
    await expect(page.getByRole("button", { name: /^(Iniciar|Completar):/ })).toHaveCount(0);
    await entrarComo(page, PRODUCCION);
    await abrirOrden(page);
    // Producción ejecuta, pero no planifica ni asigna.
    await expect(page.getByRole("button", { name: /^(Asignar responsable|Planificar fechas):/ })).toHaveCount(0);
    await ejecutarPrimera(page);
    await entrarComo(page, ADMINISTRACION);
    await abrirOrden(page);
    await cerrarYReabrir(page);
    await consumir(page);
    await entrarComo(page, PRODUCCION);
    await verificarTablero(page);
  });

  test("captura tablero y etapas; verifica axe y desbordes", async ({ page }, info) => {
    soloPortatil(info.project.name);
    test.setTimeout(180000);
    // Administración ejecuta etapas y ve los materiales consumidos.
    await entrarComo(page, ADMINISTRACION);
    await capturasProduccion(page);
  });
}

function registrarConsultaYCancelacion(): void {
  test("Atención al cliente y Gerencia consultan la cadena sin acciones de producción", async ({ page }, info) => {
    soloPortatil(info.project.name);
    test.setTimeout(120000);
    for (const actor of [ATENCION_CLIENTE, GERENCIA]) await consultarSinAcciones(page, actor);
    for (const vista of VIEWPORTS) {
      await page.setViewportSize({ width: vista.width, height: vista.height });
      await abrirOrden(page);
      await verificarCadena(page);
      await verificarHistorial(page);
      await abrirPestana(page, "Materiales consumidos");
      await expect(page.getByRole("table", { name: "Materiales de la orden" })).toContainText("2.000 PLIEGO");
      await sinDesbordeHorizontal(page);
      await capturar(page, `CF-09-orden-${vista.nombre}`);
    }
  });

  test("cancelar la orden elimina sus etapas del tablero", async ({ page }, info) => {
    soloPortatil(info.project.name);
    await entrarComo(page, PRODUCCION);
    await verificarTablero(page);
    await page.getByRole("button", { name: `Iniciar: ${RETRABAJO}`, exact: true }).click();
    await expect(page.getByRole("table", { name: "Etapas: Marco López", exact: true })).toContainText("En curso");
    // Gerencia solo consulta: la API rechaza la cancelación.
    await entrarComo(page, GERENCIA);
    const vigente = await leer<Orden>(page, `/ordenes/${orden.id}`);
    const rechazo = await page.request.post(`/api/v1/ordenes/${orden.id}/cancelar`, {
      headers: { Origin: ORIGIN }, data: { version: vigente.actualizadoEn, motivo: `${MARCA}-gerencia` },
    });
    expect(rechazo.status()).toBe(403);
    await entrarComo(page, OPERACIONES);
    await cancelar(page, orden);
    const cancelada = await leer<Orden>(page, `/ordenes/${orden.id}`);
    expect(cancelada.estado).toBe("CANCELADA");
    expect(cancelada.etapas.find((fila) => fila.nombre === RETRABAJO)?.estado).toBe("EN_CURSO");
    await entrarComo(page, PRODUCCION);
    await page.goto(`/produccion?q=${orden.numero}`);
    await expect(page.getByRole("paragraph").filter({ hasText: /^Sin etapas abiertas$/ })).toBeVisible();
    await expect(page.getByRole("link", { name: orden.numero, exact: true })).toHaveCount(0);
    const tablero = await page.request.get(`/api/v1/produccion/tablero?q=${orden.numero}`);
    expect(tablero.status()).toBe(200);
    expect((await tablero.json()).datos).toEqual([]);
  });
}

test.describe("Producción de una orden E2E", () => {
  test.describe.configure({ mode: "serial" });
  test.afterAll(async ({ browser }, info) => {
    test.setTimeout(180000);
    if (info.project.name === "portatil") await limpiar(browser);
  });
  registrarFlujo();
  registrarConsultaYCancelacion();
});

test("Administración técnica recibe sin acceso al abrir producción", async ({ page }) => {
  await entrarComo(page, perfil("ADMIN"));
  await page.goto("/produccion");
  await expect(page).toHaveURL(/\/sin-acceso$/);
});
