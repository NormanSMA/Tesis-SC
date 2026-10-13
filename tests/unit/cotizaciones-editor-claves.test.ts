import { createElement, isValidElement, type ElementType, type FormEvent, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { EditorItem, type PropiedadesItem } from "@/modules/cotizaciones/componentes/EditorItem";
import { EditorItems } from "@/modules/cotizaciones/componentes/EditorItems";
import type { CotizacionDto, SelectoresEditor } from "@/modules/cotizaciones/tipos";
import { erroresEsquema } from "@/modules/cotizaciones/useSolicitudCotizacion";

const estado = vi.hoisted(() => ({ valores: [] as unknown[], posicion: 0, enviar: vi.fn() }));

// Conserva el estado entre capturas SSR para ejecutar los callbacks del editor.
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return { ...react, useState: <T,>(inicial: T | (() => T)) => {
    const posicion = estado.posicion++;
    if (!(posicion in estado.valores)) {
      estado.valores[posicion] = typeof inicial === "function" ? (inicial as () => T)() : inicial;
    }
    const cambiar = (valor: T | ((actual: T) => T)) => {
      estado.valores[posicion] = typeof valor === "function"
        ? (valor as (actual: T) => T)(estado.valores[posicion] as T) : valor;
    };
    return [estado.valores[posicion] as T, cambiar];
  } };
});

vi.mock("@/modules/cotizaciones/useSolicitudCotizacion", async (importOriginal) => {
  const solicitud = await importOriginal<typeof import("@/modules/cotizaciones/useSolicitudCotizacion")>();
  return { ...solicitud, erroresEsquema: vi.fn(solicitud.erroresEsquema),
    useSolicitudCotizacion: () => ({ enviar: estado.enviar, campos: {}, enviando: false }) };
});

const id = "00000000-0000-4000-8000-000000000001";
const version = "2026-10-11T12:00:00.000Z";
const cotizacion: CotizacionDto = {
  id, numero: "C-01", clienteId: id, estado: "BORRADOR", asunto: null, condiciones: null,
  cliente: { id, nombre: "Cliente", ruc: null, contactoPrincipal: null, telefono: null,
    correo: null, direccion: null, activo: true },
  cotizacionOrigenId: null, moneda: "NIO", tipoCambio: "1.0000", vigenciaDias: 15, fechaEmision: null,
  fechaVencimiento: null, fechaRespuesta: null, motivoRechazo: null, archivada: false,
  version: 1, motivoAjuste: null, referenciaAprobacion: null, usuarioAprobacionId: null,
  usuarioAprobacion: null, creadoEn: version, actualizadoEn: version, items: [], avisos: [],
  subtotal: "0", descuento: "0", tasaImpuesto: "0", impuesto: "0", total: "0",
  margenPct: "0",
};
const selectores: SelectoresEditor = {
  productos: [{ id, codigo: "P-01", nombre: "Producto", categoriaId: id, categoria: "Categoría",
    unidadCobro: "UNIDAD", precioBase: "10" }], materiales: [], categorias: [{ id, nombre: "Categoría" }],
};

function buscar<P>(nodo: ReactNode, tipo: ElementType): ReactElement<P>[] {
  if (Array.isArray(nodo)) return nodo.flatMap((hijo: ReactNode) => buscar<P>(hijo, tipo));
  if (!isValidElement<{ children?: ReactNode }>(nodo)) return [];
  const hijos = buscar<P>(nodo.props.children, tipo);
  return nodo.type === tipo ? [nodo as ReactElement<P>, ...hijos] : hijos;
}

function capturar() {
  estado.posicion = 0;
  let arbol: ReturnType<typeof EditorItems> | undefined;
  function Captura() { arbol = EditorItems({ cotizacion, selectores }); return null; }
  renderToStaticMarkup(createElement(Captura));
  return { arbol: arbol!, filas: buscar<PropiedadesItem>(arbol, EditorItem) };
}

function agregar(tipo: "CATALOGO" | "PERSONALIZADO") {
  const { arbol } = capturar();
  const etiqueta = tipo === "CATALOGO" ? "Agregar catálogo" : "Agregar personalizado";
  buscar<{ children: ReactNode; onClick: () => void }>(arbol, Button)
    .find((boton) => boton.props.children === etiqueta)!.props.onClick();
}

beforeEach(() => { estado.valores = []; estado.posicion = 0; vi.clearAllMocks(); });

describe("claves locales del editor de cotizaciones", () => {
  it.each(["CATALOGO", "PERSONALIZADO"] as const)("conserva las claves de filas nuevas %s", (tipo) => {
    agregar(tipo);
    const primera = capturar().filas[0];
    agregar(tipo);
    const filas = capturar().filas;
    expect(filas[0].key).toBe(primera.key);
    expect(filas[0].key).toBe(filas[0].props.item.claveLocal);
    expect(filas[1].key).toBe(filas[1].props.item.claveLocal);
    expect(filas[0].key).toEqual(expect.any(String));
    expect(filas[1].key).toEqual(expect.any(String));
    expect(filas[0].key).not.toBe(filas[1].key);
    filas[1].props.alCambiar({ ...filas[1].props.item, cantidad: "2" });
    expect(capturar().filas.map((fila) => fila.key)).toEqual(filas.map((fila) => fila.key));
    capturar().filas[0].props.alQuitar();
    const restantes = capturar().filas;
    expect(restantes).toHaveLength(1);
    expect(restantes[0].key).toBe(filas[1].key);
    expect(restantes[0].props.item.cantidad).toBe("2");
    expect(capturar().filas[0].key).toBe(filas[1].key);
  });

  it("excluye la clave local de la validación y del envío", async () => {
    agregar("CATALOGO");
    const fila = capturar().filas[0];
    if (fila.props.item.tipo !== "CATALOGO") throw new Error("Se esperaba un ítem de catálogo.");
    fila.props.alCambiar({ ...fila.props.item, productoId: id });
    const { arbol, filas } = capturar();
    await arbol.props.onSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
    const cuerpo = { version, items: [{ tipo: "CATALOGO", productoId: id,
      cantidad: "1", ancho: null, alto: null }] };
    expect(erroresEsquema).toHaveBeenCalledWith(expect.anything(), cuerpo);
    expect(estado.enviar).toHaveBeenCalledWith({
      url: `/api/v1/cotizaciones/${id}/items`, metodo: "PUT", cuerpo,
    });
    expect(filas[0].props.item.claveLocal).toBe(fila.key);
  });
});
