import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PERFILES } from "@/core/permisos";
import { AvisoAdmin } from "@/modules/admin/componentes/AvisoAdmin";
import { ClaveTemporal } from "@/modules/admin/componentes/ClaveTemporal";
import { FilaConfiguracion, type ParametroDto } from "@/modules/admin/componentes/FilaConfiguracion";
import {
  diferenciasPermisos, esquemaValorConfiguracion, estadoUsuario, filtrarUsuarios,
  hrefUsuarios, leerFiltrosUsuarios, permisoProtegido,
} from "@/modules/admin/componentes/interfaz";
import { peticionAdministracion } from "@/modules/admin/componentes/peticion";
import { TablaPermisos, type MatrizDto } from "@/modules/admin/componentes/TablaPermisos";
import { esquemaCrearUsuario } from "@/modules/admin/schema";
import type { UsuarioDto } from "@/modules/admin/tipos";

const AHORA = Date.parse("2026-10-10T12:00:00Z");
const VERSION = "2026-10-10T11:00:00.000Z";
const usuario: UsuarioDto = {
  id: "018fe247-e231-4fea-b2c4-1fa06778a386", nombre: "Ana López", correo: "ana@example.test", activo: true,
  perfiles: ["ADMIN", "GERENCIA"], intentosFallidos: 0, bloqueadoHasta: null, ultimoAcceso: null,
  creadoEn: VERSION, actualizadoEn: VERSION,
};

afterEach(() => vi.unstubAllGlobals());

describe("Lista de usuarios", () => {
  it("distingue bloqueos vigentes, vencidos e inactividad", () => {
    expect(estadoUsuario({ ...usuario, bloqueadoHasta: "2026-10-10T12:01:00Z" }, AHORA)).toBe("BLOQUEADO");
    expect(estadoUsuario({ ...usuario, bloqueadoHasta: "2026-10-10T12:00:00Z" }, AHORA)).toBe("ACTIVO");
    expect(estadoUsuario({ ...usuario, activo: false, bloqueadoHasta: "2026-10-10T12:01:00Z" }, AHORA)).toBe("INACTIVO");
  });

  it("combina nombre o correo con perfil y estado", () => {
    const bloqueado = { ...usuario, id: "otro", bloqueadoHasta: "2026-10-10T13:00:00Z" };
    const filtros = leerFiltrosUsuarios({ q: "ANA", perfil: "GERENCIA", estado: "BLOQUEADO" });
    expect(filtrarUsuarios([usuario, bloqueado], filtros, AHORA)).toEqual([bloqueado]);
    expect(filtrarUsuarios([usuario], leerFiltrosUsuarios({ q: "example.test" }), AHORA)).toEqual([usuario]);
    expect(filtrarUsuarios([usuario], { ...filtros, perfil: "PRODUCCION", estado: "" }, AHORA)).toEqual([]);
  });

  it("conserva los filtros al paginar y normaliza parámetros inválidos", () => {
    const filtros = leerFiltrosUsuarios({ q: "Ana & Jorge", perfil: "ADMIN", estado: "INACTIVO", pagina: "2" });
    const url = new URL(hrefUsuarios(filtros, 3), "https://plataforma.test");
    expect(url.searchParams.get("q")).toBe("Ana & Jorge");
    expect(url.searchParams.get("perfil")).toBe("ADMIN");
    expect(url.searchParams.get("estado")).toBe("INACTIVO");
    expect(url.searchParams.get("pagina")).toBe("3");
    expect(leerFiltrosUsuarios({ q: ["uno", "dos"], perfil: "otro", estado: "otro", pagina: "NaN" }))
      .toEqual({ q: "", perfil: "", estado: "", pagina: 1 });
  });
});

describe("Formulario de usuario y errores", () => {
  it("exige un perfil y normaliza correo y nombre", () => {
    expect(esquemaCrearUsuario.safeParse({ nombre: "Ana", correo: "ana@example.test", perfiles: [] }).success).toBe(false);
    expect(esquemaCrearUsuario.parse({ nombre: " Ana ", correo: " ANA@example.test ", perfiles: ["ADMIN"] }))
      .toEqual({ nombre: "Ana", correo: "ana@example.test", perfiles: ["ADMIN"] });
  });

  it("envía la versión de edición y conserva el conflicto 409", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { codigo: "CONFLICTO_EDICION", mensaje: "El usuario cambió." },
    }), { status: 409 }));
    vi.stubGlobal("fetch", fetch);
    const resultado = await peticionAdministracion("/api/v1/usuarios/uno", {
      metodo: "PATCH", cuerpo: { nombre: "Ana", version: VERSION },
    });
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: "PATCH", cache: "no-store" });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ nombre: "Ana", version: VERSION });
    expect(resultado.error).toMatchObject({ codigo: "CONFLICTO_EDICION", status: 409 });
  });

  it("presenta las reglas de ADMIN como alertas accesibles", () => {
    const html = renderToStaticMarkup(createElement(AvisoAdmin, { mensaje: "No puede quitarse su perfil ADMIN." }));
    expect(html).toContain('role="alert"');
    expect(html).toContain("No puede quitarse su perfil ADMIN.");
    const conflicto = renderToStaticMarkup(createElement(AvisoAdmin, { mensaje: "El usuario cambió.", alRecargar: vi.fn() }));
    expect(conflicto).toContain("Recargar datos");
    expect(conflicto).toContain("Los cambios sin guardar se perderán.");
  });

  it("presenta la clave con copia y advertencia de exposición única", () => {
    const html = renderToStaticMarkup(createElement(ClaveTemporal, { clave: "clave-temporal-16", alCerrar: vi.fn() }));
    expect(html).toContain("clave-temporal-16");
    expect(html).toContain("No se vuelve a mostrar.");
    expect(html).toContain("Copiar clave");
    expect(html).toContain("Cerrar clave");
  });

  it("conserva los errores por campo y captura fallos de conexión", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { codigo: "DUPLICADO", mensaje: "Correo existente.", campos: { correo: "Correo existente." } },
    }), { status: 409 })));
    expect((await peticionAdministracion("/api/v1/usuarios", { metodo: "POST" })).error?.campos?.correo).toBe("Correo existente.");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("sin conexión")));
    expect((await peticionAdministracion("/api/v1/usuarios", { metodo: "POST" })).error?.mensaje).toContain("Revise la conexión");
  });
});

