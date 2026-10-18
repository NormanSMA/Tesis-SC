import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EditorItems } from "@/modules/cotizaciones/componentes/EditorItems";
import type { EntradaLineaEditor, EntradaReemplazarItems } from "@/modules/cotizaciones/schema";
import type { CotizacionDto, SelectoresEditor } from "@/modules/cotizaciones/tipos";
import type { UseFormReturn } from "react-hook-form";

type Componente = (props: Record<string, unknown>) => ReactNode;
type Instancia = { valores: unknown[]; posicion: number; efectos: (() => void)[];
  sucia: boolean; renders: number; nodo?: ReactNode; props?: Record<string, unknown> };
const motor = vi.hoisted(() => ({ actual: null as Instancia | null, enviar: vi.fn(), enfocar: vi.fn(), instancias: new Map<string, Instancia>() }));

// Ejecuta los hooks y sus suscripciones sin DOM ni dependencias de base de datos.
vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  function usarEstado(inicial: unknown) {
    const instancia = motor.actual!;
    const posicion = instancia.posicion++;
    if (!(posicion in instancia.valores)) instancia.valores[posicion] = typeof inicial === "function" ? inicial() : inicial;
    return [instancia.valores[posicion], (entrada: unknown) => {
      const siguiente = typeof entrada === "function" ? entrada(instancia.valores[posicion]) : entrada;
      if (!Object.is(siguiente, instancia.valores[posicion])) { instancia.valores[posicion] = siguiente; instancia.sucia = true; }
    }];
  }
  function usarMemo(calcular: () => unknown, deps?: unknown[]) {
    const instancia = motor.actual!;
    const posicion = instancia.posicion++;
    const anterior = instancia.valores[posicion] as { deps?: unknown[]; valor: unknown } | undefined;
    if (!anterior || !deps || deps.some((valor, i) => !Object.is(valor, anterior.deps?.[i]))) {
      instancia.valores[posicion] = { deps, valor: calcular() };
    }
    return (instancia.valores[posicion] as { valor: unknown }).valor;
  }
  function usarEfecto(efecto: () => void | (() => void), deps?: unknown[]) {
    usarMemo(() => { motor.actual!.efectos.push(efecto); }, deps);
  }
  const hooks = { useState: usarEstado, useRef: (valor: unknown) => usarMemo(() => ({ current: valor }), []),
    useMemo: usarMemo, useCallback: (callback: unknown, deps?: unknown[]) => usarMemo(() => callback, deps),
    useEffect: usarEfecto, useLayoutEffect: usarEfecto, useContext: () => null, useId: () => "descripcion" };
  // RHF captura hooks al importarse; conecte su dispatcher para ejecutar sus suscripciones reales.
  const interno = Reflect.get(Reflect.get(react, "default") ?? react,
    "__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE") as { H: unknown };
  const ciclo = await import("vitest");
  ciclo.beforeEach(() => { interno.H = hooks; });
  ciclo.afterEach(() => { interno.H = null; });
  return { ...react, ...hooks };
});
vi.mock("@/modules/cotizaciones/useSolicitudCotizacion", async (original) => ({
  ...await original<typeof import("@/modules/cotizaciones/useSolicitudCotizacion")>(),
  enfocarError: motor.enfocar,
  useSolicitudCotizacion: () => ({ enviar: motor.enviar, campos: {}, enviando: false }),
}));

const id = "00000000-0000-4000-8000-000000000001";
const version = "2026-10-11T12:00:00.000Z";
const cotizacion = { id, numero: "C-01", moneda: "NIO", tipoCambio: "1", actualizadoEn: version,
  items: [], descuento: "0", descuentoPct: null, tasaImpuesto: "15" } as unknown as CotizacionDto;
const selectores: SelectoresEditor = { productos: [{ id, codigo: "P-01", nombre: "Producto", categoriaId: id,
  categoria: "Categoría", unidadCobro: "UNIDAD", precioBase: "10" }], materiales: [], categorias: [{ id, nombre: "Categoría" }] };
