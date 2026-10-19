import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import tailwindcss from "@tailwindcss/postcss";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PageHeader } from "@/components/comunes/PageHeader";
import { PERMISOS_POR_PERFIL, type PerfilCodigo } from "@/core/permisos";
import { EtapasOrden } from "@/modules/ordenes/componentes/EtapasOrden";
import { AccionesEtapa, type PermisosEtapas } from "@/modules/produccion/componentes/AccionesEtapa";
import { AccionesProduccionOrden } from "@/modules/produccion/componentes/AccionesProduccionOrden";
import { AdministracionAreas } from "@/modules/produccion/componentes/AdministracionAreas";
import { AdministracionPlantillas } from "@/modules/produccion/componentes/AdministracionPlantillas";
import { FiltrosProduccion } from "@/modules/produccion/componentes/FiltrosProduccion";
import { TableroProduccion } from "@/modules/produccion/componentes/TableroProduccion";
import type { AreaDto, EtapaTablero, GrupoEtapas, PlantillaDto } from "@/modules/produccion/tipos";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/produccion", useSearchParams: () => new URLSearchParams(),
}));

const id = "11111111-1111-4111-8111-111111111111";
const version = "2026-10-06T12:00:00.000Z";
const area: AreaDto = { id, nombre: "Área de impresión y terminación de gran formato", activo: true, actualizadoEn: version };
const responsable = { id, nombre: "Responsable de producción con nombre extenso" };
const etapa: EtapaTablero = { id, secuencia: 1, nombre: "Preparación e impresión del trabajo solicitado", estado: "PENDIENTE",
  area, responsable, fechaInicioPlan: "2026-10-05", fechaFinPlan: "2026-10-06", fechaInicioReal: null,
  fechaFinReal: null, observaciones: "Observaciones de planificación", actualizadoEn: version,
  orden: { id, numero: "OT-2026-0001", estado: "PENDIENTE", fechaEntrega: "2026-10-07" }, atrasada: true };
const enCurso: EtapaTablero = { ...etapa, id: "22222222-2222-4222-8222-222222222222", secuencia: 2,
  estado: "EN_CURSO", fechaInicioReal: version, orden: { ...etapa.orden, estado: "EN_PRODUCCION" } };
const porArea: GrupoEtapas[] = [{ id, nombre: area.nombre, etapas: [etapa, enCurso] }];
const porResponsable: GrupoEtapas[] = [{ id, nombre: responsable.nombre, etapas: [etapa, enCurso] }];
const plantilla: PlantillaDto = { id, categoriaId: id, area, secuencia: 1, nombre: etapa.nombre, activo: true, actualizadoEn: version };
const opciones = { areas: [area], responsables: [responsable] };
const conteos = { todas: 1, activas: 1, archivadas: 0 };
const categorias = [{ id, nombre: "Gran formato" }];
const referencia = "2026-10-06T12:00:00.000Z";
const ESPERADO: Record<PerfilCodigo, PermisosEtapas & { gestionarCatalogo: boolean }> = {
  GERENCIA: { planificar: false, ejecutar: false, avanzar: false, gestionarCatalogo: false },
  ADMINISTRACION: { planificar: true, ejecutar: true, avanzar: true, gestionarCatalogo: false },
  OPERACIONES: { planificar: true, ejecutar: false, avanzar: true, gestionarCatalogo: true },
  ATENCION_CLIENTE: { planificar: false, ejecutar: false, avanzar: false, gestionarCatalogo: false },
  PRODUCCION: { planificar: false, ejecutar: true, avanzar: true, gestionarCatalogo: false },
  ADMIN: { planificar: false, ejecutar: false, avanzar: false, gestionarCatalogo: false },
};

function permisos(perfil: PerfilCodigo): PermisosEtapas {
  const lista = PERMISOS_POR_PERFIL[perfil];
  return { planificar: lista.includes("produccion:planificar"), ejecutar: lista.includes("produccion:ejecutar"),
    avanzar: lista.includes("orden:avanzar") };
}

