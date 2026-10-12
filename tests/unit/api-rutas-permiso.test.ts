import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import * as ts from "typescript";
import { describe, expect, it } from "vitest";

import { CATALOGO_PERMISOS } from "@/core/permisos";

const RAIZ_API = resolve(process.cwd(), "src/app/api/v1");
const METODOS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const PERMISOS = new Set<string>(CATALOGO_PERMISOS.map(({ permiso }) => permiso));

// Las excepciones autorizan solamente el método indicado, nunca toda la ruta.
const EXCEPCIONES = [
  { ruta: "salud", metodo: "GET", motivo: "Comprueba la disponibilidad sin usar manejar." },
  { ruta: "auth/login", metodo: "POST", motivo: "Inicia una sesión mediante una ruta pública." },
  { ruta: "auth/logout", metodo: "POST", motivo: "Finaliza una sesión mediante una ruta pública." },
  { ruta: "auth/yo", metodo: "GET", motivo: "Consulta la sesión propia sin exigir permisos de negocio." },
  { ruta: "auth/cambiar-clave", metodo: "POST", motivo: "Cambia la clave propia con una sesión autenticada." },
  { ruta: "ordenes/opciones", metodo: "GET", motivo: "Filtra las opciones según los permisos en el servicio." },
  { ruta: "ordenes/[id]", metodo: "PATCH", motivo: "Exige el permiso correspondiente dentro del handler." },
  { ruta: "reportes/[nombre]", metodo: "GET", motivo: "Selecciona el permiso del reporte dentro del handler." },
] as const;

type Handler = { ruta: string; metodo: string; nodo: ts.Node | undefined };

function buscarRutas(directorio: string): string[] {
  return readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
    const archivo = join(directorio, entrada.name);
    if (entrada.isDirectory()) return buscarRutas(archivo);
    return entrada.isFile() && entrada.name === "route.ts" ? [archivo] : [];
  }).sort();
}

function esExportado(nodo: ts.Node): boolean {
  return ts.canHaveModifiers(nodo)
    && (ts.getModifiers(nodo)?.some((modificador) => modificador.kind === ts.SyntaxKind.ExportKeyword) ?? false);
}

function nombresDeclarados(nombre: ts.BindingName): string[] {
  if (ts.isIdentifier(nombre)) return [nombre.text];
  return nombre.elements.flatMap((elemento) => (
    ts.isBindingElement(elemento) ? nombresDeclarados(elemento.name) : []
  ));
}

function declaracionesLocales(fuente: ts.SourceFile): Map<string, ts.Node | undefined> {
  const declaraciones = new Map<string, ts.Node | undefined>();
  for (const sentencia of fuente.statements) {
    if (ts.isFunctionDeclaration(sentencia) && sentencia.name) {
      declaraciones.set(sentencia.name.text, sentencia);
    }
    if (!ts.isVariableStatement(sentencia)) continue;
    for (const declaracion of sentencia.declarationList.declarations) {
      for (const nombre of nombresDeclarados(declaracion.name)) {
        declaraciones.set(nombre, ts.isIdentifier(declaracion.name) ? declaracion.initializer : undefined);
      }
    }
  }
  return declaraciones;
}

function handlersDeRuta(archivo: string): Handler[] {
  const fuente = ts.createSourceFile(archivo, readFileSync(archivo, "utf8"), ts.ScriptTarget.Latest, true);
  const ruta = relative(RAIZ_API, archivo).split(sep).slice(0, -1).join("/");
  const locales = declaracionesLocales(fuente);
  const exportaciones = new Map<string, ts.Node | undefined>();
  for (const sentencia of fuente.statements) {
    if (esExportado(sentencia) && ts.isFunctionDeclaration(sentencia) && sentencia.name) {
      exportaciones.set(sentencia.name.text, sentencia);
    }
    if (esExportado(sentencia) && ts.isVariableStatement(sentencia)) {
      for (const declaracion of sentencia.declarationList.declarations) {
        for (const nombre of nombresDeclarados(declaracion.name)) {
          exportaciones.set(nombre, locales.get(nombre));
        }
      }
    }
    if (!ts.isExportDeclaration(sentencia) || sentencia.isTypeOnly) continue;
    if (!sentencia.exportClause || !ts.isNamedExports(sentencia.exportClause)) {
      throw new Error(`${ruta}: declare las exportaciones HTTP explícitamente.`);
    }
    for (const elemento of sentencia.exportClause.elements) {
      if (elemento.isTypeOnly) continue;
      const local = (elemento.propertyName ?? elemento.name).text;
      exportaciones.set(elemento.name.text, sentencia.moduleSpecifier ? undefined : locales.get(local));
    }
  }
  return [...exportaciones].filter(([metodo]) => METODOS.has(metodo))
    .map(([metodo, nodo]) => ({ ruta, metodo, nodo }));
}

