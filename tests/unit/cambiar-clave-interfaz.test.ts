import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LayoutAplicacion from "@/app/(app)/layout";
import PaginaCambiarClave from "@/app/(app)/cambiar-clave/page";
import { destinoPorPerfil } from "@/core/permisos";
import { exigirClaveCambiada, exigirPermisoPagina } from "@/lib/auth/guardia";
import type { UsuarioSesion } from "@/lib/auth/sesion";
import {
  FormularioCambiarClave, GuardiaCambioClave, solicitarCambioClave,
} from "@/modules/auth/componentes/FormularioCambiarClave";
import { esquemaCambiarClave, esquemaFormularioCambiarClave, type ValoresCambiarClave } from "@/modules/auth/schema";

const dobles = vi.hoisted(() => ({
  sesion: vi.fn(), ruta: "/cambiar-clave", enviar: undefined as undefined | ((valores: ValoresCambiarClave) => Promise<void>),
  errores: {} as Record<string, { message: string }>, setError: vi.fn(), setFocus: vi.fn(), reset: vi.fn(),
  navegar: vi.fn(), fetch: vi.fn(), enviando: false,
}));

vi.mock("next/image", () => ({ default: (props: { alt: string }) => createElement("img", { alt: props.alt }) }));
vi.mock("@/lib/auth/sesion", () => ({ obtenerSesion: dobles.sesion }));
vi.mock("next/navigation", () => ({
  usePathname: () => dobles.ruta,
  redirect: (ruta: string) => { throw new Error(`REDIRECCION:${ruta}`); },
}));
vi.mock("react-hook-form", () => ({
  useForm: () => ({
    register: (name: string) => ({ name, onChange: vi.fn(), onBlur: vi.fn(), ref: vi.fn() }),
    formState: { errors: dobles.errores, isSubmitting: dobles.enviando },
    setError: dobles.setError, setFocus: dobles.setFocus, reset: dobles.reset,
    handleSubmit: (enviar: typeof dobles.enviar) => { dobles.enviar = enviar; return vi.fn(); },
  }),
}));

const usuario: UsuarioSesion = {
  id: "usuario", nombre: "Ana", correo: "ana@example.test", perfil: "ADMIN",
  perfiles: ["ADMIN"], permisos: ["usuario:gestionar"], debeCambiarClave: true,
};
const valores = { claveActual: "Clave-actual-123", claveNueva: "Clave-nueva-456", confirmacion: "Clave-nueva-456" };

beforeEach(() => {
  vi.clearAllMocks();
  dobles.sesion.mockResolvedValue({ ...usuario });
  dobles.ruta = "/cambiar-clave";
  dobles.errores = {};
  dobles.enviando = false;
  dobles.enviar = undefined;
  vi.stubGlobal("fetch", dobles.fetch);
  vi.stubGlobal("window", { location: { replace: dobles.navegar } });
});

afterEach(() => vi.unstubAllGlobals());

describe("Bloqueo por clave temporal", () => {
  it("redirige páginas antes de comprobar sus permisos", async () => {
    await expect(exigirPermisoPagina("usuario:gestionar")).rejects.toThrow("REDIRECCION:/cambiar-clave");
    await expect(exigirPermisoPagina("cliente:ver")).rejects.toThrow("REDIRECCION:/cambiar-clave");
  });

  it("conserva las redirecciones por sesión y permisos después del cambio", async () => {
    dobles.sesion.mockResolvedValue(null);
    await expect(exigirPermisoPagina("usuario:gestionar")).rejects.toThrow("REDIRECCION:/login");
    dobles.sesion.mockResolvedValue({ ...usuario, debeCambiarClave: false });
    await expect(exigirPermisoPagina("usuario:gestionar")).resolves.toMatchObject({ id: usuario.id });
    await expect(exigirPermisoPagina("cliente:ver")).rejects.toThrow("REDIRECCION:/sin-acceso");
  });

  it("selecciona la guardia en el layout pendiente y permite abrir el formulario", async () => {
    const layout = await LayoutAplicacion({ children: "formulario" });
    expect(layout.type).toBe(GuardiaCambioClave);
    const html = renderToStaticMarkup(layout);
    expect(html).toContain("Soluciones Creativas");
    expect(html).toContain("Cerrar sesión");
    expect(html).toContain("formulario");
    expect(html).not.toContain("<nav");
    expect(html).not.toContain("Menú de usuario");
    const pagina = await PaginaCambiarClave();
    expect(renderToStaticMarkup(pagina)).toContain('id="titulo-cambiar-clave"');
  });

  it.each(["/panel", "/clientes", "/sin-acceso", "/admin/usuarios"])("bloquea navegación hacia %s", (ruta) => {
    dobles.ruta = ruta;
    expect(() => renderToStaticMarkup(createElement(GuardiaCambioClave, null, "contenido protegido")))
      .toThrow("REDIRECCION:/cambiar-clave");
  });

  it("rechaza rutas de negocio con el código y estado pedidos", () => {
    for (const ruta of ["/api/v1/clientes", "/api/v1/ordenes", "/api/v1/auth/yo/otro"]) {
      try {
        exigirClaveCambiada(usuario, ruta);
        expect.fail("Debe bloquear la ruta.");
      } catch (error) {
        expect(error).toMatchObject({ codigo: "CAMBIO_DE_CLAVE_REQUERIDO", status: 403 });
      }
    }
  });

  it("exceptúa solo yo, logout y cambiar-clave, y permite sesiones actualizadas", () => {
    for (const accion of ["yo", "logout", "cambiar-clave"]) {
      expect(() => exigirClaveCambiada(usuario, `/api/v1/auth/${accion}`)).not.toThrow();
    }
    expect(() => exigirClaveCambiada({ debeCambiarClave: false }, "/api/v1/clientes")).not.toThrow();
  });
});