describe("Matriz de permisos", () => {
  it("resume altas y bajas sin depender del orden", () => {
    expect(diferenciasPermisos(["cliente:ver", "usuario:gestionar"], ["usuario:gestionar", "orden:ver"]))
      .toEqual({ altas: ["orden:ver"], bajas: ["cliente:ver"] });
    expect(diferenciasPermisos(["orden:ver", "cliente:ver"], ["cliente:ver", "orden:ver"]))
      .toEqual({ altas: [], bajas: [] });
  });

  it("protege exclusivamente los tres permisos administrativos de ADMIN", () => {
    for (const permiso of ["usuario:gestionar", "permiso:gestionar", "configuracion:gestionar"]) {
      expect(permisoProtegido("ADMIN", permiso)).toBe(true);
      expect(permisoProtegido("GERENCIA", permiso)).toBe(false);
    }
    expect(permisoProtegido("ADMIN", "bitacora:ver")).toBe(false);
  });

  it("etiqueta cada celda y mantiene marcadas las casillas protegidas", () => {
    const datos: MatrizDto = {
      perfiles: PERFILES.map(({ codigo, nombre, descripcion }) => ({ id: codigo, codigo, nombre, descripcion })),
      permisos: [{ recurso: "usuario", permisos: [{ id: "uno", codigo: "usuario:gestionar", accion: "gestionar", descripcion: "Gestionar usuarios" }] }],
      matriz: [],
    };
    const html = renderToStaticMarkup(createElement(TablaPermisos, {
      datos, seleccion: {}, guardados: {}, enviando: false, alCambiar: vi.fn(), alGuardar: vi.fn(),
    }));
    for (const { codigo } of PERFILES) expect(html).toContain(`aria-label="Perfil ${codigo}: permiso usuario:gestionar"`);
    const casilla = html.match(/<button[^>]*aria-label="Perfil ADMIN: permiso usuario:gestionar"[^>]*>/)?.[0];
    expect(casilla).toContain('aria-checked="true"');
    expect(casilla).toContain('disabled=""');
    expect(casilla).toContain('aria-describedby="permisos-protegidos"');
    expect(html).toContain("overflow-x-auto");
    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
  });
});

describe("Configuración", () => {
  it.each([
    ["iva_porcentaje", "DECIMAL", "0", true], ["iva_porcentaje", "DECIMAL", "100", true],
    ["iva_porcentaje", "DECIMAL", "100.01", false], ["iva_porcentaje", "DECIMAL", "-1", false],
    ["iva_porcentaje", "DECIMAL", "15,5", false], ["cotizacion_vigencia_dias", "ENTERO", "1", true],
    ["cotizacion_vigencia_dias", "ENTERO", "365", true], ["cotizacion_vigencia_dias", "ENTERO", "366", false],
    ["cotizacion_vigencia_dias", "ENTERO", "1.5", false], ["moneda", "TEXTO", "NIO", true],
    ["moneda", "TEXTO", "nio", false], ["empresa_nombre", "TEXTO", " ", false],
    ["zona_horaria", "TEXTO", "America/Managua", false],
  ].map(([clave, tipo, valor, valido]) => ({ clave, tipo, valor, valido })))("valida $clave con valor $valor", ({ clave, tipo, valor, valido }) => {
    expect(esquemaValorConfiguracion({ clave: String(clave), tipo: String(tipo) }).safeParse(valor).success).toBe(valido);
  });

  it("presenta zona horaria sin guardar y con valor de solo lectura", () => {
    const inicial: ParametroDto = {
      clave: "zona_horaria", valor: "America/Managua", tipo: "TEXTO", descripcion: "Zona horaria del sistema.",
      actualizadoEn: VERSION, actualizadoPorId: null,
    };
    const html = renderToStaticMarkup(createElement(FilaConfiguracion, { inicial }));
    expect(html).toContain('readOnly=""');
    expect(html).toContain("Última edición");
    expect(html).toContain("Valor actual");
    expect(html).toContain("Zona horaria del sistema.");
    expect(html).not.toContain('type="submit"');
  });
});