function opcionesDeManejar(nodo: ts.Node | undefined): ts.ObjectLiteralExpression | undefined {
  if (!nodo || !ts.isCallExpression(nodo)) return undefined;
  if (!ts.isIdentifier(nodo.expression) || nodo.expression.text !== "manejar") return undefined;
  const opciones = nodo.arguments[0];
  return opciones && ts.isObjectLiteralExpression(opciones) ? opciones : undefined;
}

function nombreDePropiedad(propiedad: ts.ObjectLiteralElementLike): string | undefined {
  const nombre = propiedad.name;
  if (!nombre) return undefined;
  if (ts.isIdentifier(nombre) || ts.isStringLiteral(nombre)) return nombre.text;
  if (ts.isComputedPropertyName(nombre) && ts.isStringLiteral(nombre.expression)) return nombre.expression.text;
  return undefined;
}

const rutas = buscarRutas(RAIZ_API).map((archivo) => ({ archivo, handlers: handlersDeRuta(archivo) }));
const handlers = rutas.flatMap(({ handlers: encontrados }) => encontrados);

describe("Permisos explícitos de los handlers de la API", () => {
  it("descubre rutas, handlers y permisos sin consultar la base de datos", () => {
    expect(rutas.length).toBeGreaterThan(0);
    expect(handlers.length).toBeGreaterThan(0);
    expect(PERMISOS.size).toBeGreaterThan(0);
    for (const { archivo, handlers: encontrados } of rutas) {
      expect(encontrados.length, archivo).toBeGreaterThan(0);
    }
  });

  it("mantiene las excepciones explícitas, documentadas y vigentes", () => {
    const claves = EXCEPCIONES.map(({ ruta, metodo }) => `${metodo} ${ruta}`);
    expect(new Set(claves).size).toBe(claves.length);
    for (const excepcion of EXCEPCIONES) {
      expect(excepcion.motivo.trim().length).toBeGreaterThan(0);
      expect(handlers.some(({ ruta, metodo }) => ruta === excepcion.ruta && metodo === excepcion.metodo),
        `${excepcion.metodo} ${excepcion.ruta}: ${excepcion.motivo}`).toBe(true);
    }
  });

  it.each(handlers)("$metodo /api/v1/$ruta declara un permiso del catálogo", ({ ruta, metodo, nodo }) => {
    const etiqueta = `${metodo} /api/v1/${ruta}`;
    const excepcion = EXCEPCIONES.find((entrada) => entrada.ruta === ruta && entrada.metodo === metodo);
    const opciones = opcionesDeManejar(nodo);
    const propiedades = opciones?.properties.filter((propiedad) => nombreDePropiedad(propiedad) === "permiso") ?? [];
    // Una excepción con permiso explícito también debe usar el catálogo.
    if (excepcion && propiedades.length === 0) return;
    expect(opciones, `${etiqueta}: use manejar con un objeto literal de opciones.`).toBeDefined();
    if (!opciones) return;
    expect(opciones.properties.some(ts.isSpreadAssignment), `${etiqueta}: evite sobrescribir las opciones.`).toBe(false);
    expect(opciones.properties.some((propiedad) => nombreDePropiedad(propiedad) === "publica"),
      `${etiqueta}: una ruta protegida debe cargar la sesión.`).toBe(false);
    expect(propiedades, `${etiqueta}: declare exactamente un permiso explícito.`).toHaveLength(1);
    const propiedad = propiedades[0];
    expect(propiedad && ts.isPropertyAssignment(propiedad), `${etiqueta}: asigne un permiso literal.`).toBe(true);
    if (!propiedad || !ts.isPropertyAssignment(propiedad)) return;
    expect(ts.isStringLiteral(propiedad.initializer), `${etiqueta}: use permiso: "recurso:accion".`).toBe(true);
    if (!ts.isStringLiteral(propiedad.initializer)) return;
    const permiso = propiedad.initializer.text;
    expect(permiso, etiqueta).toMatch(/^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$/);
    expect(PERMISOS.has(permiso), `${etiqueta}: el permiso ${permiso} debe existir en el catálogo.`).toBe(true);
  });
});
