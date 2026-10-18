import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium, type Browser } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import tailwindcss from "@tailwindcss/postcss";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PageHeader } from "@/components/comunes/PageHeader";
import { ConsumoEstimadoOrden } from "@/modules/ordenes/componentes/ConsumoEstimadoOrden";
import { DatosCliente, DatosOrden } from "@/modules/ordenes/componentes/DatosOrden";
import { EncabezadoOrden } from "@/modules/ordenes/componentes/EncabezadoOrden";
import { EtapasOrden, recuperarFocoEtapas } from "@/modules/ordenes/componentes/EtapasOrden";
import { atributosErrorCliente, enfocarResultadoCliente, FormularioCliente } from "@/modules/clientes/componentes/FormularioCliente";
import { EditorItem, type PropiedadesItem } from "@/modules/cotizaciones/componentes/EditorItem";
import { FiltrosOrdenes } from "@/modules/ordenes/componentes/FiltrosOrdenes";
import { FichaOrden } from "@/modules/ordenes/componentes/FichaOrden";
import { FormularioOrden } from "@/modules/ordenes/componentes/FormularioOrden";
import { ListaAtencion } from "@/components/panel/ListaAtencion";
import { ItemsOrden } from "@/modules/ordenes/componentes/ItemsOrden";
import { LineaTiempoOrden } from "@/modules/ordenes/componentes/LineaTiempoOrden";
import { TablaOrdenes } from "@/modules/ordenes/componentes/TablaOrdenes";
import { esquemaConsultaOrdenes } from "@/modules/ordenes/schema";
import type { OpcionesOrden, OrdenDto } from "@/modules/ordenes/tipos";
import { CadenaTrabajo } from "@/modules/trazabilidad/componentes/CadenaTrabajo";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const id = "11111111-1111-4111-8111-111111111111";
const categoria = { id, nombre: "Rotulación y gran formato" };
const responsable = { id, nombre: "Responsable de producción" };
const opciones: OpcionesOrden = { responsables: [responsable], categorias: [{ ...categoria, etapas: 2 }] };
const permisos = { gestionar: true, entregar: true, cerrar: true, cancelar: true };
const permisosEtapas = { planificar: true, ejecutar: true, avanzar: true };
const orden: OrdenDto = {
  id, numero: "OT-2026-0001", estado: "PENDIENTE", categoria, responsable,
  cliente: { id, nombre: "Cliente de prueba con nombre extenso", tipo: "EMPRESA", telefono: "8888 0000", correo: "prueba@example.com", codigoCliente: "CLI-0001" },
  cotizacion: { id, numero: "COT-2026-0001", asunto: "Trabajo de prueba" }, fechaEntrega: "2026-10-05", atrasada: true,
  creadoEn: "2026-10-06T12:00:00Z", actualizadoEn: "2026-10-06T12:00:00Z", fechaInicioReal: null, fechaEntregaReal: null,
  fechaCierre: null, motivoCancelacion: null, especificaciones: "Especificaciones de prueba. ".repeat(30),
  items: [{ id, secuencia: 1, tipo: "PERSONALIZADO", descripcion: "Descripción extensa del trabajo solicitado", categoria,
    unidadCobro: "M2", cantidad: "3.000", ancho: "1.200", alto: "2.000", lineas: [{ id, secuencia: 1, tipo: "MATERIAL",
      descripcion: "Material de prueba", unidad: "M2", cantidad: "7.200", mermaPct: "5.00", material: { id, nombre: "Vinil", unidad: "M2" } }] }],
  etapas: [{ id, secuencia: 1, nombre: "Impresión de gran formato", area: { id, nombre: "Área de impresión" }, estado: "PENDIENTE",
    responsable: null, fechaInicioPlan: "2026-10-06", fechaFinPlan: "2026-10-07", fechaInicioReal: null, fechaFinReal: null, observaciones: null, actualizadoEn: "2026-10-06T12:00:00.000Z" }],
  consumosEstimados: [{ id, material: { id, nombre: "Material de prueba", unidad: "M2" }, cantidad: "7.560", origen: "COTIZACION" }],
  advertencias: [{ itemSecuencia: 1, lineaSecuencia: 2, mensaje: "Línea 2: unidad distinta del material; no se estimó." }],
  eventos: [{ id, entidad: "ORDEN_TRABAJO", entidadId: id, accion: "CONVERTIR_EN_ORDEN", actor: "Operaciones",
    estadoAnterior: null, estadoNuevo: "PENDIENTE", creadoEn: "2026-10-06T12:00:00Z", detalle: {} }],
};

