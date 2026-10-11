import { describe, expect, it } from "vitest";

import {
  esquemaCambioEstado,
  esquemaConsultaClientes,
  esquemaCrearCliente,
  esquemaEditarCliente,
  objetoDeParametros,
} from "@/modules/clientes/schema";

const VERSION = "2026-10-06T01:17:26.214Z";

function crear(entrada: Record<string, unknown>) {
  return esquemaCrearCliente.safeParse({ nombre: "Cliente", tipo: "EMPRESA", telefono: "8888 0000", ...entrada });
}

function editar(entrada: Record<string, unknown>) {
  return esquemaEditarCliente.safeParse({ version: VERSION, ...entrada });
}

function camposConError(resultado: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }): string[] {
  return resultado.error?.issues.map((problema) => problema.path.join(".")) ?? [];
}

describe("esquemaCrearCliente: nombre", () => {
  it("quita espacios sobrantes en los extremos y entre palabras", () => {
    const resultado = crear({ nombre: "  Taller   de  Carpintería  " });
    expect(resultado.success && resultado.data.nombre).toBe("Taller de Carpintería");
  });

  it("rechaza un nombre vacío o de solo espacios", () => {
    for (const nombre of ["", "   "]) {
      const resultado = crear({ nombre });
      expect(resultado.success).toBe(false);
      expect(camposConError(resultado)).toContain("nombre");
    }
  });

  it("rechaza un nombre ausente o que no es texto", () => {
    expect(camposConError(esquemaCrearCliente.safeParse({ tipo: "EMPRESA", telefono: "1" }))).toContain("nombre");
    expect(crear({ nombre: 7 }).success).toBe(false);
  });

  it("admite 200 caracteres y rechaza 201", () => {
    expect(crear({ nombre: "a".repeat(200) }).success).toBe(true);
    const largo = crear({ nombre: "a".repeat(201) });
    expect(camposConError(largo)).toEqual(["nombre"]);
  });
});

describe("esquemaCrearCliente: tipo", () => {
  it("acepta PERSONA y EMPRESA", () => {
    expect(crear({ tipo: "PERSONA" }).success).toBe(true);
    expect(crear({ tipo: "EMPRESA" }).success).toBe(true);
  });

  it("rechaza un tipo desconocido o ausente", () => {
    expect(camposConError(crear({ tipo: "ONG" }))).toEqual(["tipo"]);
    expect(camposConError(crear({ tipo: undefined }))).toEqual(["tipo"]);
  });
});

describe("esquemaCrearCliente: cadenas vacías", () => {
  it("convierte a nulo las cadenas vacías o de solo espacios en todos los campos opcionales", () => {
    const resultado = crear({
      ruc: "  ",
      contactoPrincipal: "",
      correo: "   ",
      direccion: " ",
      notas: "\n",
    });
    expect(resultado.success && resultado.data).toMatchObject({
      ruc: null,
      contactoPrincipal: null,
      correo: null,
      direccion: null,
      notas: null,
    });
  });

  it("trata los campos ausentes y los nulos como nulo", () => {
    const resultado = esquemaCrearCliente.safeParse({ nombre: "A", tipo: "PERSONA", telefono: "8888", ruc: null });
    expect(resultado.success && resultado.data).toMatchObject({ ruc: null, correo: null, notas: null });
  });

  it("recorta los extremos del teléfono sin tocar el interior", () => {
    const resultado = crear({ telefono: "  +505 8765 4321 " });
    expect(resultado.success && resultado.data.telefono).toBe("+505 8765 4321");
  });
});

describe("esquemaCrearCliente: RUC", () => {
  it("lo guarda en mayúsculas y sin espacios", () => {
    const resultado = crear({ ruc: " j0310 000 12345 6 " });
    expect(resultado.success && resultado.data.ruc).toBe("J0310000123456");
  });

  it("admite 20 caracteres y rechaza 21", () => {
    expect(crear({ ruc: "A".repeat(20) }).success).toBe(true);
    expect(camposConError(crear({ ruc: "A".repeat(21) }))).toEqual(["ruc"]);
  });

  it("mide la longitud después de quitar los espacios", () => {
    expect(crear({ ruc: `${"A".repeat(10)} ${"B".repeat(10)}` }).success).toBe(true);
  });
});

describe("esquemaCrearCliente: correo", () => {
  it("lo guarda en minúsculas y sin espacios en los extremos", () => {
    const resultado = crear({ correo: "  Ventas@Empresa.TEST " });
    expect(resultado.success && resultado.data.correo).toBe("ventas@empresa.test");
  });

  it("rechaza formatos inválidos", () => {
    for (const correo of ["sin-arroba", "@empresa.test", "a@", "a b@empresa.test"]) {
      expect(camposConError(crear({ correo }))).toContain("correo");
    }
  });

  it("rechaza más de 254 caracteres", () => {
    const largo = `${"a".repeat(250)}@e.co`;
    expect(camposConError(crear({ correo: largo }))).toContain("correo");
  });
});

describe("esquemaCrearCliente: longitudes", () => {
  it("aplica los máximos de contacto 120 y teléfono 30", () => {
    expect(crear({ contactoPrincipal: "c".repeat(120) }).success).toBe(true);
    expect(camposConError(crear({ contactoPrincipal: "c".repeat(121) }))).toEqual(["contactoPrincipal"]);
    expect(crear({ telefono: "1".repeat(30) }).success).toBe(true);
    expect(camposConError(crear({ telefono: "1".repeat(31) }))).toEqual(["telefono"]);
  });

  it("rechaza valores que no son texto", () => {
    expect(camposConError(crear({ notas: 5 }))).toEqual(["notas"]);
  });
});