function pantallas(): ReactNode[][] {
  const gestion = PERMISOS_POR_PERFIL.OPERACIONES.includes("catalogo:gestionar");
  return [
    [createElement(PageHeader, { key: "titulo", titulo: "Producción" }),
      createElement(FiltrosProduccion, { key: "filtros", opciones }),
      createElement(TableroProduccion, { key: "tablero", porArea, porResponsable, permisos: permisos("PRODUCCION"), vistaInicial: "responsable", referencia })],
    [createElement(PageHeader, { key: "titulo", titulo: "Producción" }),
      createElement(TableroProduccion, { key: "tablero", porArea, porResponsable, permisos: permisos("ATENCION_CLIENTE"), vistaInicial: "area", referencia })],
    [createElement(PageHeader, { key: "titulo", titulo: "Áreas de producción" }),
      createElement(AdministracionAreas, { key: "areas", areas: [area], conteos, gestionar: gestion })],
    [createElement(PageHeader, { key: "titulo", titulo: "Plantillas de producción" }),
      createElement(AdministracionPlantillas, { key: "plantillas", categoriaId: id, categorias, conteos, plantillas: [plantilla], areas: [area], gestionar: gestion })],
    [createElement(PageHeader, { key: "titulo", titulo: etapa.orden.numero }),
      createElement(EtapasOrden, { key: "etapas", etapas: [etapa, enCurso], permisos: permisos("PRODUCCION"), ...opciones,
        orden: { id, estado: "EN_PRODUCCION", actualizadoEn: version, etapas: [etapa, enCurso] } })],
  ];
}

async function cargarCss(): Promise<string> {
  const cargar = createRequire(import.meta.resolve("@tailwindcss/postcss"));
  const postcss = cargar("postcss") as (plugins: unknown[]) => {
    process(entrada: string, opciones: { from: string }): Promise<{ css: string }>;
  };
  const archivo = path.resolve("src/app/globals.css");
  return (await postcss([tailwindcss({ base: process.cwd(), optimize: false })])
    .process(await readFile(archivo, "utf8"), { from: archivo })).css;
}

