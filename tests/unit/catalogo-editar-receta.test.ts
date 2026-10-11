import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import Pagina from "@/app/(app)/catalogo/[id]/editar/page";
import { EditorReceta } from "@/modules/catalogo/componentes/EditorReceta";
import { FormularioProducto } from "@/modules/catalogo/componentes/FormularioProducto";
import { cargarProducto } from "@/modules/catalogo/paginas";
import { esquemaReceta, MENSAJE_VERSION } from "@/modules/catalogo/schema";
import type { FichaProducto } from "@/modules/catalogo/tipos";
import * as editorReceta from "@/modules/catalogo/useEditorReceta";

const navegador = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navegador, redirect: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("@/lib/auth/guardia", () => ({ exigirPermisoPagina: vi.fn().mockResolvedValue({}) }));
vi.mock("@/core/autorizacion", () => ({ can: vi.fn().mockReturnValue(true) }));
vi.mock("@/modules/catalogo/paginas", () => ({ cargarProducto: vi.fn() }));
vi.mock("@/modules/catalogo/categorias", () => ({
  listarCategorias: vi.fn().mockResolvedValue([]), listarMateriales: vi.fn().mockResolvedValue([]),
}));

const version = "2026-10-11T12:00:00.000Z";
const nuevaVersion = "2026-10-11T12:01:00.000Z";
const id = "00000000-0000-4000-8000-000000000001";
const material = { id, codigo: "M-01", nombre: "Vinilo", unidad: "M2" as const, costoPromedio: "2.0000", activo: true };
const producto: FichaProducto = {
  id, codigo: "P-01", nombre: "Lona", descripcion: null, categoriaId: id,
  categoria: { id, nombre: "Impresión", descripcion: null, activo: true, actualizadoEn: version },
  unidadCobro: "M2", precioBase: "12.50", activo: true, creadoEn: version, actualizadoEn: version,
  receta: [{ materialId: id, cantidad: "1.000", material }],
};

function capturarEditor() {
  let editor: ReturnType<typeof editorReceta.useEditorReceta> | undefined;
  function Captura() { editor = editorReceta.useEditorReceta(producto); return null; }
  renderToStaticMarkup(createElement(Captura));
  return editor!;
}

async function formulariosPagina(ficha: FichaProducto) {
  vi.mocked(cargarProducto).mockResolvedValue(ficha);
  const pagina = await Pagina({ params: Promise.resolve({ id: ficha.id }) });
  const contenedor = pagina.props.children[1] as ReactElement<{ children: ReactElement<{ producto: FichaProducto }>[] }>;
  return contenedor.props.children;
}

function fichaConFilas(cantidad: number): FichaProducto {
  return { ...producto, receta: Array.from({ length: cantidad }, (_, indice) => ({
    materialId: `00000000-0000-4000-8000-${String(indice + 1).padStart(12, "0")}`,
    cantidad: "1", material,
  })) };
}

afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe("guardar receta durante la edición del producto", () => {
  it("conserva la identidad del formulario y actualiza la identidad de la receta", async () => {
    const iniciales = await formulariosPagina(producto);
    const actualizados = await formulariosPagina({ ...producto, actualizadoEn: nuevaVersion });
    expect(iniciales[0].type).toBe(FormularioProducto);
    expect(actualizados[0].key).toBe(iniciales[0].key);
    expect(actualizados[0].props.producto.actualizadoEn).toBe(nuevaVersion);
    expect(iniciales[1].type).toBe(EditorReceta);
    expect(actualizados[1].key).not.toBe(iniciales[1].key);
  });

  it("actualiza cantidades y versión antes del refresco y permite guardar otra vez", async () => {
    const guardado = { ...producto, actualizadoEn: nuevaVersion, receta: [{ ...producto.receta[0], cantidad: "3.000" }] };
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ datos: guardado }))));
    vi.stubGlobal("fetch", fetch);
    const editor = capturarEditor();
    editor.formulario.setValue("materiales.0.cantidad", "3");
    navegador.refresh.mockImplementationOnce(() => {
      expect(editor.formulario.getValues()).toEqual({ version: nuevaVersion, materiales: [{ materialId: id, cantidad: "3.000" }] });
    });
    await editor.enviar();
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ version, materiales: [{ materialId: id, cantidad: "3" }] });
    await editor.enviar();
    expect(JSON.parse(fetch.mock.calls[1][1].body).version).toBe(nuevaVersion);
    expect(navegador.refresh).toHaveBeenCalledTimes(2);
  });

  it("conserva la receta pendiente cuando el servidor devuelve un conflicto", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { codigo: "CONFLICTO_EDICION", mensaje: "El producto cambió." },
    }), { status: 409 })));
    const editor = capturarEditor();
    editor.formulario.reset({ version, materiales: [{ materialId: id, cantidad: "4" }] });
    await editor.enviar();
    expect(editor.formulario.getValues()).toEqual({ version, materiales: [{ materialId: id, cantidad: "4" }] });
    expect(navegador.refresh).not.toHaveBeenCalled();
  });
});

describe("límite y errores globales de receta", () => {
  it.each([99, 100])("limita Agregar material con %s filas", (cantidad) => {
    const html = renderToStaticMarkup(createElement(EditorReceta, {
      producto: fichaConFilas(cantidad), materiales: [material], puedeVerMateriales: true,
    }));
    const boton = html.match(/<button[^>]*>[^]*?Agregar material<\/button>/g)?.at(-1);
    expect(boton).toBeDefined();
    const apertura = boton!.match(/<button[^>]*>/g)?.at(-1);
    expect(apertura?.includes('disabled=""')).toBe(cantidad === 100);
  });

  it("presenta el mensaje de versión definido por el esquema", () => {
    const editor = capturarEditor();
    vi.spyOn(editorReceta, "useEditorReceta").mockReturnValue({ ...editor, formulario: {
      ...editor.formulario, formState: { ...editor.formulario.formState,
        errors: { version: { type: "invalid_format", message: MENSAJE_VERSION } },
      },
    } });
    const html = renderToStaticMarkup(createElement(EditorReceta, { producto, materiales: [material], puedeVerMateriales: true }));
    expect(html).toContain('role="alert"');
    expect(html).toContain(MENSAJE_VERSION);
  });

  it.each(["directo", "root"])("presenta el error global de materiales %s", (ubicacion) => {
    const resultado = esquemaReceta.safeParse({ version, materiales: fichaConFilas(101).receta.map(({ materialId, cantidad }) => ({ materialId, cantidad })) });
    expect(resultado.success).toBe(false);
    if (resultado.success) return;
    const mensaje = resultado.error.issues.find((error) => error.path.join(".") === "materiales")!.message;
    const error = { type: "too_big", message: mensaje };
    const editor = capturarEditor();
    vi.spyOn(editorReceta, "useEditorReceta").mockReturnValue({ ...editor, formulario: {
      ...editor.formulario, formState: { ...editor.formulario.formState,
        errors: { materiales: ubicacion === "root" ? { root: error } : error },
      },
    } });
    const html = renderToStaticMarkup(createElement(EditorReceta, { producto, materiales: [material], puedeVerMateriales: true }));
    expect(html).toContain('role="alert"');
    expect(html).toContain(mensaje.replaceAll("<", "&lt;").replaceAll(">", "&gt;"));
  });
});