describe("esquemaCrearCliente: medio de contacto", () => {
  it("exige teléfono o correo y reporta ambos campos", () => {
    const resultado = esquemaCrearCliente.safeParse({ nombre: "A", tipo: "PERSONA" });
    expect(resultado.success).toBe(false);
    expect(camposConError(resultado).sort()).toEqual(["correo", "telefono"]);
  });

  it("trata un teléfono vacío como ausente", () => {
    const resultado = esquemaCrearCliente.safeParse({ nombre: "A", tipo: "PERSONA", telefono: "  " });
    expect(resultado.success).toBe(false);
  });

  it("acepta solo correo o solo teléfono", () => {
    expect(esquemaCrearCliente.safeParse({ nombre: "A", tipo: "PERSONA", correo: "a@b.co" }).success).toBe(true);
    expect(esquemaCrearCliente.safeParse({ nombre: "A", tipo: "PERSONA", telefono: "8888" }).success).toBe(true);
  });
});

describe("esquemaEditarCliente", () => {
  it("descarta el código al crear y rechaza modificar el código asignado", () => {
    const resultado = crear({ codigoCliente: "CLI-9999" });
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data).not.toHaveProperty("codigoCliente");
    expect(camposConError(editar({ codigoCliente: "CLI-9999" }))).toEqual(["codigoCliente"]);
  });
  it("exige la versión", () => {
    const resultado = esquemaEditarCliente.safeParse({ nombre: "Nuevo" });
    expect(camposConError(resultado)).toEqual(["version"]);
  });

  it("rechaza una versión que no es un instante", () => {
    expect(camposConError(editar({ version: "ayer" }))).toEqual(["version"]);
  });

  it("deja sin definir los campos omitidos", () => {
    const resultado = editar({ nombre: "Nuevo" });
    expect(resultado.success && resultado.data).toEqual({ version: VERSION, nombre: "Nuevo" });
  });

  it("convierte a nulo los campos con nulo o vacío, para borrarlos", () => {
    const resultado = editar({ ruc: "", correo: null, notas: "  " });
    expect(resultado.success && resultado.data).toMatchObject({ ruc: null, correo: null, notas: null });
  });

  it("normaliza RUC y correo como al crear", () => {
    const resultado = editar({ ruc: " a 1 ", correo: "X@Y.CO" });
    expect(resultado.success && resultado.data).toMatchObject({ ruc: "A1", correo: "x@y.co" });
  });

  it("no permite vaciar el nombre ni el tipo", () => {
    expect(camposConError(editar({ nombre: "  " }))).toEqual(["nombre"]);
    expect(camposConError(editar({ nombre: null }))).toEqual(["nombre"]);
    expect(camposConError(editar({ tipo: null }))).toEqual(["tipo"]);
  });

  it("rechaza activo, id y marcas de tiempo, cada uno en su campo", () => {
    const resultado = editar({
      activo: false,
      id: "x",
      creadoEn: VERSION,
      actualizadoEn: VERSION,
    });
    expect(resultado.success).toBe(false);
    expect(camposConError(resultado).sort()).toEqual(["activo", "actualizadoEn", "creadoEn", "id"]);
  });

  it("no exige el medio de contacto: lo valida el servicio sobre el cliente resultante", () => {
    expect(editar({ telefono: null }).success).toBe(true);
  });
});

describe("esquemaCambioEstado", () => {
  it("exige la versión", () => {
    const resultado = esquemaCambioEstado.safeParse({});
    expect(resultado.success).toBe(false);
    expect(camposConError(resultado)).toEqual(["version"]);
    expect(esquemaCambioEstado.safeParse({ version: VERSION }).success).toBe(true);
  });

  it("rechaza una versión inválida", () => {
    expect(esquemaCambioEstado.safeParse({ version: "x" }).success).toBe(false);
  });
});

describe("esquemaConsultaClientes", () => {
  it("usa activos, página 1 y 20 por página por defecto", () => {
    expect(esquemaConsultaClientes.parse({})).toEqual({ activo: true, pagina: 1, porPagina: 20 });
  });

  it("interpreta los parámetros de texto", () => {
    const consulta = esquemaConsultaClientes.parse({ q: "ana", tipo: "PERSONA", activo: "false", pagina: "3", porPagina: "50" });
    expect(consulta).toEqual({ q: "ana", tipo: "PERSONA", activo: false, pagina: 3, porPagina: 50 });
  });

  it("rechaza porPagina fuera de 1 a 100 y páginas no válidas", () => {
    for (const parametros of [{ porPagina: "101" }, { porPagina: "0" }, { pagina: "0" }, { pagina: "x" }, { pagina: "1.5" }, { pagina: "100001" }]) {
      expect(esquemaConsultaClientes.safeParse(parametros).success).toBe(false);
    }
  });

  it("rechaza tipo y estado desconocidos", () => {
    expect(esquemaConsultaClientes.safeParse({ tipo: "ONG" }).success).toBe(false);
    expect(esquemaConsultaClientes.safeParse({ activo: "todos" }).success).toBe(false);
  });
});

describe("objetoDeParametros", () => {
  it("descarta los parámetros vacíos y toma el primer valor de las listas", () => {
    const objeto = objetoDeParametros({ q: "  ", tipo: "", pagina: ["2", "3"], activo: undefined });
    expect(objeto).toEqual({ pagina: "2" });
  });

  it("lee un URLSearchParams", () => {
    expect(objetoDeParametros(new URLSearchParams("q=ana&tipo="))).toEqual({ q: "ana" });
  });
});