function contenido(pantalla: "lista" | "ficha" | "nueva" | "editar"): ReactNode[] {
  const encabezado = createElement(PageHeader, { key: "encabezado", titulo: pantalla === "ficha" ? orden.numero : "Órdenes de trabajo" });
  if (pantalla === "lista") return [encabezado,
    createElement(FiltrosOrdenes, { key: "filtros", consulta: esquemaConsultaOrdenes.parse({}), responsables: [responsable] }),
    createElement(TablaOrdenes, { key: "lista", consulta: esquemaConsultaOrdenes.parse({}),
      lista: { datos: [orden], total: 1, pagina: 1, porPagina: 20 } })];
  if (pantalla === "ficha") return [encabezado,
    createElement(EncabezadoOrden, { key: "resumen", orden, permisos, permisosEtapas }),
    createElement(EtapasOrden, { key: "etapas", etapas: orden.etapas }),
    createElement(FichaOrden, { key: "ficha",
      especificaciones: [createElement(DatosOrden, { key: "datos", orden }), createElement(ItemsOrden, { key: "items", items: orden.items })],
      cliente: createElement(DatosCliente, { orden, verCliente: false, verCotizacion: false }),
      consumo: createElement(ConsumoEstimadoOrden, { orden }), historial: createElement(LineaTiempoOrden, { eventos: orden.eventos }) })];
  return [encabezado, pantalla === "editar" ? createElement(FormularioOrden, { key: "editar", opciones, hoy: "2026-10-06", orden })
    : createElement(FormularioOrden, { key: "nueva", opciones, hoy: "2026-10-06", propuesta: { cotizacionId: id, numero: "COT-2026-0001",
      cliente: orden.cliente.nombre, categoriaId: id, especificaciones: "Trabajo de prueba", orden: null } })];
}

describe("órdenes: responsable opcional en componentes", () => {
  const sinResponsable = { ...orden, responsable: null };
  it("muestra Sin responsable en lista y ficha", () => {
    const tabla = renderToStaticMarkup(createElement(TablaOrdenes, { consulta: esquemaConsultaOrdenes.parse({}),
      lista: { datos: [sinResponsable], total: 1, pagina: 1, porPagina: 20 } }));
    const ficha = renderToStaticMarkup(createElement(EncabezadoOrden, { orden: sinResponsable, permisos, permisosEtapas }));
    expect(tabla).toContain("Sin responsable");
    expect(ficha).toContain("Sin responsable");
    expect(ficha).toContain(">Asignar<");
    expect(renderToStaticMarkup(createElement(EncabezadoOrden, { orden, permisos, permisosEtapas }))).not.toContain(">Asignar<");
  });
  it("ofrece un solo siguiente paso según el estado y los permisos", () => {
    const html = (estado: OrdenDto["estado"], p = permisos, pe = permisosEtapas) =>
      renderToStaticMarkup(createElement(EncabezadoOrden, { orden: { ...orden, estado }, permisos: p, permisosEtapas: pe }));
    expect(html("PENDIENTE")).toContain("Iniciar producción");
    expect(html("EN_PRODUCCION")).toContain("Marcar lista");
    expect(html("LISTA")).toContain(">Entregar<");
    expect(html("ENTREGADA")).toContain(">Cerrar<");
    expect(html("LISTA", { ...permisos, entregar: false })).not.toContain(">Entregar<");
    expect(html("PENDIENTE", permisos, { planificar: false, ejecutar: false, avanzar: false })).not.toContain("Iniciar producción");
  });
  it("lista: 5 columnas, fila enlazada a la ficha y filtro Sin responsable visible", () => {
    const consulta = esquemaConsultaOrdenes.parse({});
    const tabla = renderToStaticMarkup(createElement(TablaOrdenes, { consulta, lista: { datos: [orden], total: 1, pagina: 1, porPagina: 20 } }));
    expect(tabla.match(/<th [^>]*scope="col"/g)).toHaveLength(5);
    expect(tabla).toContain(`href="/ordenes/${id}"`);
    const filtros = renderToStaticMarkup(createElement(FiltrosOrdenes, { consulta, responsables: [responsable] }));
    expect(filtros).toContain("responsable=sin-responsable");
  });
  it("renderiza edición sin responsable y restringe los campos al planificar", () => {
    const formulario = renderToStaticMarkup(createElement(FormularioOrden, {
      opciones, hoy: "2026-10-06", orden: sinResponsable, soloResponsable: true,
    }));
    expect(formulario).toContain("Sin responsable");
    expect(formulario).not.toContain('id="fechaEntrega"');
    expect(formulario).not.toContain('id="especificaciones"');
    expect(formulario).not.toContain("aria-required");
  });
  it("muestra Sin responsable en la cadena de trabajo y el panel", () => {
    const cadena = renderToStaticMarkup(createElement(CadenaTrabajo, { cadena: {
      cliente: { ...orden.cliente, contactoPrincipal: null, href: null },
      cotizacion: { ...orden.cotizacion, estado: "Aprobada", creadoEn: orden.creadoEn,
        fechaEmision: null, fechaVencimiento: null, fechaRespuesta: null, href: null },
      orden: { id, numero: orden.numero, estado: "Pendiente", responsable: null,
        especificaciones: null, fechaEntrega: orden.fechaEntrega, creadoEn: orden.creadoEn,
        fechaInicioReal: null, fechaEntregaReal: null, fechaCierre: null }, etapas: [],
    } }));
    const panel = renderToStaticMarkup(createElement(ListaAtencion, { generadoEn: "2026-10-06T12:00:00Z", atencionTotal: 1, atencion: [{
      id, tipo: "orden", codigo: orden.numero, urgencia: "SIN_RESPONSABLE", monto: null, moneda: null,
      referencia: "2026-10-06T06:00:00Z", dias: 0,
      titulo: orden.numero, detalle: "Sin responsable", gravedad: "alta", destino: `/ordenes/${id}`,
    }] }));
    expect(cadena).toContain("Sin responsable");
    expect(panel).toContain("Sin responsable");
    expect(panel).toContain(orden.numero);
  });
});