async function comprobarPantalla({ pagina, pantalla, css }: { pagina: Page; pantalla: ReactNode[]; css: string }) {
  const cuerpo = renderToStaticMarkup(createElement("div", { className: "md:pl-16 xl:pl-64" },
    createElement("main", { className: "min-w-0 space-y-6 px-4 py-6 xl:px-6" }, pantalla)));
  await pagina.setContent(`<!doctype html><html lang="es"><head><title>Producción</title><style>${css}</style></head><body>${cuerpo}</body></html>`);
  const desbordes = await pagina.evaluate(() => ({ pagina: document.documentElement.scrollWidth > window.innerWidth,
    tablas: [...document.querySelectorAll('[data-slot="table-container"]')].some((tabla) => tabla.scrollWidth > tabla.clientWidth) }));
  expect(desbordes).toEqual({ pagina: false, tablas: false });
  const resultado = await new AxeBuilder({ page: pagina }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(resultado.violations.map((violacion) => ({ id: violacion.id, nodos: violacion.nodes.map((nodo) => nodo.target) }))).toEqual([]);
  expect(await pagina.getByText(/C\$/).count()).toBe(0);
}

describe("producción: accesibilidad y tamaños de interfaz", () => {
  let navegador: Browser;
  let css: string;
  beforeAll(async () => {
    css = await cargarCss();
    navegador = await chromium.launch({ channel: "msedge", headless: true });
  });
  afterAll(async () => { await navegador?.close(); });

  for (const ancho of [820, 1024, 1366, 1920]) {
    it(`tablero, áreas, plantillas y etapas sin desborde ni infracciones axe a ${ancho}px`, async () => {
      const contexto = await navegador.newContext({ viewport: { width: ancho, height: 1000 }, reducedMotion: "reduce" });
      const pagina = await contexto.newPage();
      try {
        for (const pantalla of pantallas()) await comprobarPantalla({ pagina, pantalla, css });
      } finally { await contexto.close(); }
    });
  }
});

describe("producción: permisos de interfaz", () => {
  for (const perfil of Object.keys(ESPERADO) as PerfilCodigo[]) {
    it(`muestra acciones autorizadas para ${perfil}`, () => {
      const tablero = renderToStaticMarkup(createElement(TableroProduccion, { porArea, porResponsable,
        permisos: permisos(perfil), vistaInicial: "responsable", referencia }));
      expect(tablero.includes('aria-label="Iniciar:')).toBe(ESPERADO[perfil].ejecutar && ESPERADO[perfil].avanzar);
      expect(tablero.includes('aria-label="Completar:')).toBe(ESPERADO[perfil].ejecutar);
      expect(tablero.includes('aria-label="Asignar responsable:')).toBe(false);
      const acciones = renderToStaticMarkup(createElement(AccionesEtapa, { etapa, estadoOrden: "PENDIENTE",
        permisos: permisos(perfil), ...opciones }));
      expect(acciones.includes('aria-label="Asignar responsable:')).toBe(ESPERADO[perfil].planificar);
      const accionesOrden = renderToStaticMarkup(createElement(AccionesProduccionOrden, { areas: [area], permisos: permisos(perfil),
        orden: { id, estado: "EN_PRODUCCION", actualizadoEn: version, etapas: [{ ...etapa, estado: "COMPLETADA" }] } }));
      expect(accionesOrden.includes("Marcar lista")).toBe(ESPERADO[perfil].avanzar);
      const gestionar = PERMISOS_POR_PERFIL[perfil].includes("catalogo:gestionar");
      const areas = renderToStaticMarkup(createElement(AdministracionAreas, { areas: [area], conteos, gestionar }));
      const plantillas = renderToStaticMarkup(createElement(AdministracionPlantillas,
        { categoriaId: id, categorias, conteos, plantillas: [plantilla], areas: [area], gestionar }));
      expect(areas.includes("Crear área")).toBe(ESPERADO[perfil].gestionarCatalogo);
      expect(plantillas.includes("Agregar plantilla")).toBe(ESPERADO[perfil].gestionarCatalogo);
      if (gestionar) expect(plantillas).not.toContain('data-size="sm"');
    });
  }

  it("exige ambos permisos para mostrar el primer inicio", () => {
    const sinAvanzar = { ...permisos("PRODUCCION"), avanzar: false };
    const primera = renderToStaticMarkup(createElement(AccionesEtapa, { etapa, estadoOrden: "PENDIENTE", permisos: sinAvanzar }));
    const posterior = renderToStaticMarkup(createElement(AccionesEtapa, { etapa, estadoOrden: "EN_PRODUCCION", permisos: sinAvanzar }));
    expect(primera.includes('aria-label="Iniciar:')).toBe(false);
    expect(posterior.includes('aria-label="Iniciar:')).toBe(true);
  });

  for (const estadoOrden of ["LISTA", "ENTREGADA", "CERRADA", "CANCELADA"] as const) {
    it(`oculta cambios de etapa en ${estadoOrden}`, () => {
      expect(renderToStaticMarkup(createElement(AccionesEtapa, { etapa, estadoOrden, permisos: permisos("PRODUCCION") }))).toBe("");
    });
  }
});

describe("producción: guarda de lista en interfaz", () => {
  it("deshabilita marcar lista hasta cerrar etapas y completar trabajo", () => {
    const abierta = renderToStaticMarkup(createElement(AccionesProduccionOrden, { areas: [area], permisos: permisos("PRODUCCION"),
      orden: { id, estado: "EN_PRODUCCION", actualizadoEn: version, etapas: [etapa] } }));
    const completada = renderToStaticMarkup(createElement(AccionesProduccionOrden, { areas: [area], permisos: permisos("PRODUCCION"),
      orden: { id, estado: "EN_PRODUCCION", actualizadoEn: version, etapas: [{ ...etapa, estado: "COMPLETADA" }] } }));
    const omitida = renderToStaticMarkup(createElement(AccionesProduccionOrden, { areas: [area], permisos: permisos("PRODUCCION"),
      orden: { id, estado: "EN_PRODUCCION", actualizadoEn: version, etapas: [{ ...etapa, estado: "OMITIDA" }] } }));
    expect(abierta).toMatch(/<button[^>]+disabled=""[^>]*>Marcar lista/);
    expect(omitida).toMatch(/<button[^>]+disabled=""[^>]*>Marcar lista/);
    expect(completada).not.toMatch(/<button[^>]+disabled=""[^>]*>Marcar lista/);
    expect(completada).toContain("Puede marcar la orden lista.");
  });
});