const locales = new Set(["EditorItems", "CamposItems", "EditorItem", "ItemConFormulario", "ContenidoItem",
  "LineasItem", "PieEditor", "PieTotales", "EditorLinea"]);
let raiz: ReactNode;
const hojas: ReactElement<Record<string, unknown>>[] = [];
const visitadas = new Set<string>();

function ejecutar(componente: Componente, props: Record<string, unknown>, ruta: string) {
  let instancia = motor.instancias.get(ruta);
  if (!instancia) {
    instancia = { valores: [], posicion: 0, efectos: [], sucia: false, renders: 0 };
    motor.instancias.set(ruta, instancia);
  }
  motor.actual = instancia; instancia.posicion = 0; instancia.sucia = false; instancia.renders++;
  instancia.props = props; instancia.nodo = componente(props);
  instancia.efectos.splice(0).forEach((efecto) => efecto());
  return instancia.nodo;
}

function recorrer(nodo: ReactNode, ruta = "raiz", heredado = false) {
  if (Array.isArray(nodo)) { nodo.forEach((hijo: ReactNode, i) => recorrer(hijo, `${ruta}/${isValidElement(hijo) && hijo.key || i}`, heredado)); return; }
  if (!isValidElement<Record<string, unknown>>(nodo)) return;
  const tipo = nodo.type as unknown as Componente | { type: Componente; compare: (a: unknown, b: unknown) => boolean };
  const componente = typeof tipo === "function" ? tipo : typeof tipo === "object" ? tipo.type : null;
  if (componente && locales.has(componente.name)) {
    visitadas.add(ruta);
    const instancia = motor.instancias.get(ruta);
    const cambiado = !instancia || instancia.sucia || (heredado &&
      (typeof tipo !== "object" || !tipo.compare(instancia.props, nodo.props)));
    recorrer(cambiado ? ejecutar(componente, nodo.props, ruta) : instancia.nodo, `${ruta}/${componente.name}`, cambiado);
  } else {
    hojas.push(nodo);
    recorrer(nodo.props.children as ReactNode, `${ruta}/hijos`, heredado);
  }
}

function actualizar() {
  for (let paso = 0; paso < 10; paso++) {
    hojas.length = 0; visitadas.clear(); recorrer(raiz);
    for (const ruta of motor.instancias.keys()) if (!visitadas.has(ruta)) motor.instancias.delete(ruta);
    if (![...motor.instancias.values()].some((instancia) => instancia.sucia)) return;
  }
  throw new Error("El editor no estabilizó sus suscripciones.");
}
function montar(datos = cotizacion) { raiz = createElement(EditorItems, { cotizacion: datos, selectores }); actualizar(); }
function boton(texto: string) { return hojas.find((hoja) => [hoja.props.children].flat(5).join("") === texto)!.props.onClick as () => void; }
function formulario() { return [...motor.instancias.values()].find((instancia) => instancia.props?.formulario)?.props?.formulario as UseFormReturn<EntradaReemplazarItems>; }
function lineas() { return hojas.filter((hoja) => typeof hoja.props.alCambiar === "function" && "prefijo" in hoja.props); }

beforeEach(() => { motor.instancias.clear(); motor.enviar.mockReset(); motor.enfocar.mockReset(); });