describe("órdenes: componentes renderizados, accesibilidad y tamaños", () => {
  let navegador: Browser;
  let css: string;
  beforeAll(async () => {
    const cargar = createRequire(import.meta.resolve("@tailwindcss/postcss"));
    const postcss = cargar("postcss") as (plugins: unknown[]) => {
      process(entrada: string, opciones: { from: string }): Promise<{ css: string }>;
    };
    const archivo = path.resolve("src/app/globals.css");
    css = (await postcss([tailwindcss({ base: process.cwd(), optimize: false })]).process(await readFile(archivo, "utf8"), { from: archivo })).css;
    navegador = await chromium.launch({ channel: "msedge", headless: true });
  });
  afterAll(async () => { await navegador?.close(); });

  for (const ancho of [390, 768, 1024, 1366, 1920]) {
    it(`lista, ficha y formularios sin desborde ni infracciones axe a ${ancho}px`, async () => {
      const contexto = await navegador.newContext({ viewport: { width: ancho, height: 1000 } });
      const pagina = await contexto.newPage();
      try {
        for (const pantalla of ["lista", "ficha", "nueva", "editar"] as const) {
          const cuerpo = renderToStaticMarkup(createElement("div", { className: "md:pl-16 xl:pl-64" },
            createElement("main", { className: "space-y-6 px-4 py-6 xl:px-6" }, contenido(pantalla))));
          await pagina.setContent(`<!doctype html><html lang="es"><head><title>Órdenes</title><style>${css}</style></head><body>${cuerpo}</body></html>`);
          const desbordes = await pagina.evaluate(() => ({ pagina: document.documentElement.scrollWidth > window.innerWidth,
            tablas: [...document.querySelectorAll('[data-slot="table-container"]')].some((tabla) => tabla.scrollWidth > tabla.clientWidth) }));
          expect(desbordes, `${pantalla} ${ancho}px`).toEqual({ pagina: false, tablas: false });
          const resultado = await new AxeBuilder({ page: pagina }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
          expect(resultado.violations.map((violacion) => ({ id: violacion.id, nodos: violacion.nodes.map((nodo) => nodo.target) })), pantalla).toEqual([]);
          if (pantalla === "ficha") {
            expect(await pagina.getByRole("link", { name: orden.cotizacion.numero }).count()).toBe(0);
            expect(await pagina.getByText("Atrasada", { exact: true }).count()).toBe(1);
          }
        }
      } finally { await contexto.close(); }
    });
  }
});

describe("seguimiento: asociaciones y foco sin navegador", () => {
  it("asocia el error sin quitar la ayuda ni duplicar identificadores", () => {
    expect(atributosErrorCliente({ descripcion: "ayuda nombre-error", idError: "nombre-error", invalido: true }))
      .toEqual({ "aria-invalid": "true", "aria-describedby": "ayuda nombre-error" });
    expect(atributosErrorCliente({ descripcion: "ayuda nombre-error", idError: "nombre-error", invalido: false }))
      .toEqual({ "aria-invalid": "false", "aria-describedby": "ayuda" });
    expect(atributosErrorCliente({ descripcion: null, idError: "nombre-error", invalido: false }))
      .toEqual({ "aria-invalid": "false", "aria-describedby": undefined });
  });

  function elementoFoco() {
    return { focus: vi.fn(), tabIndex: 0 };
  }

  function formularioFoco({ campo, mensaje, conectado = true }: {
    campo?: ReturnType<typeof elementoFoco>; mensaje?: ReturnType<typeof elementoFoco>; conectado?: boolean;
  }) {
    const boton = elementoFoco();
    const formulario = { isConnected: conectado, querySelector: vi.fn((selector: string) => {
      if (selector.startsWith('[aria-invalid')) return campo ?? null;
      if (selector.startsWith('[role')) return mensaje ?? null;
      return boton;
    }) };
    return { formulario: formulario as unknown as HTMLFormElement, boton };
  }

  it("enfoca el primer campo inválido antes del mensaje general", () => {
    const campo = elementoFoco();
    const mensaje = elementoFoco();
    const { formulario, boton } = formularioFoco({ campo, mensaje });
    enfocarResultadoCliente(formulario);
    expect(campo.focus).toHaveBeenCalledOnce();
    expect(mensaje.focus).not.toHaveBeenCalled();
    expect(boton.focus).not.toHaveBeenCalled();
  });

  it("enfoca el mensaje cuando faltan errores de campo", () => {
    const mensaje = elementoFoco();
    const { formulario } = formularioFoco({ mensaje });
    enfocarResultadoCliente(formulario);
    expect(mensaje.tabIndex).toBe(-1);
    expect(mensaje.focus).toHaveBeenCalledOnce();
  });

  it("recupera el botón y descarta formularios desmontados", () => {
    const presente = formularioFoco({});
    enfocarResultadoCliente(presente.formulario);
    expect(presente.boton.focus).toHaveBeenCalledOnce();
    const desmontado = formularioFoco({ conectado: false });
    enfocarResultadoCliente(desmontado.formulario);
    expect(desmontado.boton.focus).not.toHaveBeenCalled();
    enfocarResultadoCliente(null);
  });

  function escenarioEtapas({ conectado = true, deshabilitado = false, focoExterno = false } = {}) {
    const body = {};
    const boton = { ...elementoFoco(), isConnected: conectado, disabled: deshabilitado, getAttribute: () => null };
    const estado = { ...elementoFoco(), textContent: "" };
    const mensaje = { ...elementoFoco(), textContent: "Etapa guardada." };
    const seccion = { ownerDocument: { body, activeElement: focoExterno ? {} : body },
      querySelectorAll: () => [estado, mensaje] };
    const accion = { boton: boton as unknown as HTMLButtonElement, mensajes: new Map<HTMLElement, string | null>() };
    return { boton, estado, mensaje, accion, propiedades: { seccion: seccion as unknown as HTMLElement,
      accion, estado: estado as unknown as HTMLElement } };
  }

  it("enfoca mensajes nuevos tras perder el foco", () => {
    const escenario = escenarioEtapas();
    recuperarFocoEtapas(escenario.propiedades);
    expect(escenario.mensaje.tabIndex).toBe(-1);
    expect(escenario.mensaje.focus).toHaveBeenCalledOnce();
    expect(escenario.boton.focus).not.toHaveBeenCalled();
  });

  it("enfoca errores del diálogo asociado a la acción", () => {
    const escenario = escenarioEtapas();
    const error = { ...elementoFoco(), textContent: "No se pudo guardar." };
    recuperarFocoEtapas({ ...escenario.propiedades, accion: { ...escenario.accion,
      dialogo: { isConnected: true, querySelectorAll: () => [error] } as unknown as HTMLElement } });
    expect(error.tabIndex).toBe(-1);
    expect(error.focus).toHaveBeenCalledOnce();
    expect(escenario.mensaje.focus).not.toHaveBeenCalled();
  });

  it("revisa mensajes de la sección al desmontar el diálogo", () => {
    const escenario = escenarioEtapas();
    recuperarFocoEtapas({ ...escenario.propiedades, accion: { ...escenario.accion,
      dialogo: { isConnected: false, querySelectorAll: vi.fn() } as unknown as HTMLElement } });
    expect(escenario.mensaje.focus).toHaveBeenCalledOnce();
  });

  it("ignora avisos previos y recupera el botón disponible", () => {
    const escenario = escenarioEtapas();
    escenario.accion.mensajes.set(escenario.mensaje as unknown as HTMLElement, escenario.mensaje.textContent);
    recuperarFocoEtapas(escenario.propiedades);
    expect(escenario.mensaje.focus).not.toHaveBeenCalled();
    expect(escenario.boton.focus).toHaveBeenCalledOnce();
  });

  it("enfoca el estado persistente tras desmontar el botón", () => {
    const escenario = escenarioEtapas({ conectado: false });
    escenario.accion.mensajes.set(escenario.mensaje as unknown as HTMLElement, escenario.mensaje.textContent);
    recuperarFocoEtapas(escenario.propiedades);
    expect(escenario.estado.textContent).toBe("Etapas actualizadas.");
    expect(escenario.estado.focus).toHaveBeenCalledOnce();
  });

  it("preserva el foco externo y espera botones deshabilitados", () => {
    for (const opciones of [{ focoExterno: true }, { deshabilitado: true }]) {
      const escenario = escenarioEtapas(opciones);
      escenario.accion.mensajes.set(escenario.mensaje as unknown as HTMLElement, escenario.mensaje.textContent);
      recuperarFocoEtapas(escenario.propiedades);
      expect(escenario.boton.focus).not.toHaveBeenCalled();
      expect(escenario.estado.focus).not.toHaveBeenCalled();
    }
  });

  it("conserva etiquetas y el nombre del botón de clientes", () => {
    const html = renderToStaticMarkup(createElement(FormularioCliente, { modo: "crear" }));
    expect(html).toContain("Guardar cliente");
    expect(html).toMatch(/<label[^>]+for="[^"]+"[^>]*>[^<]*Nombre/);
    for (const etiqueta of html.matchAll(/<label[^>]*for="([^"]+)"/g)) {
      expect(html).toContain(`id="${etiqueta[1]}"`);
    }
  });

  for (const tipo of ["CATALOGO", "PERSONALIZADO"] as const) {
    it(`conserva la etiqueta y describe actualizar precio de ${tipo}`, () => {
      const propiedades = { moneda: "NIO" as const, indice: 0, item: tipo === "CATALOGO"
        ? { tipo, productoId: id, cantidad: "1" }
        : { tipo, categoriaId: id, unidadCobro: "UNIDAD", descripcion: "Trabajo", margenPct: "10", cantidad: "1", lineas: [] },
      original: { productoActivo: true, productoId: null, categoriaId: id, unidadCobro: "UNIDAD", descripcion: "Trabajo",
        precioUnitario: "10" } as PropiedadesItem["original"], selectores: { productos: [], categorias: [], materiales: [] },
      calculado: null, errores: {}, alCambiar: vi.fn(), alQuitar: vi.fn() } satisfies PropiedadesItem;
      const html = renderToStaticMarkup(createElement(EditorItem, propiedades));
      expect(html).toContain('for="items.0.actualizarPrecio"');
      expect(html).toMatch(/role="checkbox"[^>]*id="items\.0\.actualizarPrecio"|id="items\.0\.actualizarPrecio"[^>]*role="checkbox"/);
      const descripcion = html.match(/<button[^>]*id="items\.0\.actualizarPrecio"[^>]*aria-describedby="([^"]+)"/);
      expect(descripcion).not.toBeNull();
      for (const identificador of descripcion![1].split(" ")) expect(html).toContain(`id="${identificador}"`);
      expect(html).toContain(tipo === "CATALOGO" ? "Aplicar producto y precio vigentes" : "Aplicar cambios de costos y margen");
      expect(html).toContain(tipo === "CATALOGO" ? "precio vigentes del catálogo" : "recalcule el precio");
    });
  }
});