describe("Formulario de cambio de clave", () => {
  it("valida longitud, diferencia y confirmación sin cambiar el contrato API", () => {
    expect(esquemaFormularioCambiarClave.safeParse(valores).success).toBe(true);
    for (const entrada of [
      { ...valores, claveNueva: "corta", confirmacion: "corta" },
      { ...valores, claveNueva: valores.claveActual, confirmacion: valores.claveActual },
      { ...valores, confirmacion: "otra-clave-1234" },
      { ...valores, claveActual: "" },
    ]) expect(esquemaFormularioCambiarClave.safeParse(entrada).success).toBe(false);
    expect(esquemaCambiarClave.parse(valores)).toEqual({ claveActual: valores.claveActual, claveNueva: valores.claveNueva });
    expect(esquemaFormularioCambiarClave.safeParse({ ...valores, claveNueva: "x".repeat(14), confirmacion: "x".repeat(14) }).success).toBe(true);
  });

  it("etiqueta los campos y asocia cada error con una alerta", () => {
    dobles.errores = { claveActual: { message: "Clave incorrecta." }, confirmacion: { message: "Las claves no coinciden." } };
    const html = renderToStaticMarkup(createElement(FormularioCambiarClave, { perfil: "ADMIN" }));
    for (const campo of ["claveActual", "claveNueva", "confirmacion"]) {
      expect(html).toContain(`for="${campo}"`);
      expect(html).toContain(`id="${campo}"`);
    }
    expect(html).toContain('autoComplete="current-password"');
    expect(html).toContain('autoComplete="new-password"');
    expect(html).toContain('minLength="14"');
    expect(html).toContain('id="claveActual-error" role="alert"');
    expect(html).toContain('aria-describedby="claveActual-error"');
    expect(html).toContain('id="confirmacion-error" role="alert"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("Cambiar clave");
  });

  it("desactiva los campos durante el envío", () => {
    dobles.enviando = true;
    const html = renderToStaticMarkup(createElement(FormularioCambiarClave, { perfil: "ADMIN" }));
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('<fieldset disabled=""');
    expect(html).toContain("Cambiando clave");
  });

  it.each(["ADMIN", "GERENCIA", "ADMINISTRACION", "OPERACIONES", "ATENCION_CLIENTE", "PRODUCCION"] as const)
  ("envía solo las claves y recarga el destino de %s", async (perfil) => {
    dobles.fetch.mockResolvedValue(Response.json({ datos: { debeCambiarClave: false } }));
    renderToStaticMarkup(createElement(FormularioCambiarClave, { perfil }));
    await dobles.enviar!(valores);
    expect(dobles.fetch.mock.calls[0][0]).toBe("/api/v1/auth/cambiar-clave");
    expect(JSON.parse(dobles.fetch.mock.calls[0][1].body)).toEqual({ claveActual: valores.claveActual, claveNueva: valores.claveNueva });
    expect(dobles.reset).toHaveBeenCalled();
    expect(dobles.navegar).toHaveBeenCalledWith(destinoPorPerfil[perfil]);
  });

  it("conserva errores por campo y enfoca la clave actual incorrecta", async () => {
    dobles.fetch.mockResolvedValue(Response.json({ error: { codigo: "CREDENCIALES_INVALIDAS", mensaje: "Clave incorrecta." } }, { status: 401 }));
    renderToStaticMarkup(createElement(FormularioCambiarClave, { perfil: "ADMIN" }));
    await dobles.enviar!(valores);
    expect(dobles.setError).toHaveBeenCalledWith("claveActual", { message: "La clave actual es incorrecta." });
    expect(dobles.setFocus).toHaveBeenCalledWith("claveActual");
    expect(dobles.navegar).not.toHaveBeenCalled();
    dobles.fetch.mockResolvedValue(Response.json({ error: { mensaje: "Hay campos con errores.", campos: { claveNueva: "Clave rechazada." } } }, { status: 422 }));
    expect((await solicitarCambioClave(valores)).error?.campos).toEqual({ claveNueva: "Clave rechazada." });
  });

  it("conserva el formulario ante errores de conexión y respuestas inválidas", async () => {
    dobles.fetch.mockRejectedValue(new Error("sin conexión"));
    expect((await solicitarCambioClave(valores)).error?.mensaje).toContain("Revise su conexión");
    dobles.fetch.mockResolvedValue(new Response("no-json", { status: 200 }));
    expect((await solicitarCambioClave(valores)).error?.mensaje).toContain("No se pudo cambiar la clave");
    expect(dobles.navegar).not.toHaveBeenCalled();
  });
});