describe("editor con suscripciones por ítem y línea", () => {
  it("conserva claves al agregar, editar y quitar ítems", () => {
    montar(); boton("Agregar catálogo")(); actualizar();
    const form = formulario();
    form.setValue("items.0.productoId", id);
    boton("Agregar catálogo")(); actualizar();
    const campos = hojas.filter((hoja) => hoja.props.etiqueta === "Productos y trabajos")[0].props.children as ReactElement[];
    const claves = campos.map((campo) => campo.key);
    form.setValue("items.1.cantidad", "2"); actualizar();
    const siguientes = hojas.filter((hoja) => hoja.props.etiqueta === "Productos y trabajos")[0].props.children as ReactElement[];
    expect(siguientes.map((campo) => campo.key)).toEqual(claves);
    (hojas.find((hoja) => hoja.props["aria-label"] === "Quitar ítem 1")!.props.onClick as () => void)(); actualizar();
    const restantes = hojas.filter((hoja) => hoja.props.etiqueta === "Productos y trabajos")[0].props.children as ReactElement[];
    expect(restantes.map((campo) => campo.key)).toEqual([claves[1]]);
    expect(form.getValues("items.0.cantidad")).toBe("2");
  });

  it("teclear en una línea conserva los renders de otra línea", () => {
    montar(); boton("Agregar personalizado")(); actualizar();
    boton("Agregar tercero")(); actualizar(); boton("Agregar tercero")(); actualizar();
    formulario().setValue("items.0.lineas.0.costo", "100");
    formulario().setValue("items.0.lineas.1.costo", "50"); actualizar();
    const segunda = [...motor.instancias.values()].find((instancia) => instancia.props?.prefijo === "items.0.lineas.1")!;
    const renders = segunda.renders;
    const rendersRaiz = motor.instancias.get("raiz")!.renders;
    for (const cambio of [{ descripcion: "Transporte" }, { costo: "125" }]) {
      const primera = lineas()[0];
      (primera.props.alCambiar as (linea: EntradaLineaEditor) => void)({ ...(primera.props.linea as EntradaLineaEditor), ...cambio });
      actualizar();
    }
    expect(lineas()[0].props.linea).toMatchObject({ descripcion: "Transporte" });
    const resumen = [...motor.instancias.values()].find((instancia) => instancia.props?.calculado)?.props?.calculado;
    expect(resumen).toMatchObject({ costoTotal: "175.00", importe: "250.00" });
    expect(lineas()[1].props.importe).toBe("50.00");
    expect(segunda.renders).toBe(renders);
    expect(motor.instancias.get("raiz")!.renders).toBe(rendersRaiz);
  });

  it("conserva la validación zod y el enfoque del primer error", async () => {
    montar(); boton("Agregar catálogo")(); actualizar();
    const form = hojas.find((hoja) => hoja.type === "form")!;
    await (form.props.onSubmit as (evento: object) => Promise<void>)({ preventDefault: vi.fn(), persist: vi.fn() });
    expect(motor.enviar).not.toHaveBeenCalled();
    expect(motor.enfocar).toHaveBeenCalledWith("items-cotizacion");
  });

  it("envía versión y entradas sin claves de useFieldArray", async () => {
    montar(); boton("Agregar catálogo")(); actualizar();
    formulario().setValue("items.0.productoId", id); actualizar();
    const form = hojas.find((hoja) => hoja.type === "form")!;
    await (form.props.onSubmit as (evento: object) => Promise<void>)({ preventDefault: vi.fn(), persist: vi.fn() });
    expect(motor.enviar).toHaveBeenCalledWith({ url: `/api/v1/cotizaciones/${id}/items`, metodo: "PUT",
      cuerpo: { version, items: [{ tipo: "CATALOGO", productoId: id, cantidad: "1", ancho: null, alto: null }] } });
  });

  it("actualiza totales con varias líneas y descuento porcentual", () => {
    montar({ ...cotizacion, descuentoPct: "10" }); boton("Agregar personalizado")(); actualizar();
    boton("Agregar tercero")(); actualizar(); boton("Agregar tercero")(); actualizar();
    const form = formulario();
    form.setValue("items.0.margenPct", "0");
    form.setValue("items.0.lineas.0.costo", "100"); form.setValue("items.0.lineas.1.costo", "50"); actualizar();
    const totales = hojas.find((hoja) => "totales" in hoja.props)!.props.totales;
    expect(totales).toMatchObject({ subtotal: "150.00", descuento: "15.00", impuesto: "20.25", total: "155.25" });
  });
});

